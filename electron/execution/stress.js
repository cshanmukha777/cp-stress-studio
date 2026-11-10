const { prepare, validateScript, validateLimit } = require("./runner");
const normalize = (text) =>
  text.replace(/\r\n/g, "\n").trim().split(/\s+/).join(" ");
async function stressTest(request, { signal, onProgress } = {}) {
  const {
    generator,
    brute,
    optimal,
    iterations = 100,
    timeLimit = 2000,
  } = request;
  [generator, brute, optimal].forEach(validateScript);
  validateLimit(timeLimit);
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > 10000)
    throw new Error("Iterations must be 1–10000");
  const programs = [];
  let completed = 0;
  try {
    for (const [role, script] of [
      ["generator", generator],
      ["brute", brute],
      ["optimal", optimal],
    ]) {
      onProgress?.({ phase: "compiling", role, completed, total: iterations });
      const program = await prepare(script, { signal });
      programs.push(program);
      if (program.error)
        return { ...program.error, role, completed, total: iterations };
    }
    for (let iteration = 1; iteration <= iterations; iteration++) {
      if (signal?.aborted)
        return { status: "CANCELLED", completed, total: iterations };
      const options = { signal, timeLimit, seed: iteration };
      const generated = await programs[0].run("", options);
      if (generated.status !== "AC")
        return {
          ...generated,
          role: "generator",
          iteration,
          completed,
          total: iterations,
          input: generated.stdout,
        };
      const input = generated.stdout;
      const expected = await programs[1].run(input, options);
      if (expected.status !== "AC")
        return {
          ...expected,
          role: "brute",
          iteration,
          completed,
          total: iterations,
          input,
          expected: expected.stdout,
          actual: "",
        };
      const actual = await programs[2].run(input, options);
      if (
        actual.status !== "AC" ||
        normalize(expected.stdout) !== normalize(actual.stdout)
      ) {
        return {
          ...actual,
          status: actual.status === "AC" ? "WA" : actual.status,
          role: "optimal",
          iteration,
          completed,
          total: iterations,
          input,
          expected: expected.stdout,
          actual: actual.stdout,
        };
      }
      completed = iteration;
      onProgress?.({
        phase: "running",
        completed,
        total: iterations,
        time: actual.time,
        memory: actual.memory,
      });
    }
    return { status: "AC", completed, total: iterations };
  } finally {
    await Promise.all(programs.map((p) => p.dispose()));
  }
}
module.exports = { stressTest, normalize };
