import { streamSubmission } from "../catalog/execution";
import { useEffect, useRef, useState } from "react";
export function useExecution() {
  const [busy, setBusy] = useState(false),
    [result, setResult] = useState(null),
    [logs, setLogs] = useState(""),
    [progress, setProgress] = useState(null),
    [error, setError] = useState("");
  const active = useRef(null);
  const controller = useRef(null);
  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;
    const offProgress = api.onProgress((data) => {
      if (data.runId === active.current) setProgress(data);
    });
    return () => {
      controller.current?.abort();
      offProgress();
      if (active.current && !controller.current)
        api.cancel(active.current).catch(() => {});
    };
  }, []);
  async function run(mode, request) {
    if (active.current) return;
    if (mode === "stress" && !window.electronAPI) {
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
      if (mode === "single") {
        controller.current = new AbortController();
        const response = await streamSubmission(
          request,
          controller.current.signal,
          (event, payload) => {
            if (event === "output")
              setLogs((old) => (old + payload.text).slice(-1024 * 1024));
          },
        );
        setResult(response);
      } else {
        setResult(await window.electronAPI.startStress({ ...request, runId }));
      }
    } catch (e) {
      if (e.name === "AbortError") setResult({ status: "CANCELLED" });
      else setError(e.message);
    } finally {
      controller.current = null;
      active.current = null;
      setBusy(false);
    }
  }
  async function cancel() {
    try {
      if (controller.current) controller.current.abort();
      else if (active.current) await window.electronAPI.cancel(active.current);
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
