import { useEffect, useState } from "react";
export default function RecordsDrawer({
  onClose,
  onLoad,
  onSave,
  workspaceId,
  onRemoveWorkspace,
  busy,
}) {
  const [collection, setCollection] = useState("workspaces"),
    [rows, setRows] = useState([]),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [name, setName] = useState("Untitled problem"),
    [selected, setSelected] = useState(null);
  async function refresh(kind = collection) {
    try {
      setRows(await window.electronAPI.db.list(kind));
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    let alive = true;
    window.electronAPI.db
      .list(collection)
      .then((data) => {
        if (alive) setRows(data);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [collection]);
  async function save(update) {
    try {
      await onSave(
        collection,
        name,
        update
          ? collection === "workspaces"
            ? workspaceId
            : selected?.id
          : undefined,
      );
      await refresh();
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  async function rename(row) {
    try {
      await window.electronAPI.db.save(collection, { ...row, name });
      await refresh();
    } catch (e) {
      setError(e.message);
    }
  }
  async function remove(row) {
    try {
      await window.electronAPI.db.remove(collection, row.id);
      if (collection === "workspaces" && row.id === workspaceId)
        onRemoveWorkspace();
      setSelected(null);
      await refresh();
    } catch (e) {
      setError(e.message);
    }
  }
  async function exportFailure(row) {
    try {
      const failure = row.data.failure || row.data.result || {};
      const request = row.data.request || {};
      const result = await window.electronAPI.exportFailingCase({
        ...row.data,
        problemId: row.data.problemId ?? request.problemId ?? null,
        iterationNumber: row.data.iterationNumber ?? failure.iteration ?? 0,
        generatedInput: row.data.generatedInput ?? failure.input ?? "",
        expectedOutput: row.data.expectedOutput ?? failure.expected ?? "",
        actualOutput: row.data.actualOutput ?? failure.actual ?? "",
        failureReason: row.data.failureReason ?? failure.failureReason ?? failure.comparison?.reason ?? "",
        verdict: row.data.verdict ?? failure.status ?? "FAILED",
      });
      if (result.saved) setNotice(`Exported failing case to ${result.path}`);
      else setNotice("Failing-case export canceled.");
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <aside className="drawer" aria-label="Saved records">
      <header className="pane-header">
        <h2>Saved records</h2>
        <button onClick={onClose}>Close</button>
      </header>
      <div className="drawer-tabs">
        {["workspaces", "tests", "history", "counterexamples"].map((kind) => (
          <button
            key={kind}
            className={kind === collection ? "active" : ""}
            onClick={() => {
              setCollection(kind);
              setSelected(null);
            }}
          >
            {kind === "tests"
              ? "Test cases"
              : kind[0].toUpperCase() + kind.slice(1)}
          </button>
        ))}
      </div>
      <div className="record-tools">
        <label>
          Name
          <input
            value={name}
            maxLength={200}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        {["workspaces", "tests"].includes(collection) && (
          <div className="record-actions">
            <button disabled={busy} onClick={() => save(false)}>
              Save current {collection === "tests" ? "input" : "workspace"}
            </button>
            {((collection === "workspaces" && workspaceId) ||
              (collection === "tests" && selected)) && (
              <button disabled={busy} onClick={() => save(true)}>
                Update{" "}
                {collection === "workspaces" ? "workspace" : "selected test"}
              </button>
            )}
          </div>
        )}
      </div>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {notice && <p role="status" className="notice">{notice}</p>}
      <div className="record-list">
        {rows.length === 0 && (
          <p className="empty">No {collection} saved yet</p>
        )}
        {rows.map((row) => (
          <article
            key={row.id}
            className={selected?.id === row.id ? "record selected" : "record"}
          >
            <button
              className="record-title"
              onClick={() => {
                setSelected(row);
                setName(row.name);
              }}
            >
              <span>
                {row.name}
                {collection === "history" && row.data.mode === "stress" && (
                  <small className="record-summary">
                    Problem {row.data.result.problemId ?? "—"} · {row.data.result.total ?? 0} iterations · {row.data.result.passed ?? 0} passed · {row.data.result.failed ?? 0} failed · {row.data.result.executionTime?.toFixed?.(1) ?? "—"} ms
                  </small>
                )}
              </span>
              <time>{new Date(row.created_at).toLocaleString()}</time>
            </button>
            <div className="record-actions">
              <button disabled={busy} onClick={() => onLoad(collection, row)}>
                {collection === "history" ? "Open run" : "Load"}
              </button>
              {collection === "counterexamples" && (
                <button onClick={() => exportFailure(row)}>Export .txt</button>
              )}
              <button onClick={() => rename(row)}>Rename</button>
              <button onClick={() => remove(row)}>Delete</button>
            </div>
          </article>
        ))}
      </div>
      {selected && (
        <div className="record-detail">
          <header className="pane-header">Saved content</header>
          <pre>{JSON.stringify(selected.data, null, 2)}</pre>
        </div>
      )}
    </aside>
  );
}
