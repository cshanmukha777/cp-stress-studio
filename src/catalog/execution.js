import { BASE, getToken, request, setToken } from "./api";

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
  let response;
  try {
    response = await fetch(`${BASE}/api${path}/submissions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error(
      "Execution API is unreachable. Start it with npm run viva:member2.",
      { cause: error },
    );
  }
  if (response.status === 401) {
    if (getToken() === token) setToken(null);
    await response.body?.cancel().catch(() => {});
    throw new Error(
      "Your session expired. Sign in again through Account & Problems, then retry.",
    );
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(
      data.error || `Execution request failed (${response.status})`,
    );
  }
  if (
    !response.body ||
    !response.headers.get("content-type")?.startsWith("text/event-stream")
  ) {
    await response.body?.cancel().catch(() => {});
    throw new Error("Execution response is not an event stream");
  }
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let pending = "";
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
          onEvent(event, payload);
          if (event === "result") return payload;
        }
        boundary = pending.indexOf("\n\n");
      }
    }
  } catch (error) {
    if (
      signal.aborted ||
      (error instanceof Error &&
        !(error instanceof TypeError || error instanceof SyntaxError))
    )
      throw error;
    throw new Error(
      "The execution stream was interrupted. Check submission history before retrying.",
      { cause: error },
    );
  } finally {
    await reader.cancel().catch(() => {});
  }
  throw new Error("Execution stream ended before a result arrived");
}
