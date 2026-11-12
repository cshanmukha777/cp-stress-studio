import CodeEditor from "./CodeEditor";

export default function StressWorkbench({ scripts, onChange, progress, result, busy }) {
  const passed = progress?.passed ?? result?.passed ?? progress?.completed ?? result?.completed ?? 0;
  const failed = progress?.failed ?? result?.failed ?? 0;
  const total = progress?.total ?? result?.total ?? 1;
  const expectedTokens = result?.comparison?.expectedTokens || tokens(result?.expected ?? "");
  const actualTokens = result?.comparison?.actualTokens || tokens(result?.actual ?? "");
  const mismatch = result?.comparison?.firstMismatch;

  return (
    <>
      <div className="stress-editors">
        {["generator", "brute", "optimal"].map((role) => (
          <CodeEditor
            key={role}
            title={{
              generator: "Test case generator",
              brute: "Brute-force reference",
              optimal: "Optimal solution",
            }[role]}
            value={scripts[role]}
            onChange={(value) => onChange({ ...scripts, [role]: value })}
          />
        ))}
      </div>
      <div className="progress-strip" role="status">
        <span>{busy ? progress?.phase === "compiling" ? `Preparing ${progress.role}…` : "Comparing outputs…" : "Stress test"}</span>
        <progress max={total || 1} value={passed + failed} />
        <span className="mono">Iteration {progress?.currentIteration ?? result?.iteration ?? (busy ? "—" : total)} / {total}</span>
        <span className="count-passed">{passed} passed</span>
        <span className="count-failed">{failed} failed</span>
        <span className={`verdict ${busy ? "RUNNING" : result?.verdict || result?.status || ""}`}>
          {busy ? "RUNNING" : result?.verdict || result?.status || "READY"}
        </span>
        <span className="muted">Seed: {result?.randomSeed ?? "assigned at start"}</span>
      </div>
      {result?.input !== undefined && (
        <section className="counterexample">
          <header className="pane-header">
            <h2>Counterexample · iteration {result.iteration}</h2>
            <span className={`verdict ${result.status}`}>{result.status} · {result.role}</span>
          </header>
          {result.failureReason && <p className="notice error">{result.failureReason}</p>}
          {mismatch && (
            <p className="mismatch-summary">
              First mismatch: token {mismatch.tokenIndex} · expected {displayToken(mismatch.expected)} · actual {displayToken(mismatch.actual)}
            </p>
          )}
          <div className="diff-grid">
            <div>
              <h3>Failing input</h3>
              <pre>{result.input || "(empty)"}</pre>
            </div>
            <TokenDiff title="Expected · brute" values={expectedTokens} other={actualTokens} />
            <TokenDiff title="Actual · optimal" values={actualTokens} other={expectedTokens} />
          </div>
          {(result.generatorStderr || result.referenceStderr || result.optimalStderr || result.expectedStderr || result.actualStderr) && (
            <details className="execution-diagnostics">
              <summary>Execution diagnostics</summary>
              <div className="diff-grid">
                <Diagnostic title="Generator stderr" text={result.generatorStderr} />
                <Diagnostic title="Reference stderr" text={result.referenceStderr ?? result.expectedStderr} />
                <Diagnostic title="Optimal stderr" text={result.optimalStderr ?? result.actualStderr} />
              </div>
            </details>
          )}
        </section>
      )}
    </>
  );
}

function tokens(text) {
  const value = text.trim();
  return value ? value.split(/\s+/u) : [];
}

function displayToken(value) {
  return value === undefined ? "(missing)" : `“${value}”`;
}

function TokenDiff({ title, values, other }) {
  return (
    <div>
      <h3>{title}</h3>
      <pre className="token-output">
        {values.length ? values.map((value, index) => (
          <span className={value === other[index] ? "diff-token" : "diff-token changed"} key={index}>
            {value}{index < values.length - 1 ? " " : ""}
          </span>
        )) : "(empty output)"}
        {values.length < other.length && <span className="diff-token missing">{` +${other.length - values.length} token${other.length - values.length === 1 ? "" : "s"} on other side`}</span>}
      </pre>
    </div>
  );
}

function Diagnostic({ title, text }) {
  return <div><h3>{title}</h3><pre>{text || "(none)"}</pre></div>;
}
