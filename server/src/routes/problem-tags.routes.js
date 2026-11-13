import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { parseId } from './tag.routes.js';

async function problemForMutation(db, problemId, user, res) {
  const problem = await db.problem.findUnique({
    where: { id: problemId },
    select: { id: true, createdById: true },
  });
  if (!problem) {
    res.status(404).json({ error: 'Problem not found' });
    return null;
  }
  if (user.role !== 'admin' && problem.createdById !== user.id) {
    res.status(403).json({ error: 'Not allowed to change tags for this problem' });
    return null;
  }
  return problem;
}

function tagIdList(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Request body must be a JSON object' };
  if (Object.keys(body).some((key) => !['tagId', 'tagIds', 'replace'].includes(key))) {
    return { error: 'Only tagId, tagIds, and replace are accepted' };
  }
  if (body.replace !== undefined && typeof body.replace !== 'boolean') return { error: 'replace must be true or false' };
  if (body.tagId !== undefined && body.tagIds !== undefined) return { error: 'Provide tagId or tagIds, not both' };
  let ids;
  if (body.tagId !== undefined) ids = [body.tagId];
  else if (Array.isArray(body.tagIds)) ids = body.tagIds;
  else return { error: 'Provide tagId or a tagIds array' };
  if (ids.length > 100) return { error: 'A problem can be assigned at most 100 tags at once' };
  if (ids.some((id) => !Number.isSafeInteger(id) || id < 1)) return { error: 'Tag IDs must be positive integers' };
  const uniqueIds = [...new Set(ids)];
  if (!uniqueIds.length && !body.replace) return { error: 'Select at least one tag' };
  return { ids: uniqueIds, replace: body.replace === true };
}

export function createProblemTagsRouter(db = prisma) {
  const router = Router();

  router.get('/:problemId/tags', async (req, res) => {
    const problemId = parseId(req.params.problemId);
    if (!problemId) return res.status(400).json({ error: 'Invalid problem ID' });
    const problem = await db.problem.findUnique({ where: { id: problemId }, select: { id: true } });
    if (!problem) return res.status(404).json({ error: 'Problem not found' });
    const relations = await db.problemTag.findMany({
      where: { problemId },
      orderBy: { tag: { name: 'asc' } },
      include: { tag: true },
    });
    res.json({ items: relations.map((relation) => relation.tag), total: relations.length });
  });

  router.post('/:problemId/tags', requireAuth, async (req, res) => {
    const problemId = parseId(req.params.problemId);
    if (!problemId) return res.status(400).json({ error: 'Invalid problem ID' });
    const parsed = tagIdList(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    if (!(await problemForMutation(db, problemId, req.user, res))) return;
    const existingTags = await db.tag.findMany({ where: { id: { in: parsed.ids } }, select: { id: true } });
    if (existingTags.length !== parsed.ids.length) {
      const found = new Set(existingTags.map((tag) => tag.id));
      const missing = parsed.ids.filter((id) => !found.has(id));
      return res.status(404).json({ error: 'Tag not found', missingTagIds: missing });
    }

    let items;
    try {
      items = await db.$transaction(async (tx) => {
        if (parsed.replace) await tx.problemTag.deleteMany({ where: { problemId } });
        if (parsed.ids.length) {
          await tx.problemTag.createMany({
            data: parsed.ids.map((tagId) => ({ problemId, tagId })),
            skipDuplicates: true,
          });
        }
        const relations = await tx.problemTag.findMany({
          where: { problemId },
          orderBy: { tag: { name: 'asc' } },
          include: { tag: true },
        });
        return relations.map((relation) => relation.tag);
      });
    } catch (error) {
      if (error?.code === 'P2003') return res.status(404).json({ error: 'Problem or tag no longer exists' });
      throw error;
    }
    res.status(200).json({ items, total: items.length });
  });

  router.delete('/:problemId/tags/:tagId', requireAuth, async (req, res) => {
    const problemId = parseId(req.params.problemId);
    const tagId = parseId(req.params.tagId);
    if (!problemId) return res.status(400).json({ error: 'Invalid problem ID' });
    if (!tagId) return res.status(400).json({ error: 'Invalid tag ID' });
    if (!(await problemForMutation(db, problemId, req.user, res))) return;
    const tag = await db.tag.findUnique({ where: { id: tagId }, select: { id: true } });
    if (!tag) return res.status(404).json({ error: 'Tag not found' });
    const removed = await db.problemTag.deleteMany({ where: { problemId, tagId } });
    if (!removed.count) return res.status(404).json({ error: 'Tag is not assigned to this problem' });
    res.status(204).end();
  });

  return router;
}

export default createProblemTagsRouter();
