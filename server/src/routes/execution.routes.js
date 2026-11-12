import { Router } from 'express';
import runner from '../../../electron/execution/runner.js';
import stress from '../../../electron/execution/stress.js';
import { prisma } from '../db/prisma.js';
import { getProblemExecution, solutions, testCases, submissions } from '../db/member2.js';
import { requireAuth } from '../middleware/auth.js';
import { createExecutionEmitter } from '../services/executionEmitter.js';

const router = Router();
const active = new Set();
const memoryLimitKiB = 512 * 1024;
const loopback = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const positiveId = (value) => /^[1-9]\d*$/.test(String(value)) && Number(value) <= 2147483647;
const notFound = (res) => res.status(404).json({ error: 'Record not found' });
const validName = (value) => typeof value === 'string' && value.trim() && value.length <= 200;

router.use(requireAuth);

router.use('/problems/:problemId', async (req, res, next) => {
  if (!positiveId(req.params.problemId)) return res.status(400).json({ error: 'Invalid problem ID' });
  req.problemId = Number(req.params.problemId);
  const problem = await prisma.problem.findUnique({
    where: { id: req.problemId },
    select: { createdById: true },
  });
  if (!problem) return notFound(res);
  if (req.user.role !== 'admin' && req.user.id !== problem.createdById) {
    return res.status(403).json({ error: 'Only the problem owner or an admin can access its execution records' });
  }
  next();
});

const problem = '/problems/:problemId';
router.get(problem, async (req, res) => res.json(await getProblemExecution(req.problemId)));

