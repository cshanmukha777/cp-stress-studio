import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import jwt from 'jsonwebtoken';
import { createTagRouter } from '../src/routes/tag.routes.js';
import { createProblemTagsRouter } from '../src/routes/problem-tags.routes.js';

process.env.JWT_SECRET = 'tag-route-tests-only';

function fakePrisma() {
  const state = {
    nextTag: 1,
    tags: new Map(),
    problems: new Map([
      [1, { id: 1, title: 'Two Sum', slug: 'two-sum', difficulty: 800, createdById: 1, createdAt: new Date() }],
      [2, { id: 2, title: 'Other Problem', slug: 'other-problem', difficulty: 900, createdById: 2, createdAt: new Date() }],
    ]),
    links: new Map(),
  };
  const prisma = {};
  const problemTagRows = (where = {}) => [...state.links.values()]
    .filter((row) => where.problemId === undefined || row.problemId === where.problemId)
    .filter((row) => where.tagId === undefined || row.tagId === where.tagId);
  const tagView = (tag, include = {}) => {
    if (!tag) return null;
    const result = { ...tag };
    if (include.parent) result.parent = tag.parentId ? { id: tag.parentId, name: state.tags.get(tag.parentId)?.name } : null;
    if (include.children) result.children = [...state.tags.values()].filter((child) => child.parentId === tag.id).map(({ id, name }) => ({ id, name }));
    if (include._count) result._count = {
      problemTags: problemTagRows({ tagId: tag.id }).length,
      children: [...state.tags.values()].filter((child) => child.parentId === tag.id).length,
    };
    return result;
  };
  prisma.tag = {
    async findMany({ where = {}, include = {} } = {}) {
      return [...state.tags.values()]
        .filter((tag) => !where.id?.in || where.id.in.includes(tag.id))
        .filter((tag) => !where.name || tag.name.toLowerCase().includes(where.name.contains.toLowerCase()))
        .filter((tag) => where.parentId === undefined || tag.parentId === where.parentId)
        .filter((tag) => !where.problemTags?.some || problemTagRows({ tagId: tag.id }).length > 0)
        .filter((tag) => !where.problemTags?.none || problemTagRows({ tagId: tag.id }).length === 0)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((tag) => tagView(tag, include));
    },
    async findUnique({ where, include = {}, select } = {}) {
      const tag = state.tags.get(where.id);
      if (!tag) return null;
      const result = tagView(tag, include);
      return select ? Object.fromEntries(Object.entries(select).filter(([, enabled]) => enabled).map(([key]) => [key, result[key]])) : result;
    },
    async create({ data }) {
      if ([...state.tags.values()].some((tag) => tag.name.toLowerCase() === data.name.toLowerCase())) throw prismaError('P2002');
      if (data.parentId && !state.tags.has(data.parentId)) throw prismaError('P2003');
      const now = new Date();
      const tag = { id: state.nextTag++, name: data.name, description: data.description, parentId: data.parentId, createdAt: now, updatedAt: now };
      state.tags.set(tag.id, tag);
      return { ...tag };
    },
    async update({ where, data }) {
      const tag = state.tags.get(where.id);
      if (!tag) throw prismaError('P2025');
      if (data.name !== undefined && [...state.tags.values()].some((item) => item.id !== tag.id && item.name.toLowerCase() === data.name.toLowerCase())) throw prismaError('P2002');
      if (data.parentId && !state.tags.has(data.parentId)) throw prismaError('P2003');
      Object.assign(tag, data, { updatedAt: new Date() });
      return { ...tag };
    },
    async delete({ where }) {
      const tag = state.tags.get(where.id);
      if (!tag) throw prismaError('P2025');
      state.tags.delete(where.id);
      for (const child of state.tags.values()) if (child.parentId === where.id) child.parentId = null;
      for (const [key, link] of state.links) if (link.tagId === where.id) state.links.delete(key);
      return { ...tag };
    },
  };
  prisma.problem = {
    async findUnique({ where }) {
      const problem = state.problems.get(where.id);
      return problem ? { id: problem.id, createdById: problem.createdById } : null;
    },
  };
  prisma.problemTag = {
    async findMany({ where = {}, include = {} } = {}) {
      return problemTagRows(where).sort((a, b) => state.tags.get(a.tagId).name.localeCompare(state.tags.get(b.tagId).name)).map((row) => ({
        ...row,
        ...(include.tag ? { tag: { ...state.tags.get(row.tagId) } } : {}),
        ...(include.problem ? { problem: { ...state.problems.get(row.problemId) } } : {}),
      }));
    },
    async createMany({ data, skipDuplicates }) {
      let count = 0;
      for (const row of data) {
        const key = `${row.problemId}:${row.tagId}`;
        if (state.links.has(key) && skipDuplicates) continue;
        if (!state.problems.has(row.problemId) || !state.tags.has(row.tagId)) throw prismaError('P2003');
        if (state.links.has(key)) throw prismaError('P2002');
        state.links.set(key, { ...row, createdAt: new Date() });
        count++;
      }
      return { count };
    },
    async deleteMany({ where }) {
      let count = 0;
      for (const [key, row] of state.links) {
        if ((where.problemId === undefined || row.problemId === where.problemId) && (where.tagId === undefined || row.tagId === where.tagId)) {
          state.links.delete(key);
          count++;
        }
      }
      return { count };
    },
  };
  prisma.$transaction = (callback) => callback(prisma);
  return prisma;
}

