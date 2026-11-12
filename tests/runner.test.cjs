const { test } = require("node:test");
const assert = require("node:assert/strict");
const { runCode, prepare } = require("../electron/execution/runner");
const fs = require("node:fs/promises");
const os = require("node:os");
test("Python consumes stdin", async () => {
  const r = await runCode({
    language: "python",
    code: "print(int(input()) * 2)",
    stdin: "21",
  });
  assert.equal(r.status, "AC");
  assert.equal(r.stdout, "42\n");
});
test("C++ compiles and executes", async () => {
  const r = await runCode({
    language: "cpp",
    code: "#include <iostream>\nint main(){std::cout << 42;}",
    stdin: "",
  });
  assert.equal(r.status, "AC");
  assert.equal(r.stdout, "42");
});
test("compiler diagnostics become CE", async () => {
  const r = await runCode({ language: "cpp", code: "not valid C++" });
  assert.equal(r.status, "CE");
  assert.ok(r.stderr);
});
test("Python syntax errors are RE", async () => {
  assert.equal(
    (await runCode({ language: "python", code: "def !" })).status,
    "RE",
  );
});
test("execution timeout and cleanup", async () => {
  const before = (await fs.readdir(os.tmpdir())).filter((x) =>
    x.startsWith("cp-stress-"),
  );
  assert.equal(
    (
      await runCode({
        language: "python",
        code: "while True: pass",
        timeLimit: 100,
      })
    ).status,
    "TLE",
  );
  assert.deepEqual(
    (await fs.readdir(os.tmpdir())).filter((x) => x.startsWith("cp-stress-")),
    before,
  );
});
test("validates scripts and limits", async () => {
  await assert.rejects(runCode({ language: "bash", code: "echo nope" }));
  await assert.rejects(
    runCode({ language: "python", code: "print(1)", timeLimit: -1 }),
  );
});
test("prepared program reusable", async () => {
  const p = await prepare({ language: "python", code: "print(input())" });
  try {
    assert.equal((await p.run("a")).stdout, "a\n");
    assert.equal((await p.run("b")).stdout, "b\n");
  } finally {
    await p.dispose();
  }
});

const { spawnSync } = require("node:child_process");
const hasJava =
  !spawnSync("javac", ["-version"]).error &&
  spawnSync("java", ["-version"]).status === 0;
test("Java compiles Main and consumes stdin", { skip: !hasJava }, async () => {
  const r = await runCode({
    language: "java",
    code: "import java.util.Scanner; public class Main { public static void main(String[] args) { Scanner s = new Scanner(System.in); System.out.println(s.nextInt()*2); } }",
    stdin: "21",
    timeLimit: 3000,
  });
  assert.equal(r.status, "AC");
  assert.equal(r.stdout.trim(), "42");
});
test("Java compilation errors become CE", { skip: !hasJava }, async () => {
  assert.equal(
    (await runCode({ language: "java", code: "public class Main { broken }" }))
      .status,
    "CE",
  );
});
test(
  "memory telemetry is reported on a sufficiently long Linux process",
  { skip: process.platform !== "linux" },
  async () => {
    const r = await runCode({
      language: "python",
      code: "import time\na = bytearray(1024*1024)\ntime.sleep(0.15)",
    });
    assert.ok(r.memory > 0);
  },
);
