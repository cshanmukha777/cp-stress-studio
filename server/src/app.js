import express from 'express';
import cors from 'cors';
import { prisma } from './db/prisma.js';
import authRouter from './routes/auth.routes.js';
import problemRouter from './routes/problem.routes.js';
import problemTagsRouter from './routes/problem-tags.routes.js';
import tagRouter from './routes/tag.routes.js';
import profileRouter from './routes/profile.routes.js';
import templateRouter from './routes/template.routes.js';
import executionRouter from './routes/execution.routes.js';
import analyticsRouter from './routes/analytics.routes.js';

const app = express();
app.use(cors());
app.use('/api/execution', express.json({ limit: '16mb' }), executionRouter);
app.use(express.json());

app.get('/api/health', async (_req, res) => {
  const users = await prisma.user.count();
  res.json({ status: 'ok', users });
});

app.use('/api/auth', authRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/problems', problemTagsRouter);
app.use('/api/problems', problemRouter);
app.use('/api/tags', tagRouter);
app.use('/api/templates', templateRouter);
app.use('/api/profile', profileRouter);

app.use((error, _req, res, next) => {
  if (res.headersSent) return next(error);
  const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 500
    ? error.status
    : 500;
  const message = status === 400
    ? 'Invalid JSON request body'
    : status === 413
      ? 'Request body is too large'
      : 'Internal server error';
  res.status(status).json({ error: message });
});

export default app;
