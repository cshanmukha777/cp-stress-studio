-- Run this file's setup block once in PostgreSQL (autocommit), or run
-- ../10_reset_demo_data.sql. Then use TWO independent query windows.
CREATE SCHEMA IF NOT EXISTS member3_demo;
CREATE TABLE IF NOT EXISTS member3_demo.isolation_demo (
    id INTEGER PRIMARY KEY,
    value TEXT NOT NULL
);
INSERT INTO member3_demo.isolation_demo (id, value)
VALUES (1, 'original')
ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value;

-- ===========================================================================
-- READ COMMITTED demonstration. Run statements in this block individually.
-- Session 1, step 1: start a transaction and read 'original'.
BEGIN ISOLATION LEVEL READ COMMITTED;
SELECT value FROM member3_demo.isolation_demo WHERE id = 1;

-- PAUSE HERE. In Session 2, run the READ COMMITTED block in
-- 09_non_repeatable_read_session2.sql and COMMIT it. Then return here.
-- Session 1, step 2: this second SELECT should now read 'updated-read-committed'.
SELECT value FROM member3_demo.isolation_demo WHERE id = 1;
COMMIT;

-- Before the next demonstration, reset to 'original' by running the reset
-- block in Session 2's file, or run 10_reset_demo_data.sql in autocommit.

-- ===========================================================================
-- REPEATABLE READ demonstration. Reset to 'original' before starting.
-- Session 1, step 1: start a new transaction and read 'original'.
BEGIN ISOLATION LEVEL REPEATABLE READ;
SELECT value FROM member3_demo.isolation_demo WHERE id = 1;

-- PAUSE HERE. In Session 2, run the REPEATABLE READ update block and COMMIT.
-- Return here for step 2: this SELECT should still read 'original' from the
-- transaction snapshot even though Session 2 has committed its new value.
SELECT value FROM member3_demo.isolation_demo WHERE id = 1;
COMMIT;

-- IMPORTANT: Do not execute this entire file as a single batch. Pause after
-- each first SELECT and coordinate the other query window as described above.
