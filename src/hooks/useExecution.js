import { useEffect, useRef, useState } from "react";
export function useExecution() {
  const [busy, setBusy] = useState(false),
    [result, setResult] = useState(null),
    [logs, setLogs] = useState(""),
    [progress, setProgress] = useState(null),
    [error, setError] = useState("");
  const active = useRef(null);
  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;
    const offOutput = api.onOutput((data) => {
      if (data.runId === active.current)
        setLogs((old) => (old + data.text).slice(-1024 * 1024));
    });
    const offProgress = api.onProgress((data) => {
      if (data.runId === active.current) setProgress(data);
    });
    return () => {
      offOutput();
      offProgress();
      if (active.current) api.cancel(active.current).catch(() => {});
    };
  }, []);
  async function run(mode, request) {
    if (active.current) return;
    if (!window.electronAPI) {
      setError("Open the desktop app to execute code");
      return;
    }
    const runId = crypto.randomUUID();
    active.current = runId;
    setBusy(true);
    setResult(null);
    setLogs("");
    setProgress(null);
    setError("");
    try {
      const response = await window.electronAPI[
        mode === "single" ? "runCode" : "startStress"
      ]({ ...request, runId });
      setResult(response);
    } catch (e) {
      setError(e.message);
    } finally {
      active.current = null;
      setBusy(false);
    }
  }
  async function cancel() {
    try {
      if (active.current) await window.electronAPI.cancel(active.current);
    } catch (e) {
      setError(e.message);
    }
  }
  function loadResult(value) {
    setLogs("");
    setProgress(null);
    setError("");
    setResult(value);
  }
  return {
    busy,
    result,
    logs,
    progress,
    error,
    run,
    cancel,
    setResult: loadResult,
  };
}
