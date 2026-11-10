import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.ts';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const users = [
  { email: 'admin@cpstudio.dev', role: 'admin', displayName: 'Admin', handle: 'admin' },
  { email: 'akriti@cpstudio.dev', role: 'student', displayName: 'Akriti', handle: 'akriti' },
  { email: 'demo@cpstudio.dev', role: 'student', displayName: 'Demo User', handle: 'demo_user' },
];

const problems = [
  ['Two Sum Variant', 'two-sum-variant', 'Find two indices whose values add up to a target.', 800],
  ['Sort the Array', 'sort-the-array', 'Sort n integers in non-decreasing order.', 800],
  ['Max Subarray', 'max-subarray', 'Find the maximum sum of a contiguous subarray.', 1200],
  ['Prefix Sums', 'prefix-sums', 'Answer range-sum queries efficiently.', 1100],
  ['Binary Search Basics', 'binary-search-basics', 'Find the first index with value at least x.', 1000],
  ['Shortest Path', 'shortest-path', 'Shortest path in a weighted graph with non-negative edges.', 1700],
  ['Connected Components', 'connected-components', 'Count components in an undirected graph.', 1300],
  ['Knapsack', 'knapsack', 'Maximise value within a weight limit.', 1600],
  ['Longest Increasing Subsequence', 'lis', 'Length of the longest strictly increasing subsequence.', 1900],
  ['Segment Tree Queries', 'segment-tree-queries', 'Range minimum queries with point updates.', 2200],
];

async function main() {
  const passwordHash = bcrypt.hashSync('password123', 10);

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        passwordHash,
        role: u.role,
        profile: { create: { displayName: u.displayName, handle: u.handle } },
      },
    });
  }

  const author = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@cpstudio.dev' } });

  for (const [title, slug, statement, difficulty] of problems) {
    await prisma.problem.upsert({
      where: { slug },
      update: {},
      create: { title, slug, statement, difficulty, createdById: author.id },
    });
  }

  console.log('Seeded users:', await prisma.user.count(), 'problems:', await prisma.problem.count());
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());