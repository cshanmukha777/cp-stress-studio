# M3 PostgreSQL SQL Demonstrations

These scripts are practical examples for the CP Editor & Automated Stress Tester database. They use PostgreSQL SQL and the application's existing table/column names.

## Read this architecture note first

The server's relational database is PostgreSQL and is accessed through Prisma. Its relevant tables are:

| Table | Useful columns | Relationship |
| --- | --- | --- |
| `public.problems` | `id`, `title`, `difficulty`, `created_by_id`, `created_at` | Created by a `users` row; parent to submissions and tags. |
| `public.submissions` | `id`, `problem_id`, `solution_id`, `verdict`, `runtime_ms`, `memory_kib`, `request`, `result`, `created_at` | Each row is one saved execution attempt for a problem. |
| `public.solutions` | `id`, `problem_id`, `name`, `language`, `code` | One problem can have many solutions. |
| `public.tags` | `id`, `name`, `parent_id`, `created_at` | Tags may have parent tags. |
| `public.problem_tags` | `problem_id`, `tag_id`, `created_at` | Join table for the many-to-many problem/tag relationship. |

**Important:** Stress history and counterexamples created by the desktop stress tester are stored in local SQLite. The PostgreSQL schema does not contain `StressRun` or `FailingCase` models/tables, and `public.submissions` does not have an iteration-count column. Therefore these SQL examples use a PostgreSQL submission as the closest existing execution record. The “failed case” date query counts failed/error **submissions** as a proxy; it does not claim to query SQLite counterexample rows. The scripts do not add or migrate application tables for those missing concepts.

## PostgreSQL setup

1. Use a local development/test PostgreSQL database with the project's Prisma migrations applied. Do not point the modifying demo scripts at production.
2. Find `DATABASE_URL` in `server/.env` or your team's development setup. Do not paste credentials into shared output.
3. Connect with `psql` using the same database URL:

   ```sh
   export DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public'
   psql "$DATABASE_URL"
   ```

   Or run one script from the repository root:

   ```sh
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f sql/member3/01_aggregate_groupby_having.sql
   ```

4. In pgAdmin or another SQL client, connect to that same development database and open the script file. The `01` through `06` files are read-only queries. `07` creates/resets only rows inside `member3_demo`. `08` through `10` use only the isolated demo schema and require the manual session coordination described below.

The app's `DATABASE_URL` is configured under `server/.env` for Prisma. These demonstrations do not alter that setting, the production schema, or Prisma migrations.

## Script index

| File | Main idea |
| --- | --- |
| `01_aggregate_groupby_having.sql` | COUNT, SUM, AVG, MIN, MAX, grouping, WHERE, HAVING |
| `02_case_statements.sql` | Verdict/runtime categories and conditional aggregation |
| `03_subqueries.sql` | Scalar, derived table, WHERE, correlated, EXISTS, NOT EXISTS |
| `04_window_functions.sql` | ROW_NUMBER, RANK, DENSE_RANK, LAG, LEAD, moving average |
| `05_union_intersect.sql` | Combine and compare sets of problems |
| `06_date_functions.sql` | DATE_TRUNC and EXTRACT over submission timestamps |
| `07_acid_transactions_savepoint.sql` | Isolated transaction, savepoint, partial and full rollback |
| `08_non_repeatable_read_session1.sql` | Session 1 reads at READ COMMITTED and REPEATABLE READ |
| `09_non_repeatable_read_session2.sql` | Session 2 updates the isolated row and commits |
| `10_reset_demo_data.sql` | Safe setup/reset of the isolated demonstration rows |

## 1. Aggregates, GROUP BY, and HAVING

**Meaning and use:** Aggregate functions summarize many rows. `COUNT` counts; `SUM` adds; `AVG` averages; `MIN` and `MAX` find boundaries. `GROUP BY` produces one summary row per group, such as one row per problem.

```sql
SELECT problem_id, COUNT(*) AS attempts, AVG(runtime_ms) AS average_ms
FROM public.submissions
GROUP BY problem_id;
```

