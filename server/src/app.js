import express from 'express';
import cors from 'cors';
import { prisma } from './db/prisma.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', async (_req, res) => {
  const users = await prisma.user.count();
  res.json({ status: 'ok', users });
});

export default app;