const { contextBridge, ipcRenderer } = require("electron");
const subscribe = (channel, callback) => {
  if (typeof callback !== "function") throw new TypeError("Callback required");
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};
contextBridge.exposeInMainWorld("electronAPI", {
  runCode: (request) => ipcRenderer.invoke("run-code", request),
  startStress: (request) => ipcRenderer.invoke("stress:start", request),
  cancel: (runId) => ipcRenderer.invoke("execution:cancel", runId),
  onOutput: (callback) => subscribe("execution:output", callback),
  onProgress: (callback) => subscribe("stress:progress", callback),
  db: {
    list: (collection, workspaceId) =>
      ipcRenderer.invoke("db:list", collection, workspaceId),
    get: (collection, id) => ipcRenderer.invoke("db:get", collection, id),
    save: (collection, record) =>
      ipcRenderer.invoke("db:save", collection, record),
    remove: (collection, id) => ipcRenderer.invoke("db:delete", collection, id),
  },
});
