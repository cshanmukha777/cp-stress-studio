const fs = require("node:fs");
const path = require("node:path");

exports.default = async function afterPack(context) {
  const appName = fs.readdirSync(context.appOutDir).find((name) => name.endsWith(".app"));
  const source = path.join(context.packager.projectDir, "server", "node_modules");
  const target = path.join(
    context.appOutDir,
    appName,
    "Contents",
    "Resources",
    "app.asar.unpacked",
    "server",
    "node_modules",
  );
  if (!fs.existsSync(source)) {
    throw new Error("server/node_modules is missing. Run the prepare-mac-backend step first.");
  }
  fs.cpSync(source, target, { recursive: true, verbatimSymlinks: true });
};