-- Window functions retain individual rows while calculating related values.

-- A / PARTITION BY: number submissions chronologically within each problem.
SELECT s.problem_id, p.title, s.id AS submission_id, s.verdict, s.created_at,
       ROW_NUMBER() OVER (
           PARTITION BY s.problem_id ORDER BY s.created_at, s.id
       ) AS run_number_for_problem
FROM public.submissions AS s
JOIN public.problems AS p ON p.id = s.problem_id
ORDER BY s.problem_id, s.created_at, s.id;

-- B / RANK: rank problems by total failed submissions. Ties share a rank;
-- the next rank has a gap (for example 1, 1, 3).
WITH failure_counts AS (
    SELECT p.id AS problem_id, p.title,
           COUNT(s.id) FILTER (WHERE s.verdict IN ('WA', 'TLE', 'RE', 'CE', 'MLE', 'OLE')) AS failed_submissions
    FROM public.problems AS p
    LEFT JOIN public.submissions AS s ON s.problem_id = p.id
    GROUP BY p.id, p.title
)
SELECT problem_id, title, failed_submissions,
       RANK() OVER (ORDER BY failed_submissions DESC) AS failure_rank
FROM failure_counts
ORDER BY failure_rank, problem_id;

-- C / DENSE_RANK: rank problems by submission activity. Ties share a rank,
-- but the following rank has no gap (for example 1, 1, 2).
WITH activity AS (
    SELECT p.id AS problem_id, p.title, COUNT(s.id) AS submission_count
    FROM public.problems AS p
    LEFT JOIN public.submissions AS s ON s.problem_id = p.id
    GROUP BY p.id, p.title
)
SELECT problem_id, title, submission_count,
       RANK() OVER (ORDER BY submission_count DESC) AS activity_rank,
       DENSE_RANK() OVER (ORDER BY submission_count DESC) AS dense_activity_rank
FROM activity
ORDER BY submission_count DESC, problem_id;

-- E / LAG and F / LEAD: compare measured runtime with the previous/next
-- chronological submission for the same problem. NULL means no neighbor or
-- that a runtime value was unavailable.
SELECT problem_id, id AS submission_id, created_at, runtime_ms,
       LAG(runtime_ms) OVER (PARTITION BY problem_id ORDER BY created_at, id) AS previous_runtime_ms,
       LEAD(runtime_ms) OVER (PARTITION BY problem_id ORDER BY created_at, id) AS next_runtime_ms
FROM public.submissions
ORDER BY problem_id, created_at, id;

-- G / Moving average: current submission plus up to its two prior submissions
-- for that problem. NULL runtimes are ignored by AVG; no values are invented.
SELECT problem_id, id AS submission_id, created_at, runtime_ms,
       AVG(runtime_ms) OVER (
           PARTITION BY problem_id
           ORDER BY created_at, id
           ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
       ) AS moving_average_runtime_ms
FROM public.submissions
ORDER BY problem_id, created_at, id;

-- OVER defines a window; PARTITION BY restarts calculation for each problem;
-- ORDER BY inside OVER defines row sequence. GROUP BY collapses rows, while
-- window functions keep them. The ROWS frame above chooses the moving window.
-- Expected output: one row per submission, plus its window-calculated values.
