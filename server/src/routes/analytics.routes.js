import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Stress executions live in the desktop SQLite store. This endpoint returns
// only the PostgreSQL problem/tag links needed to join local aggregates.
router.get('/catalog', requireAuth, async (_req, res) => {
  const [problems, tags] = await Promise.all([
    prisma.problem.findMany({
      orderBy: { title: 'asc' },
      select: {
        id: true, title: true, slug: true, difficulty: true,
        problemTags: { select: { tagId: true } },
      },
    }),
    prisma.tag.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, problemTags: { select: { problemId: true } } },
    }),
  ]);
  res.json({
    problems: problems.map(({ problemTags, ...problem }) => ({
      ...problem, tagIds: problemTags.map(({ tagId }) => tagId),
    })),
    tags: tags.map(({ problemTags, ...tag }) => ({
      ...tag, problemIds: problemTags.map(({ problemId }) => String(problemId)),
    })),
  });
});

export default router;
