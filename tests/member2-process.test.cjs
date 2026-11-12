const { test } = require("node:test");
const assert = require("node:assert/strict");
const { supervise } = require("../electron/execution/process");

test(
  "Member 2 sampled RSS limit produces MLE and metrics",
  {
    skip: !["linux", "darwin"].includes(process.platform),
  },
  async () => {
    const metrics = [];
    const result = await supervise(
      process.execPath,
      ["-e", "setInterval(() => {}, 100)"],
      {
        timeout: 4000,
        memoryLimitKiB: 8192,
        onMetrics: (sample) => metrics.push(sample),
      },
    );
    assert.equal(result.status, "MLE");
    assert.match(result.stderr, /memory limit/);
    assert.ok(metrics.some((sample) => sample.memory > 8192));
  },
);

test(
  "Member 2 reports signal exits as a runtime error",
  {
    skip: process.platform === "win32",
  },
  async () => {
    const result = await supervise(
      process.execPath,
      ["-e", "process.kill(process.pid, 'SIGSEGV')"],
      {
        timeout: 3000,
        memoryLimitKiB: 512 * 1024,
      },
    );
    assert.equal(result.status, "RE");
    assert.match(result.stderr, /Segmentation fault \(SIGSEGV\)/);
  },
);

test("Member 2 wall timeout stops a busy loop", async () => {
  const result = await supervise(process.execPath, ["-e", "while (true) {}"], {
    timeout: 200,
    memoryLimitKiB: 512 * 1024,
  });
  assert.equal(result.status, "TLE");
});
