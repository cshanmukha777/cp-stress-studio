const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { registerIPC } = require("../electron/ipc");
const { createDatabase } = require("../electron/database/db");
test("IPC validates origin, streams, persists and scopes cancellation", async () => {
  const handlers = new Map();
  const ipc = {
    handle: (c, f) => handlers.set(c, f),
    removeHandler: (c) => handlers.delete(c),
  };
  const db = createDatabase(":memory:");
  const sender = new EventEmitter();
  sender.id = 1;
  sender.isDestroyed = () => false;
  const messages = [];
  sender.send = (c, p) => messages.push([c, p]);
  const event = { sender, trusted: true };
  const cleanup = registerIPC(ipc, db, (e) => e.trusted);
  try {
    await assert.rejects(
      handlers.get("db:list")({ trusted: false }, "history"),
      /Untrusted/,
    );
    const r = await handlers.get("run-code")(event, {
      runId: "1",
      language: "python",
      code: "print(3)",
      checkExpected: true,
      expected: "4",
    });
    assert.equal(r.status, "WA");
    assert.equal(db.list("history").length, 1);
    assert.equal(messages[0][1].runId, "1");
    const pending = handlers.get("run-code")(event, {
      runId: "2",
      language: "python",
      code: "while True: pass",
    });
    assert.equal(await handlers.get("execution:cancel")(event, "wrong"), false);
    assert.equal(await handlers.get("execution:cancel")(event, "2"), true);
    assert.equal((await pending).status, "CANCELLED");
  } finally {
    await cleanup();
    db.close();
  }
  assert.equal(handlers.size, 0);
});
