const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createDatabase } = require("../electron/database/db");
test("CRUD for all collections and restart persistence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cp-db-"));
  const file = path.join(dir, "studio.sqlite");
  let db = createDatabase(file);
  let stressRunId;
  try {
    for (const collection of [
      "workspaces",
      "tests",
      "history",
      "counterexamples",
    ]) {
      const row = db.save(collection, {
        name: "example",
        data:
          collection === "counterexamples"
            ? { input: "1\n", stressRunId }
            : { input: "1\n" },
      });
      if (collection === "history") stressRunId = row.id;
      assert.equal(db.list(collection).length, 1);
      db.save(collection, { ...row, name: "updated" });
      assert.equal(db.get(collection, row.id).name, "updated");
    }
    db.close();
    db = createDatabase(file);
    assert.equal(db.list("tests")[0].data.input, "1\n");
    const row = db.list("tests")[0];
    assert.equal(db.remove("tests", row.id), true);
    assert.equal(db.get("tests", row.id), null);
    assert.throws(() => db.list("bad"));
    assert.throws(() => db.save("tests", { name: "", data: {} }));
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("persists stress runs and their exact failing inputs atomically", () => {
  const db = createDatabase(":memory:");
  try {
    const run = db.persistStressRun(
      { problemId: 7, iterations: 2, randomSeed: 44, workspaceId: "work" },
      {
        status: "WA", verdict: "FAILED", total: 2, passed: 1, failed: 1,
        randomSeed: 44, executionTime: 12.5, averageRuntime: 6.25, maxRuntime: 8,
        failures: [{
          status: "WA", iteration: 2, input: "exact\r\ninput", expected: "yes\n",
          actual: "no\n", failureReason: "Token 1 mismatch",
        }],
      },
    );
    assert.equal(run.data.problemId, 7);
    assert.equal(run.data.passedIterations, 1);
    const savedFailure = db.list("counterexamples")[0].data;
    assert.equal(savedFailure.stressRunId, run.id);
    assert.equal(savedFailure.generatedInput, "exact\r\ninput");
    assert.equal(savedFailure.expectedOutput, "yes\n");
    assert.throws(() => db.save("counterexamples", {
      name: "orphan", data: { generatedInput: "no parent" },
    }), /must belong to an existing stress run/);
    assert.equal(db.remove("history", run.id), true);
    assert.equal(db.list("counterexamples").length, 0);
  } finally {
    db.close();
  }
});

test("rolls back a stress run if a failing case cannot be saved", () => {
  const db = createDatabase(":memory:");
  try {
    assert.throws(() => db.persistStressRun({ iterations: 1 }, {
      status: "WA", total: 1, passed: 0, failed: 1,
      failures: [{ status: "WA", iteration: 1, input: "x".repeat(9 * 1024 * 1024) }],
    }), /8 MiB/);
    assert.equal(db.list("history").length, 0);
    assert.equal(db.list("counterexamples").length, 0);
  } finally {
    db.close();
  }
});
