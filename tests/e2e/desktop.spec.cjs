const { test, expect, _electron } = require("@playwright/test");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { runCode } = require("../../electron/execution/runner");
const { normalize } = require("../../electron/execution/stress");
let app, page, data;
async function launch() {
  app = await _electron.launch({
    args: [
      ...(process.platform === "linux"
        ? ["--ozone-platform=headless", "--disable-gpu", "--no-sandbox"]
        : []),
      "tests/fixtures/desktop.cjs",
    ],
    env: { ...process.env, NODE_ENV: "test", STUDIO_TEST_DATA: data },
  });
  page = await app.firstWindow();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(
    page.getByRole("heading", { name: "CP Stress Studio" }),
  ).toBeVisible();
}
async function configureSubmissionApi(handler, status = 200) {
  await page.evaluate(() => localStorage.setItem("cp_token", "desktop-test"));
  await page.getByLabel("Problem ID").fill("1");
  await page.route("**/api/execution/problems/1/submissions", async (route) => {
    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization, content-type",
      "access-control-allow-methods": "POST, OPTIONS",
    };
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }
    const result = await handler(route.request().postDataJSON());
    await route
      .fulfill({
        headers,
        status,
        contentType: status === 200 ? "text/event-stream" : "application/json",
        body:
          status === 200
            ? `event: result\ndata: ${JSON.stringify(result)}\n\n`
            : JSON.stringify(result),
      })
      .catch(() => {});
  });
}
test.beforeEach(async () => {
  data = await fs.mkdtemp(path.join(os.tmpdir(), "studio-e2e-"));
  await launch();
});
test.afterEach(async () => {
  await app?.close();
  await fs.rm(data, { recursive: true, force: true });
});
test("built desktop loads editor, executes C++ and compares output", async () => {
  await configureSubmissionApi(async (request) => {
    const result = await runCode(request);
    if (
      result.status === "AC" &&
      request.checkExpected &&
      normalize(result.stdout) !== normalize(request.expected)
    )
      result.status = "WA";
    return result;
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await expect(page.locator(".monaco-editor")).toBeVisible();
  await page.getByRole("checkbox", { name: "Compare" }).check();
  await page.getByRole("button", { name: /^Run/ }).click();
  await expect(page.locator(".result-pane .verdict")).toHaveText("AC");
  await expect(page.getByLabel("Execution output")).toHaveText("5");
  expect(errors).toEqual([]);
  await page.screenshot({ path: "test-results/single-run.png" });
});
test("stress mismatch saves input, loads history and persists workspace across restart", async () => {
  await page.getByRole("button", { name: "Stress test", exact: true }).click();
  await page.getByLabel("Optimal solution language").selectOption("python");
  const editor = page.getByRole("textbox", {
    name: "Optimal solution source code",
    exact: true,
  });
  await editor.focus();
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+A" : "Control+A",
  );
  await page.keyboard.insertText("print(0)");
  await page.getByRole("button", { name: /Start stress/ }).click();
  await expect(page.locator(".counterexample .verdict")).toContainText("WA");
  await page
    .getByRole("button", { name: "Save counterexample as test case" })
    .click();
  await page.getByRole("button", { name: "Test cases", exact: true }).click();
  await expect(page.locator(".record-title")).toContainText("Counterexample 1");
  await page.getByRole("button", { name: "Load", exact: true }).click();
  await expect(page.getByLabel("Standard input")).not.toHaveValue("");
  await expect(page.locator(".result-pane .verdict")).toHaveCount(0);
  await expect(page.getByLabel("Execution output")).toContainText(
    "Output appears here",
  );
  await page
    .getByRole("button", { name: "Saved records", exact: true })
    .click();
  await page.getByLabel("Name", { exact: true }).fill("Regression problem");
  await page
    .getByRole("button", { name: "Save current workspace", exact: true })
    .click();
  await expect(page.locator(".record-title")).toContainText(
    "Regression problem",
  );
  await app.close();
  await launch();
  await page
    .getByRole("button", { name: "Saved records", exact: true })
    .click();
  await expect(page.locator(".record-title")).toContainText(
    "Regression problem",
  );
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(page.locator(".record-title")).toContainText("stress · WA");
  await page.getByRole("button", { name: "Load", exact: true }).click();
  await expect(page.locator(".counterexample .verdict")).toContainText("WA");
  await page.screenshot({ path: "test-results/stress-counterexample.png" });
});
test("stop cancels a live execution", async () => {
  let finish;
  const response = new Promise((resolve) => {
    finish = resolve;
  });
  await configureSubmissionApi(() => response);
  await page.getByLabel("Solution language").selectOption("python");
  const editor = page.getByRole("textbox", {
    name: "Solution source code",
    exact: true,
  });
  await editor.focus();
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+A" : "Control+A",
  );
  await page.keyboard.insertText("while True: pass");
  await page.getByLabel("Time limit in milliseconds").fill("30000");
  await page.getByRole("button", { name: /^Run/ }).click();
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  finish({ status: "AC" });
  await expect(page.locator(".result-pane .verdict")).toHaveText("CANCELLED");
});

test("expired submission session is cleared and explained in the console", async () => {
  await configureSubmissionApi(
    () => ({ error: "Invalid or expired token" }),
    401,
  );
  await page.getByRole("button", { name: /^Run/ }).click();
  await expect(page.locator(".result-pane").getByRole("alert")).toContainText(
    "Your session expired",
  );
  await expect(page.getByRole("button", { name: /^Run/ })).toBeEnabled();
  expect(
    await page.evaluate(() => localStorage.getItem("cp_token")),
  ).toBeNull();
});

test("a submission keeps its verdict when database contention prevents saving", async () => {
  await configureSubmissionApi(() => ({
    status: "AC",
    stdout: "5",
    persistenceError: "Database is busy. This result was not saved.",
  }));
  await page.getByRole("button", { name: /^Run/ }).click();
  await expect(page.locator(".result-pane .verdict")).toHaveText("AC");
  await expect(page.locator(".result-pane").getByRole("alert")).toContainText(
    "This result was not saved",
  );
  await expect(page.getByLabel("Execution output")).toHaveText("5");
  await expect(page.getByRole("button", { name: /^Run/ })).toBeEnabled();
});
