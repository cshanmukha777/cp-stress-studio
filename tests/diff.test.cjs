const { test } = require("node:test");
const assert = require("node:assert/strict");
const { normalizeOutput, compareOutputs, findFirstMismatch } = require("../electron/execution/diff");

test("identical token output passes despite whitespace and newlines", () => {
  assert.equal(normalizeOutput(" 10   20\r\n30 \n"), "10 20 30");
  assert.equal(compareOutputs("10 20\n30", " 10\t20  30 ").verdict, "PASSED");
});

test("reports the first different token with one-based numbering", () => {
  assert.deepEqual(findFirstMismatch("10 20 30", "10 25 30"), {
    tokenIndex: 2, expected: "20", actual: "25", kind: "different",
  });
});

test("detects missing and extra tokens", () => {
  assert.equal(compareOutputs("1 2", "1").firstMismatch.kind, "missing");
  assert.equal(compareOutputs("1", "1 2").firstMismatch.kind, "extra");
});

test("empty output equals empty output and differs from a token", () => {
  assert.equal(compareOutputs("", " \n\t").equal, true);
  assert.equal(compareOutputs("", "0").firstMismatch.tokenIndex, 1);
});

test("execution failures and timeouts are failed comparisons", () => {
  assert.match(compareOutputs({ status: "RE", stdout: "" }, { status: "AC", stdout: "" }).reason, /Reference RE/);
  assert.match(compareOutputs({ status: "AC", stdout: "x" }, { status: "TLE", stdout: "x" }).reason, /Optimal TLE/);
  assert.equal(compareOutputs({ status: "AC", stdout: "same" }, { status: "AC", stdout: "same" }).verdict, "PASSED");
});
