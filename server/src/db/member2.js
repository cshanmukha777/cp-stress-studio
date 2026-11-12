import { prisma } from './prisma.js';

export function withExecutionDb(operation) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL lock_timeout = '1500ms'`;
    await tx.$executeRaw`SET LOCAL statement_timeout = '2500ms'`;
    return operation(tx);
  }, { maxWait: 1500, timeout: 5000 });
}

const contentionCodes = new Set(['55P03', '40P01', '40001', '57014', 'P1008', 'P2024', 'P2028', 'P2034']);

export function isExecutionDbBusy(error) {
  const adapter = error?.meta?.driverAdapterError?.cause ?? error?.cause;
  return [error?.code, error?.meta?.code, adapter?.code, adapter?.originalCode]
    .some((code) => contentionCodes.has(code));
}

export function getProblemExecution(problemId) {
  return prisma.problem.findUnique({
    where: { id: problemId },
    select: {
      id: true,
      title: true,
      solutions: {
        orderBy: { id: 'asc' },
        select: { id: true, name: true, language: true, code: true },
      },
      testCases: {
        orderBy: { caseNumber: 'asc' },
        omit: { expected: true },
      },
    },
  });
}

export const solutions = {
  create: (problemId, data) => prisma.solution.create({ data: { problemId, ...data } }),
  get: (problemId, id, db = prisma) => db.solution.findUnique({ where: { problemId_id: { problemId, id } } }),
  update: (problemId, id, data) =>
    prisma.solution.update({ where: { problemId_id: { problemId, id } }, data }),
  remove: (problemId, id) => prisma.$transaction([
    prisma.submission.updateMany({ where: { problemId, solutionId: id }, data: { solutionId: null } }),
    prisma.solution.delete({ where: { problemId_id: { problemId, id } } }),
  ]),
};

export const testCases = {
  create: (problemId, caseNumber, data) =>
    prisma.testCase.create({ data: { problemId, caseNumber, ...data }, omit: { expected: true } }),
  get: (problemId, caseNumber, db = prisma) =>
    db.testCase.findUnique({ where: { problemId_caseNumber: { problemId, caseNumber } } }),
  update: (problemId, caseNumber, data) =>
    prisma.testCase.update({
      where: { problemId_caseNumber: { problemId, caseNumber } },
      data,
      omit: { expected: true },
    }),
  remove: (problemId, caseNumber) =>
    prisma.testCase.delete({ where: { problemId_caseNumber: { problemId, caseNumber } } }),
};

export const submissions = {
  create: (data) => withExecutionDb((db) => db.submission.create({ data })),
  list: (problemId) => prisma.submission.findMany({
    where: { problemId },
    orderBy: { id: 'desc' },
    take: 100,
    omit: { request: true, result: true },
  }),
  get: (problemId, id) => prisma.submission.findUnique({ where: { id, problemId } }),
};
