# Member 1: ASD report (Users, Profiles, Problems)

## 1. What Member 1 built

Member 1 owns the accounts and the problem catalog. The work is a Node and Express backend with Prisma and PostgreSQL, and React pages inside the Electron app.

| Layer | What was built |
|---|---|
| Database | `users`, `profiles`, `problems` tables, relations, CHECK constraints, migrations, seed |
| Backend | Register, login, JWT, profile read and update, problem CRUD, template import and export |
| Frontend | Login and register form, problems catalog, profile page, export and import controls |
| SQL | DDL, joins, filters, string and NULL functions (`sql/m1_ddl_joins.sql`) |
| Normalization | 3NF write-up with ER diagram (`docs/m1-normalization.md`) |

## 2. Node modules used

| Module | Where | Why |
|---|---|---|
| `fs/promises` | `server/src/utils/templates.js` | Write, read and list problem template files |
| `path` | `server/src/utils/templates.js` | Build file paths, and `path.basename` so a slug cannot escape the templates folder |
| `process` | `server/src/utils/templates.js` | `process.env.TEMPLATE_DIR` and `process.cwd()` for the templates folder |
| `express` | `server/src/app.js` | HTTP server, routers, JSON body parsing |
| `jsonwebtoken` | `auth.routes.js`, `middleware/auth.js` | Sign and verify login tokens |
| `bcryptjs` | `auth.routes.js`, `prisma/seed.js` | Hash passwords |

## 3. Prisma

| Topic | Where it is shown |
|---|---|
| Schema, models | `server/prisma/schema.prisma` (`User`, `Profile`, `Problem`) |
| One-to-one | `Profile.userId` is UNIQUE, so one user has at most one profile |
| One-to-many | One user creates many problems (`Problem.createdById`) |
| Database mapping | `@@map` and `@map` give snake_case table and column names |
| Migrate | `init` migration, then a hand-written migration that adds CHECK constraints with `ALTER TABLE` |
| Seed | `server/prisma/seed.js`, run by `npx prisma db seed` (uses `upsert`, so it is safe to run twice) |
| Studio | `npx prisma studio` shows the tables |
| CRUD queries | `create`, `findUnique`, `findMany`, `update`, `delete` in the route files |
| Filtering and sorting | `where` with case-insensitive `contains`, `gte` and `lte` on difficulty, `orderBy` |
| Pagination | `skip` and `take`, plus a `count` for the total |
| Select | `select` limits the returned fields (the profile route never returns the password hash) |

## 4. API routes

| Method and path | Auth | What it does |
|---|---|---|
| `POST /api/auth/register` | none | Creates a user and profile, always with role `student` |
| `POST /api/auth/login` | none | Returns a token and the user |
| `GET /api/auth/me` | token | Returns the current user and profile |
| `GET /api/profile` | token | Reads the profile |
| `PUT /api/profile` | token | Updates display name, bio and language (handle and role cannot be changed) |
| `GET /api/problems` | none | Search, difficulty filter, sort and pagination |
| `GET /api/problems/:slug` | none | One problem |
| `POST /api/problems` | token | Creates a problem, difficulty must be 800 to 3500 |
| `PUT /api/problems/:slug` | token | Admin or the creator only |
| `DELETE /api/problems/:slug` | token | Admin or the creator only |
| `GET /api/templates` | token | Lists saved template files |
| `POST /api/templates/export/:slug` | token | Writes a problem to a JSON file |
| `POST /api/templates/import/:slug` | token | Creates a problem from a JSON file |

Status codes checked with `curl`: `200` for reads, `201` for creates, `204` for delete, `400` for bad input, `401` for a missing or bad token, `403` for a student editing an admin problem, `404` for an unknown problem or template, `409` for a duplicate slug.

## 5. Security decisions

- Passwords are stored only as bcrypt hashes.
- A new account is always `student`. The role is never read from the request body.
- Update and delete check that the user is an admin or the creator.
- The template slug goes through `path.basename`, so `../` in a slug cannot read or write outside the templates folder.
- The templates folder is in `.gitignore`, because the files are generated.

## 6. Frontend

All Member 1 screens are in `src/catalog/` and open from the **Account & Problems** button in the header, so the editor and stress tester were not changed.

| File | What it does |
|---|---|
| `api.js` | One `request` helper that adds the token and turns errors into messages |
| `AuthForm.jsx` | Login and register form |
| `CatalogPanel.jsx` | Full-screen panel with a Problems and a Profile tab |
| `ProblemsPage.jsx` | Search, difficulty filter, sort, pagination, export and import |
| `ProfilePage.jsx` | Edit display name, bio and preferred language |

The problems page keeps its result and the filters it was fetched with in one state object, and computes `loading` from them. This avoids calling `setState` directly inside an effect, which the project's lint rule rejects.

## 7. Work shared with other members

- `src/App.jsx` and `electron/` belong to Member 2. Member 1 added only the **Account & Problems** button and its panel.
- Member 3 added tags (`tags` and `problem_tags` tables and their routes) and an analytics page, and changed `problem.routes.js` so each problem is returned with its tags.
- `server/prisma/schema.prisma` is shared. Member 1 owns `User`, `Profile` and `Problem`.