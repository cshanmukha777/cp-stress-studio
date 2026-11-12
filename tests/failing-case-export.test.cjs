const { test } = require("node:test");
const assert = require("node:assert/strict");
const { formatFailingCase } = require("../electron/execution/failingCaseExport");

test("formats a text export while preserving the generated input verbatim", () => {
  const { contents, filename } = formatFailingCase({
    problemId: 4,
    iterationNumber: 2,
    generatedInput: "first\r\nsecond\n",
    expectedOutput: "yes\n",
    actualOutput: "no\n",
    verdict: "WA",
    failureReason: "Token mismatch",
  });
  assert.equal(filename, "failing-case-2.txt");
  assert.ok(contents.includes("=== Generated input ===\nfirst\r\nsecond\n\n"));
  assert.ok(contents.includes("=== Expected output ===\nyes\n"));
});

test("rejects oversized failing-case export data", () => {
  assert.throws(() => formatFailingCase({ generatedInput: "x".repeat(1024 * 1024 + 1) }), /generatedInput/);
});
