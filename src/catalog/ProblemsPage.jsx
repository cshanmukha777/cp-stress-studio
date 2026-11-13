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
  const [tagProblem, setTagProblem] = useState(null);
  const [availableTags, setAvailableTags] = useState([]);
  const [assignedTags, setAssignedTags] = useState([]);
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [tagSearch, setTagSearch] = useState("");
  const [tagLoading, setTagLoading] = useState(false);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [tagSaving, setTagSaving] = useState(false);
  const [tagError, setTagError] = useState("");
  const [tagMessage, setTagMessage] = useState("");

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

  const tagProblemId = tagProblem?.id;

  useEffect(() => {
    if (!tagProblemId) return undefined;
    let cancelled = false;
    api.problemTags(tagProblemId)
      .then((assignedData) => {
        if (cancelled) return;
        setAssignedTags(assignedData.items);
        setSelectedTagIds(assignedData.items.map((tag) => tag.id));
      })
      .catch((e) => {
        if (!cancelled) setTagError(e.message);
      })
      .finally(() => {
        if (!cancelled) setAssignmentLoading(false);
      });
    return () => { cancelled = true; };
  }, [tagProblemId]);

  useEffect(() => {
    if (!tagProblemId) return undefined;
    let cancelled = false;
    api.tags(tagSearch.trim() ? { q: tagSearch.trim() } : {})
      .then((data) => {
        if (cancelled) return;
        setAvailableTags(data.items);
      })
      .catch((e) => { if (!cancelled) setTagError(e.message); })
      .finally(() => { if (!cancelled) setTagLoading(false); });
    return () => { cancelled = true; };
  }, [tagProblemId, tagSearch]);

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

  function manageTags(problem) {
    if (tagProblemId === problem.id) {
      setTagProblem(null);
      return;
    }
    setTagLoading(true);
    setAssignmentLoading(true);
    setTagProblem(problem);
    setTagMessage("");
    setTagError("");
    setTagSearch("");
    setAssignedTags(problem.problemTags?.map((relation) => relation.tag) || []);
    setSelectedTagIds(problem.problemTags?.map((relation) => relation.tag.id) || []);
  }

  async function saveProblemTags() {
    if (!tagProblem) return;
    setTagSaving(true);
    setTagError("");
    setTagMessage("");
    try {
      const result = await api.replaceProblemTags(tagProblem.id, selectedTagIds);
      setAssignedTags(result.items);
      setSelectedTagIds(result.items.map((tag) => tag.id));
      setTagMessage("Problem tags saved.");
      setRefresh((n) => n + 1);
    } catch (e) {
      setTagError(e.message);
    } finally {
      setTagSaving(false);
    }
  }

  async function removeProblemTag(tag) {
    setTagError("");
    setTagMessage("");
    try {
      await api.removeProblemTag(tagProblem.id, tag.id);
      setAssignedTags((current) => current.filter((item) => item.id !== tag.id));
      setSelectedTagIds((current) => current.filter((id) => id !== tag.id));
      setTagMessage(`Removed ${tag.name}.`);
      setRefresh((n) => n + 1);
    } catch (e) {
      setTagError(e.message);
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
            <th>Tags</th>
            <th>Template</th>
            <th>Manage</th>
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
                <div className="cat-problem-tags">
                  {p.problemTags?.length
                    ? p.problemTags.map(({ tag }) => <span className="cat-tag-pill" key={tag.id}>{tag.name}</span>)
                    : <span className="cat-muted">No tags</span>}
                </div>
              </td>
              <td>
                <button onClick={() => exportOne(p.slug)}>Export</button>
              </td>
              <td>
                <button onClick={() => manageTags(p)}>Manage tags</button>
              </td>
            </tr>
          ))}
          {data && data.items.length === 0 && (
            <tr>
              <td colSpan="7" className="cat-muted">
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

      {tagProblem && (
        <section className="cat-problem-tag-editor" aria-label={`Tags for ${tagProblem.title}`}>
          <header className="cat-problem-tag-header">
            <div>
              <h2>Tags · {tagProblem.title}</h2>
              <p className="cat-muted">Select tags to apply to this problem. The same tag can be used by other problems.</p>
            </div>
            <button onClick={() => setTagProblem(null)}>Close</button>
          </header>
          {tagError && <p className="cat-error" role="alert">{tagError}</p>}
          {tagMessage && <p className="cat-ok" role="status">{tagMessage}</p>}
          <h3>Currently assigned</h3>
          <div className="cat-problem-tags">
            {assignedTags.length ? assignedTags.map((tag) => (
              <span className="cat-tag-pill" key={tag.id}>
                {tag.name}
                <button aria-label={`Remove ${tag.name}`} onClick={() => removeProblemTag(tag)}>×</button>
              </span>
            )) : <span className="cat-muted">No tags assigned yet.</span>}
          </div>
          <label className="cat-tag-search">
            Search available tags
            <input value={tagSearch} onChange={(e) => { setTagLoading(true); setTagError(""); setTagSearch(e.target.value); }} placeholder="Type a tag name…" />
          </label>
          {assignmentLoading ? <p className="cat-muted" role="status">Loading assigned tags…</p> : null}
          {tagLoading ? <p className="cat-muted" role="status">Loading tags…</p> : availableTags.length === 0 ? (
            <p className="cat-muted">No matching tags. Create one in the Tags section.</p>
          ) : (
            <div className="cat-tag-choices">
              {availableTags.map((tag) => (
                <label className="cat-tag-choice" key={tag.id}>
                  <input
                    type="checkbox"
                    disabled={assignmentLoading || tagSaving}
                    checked={selectedTagIds.includes(tag.id)}
                    onChange={(event) => setSelectedTagIds((ids) => event.target.checked
                      ? [...new Set([...ids, tag.id])]
                      : ids.filter((id) => id !== tag.id))}
                  />
                  <span><strong>{tag.name}</strong><small>{tag.description || 'No description'}</small></span>
                </label>
              ))}
            </div>
          )}
          <button className="cat-tag-save" disabled={tagSaving || tagLoading || assignmentLoading} onClick={saveProblemTags}>
            {tagSaving ? 'Saving tags…' : 'Save tag selection'}
          </button>
        </section>
      )}
    </section>
  );
}
