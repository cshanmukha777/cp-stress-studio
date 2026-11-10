const { app } = require("electron");
app.setPath("userData", process.env.STUDIO_TEST_DATA);
require("../../electron/main");
