const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { createDatabase } = require("./database/db");
const { registerIPC } = require("./ipc");
const { formatFailingCase } = require("./execution/failingCaseExport");
const { startPackagedBackend, stopPackagedBackend } = require("./packaged-backend");
let db, disposeIPC;

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440,
    minWidth: 900,
    minHeight: 640,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event) => event.preventDefault());

  // In development, load the Vite local server; in production, load the built files
  const isDev = !app.isPackaged && process.env.NODE_ENV === "development";
  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(async () => {
  if (app.isPackaged) {
    try {
      await startPackagedBackend(() => {
        dialog.showErrorBox("CP Stress Studio", "The local API stopped. Restart the app to reconnect.");
        app.quit();
      });
    } catch (error) {
      dialog.showErrorBox("CP Stress Studio could not start", error.message);
      app.quit();
      return;
    }
  }
  db = createDatabase(path.join(app.getPath("userData"), "studio.sqlite"));
  const trustedURL =
    !app.isPackaged && process.env.NODE_ENV === "development"
      ? "http://localhost:5173/"
      : pathToFileURL(path.join(__dirname, "../dist/index.html")).href;
  disposeIPC = registerIPC(
    ipcMain,
    db,
    (event) =>
      event.senderFrame === event.sender.mainFrame &&
      event.senderFrame.url === trustedURL,
    async (record) => {
      const { contents, filename } = formatFailingCase(record);
      const choice = await dialog.showSaveDialog({
        title: "Export failing case",
        defaultPath: path.join(app.getPath("downloads"), filename),
        filters: [{ name: "Text file", extensions: ["txt"] }],
      });
      if (choice.canceled || !choice.filePath) return { saved: false, canceled: true };
      const target = choice.filePath.toLowerCase().endsWith(".txt")
        ? choice.filePath
        : `${choice.filePath}.txt`;
      await fs.writeFile(target, contents, { encoding: "utf8", flag: "wx" });
      return { saved: true, path: target };
    },
  );
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
let shutdownStarted = false;
let shutdownComplete = false;
app.on("before-quit", (event) => {
  if (shutdownComplete || !disposeIPC) return;
  event.preventDefault();
  if (shutdownStarted) return;
  shutdownStarted = true;
  disposeIPC().finally(() => {
    shutdownComplete = true;
    app.quit();
  });
});
app.on("will-quit", () => {
  stopPackagedBackend();
  db?.close();
});
