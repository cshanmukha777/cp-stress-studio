const { runCode, validateInput } = require('./execution/runner');
const { stressTest, normalize } = require('./execution/stress');
function registerIPC(ipcMain, db, isTrusted) {
  const active = new Map();
  const channels = [];
  function handle(channel, fn) {
    channels.push(channel);
    ipcMain.handle(channel, async (event, ...args) => {
      if (!isTrusted(event)) throw new Error('Untrusted renderer');
      return fn(event, ...args);
    });
  }
  async function execute(event, request, mode) {
    const sender = event.sender;
    if (!request || typeof request.runId !== 'string' || request.runId.length > 100) throw new Error('Invalid run ID');
    if (active.has(sender.id)) throw new Error('An execution is already running');
    if (mode === 'single' && request.checkExpected) validateInput(request.expected);
    const controller = new AbortController();
    active.set(sender.id, {controller, runId:request.runId});
    const abort = () => controller.abort();
    sender.once('destroyed', abort);
    const send = (channel, payload) => { if (!sender.isDestroyed()) sender.send(channel, {runId:request.runId,...payload}); };
    try {
      let result = mode === 'single'
        ? await runCode(request, {signal:controller.signal, onOutput:data=>send('execution:output',data)})
        : await stressTest(request, {signal:controller.signal,onProgress:data=>send('stress:progress',data)});
      if (mode === 'single' && result.status === 'AC' && request.checkExpected) {
        if (typeof request.expected !== 'string') throw new Error('Expected output must be text');
        result = {...result,status:normalize(result.stdout) === normalize(request.expected) ? 'AC':'WA'};
      }
      const data = {mode, request, result};
      try {
        db.save('history',{name:`${mode} · ${result.status}`,workspace_id:request.workspaceId,data});
        if (mode === 'stress' && ['WA','TLE','RE'].includes(result.status) && result.input !== undefined) db.save('counterexamples',{name:`${result.status} · iteration ${result.iteration}`,workspace_id:request.workspaceId,data});
      } catch(error) { result = {...result,persistenceError:error.message}; }
      return result;
    } finally { active.delete(sender.id); sender.removeListener('destroyed',abort); }
  }
  handle('run-code',(event,request)=>execute(event,request,'single'));
  handle('stress:start',(event,request)=>execute(event,request,'stress'));
  handle('execution:cancel',(event,runId)=>{const job=active.get(event.sender.id);if(job?.runId===runId){job.controller.abort();return true;}return false;});
  handle('db:list',(_event,collection,workspaceId)=>db.list(collection,workspaceId));
  handle('db:get',(_event,collection,id)=>db.get(collection,id));
  handle('db:save',(_event,collection,record)=>db.save(collection,record));
  handle('db:delete',(_event,collection,id)=>db.remove(collection,id));
  return () => { for (const job of active.values()) job.controller.abort(); for (const channel of channels) ipcMain.removeHandler(channel); };
}
module.exports = { registerIPC };
