import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

export const TEMPLATE_DIR = path.resolve(
  process.env.TEMPLATE_DIR || path.join(process.cwd(), 'templates'),
);

export function templatePath(slug) {
  const safe = path.basename(String(slug));
  return path.join(TEMPLATE_DIR, `${safe}.json`);
}

export async function writeTemplate(problem) {
  await fs.mkdir(TEMPLATE_DIR, { recursive: true });
  const file = templatePath(problem.slug);
  const body = {
    title: problem.title,
    slug: problem.slug,
    statement: problem.statement,
    difficulty: problem.difficulty,
  };
  await fs.writeFile(file, JSON.stringify(body, null, 2), 'utf8');
  return file;
}

export async function readTemplate(slug) {
  const raw = await fs.readFile(templatePath(slug), 'utf8');
  return JSON.parse(raw);
}

export async function listTemplates() {
  try {
    const files = await fs.readdir(TEMPLATE_DIR);
    return files.filter((f) => f.endsWith('.json')).map((f) => path.basename(f, '.json'));
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
}