const { randomInt } = require("node:crypto");
const { prepare, validateScript, validateLimit } = require("./runner");
const { compareOutputs, normalizeOutput } = require("./diff");

// Kept as an alias for the single-run expected-output comparison API.
const normalize = normalizeOutput;

function validateSeed(seed) {
  if (seed === undefined || seed === null || seed === "") return randomInt(0, 2 ** 32);
  const numericSeed = Number(seed);
  if (!Number.isSafeInteger(numericSeed) || numericSeed < 0 || numericSeed > 0xffffffff)
    throw new Error("Random seed must be an integer from 0 to 4294967295");
  return numericSeed;
}

async function stressTest(request, { signal, onProgress } = {}) {
  const {
    generator,
    brute,
    optimal,
    iterations = 100,
    timeLimit = 2000,
    stopOnFailure = true,
    problemId = null,
  } = request;
  [generator, brute, optimal].forEach(validateScript);
  validateLimit(timeLimit);
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > 10000)
    throw new Error("Iterations must be 1–10000");
  if (typeof stopOnFailure !== "boolean") throw new Error("stopOnFailure must be a boolean");
  if (problemId !== null && problemId !== undefined && (!Number.isSafeInteger(Number(problemId)) || Number(problemId) < 1))
    throw new Error("Problem ID must be a positive integer");
  const randomSeed = validateSeed(request.randomSeed);
  const programs = [];
  const failures = [];
  let passed = 0;
  let executionTime = 0;
  let maxRuntime = 0;
  let failureStatus = null;
  let firstFailure = null;
  const startedAt = process.hrtime.bigint();
  const totalRuntime = () => Number(process.hrtime.bigint() - startedAt) / 1e6;
  const progress = (phase, currentIteration, extra = {}) => {
    onProgress?.({
      phase,
      currentIteration,
      completed: passed,
      total: iterations,
      passed,
      failed: failures.length,
      ...extra,
    });
  };

  try {
    for (const [role, script] of [["generator", generator], ["brute", brute], ["optimal", optimal]]) {
      progress("compiling", 0, { role });
      const program = await prepare(script, { signal });
      programs.push(program);
      if (program.error) {
        const result = {
          ...program.error,
          status: program.error.status === "CANCELLED" ? "CANCELLED" : program.error.status,
          role,
          iteration: 0,
          completed: 0,
          total: iterations,
          passed,
          failed: 0,
          failures: [],
          randomSeed,
          problemId,
          executionTime: totalRuntime(),
          averageRuntime: null,
          maxRuntime: null,
        };
        return result;
      }
    }

    for (let iteration = 1; iteration <= iterations; iteration++) {
      if (signal?.aborted) {
        return {
          status: "CANCELLED", completed: passed, total: iterations, passed,
          failed: failures.length, failures, randomSeed, problemId,
          executionTime: totalRuntime(), averageRuntime: passed ? executionTime / passed : null,
          maxRuntime: maxRuntime || null,
        };
      }
      progress("running", iteration);
      const iterationSeed = (randomSeed + iteration - 1) % 2 ** 32;
      const options = { signal, timeLimit, seed: iterationSeed };
      const generated = await programs[0].run("", options);
      if (generated.status === "CANCELLED") {
        return {
          ...(firstFailure || {}), status: "CANCELLED", completed: passed, total: iterations,
          passed, failed: failures.length, failures, randomSeed, problemId,
          executionTime: totalRuntime(), averageRuntime: passed + failures.length ? executionTime / (passed + failures.length) : null,
          maxRuntime: maxRuntime || null,
        };
      }
      const input = generated.stdout;
      let reference = { status: "SKIPPED", stdout: "", stderr: "", time: 0 };
      let target = { status: "SKIPPED", stdout: "", stderr: "", time: 0 };
      let role = null;
      let comparison;
      if (generated.status !== "AC") {
        role = "generator";
        comparison = { verdict: "FAILED", equal: false, firstMismatch: null, expectedTokens: [], actualTokens: [], reason: `Generator ${generated.status}` };
      } else {
        reference = await programs[1].run(input, options);
        if (reference.status === "CANCELLED") {
          return {
            ...(firstFailure || {}), status: "CANCELLED", completed: passed, total: iterations,
            passed, failed: failures.length, failures, randomSeed, problemId,
            executionTime: totalRuntime(), averageRuntime: passed + failures.length ? executionTime / (passed + failures.length) : null,
            maxRuntime: maxRuntime || null,
          };
        }
        if (reference.status !== "AC") {
          role = "brute";
          comparison = {
            verdict: "FAILED",
            equal: false,
            firstMismatch: null,
            expectedTokens: [],
            actualTokens: [],
            reason: `Reference ${reference.status}`,
          };
        } else {
          target = await programs[2].run(input, options);
          if (target.status === "CANCELLED") {
            return {
              ...(firstFailure || {}), status: "CANCELLED", completed: passed, total: iterations,
              passed, failed: failures.length, failures, randomSeed, problemId,
              executionTime: totalRuntime(), averageRuntime: passed + failures.length ? executionTime / (passed + failures.length) : null,
              maxRuntime: maxRuntime || null,
            };
          }
          comparison = compareOutputs(reference, target);
          if (!comparison.equal) role = "optimal";
        }
      }
      const runtime = (generated.time || 0) + (reference.time || 0) + (target.time || 0);
      executionTime += runtime;
      maxRuntime = Math.max(maxRuntime, runtime);
      const failure = role
        ? {
            status:
              role === "optimal" && target.status === "AC"
                ? "WA"
                : role === "generator"
                  ? generated.status
                  : role === "brute"
                    ? reference.status
                    : target.status,
            verdict: "FAILED",
            role,
            iteration,
            input,
            expected: role === "generator" ? "" : reference.stdout,
            actual: role === "generator" ? generated.stdout : role === "brute" ? "" : target.stdout,
            expectedStderr: role === "brute" ? reference.stderr : "",
            actualStderr: role === "optimal" ? target.stderr : role === "generator" ? generated.stderr : "",
            expectedStatus: reference.status,
            actualStatus: target.status,
            generatedStatus: generated.status,
            referenceStatus: reference.status,
            optimalStatus: target.status,
            generatorExitCode: generated.exitCode ?? null,
            referenceExitCode: reference.exitCode ?? null,
            optimalExitCode: target.exitCode ?? null,
            generatorExitSignal: generated.exitSignal ?? null,
            referenceExitSignal: reference.exitSignal ?? null,
            optimalExitSignal: target.exitSignal ?? null,
            generatorStderr: generated.stderr,
            referenceStderr: reference.stderr,
            optimalStderr: target.stderr,
            comparison,
            failureReason: comparison.reason || `${role} ${role === "brute" ? reference.status : role === "generator" ? generated.status : target.status}`,
            runtime,
            generatorTime: generated.time,
            referenceTime: reference.time,
            optimalTime: target.time,
          }
        : null;
      if (failure) {
        failures.push(failure);
        failureStatus ||= failure.status;
        firstFailure ||= failure;
        progress("running", iteration, { lastFailure: failure });
        if (stopOnFailure) break;
      } else {
        passed++;
        progress("running", iteration, { runtime, memory: target.memory });
      }
    }

    const result = {
      ...(firstFailure || {}),
      status: failureStatus || "AC",
      verdict: failures.length ? "FAILED" : "PASSED",
      completed: passed,
      total: iterations,
      passed,
      failed: failures.length,
      failures,
      randomSeed,
      problemId,
      executionTime: totalRuntime(),
      averageRuntime: passed + failures.length ? executionTime / (passed + failures.length) : null,
      maxRuntime: maxRuntime || null,
    };
    return result;
  } finally {
    await Promise.all(programs.map((program) => program.dispose()));
  }
}

module.exports = { stressTest, normalize, normalizeOutput, validateSeed };
