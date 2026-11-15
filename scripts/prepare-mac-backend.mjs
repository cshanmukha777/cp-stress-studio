import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

if (process.platform !== "darwin" || process.arch !== "arm64") {
  throw new Error("Build this DMG on Apple Silicon macOS using arm64 Node.js.");
}

const cwd = fileURLToPath(new URL("../server/", import.meta.url));
const env = { ...process.env, npm_config_include: "dev" };
const options = { cwd, env, stdio: "inherit" };
execFileSync("npm", ["ci"], options);
execFileSync("npm", ["exec", "--", "prisma", "generate"], options);
execFileSync("npm", ["prune", "--omit=dev"], { ...options, env: process.env });
