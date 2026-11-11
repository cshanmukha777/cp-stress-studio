-- Run as the database owner or an authorized administrator after migration.
-- Grant membership to a dedicated login separately.
BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'member2_evaluator') THEN
        CREATE ROLE member2_evaluator NOLOGIN;
    END IF;
END
$$;

REVOKE ALL PRIVILEGES ON TABLE
    public.problems, public.solutions, public.test_cases, public.submissions
FROM member2_evaluator;

GRANT USAGE ON SCHEMA public TO member2_evaluator;

GRANT SELECT ON TABLE
    public.problems, public.solutions, public.test_cases, public.submissions
TO member2_evaluator;

COMMIT;