`WHERE` filters individual rows before grouping. `HAVING` filters the groups after aggregate values are calculated. In file `01`, the example keeps groups with more than five submissions. Adjust the threshold to fit the demonstration database. `COUNT(runtime_ms)` counts only non-null runtimes; `AVG`, `SUM`, `MIN`, and `MAX` ignore NULL runtime values. `COUNT(s.id)` is used with a `LEFT JOIN` so a problem with no submissions correctly shows zero.

**Project example/output:** The first query returns one row per problem with submission count and measured runtime statistics. The total runtime is in milliseconds. There is no stress iteration total in this PostgreSQL schema.

**Viva prompts:** What does `GROUP BY` do? Why does `COUNT(column)` differ from `COUNT(*)`? When should `HAVING` be used?

**Common mistakes:** Selecting a non-aggregated column without grouping it; using `WHERE COUNT(*) ...`; treating NULL runtime as zero; calling a submission count a stress iteration count.

## 2. CASE expressions

**Meaning and use:** `CASE` returns a value according to the first matching condition, like if/else logic inside a query.

```sql
CASE WHEN verdict = 'AC' THEN 'PASSED'
     WHEN verdict = 'WA' THEN 'FAILED'
     ELSE 'OTHER' END
```

File `02` classifies the actual submission verdicts and runtime values. Runtime thresholds are explicitly in milliseconds: less than 100 is Fast, 100–999.99 is Moderate, and at least 1000 is Slow. A missing runtime is “Not measured.” Conditional aggregation uses `SUM(CASE WHEN ... THEN 1 ELSE 0 END)` to count statuses.

The application persists individual submissions with verdicts such as `AC`, `WA`, `TLE`, `RE`, `CE`, and `CANCELLED`. It does not store a partial-pass status on a PostgreSQL stress-run row, so a per-run “PARTIALLY PASSED” category cannot be derived honestly. The final query instead labels a problem's history “MIXED OUTCOMES” when it has both accepted and non-accepted submissions.

**Expected output:** One classified row per execution for the first two queries; grouped counts/categories per problem for the remaining queries.

**Viva prompts:** What happens when no `WHEN` matches? Why is `ELSE` useful? How can CASE be combined with SUM?

**Common mistakes:** Overlapping conditions in the wrong order; forgetting a NULL case; using seconds for thresholds when the column is milliseconds.

## 3. Subqueries

**Meaning and use:** A subquery is a SELECT nested inside another SQL statement. It can calculate a value or set used by the outer query.

File `03` shows: a scalar count in `SELECT`; an aggregate-derived table in `FROM`; a count comparison in `HAVING`; the latest submission per problem with a correlated subquery; and `EXISTS`/`NOT EXISTS` for problems with or without failed/error submissions.

A **non-correlated** subquery can run independently of the outer row. A **correlated** subquery refers to an outer value, such as `p.id`, so its result is tied to that problem. `EXISTS` is true when at least one matching row exists; `NOT EXISTS` is true when none do.

**Expected output:** One count per problem for the scalar query; only tested problems above the average for the comparison; latest submission(s) per problem; and problem lists based on whether failure records exist. The latest query uses both timestamp and submission ID in output; equal timestamps can produce multiple rows.

**Viva prompts:** What is a scalar subquery? How does a correlated query differ? Why can `NOT EXISTS` be safer than `NOT IN` when NULLs are possible?

**Common mistakes:** Returning multiple rows from a scalar subquery; mismatching the subquery type and comparison; forgetting the link from inner `problem_id` to outer `p.id`.

## 4. Window functions

**Meaning and use:** A window function calculates a value over related rows while keeping each original row in the output. `OVER()` defines the window. `PARTITION BY` starts a separate calculation for each problem. `ORDER BY` inside `OVER` defines the row sequence. A window frame such as `ROWS BETWEEN 2 PRECEDING AND CURRENT ROW` selects which neighboring rows participate.

File `04` numbers submissions per problem with `ROW_NUMBER`; ranks problems by failed submissions with `RANK`; compares `RANK` and `DENSE_RANK` for activity; uses `LAG`/`LEAD` to view previous/next runtime; and computes a three-row moving average.

