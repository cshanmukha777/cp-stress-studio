# CP Stress Studio | Member 2 Viva defense

## Execution architecture

- [Process supervisor](../electron/execution/process.js#L20) uses `child_process.spawn` with an executable, separate arguments, and piped stdin, stdout, and stderr. The runner can read output as the child writes it and cap output at 1 MiB. `exec` uses a shell and buffers output for its callback up to `maxBuffer`. Direct arguments avoid shell parsing of execution arguments.
- [Timeout and process cleanup](../electron/execution/process.js#L4) are independent of the output limit. An infinite loop can produce zero bytes, so the wall-clock timer terminates the process group on POSIX or uses `taskkill` on Windows and records TLE. User cancellation also terminates the run. The optional Member 2 RSS ceiling compares samples on macOS and Linux. It measures the main child, so it can miss short spikes or memory in descendants.
- [Runner phases](../electron/execution/runner.js#L26) compile C++ and Java in a temporary workspace and then run the program. Python enters the run phase directly. The runner cleans up the temporary files and returns a structured result even when the child exits with a signal.

## Real-time execution data

- [Submission endpoint](../server/src/routes/execution.routes.js#L104) accepts an authenticated POST. It flushes the SSE response headers, invokes the runner, and emits build/run status, stdout/stderr chunks, sampled elapsed time and peak RSS, and a terminal result.
- [EventEmitter bridge](../server/src/services/executionEmitter.js#L3) converts each Node `update` event into an SSE frame with an event name and a JSON payload. The response close handler signals the runner's AbortController.
- [Stream parser](../src/catalog/execution.js#L14) uses `fetch` because this endpoint needs both a POST body and a bearer header. It parses SSE frames, cancels the reader after the terminal event or an error, and shares an AbortSignal with the hook. [Hook](../src/hooks/useExecution.js#L3) updates React state. [Execution console](../src/components/Result.jsx#L1) renders status, metrics, verdict, and errors.
- [Database limits](../server/src/db/member2.js#L3) set a transaction-local 1.5 s lock timeout and 2.5 s statement timeout for submission reads and writes. These transactions do not cover the actual program run. Before SSE starts, recognized contention returns HTTP 503. If saving fails after execution, the terminal frame retains the verdict and output and adds a save warning. An HTTP 401 clears only the rejected token and asks the user to sign in again.

## SQL analytics and permissions

- [Correlated runtime query](../sql/member2_queries.sql#L58) groups measured AC submissions by saved solution and calculates that solution's average. The inner query uses the outer solution's `problem_id` to compute the baseline from all measured AC submissions for that same problem. The outer `HAVING` keeps solutions whose mean is strictly lower. The baseline is weighted by run count and includes the candidate's own runs and standalone runs. NULL runtimes are excluded.
- In a fresh Day 5 fixture, Fast averages 15 ms and Reference averages 75 ms. The four accepted measurements yield a 45 ms problem average, so Fast qualifies. For checked-answer analytics, use saved test cases or enable expected-output comparison. An unchecked run can record AC after exiting successfully.
- [Evaluator DCL](../sql/member2_evaluator.sql#L4) creates a NOLOGIN group role if missing. `REVOKE ALL PRIVILEGES` clears its direct grants on the four tables. `GRANT USAGE` permits access through the public schema, and `GRANT SELECT` gives table reads. Assign this role to a dedicated login separately. Effective read-only access also depends on the login's other memberships and grants to PUBLIC.

## Prisma field projections

- [Nested projection](../server/src/db/member2.js#L19) uses `select` for the problem ID/title and the solution ID/name/language/code. These fields support choosing a problem and loading a saved solution into the editor.
- [Test case projection](../server/src/db/member2.js#L31) uses `omit: { expected: true }` so the normal records payload can show inputs while the server retains the expected output for judging. The Member 2 create/update projections and test case detail response also exclude expected output.
- [Submission list projection](../server/src/db/member2.js#L65) omits request and result JSON to keep list responses small. The scoped detail endpoint returns the snapshots when the user opens a submission.

## Demo commands

From an existing clone:

```sh
git fetch origin chore/day6-member2-polish
git switch --track origin/chore/day6-member2-polish
npm ci
npm --prefix server ci
```

Set `DATABASE_URL` and `JWT_SECRET` in `server/.env` or export them in the shell. Use a local PostgreSQL database and Node.js 24. An optional `PORT` defaults to 4000.

```sh
(cd server && npx prisma migrate deploy && npx prisma generate)
npm run viva:member2
```

The launcher starts Express, waits for `/api/health` to confirm the database responds, then opens Vite and Electron. The same command works on macOS, Linux, and Windows through npm. macOS and Linux can also use `sh scripts/viva_demo.sh`. Use Ctrl+C to stop the demo. Sign in, choose a problem you own or administer, and run a submission with a saved test case.
