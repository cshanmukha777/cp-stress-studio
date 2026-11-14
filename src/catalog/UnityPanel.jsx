import "./catalog.css";

const UNITY_URL = "http://localhost:4000/unity/index.html";

export default function UnityPanel({ onClose }) {
  return (
    <div className="cat-overlay" onKeyDown={(e) => e.stopPropagation()}>
      <header className="cat-header">
        <h1>3D Failing Case View</h1>
        <span className="cat-muted">Keys: 1 / 2 / 3 / C</span>
        <div className="cat-spacer" />
        <button onClick={onClose}>Back to workbench</button>
      </header>
      <main className="cat-body" style={{ padding: 0, overflow: "hidden" }}>
        <iframe
          title="Failing case 3D view"
          src={UNITY_URL}
          allow="fullscreen"
          style={{ width: "100%", height: "100%", border: 0 }}
        />
      </main>
    </div>
  );
}