import { useEffect, useState } from "react";
import { api } from "./api";

const PAGE_SIZE = 5;

export default function ProblemsPage() {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [minD, setMinD] = useState("");
  const [maxD, setMaxD] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [order, setOrder] = useState("desc");
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState({ key: "", data: null, error: "" });
  const [templates, setTemplates] = useState([]);
  const [picked, setPicked] = useState("");
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(q);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const key = JSON.stringify([search, minD, maxD, sortBy, order, page, refresh]);

  useEffect(() => {
    let cancelled = false;
    const params = { page, pageSize: PAGE_SIZE, sortBy, order };
    if (search) params.q = search;
    if (minD) params.minDifficulty = minD;
    if (maxD) params.maxDifficulty = maxD;
    api
      .problems(params)
      .then((data) => {
        if (!cancelled) setResult({ key, data, error: "" });
      })
      .catch((e) => {
        if (!cancelled) setResult({ key, data: null, error: e.message });
      });
    return () => {
      cancelled = true;
    };
  }, [key, search, minD, maxD, sortBy, order, page]);

  useEffect(() => {
    let cancelled = false;
    api
      .templates()
      .then((d) => {
        if (!cancelled) setTemplates(d.templates);
      })
      .catch(() => {
        if (!cancelled) setTemplates([]);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const loading = result.key !== key;
  const { data, error } = result;

  const changeFilter = (setter) => (e) => {
    setter(e.target.value);
    setPage(1);
  };

  async function exportOne(slug) {
    setMessage("");
    setActionError("");
    try {
      await api.exportTemplate(slug);
      setMessage(`Exported "${slug}" to a template file.`);
      setRefresh((n) => n + 1);
    } catch (e) {
      setActionError(e.message);
    }
  }

  async function importPicked() {
    if (!picked) return;
    setMessage("");
    setActionError("");
    try {
      const created = await api.importTemplate(picked);
      setMessage(`Imported "${created.title}" as a new problem.`);
      setPicked("");
      setRefresh((n) => n + 1);
    } catch (e) {
      setActionError(e.message);
    }
  }

  return (
    <section className="cat-problems">
      <div className="cat-filters">
        <label>
          Search
          <input
            placeholder="Title contains..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <label>
          Min difficulty
          <input type="number" min="800" max="3500" value={minD} onChange={changeFilter(setMinD)} />
        </label>
        <label>
          Max difficulty
          <input type="number" min="800" max="3500" value={maxD} onChange={changeFilter(setMaxD)} />
        </label>
        <label>
          Sort by
          <select value={sortBy} onChange={changeFilter(setSortBy)}>
            <option value="createdAt">Newest</option>
            <option value="title">Title</option>
            <option value="difficulty">Difficulty</option>
          </select>
        </label>
        <label>
          Order
          <select value={order} onChange={changeFilter(setOrder)}>
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </label>
      </div>

      <div className="cat-filters">
        <label>
          Saved templates
          <select value={picked} onChange={(e) => setPicked(e.target.value)}>
            <option value="">Choose a template</option>
            {templates.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <button disabled={!picked} onClick={importPicked}>
          Import template
        </button>
      </div>

      {message && <p className="cat-ok">{message}</p>}
      {(error || actionError) && (
        <p className="cat-error" role="alert">
          {actionError || error}
        </p>
      )}

      <table className="cat-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Difficulty</th>
            <th>Author</th>
            <th>Created</th>
            <th>Template</th>
          </tr>
        </thead>
        <tbody>
          {data?.items.map((p) => (
            <tr key={p.id}>
              <td>{p.title}</td>
              <td>{p.difficulty}</td>
              <td>{p.createdBy?.profile?.handle ?? "-"}</td>
              <td>{new Date(p.createdAt).toLocaleDateString()}</td>
              <td>
                <button onClick={() => exportOne(p.slug)}>Export</button>
              </td>
            </tr>
          ))}
          {data && data.items.length === 0 && (
            <tr>
              <td colSpan="5" className="cat-muted">
                No problems match these filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {data && (
        <div className="cat-pager">
          <button disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <span className="cat-muted">
            Page {data.page} of {Math.max(data.totalPages, 1)} · {data.total} problems
          </span>
          <button
            disabled={page >= data.totalPages || loading}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}