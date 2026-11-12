import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { writeTemplate, listTemplates } from '../utils/templates.js';

const router = Router();

router.get('/', requireAuth, async (_req, res) => {
  res.json({ templates: await listTemplates() });
});

router.post('/export/:slug', requireAuth, async (req, res) => {
  const problem = await prisma.problem.findUnique({ where: { slug: req.params.slug } });
  if (!problem) return res.status(404).json({ error: 'Problem not found' });

  const file = await writeTemplate(problem);
  res.status(201).json({ slug: problem.slug, file });
});

export default router;