import Editor, { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor/editor/editor.api'
import 'monaco-editor/languages/definitions/cpp/register'
import 'monaco-editor/languages/definitions/python/register'
import 'monaco-editor/languages/definitions/java/register'
import EditorWorker from 'monaco-editor/editor/editor.worker?worker'
self.MonacoEnvironment = { getWorker: () => new EditorWorker() }
loader.config({ monaco })
export default function CodeEditor({ title, value, onChange, disabled = false }) {
  return <section className="editor-pane">
    <header className="pane-header"><span>{title}</span><select aria-label={`${title} language`} disabled={disabled} value={value.language} onChange={e => onChange({...value, language:e.target.value})}>
      <option value="cpp">C++17</option><option value="python">Python 3</option><option value="java">Java</option>
    </select></header>
    <Editor theme="vs-dark" language={value.language} value={value.code} onChange={code=>onChange({...value,code:code ?? ''})} loading={<p className="empty">Loading editor…</p>} options={{readOnly:disabled, fontFamily:'"JetBrains Mono", "Fira Code", monospace',fontSize:13,minimap:{enabled:false},scrollBeyondLastLine:false,automaticLayout:true,tabSize:4,padding:{top:12},ariaLabel:`${title} source code`}} />
  </section>
}
