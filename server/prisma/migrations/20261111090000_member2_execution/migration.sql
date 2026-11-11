CREATE TABLE "solutions" (
    "id" SERIAL PRIMARY KEY,
    "problem_id" INTEGER NOT NULL REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "name" TEXT NOT NULL,
    "language" TEXT NOT NULL CHECK ("language" IN ('cpp', 'python', 'java')),
    "code" TEXT NOT NULL,
    CONSTRAINT "solutions_problem_id_id_key" UNIQUE ("problem_id", "id")
);

CREATE TABLE "test_cases" (
    "problem_id" INTEGER NOT NULL REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "case_number" INTEGER NOT NULL CHECK ("case_number" > 0),
    "name" TEXT NOT NULL,
    "input" TEXT NOT NULL,
    "expected" TEXT NOT NULL,
    PRIMARY KEY ("problem_id", "case_number")
);

CREATE TABLE "submissions" (
    "id" SERIAL PRIMARY KEY,
    "problem_id" INTEGER NOT NULL REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "solution_id" INTEGER,
    "verdict" TEXT NOT NULL,
    "runtime_ms" DOUBLE PRECISION CHECK ("runtime_ms" >= 0),
    "memory_kib" INTEGER CHECK ("memory_kib" >= 0),
    "request" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "submissions_problem_id_solution_id_fkey"
        FOREIGN KEY ("problem_id", "solution_id")
        REFERENCES "solutions"("problem_id", "id") ON DELETE NO ACTION ON UPDATE CASCADE
);

CREATE INDEX "submissions_problem_id_created_at_idx" ON "submissions"("problem_id", "created_at");
CREATE INDEX "submissions_problem_id_solution_id_idx" ON "submissions"("problem_id", "solution_id");
