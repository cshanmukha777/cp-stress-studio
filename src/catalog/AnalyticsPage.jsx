import { useEffect, useMemo, useState } from "react";
import { api } from "./api";

const ranges = [["7d", "7 days"], ["30d", "30 days"], ["90d", "90 days"], ["all", "All time"]];
const pct = (value) => `${(value * 100).toFixed(1)}%`;
const number = (value) => new Intl.NumberFormat().format(value || 0);
const runtime = (value) => value == null ? "—" : `${value.toFixed(2)} ms`;

function BarChart({ title, items, valueKey, labelKey, format = number }) {
  const max = Math.max(1, ...items.map((item) => item[valueKey] || 0));
  return <section className="analytics-chart"><h2>{title}</h2>{items.length ? <div className="analytics-bars" role="img" aria-label={title}>
    {items.map((item) => <div className="analytics-bar-row" key={item[labelKey]} title={`${item[labelKey]}: ${format(item[valueKey] || 0)}`}>
      <span>{item[labelKey]}</span><div><i style={{ width: `${Math.max(2, (item[valueKey] || 0) / max * 100)}%` }} /></div><b>{format(item[valueKey] || 0)}</b>
    </div>)}
  </div> : <p className="cat-muted">No data for this period.</p>}</section>;
}

function LineChart({ title, items, valueKey, format = number }) {
  const values = items.map((item) => item[valueKey] || 0);
  const max = Math.max(1, ...values);
  const points = values.map((value, index) => `${items.length < 2 ? 400 : 24 + index * 752 / (items.length - 1)},${176 - value / max * 150}`).join(" ");
  return <section className="analytics-chart"><h2>{title}</h2>{items.length ? <><svg className="analytics-line" viewBox="0 0 800 200" role="img" aria-label={title}><polyline points={points} fill="none" stroke="#58a6ff" strokeWidth="3" />{values.map((value, index) => <circle key={items[index].date} cx={items.length < 2 ? 400 : 24 + index * 752 / (items.length - 1)} cy={176 - value / max * 150} r="4" fill="#58a6ff"><title>{items[index].date}: {format(value)}</title></circle>)}</svg><div className="analytics-line-labels"><span>{items[0].date}</span><span>{items.at(-1).date}</span></div></> : <p className="cat-muted">No data for this period.</p>}</section>;
}

function VerdictChart({ verdicts = {} }) {
  const items = [["Passed", verdicts.passed || 0, "#3fb950"], ["Failed", verdicts.failed || 0, "#f85149"], ["Errors", verdicts.errors || 0, "#d29922"], ["Other", verdicts.other || 0, "#8b949e"]];
  const total = items.reduce((sum, item) => sum + item[1], 0);
  let position = 0;
  const stops = items.map(([, value, color]) => { const start = position; position += total ? value / total * 100 : 0; return `${color} ${start}% ${position}%`; }).join(", ");
  return <section className="analytics-chart"><h2>Run verdicts</h2><div className="analytics-donut-layout"><div className="analytics-donut" style={{ background: total ? `conic-gradient(${stops})` : "#252a31" }} role="img" aria-label={`Verdict distribution, ${number(total)} runs`}><span>{number(total)}<small>runs</small></span></div><ul>{items.map(([label, value, color]) => <li key={label}><i style={{ background: color }} />{label}<b>{number(value)}</b></li>)}</ul></div></section>;
}

