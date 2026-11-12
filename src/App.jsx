import { useEffect, useState } from "react";
import CodeEditor from "./components/CodeEditor";
import Result from "./components/Result";
import StressWorkbench from "./components/StressWorkbench";
import RecordsDrawer from "./components/RecordsDrawer";
import ProblemRecords from "./components/ProblemRecords";
import CatalogPanel from "./catalog/CatalogPanel";
import { useExecution } from "./hooks/useExecution";
import "./App.css";
const initial = {
  language: "cpp",
  code: '#include <iostream>\nusing namespace std;\n\nint main() {\n    long long a, b;\n    cin >> a >> b;\n    cout << a + b << "\\n";\n}\n',
};
export default function App() {
  const [single, setSingle] = useState(initial),
    [stdin, setStdin] = useState("2 3\n"),
    [expected, setExpected] = useState("5\n"),
    [checkExpected, setCheckExpected] = useState(false),
    [timeLimit, setTimeLimit] = useState(2000);
  const [mode, setMode] = useState("single"),
    [iterations, setIterations] = useState(100),
    [randomSeed, setRandomSeed] = useState(""),
    [stopOnFailure, setStopOnFailure] = useState(true);
  const [scripts, setScripts] = useState({
    generator: {
      language: "python",
      code: 'import os, random\nrandom.seed(int(os.environ.get("CP_STRESS_SEED", "1")))\nprint(random.randint(-100, 100), random.randint(-100, 100))\n',
    },
    brute: {
      language: "python",
      code: "a, b = map(int, input().split())\nprint(a + b)\n",
    },
    optimal: initial,
  });
  const [drawer, setDrawer] = useState(false),
    [workspaceId, setWorkspaceId] = useState(null);
  const [problemId, setProblemId] = useState("");
  const [solutionId, setSolutionId] = useState(undefined);
  const [caseNumber, setCaseNumber] = useState(undefined);
  const [problemRecords, setProblemRecords] = useState(false);
  const execution = useExecution();
  const [showCatalog, setShowCatalog] = useState(false);
  const snapshot = () => ({
    single,
    stdin,
    expected,
    checkExpected,
    timeLimit,
    mode,
    iterations,
    randomSeed,
    stopOnFailure,
    scripts,
  });
  async function saveRecord(collection, name, id) {
    const data =
      collection === "workspaces"
        ? snapshot()
        : { stdin, expected, checkExpected };
    const row = await window.electronAPI.db.save(collection, {
      name,
      id,
      workspace_id: workspaceId,
      data,
    });
    if (collection === "workspaces") setWorkspaceId(row.id);
  }
  function loadRecord(collection, row) {
    setSolutionId(undefined);
    setCaseNumber(undefined);
    if (collection === "tests") {
      setStdin(row.data.stdin);
      setExpected(row.data.expected || "");
      setCheckExpected(Boolean(row.data.checkExpected));
      setMode("single");
      execution.setResult(null);
    } else if (collection === "counterexamples") {
      const request = row.data.request || {};
      setStdin(row.data.generatedInput ?? row.data.failure?.input ?? "");
      setExpected(row.data.expectedOutput ?? row.data.failure?.expected ?? "");
      setCheckExpected(true);
      setTimeLimit(request.timeLimit ?? timeLimit);
      if (request.optimal) setSingle(request.optimal);
      setMode("single");
      execution.setResult(null);
    } else if (collection === "workspaces") {
      const d = row.data;
      setSingle(d.single);
      setStdin(d.stdin);
      setExpected(d.expected);
      setCheckExpected(d.checkExpected);
      setTimeLimit(d.timeLimit);
      setMode(d.mode);
      setIterations(d.iterations);
      setRandomSeed(d.randomSeed ?? "");
      setStopOnFailure(d.stopOnFailure ?? true);
      setScripts(d.scripts);
      setWorkspaceId(row.id);
      execution.setResult(null);
    } else {
      const { request: r, result, mode: m } = row.data;
      setMode(m);
      setTimeLimit(r.timeLimit);
      setWorkspaceId(row.workspace_id);
      if (m === "single") {
        setSingle({ language: r.language, code: r.code });
        setStdin(r.stdin || "");
        setExpected(r.expected || "");
        setCheckExpected(Boolean(r.checkExpected));
      } else {
        setScripts({
          generator: r.generator,
          brute: r.brute,
          optimal: r.optimal,
        });
        setIterations(r.iterations);
        setRandomSeed(r.randomSeed ?? "");
        setStopOnFailure(r.stopOnFailure ?? true);
      }
      execution.setResult(result);
    }
    setDrawer(false);
  }
  async function saveFailure() {
    try {
      await window.electronAPI.db.save("tests", {
        name: `Counterexample ${execution.result.iteration}`,
        workspace_id: workspaceId,
        data: {
          stdin: execution.result.input,
          expected: execution.result.expected || "",
          checkExpected: true,
        },
      });
      setDrawer(true);
    } catch (e) {
      window.alert(e.message);
    }
  }
  const run = () =>
    execution.run(
      mode,
      mode === "single"
        ? {
            ...single,
            stdin,
            expected,
            checkExpected,
            timeLimit,
            problemId,
            solutionId,
            caseNumber,
          }
        : {
            ...scripts,
            iterations,
            randomSeed: randomSeed === "" ? undefined : Number(randomSeed),
            stopOnFailure,
            timeLimit,
            workspaceId,
            problemId: problemId ? Number(problemId) : null,
          },
    );
  useEffect(() => {
    const key = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        run();
      }
      if (e.key === "Escape") execution.cancel();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  return (
    <main className="studio">
      <header className="app-header">
        <h1>CP Stress Studio</h1>
        <span className="muted">Local execution workbench</span>
        <div className="spacer" />
        <button onClick={() => setShowCatalog(true)}>
          Account &amp; Problems
        </button>
        <button
          disabled={execution.busy || !problemId}
          onClick={() => setProblemRecords(true)}
        >
          Problem records
        </button>
        <button
          disabled={!window.electronAPI}
          onClick={() => setDrawer(!drawer)}
        >
          Saved records
        </button>
      </header>
      <div className="toolbar">
        {["single", "stress"].map((tab) => (
          <button
            key={tab}
            className={`tab ${mode === tab ? "active" : ""}`}
            disabled={execution.busy}
            onClick={() => {
              setMode(tab);
              execution.setResult(null);
            }}
          >
            {tab === "single" ? "Single run" : "Stress test"}
          </button>
        ))}
        <div className="spacer" />
        <label>
            Problem ID
            <input
              type="number"
              min="1"
              value={problemId}
              disabled={execution.busy}
              onChange={(event) => {
                setProblemId(event.target.value);
                setSolutionId(undefined);
                setCaseNumber(undefined);
                setProblemRecords(false);
              }}
            />
        </label>
        {mode === "stress" && (
          <>
            <label>
              Iterations{" "}
              <input type="number" min="1" max="10000" value={iterations}
                onChange={(e) => setIterations(Number(e.target.value))} />
            </label>
            <label>
              Random seed{" "}
              <input type="number" min="0" max="4294967295" placeholder="random"
                value={randomSeed} onChange={(e) => setRandomSeed(e.target.value)} />
            </label>
            <label className="inline-option">
              <input type="checkbox" checked={stopOnFailure}
                onChange={(e) => setStopOnFailure(e.target.checked)} />
              Stop on first failure
            </label>
          </>
        )}
        <label>
          Time limit{" "}
          <input
            aria-label="Time limit in milliseconds"
            type="number"
            min="50"
            max="30000"
            value={timeLimit}
            onChange={(e) => setTimeLimit(Number(e.target.value))}
          />{" "}
          ms
        </label>
        <button className="primary" disabled={execution.busy} onClick={run}>
          {mode === "single" ? "Run" : "Start stress"} <kbd>⌘/Ctrl ↵</kbd>
        </button>
        <button disabled={!execution.busy} onClick={execution.cancel}>
          Stop
        </button>
      </div>
      {!window.electronAPI && (
        <p className="notice">
          Browser preview — execution and saved records are available in the
          desktop app
        </p>
      )}
      {mode !== "single" && execution.error && (
        <p className="error notice" role="alert">
          {execution.error}
        </p>
      )}
      {mode === "single" ? (
        <div className="single-workbench">
          <CodeEditor
            title="Solution"
            value={single}
            onChange={(value) => {
              setSingle(value);
              setSolutionId(undefined);
            }}
          />
          <div className="input-column">
            {caseNumber !== undefined && (
              <p>
                Using saved test case #{caseNumber}. Edit input to switch to a
                custom case.
              </p>
            )}
            <label className="text-pane">
              <span className="pane-header">Standard input</span>
              <textarea
                spellCheck="false"
                value={stdin}
                onChange={(e) => {
                  setStdin(e.target.value);
                  setCaseNumber(undefined);
                }}
              />
            </label>
            <label className="text-pane">
              <span className="pane-header">
                <span>Expected output</span>
                <span>
                  <input
                    type="checkbox"
                    checked={checkExpected}
                    onChange={(e) => {
                      setCheckExpected(e.target.checked);
                      setCaseNumber(undefined);
                    }}
                  />{" "}
                  Compare
                </span>
              </span>
              <textarea
                spellCheck="false"
                value={expected}
                onChange={(e) => {
                  setExpected(e.target.value);
                  setCaseNumber(undefined);
                }}
              />
            </label>
          </div>
        </div>
      ) : (
        <StressWorkbench
          scripts={scripts}
          onChange={setScripts}
          stopOnFailure={stopOnFailure}
          {...execution}
        />
      )}
      {execution.result?.input !== undefined && (
        <div className="failure-actions">
          <button onClick={saveFailure}>
            Save counterexample as test case
          </button>
          <button
            disabled={execution.busy}
            onClick={() => {
              setSolutionId(undefined);
              setCaseNumber(undefined);
              setSingle(scripts.optimal);
              setStdin(execution.result.input);
              setExpected(execution.result.expected || "");
              setCheckExpected(true);
              setMode("single");
              execution.setResult(null);
            }}
          >
            Open in single run
          </button>
        </div>
      )}
      <Result
        {...execution}
        error={mode === "single" ? execution.error : undefined}
      />
      <footer>
        AC without comparison means successful execution · Java entry class:
        Main · Escape stops execution
      </footer>
      {drawer && (
        <RecordsDrawer
          onClose={() => setDrawer(false)}
          onLoad={loadRecord}
          onSave={saveRecord}
          workspaceId={workspaceId}
          onRemoveWorkspace={() => setWorkspaceId(null)}
          busy={execution.busy}
        />
      )}
      {problemRecords && (
        <ProblemRecords
          problemId={problemId}
          current={{ single, stdin, expected }}
          onClose={() => setProblemRecords(false)}
          onSolution={(row) => {
            setSingle({ language: row.language, code: row.code });
            setSolutionId(row.id);
            setMode("single");
            execution.setResult(null);
            setProblemRecords(false);
          }}
          onTest={(row) => {
            setStdin(row.input);
            setExpected("");
            setCheckExpected(false);
            setCaseNumber(row.caseNumber);
            setMode("single");
            execution.setResult(null);
            setProblemRecords(false);
          }}
          onSubmission={(row) => {
            setMode("single");
            setSingle({
              language: row.request.language,
              code: row.request.code,
            });
            setStdin(row.request.stdin);
            setTimeLimit(row.request.timeLimit);
            setSolutionId(undefined);
            setCaseNumber(undefined);
            setExpected("");
            setCheckExpected(false);
            execution.setResult(row.result);
            setProblemRecords(false);
          }}
        />
      )}
      {showCatalog && <CatalogPanel onClose={() => setShowCatalog(false)} />}
    </main>
  );
}
