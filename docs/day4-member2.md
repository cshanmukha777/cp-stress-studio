# Day 4 Member 2 execution workbench

The Electron single-run workbench sends submissions to the local Express server. PostgreSQL stores the problem's solutions, test cases, and submissions. The legacy SQLite drawer remains available for existing local workspaces, history, and stress records.

## Local setup

1. Install Node.js 24, PostgreSQL, and the compilers or interpreters you intend to use: `g++`, `python3`, and a Java JDK.
2. From `server/`, run `npm ci`. Copy `.env.example` to `.env` and configure `DATABASE_URL` and `JWT_SECRET` for your local development database.
3. From `server/`, run `npx prisma migrate deploy`, `npx prisma generate`, and `npm start`. The default listener is loopback on port 4000.
4. From the root, run `npm ci` and `npm run dev`. Sign in through **Account & Problems**.
5. Enter the ID of an existing problem you own, or sign in with the existing admin account. The shared catalog API at `GET /api/problems` returns problem IDs. Use **Problem records** to save or load a solution or case, then click **Run** and refresh the records to review the submission.

A saved case uses its expected output on the server. A custom case uses the editor's input and optionally compares against the expected output field. Editing a loaded solution or case returns the editor to custom input. The server accepts execution only from loopback clients. Programs run with the server process's OS permissions, so use trusted local source.

## Implementation map

| Requirement | Location |
| --- | --- |
| Solution, weak TestCase, Submission | `server/prisma/schema.prisma` and `server/prisma/migrations/20261111090000_member2_execution/` |
| Nested Prisma query with select and omit | `getProblemExecution` in `server/src/db/member2.js` |
| Aggregates, verdict grouping, three subquery placements, correlated runtime comparison | Sections 1–4 of `sql/member2_queries.sql` |
| Evaluator access | `sql/member2_evaluator.sql` |
| Execution and CRUD | `server/src/routes/execution.routes.js` |
| EventEmitter updates | `server/src/services/executionEmitter.js` |

All execution API routes are under `/api/execution/problems/:problemId` and use the shared bearer-token middleware. Records are scoped to the problem owner or an administrator.

| Route suffix | Methods |
| --- | --- |
| `/` | GET nested execution records |
| `/solutions`, `/test-cases` | GET list, POST create |
| `/solutions/:id`, `/test-cases/:caseNumber` | GET, PATCH, DELETE |
| `/submissions` | GET history, POST execute and persist |
| `/submissions/:id` | GET stored submission |

The submission POST streams `status`, `output`, and `result` events over HTTP. Closing the stream requests cancellation. Test cases use the composite key `(problemId, caseNumber)`. A submission can reference a saved solution, or store a standalone run. Runtime is measured in milliseconds and sampled RSS in KiB. Unavailable measurements are SQL NULL.

Run the analytics against the migrated database with `psql -v ON_ERROR_STOP=1 -f sql/member2_queries.sql`. Apply the evaluator script as an authorized database administrator. Assign the NOLOGIN role to a dedicated login without other write privileges for the demo.

## Implementation checks

Prisma formatting, validation, and client generation passed. The Express app imported successfully. Lint and build passed. The root suite passed 25 tests and skipped two JDK-dependent tests. Three Electron tests passed, including two using an intercepted submission API. Live PostgreSQL migrations, analytics, and evaluator permissions still need verification against a running PostgreSQL instance.
