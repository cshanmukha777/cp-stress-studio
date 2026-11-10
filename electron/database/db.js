const { DatabaseSync } = require('node:sqlite');
const { randomUUID } = require('node:crypto');
const COLLECTIONS = new Set(['workspaces', 'tests', 'history', 'counterexamples']);
function createDatabase(filename) {
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS records (
      id TEXT PRIMARY KEY, collection TEXT NOT NULL, workspace_id TEXT,
      name TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS records_collection ON records(collection, updated_at);
    CREATE INDEX IF NOT EXISTS records_workspace ON records(workspace_id);`);
  const collectionCheck = value => { if (!COLLECTIONS.has(value)) throw new Error('Unknown collection'); };
  const decode = row => row ? {...row, data:JSON.parse(row.data)} : null;
  function get(collection, id) { collectionCheck(collection); return decode(db.prepare('SELECT * FROM records WHERE collection=? AND id=?').get(collection, id)); }
  function save(collection, record) {
    collectionCheck(collection);
    if (!record || typeof record.name !== 'string' || !record.name.trim() || record.name.length > 200) throw new Error('Name must contain 1–200 characters');
    const data = JSON.stringify(record.data);
    if (!data || Buffer.byteLength(data) > 8 * 1024 * 1024) throw new Error('Record must contain JSON data up to 8 MiB');
    const id = record.id || randomUUID();
    if (typeof id !== 'string' || id.length > 100) throw new Error('Invalid record ID');
    if (record.id && !get(collection, id)) throw new Error('Record no longer exists');
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO records VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
      workspace_id=excluded.workspace_id,name=excluded.name,data=excluded.data,updated_at=excluded.updated_at`).run(id,collection,record.workspace_id || null,record.name.trim(),data,now,now);
    return get(collection,id);
  }
  return {
    get, save,
    list(collection, workspaceId) { collectionCheck(collection); return (workspaceId ? db.prepare('SELECT * FROM records WHERE collection=? AND workspace_id=? ORDER BY updated_at DESC').all(collection,workspaceId) : db.prepare('SELECT * FROM records WHERE collection=? ORDER BY updated_at DESC').all(collection)).map(decode); },
    remove(collection,id) {
      collectionCheck(collection);
      // Preserve historical records if their workspace is removed.
      db.exec('BEGIN');
      try {
        if (collection === 'workspaces') db.prepare('UPDATE records SET workspace_id=NULL WHERE workspace_id=?').run(id);
        const result = db.prepare('DELETE FROM records WHERE collection=? AND id=?').run(collection,id);
        db.exec('COMMIT'); return result.changes > 0;
      } catch(error) {db.exec('ROLLBACK');throw error;}
    },
    close: () => db.close(),
  };
}
module.exports = { createDatabase };
