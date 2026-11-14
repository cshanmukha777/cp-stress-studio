-- The two sides of each set operation return the same columns and types:
-- INTEGER problem ID and TEXT problem title.

-- A / UNION: problems with an accepted result or a failed/error result.
-- UNION removes duplicate (id, title) rows.
SELECT p.id, p.title
FROM public.problems AS p
WHERE EXISTS (
    SELECT 1 FROM public.submissions AS s
    WHERE s.problem_id = p.id AND s.verdict = 'AC'
)
UNION
SELECT p.id, p.title
FROM public.problems AS p
WHERE EXISTS (
    SELECT 1 FROM public.submissions AS s
    WHERE s.problem_id = p.id
      AND s.verdict IN ('WA', 'TLE', 'RE', 'CE', 'MLE', 'OLE')
)
ORDER BY id;

-- B / UNION ALL: same sets, but duplicates from both sets remain. A problem
-- having both outcomes appears twice. This can be useful when duplicates carry
-- meaning and avoids the distinct-row work performed by UNION.
SELECT p.id, p.title
FROM public.problems AS p
WHERE EXISTS (
    SELECT 1 FROM public.submissions AS s
    WHERE s.problem_id = p.id AND s.verdict = 'AC'
)
UNION ALL
SELECT p.id, p.title
FROM public.problems AS p
WHERE EXISTS (
    SELECT 1 FROM public.submissions AS s
    WHERE s.problem_id = p.id
      AND s.verdict IN ('WA', 'TLE', 'RE', 'CE', 'MLE', 'OLE')
)
ORDER BY id;

-- C / INTERSECT: problems appearing in both sets have at least one AC and at
-- least one failed/error result. INTERSECT returns distinct matching rows.
SELECT p.id, p.title
FROM public.problems AS p
WHERE EXISTS (
    SELECT 1 FROM public.submissions AS s
    WHERE s.problem_id = p.id AND s.verdict = 'AC'
)
INTERSECT
SELECT p.id, p.title
FROM public.problems AS p
WHERE EXISTS (
    SELECT 1 FROM public.submissions AS s
    WHERE s.problem_id = p.id
      AND s.verdict IN ('WA', 'TLE', 'RE', 'CE', 'MLE', 'OLE')
)
ORDER BY id;
