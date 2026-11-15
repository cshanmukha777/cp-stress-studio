# CP Stress Studio

**A desktop workbench for writing competitive programming solutions and finding the inputs that break them.**

[![Build](https://github.com/cshanmukha777/cp-stress-studio/actions/workflows/build-dmg.yml/badge.svg)](https://github.com/cshanmukha777/cp-stress-studio/actions/workflows/build-dmg.yml)
![License](https://img.shields.io/badge/license-pending-lightgrey)
![Version](https://img.shields.io/badge/version-capstone-blue)

![CP Stress Studio showing a stress-test counterexample](docs/images/stress-counterexample.png)

## About the Project

Passing sample tests is easy to verify. Finding the input that exposes a subtle bug in an optimized solution often takes more work. CP Stress Studio brings editing, compilation, test generation, output comparison, and failure analysis into one desktop application.

Start with a problem from the catalog, write a solution, and run it against custom input. When you need broader coverage, pair an optimized solution with a brute-force reference and an input generator. The stress workbench runs both solutions against the same generated cases and captures mismatches with the input, expected output, and actual output available for inspection.

The workbench also supports the work around each run. Account sessions, problem tags, saved records, and submission analytics help users organize problems and revisit results. Local execution lets users run code with the C++, Python, and Java toolchains already installed on their machine.

## Key Features

- **Code workbench** — Edit C++, Python, and Java in Monaco. Supply standard input, optionally compare against expected output, and inspect verdicts, diagnostics, and timing.
- **Local execution** — Compile and run programs with Node.js `child_process.spawn` in temporary working directories. Cancel active runs and inspect time-limit or runtime failures.
- **Automated stress testing** — Compare an optimized solution with a brute-force reference across generated inputs. Reproduce failures with seeded generators and inspect output differences alongside the counterexample.
- **Live execution feedback** — Follow build status, output, and available runtime metrics over Server-Sent Events for backend executions. The desktop stress workbench reports iteration progress through Electron IPC.
- **Problem catalog and sessions** — Sign up, sign in, and browse the local catalog with JWT-backed sessions. Organize problems using tags and reuse code templates.
- **Saved records and analytics** — Revisit workspaces, saved test cases, run history, and stress counterexamples. Review PostgreSQL-backed submission analytics for verdicts, runtime, and memory.

## System Architecture

| Layer | Technologies | Responsibility |
| --- | --- | --- |
| Renderer | React, Vite, Tailwind CSS, Monaco Editor | Catalog, account screens, code editors, execution console, and stress workbench |
| Desktop | Electron | Window lifecycle, preload bridge, desktop IPC, and packaged backend startup |
| Local API | Node.js, Express, SSE | Authentication, catalog access, submission analytics, and streamed execution events |
| Persistence | PostgreSQL, Prisma, local SQLite | PostgreSQL stores application records such as users, problems, and submissions. SQLite stores desktop workspaces, history, and stress counterexamples. |
| Execution | Node.js `child_process.spawn`, host toolchains | Compilation, test execution, process cancellation, and output collection |
| Build pipeline | GitHub Actions, Electron Builder | Cloud builds and downloadable macOS Apple Silicon DMG artifacts |

The React renderer calls Express over loopback for authentication, catalog data, analytics, and streamed single-run results. The desktop stress workbench uses Electron’s preload bridge to start, monitor, and cancel stress runs. In the packaged macOS app, Electron starts the bundled Express backend, which connects to a separately configured PostgreSQL instance through Prisma.

## Getting Started

### Prerequisites

- **Node.js 24 LTS** and npm.
- **PostgreSQL** running locally, with an empty development database and a PostgreSQL role that can create tables in it.
- **Language toolchains** for the languages you plan to run. Make the corresponding commands available on your `PATH`.

| Language | Required commands |
| --- | --- |
| C++17 | `g++` |
| Python 3 | `python3` |
| Java | `javac` and `java` |

Run programs you trust. Submissions execute with your OS account’s privileges, and temporary directories provide file separation only.

### Installation and Setup

Clone the repository and install the locked dependencies for both packages.

```bash
git clone https://github.com/cshanmukha777/cp-stress-studio.git
cd cp-stress-studio
npm ci
npm ci --prefix server
cp server/.env.example server/.env
```

Edit `server/.env` using your local database credentials. Generate a local JWT signing secret with `openssl rand -hex 32`.

```dotenv
DATABASE_URL="postgresql://YOUR_DB_USER:YOUR_DB_PASSWORD@localhost:5432/cp_stress_studio"
JWT_SECRET="REPLACE_WITH_YOUR_GENERATED_SECRET"
PORT=4000
```

For a fresh development database, apply the schema and generate the Prisma client.

```bash
cd server
npx prisma db push
npx prisma generate
cd ..
```

If your database already uses the repository’s migration history, run `npx prisma migrate deploy` from `server/` in place of `npx prisma db push`.

### Run Locally

From the repository root, start the backend in one terminal.

```bash
npm --prefix server run dev
```

Start the Vite renderer and Electron in a second terminal.

```bash
npm run dev
```

The API listens on `http://127.0.0.1:4000` by default. To check the backend and its database connection, run:

```bash
curl -fsS http://127.0.0.1:4000/api/health
```

### Build for Production

On an Apple Silicon Mac with arm64 Node.js, run the following from the repository root:

```bash
npm run dist:mac
```

The command builds the renderer, prepares the Express backend and generated Prisma client, and writes the `.dmg` to `release/`.

You can also build in the cloud. In GitHub, open **Actions → Build macOS arm64 DMG → Run workflow**. Once the run succeeds, download **cp-stress-studio-macos-arm64** from the run summary’s **Artifacts** section.

For the installed macOS app, supply `DATABASE_URL` and `JWT_SECRET` in `backend.env` under Electron’s user data directory. If the file is missing, the app reports the expected path at startup. PostgreSQL and the language toolchains are installed separately. Electron provides the cross-platform desktop foundation. The checked-in installer workflow targets macOS arm64.

## Team

| Team member | Core responsibilities |
| --- | --- |
| **[Member 1 name]** | Authentication, user sessions, problem catalog, and application navigation |
| **[Member 2 name]** | Local execution, Express execution APIs, SSE, Prisma data access, SQL analytics, and macOS packaging |
| **[Member 3 name]** | Stress-test orchestration, output diffing, counterexample persistence, and the stress workbench |

Desktop workbench design principles were informed by [unslop](https://github.com/heydamir/unslop) by Damir Sokolovsky (CC BY 4.0).