function prismaError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

async function createClient() {
  const db = fakePrisma();
  const app = express();
  app.use(express.json());
  app.use('/api/problems', createProblemTagsRouter(db));
  app.use('/api/tags', createTagRouter(db));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const token = jwt.sign({ id: 1, role: 'admin' }, process.env.JWT_SECRET);
  async function request(path, { method = 'GET', body, authenticated = false, user } = {}) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(authenticated ? { authorization: `Bearer ${user ? jwt.sign(user, process.env.JWT_SECRET) : token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, body: response.status === 204 ? null : await response.json() };
  }
  return { db, request, close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())) };
}

test('tag CRUD validates names, supports hierarchy/search, and deletes linked rows', async (t) => {
  const client = await createClient();
  t.after(client.close);
  assert.equal((await client.request('/tags', { method: 'POST', body: { name: '  ' }, authenticated: true })).status, 400);
  const created = await client.request('/tags', { method: 'POST', body: { name: '  Graph Theory ', description: ' graphs ' }, authenticated: true });
  assert.equal(created.status, 201);
  assert.equal(created.body.name, 'Graph Theory');
  assert.equal(created.body.description, 'graphs');
  assert.equal((await client.request('/tags', { method: 'POST', body: { name: 'graph theory' }, authenticated: true })).status, 409);
  const child = await client.request('/tags', { method: 'POST', body: { name: 'Shortest Path', parentId: created.body.id }, authenticated: true });
  assert.equal(child.status, 201);
  assert.equal((await client.request(`/tags/${child.body.id}`, { method: 'PUT', body: { parentId: child.body.id }, authenticated: true })).status, 400);
  const update = await client.request(`/tags/${child.body.id}`, { method: 'PUT', body: { name: 'Pathfinding', description: 'paths' }, authenticated: true });
  assert.equal(update.body.name, 'Pathfinding');
  assert.equal((await client.request('/tags?q=path')).body.total, 1);
  assert.equal((await client.request(`/tags/${child.body.id}`, { method: 'PUT', body: { name: 'graph THEORY' }, authenticated: true })).status, 409);
  assert.equal((await client.request('/tags/999')).status, 404);
  assert.equal((await client.request('/tags/nope')).status, 400);

  const link = await client.request('/problems/1/tags', { method: 'POST', body: { tagId: child.body.id }, authenticated: true });
  assert.equal(link.body.total, 1);
  assert.equal((await client.request(`/tags/${child.body.id}/problems`)).body.items[0].title, 'Two Sum');
  const renamed = await client.request(`/tags/${child.body.id}`, { method: 'PUT', body: { name: 'Dijkstra' }, authenticated: true });
  assert.equal(renamed.body.name, 'Dijkstra');
  assert.equal((await client.request('/problems/1/tags')).body.items[0].name, 'Dijkstra');
  await client.request(`/tags/${created.body.id}`, { method: 'DELETE', authenticated: true });
  assert.equal((await client.request(`/tags/${child.body.id}`)).body.parent, null);
  assert.equal((await client.request(`/tags/${child.body.id}/problems`)).body.total, 1);
  assert.equal((await client.request(`/tags/${child.body.id}`, { method: 'DELETE', authenticated: true })).status, 204);
  assert.equal((await client.request('/problems/1/tags')).body.total, 0);
});

test('problem tag assignments are many-to-many, idempotent, removable, and validated', async (t) => {
  const client = await createClient();
  t.after(client.close);
  const first = await client.request('/tags', { method: 'POST', body: { name: 'Array' }, authenticated: true });
  const second = await client.request('/tags', { method: 'POST', body: { name: 'Hash Map' }, authenticated: true });
  const assigned = await client.request('/problems/1/tags', {
    method: 'POST', body: { tagIds: [first.body.id, second.body.id, first.body.id] }, authenticated: true,
  });
  assert.equal(assigned.status, 200);
  assert.equal(assigned.body.total, 2);
  assert.equal((await client.request('/problems/1/tags', {
    method: 'POST', body: { tagIds: [first.body.id, second.body.id] }, authenticated: true,
  })).body.total, 2);
  assert.equal((await client.request('/problems/1/tags')).body.total, 2);
  await client.request('/problems/2/tags', { method: 'POST', body: { tagId: first.body.id }, authenticated: true });
  assert.equal((await client.request(`/tags/${first.body.id}/problems`)).body.total, 2);
  assert.equal((await client.request('/problems/1/tags/1', { method: 'DELETE', authenticated: true })).status, 204);
  assert.equal((await client.request('/problems/1/tags')).body.total, 1);
  assert.equal((await client.request('/problems/999/tags', { method: 'POST', body: { tagId: first.body.id }, authenticated: true })).status, 404);
  assert.equal((await client.request('/problems/no/tags')).status, 400);
  assert.equal((await client.request('/problems/1/tags', { method: 'POST', body: { tagId: 999 }, authenticated: true })).status, 404);
  assert.equal((await client.request('/problems/1/tags', { method: 'POST', body: { tagIds: [first.body.id] }, authenticated: false })).status, 401);
  assert.equal((await client.request('/problems/2/tags', { method: 'POST', body: { tagId: second.body.id }, authenticated: true, user: { id: 1, role: 'student' } })).status, 403);
});

test('replacement updates the full tag selection and can clear it', async (t) => {
  const client = await createClient();
  t.after(client.close);
  const tags = await Promise.all(['A', 'B', 'C'].map((name) => client.request('/tags', { method: 'POST', body: { name }, authenticated: true })));
  const ids = tags.map((item) => item.body.id);
  await client.request('/problems/1/tags', { method: 'POST', body: { tagIds: ids.slice(0, 2) }, authenticated: true });
  const replaced = await client.request('/problems/1/tags', { method: 'POST', body: { tagIds: [ids[2]], replace: true }, authenticated: true });
  assert.deepEqual(replaced.body.items.map((tag) => tag.id), [ids[2]]);
  const cleared = await client.request('/problems/1/tags', { method: 'POST', body: { tagIds: [], replace: true }, authenticated: true });
  assert.equal(cleared.body.total, 0);
});
