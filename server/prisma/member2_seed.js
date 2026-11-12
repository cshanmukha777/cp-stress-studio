import { prisma } from '../src/db/prisma.js';

const fixture = 'member2-day5-v1';
const problemId = Number(process.argv[2]);
const prefix = '[Member 2 Day 5]';

async function seed() {
  if (!Number.isInteger(problemId) || problemId < 1 || problemId > 2147483647) {
    throw new Error('Usage: node prisma/member2_seed.js <existing-problem-id>');
  }
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(527401, ${problemId}::integer)`;
    await tx.problem.findUniqueOrThrow({ where: { id: problemId }, select: { id: true } });

    await tx.submission.deleteMany({ where: { problemId, request: { path: ['fixture'], equals: fixture } } });
    const solutions = [];
    for (const [label, code] of [
      ['Fast', 'a, b = map(int, input().split())\nprint(a + b)'],
      ['Reference', 'a, b = map(int, input().split())\nprint(sum([a, b]))'],
    ]) {
      const name = `${prefix} ${label}`;
      const existing = await tx.solution.findFirst({ where: { problemId, name } });
      solutions.push(existing ?? await tx.solution.create({
        data: { problemId, name, language: 'python', code },
      }));
    }

    for (const [caseNumber, input, expected] of [
      [51001, '2 3\n', '5\n'],
      [51002, '-4 9\n', '5\n'],
    ]) {
      const name = `${prefix} Sum ${caseNumber}`;
      const existing = await tx.testCase.findUnique({ where: { problemId_caseNumber: { problemId, caseNumber } } });
      if (existing && existing.name !== name) throw new Error(`Case ${caseNumber} is already in use`);
      await tx.testCase.upsert({
        where: { problemId_caseNumber: { problemId, caseNumber } },
        create: { problemId, caseNumber, name, input, expected },
        update: { input, expected },
      });
    }

    await tx.submission.createMany({ data: [
      [0, 'AC', 12, 8200], [0, 'AC', 18, 8700],
      [1, 'AC', 65, 14200], [1, 'AC', 85, 15400],
      [1, 'WA', 61, 14000], [1, 'TLE', 2000, 16500], [1, 'CE', null, null],
    ].map(([index, verdict, runtimeMs, memoryKiB]) => ({
      problemId, solutionId: solutions[index].id, verdict, runtimeMs, memoryKiB,
      request: { fixture, language: 'python', code: solutions[index].code, stdin: '2 3\n', timeLimit: 2000 },
      result: { status: verdict, time: runtimeMs, memory: memoryKiB, stdout: verdict === 'AC' ? '5\n' : verdict === 'WA' ? '4\n' : '', stderr: verdict === 'CE' ? 'Synthetic compilation failure' : '' },
    })) });
  });
  console.log(`Seeded problem ${problemId}. Fixture AC averages: Fast 15 ms, Reference 75 ms, combined 45 ms.`);
}

try {
  await seed();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
