import CodeEditor from './CodeEditor'
export default function StressWorkbench({ scripts, onChange, progress, result, busy }) {
 return <><div className="stress-editors">{['generator','brute','optimal'].map(role=><CodeEditor key={role} title={{generator:'Test case generator',brute:'Brute-force reference',optimal:'Optimal solution'}[role]} value={scripts[role]} onChange={value=>onChange({...scripts,[role]:value})}/>)}</div>
 <div className="progress-strip" role="status"><span>{busy ? progress?.phase === 'compiling' ? `Preparing ${progress.role}…` : 'Comparing outputs…' : 'Stress test'}</span><progress max={progress?.total || result?.total || 1} value={progress?.completed || result?.completed || 0}/><span className="mono">{progress?.completed ?? result?.completed ?? 0} / {progress?.total ?? result?.total ?? '—'} passed</span><span className="muted">Generator seed: CP_STRESS_SEED</span></div>
 {result?.input !== undefined && <section className="counterexample"><header className="pane-header"><h2>Counterexample · iteration {result.iteration}</h2><span className={`verdict ${result.status}`}>{result.status} · {result.role}</span></header><div className="diff-grid"><div><h3>Failing input</h3><pre>{result.input || '(empty)'}</pre></div><Diff title="Expected · brute" text={result.expected ?? ''} other={result.actual ?? ''}/><Diff title="Actual · optimal" text={result.actual ?? ''} other={result.expected ?? ''}/></div></section>}
 </>
}
function Diff({title,text,other}) {
 const comparison=other.replace(/\r\n/g,'\n').split('\n')
 return <div><h3>{title}</h3><pre>{text.split('\n').map((line,index)=><span className={line.trim()!==comparison[index]?.trim()?'diff-line changed':'diff-line'} key={index}><span className="line-number">{index+1}</span>{line || ' '}{'\n'}</span>)}</pre></div>
}
