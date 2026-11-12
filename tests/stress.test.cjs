const { test } = require("node:test");
const assert = require("node:assert/strict");
const { stressTest, normalize } = require("../electron/execution/stress");
const py = (code) => ({ language: "python", code });
const base = {
  generator: py('import os\nprint(os.environ["CP_STRESS_SEED"])'),
  brute: py("print(int(input())*2)"),
  optimal: py("print(int(input())*2)"),
  iterations: 3,
  timeLimit: 1000,
  randomSeed: 1,
};
test("normalizes whitespace but preserves token differences", () => {
  assert.equal(normalize(" 1\r\n 2 "), "1 2");
  assert.notEqual(normalize("1 2"), normalize("12"));
});
test("streams each successful iteration", async () => {
  const progress = [];
  const r = await stressTest(base, { onProgress: (p) => progress.push(p) });
  assert.equal(r.status, "AC");
  assert.equal(r.completed, 3);
  assert.equal(
    progress.filter((p) => p.phase === "running" && p.completed === p.currentIteration).length,
    3,
  );
});
test("captures exact first counterexample", async () => {
  const r = await stressTest({ ...base, optimal: py("print(0)") });
  assert.equal(r.status, "WA");
  assert.equal(r.input, "1\n");
  assert.equal(r.expected, "2\n");
  assert.equal(r.actual, "0\n");
  assert.equal(r.iteration, 1);
});
test("identifies generator runtime error", async () => {
  const r = await stressTest({
    ...base,
    generator: py('raise Exception("bad")'),
  });
  assert.equal(r.status, "RE");
  assert.equal(r.role, "generator");
  assert.equal(r.referenceStatus, "SKIPPED");
  assert.equal(r.optimalStatus, "SKIPPED");
});
test("halts on target timeout", async () => {
  assert.equal(
    (
      await stressTest({
        ...base,
        optimal: py("while True: pass"),
        timeLimit: 100,
      })
    ).status,
    "TLE",
  );
});
test("supports cancellation", async () => {
  const c = new AbortController();
  c.abort();
  assert.equal(
    (await stressTest(base, { signal: c.signal })).status,
    "CANCELLED",
  );
});
test("brute failure identifies reference role", async () => {
  const r = await stressTest({
    ...base,
    brute: py('raise Exception("reference")'),
  });
  assert.equal(r.status, "RE");
  assert.equal(r.role, "brute");
  assert.equal(r.input, "1\n");
  assert.equal(r.optimalStatus, "SKIPPED");
});
test("compilation failure stops before iterations", async () => {
  const r = await stressTest({
    ...base,
    optimal: { language: "cpp", code: "broken" },
  });
  assert.equal(r.status, "CE");
  assert.equal(r.completed, 0);
});
test("cancellation from a progress callback stops the next iteration", async () => {
  const c = new AbortController();
  const r = await stressTest(base, {
    signal: c.signal,
    onProgress: (p) => {
      if (p.completed === 1) c.abort();
    },
  });
  assert.equal(r.status, "CANCELLED");
  assert.equal(r.completed, 1);
});

test("uses explicit reproducible random seeds and counts continued failures", async () => {
  const r = await stressTest({
    ...base,
    iterations: 3,
    randomSeed: 9,
    stopOnFailure: false,
    generator: py('import os\nprint(os.environ["CP_STRESS_SEED"])'),
    brute: py("print(int(input()))"),
    optimal: py("n=int(input())\nprint(n+1 if n == 9 else n)"),
  });
  assert.equal(r.randomSeed, 9);
  assert.equal(r.failed, 1);
  assert.equal(r.passed, 2);
  assert.equal(r.failures[0].input, "9\n");
  assert.equal(r.failures[0].comparison.firstMismatch.tokenIndex, 1);
});
