CREATE TABLE "tags" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parent_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tags_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "tags_name_check" CHECK ("name" = BTRIM("name") AND CHAR_LENGTH("name") BETWEEN 1 AND 50),
    CONSTRAINT "tags_description_check" CHECK ("description" IS NULL OR CHAR_LENGTH("description") <= 500),
    CONSTRAINT "tags_not_own_parent_check" CHECK ("parent_id" IS NULL OR "parent_id" <> "id")
);

CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");
CREATE UNIQUE INDEX "tags_name_lower_key" ON "tags"(LOWER("name"));
CREATE INDEX "tags_parent_id_idx" ON "tags"("parent_id");

ALTER TABLE "tags"
    ADD CONSTRAINT "tags_parent_id_fkey"
    FOREIGN KEY ("parent_id") REFERENCES "tags"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "problem_tags" (
    "problem_id" INTEGER NOT NULL,
    "tag_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "problem_tags_pkey" PRIMARY KEY ("problem_id", "tag_id"),
    CONSTRAINT "problem_tags_problem_id_fkey" FOREIGN KEY ("problem_id") REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "problem_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "problem_tags_tag_id_created_at_idx" ON "problem_tags"("tag_id", "created_at");
