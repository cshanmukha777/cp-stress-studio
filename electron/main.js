const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { createDatabase } = require("./database/db");
const { registerIPC } = require("./ipc");
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
  const isDev = process.env.NODE_ENV === "development";
  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(() => {
  db = createDatabase(path.join(app.getPath("userData"), "studio.sqlite"));
  const trustedURL =
    process.env.NODE_ENV === "development"
      ? "http://localhost:5173/"
      : pathToFileURL(path.join(__dirname, "../dist/index.html")).href;
  disposeIPC = registerIPC(
    ipcMain,
    db,
    (event) =>
      event.senderFrame === event.sender.mainFrame &&
      event.senderFrame.url === trustedURL,
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
app.on("will-quit", () => db?.close());
