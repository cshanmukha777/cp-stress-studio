# M3 Analytics Dashboard Guide

## What the dashboard does

The Analytics tab summarizes saved stress runs and counterexamples from this desktop installation. It joins those local results to the existing problems and tags so you can compare performance by problem or tag. The dashboard does not create another copy of stress records.

## Where the data lives

Stress run history and counterexamples are persisted in the app's local SQLite `records` table. Problems, tags, and `ProblemTag` relationships are in the existing PostgreSQL database accessed with Prisma. Electron's trusted IPC bridge returns compact SQLite aggregates. The authenticated `GET /api/analytics/catalog` endpoint returns problem and tag IDs and their existing links from PostgreSQL; the React dashboard joins both responses using problem IDs.

This split reflects the current application: there are no Prisma `StressRun` or `FailingCase` models. Creating them here would duplicate the existing local history. As a result, stress analytics are available in the desktop app that owns that SQLite history.

## Statistics and aggregation

- Stress runs count saved history records with `mode = stress`.
- Test cases, passed cases, and failed cases sum the iteration counts saved on each run.
- Overall pass rate is passed iterations divided by total iterations. With no iterations it is zero.
- Failing cases count persisted counterexample records whose parent run is included in the selected range.
- Problems tested count distinct non-null problem IDs with runs.
- Average execution time averages the saved whole-run `executionTime` values that exist. The trend and problem tables use saved `averageRuntime` values; missing runtimes are omitted.
- Verdict groups classify `AC` as passed, `WA` as failed, `RE`, `TLE`, `CE`, `MLE`, and `OLE` as errors, and other statuses separately.

Aggregation means reducing many saved rows to summary values. `COUNT` counts rows; `SUM` adds iteration totals; `AVG` averages available runtime measurements; grouping by date, problem, or verdict organizes these calculations. SQLite JSON extraction reads fields from the app's existing JSON records, with the selected date range applied to record creation timestamps. No missing value is filled in with an estimate.

Tag-level values sum the real run aggregates for problems connected to each tag through `ProblemTag`. A problem linked to multiple tags contributes to each linked tag. Tags with no runs still appear with zero run totals. Click a tag name to filter the problem table to linked problems.

## Important files

- `electron/database/db.js`: read-only `getAnalytics(range)` aggregation over persisted SQLite records.
- `electron/ipc.js`, `electron/preload.js`: trusted renderer bridge for local analytics.
- `server/src/routes/analytics.routes.js`: authenticated Prisma query for catalog problem/tag links.
- `src/catalog/AnalyticsPage.jsx`: date filter, cards, charts, problem and tag tables, and failing-case detail/export.
- `src/catalog/CatalogPanel.jsx`: Analytics navigation tab.
- `src/catalog/catalog.css`: responsive dashboard styles.
- `tests/db.test.cjs`: aggregation, date-range, verdict, and empty/error behavior coverage.

## API and data examples

The metadata endpoint requires the same bearer token as the other catalog APIs:

```sh
curl http://localhost:4000/api/analytics/catalog \
  -H 'Authorization: Bearer YOUR_TOKEN'
```

It returns the existing records in this compact shape (IDs and names vary with your database):

```json
{
  "problems": [{ "id": 12, "title": "Example", "slug": "example", "difficulty": 1200, "tagIds": [3] }],
  "tags": [{ "id": 3, "name": "Arrays", "problemIds": ["12"] }]
}
```

Local stress aggregates are requested through `window.electronAPI.stressAnalytics("7d")` (also `"30d"`, `"90d"`, or `"all"`), rather than a REST route, because the run records reside in desktop SQLite. The response contains `overview`, `verdicts`, `runsOverTime`, `executionTimeTrends`, `problemStats`, `failingCasesByProblem`, `failureReasons`, and `recentFailingCases`. For example, an empty local history returns zero counts, an empty list for grouped data, and `null` when no runtime measurement exists.

## Run and test

Start the API server and desktop application using the project's existing setup. From the repository root:

```sh
npm run dev
```

Run the checks:

```sh
npm test
npm run lint
npm run build
```

Sign in, open **Analytics**, select a time range, and use **Refresh** after running a new stress test. To demonstrate tags, associate tags with problems in the Tags page, then return to Analytics and select a tag. To demonstrate a counterexample, run a stress test that produces a failure, refresh Analytics, open a recent case, inspect its inputs and outputs, and use **Export .txt**.

## M3 evaluation walkthrough

1. Start PostgreSQL and the API, then launch the desktop app and sign in.
2. Open the Tags page and show existing problem/tag associations.
3. Run a stress test for a linked problem, then open Analytics and select **7 days**.
4. Explain the cards: run and iteration counts are sums/counts from saved SQLite records; pass rate is passed iterations divided by total iterations.
5. Point out the run verdict grouping and runs-over-time chart, both filtered by the chosen range.
6. Search or sort the problem table, then choose a tag to see the statistics for its linked problems.
7. Open a recent failing case to inspect persisted details and export the existing record.
8. Run another stress test and press **Refresh** to show the updated values.

## Current limits

The dashboard is available in Electron because its stress history is local to the desktop app. A run without a problem ID is included in overall metrics but cannot be assigned to problem or tag analytics. Opening a problem in a separate problem page is not wired because the catalog currently has no dashboard-to-problem navigation target. Tag statistics are duplicated per tag when a problem has multiple tags, by design. The current UI lists the complete recent-failure set only up to 20 records and the top 10 reason groups.
