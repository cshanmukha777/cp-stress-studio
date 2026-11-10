const { test } = require('node:test');
const assert = require('node:assert/strict');
const { supervise } = require('../electron/execution/process');
test('captures streams and exit status', async () => {
 const r = await supervise(process.execPath, ['-e', 'console.log("ok");console.error("bad");process.exit(2)']);
 assert.equal(r.status, 'RE'); assert.equal(r.stdout, 'ok\n'); assert.match(r.stderr, /bad/); assert.ok(r.time > 0);
});
test('kills infinite loop', async () => { assert.equal((await supervise(process.execPath, ['-e','while(true){}'], { timeout: 100 })).status, 'TLE'); });
test('missing executable resolves', async () => { assert.equal((await supervise('cp-studio-missing-compiler', [])).status, 'RE'); });
test('abort kills active process', async () => { const c = new AbortController(); setTimeout(() => c.abort(), 50); assert.equal((await supervise(process.execPath, ['-e','while(true){}'], {signal:c.signal})).status, 'CANCELLED'); });
test('caps runaway output', async () => { assert.equal((await supervise(process.execPath,['-e','while(true)require("node:fs").writeSync(1,"x".repeat(10000))'])).status,'RE'); });
