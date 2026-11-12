import { useState } from "react";
import { executionRequest } from "../catalog/execution";

export default function ProblemRecords({
  problemId,
  current,
  onSolution,
  onTest,
  onSubmission,
  onClose,
}) {
  const [records, setRecords] = useState(null);
  const [history, setHistory] = useState([]);
  const [name, setName] = useState("");
  const [caseNumber, setCaseNumber] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const [detail, submissions] = await Promise.all([
      executionRequest(problemId),
      executionRequest(problemId, "/submissions"),
    ]);
    setRecords(detail);
    setHistory(submissions);
  }

  async function perform(action) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function write(path, method, body) {
    return perform(async () => {
      await executionRequest(problemId, path, { method, body });
      await refresh();
    });
  }

  const solutionData = { name, ...current.single };
  const testData = { name, input: current.stdin, expected: current.expected };

  return (
    <aside className="drawer" aria-label="Problem execution records">
      <header className="pane-header">
        <h2>{records?.title || `Problem ${problemId}`}</h2>
        <button onClick={onClose}>Close</button>
      </header>
      <div className="record-tools">
        <button disabled={busy} onClick={() => perform(refresh)}>
          Refresh records
        </button>
        <label>
          Record name{" "}
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <button
          disabled={busy}
          onClick={() => write("/solutions", "POST", solutionData)}
        >
          Save editor as solution
        </button>
        <label>
          Case number{" "}
          <input
            type="number"
            min="1"
            value={caseNumber}
            onChange={(event) => setCaseNumber(event.target.value)}
          />
        </label>
        <button
          disabled={busy}
          onClick={() =>
            write("/test-cases", "POST", { ...testData, caseNumber })
          }
        >
          Save current test case
        </button>
      </div>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      <div className="record-list">
        <h3>Solutions</h3>
        {records?.solutions.map((row) => (
          <article className="record" key={row.id}>
            <p>
              {row.name} · {row.language}
            </p>
            <div className="record-actions">
              <button disabled={busy} onClick={() => onSolution(row)}>
                Load
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  write(`/solutions/${row.id}`, "PATCH", {
                    ...solutionData,
                    name: name || row.name,
                  })
                }
              >
                Update from editor
              </button>
              <button
                disabled={busy}
                onClick={() => write(`/solutions/${row.id}`, "DELETE")}
              >
                Delete
              </button>
            </div>
          </article>
        ))}
        <h3>Test cases</h3>
        {records?.testCases.map((row) => (
          <article className="record" key={row.caseNumber}>
            <p>
              #{row.caseNumber} · {row.name}
            </p>
            <div className="record-actions">
              <button disabled={busy} onClick={() => onTest(row)}>
                Use saved case
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  write(`/test-cases/${row.caseNumber}`, "PATCH", {
                    ...testData,
                    name: name || row.name,
                  })
                }
              >
                Update from input
              </button>
              <button
                disabled={busy}
                onClick={() => write(`/test-cases/${row.caseNumber}`, "DELETE")}
              >
                Delete
              </button>
            </div>
          </article>
        ))}
        <h3>Submissions</h3>
        {history.map((row) => (
          <article className="record" key={row.id}>
            <button
              disabled={busy}
              onClick={() =>
                perform(async () => {
                  onSubmission(
                    await executionRequest(problemId, `/submissions/${row.id}`),
                  );
                })
              }
            >
              #{row.id} · {row.verdict} · {row.runtimeMs?.toFixed(2) ?? "—"} ms
            </button>
          </article>
        ))}
      </div>
    </aside>
  );
}
