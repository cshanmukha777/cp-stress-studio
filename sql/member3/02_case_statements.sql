-- CASE works with the application's actual submissions.verdict and runtime_ms.
-- Verdict values are text; the runner uses AC, WA, TLE, RE, CE, CANCELLED.

-- Classify each persisted execution. The PostgreSQL submission row is not a
-- multi-iteration StressRun, so PARTIALLY PASSED cannot be inferred per row.
SELECT s.id AS submission_id, p.title AS problem_name, s.verdict,
       CASE
         WHEN s.verdict = 'AC' THEN 'PASSED'
         WHEN s.verdict = 'WA' THEN 'FAILED'
         WHEN s.verdict IN ('TLE', 'RE', 'CE', 'MLE', 'OLE') THEN 'ERROR'
         WHEN s.verdict = 'CANCELLED' THEN 'CANCELLED'
         ELSE 'OTHER / UNKNOWN'
       END AS verdict_category,
       s.created_at
FROM public.submissions AS s
JOIN public.problems AS p ON p.id = s.problem_id
ORDER BY s.created_at DESC, s.id DESC;

-- runtime_ms is milliseconds. These example thresholds are easy to interpret:
-- under 100 ms = Fast; 100-999.99 ms = Moderate; 1000 ms or more = Slow.
-- A NULL runtime is explicitly shown as Not measured.
SELECT id AS submission_id, runtime_ms,
       CASE
         WHEN runtime_ms IS NULL THEN 'Not measured'
         WHEN runtime_ms < 100 THEN 'Fast'
         WHEN runtime_ms < 1000 THEN 'Moderate'
         ELSE 'Slow'
       END AS runtime_category
FROM public.submissions
ORDER BY id;

-- Conditional aggregation: count outcomes per problem with CASE inside SUM.
SELECT p.id, p.title,
       SUM(CASE WHEN s.verdict = 'AC' THEN 1 ELSE 0 END) AS passed_submissions,
       SUM(CASE WHEN s.verdict = 'WA' THEN 1 ELSE 0 END) AS wrong_answer_submissions,
       SUM(CASE WHEN s.verdict IN ('TLE', 'RE', 'CE', 'MLE', 'OLE') THEN 1 ELSE 0 END) AS error_submissions
FROM public.problems AS p
LEFT JOIN public.submissions AS s ON s.problem_id = p.id
GROUP BY p.id, p.title
ORDER BY p.id;

-- Classify problem activity from actual submission counts and verdicts.
-- "Mixed outcomes" describes history for a problem, not partial completion
-- of one stress run.
SELECT p.id, p.title,
       COUNT(s.id) AS submission_count,
       CASE
         WHEN COUNT(s.id) = 0 THEN 'NOT TESTED'
         WHEN COUNT(*) FILTER (WHERE s.verdict = 'AC') > 0
          AND COUNT(*) FILTER (WHERE s.verdict <> 'AC') > 0 THEN 'MIXED OUTCOMES'
         WHEN COUNT(*) FILTER (WHERE s.verdict = 'AC') > 0 THEN 'ALL RECORDED RUNS PASSED'
         ELSE 'NO ACCEPTED RUNS'
       END AS activity_category
FROM public.problems AS p
LEFT JOIN public.submissions AS s ON s.problem_id = p.id
GROUP BY p.id, p.title
ORDER BY p.id;
