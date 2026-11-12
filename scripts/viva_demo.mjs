import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import concurrently from "concurrently";

function demoSettings() {
  let file = {};
  try {
    file = parseEnv(readFileSync(new URL("../server/.env", import.meta.url), "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const settings = { ...file, ...process.env };
  if (!/^postgres(?:ql)?:\/\//i.test(settings.DATABASE_URL?.trim() ?? "")) {
    throw new Error("Set DATABASE_URL to your local PostgreSQL URL in server/.env or your shell.");
  }
  if (!settings.JWT_SECRET?.trim()) {
    throw new Error("Set JWT_SECRET in server/.env or your shell before starting the demo.");
  }
  const port = settings.PORT || "4000";
  if (!/^[1-9]\d{0,4}$/.test(port) || Number(port) > 65535 || port === "5173") {
    throw new Error("Use a valid backend PORT other than the desktop development port 5173.");
  }
  return { port, backendUrl: `http://127.0.0.1:${port}` };
}

let settings;
try {
  settings = demoSettings();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

delete process.env.ELECTRON_RUN_AS_NODE;

const { result } = concurrently(
  [
    {
      name: "api",
      command: "npm --prefix server start",
      env: { HOST: "127.0.0.1", PORT: settings.port },
    },
    {
      name: "desktop",
      command: `wait-on --timeout 30000 http-get://127.0.0.1:${settings.port}/api/health && npm run dev`,
      env: { VITE_API_URL: settings.backendUrl },
    },
  ],
  { killOthersOn: ["failure", "success"], successCondition: "first" },
);
try {
  await result;
} catch {
  console.error("Demo stopped. Check the API logs and confirm PostgreSQL is running and migrations are applied.");
  process.exitCode = 1;
}
