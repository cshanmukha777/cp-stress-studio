const { DatabaseSync } = require("node:sqlite");
const { randomUUID } = require("node:crypto");
const COLLECTIONS = new Set([
  "workspaces",
  "tests",
  "history",
  "counterexamples",
]);
function createDatabase(filename) {
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS records (
      id TEXT PRIMARY KEY, collection TEXT NOT NULL, workspace_id TEXT,
      name TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS records_collection ON records(collection, updated_at);
    CREATE INDEX IF NOT EXISTS records_workspace ON records(workspace_id);`);
  const collectionCheck = (value) => {
    if (!COLLECTIONS.has(value)) throw new Error("Unknown collection");
  };
  const decode = (row) => (row ? { ...row, data: JSON.parse(row.data) } : null);
  function get(collection, id) {
    collectionCheck(collection);
    return decode(
      db
        .prepare("SELECT * FROM records WHERE collection=? AND id=?")
        .get(collection, id),
    );
  }
  function save(collection, record) {
    collectionCheck(collection);
    if (collection === "counterexamples") {
      const stressRunId = record?.data?.stressRunId;
      const legacyRecord = record?.id ? get("counterexamples", record.id) : null;
      if (
        typeof stressRunId !== "string" && !legacyRecord ||
        typeof stressRunId === "string" && !get("history", stressRunId)
      )
        throw new Error("A failing case must belong to an existing stress run");
    }
    if (collection === "counterexamples") {
      const stressRunId = record?.data?.stressRunId;
      if (typeof stressRunId !== "string" || !get("history", stressRunId))
        throw new Error("A failing case must belong to an existing stress run");
    }
    if (
      !record ||
      typeof record.name !== "string" ||
      !record.name.trim() ||
      record.name.length > 200
    )
      throw new Error("Name must contain 1–200 characters");
    const data = JSON.stringify(record.data);
    if (!data || Buffer.byteLength(data) > 8 * 1024 * 1024)
      throw new Error("Record must contain JSON data up to 8 MiB");
    const id = record.id || randomUUID();
    if (typeof id !== "string" || id.length > 100)
      throw new Error("Invalid record ID");
    if (record.id && !get(collection, id))
      throw new Error("Record no longer exists");
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO records VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
      workspace_id=excluded.workspace_id,name=excluded.name,data=excluded.data,updated_at=excluded.updated_at`,
    ).run(
      id,
      collection,
      record.workspace_id || null,
      record.name.trim(),
      data,
      now,
      now,
    );
    return get(collection, id);
  }
  function getAnalytics(range = "30d") {
    const days = { "7d": 7, "30d": 30, "90d": 90 }[range];
    if (range !== "all" && !days) throw new Error("Invalid analytics range");
    const since = days ? new Date(Date.now() - days * 86400000).toISOString() : null;
    const stressRows = db.prepare(`SELECT id, created_at,
      json_extract(data,'$.problemId') AS problem_id,
      CAST(json_extract(data,'$.totalIterations') AS INTEGER) AS total_iterations,
      CAST(json_extract(data,'$.passedIterations') AS INTEGER) AS passed_iterations,
      CAST(json_extract(data,'$.failedIterations') AS INTEGER) AS failed_iterations,
      json_extract(data,'$.verdict') AS verdict,
      CAST(json_extract(data,'$.executionTime') AS REAL) AS execution_time,
      CAST(json_extract(data,'$.averageRuntime') AS REAL) AS average_runtime
      FROM records WHERE collection='history' AND json_extract(data,'$.mode')='stress'
      ${since ? "AND created_at >= ?" : ""} ORDER BY created_at`).all(...(since ? [since] : []));
    const caseRows = db.prepare(`SELECT id, created_at,
      json_extract(data,'$.stressRunId') AS stress_run_id,
      json_extract(data,'$.problemId') AS problem_id,
      CAST(json_extract(data,'$.iterationNumber') AS INTEGER) AS iteration_number,
      json_extract(data,'$.failureReason') AS failure_reason,
      json_extract(data,'$.verdict') AS verdict
      FROM records WHERE collection='counterexamples' ${since ? "AND created_at >= ?" : ""}
      ORDER BY created_at DESC`).all(...(since ? [since] : []));
    const stressIds = new Set(stressRows.map(({ id }) => id));
    const filteredCases = stressIds.size
      ? caseRows.filter((item) => stressIds.has(item.stress_run_id))
      : [];
    const sum = (key) => stressRows.reduce((n, row) => n + (Number(row[key]) || 0), 0);
    const byProblem = new Map();
    for (const row of stressRows) {
      if (row.problem_id == null) continue;
      const id = String(row.problem_id);
      const item = byProblem.get(id) || { problemId: id, stressRuns: 0, totalIterations: 0, passedIterations: 0, failedIterations: 0, runtimeTotal: 0, runtimeCount: 0 };
      item.stressRuns++;
      item.totalIterations += Number(row.total_iterations) || 0;
      item.passedIterations += Number(row.passed_iterations) || 0;
      item.failedIterations += Number(row.failed_iterations) || 0;
      if (row.average_runtime != null && Number.isFinite(Number(row.average_runtime))) { item.runtimeTotal += Number(row.average_runtime); item.runtimeCount++; }
      byProblem.set(id, item);
    }
    const problemStats = [...byProblem.values()].map((item) => ({
      ...item,
      passRate: item.totalIterations ? item.passedIterations / item.totalIterations : 0,
      averageRuntime: item.runtimeCount ? item.runtimeTotal / item.runtimeCount : null,
    })).sort((a, b) => b.stressRuns - a.stressRuns);
    const runsByDay = new Map();
    const runtimesByDay = new Map();
    const verdicts = { passed: 0, failed: 0, errors: 0, other: 0 };
    for (const row of stressRows) {
      const day = row.created_at.slice(0, 10);
      runsByDay.set(day, (runsByDay.get(day) || 0) + 1);
      const runtime = row.average_runtime == null ? NaN : Number(row.average_runtime);
      if (Number.isFinite(runtime)) {
        const bucket = runtimesByDay.get(day) || { total: 0, count: 0 };
        bucket.total += runtime; bucket.count++; runtimesByDay.set(day, bucket);
      }
      const status = String(row.verdict || "").toUpperCase();
      if (status === "AC") verdicts.passed++;
      else if (status === "WA") verdicts.failed++;
      else if (["RE", "TLE", "CE", "MLE", "OLE"].includes(status)) verdicts.errors++;
      else verdicts.other++;
    }
    const reasons = new Map();
    for (const item of filteredCases) {
      const reason = String(item.failure_reason || "").trim();
      if (reason) reasons.set(reason, (reasons.get(reason) || 0) + 1);
    }
    const execTimes = stressRows.filter((row) => row.execution_time != null).map((row) => Number(row.execution_time)).filter(Number.isFinite);
    return {
      range,
      overview: {
        totalStressRuns: stressRows.length,
        totalIterations: sum("total_iterations"),
        passedIterations: sum("passed_iterations"),
        failedIterations: sum("failed_iterations"),
        passRate: sum("total_iterations") ? sum("passed_iterations") / sum("total_iterations") : 0,
        totalFailingCases: filteredCases.length,
        totalProblemsTested: byProblem.size,
        averageExecutionTime: execTimes.length ? execTimes.reduce((a, b) => a + b, 0) / execTimes.length : null,
      },
      verdicts,
      runsOverTime: [...runsByDay].map(([date, count]) => ({ date, count })),
      executionTimeTrends: [...runtimesByDay].map(([date, value]) => ({ date, averageRuntime: value.total / value.count })),
      problemStats,
      failingCasesByProblem: Object.fromEntries(filteredCases.reduce((map, item) => {
        if (item.problem_id != null) { const id = String(item.problem_id); map.set(id, (map.get(id) || 0) + 1); }
        return map;
      }, new Map())),
      failureReasons: [...reasons].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count).slice(0, 10),
      recentFailingCases: filteredCases.slice(0, 20).map((item) => ({
        id: item.id, stressRunId: item.stress_run_id, problemId: item.problem_id == null ? null : String(item.problem_id),
        iterationNumber: item.iteration_number, failureReason: item.failure_reason, verdict: item.verdict, createdAt: item.created_at,
      })),
    };
  }
  return {
    get,
    getAnalytics,
    save,
    persistStressRun(request, result) {
      const failures = Array.isArray(result.failures)
        ? result.failures
        : result.input !== undefined
          ? [result]
          : [];
      const runData = {
        mode: "stress",
        problemId: request.problemId || null,
        totalIterations: result.total ?? request.iterations,
        passedIterations: result.passed ?? result.completed ?? 0,
        failedIterations: result.failed ?? failures.length,
        verdict: result.status,
        comparisonVerdict: result.verdict || result.status,
        status: result.status,
        executionTime: result.executionTime ?? result.time ?? null,
        averageRuntime: result.averageRuntime ?? null,
        maxRuntime: result.maxRuntime ?? null,
        randomSeed: result.randomSeed ?? request.randomSeed ?? null,
        createdAt: new Date().toISOString(),
        request,
        result,
      };
      db.exec("BEGIN IMMEDIATE");
      try {
        const run = save("history", {
          name: `Stress · ${runData.verdict}`,
          workspace_id: request.workspaceId || null,
          data: runData,
        });
        for (const failure of failures) {
          save("counterexamples", {
            name: `${failure.status || "FAILED"} · iteration ${failure.iteration ?? 0}`,
            workspace_id: request.workspaceId || null,
            data: {
              stressRunId: run.id,
              problemId: runData.problemId,
              iterationNumber: failure.iteration ?? 0,
              generatedInput: failure.input ?? "",
              expectedOutput: failure.expected ?? "",
              actualOutput: failure.actual ?? "",
              failureReason: failure.failureReason || failure.comparison?.reason || failure.status,
              verdict: failure.status || "FAILED",
              createdAt: runData.createdAt,
              failure,
              request,
            },
          });
        }
        db.exec("COMMIT");
        return run;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
    list(collection, workspaceId) {
      collectionCheck(collection);
      return (
        workspaceId
          ? db
              .prepare(
                "SELECT * FROM records WHERE collection=? AND workspace_id=? ORDER BY updated_at DESC",
              )
              .all(collection, workspaceId)
          : db
              .prepare(
                "SELECT * FROM records WHERE collection=? ORDER BY updated_at DESC",
              )
              .all(collection)
      ).map(decode);
    },
    remove(collection, id) {
      collectionCheck(collection);
      // Preserve historical records if their workspace is removed.
      db.exec("BEGIN");
      try {
        if (collection === "workspaces")
          db.prepare(
            "UPDATE records SET workspace_id=NULL WHERE workspace_id=?",
          ).run(id);
        if (collection === "history")
          db.prepare(
            "DELETE FROM records WHERE collection='counterexamples' AND json_extract(data, '$.stressRunId')=?",
          ).run(id);
        if (collection === "history")
          db.prepare(
            "DELETE FROM records WHERE collection='counterexamples' AND json_extract(data, '$.stressRunId')=?",
          ).run(id);
        const result = db
          .prepare("DELETE FROM records WHERE collection=? AND id=?")
          .run(collection, id);
        db.exec("COMMIT");
        return result.changes > 0;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
    close: () => db.close(),
  };
}
module.exports = { createDatabase };
