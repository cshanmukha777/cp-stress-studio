# Member 1: DE report (database design and SQL)

## 1. Tables owned by Member 1

| Table | Columns | Primary key | Unique keys | Foreign keys |
|---|---|---|---|---|
| `users` | id, email, password_hash, role, created_at | id | email | none |
| `profiles` | id, user_id, display_name, handle, bio, language | id | user_id, handle | user_id references users(id), ON DELETE CASCADE |
| `problems` | id, title, slug, statement, difficulty, created_by_id, created_at | id | slug | created_by_id references users(id), ON DELETE RESTRICT |

Relations: users to profiles is one-to-one (the UNIQUE on `profiles.user_id` makes it one-to-one), and users to problems is one-to-many.

## 2. Constraints

| Constraint | Table | Rule |
|---|---|---|
| PRIMARY KEY | all three | `id SERIAL` |
| UNIQUE | users, profiles, problems | email, user_id, handle, slug |
| NOT NULL | all three | every column except `profiles.bio` |
| FOREIGN KEY | profiles, problems | to users |
| CHECK | problems | `difficulty` between 800 and 3500 |
| CHECK | users | `role` is `student` or `admin` |

The two CHECK constraints are in a hand-written migration, because Prisma's schema language cannot express them. This is also the `ALTER TABLE ... ADD CONSTRAINT` example for the DDL topic.

Checked live: inserting a user with role `hacker` fails with `violates check constraint "users_role_check"`.

## 3. SQL script: `sql/m1_ddl_joins.sql`

| Topic | What the script shows |
|---|---|
| DDL | `CREATE TABLE problem_notes` with PRIMARY KEY, two foreign keys, NOT NULL, a CHECK on rating, and `UNIQUE (problem_id, author_id)` |
| ALTER | `ADD COLUMN created_at` and `ADD CONSTRAINT problem_notes_note_len CHECK` |
| Constraint tests | Three inserts that fail on purpose: CHECK, UNIQUE and NOT NULL |
| Inner join | users with their profiles |
| Left join | users who created no problems (`WHERE pr.id IS NULL`) |
| Multi-table join | problems, author and handle across three tables |
| `IN` | difficulty in 800, 1000, 1200 |
| `LIKE` | case-insensitive title search with `ILIKE` |
| `EXISTS` | users who created at least one problem |
| `LIMIT` and `OFFSET` | page 2 with 3 rows per page |
| String and NULL functions | `UPPER`, `TRIM`, `COALESCE`, `NULLIF`, `CONCAT` |

`problem_notes` is a scratch table that the script drops at the end, so the real schema and Prisma migrations stay unchanged.

## 4. Normalization

The full write-up is in `docs/m1-normalization.md`: functional dependencies, 1NF, 2NF, 3NF and BCNF checks, an ER diagram, and an example that breaks 3NF.

Short version: every determinant in each table is a candidate key (`id`, `email`, `user_id`, `handle`, `slug`), so there are no partial or transitive dependencies. The three tables are in 3NF, and also in BCNF.

## 5. Migrations and seed

| Item | Detail |
|---|---|
| Migration `init` | Creates the three tables, indexes and foreign keys |
| Migration `add_check_constraints` | Adds the two CHECK constraints with `ALTER TABLE` |
| Seed | 3 users and 10 problems, using `upsert` so it can run again without duplicates |

## 6. Relation to the other members' tables

Member 2 owns `solutions`, `test_cases` and `submissions`, which reference `problems`. Member 3 owns `tags` and `problem_tags`. Member 1's `problems` table is the parent of all of them, so deleting a problem also removes its solutions and test cases through `ON DELETE CASCADE`.