import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

const emptyForm = { name: '', description: '', parentId: '' };

export default function TagsPage() {
  const [query, setQuery] = useState('');
  const [tags, setTags] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [focused, setFocused] = useState(null);
  const [associatedProblems, setAssociatedProblems] = useState([]);
  const [problemsLoading, setProblemsLoading] = useState(false);

  const loadTags = useCallback(async (searchText = query) => {
    setLoading(true);
    setError('');
    try {
      const [data, allData] = await Promise.all([
        api.tags(searchText.trim() ? { q: searchText.trim() } : {}),
        api.tags(),
      ]);
      setTags(data.items);
      setAllTags(allData.items);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const timeout = setTimeout(() => loadTags(query), 200);
    return () => clearTimeout(timeout);
  }, [loadTags, query]);

  function editTag(tag) {
    setEditingId(tag.id);
    setForm({
      name: tag.name,
      description: tag.description || '',
      parentId: tag.parentId ? String(tag.parentId) : '',
    });
    setMessage('');
    setError('');
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function submit(event) {
    event.preventDefault();
    setMessage('');
    setError('');
    const name = form.name.trim();
    if (!name) {
      setError('Tag name cannot be empty.');
      return;
    }
    const body = {
      name,
      description: form.description.trim() || null,
      parentId: form.parentId ? Number(form.parentId) : null,
    };
    setSaving(true);
    try {
      if (editingId) await api.updateTag(editingId, body);
      else await api.createTag(body);
      setMessage(editingId ? 'Tag updated.' : 'Tag created.');
      resetForm();
      await loadTags();
      if (focused?.id === editingId) await showTag(editingId);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeTag(tag) {
    if (!window.confirm(`Delete “${tag.name}”? Its problem assignments will also be removed.`)) return;
    setMessage('');
    setError('');
    try {
      await api.deleteTag(tag.id);
      setMessage(`Deleted “${tag.name}”.`);
      if (editingId === tag.id) resetForm();
      if (focused?.id === tag.id) {
        setFocused(null);
        setAssociatedProblems([]);
      }
      await loadTags();
    } catch (e) {
      setError(e.message);
    }
  }

  async function showTag(id) {
    setError('');
    setProblemsLoading(true);
    try {
      const [tag, problemData] = await Promise.all([api.tag(id), api.tagProblems(id)]);
      setFocused(tag);
      setAssociatedProblems(problemData.items);
    } catch (e) {
      setError(e.message);
    } finally {
      setProblemsLoading(false);
    }
  }

  return (
    <section className="cat-tags">
      <div className="cat-tag-layout">
        <div className="cat-tag-list-panel">
          <div className="cat-filters">
            <label>
              Search tags
              <input aria-label="Search tags" placeholder="Name contains…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <span className="cat-muted">{tags.length} tags</span>
          </div>
          {error && <p className="cat-error" role="alert">{error}</p>}
          {message && <p className="cat-ok" role="status">{message}</p>}
          {loading ? (
            <p className="cat-muted" role="status">Loading tags…</p>
          ) : tags.length === 0 ? (
            <p className="cat-muted">No tags found. Create the first one using the form.</p>
          ) : (
            <div className="cat-tag-list">
              {tags.map((tag) => (
                <article className="cat-tag-card" key={tag.id}>
                  <div>
                    <strong>{tag.name}</strong>
                    <p>{tag.description || 'No description'}</p>
                    <small className="cat-muted">
                      {tag.parent?.name ? `Child of ${tag.parent.name}` : 'Top-level'} · {tag._count?.problemTags ?? 0} problems · {tag._count?.children ?? 0} child tags
                    </small>
                  </div>
                  <div className="cat-tag-actions">
                    <button onClick={() => showTag(tag.id)}>Details</button>
                    <button onClick={() => editTag(tag)}>Edit</button>
                    <button onClick={() => removeTag(tag)}>Delete</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <form className="cat-card cat-tag-form" onSubmit={submit}>
          <h2>{editingId ? 'Edit tag' : 'Create tag'}</h2>
          <label>
            Name
            <input maxLength={50} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label>
            Description <span className="cat-muted">(optional)</span>
            <textarea maxLength={500} rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </label>
          <label>
            Parent tag <span className="cat-muted">(optional)</span>
            <select value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })}>
              <option value="">No parent</option>
              {allTags.filter((tag) => tag.id !== editingId).map((tag) => (
                <option key={tag.id} value={tag.id}>{tag.name}</option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Save changes' : 'Create tag'}</button>
          {editingId && <button type="button" onClick={resetForm}>Cancel edit</button>}
        </form>
      </div>

      {focused && (
        <section className="cat-tag-detail">
          <header>
            <div>
              <h2>{focused.name}</h2>
              <p>{focused.description || 'No description'}</p>
              <small className="cat-muted">Parent: {focused.parent?.name || 'none'} · Created {new Date(focused.createdAt).toLocaleString()}</small>
            </div>
            <button onClick={() => { setFocused(null); setAssociatedProblems([]); }}>Close details</button>
          </header>
          <h3>Associated problems</h3>
          {problemsLoading ? <p className="cat-muted">Loading associated problems…</p> : associatedProblems.length === 0 ? (
            <p className="cat-muted">This tag is not assigned to any problems.</p>
          ) : (
            <ul>{associatedProblems.map((problem) => <li key={problem.id}>{problem.title} <span className="cat-muted">· {problem.difficulty}</span></li>)}</ul>
          )}
        </section>
      )}
    </section>
  );
}
