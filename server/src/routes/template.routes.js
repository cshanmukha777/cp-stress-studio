import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { writeTemplate, readTemplate, listTemplates } from '../utils/templates.js';

const router = Router();

const validDifficulty = (d) => Number.isInteger(d) && d >= 800 && d <= 3500;

router.get('/', requireAuth, async (_req, res) => {
  res.json({ templates: await listTemplates() });
});

router.post('/export/:slug', requireAuth, async (req, res) => {
  const problem = await prisma.problem.findUnique({ where: { slug: req.params.slug } });
  if (!problem) return res.status(404).json({ error: 'Problem not found' });

  const file = await writeTemplate(problem);
  res.status(201).json({ slug: problem.slug, file });
});

router.post('/import/:slug', requireAuth, async (req, res) => {
  let template;
  try {
    template = await readTemplate(req.params.slug);
  } catch (e) {
    if (e.code === 'ENOENT') return res.status(404).json({ error: 'Template not found' });
    if (e instanceof SyntaxError) return res.status(400).json({ error: 'Template is not valid JSON' });
    throw e;
  }

  const { title, statement, difficulty } = template;
  if (!title || !statement) {
    return res.status(400).json({ error: 'Template needs a title and a statement' });
  }
  if (!validDifficulty(difficulty)) {
    return res.status(400).json({ error: 'difficulty must be an integer from 800 to 3500' });
  }

  const slug = String(template.slug || req.params.slug)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

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

export default router;