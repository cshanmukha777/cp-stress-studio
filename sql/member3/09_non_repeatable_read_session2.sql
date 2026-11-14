-- Execute only the indicated block at each pause in Session 1.
-- Use this file in a SECOND independent PostgreSQL connection/query window.

-- READ COMMITTED phase: run after Session 1's first SELECT returns 'original'.
BEGIN;
UPDATE member3_demo.isolation_demo
SET value = 'updated-read-committed'
WHERE id = 1;
COMMIT;
-- Switch back to Session 1 and execute its second SELECT; it sees the new value.

-- RESET BETWEEN PHASES: run in autocommit before Session 1 begins REPEATABLE READ.
UPDATE member3_demo.isolation_demo SET value = 'original' WHERE id = 1;

-- REPEATABLE READ phase: run after Session 1's first SELECT returns 'original'.
BEGIN;
UPDATE member3_demo.isolation_demo
SET value = 'updated-repeatable-read'
WHERE id = 1;
COMMIT;
-- Switch back to Session 1 and execute its second SELECT; its snapshot remains
-- 'original'. After Session 1 commits, a new transaction sees the updated value.
