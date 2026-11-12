# Member 1: Normalization of users, profiles and problems

## 1. Tables and keys

| Table | Columns | Primary key | Other candidate keys | Foreign keys |
|---|---|---|---|---|
| users | id, email, password_hash, role, created_at | id | email | none |
| profiles | id, user_id, display_name, handle, bio, language | id | user_id, handle | user_id references users(id) |
| problems | id, title, slug, statement, difficulty, created_by_id, created_at | id | slug | created_by_id references users(id) |

## 2. Functional dependencies

**users**

- id -> email, password_hash, role, created_at
- email -> id, password_hash, role, created_at (email is UNIQUE)

**profiles**

- id -> user_id, display_name, handle, bio, language
- user_id -> id, display_name, handle, bio, language (user_id is UNIQUE, which makes the relation one-to-one)
- handle -> id, user_id, display_name, bio, language (handle is UNIQUE)

**problems**

- id -> title, slug, statement, difficulty, created_by_id, created_at
- slug -> id, title, statement, difficulty, created_by_id, created_at (slug is UNIQUE)

Two dependencies that do not exist, and why that matters:

- title does not determine anything, because two problems can share a title.
- created_by_id does not determine difficulty, title or any other problem column, because one user can create many different problems.

## 3. Normal form check

| Table | 1NF | 2NF | 3NF |
|---|---|---|---|
| users | Every column holds one atomic value. | All candidate keys are single columns, so no partial dependency is possible. | Every determinant (id, email) is a candidate key, so no transitive dependency. |
| profiles | Same. | Same, keys are id, user_id and handle. | Every determinant is a candidate key. |
| problems | Same. | Same, keys are id and slug. | Every determinant is a candidate key. |

Because every determinant in every table is a candidate key, all three tables are also in **BCNF**, which is stricter than 3NF.

## 4. Design decisions

- `role` is a plain text column limited by a CHECK constraint (`student` or `admin`). A separate roles table would add a join without removing any redundancy, so it would be over-normalizing.
- `handle` and `display_name` live in `profiles`, not in `users`, because they describe the person's public profile and not the login account.
- `slug` is kept next to `title`. It is a second candidate key, not a redundant copy, because the app looks problems up by slug.