`RANK` gives ties the same rank and leaves a gap after ties (1, 1, 3). `DENSE_RANK` gives ties the same rank but no gap (1, 1, 2). `GROUP BY` collapses each group into fewer rows; a window function keeps the submission/problem rows and appends a calculated value.

**Expected output:** The row-number, lag, lead, and moving-average queries return one row per submission. Ranking queries return one row per problem, including zero-submission problems.

**Viva prompts:** Why use PARTITION BY? What is the difference between RANK and DENSE_RANK? How does a window frame affect a moving average?

**Common mistakes:** Putting `ORDER BY` outside instead of inside `OVER` when it should define window order; forgetting a stable tie-breaker such as `id`; expecting GROUP BY and a window function to return the same number of rows.

## 5. UNION, UNION ALL, and INTERSECT

**Meaning and use:** Set operators combine the results of two SELECT statements. Each side must return the same number of columns with compatible types and the same meaning in each position.

File `05` uses two sets of `(problem id, title)`: problems with at least one `AC` submission and problems with at least one failed/error submission. `UNION` removes duplicate rows. `UNION ALL` keeps both copies when a problem appears in both sets. `INTERSECT` returns rows common to both sets.

**Expected output:** UNION lists problems with either result type once; UNION ALL can list a mixed-outcome problem twice; INTERSECT lists problems that have both types of history.

**Viva prompts:** Why can UNION ALL be faster? How does INTERSECT determine common rows? What must match between the SELECT clauses?

**Common mistakes:** Different column counts/types; assuming UNION ALL removes duplicates; placing ORDER BY inside one side without parentheses (the scripts order the final result).

## 6. DATE_TRUNC and EXTRACT

**Meaning and use:** `DATE_TRUNC` rounds a timestamp down to a calendar boundary, useful for buckets. `EXTRACT` returns one numeric part of a timestamp, such as year, month, day, or hour.

The real `submissions.created_at` column is `TIMESTAMP(3)` without time zone. File `06` groups submissions by day/month/year, extracts date parts, counts monthly failed/error submissions, filters one year with a half-open timestamp range, and groups monthly activity by problem.

**Expected output:** One row per date bucket, date component, or problem-month with counts. The failure-by-month query is only a PostgreSQL submission-verdict proxy; SQLite counterexamples are not accessible in this database.

**Viva prompts:** What does DATE_TRUNC return? How does it differ from EXTRACT? Why is `>= start AND < next_start` a useful date filter?

**Common mistakes:** Grouping by month number alone across multiple years; applying EXTRACT in a way that merges different years; treating timestamp without time zone as UTC; forgetting that time is recorded using the database/server's configured local wall-clock convention.

## 7. Transactions, SAVEPOINT, and ACID

**Meaning and use:** `BEGIN` starts a transaction. `COMMIT` makes its changes permanent. `ROLLBACK` undoes the whole open transaction. `SAVEPOINT` marks a point inside it; `ROLLBACK TO SAVEPOINT` undoes only later work.

File `07` creates `member3_demo.transaction_demo`, an isolated demo table, and resets only row 1 to balance 100. It adds 10, saves a point, adds 100, rolls back to the savepoint, and commits 110. A separate transaction adds 1000 and fully rolls back, leaving 110.

ACID: **Atomicity** means all transaction changes happen or none do. **Consistency** means constraints (here, nonnegative balance) remain true. **Isolation** controls what concurrent transactions can see. **Durability** means committed data persists.

**Expected output:** After the savepoint rollback, balance is 110; after full rollback, it remains 110.

**Viva prompts:** What is the difference between rollback and rollback to savepoint? Which ACID property is enforced by a CHECK constraint? What does COMMIT guarantee?

**Common mistakes:** Forgetting COMMIT; trying to roll back after a commit; assuming a savepoint commits anything; running the demo on production. The script touches only an isolated demo schema, but still use a development database.

## 8. Non-repeatable read in two sessions

