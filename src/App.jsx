import { useEffect, useState } from 'react'
import CodeEditor from './components/CodeEditor'
import Result from './components/Result'
import { useExecution } from './hooks/useExecution'
import './App.css'
const initial = {language:'cpp',code:'#include <iostream>\nusing namespace std;\n\nint main() {\n    long long a, b;\n    cin >> a >> b;\n    cout << a + b << "\\n";\n}\n'}
export default function App() {
 const [single,setSingle]=useState(initial),[stdin,setStdin]=useState('2 3\n'),[expected,setExpected]=useState('5\n'),[checkExpected,setCheckExpected]=useState(false),[timeLimit,setTimeLimit]=useState(2000)
 const execution=useExecution()
 const run=()=>execution.run('single',{...single,stdin,expected,checkExpected,timeLimit})
 useEffect(()=>{const key=e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();run()}if(e.key==='Escape')execution.cancel()};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)})
 return <main className="studio">
 <header className="app-header"><h1>CP Stress Studio</h1><span className="muted">Local execution workbench</span></header>
 <div className="toolbar"><span className="tab active">Single run</span><div className="spacer"/><label>Time limit <input aria-label="Time limit in milliseconds" type="number" min="50" max="30000" value={timeLimit} onChange={e=>setTimeLimit(Number(e.target.value))}/> ms</label><button className="primary" disabled={execution.busy} onClick={run}>Run <kbd>⌘/Ctrl ↵</kbd></button><button disabled={!execution.busy} onClick={execution.cancel}>Stop</button></div>
 {!window.electronAPI && <p className="notice">Browser preview — execution and saved records are available in the desktop app</p>}
 {execution.error && <p className="error notice" role="alert">{execution.error}</p>}
 <div className="single-workbench"><CodeEditor title="Solution" value={single} onChange={setSingle}/><div className="input-column"><label className="text-pane"><span className="pane-header">Standard input</span><textarea spellCheck="false" value={stdin} onChange={e=>setStdin(e.target.value)}/></label><label className="text-pane"><span className="pane-header"><span>Expected output</span><span><input type="checkbox" checked={checkExpected} onChange={e=>setCheckExpected(e.target.checked)}/> Compare</span></span><textarea spellCheck="false" value={expected} onChange={e=>setExpected(e.target.value)}/></label></div></div>
 <Result {...execution}/><footer>AC without comparison means successful execution · Java entry class: Main · Escape stops execution</footer>
 </main>
}
