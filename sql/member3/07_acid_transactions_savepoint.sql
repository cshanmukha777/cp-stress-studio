-- SAFE, ISOLATED TRANSACTION DEMO. This creates only a dedicated demo schema
-- and row; it does not update application users, problems, or submissions.
CREATE SCHEMA IF NOT EXISTS member3_demo;

CREATE TABLE IF NOT EXISTS member3_demo.transaction_demo (
    id INTEGER PRIMARY KEY,
    label TEXT NOT NULL,
    balance INTEGER NOT NULL CHECK (balance >= 0)
);

-- Reset only the explicit demonstration row, so this script is repeatable.
INSERT INTO member3_demo.transaction_demo (id, label, balance)
VALUES (1, 'M3 transaction demo', 100)
ON CONFLICT (id) DO UPDATE
SET label = EXCLUDED.label, balance = EXCLUDED.balance;

-- ATOMICITY: these transaction statements succeed or roll back together.
-- CONSISTENCY: the CHECK constraint keeps balance nonnegative.
-- ISOLATION: PostgreSQL keeps concurrent transactions from seeing partial work.
-- DURABILITY: COMMIT makes the final value persist after success.
BEGIN;

-- Intentional update of the isolated demo row only.
UPDATE member3_demo.transaction_demo SET balance = balance + 10 WHERE id = 1;

-- Save the state after the first update.
SAVEPOINT before_optional_change;

-- A second illustrative update, then undo only this update.
UPDATE member3_demo.transaction_demo SET balance = balance + 100 WHERE id = 1;
ROLLBACK TO SAVEPOINT before_optional_change;

-- Within the transaction the balance is now 110 (not 210).
SELECT id, label, balance FROM member3_demo.transaction_demo WHERE id = 1;
COMMIT;

-- Separate full-rollback example: this update is undone entirely.
BEGIN;
UPDATE member3_demo.transaction_demo SET balance = balance + 1000 WHERE id = 1;
SELECT id, label, balance AS temporary_uncommitted_balance
FROM member3_demo.transaction_demo WHERE id = 1;
ROLLBACK;

-- The committed balance remains 110 after the full rollback.
SELECT id, label, balance FROM member3_demo.transaction_demo WHERE id = 1;
