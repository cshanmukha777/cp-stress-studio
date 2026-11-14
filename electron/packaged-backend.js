const { app, utilityProcess } = require("electron");
const { access, readFile } = require("node:fs/promises");
const path = require("node:path");
const { parseEnv } = require("node:util");

let backend;
let stopping = false;

function stopPackagedBackend() {
  stopping = true;
  backend?.kill();
}

async function startPackagedBackend(onUnexpectedExit) {
  const root = path.join(process.resourcesPath, "backend", "server");
  const entry = path.join(root, "src", "server.js");
  const configPath = path.join(app.getPath("userData"), "backend.env");
  await Promise.all([
    entry,
    path.join(root, "src", "generated", "prisma", "client.ts"),
    path.join(root, "node_modules", "@prisma", "adapter-pg", "package.json"),
  ].map((file) => access(file).catch(() => {
    throw new Error("The installer is missing backend files. Rebuild and reinstall CP Stress Studio.");
  })));

  const config = await readFile(configPath, "utf8").then(parseEnv, (error) => {
    if (error.code === "ENOENT") return {};
    throw error;
  });
  const settings = { ...config, ...process.env };
  if (!settings.DATABASE_URL?.trim() || !settings.JWT_SECRET?.trim()) {
    throw new Error(`Set DATABASE_URL and JWT_SECRET in:\n${configPath}`);
  }

  backend = utilityProcess.fork(entry, [], {
    cwd: app.getPath("userData"),
    serviceName: "CP Stress Studio API",
    env: {
      ...process.env,
      DATABASE_URL: settings.DATABASE_URL,
      JWT_SECRET: settings.JWT_SECRET,
      HOST: "127.0.0.1",
      PORT: "4000",
      PATH: [process.env.PATH, "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"]
        .filter(Boolean).join(path.delimiter),
    },
    stdio: "ignore",
  });

  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("The backend did not start. Check whether port 4000 is free."));
      }, 10000);
      backend.once("exit", (code) => {
        clearTimeout(timeout);
        reject(new Error(`The backend exited (${code}). Check port 4000 and reinstall if backend files are missing.`));
      });
      backend.once("message", (message) => {
        clearTimeout(timeout);
        if (message === "cpstudio:ready") resolve();
        else reject(new Error("The backend did not confirm startup."));
      });
    });

    const response = await fetch("http://127.0.0.1:4000/api/health", {
      signal: AbortSignal.timeout(5000),
    }).catch(() => null);
    if (!response?.ok) {
      throw new Error("PostgreSQL health check failed. Check backend.env and apply the server migrations.");
    }
    backend.once("exit", () => {
      if (!stopping) onUnexpectedExit();
    });
  } catch (error) {
    stopPackagedBackend();
    throw error;
  }
}

module.exports = { startPackagedBackend, stopPackagedBackend };
