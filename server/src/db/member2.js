import { prisma } from './prisma.js';

export function getProblemExecution(problemId) {
  return prisma.problem.findUnique({
    where: { id: problemId },
    select: {
      id: true,
      title: true,
      solutions: {
        orderBy: { id: 'asc' },
        select: { id: true, name: true, language: true, code: true },
      },
      testCases: {
        orderBy: { caseNumber: 'asc' },
        omit: { expected: true },
      },
    },
  });
}

export const solutions = {
  create: (problemId, data) => prisma.solution.create({ data: { problemId, ...data } }),
  get: (problemId, id) => prisma.solution.findUnique({ where: { problemId_id: { problemId, id } } }),
  update: (problemId, id, data) =>
    prisma.solution.update({ where: { problemId_id: { problemId, id } }, data }),
  remove: (problemId, id) => prisma.$transaction([
    prisma.submission.updateMany({ where: { problemId, solutionId: id }, data: { solutionId: null } }),
    prisma.solution.delete({ where: { problemId_id: { problemId, id } } }),
  ]),
};

export const testCases = {
  create: (problemId, caseNumber, data) =>
    prisma.testCase.create({ data: { problemId, caseNumber, ...data }, omit: { expected: true } }),
  get: (problemId, caseNumber) =>
    prisma.testCase.findUnique({ where: { problemId_caseNumber: { problemId, caseNumber } } }),
  update: (problemId, caseNumber, data) =>
    prisma.testCase.update({
      where: { problemId_caseNumber: { problemId, caseNumber } },
      data,
      omit: { expected: true },
    }),
  remove: (problemId, caseNumber) =>
    prisma.testCase.delete({ where: { problemId_caseNumber: { problemId, caseNumber } } }),
};

export const submissions = {
  create: (data) => prisma.submission.create({ data }),
  list: (problemId) => prisma.submission.findMany({
    where: { problemId },
    orderBy: { id: 'desc' },
    take: 100,
    omit: { request: true, result: true },
  }),
  get: (problemId, id) => prisma.submission.findUnique({ where: { id, problemId } }),
};
