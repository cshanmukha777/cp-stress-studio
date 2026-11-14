-- Subquery examples using the actual problems, submissions, and verdict fields.

-- A. Scalar subquery in SELECT: one count for each problem.
SELECT p.id, p.title,
       (SELECT COUNT(*) FROM public.submissions AS s WHERE s.problem_id = p.id) AS submission_count
FROM public.problems AS p
ORDER BY p.id;

-- B. Subquery in FROM: aggregate first, then join the derived table to problems.
SELECT p.id, p.title, stats.submission_count, stats.avg_runtime_ms, stats.failed_count
FROM (
    SELECT problem_id,
           COUNT(*) AS submission_count,
           AVG(runtime_ms) AS avg_runtime_ms,
           COUNT(*) FILTER (WHERE verdict IN ('WA', 'TLE', 'RE', 'CE', 'MLE', 'OLE')) AS failed_count
    FROM public.submissions
    GROUP BY problem_id
) AS stats
JOIN public.problems AS p ON p.id = stats.problem_id
ORDER BY stats.submission_count DESC, p.id;

-- C. Find tested problems whose submission count exceeds the average count
-- across tested problems. The inner result has one count per problem.
SELECT p.id, p.title, COUNT(s.id) AS submission_count
FROM public.problems AS p
JOIN public.submissions AS s ON s.problem_id = p.id
GROUP BY p.id, p.title
HAVING COUNT(s.id) > (
    SELECT AVG(problem_counts.submission_count)
    FROM (
        SELECT problem_id, COUNT(*) AS submission_count
        FROM public.submissions
        GROUP BY problem_id
    ) AS problem_counts
)
ORDER BY submission_count DESC, p.id;

-- D. Correlated subquery: return the most recently created submission for
-- each problem that has submissions. The inner query uses the outer p.id.
SELECT p.id, p.title, s.id AS latest_submission_id, s.verdict, s.runtime_ms, s.created_at
FROM public.problems AS p
JOIN public.submissions AS s ON s.problem_id = p.id
WHERE s.id = (
    SELECT s2.id
    FROM public.submissions AS s2
    WHERE s2.problem_id = p.id
    ORDER BY s2.created_at DESC, s2.id DESC
    LIMIT 1
)
ORDER BY p.id;

-- E. EXISTS: problems with at least one recorded failed/error submission.
SELECT p.id, p.title
FROM public.problems AS p
WHERE EXISTS (
    SELECT 1 FROM public.submissions AS s
    WHERE s.problem_id = p.id
      AND s.verdict IN ('WA', 'TLE', 'RE', 'CE', 'MLE', 'OLE')
)
ORDER BY p.id;

-- F. NOT EXISTS: problems with no recorded failed/error submission.
-- This includes problems with no submissions yet; add an EXISTS for any
-- submission if you want only tested problems with no failures.
SELECT p.id, p.title
FROM public.problems AS p
WHERE NOT EXISTS (
    SELECT 1 FROM public.submissions AS s
    WHERE s.problem_id = p.id
      AND s.verdict IN ('WA', 'TLE', 'RE', 'CE', 'MLE', 'OLE')
)
ORDER BY p.id;

-- A non-correlated subquery can be evaluated independently of the outer row.
-- A correlated subquery refers to a value from the current outer row (p.id).
