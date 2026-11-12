function tokenizeOutput(output) {
  if (typeof output !== "string") throw new TypeError("Output must be text");
  const trimmed = output.trim();
  return trimmed ? trimmed.split(/\s+/u) : [];
}

function normalizeOutput(output) {
  return tokenizeOutput(output).join(" ");
}

function findFirstMismatch(expected, actual) {
  const expectedTokens = Array.isArray(expected) ? expected : tokenizeOutput(expected);
  const actualTokens = Array.isArray(actual) ? actual : tokenizeOutput(actual);
  const length = Math.max(expectedTokens.length, actualTokens.length);
  for (let index = 0; index < length; index++) {
    const expectedToken = expectedTokens[index];
    const actualToken = actualTokens[index];
    if (expectedToken !== actualToken) {
      return {
        tokenIndex: index + 1,
        expected: expectedToken,
        actual: actualToken,
        kind:
          expectedToken === undefined
            ? "extra"
            : actualToken === undefined
              ? "missing"
              : "different",
      };
    }
  }
  return null;
}

function compareOutputs(expected, actual) {
  const expectedResult = typeof expected === "string" ? { stdout: expected, status: "AC" } : expected;
  const actualResult = typeof actual === "string" ? { stdout: actual, status: "AC" } : actual;
  const expectedTokens = tokenizeOutput(expectedResult?.stdout ?? "");
  const actualTokens = tokenizeOutput(actualResult?.stdout ?? "");
  const failedExecution = expectedResult?.status !== "AC" || actualResult?.status !== "AC";
  const firstMismatch = failedExecution ? null : findFirstMismatch(expectedTokens, actualTokens);
  const reasons = [];
  if (expectedResult?.status !== "AC") reasons.push(`Reference ${expectedResult?.status || "invalid"}`);
  if (actualResult?.status !== "AC") reasons.push(`Optimal ${actualResult?.status || "invalid"}`);
  if (firstMismatch) reasons.push(`First mismatch at token ${firstMismatch.tokenIndex}`);
  return {
    verdict: !failedExecution && !firstMismatch ? "PASSED" : "FAILED",
    equal: !failedExecution && !firstMismatch,
    firstMismatch,
    expectedTokens,
    actualTokens,
    reason: reasons.join("; ") || null,
  };
}

module.exports = { tokenizeOutput, normalizeOutput, findFirstMismatch, compareOutputs };