export default function AnalyticsPage() {
  const [range, setRange] = useState("30d");
  const [refreshKey, setRefreshKey] = useState(0);
  const [data, setData] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [problemQuery, setProblemQuery] = useState("");
  const [problemSort, setProblemSort] = useState("runs");
  const [selectedTag, setSelectedTag] = useState(null);
  const [caseDetail, setCaseDetail] = useState(null);
  const [caseError, setCaseError] = useState("");
  useEffect(() => {
    let active = true;
    async function load() {
      setError("");
      try {
        if (!window.electronAPI?.stressAnalytics) throw new Error("Stress analytics are available in the desktop app.");
        const [summary, metadata] = await Promise.all([window.electronAPI.stressAnalytics(range), api.analyticsCatalog()]);
        if (active) { setData(summary); setCatalog(metadata); }
      } catch (err) { if (active) setError(err.message || "Could not load analytics."); }
      finally { if (active) setLoading(false); }
    }
    load();
    return () => { active = false; };
  }, [range, refreshKey]);

  const problemNames = useMemo(() => new Map((catalog?.problems || []).map((problem) => [String(problem.id), problem.title])), [catalog]);
  const tagStats = useMemo(() => (catalog?.tags || []).map((tag) => {
    const rows = (data?.problemStats || []).filter((problem) => tag.problemIds.includes(problem.problemId));
    const totalIterations = rows.reduce((sum, row) => sum + row.totalIterations, 0);
    const passedIterations = rows.reduce((sum, row) => sum + row.passedIterations, 0);
    return { ...tag, stressRuns: rows.reduce((sum, row) => sum + row.stressRuns, 0), totalIterations,
      passRate: totalIterations ? passedIterations / totalIterations : 0,
      failingCases: tag.problemIds.reduce((sum, id) => sum + (data?.failingCasesByProblem?.[id] || 0), 0) };
  }).sort((a, b) => b.stressRuns - a.stressRuns), [catalog, data]);
  const visibleProblems = useMemo(() => {
    const rows = (data?.problemStats || []).filter((row) => {
      const matchesName = (problemNames.get(row.problemId) || "").toLowerCase().includes(problemQuery.toLowerCase());
      const matchesTag = !selectedTag || catalog?.tags.find((tag) => tag.id === selectedTag)?.problemIds.includes(row.problemId);
      return matchesName && matchesTag;
    });
    return rows.sort((a, b) => problemSort === "failures" ? b.failedIterations - a.failedIterations : problemSort === "passRate" ? a.passRate - b.passRate : b.stressRuns - a.stressRuns);
  }, [data, problemNames, problemQuery, problemSort, selectedTag, catalog]);
  async function openCase(id) {
    try {
      const row = await window.electronAPI.db.get("counterexamples", id);
      setCaseDetail(row); setCaseError("");
    } catch (err) { setCaseError(err.message || "Could not load failing case details."); }
  }
  async function exportCase() {
    const detail = caseDetail?.data || {};
    try {
      await window.electronAPI.exportFailingCase({ ...detail,
        problemId: detail.problemId ?? null, iterationNumber: detail.iterationNumber ?? 0,
        generatedInput: detail.generatedInput ?? "", expectedOutput: detail.expectedOutput ?? "",
        actualOutput: detail.actualOutput ?? "", failureReason: detail.failureReason ?? "",
        verdict: detail.verdict ?? "FAILED" });
    } catch (err) { setCaseError(err.message || "Could not export failing case."); }
  }

  if (loading && !data) return <div className="analytics-page"><p className="cat-muted">Loading analytics…</p></div>;
  if (error && !data) return <div className="analytics-page"><h2>Analytics dashboard</h2><p className="cat-error">{error}</p><button onClick={() => { setLoading(true); setRefreshKey((key) => key + 1); }}>Retry</button></div>;
  const overview = data?.overview || {};
  const recent = data?.recentFailingCases || [];
  return <div className="analytics-page">
    <header className="analytics-toolbar"><div><h2>Analytics dashboard</h2><p className="cat-muted">Stress run history, counterexamples, and your problem tags.</p></div>
      <label>Period <select value={range} onChange={(event) => { setLoading(true); setRange(event.target.value); }}>{ranges.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <button onClick={() => { setLoading(true); setRefreshKey((key) => key + 1); }} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button>
    </header>
    {error && <p className="cat-error">{error}</p>}
    <section className="analytics-cards">
      {[["Stress runs", number(overview.totalStressRuns)], ["Test cases", number(overview.totalIterations)], ["Passed cases", number(overview.passedIterations)], ["Failed cases", number(overview.failedIterations)], ["Overall pass rate", pct(overview.passRate || 0)], ["Failing cases", number(overview.totalFailingCases)], ["Problems tested", number(overview.totalProblemsTested)], ["Avg. execution time", runtime(overview.averageExecutionTime)]].map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}
    </section>
    <div className="analytics-grid">
      <LineChart title="Stress runs over time" items={data?.runsOverTime || []} valueKey="count" />
      <LineChart title="Average iteration runtime by day" items={data?.executionTimeTrends || []} valueKey="averageRuntime" format={runtime} />
      <VerdictChart verdicts={data?.verdicts} />
      <BarChart title="Test case results" items={[{ label: "Passed", value: overview.passedIterations || 0 }, { label: "Failed", value: overview.failedIterations || 0 }]} valueKey="value" labelKey="label" />
      <BarChart title="Common failure reasons" items={data?.failureReasons || []} valueKey="count" labelKey="reason" />
    </div>
    <section className="analytics-table-section"><h2>Problem performance</h2><div className="analytics-filters"><input aria-label="Search problems" placeholder="Search problems" value={problemQuery} onChange={(event) => setProblemQuery(event.target.value)} /><select aria-label="Sort problems" value={problemSort} onChange={(event) => setProblemSort(event.target.value)}><option value="runs">Most tested</option><option value="failures">Most failed</option><option value="passRate">Lowest pass rate</option></select>{selectedTag && <button onClick={() => setSelectedTag(null)}>Clear tag filter</button>}</div><div className="analytics-scroll"><table className="cat-table"><thead><tr><th>Problem</th><th>Stress runs</th><th>Iterations</th><th>Passed</th><th>Failed</th><th>Pass rate</th><th>Avg. iteration runtime</th><th>Counterexamples</th></tr></thead><tbody>
      {visibleProblems.map((row) => <tr key={row.problemId}><td>{problemNames.get(row.problemId) || `Problem ${row.problemId}`}</td><td>{number(row.stressRuns)}</td><td>{number(row.totalIterations)}</td><td>{number(row.passedIterations)}</td><td>{number(row.failedIterations)}</td><td>{pct(row.passRate)}</td><td>{runtime(row.averageRuntime)}</td><td>{number(data?.failingCasesByProblem?.[row.problemId])}</td></tr>)}
      {!visibleProblems.length && <tr><td colSpan="8" className="cat-muted">No matching problems for this period.</td></tr>}
    </tbody></table></div></section>
    <section className="analytics-table-section"><h2>Tag performance</h2><div className="analytics-scroll"><table className="cat-table"><thead><tr><th>Tag</th><th>Linked problems</th><th>Stress runs</th><th>Iterations</th><th>Pass rate</th><th>Counterexamples</th></tr></thead><tbody>
      {tagStats.map((tag) => <tr key={tag.id} className={selectedTag === tag.id ? "analytics-selected" : ""}><td><button className="analytics-tag-button" onClick={() => setSelectedTag(selectedTag === tag.id ? null : tag.id)}>{tag.name}</button></td><td>{tag.problemIds.length}</td><td>{number(tag.stressRuns)}</td><td>{number(tag.totalIterations)}</td><td>{pct(tag.passRate)}</td><td>{number(tag.failingCases)}</td></tr>)}
      {!tagStats.length && <tr><td colSpan="6" className="cat-muted">No tags found.</td></tr>}
    </tbody></table></div></section>
    <section className="analytics-table-section"><h2>Recent failing cases</h2><div className="analytics-scroll"><table className="cat-table"><thead><tr><th>Time</th><th>Problem</th><th>Iteration</th><th>Verdict</th><th>Reason</th><th>Details</th></tr></thead><tbody>
      {recent.map((item) => <tr key={item.id}><td>{new Date(item.createdAt).toLocaleString()}</td><td>{item.problemId ? problemNames.get(item.problemId) || `Problem ${item.problemId}` : "Unlinked problem"}</td><td>{item.iterationNumber ?? "—"}</td><td>{item.verdict || "—"}</td><td>{item.failureReason || "—"}</td><td><button onClick={() => openCase(item.id)}>View details</button></td></tr>)}
      {!recent.length && <tr><td colSpan="6" className="cat-muted">No failing cases in this period.</td></tr>}
    </tbody></table></div></section>
    {caseError && <p className="cat-error">{caseError}</p>}
    {caseDetail && <div className="analytics-case-modal" role="dialog" aria-modal="true" aria-label="Failing case details"><section><header><h2>Failing case details</h2><button onClick={() => setCaseDetail(null)}>Close</button></header><p>{caseDetail.data.failureReason || "No failure reason stored."}</p><h3>Generated input</h3><pre>{caseDetail.data.generatedInput || ""}</pre><h3>Expected output</h3><pre>{caseDetail.data.expectedOutput || ""}</pre><h3>Actual output</h3><pre>{caseDetail.data.actualOutput || ""}</pre><button onClick={exportCase}>Export .txt</button></section></div>}
  </div>;
}
