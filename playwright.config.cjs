const { defineConfig } = require("@playwright/test");
module.exports = defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  timeout: 30000,
  reporter: "list",
  use: { trace: "retain-on-failure" },
});
