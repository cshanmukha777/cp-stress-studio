# M3 Guide: Stress Tester, Output Diff, and Saved Runs

This guide describes the M3 stress testing features in CP Stress Studio. Stress testing executes code on the user's desktop through the existing Electron execution runner. It is intended for code the user trusts; temporary work folders are not an operating-system security sandbox.

## How a stress test works

1. Open the **Stress test** tab and optionally enter a Problem ID.
2. Write a generator, brute-force reference, and optimal solution. Each editor can use C++17, Python 3, or Java.
3. Set the iteration count (1–10,000), a per-process time limit (50–30,000 ms), and optionally a random seed.
4. Keep **Stop on first failure** enabled to stop at the first counterexample, or turn it off to continue through the requested iterations.
5. Start the run. The generator executes first. Its exact stdout is sent to both solutions as stdin. The app prepares/compiles each program once and reuses it for the loop.
6. Progress reports the current iteration, passed/failed counts, and execution status. Stop or Escape cancels the current process safely.

The brute-force program is a reference because it is usually simpler to reason about, even if it is too slow for the largest constraints. The optimal program is the implementation being checked. A generator should create small valid random cases so the reference solution can solve them quickly.

## Seeds and reproduction

Leave Random seed blank to have the app choose and save a 32-bit seed. Enter a value from `0` through `4294967295` to select one explicitly. On iteration *i*, the generator receives `CP_STRESS_SEED = (base seed + i - 1) mod 2^32`. A generator must use that environment variable to make its random choices repeatable.

Python example:

```python
import os
import random

random.seed(int(os.environ["CP_STRESS_SEED"]))
n = random.randint(1, 8)
print(n)
print(*[random.randint(-20, 20) for _ in range(n)])
```

If a run finds a failure, its exact generated input and the source snapshot are saved. Open the counterexample record or use **Open in single run** to inspect it again.

## Output comparison

`electron/execution/diff.js` keeps output comparison independent of React. It splits stdout into whitespace-separated tokens, so leading/trailing whitespace and spaces/newlines between tokens are ignored. Token spelling and order remain significant. It detects a changed, missing, or extra token and reports the first one using a 1-based position. Empty output is compared as zero tokens. A reference/optimal timeout or runtime failure fails the comparison without treating partial output as a pass.

Example: expected `10 20 30` and actual `10 25 30` differ at token 2 (`20` vs `25`). The stress panel shows both outputs, highlights different tokens, and includes the exact input and execution diagnostics.

## Saved StressRuns and FailingCases

The desktop app stores records in SQLite at `app.getPath('userData')/studio.sqlite`, with WAL enabled. It uses the existing `history` and `counterexamples` record collections rather than duplicating Problem or User tables. A stress history record contains the problem ID when supplied, total/passed/failed iterations, verdict, execution/average/maximum runtime, chosen seed, editor source snapshot, and the complete result. Each failing-case record points to its parent run ID and stores the exact generated input, expected/actual output, reason, verdict, iteration, and source request snapshot. Stress-run and failing-case writes are transactional; deleting a run removes its linked failing cases, and new failing cases cannot be saved without a parent run.

The run and its counterexamples are inserted in one SQLite transaction. If persistence fails, the execution result is still returned with a `persistenceError` message; the database rolls back the partial save. Saved records are available from **Saved records**. Open a history row to restore that run. Select **Export .txt** on a failing case to choose a location in the native save dialog and write its input/output details.

## Important implementation files

- `electron/execution/stress.js`: seeded generator execution, compile-once loop, progress, comparison, failure capture, and cancellation.
- `electron/execution/diff.js`: reusable token normalization and structured comparison helpers.
- `electron/execution/runner.js` and `electron/execution/process.js`: existing compilation, process supervision, timeout, stdout/stderr capture, and cancellation.
- `electron/database/db.js`: existing SQLite persistence plus transactional stress-run/counterexample writes.
- `electron/ipc.js` and `electron/preload.js`: trusted renderer bridge, progress events, cancellation, and database access.
- `src/components/StressWorkbench.jsx`: editors, progress, first mismatch, output diff, and diagnostic display.
- `src/components/RecordsDrawer.jsx` and `src/App.jsx`: saved history/counterexamples, loading, export, and controls.
- `tests/diff.test.cjs`, `tests/stress.test.cjs`, `tests/db.test.cjs`: comparison, orchestration, and persistence tests.

## API and app commands

This is a local Electron app, not a hosted stress-testing service. It follows the existing validated Electron IPC API rather than adding REST endpoints that would execute arbitrary desktop code through the separate catalog server:

- `stress:start` starts a stress run and returns its final result.
- `stress:progress` streams progress for the active run.
- `execution:cancel` cancels the run owned by that renderer window.
- `db:list` and `db:get` read saved history/counterexamples; `db:save` and `db:delete` manage existing record collections.

Install Node.js 24 LTS and any toolchains used by the source (g++, Python 3, and/or JDK), then run:

```sh
npm ci
npm run dev
```

To build and launch the desktop app:

```sh
npm run build
npm start
```

To run checks:

```sh
npm test
npm run lint
npm run test:desktop
```

`npm test` requires Python for Python execution cases. The desktop suite builds the renderer and launches Electron with an isolated test database.

## Sample evaluation walkthrough

1. Select Stress test. Set the iteration count to `5`, seed to `42`, and leave Stop on first failure enabled.
2. Use the Python generator above (or this smaller generator):

   ```python
   import os
   print(int(os.environ["CP_STRESS_SEED"]) % 5 + 1)
   ```

3. Set the reference to `n = int(input()); print(n * 2)` and the optimal source to `n = int(input()); print(n * 2 + 1)`, using Python in each editor.
4. Start the run. It should fail on iteration 1. Expected and actual differ at token 1, and the input shown is exactly the generator's stdout.
5. Open **Saved records → History** and open the saved stress run. Then open **Counterexamples** and export its failing case as `.txt`.
6. Return to the test, change optimal to `n = int(input()); print(n * 2)`, set Stop on first failure off, and run all five iterations. Verify all pass and that the seed is retained in history.

Use the Mismatch example if a deterministic display check is needed: expected `10 20 30`, actual `10 25 30`; the viewer identifies token 2.

## Current boundary

The app cannot determine whether arbitrary generated text satisfies a problem's input grammar or constraints. A generator that exits successfully but emits malformed input is detected only when a solution rejects/fails on it. The user-supplied generator must enforce problem-specific validity. The app enforces source, input, output, execution-time, and iteration limits described in the README.
