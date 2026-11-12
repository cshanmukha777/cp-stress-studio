import { BASE, getToken, request } from "./api";

export function executionPath(problemId) {
  if (!/^[1-9]\d*$/.test(String(problemId))) {
    throw new Error("Enter an existing problem ID");
  }
  return `/execution/problems/${problemId}`;
}

export function executionRequest(problemId, suffix = "", options) {
  return request(executionPath(problemId) + suffix, options);
}

export async function streamSubmission(
  { problemId, ...body },
  signal,
  onEvent,
) {
  const path = executionPath(problemId);
  const token = getToken();
  if (!token)
    throw new Error("Sign in through Account & Problems to run a submission");
  const response = await fetch(`${BASE}/api${path}/submissions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(
      data.error || `Execution request failed (${response.status})`,
    );
  }
  if (!response.body) throw new Error("Execution response has no stream");
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let pending = "";
  let result;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      pending += value;
      let boundary = pending.indexOf("\n\n");
      while (boundary >= 0) {
        const frame = pending.slice(0, boundary);
        pending = pending.slice(boundary + 2);
        const lines = frame.split("\n");
        const event = lines
          .find((line) => line.startsWith("event: "))
          ?.slice(7);
        const data = lines.find((line) => line.startsWith("data: "))?.slice(6);
        if (event && data) {
          const payload = JSON.parse(data);
          if (event === "error") throw new Error(payload.error);
          if (event === "result") result = payload;
          onEvent(event, payload);
        }
        boundary = pending.indexOf("\n\n");
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  if (!result)
    throw new Error("Execution stream ended before a result arrived");
  return result;
}
