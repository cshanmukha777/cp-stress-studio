import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const SORTABLE = ['title', 'difficulty', 'createdAt'];
const validDifficulty = (d) => Number.isInteger(d) && d >= 800 && d <= 3500;
const slugify = (s) =>
  String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const listSelect = {
  id: true,
  title: true,
  slug: true,
  difficulty: true,
  createdAt: true,
  createdBy: { select: { profile: { select: { handle: true } } } },
};

router.get('/', async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize) || 10, 1), 50);
  const sortBy = SORTABLE.includes(req.query.sortBy) ? req.query.sortBy : 'createdAt';
  const order = req.query.order === 'asc' ? 'asc' : 'desc';

  const where = {};
  if (req.query.q) where.title = { contains: String(req.query.q), mode: 'insensitive' };

  const min = parseInt(req.query.minDifficulty);
  const max = parseInt(req.query.maxDifficulty);
  if (!Number.isNaN(min) || !Number.isNaN(max)) {
    where.difficulty = {};
    if (!Number.isNaN(min)) where.difficulty.gte = min;
    if (!Number.isNaN(max)) where.difficulty.lte = max;
  }

  const [items, total] = await Promise.all([
    prisma.problem.findMany({
      where,
      orderBy: [{ [sortBy]: order }, { id: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: listSelect,
    }),
    prisma.problem.count({ where }),
  ]);

  res.json({ items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
});

router.get('/:slug', async (req, res) => {
  const problem = await prisma.problem.findUnique({
    where: { slug: req.params.slug },
    include: { createdBy: { select: { profile: { select: { handle: true } } } } },
  });
  if (!problem) return res.status(404).json({ error: 'Problem not found' });
  res.json(problem);
});

router.post('/', requireAuth, async (req, res) => {
  const { title, statement, difficulty } = req.body;
  if (!title || !statement) {
    return res.status(400).json({ error: 'title and statement are required' });
  }
  if (!validDifficulty(difficulty)) {
    return res.status(400).json({ error: 'difficulty must be an integer from 800 to 3500' });
  }
  const slug = slugify(req.body.slug || title);
  if (!slug) return res.status(400).json({ error: 'Could not build a slug from the title' });

  try {
    const problem = await prisma.problem.create({
      data: {
        title: String(title).trim(),
        slug,
        statement: String(statement).trim(),
        difficulty,
        createdById: req.user.id,
      },
    });
    res.status(201).json(problem);
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'A problem with this slug already exists' });
    throw e;
  }
});

router.put('/:slug', requireAuth, async (req, res) => {
  const existing = await prisma.problem.findUnique({ where: { slug: req.params.slug } });
  if (!existing) return res.status(404).json({ error: 'Problem not found' });
  if (req.user.role !== 'admin' && existing.createdById !== req.user.id) {
    return res.status(403).json({ error: 'Not allowed' });
  }

  const { title, statement, difficulty } = req.body;
  const data = {};
  if (title !== undefined) data.title = String(title).trim();
  if (statement !== undefined) data.statement = String(statement).trim();
  if (difficulty !== undefined) {
    if (!validDifficulty(difficulty)) {
      return res.status(400).json({ error: 'difficulty must be an integer from 800 to 3500' });
    }
    data.difficulty = difficulty;
  }

  const updated = await prisma.problem.update({ where: { id: existing.id }, data });
  res.json(updated);
});

router.delete('/:slug', requireAuth, async (req, res) => {
  const existing = await prisma.problem.findUnique({ where: { slug: req.params.slug } });
  if (!existing) return res.status(404).json({ error: 'Problem not found' });
  if (req.user.role !== 'admin' && existing.createdById !== req.user.id) {
    return res.status(403).json({ error: 'Not allowed' });
  }

  try {
    await prisma.problem.delete({ where: { id: existing.id } });
    res.status(204).end();
  } catch (e) {
    if (e.code === 'P2003') return res.status(409).json({ error: 'Problem is still referenced by other records' });
    throw e;
  }
});

export default router;