**Meaning and use:** A non-repeatable read occurs when a transaction reads a row twice and sees different committed values on those reads. Under PostgreSQL `READ COMMITTED`, each command gets a fresh snapshot. Under `REPEATABLE READ`, a transaction keeps a consistent snapshot for its reads.

This demonstration uses `member3_demo.isolation_demo`, not an application record. `08_non_repeatable_read_session1.sql` includes table setup and Session 1 statements. `09_non_repeatable_read_session2.sql` contains the Session 2 updates. `10_reset_demo_data.sql` safely restores the value to `original`.

### READ COMMITTED execution order

1. Open two separate PostgreSQL query windows, each connected to the same development database. Do not use one shared connection.
2. Run `10_reset_demo_data.sql` once (or run the setup block at the top of the Session 1 file) in autocommit mode.
3. In Session 1, execute only `BEGIN ISOLATION LEVEL READ COMMITTED;`, then the first `SELECT`. It returns `original` and leaves the transaction open.
4. In Session 2, execute only the first update block in the Session 2 file (`BEGIN`, update to `updated-read-committed`, `COMMIT`).
5. Return to Session 1 and execute its second `SELECT`. It now returns `updated-read-committed`. Commit Session 1.

### REPEATABLE READ execution order

1. Reset the row with `10_reset_demo_data.sql` in autocommit mode.
2. In Session 1, execute `BEGIN ISOLATION LEVEL REPEATABLE READ;` and its first `SELECT`. It returns `original`.
3. While Session 1 stays open, execute the REPEATABLE READ update block in Session 2 (update to `updated-repeatable-read` and commit).
4. Return to Session 1 and execute its second `SELECT`. It still returns `original` from the transaction snapshot. Commit Session 1; a new transaction then sees the new value.

**Important:** Do not run all commands in either session file as one batch. Pause and switch query windows at the marked points. Two independent PostgreSQL sessions are essential; a single SQL file/connection cannot demonstrate the concurrency behavior.

**Viva prompts:** What is a non-repeatable read? Why does READ COMMITTED see the second session's committed update? What snapshot behavior does REPEATABLE READ provide?

**Common mistakes:** Using the same query tab/connection for both sessions; committing Session 1 before Session 2 updates; not resetting to original before the second phase; executing all statements without pausing.

## Reset and cleanup

To restore the demo rows to their starting values, execute:

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f sql/member3/10_reset_demo_data.sql
```

This reset only upserts rows in `member3_demo`; it does not drop tables, schemas, or application data. If you want to remove only these demonstration objects later, do so manually in your local development database with `DROP SCHEMA member3_demo CASCADE;`. Never run that cleanup on production.

## Evaluation walkthrough

1. State that the SQL examples use PostgreSQL tables verified from Prisma migrations: `problems`, `submissions`, `solutions`, `tags`, and `problem_tags`.
2. Run `01` and explain count/average plus WHERE versus GROUP BY versus HAVING.
3. Run `02` to classify real verdicts and show conditional aggregation.
4. Run `03`, then compare the correlated latest-submission query with EXISTS/NOT EXISTS.
5. Run `04` and point out one row per submission, ranks/ties, LAG/LEAD, and the moving window.
6. Run `05` and explain why a problem with both accepted and failed outcomes appears twice in UNION ALL but once in UNION.
7. Run `06` to show timestamp buckets and date-part extraction.
8. Run `07` and observe the savepoint result (110) and full rollback result (still 110).
9. In two query windows, perform the READ COMMITTED and REPEATABLE READ steps in order and explain the two observed snapshots.
10. Close by clarifying that PostgreSQL stores submissions while desktop stress-run/counterexample history remains in SQLite; no fake StressRun or FailingCase SQL table was assumed.

## Verification status

The SQL column names and relationships were checked against `server/prisma/schema.prisma` and the Prisma migrations. PostgreSQL-specific syntax is used intentionally. If PostgreSQL/`psql` is not available in the current environment, these files have been reviewed against the schema but have not been live-executed; do not describe them as execution-tested until run against a safe development database.
