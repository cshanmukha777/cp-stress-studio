-- 1. Aggregate measured execution costs per problem. NULL means unmeasured.
SELECT problem_id,
       COUNT(*) AS submissions,
       COUNT(runtime_ms) AS timed_runs,
       SUM(runtime_ms) AS total_runtime_ms,
       AVG(runtime_ms) AS avg_runtime_ms,
       MIN(runtime_ms) AS min_runtime_ms,
       MAX(runtime_ms) AS max_runtime_ms,
       COUNT(memory_kib) AS measured_memory_runs,
       SUM(memory_kib) AS total_memory_kib,
       AVG(memory_kib) AS avg_memory_kib,
       MIN(memory_kib) AS min_memory_kib,
       MAX(memory_kib) AS max_memory_kib
FROM submissions
GROUP BY problem_id
ORDER BY problem_id;

-- 2. Verdict distribution for problems with at least one completed run.
SELECT problem_id,
       SUM(CASE WHEN verdict = 'AC' THEN 1 ELSE 0 END) AS ac,
       SUM(CASE WHEN verdict = 'WA' THEN 1 ELSE 0 END) AS wa,
       SUM(CASE WHEN verdict = 'TLE' THEN 1 ELSE 0 END) AS tle,
       SUM(CASE WHEN verdict = 'RE' THEN 1 ELSE 0 END) AS re,
       SUM(CASE WHEN verdict = 'CE' THEN 1 ELSE 0 END) AS ce,
       SUM(CASE WHEN verdict = 'CANCELLED' THEN 1 ELSE 0 END) AS cancelled,
       SUM(CASE WHEN verdict NOT IN ('AC', 'WA', 'TLE', 'RE', 'CE', 'CANCELLED')
                THEN 1 ELSE 0 END) AS other
FROM submissions
GROUP BY problem_id
HAVING COUNT(*) FILTER (WHERE verdict <> 'CANCELLED') > 0
ORDER BY problem_id;

-- 3a. Scalar subquery in SELECT.
SELECT p.id, p.title,
       (SELECT COUNT(*) FROM test_cases AS t WHERE t.problem_id = p.id) AS test_count
FROM problems AS p
ORDER BY p.id;

-- 3b. Derived table in FROM.
SELECT p.title, stats.avg_runtime_ms
FROM (
    SELECT problem_id, AVG(runtime_ms) AS avg_runtime_ms
    FROM submissions
    WHERE verdict = 'AC' AND runtime_ms IS NOT NULL
    GROUP BY problem_id
) AS stats
JOIN problems AS p ON p.id = stats.problem_id
ORDER BY p.id;

-- 3c. Subquery in WHERE.
SELECT id, name, problem_id
FROM solutions
WHERE id IN (SELECT solution_id FROM submissions WHERE verdict = 'AC')
ORDER BY id;

-- 4. Correlated subquery: solutions with accepted runs faster on average
-- than the accepted runs for their own problem.
SELECT s.problem_id, s.id, s.name, AVG(r.runtime_ms) AS solution_avg_ms
FROM solutions AS s
JOIN submissions AS r ON r.problem_id = s.problem_id AND r.solution_id = s.id
WHERE r.verdict = 'AC' AND r.runtime_ms IS NOT NULL
GROUP BY s.problem_id, s.id, s.name
HAVING AVG(r.runtime_ms) < (
    SELECT AVG(peer.runtime_ms)
    FROM submissions AS peer
    WHERE peer.problem_id = s.problem_id
      AND peer.verdict = 'AC'
      AND peer.runtime_ms IS NOT NULL
)
ORDER BY s.problem_id, solution_avg_ms, s.id;
