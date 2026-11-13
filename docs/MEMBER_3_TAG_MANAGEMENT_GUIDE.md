# M3 Guide: Tag Management and Problem–Tag Relationships

This feature adds shared tags to the existing Express, Prisma, and PostgreSQL API. It uses the existing `Problem` model and its integer IDs. The desktop stress tester and its SQLite history are unchanged.

## CRUD and the data model

CRUD means Create, Read, Update, and Delete. Users can create tags, search/list or open one tag, edit its name/description/parent, and delete it. Names are trimmed, 1–50 characters, and case-insensitively unique. Descriptions are optional and limited to 500 characters. A tag can optionally have a parent; the API rejects self-parenting and hierarchy cycles.

A problem can have many tags, and a tag can be shared by many problems. The `problem_tags` junction table stores each pair, along with its creation timestamp. The composite primary key `(problem_id, tag_id)` prevents duplicate links. Both foreign keys cascade on deletion. Deleting a parent tag sets its children’s parent to null.

```text
Problem (id: Int)  1 ─── * ProblemTag * ─── 1  Tag (id: Int)
                           problem_id             tag_id
                           created_at
```

The Prisma schema is `server/prisma/schema.prisma`; the SQL migration creates `tags`, `problem_tags`, the self-parent relationship, uniqueness indexes, and cascading foreign keys.

## API endpoints

All endpoints use `http://localhost:4000/api`. Read requests are public. Mutations require the existing Bearer token. Problem-tag changes follow the project’s ownership rule: the problem creator or an admin may make them.

| Method and path | Purpose |
| --- | --- |
| `POST /tags` | Create a tag |
| `GET /tags?q=graph&parentId=root&hasProblems=true` | Search/filter tags |
| `GET /tags/:id` | Read a tag, its parent/children, and assignment count |
| `PUT /tags/:id` | Update a tag |
| `DELETE /tags/:id` | Delete a tag and cascade assignments |
| `GET /tags/:id/problems` | List problems associated with a tag |
| `GET /problems/:problemId/tags` | List tags assigned to a problem |
| `POST /problems/:problemId/tags` | Add tags or replace the full selection |
| `DELETE /problems/:problemId/tags/:tagId` | Remove one assignment |

IDs must be positive integers. Bulk assignment validates every ID and uses a transaction. Repeating an assignment is idempotent. `replace: true` replaces the complete selection; an empty `tagIds` array clears it.

Create a tag:

```sh
curl -X POST http://localhost:4000/api/tags \
  -H 'Authorization: Bearer YOUR_TOKEN' -H 'Content-Type: application/json' \
  -d '{"name":"Graph Theory","description":"Traversal and connectivity"}'
```

Example response (`201`):

```json
{"id":12,"name":"Graph Theory","description":"Traversal and connectivity","parentId":null,"createdAt":"2026-11-14T10:00:00.000Z","updatedAt":"2026-11-14T10:00:00.000Z"}
```

Assign multiple tags to problem 7:

```sh
curl -X POST http://localhost:4000/api/problems/7/tags \
  -H 'Authorization: Bearer YOUR_TOKEN' -H 'Content-Type: application/json' \
  -d '{"tagIds":[12,13]}'
```

Example response (`200`):

```json
{"items":[{"id":13,"name":"Array","description":null,"parentId":null},{"id":12,"name":"Graph Theory","description":"Traversal and connectivity","parentId":null}],"total":2}
```

Remove tag 12 from problem 7 with `DELETE /api/problems/7/tags/12` and the same Authorization header. Invalid input returns `400`, missing records return `404`, duplicate names return `409`, unauthenticated writes return `401`, and unauthorized problem edits return `403`. Errors use JSON `{ "error": "..." }` responses.

## Frontend and important files

The authenticated Catalog panel has a **Tags** tab for search, create/edit/delete, details, and associated problems. The **Problems** tab displays tag chips and offers a searchable multi-select under **Manage tags**. It supports saving the full selection and removing one tag. The interface uses live API data with loading, empty, success, and error states.

- `server/prisma/schema.prisma`, `server/prisma/migrations/20261114090000_tag_management/migration.sql`: schema and referential rules.
- `server/src/routes/tag.routes.js`: tag CRUD, search, filters, and hierarchy validation.
- `server/src/routes/problem-tags.routes.js`: problem assignment, replacement, and removal.
- `server/src/routes/problem.routes.js`, `server/src/app.js`: tag data in problem responses and API route mounting.
- `src/catalog/api.js`: authenticated frontend API helpers.
- `src/catalog/TagsPage.jsx`: Tag Management interface.
- `src/catalog/ProblemsPage.jsx`: tag display and assignment controls.
- `src/catalog/CatalogPanel.jsx`, `src/catalog/catalog.css`: navigation and styling.
- `server/tests/tag-routes.test.js`: route tests using a test-only in-memory Prisma-shaped fake.

## Run and test

From the repository root, start the desktop UI as usual with `npm ci` and `npm run dev`. Configure `server/.env` with `DATABASE_URL` and `JWT_SECRET`, then start the API:

```sh
cd server
npm ci
npx prisma migrate deploy
npx prisma generate
npm run dev
```

Run API tests from `server/` with `npm test`. Run the root regression suite with `npm test` from the repository root and the desktop suite with `npm run test:desktop`.

## Evaluation walkthrough

1. Configure PostgreSQL and start the server and desktop app. Sign in under **Account & Problems**.
2. Open **Tags**. Create `Graph Theory`, then create `Shortest Path` with `Graph Theory` as its parent.
3. Search for `path`, open **Details**, and confirm no problems are associated yet.
4. Open **Problems** and choose **Manage tags** on a problem you own. Search for and select `Graph Theory`, then save.
5. Confirm the tag chip appears in the problem list. In **Tags → Details**, confirm the problem is listed.
6. Remove the tag from the problem and confirm the association disappears. Reassign it, then delete the tag and confirm it is removed from the problem.
7. Try a duplicate name with different capitalization, an empty name, an invalid ID, and editing a problem owned by another user; verify the appropriate error is shown.

The migration is committed and can be applied with `cd server && npx prisma migrate deploy`. No `server/.env` or `DATABASE_URL` was configured in the implementation workspace, so the migration could not be applied to a live database here.
