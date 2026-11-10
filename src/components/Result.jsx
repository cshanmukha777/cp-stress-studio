export default function Result({ result, logs = '', busy }) {
 return <section className="result-pane"><header className="pane-header"><span>Execution console</span><div className="metrics">
 {result && <><span className={`verdict ${result.status}`}>{result.status}</span><span>{result.time?.toFixed(2) ?? '—'} ms</span><span>{result.memory == null ? 'RSS unavailable' : `${(result.memory/1024).toFixed(1)} MiB RSS`}</span></>}
 {busy && <span>Running…</span>}</div></header>
 <pre aria-label="Execution output" aria-live="polite">{logs || result?.stdout || 'Output appears here after execution'}</pre>
 {result?.stderr && <pre className="error" aria-label="Error logs">{result.stderr}</pre>}
 {result?.persistenceError && <p role="alert" className="error">Run finished, but saving failed: {result.persistenceError}</p>}
 </section>
}
