const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { supervise } = require("./process");
const LANGUAGES = ["cpp", "python", "java"];
function validateScript(script) {
  if (
    !script ||
    !LANGUAGES.includes(script.language) ||
    typeof script.code !== "string" ||
    !script.code.trim() ||
    Buffer.byteLength(script.code) > 512 * 1024
  )
    throw new Error("Provide C++, Python or Java source (maximum 512 KiB)");
}
function validateLimit(value = 2000) {
  if (!Number.isInteger(value) || value < 50 || value > 30000)
    throw new Error("Time limit must be 50–30000 ms");
  return value;
}
function validateInput(stdin = "") {
  if (typeof stdin !== "string" || Buffer.byteLength(stdin) > 1024 * 1024)
    throw new Error("Input must be text up to 1 MiB");
  return stdin;
}
async function prepare(script, options = {}) {
  validateScript(script);
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cp-stress-"));
  const dispose = () =>
    fs.rm(cwd, { recursive: true, force: true, maxRetries: 3 });
  try {
    const file = { cpp: "main.cpp", python: "main.py", java: "Main.java" }[
      script.language
    ];
    await fs.writeFile(path.join(cwd, file), script.code);
    let compilation = null;
    if (script.language !== "python") {
      const command = script.language === "cpp" ? "g++" : "javac";
      const args =
        script.language === "cpp"
          ? ["-O3", "-std=c++17", file, "-o", "program"]
          : ["-encoding", "UTF-8", file];
      options.onPhase?.("building");
      compilation = await supervise(command, args, {
        cwd,
        timeout: 30000,
        signal: options.signal,
        env: options.env,
        memoryLimitKiB: options.memoryLimitKiB,
        onMetrics:
          options.onMetrics &&
          ((sample) => options.onMetrics("building", sample)),
      });
      if (compilation.status !== "AC") {
        if (compilation.status === "TLE")
          compilation.stderr += "\nCompilation timed out after 30000 ms";
        if (!["CANCELLED", "MLE"].includes(compilation.status))
          compilation.status = "CE";
        await dispose();
        return { error: compilation, dispose };
      }
    }
    return {
      dispose,
      run: (stdin = "", runOptions = {}) => {
        const command =
          script.language === "cpp"
            ? path.join(cwd, "program")
            : script.language === "python"
              ? "python3"
              : "java";
        const args =
          script.language === "cpp"
            ? []
            : script.language === "python"
              ? ["-u", "main.py"]
              : ["-cp", cwd, "Main"];
        return supervise(command, args, {
          cwd,
          stdin: validateInput(stdin),
          timeout: validateLimit(runOptions.timeLimit),
          signal: runOptions.signal,
          onOutput: runOptions.onOutput,
          memoryLimitKiB: runOptions.memoryLimitKiB,
          onMetrics:
            runOptions.onMetrics &&
            ((sample) => runOptions.onMetrics("running", sample)),
          env: {
            ...(runOptions.env ?? process.env),
            CP_STRESS_SEED: String(runOptions.seed ?? 1),
          },
        });
      },
    };
  } catch (error) {
    await dispose();
    throw error;
  }
}
async function runCode(request, options = {}) {
  validateScript(request);
  validateLimit(request.timeLimit);
  validateInput(request.stdin);
  const program = await prepare(request, options);
  try {
    if (!program.error) options.onPhase?.("running");
    return (
      program.error ||
      (await program.run(request.stdin, {
        ...options,
        timeLimit: request.timeLimit,
      }))
    );
  } finally {
    await program.dispose();
  }
}
module.exports = {
  runCode,
  prepare,
  validateScript,
  validateLimit,
  validateInput,
};
