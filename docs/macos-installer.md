# Apple Silicon DMG

Build on macOS with arm64 Node.js 24. From the repository root:

```sh
npm ci
npm run dist:mac
```

The DMG is written to `release/`. The build generates the Prisma client from the locked server dependencies. The packaged layout puts the Vite bundle and Electron main code in `app.asar`, unpacks the Electron execution scripts, and copies the full server runtime to `Contents/Resources/backend/server`. The copy of `electron/execution` under `Contents/Resources/backend/electron` preserves the Express server's relative imports. Prisma's generated TypeScript client and PostgreSQL adapter are included. The current Prisma provider uses the adapter and has no standalone Rust query-engine executable requirement.

Before opening the installed application, start PostgreSQL and apply the database migrations from the source checkout:

```sh
(cd server && npx prisma migrate deploy)
```

Set `DATABASE_URL` in `server/.env` or the terminal environment for that migration. Create `~/Library/Application Support/CP Stress Studio/backend.env` with the same database URL and a strong `JWT_SECRET`. Restrict its permissions with `chmod 600`. Environment values override the file. The installer excludes dotenv files, binds Express to `127.0.0.1:4000`, and checks database health before opening the window. Keep port 4000 free when launching. SQLite and backend templates use the user's application support directory.

C++, Python, and Java require the corresponding host tools on PATH. The bundled backend adds common Homebrew and system locations for Finder launches. Install a JDK and make `java` and `javac` available for Java runs. Compiled programs and input files use the OS temporary directory.

To verify the installer, mount the DMG, copy the app to Applications, launch it from Finder, sign in, and run a known C++ submission. Confirm that the output and verdict appear and persist in PostgreSQL. Quit the app and check that port 4000 is released. For distribution beyond a controlled demo, sign with Developer ID and notarize the app using your Apple credentials.
