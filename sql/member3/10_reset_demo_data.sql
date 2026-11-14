-- Safe setup/reset for only the dedicated SQL demonstration rows.
-- Does not drop the demo schema or touch application tables/data.
CREATE SCHEMA IF NOT EXISTS member3_demo;

CREATE TABLE IF NOT EXISTS member3_demo.isolation_demo (
    id INTEGER PRIMARY KEY,
    value TEXT NOT NULL
);

INSERT INTO member3_demo.isolation_demo (id, value)
VALUES (1, 'original')
ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value;

CREATE TABLE IF NOT EXISTS member3_demo.transaction_demo (
    id INTEGER PRIMARY KEY,
    label TEXT NOT NULL,
    balance INTEGER NOT NULL CHECK (balance >= 0)
);

INSERT INTO member3_demo.transaction_demo (id, label, balance)
VALUES (1, 'M3 transaction demo', 100)
ON CONFLICT (id) DO UPDATE
SET label = EXCLUDED.label, balance = EXCLUDED.balance;
