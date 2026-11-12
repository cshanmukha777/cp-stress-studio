const { randomUUID } = require("node:crypto");

function formatFailingCase(record) {
  if (!record || typeof record !== "object") throw new Error("Invalid failing case");
  const textField = (key, limit = 1024 * 1024) => {
    const value = record[key] ?? "";
    if (typeof value !== "string" || Buffer.byteLength(value) > limit)
      throw new Error(`Invalid ${key}`);
    return value;
  };
  const problemId = record.problemId ?? "not selected";
  if (!(typeof problemId === "string" || Number.isSafeInteger(problemId)))
    throw new Error("Invalid problem ID");
  const iteration = record.iterationNumber ?? 0;
  if (!Number.isSafeInteger(iteration) || iteration < 0)
    throw new Error("Invalid iteration number");
  const contents = [
    `Stress run: ${typeof record.stressRunId === "string" ? record.stressRunId : "unknown"}`,
    `Problem: ${problemId}`,
    `Iteration: ${iteration}`,
    `Verdict: ${typeof record.verdict === "string" ? record.verdict : "FAILED"}`,
    `Reason: ${textField("failureReason", 10000) || "Output mismatch or execution error"}`,
    "",
    "=== Generated input ===",
    textField("generatedInput"),
    "",
    "=== Expected output ===",
    textField("expectedOutput"),
    "",
    "=== Actual output ===",
    textField("actualOutput"),
    "",
  ].join("\n");
  const filename = `failing-case-${iteration || randomUUID()}.txt`;
  return { contents, filename };
}

module.exports = { formatFailingCase };
