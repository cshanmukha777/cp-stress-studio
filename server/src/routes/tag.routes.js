import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const ID_PATTERN = /^[1-9]\d*$/;
const TAG_FIELDS = new Set(['name', 'description', 'parentId']);

export function parseId(value) {
  const text = String(value ?? '');
  if (!ID_PATTERN.test(text)) return null;
  const id = Number(text);
  return Number.isSafeInteger(id) ? id : null;
}

function parseTagBody(body, { partial = false } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Request body must be a JSON object' };
  }
  if (Object.keys(body).some((key) => !TAG_FIELDS.has(key))) {
    return { error: 'Only name, description, and parentId are accepted' };
  }

  const data = {};
  if (!partial || Object.hasOwn(body, 'name')) {
    if (typeof body.name !== 'string') return { error: 'name must be text' };
    data.name = body.name.trim();
    if (!data.name) return { error: 'name cannot be empty' };
    if (data.name.length > 50) return { error: 'name must be 50 characters or fewer' };
  }
  if (Object.hasOwn(body, 'description')) {
    if (body.description !== null && typeof body.description !== 'string') {
      return { error: 'description must be text or null' };
    }
    data.description = body.description === null ? null : body.description.trim() || null;
    if (data.description && data.description.length > 500) {
      return { error: 'description must be 500 characters or fewer' };
    }
  }
  if (!partial || Object.hasOwn(body, 'parentId')) {
    if (body.parentId === undefined || body.parentId === null) data.parentId = null;
    else if (!Number.isSafeInteger(body.parentId) || body.parentId < 1) {
      return { error: 'parentId must be a positive integer or null' };
    } else data.parentId = body.parentId;
  }
  if (partial && Object.keys(data).length === 0) return { error: 'Nothing to update' };
  return { data };
}

function sendPrismaError(res, error, noun = 'Tag') {
  if (error?.code === 'P2002') return res.status(409).json({ error: `${noun} name already exists` });
  if (error?.code === 'P2003') return res.status(400).json({ error: 'The selected parent or related record no longer exists' });
  if (error?.code === 'P2025') return res.status(404).json({ error: `${noun} not found` });
  throw error;
}

export function createTagRouter(db = prisma) {
  const router = Router();

  router.get('/', async (req, res) => {
    const where = {};
    if (req.query.q !== undefined) {
      const q = String(req.query.q).trim();
      if (q.length > 100) return res.status(400).json({ error: 'Search must be 100 characters or fewer' });
      if (q) where.name = { contains: q, mode: 'insensitive' };
    }
    if (req.query.parentId !== undefined) {
      if (req.query.parentId === 'root' || req.query.parentId === 'null') where.parentId = null;
      else {
        const parentId = parseId(req.query.parentId);
        if (!parentId) return res.status(400).json({ error: 'parentId must be a positive integer or root' });
        where.parentId = parentId;
      }
    }
    if (req.query.hasProblems !== undefined) {
      if (!['true', 'false'].includes(String(req.query.hasProblems))) {
        return res.status(400).json({ error: 'hasProblems must be true or false' });
      }
      where.problemTags = String(req.query.hasProblems) === 'true' ? { some: {} } : { none: {} };
    }
    const items = await db.tag.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        parent: { select: { id: true, name: true } },
        _count: { select: { problemTags: true, children: true } },
      },
    });
    res.json({ items, total: items.length });
  });

  router.get('/:id/problems', async (req, res) => {
    const tagId = parseId(req.params.id);
    if (!tagId) return res.status(400).json({ error: 'Invalid tag ID' });
    const tag = await db.tag.findUnique({ where: { id: tagId }, select: { id: true } });
    if (!tag) return res.status(404).json({ error: 'Tag not found' });
    const relations = await db.problemTag.findMany({
      where: { tagId },
      orderBy: { problem: { title: 'asc' } },
      include: {
        problem: {
          select: { id: true, title: true, slug: true, difficulty: true, createdAt: true },
        },
      },
    });
    res.json({ items: relations.map((relation) => relation.problem), total: relations.length });
  });

  router.get('/:id', async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid tag ID' });
    const tag = await db.tag.findUnique({
      where: { id },
      include: {
        parent: { select: { id: true, name: true } },
        children: { select: { id: true, name: true }, orderBy: { name: 'asc' } },
        _count: { select: { problemTags: true } },
      },
    });
    if (!tag) return res.status(404).json({ error: 'Tag not found' });
    res.json(tag);
  });

  router.post('/', requireAuth, async (req, res) => {
    const parsed = parseTagBody(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    if (parsed.data.parentId !== null) {
      const parent = await db.tag.findUnique({ where: { id: parsed.data.parentId }, select: { id: true } });
      if (!parent) return res.status(404).json({ error: 'Parent tag not found' });
    }
    try {
      const tag = await db.tag.create({ data: parsed.data });
      return res.status(201).json(tag);
    } catch (error) {
      return sendPrismaError(res, error);
    }
  });

  router.put('/:id', requireAuth, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid tag ID' });
    const existing = await db.tag.findUnique({ where: { id }, select: { id: true, parentId: true } });
    if (!existing) return res.status(404).json({ error: 'Tag not found' });
    const parsed = parseTagBody(req.body, { partial: true });
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const { parentId } = parsed.data;
    if (parentId !== undefined && parentId !== null) {
      if (parentId === id) return res.status(400).json({ error: 'A tag cannot be its own parent' });
      let ancestorId = parentId;
      const visited = new Set();
      while (ancestorId !== null && ancestorId !== undefined) {
        if (ancestorId === id) return res.status(400).json({ error: 'Parent selection would create a tag hierarchy cycle' });
        if (visited.has(ancestorId)) return res.status(409).json({ error: 'Existing tag hierarchy contains a cycle' });
        visited.add(ancestorId);
        const ancestor = await db.tag.findUnique({ where: { id: ancestorId }, select: { id: true, parentId: true } });
        if (!ancestor) return res.status(404).json({ error: 'Parent tag not found' });
        ancestorId = ancestor.parentId;
      }
    }
    try {
      const tag = await db.tag.update({ where: { id }, data: parsed.data });
      return res.json(tag);
    } catch (error) {
      return sendPrismaError(res, error);
    }
  });

  router.delete('/:id', requireAuth, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid tag ID' });
    try {
      await db.tag.delete({ where: { id } });
      return res.status(204).end();
    } catch (error) {
      return sendPrismaError(res, error);
    }
  });

  return router;
}

export default createTagRouter();
