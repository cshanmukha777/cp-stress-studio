import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const LANGUAGES = ['cpp', 'python', 'java'];

router.get('/', requireAuth, async (req, res) => {
  const profile = await prisma.profile.findUnique({
    where: { userId: req.user.id },
    select: {
      displayName: true,
      handle: true,
      bio: true,
      language: true,
      user: { select: { email: true, role: true, createdAt: true } },
    },
  });
  if (!profile) return res.status(404).json({ error: 'Profile not found' });
  res.json(profile);
});

router.put('/', requireAuth, async (req, res) => {
  const { displayName, bio, language } = req.body;
  const data = {};

  if (displayName !== undefined) {
    const name = String(displayName).trim();
    if (!name) return res.status(400).json({ error: 'displayName cannot be empty' });
    data.displayName = name;
  }
  if (bio !== undefined) {
    data.bio = bio === null ? null : String(bio).trim().slice(0, 300);
  }
  if (language !== undefined) {
    if (!LANGUAGES.includes(language)) {
      return res.status(400).json({ error: `language must be one of: ${LANGUAGES.join(', ')}` });
    }
    data.language = language;
  }
  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'Nothing to update' });
  }

  try {
    const profile = await prisma.profile.update({
      where: { userId: req.user.id },
      data,
      select: { displayName: true, handle: true, bio: true, language: true },
    });
    res.json(profile);
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Profile not found' });
    throw e;
  }
});

export default router;