const { test, expect, _electron } = require("@playwright/test");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { createDatabase } = require("../../electron/database/db");
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
  await expect(page.locator(".record-title")).toContainText("Stress · WA");
  await page.getByRole("button", { name: "Open run", exact: true }).click();
  await expect(page.locator(".counterexample .verdict")).toContainText("WA");
  await page.getByRole("button", { name: "Saved records", exact: true }).click();
  await page.getByRole("button", { name: "Counterexamples", exact: true }).click();
  const exportPath = path.join(data, "failing-case.txt");
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath });
  }, exportPath);
  await page.getByRole("button", { name: "Export .txt", exact: true }).click();
  await expect(page.locator(".drawer p[role='status']")).toContainText("Exported failing case");
  const persisted = createDatabase(path.join(data, "studio.sqlite"));
  const exactInput = persisted.list("counterexamples")[0].data.generatedInput;
  persisted.close();
  expect(await fs.readFile(exportPath, "utf8")).toContain(`=== Generated input ===\n${exactInput}`);
  await page.screenshot({ path: "test-results/stress-counterexample.png" });
});
test("catalog manages tags and assigns/removes them from a problem", async () => {
  const tags = [];
  let assigned = [];
  const problem = {
    id: 1,
    title: "Two Sum",
    slug: "two-sum",
    difficulty: 800,
    createdAt: new Date().toISOString(),
    createdBy: { profile: { handle: "tester" } },
    problemTags: [],
  };
  const json = (route, status, body) => route.fulfill({
    status,
    contentType: "application/json",
    ...(status === 204 ? {} : { body: JSON.stringify(body) }),
  });

  await page.evaluate(() => localStorage.setItem("cp_token", "catalog-test"));
  await page.route("**/api/auth/me", (route) => json(route, 200, {
    email: "tester@example.com", role: "admin", profile: { handle: "tester" },
  }));
  await page.route("**/api/problems?*", (route) => json(route, 200, {
    items: [{ ...problem, problemTags: assigned.map((tag) => ({ tag })) }],
    total: 1, page: 1, pageSize: 5, totalPages: 1,
  }));
  await page.route("**/api/templates", (route) => json(route, 200, { templates: [] }));
  await page.route("**/api/tags**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const match = url.pathname.match(/\/api\/tags\/(\d+)(?:\/(problems))?$/);
    if (request.method() === "POST") {
      const tag = { id: tags.length + 1, ...request.postDataJSON(), parent: null, children: [], createdAt: new Date().toISOString(), _count: { problemTags: 0, children: 0 } };
      tags.push(tag);
      return json(route, 201, tag);
    }
    if (request.method() === "GET" && match?.[2]) return json(route, 200, { items: assigned.length ? [problem] : [], total: assigned.length });
    if (request.method() === "GET" && match) return json(route, 200, tags[Number(match[1]) - 1]);
    const query = (url.searchParams.get("q") || "").toLowerCase();
    const items = tags.filter((tag) => tag.name.toLowerCase().includes(query));
    return json(route, 200, { items, total: items.length });
  });
  await page.route("**/api/problems/1/tags**", async (route) => {
    const request = route.request();
    if (request.method() === "GET") return json(route, 200, { items: assigned, total: assigned.length });
    if (request.method() === "POST") {
      const body = request.postDataJSON();
      const selected = body.tagIds.map((id) => tags.find((tag) => tag.id === id)).filter(Boolean);
      assigned = body.replace ? selected : [...new Map([...assigned, ...selected].map((tag) => [tag.id, tag])).values()];
      return json(route, 200, { items: assigned, total: assigned.length });
    }
    if (request.method() === "DELETE") {
      const id = Number(new URL(request.url()).pathname.split("/").at(-1));
      assigned = assigned.filter((tag) => tag.id !== id);
      return json(route, 204, null);
    }
  });

  await page.getByRole("button", { name: "Account & Problems" }).click();
  await page.getByRole("button", { name: "Tags", exact: true }).click();
  await page.locator(".cat-tag-form input").first().fill("Array");
  await page.locator(".cat-tag-form textarea").fill("Sequence data");
  await page.locator(".cat-tag-form button[type='submit']").click();
  await expect(page.locator(".cat-ok[role='status']")).toContainText("Tag created");
  await expect(page.locator(".cat-tag-card")).toContainText("Array");

  await page.getByRole("button", { name: "Problems", exact: true }).click();
  await page.getByRole("button", { name: "Manage tags" }).click();
  await page.getByRole("checkbox", { name: /Array/ }).check();
  await page.getByRole("button", { name: "Save tag selection" }).click();
  await expect(page.locator(".cat-problem-tag-editor [role='status']")).toContainText("Problem tags saved");
  await expect(page.locator(".cat-table .cat-tag-pill")).toHaveText("Array");
  await page.getByRole("button", { name: "Remove Array" }).click();
  await expect(page.locator(".cat-table .cat-tag-pill")).toHaveCount(0);
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
