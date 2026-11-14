-- PostgreSQL public.submissions.created_at is TIMESTAMP(3), without time zone.
-- PostgreSQL date/time functions below therefore use its stored wall-clock time.

-- A / DATE_TRUNC day, month, and year buckets. COUNT(*) counts persisted
-- submissions (execution attempts), not stress iterations.
SELECT DATE_TRUNC('day', created_at) AS day_bucket, COUNT(*) AS submissions
FROM public.submissions
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY day_bucket;

SELECT DATE_TRUNC('month', created_at) AS month_bucket, COUNT(*) AS submissions
FROM public.submissions
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month_bucket;

SELECT DATE_TRUNC('year', created_at) AS year_bucket, COUNT(*) AS submissions
FROM public.submissions
GROUP BY DATE_TRUNC('year', created_at)
ORDER BY year_bucket;

-- B / EXTRACT date parts from the actual timestamp column.
SELECT id AS submission_id,
       EXTRACT(YEAR FROM created_at) AS year,
       EXTRACT(MONTH FROM created_at) AS month,
       EXTRACT(DAY FROM created_at) AS day,
       EXTRACT(HOUR FROM created_at) AS hour
FROM public.submissions
ORDER BY created_at, id;

-- C1 / Number of recorded submissions by day.
SELECT DATE_TRUNC('day', created_at)::date AS submission_day, COUNT(*) AS submission_count
FROM public.submissions
GROUP BY DATE_TRUNC('day', created_at)::date
ORDER BY submission_day;

-- C2 / Number of recorded submissions by month.
SELECT DATE_TRUNC('month', created_at)::date AS submission_month, COUNT(*) AS submission_count
FROM public.submissions
GROUP BY DATE_TRUNC('month', created_at)::date
ORDER BY submission_month;

-- C3 / Failing-case proxy by month. There is no PostgreSQL failing_cases table;
-- count failed/error submissions (WA/TLE/RE/CE/MLE/OLE) instead.
SELECT DATE_TRUNC('month', created_at)::date AS failure_month,
       COUNT(*) AS failed_submission_count
FROM public.submissions
WHERE verdict IN ('WA', 'TLE', 'RE', 'CE', 'MLE', 'OLE')
GROUP BY DATE_TRUNC('month', created_at)::date
ORDER BY failure_month;

-- C4 / Current calendar year. The half-open range is timestamp-friendly and
-- does not apply a function to every created_at value in the WHERE clause.
SELECT id, problem_id, verdict, created_at
FROM public.submissions
WHERE created_at >= DATE_TRUNC('year', CURRENT_DATE)::timestamp
  AND created_at <  DATE_TRUNC('year', CURRENT_DATE)::timestamp + INTERVAL '1 year'
ORDER BY created_at, id;

-- C5 / Monthly activity by problem.
SELECT p.id, p.title, DATE_TRUNC('month', s.created_at)::date AS month,
       COUNT(s.id) AS submission_count,
       COUNT(*) FILTER (WHERE s.verdict = 'AC') AS accepted_count
FROM public.problems AS p
JOIN public.submissions AS s ON s.problem_id = p.id
GROUP BY p.id, p.title, DATE_TRUNC('month', s.created_at)::date
ORDER BY month, p.id;

-- DATE_TRUNC returns a timestamp aligned to a chosen boundary (such as the
-- first instant of a month). EXTRACT returns a numeric component such as 2025.
