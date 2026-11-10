import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

router.post('/register', async (req, res) => {
  const { email, password, displayName, handle } = req.body;
  if (!email || !password || !displayName || !handle) {
    return res.status(400).json({ error: 'email, password, displayName and handle are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    const user = await prisma.user.create({
      data: {
        email: email.trim().toLowerCase(),
        passwordHash: await bcrypt.hash(password, 10),
        profile: { create: { displayName: displayName.trim(), handle: handle.trim() } },
      },
      include: { profile: true },
    });
    res.status(201).json({
      token: signToken(user),
      user: { id: user.id, email: user.email, role: user.role, profile: user.profile },
    });
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'Email or handle already taken' });
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    include: { profile: true },
  });
  const ok = user && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

  res.json({
    token: signToken(user),
    user: { id: user.id, email: user.email, role: user.role, profile: user.profile },
  });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, email: true, role: true, createdAt: true, profile: true },
  });
  res.json(user);
});

export default router;