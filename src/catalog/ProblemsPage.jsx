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
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(q);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = { page, pageSize: PAGE_SIZE, sortBy, order };
    if (search) params.q = search;
    if (minD) params.minDifficulty = minD;
    if (maxD) params.maxDifficulty = maxD;
    api
      .problems(params)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError("");
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [search, minD, maxD, sortBy, order, page]);

  const changeFilter = (setter) => (e) => {
    setter(e.target.value);
    setPage(1);
  };

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

      {error && (
        <p className="cat-error" role="alert">
          {error}
        </p>
      )}

      <table className="cat-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Difficulty</th>
            <th>Author</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {data?.items.map((p) => (
            <tr key={p.id}>
              <td>{p.title}</td>
              <td>{p.difficulty}</td>
              <td>{p.createdBy?.profile?.handle ?? "-"}</td>
              <td>{new Date(p.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}
          {data && data.items.length === 0 && (
            <tr>
              <td colSpan="4" className="cat-muted">
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