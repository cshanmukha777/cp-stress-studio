-- PostgreSQL demonstration using the application's real public.problems and
-- public.submissions tables. A submission is one persisted execution attempt.
-- Stress runs/iterations are kept in desktop SQLite, not this PostgreSQL DB.

-- COUNT, SUM, AVG, MIN, MAX grouped by problem. LEFT JOIN keeps problems
-- without any submissions in the output. SUM/AVG/MIN/MAX ignore NULL runtimes.
SELECT p.id AS problem_id,
       p.title AS problem_name,
       COUNT(s.id) AS submission_count,
       COUNT(s.runtime_ms) AS timed_submission_count,
       SUM(s.runtime_ms) AS total_runtime_ms,
       AVG(s.runtime_ms) AS average_runtime_ms,
       MIN(s.runtime_ms) AS fastest_runtime_ms,
       MAX(s.runtime_ms) AS slowest_runtime_ms
FROM public.problems AS p
LEFT JOIN public.submissions AS s ON s.problem_id = p.id
GROUP BY p.id, p.title
ORDER BY submission_count DESC, p.id;

-- COUNT submissions for every problem (including zero-submission problems).
SELECT p.id, p.title, COUNT(s.id) AS submission_count
FROM public.problems AS p
LEFT JOIN public.submissions AS s ON s.problem_id = p.id
GROUP BY p.id, p.title
ORDER BY p.id;

-- Total recorded execution time per problem, in milliseconds. This is not a
-- test-iteration total: submissions has no iteration-count column.
SELECT p.id, p.title,
       COUNT(s.id) AS submission_count,
       SUM(s.runtime_ms) AS total_measured_runtime_ms
FROM public.problems AS p
LEFT JOIN public.submissions AS s ON s.problem_id = p.id
GROUP BY p.id, p.title
ORDER BY p.id;

-- Average runtime per problem. COUNT(runtime_ms) shows how many values exist;
-- cancelled/compile failures can have NULL runtime and are not treated as 0.
SELECT p.id, p.title,
       AVG(s.runtime_ms) AS average_runtime_ms,
       COUNT(s.runtime_ms) AS measured_runtime_count
FROM public.problems AS p
LEFT JOIN public.submissions AS s ON s.problem_id = p.id
GROUP BY p.id, p.title
ORDER BY average_runtime_ms NULLS LAST, p.id;

-- Fastest and slowest measured individual submission for each problem.
SELECT p.id, p.title,
       MIN(s.runtime_ms) AS fastest_runtime_ms,
       MAX(s.runtime_ms) AS slowest_runtime_ms
FROM public.problems AS p
LEFT JOIN public.submissions AS s ON s.problem_id = p.id
GROUP BY p.id, p.title
ORDER BY p.id;

-- WHERE filters input rows before grouping; HAVING filters groups afterward.
-- Change 5 to the threshold you want to demonstrate.
SELECT p.id, p.title, COUNT(s.id) AS submission_count
FROM public.problems AS p
JOIN public.submissions AS s ON s.problem_id = p.id
WHERE s.verdict <> 'CANCELLED'
GROUP BY p.id, p.title
HAVING COUNT(s.id) > 5
ORDER BY submission_count DESC, p.id;

-- Expected output: one row per problem for the first queries; the HAVING
-- query returns only problems with more than five non-cancelled submissions.