function registerCrud(path, key, records, fields, validate) {
  const pick = (body) => Object.fromEntries(fields.filter((field) => body[field] !== undefined)
    .map((field) => [field, body[field]]));
  router.get(path, async (req, res) => {
    const detail = await getProblemExecution(req.problemId);
    if (!detail) return notFound(res);
    res.json(detail[key]);
  });
  router.post(path, async (req, res) => {
    const body = req.body ?? {};
    const data = pick(body);
    try {
      validate(data);
      if (key === 'testCases' && !positiveId(body.caseNumber)) throw new Error('Provide a positive case number');
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
    const args = key === 'testCases' ? [Number(body.caseNumber), data] : [data];
    res.status(201).json(await records.create(req.problemId, ...args));
  });
  router.get(`${path}/:id`, async (req, res) => {
    if (!positiveId(req.params.id)) return notFound(res);
    const record = await records.get(req.problemId, Number(req.params.id));
    if (!record) return notFound(res);
    if (key === 'testCases') {
      const { expected: _expected, ...publicFields } = record;
      return res.json(publicFields);
    }
    res.json(record);
  });
  router.patch(`${path}/:id`, async (req, res) => {
    if (!positiveId(req.params.id)) return notFound(res);
    const id = Number(req.params.id);
    const existing = await records.get(req.problemId, id);
    if (!existing) return notFound(res);
    const data = pick(req.body ?? {});
    try {
      validate({ ...existing, ...data });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
    res.json(await records.update(req.problemId, id, data));
  });
  router.delete(`${path}/:id`, async (req, res) => {
    if (!positiveId(req.params.id)) return notFound(res);
    await records.remove(req.problemId, Number(req.params.id));
    res.status(204).end();
  });
}

registerCrud(`${problem}/solutions`, 'solutions', solutions, ['name', 'language', 'code'], (data) => {
  if (!validName(data.name)) throw new Error('Provide a solution name of at most 200 characters');
  runner.validateScript(data);
});
registerCrud(`${problem}/test-cases`, 'testCases', testCases, ['name', 'input', 'expected'], (data) => {
  if (!validName(data.name)) throw new Error('Provide a test case name of at most 200 characters');
  if (typeof data.input !== 'string' || typeof data.expected !== 'string') throw new Error('Provide input and expected output');
  runner.validateInput(data.input);
  runner.validateInput(data.expected);
});

router.get(`${problem}/submissions`, async (req, res) => res.json(await submissions.list(req.problemId)));
router.get(`${problem}/submissions/:id`, async (req, res) => {
  if (!positiveId(req.params.id)) return notFound(res);
  const row = await submissions.get(req.problemId, Number(req.params.id));
  if (!row) return notFound(res);
  res.json(row);
});

router.post(`${problem}/submissions`, async (req, res) => {
  if (!loopback.has(req.socket.remoteAddress)) {
    return res.status(403).json({ error: 'Execution is available only on the local machine' });
  }
  const { solutionId, caseNumber, language, code, stdin = '', expected, checkExpected, timeLimit } = req.body ?? {};
  if ((solutionId !== undefined && !positiveId(solutionId)) ||
      (caseNumber !== undefined && !positiveId(caseNumber))) {
    return res.status(400).json({ error: 'Invalid solution ID or case number' });
  }
  const solution = solutionId === undefined ? { language, code } : await solutions.get(req.problemId, Number(solutionId));
  const testCase = caseNumber === undefined ? null : await testCases.get(req.problemId, Number(caseNumber));
  if (!solution || (caseNumber !== undefined && !testCase)) return notFound(res);
  const run = { language: solution.language, code: solution.code, stdin: testCase?.input ?? stdin, timeLimit };
  const compare = testCase ? true : checkExpected === true;
  const target = testCase?.expected ?? expected;
  try {
    runner.validateScript(run);
    runner.validateLimit(timeLimit);
    runner.validateInput(run.stdin);
    if (compare) {
      if (typeof target !== 'string') throw new Error('Provide expected output');
      runner.validateInput(target);
    }
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
  if (active.size >= 2 || active.has(req.user.id)) {
    return res.status(429).json({ error: 'Execution capacity reached. Try again after the active run ends.' });
  }
  const controller = new AbortController();
  const cancel = () => controller.abort();
  active.add(req.user.id);
  res.once('close', cancel);
  try {
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no' });
    res.flushHeaders();
    const events = createExecutionEmitter(res);
    events.emit('update', 'status', { status: 'started', memoryLimitKiB });
    let phase = 'started';
    const result = await runner.runCode(run, {
      signal: controller.signal,
      memoryLimitKiB,
      onPhase: (status) => {
        phase = status;
        events.emit('update', 'status', { status });
      },
      onMetrics: (phase, sample) => events.emit('update', 'metrics', { phase, ...sample }),
      onOutput: (output) => events.emit('update', 'output', output),
    });
    if (result.status === 'AC' && compare && stress.normalize(result.stdout) !== stress.normalize(target)) {
      result.status = 'WA';
    }
    const row = await submissions.create({
      problemId: req.problemId,
      solutionId: solutionId === undefined ? null : Number(solutionId),
      verdict: result.status,
      runtimeMs: phase !== 'running' || result.status === 'CANCELLED' ? null : result.time ?? null,
      memoryKiB: phase !== 'running' || result.status === 'CANCELLED' ? null : result.memory ?? null,
      request: { ...run, ...(timeLimit === undefined ? { timeLimit: 2000 } : {}), caseNumber: caseNumber ?? null },
      result,
    });
    events.emit('update', 'result', { ...result, submissionId: row.id });
  } catch {
    if (!res.destroyed) res.write('event: error\ndata: {"error":"Execution or submission storage failed"}\n\n');
  } finally {
    active.delete(req.user.id);
    res.removeListener('close', cancel);
    res.end();
  }
});

router.use((error, _req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.code === 'P2025') return notFound(res);
  if (['P2002', 'P2003'].includes(error.code)) return res.status(409).json({ error: 'Record conflicts with existing data' });
  if (error.status === 400 || error.status === 413) return res.status(error.status).json({ error: error.message });
  res.status(500).json({ error: 'Execution API request failed' });
});

export default router;
