// Pre-bakes the 100 campaign levels into src/levels.js.
//
// Generating a 10x10 puzzle takes a few hundred milliseconds, which is too
// slow to do while the player waits, so the campaign ships as data. Endless
// mode still generates on the fly.
//
//   node tools/generate-levels.mjs

import { writeFileSync } from 'node:fs';
import { generatePuzzle, countSolutions } from '../src/puzzle.js';

// [board size, how many levels at that size]
const PLAN = [
  [5, 12],
  [6, 16],
  [7, 20],
  [8, 22],
  [9, 18],
  [10, 12],
];

const levels = [];
let number = 1;

for (const [size, count] of PLAN) {
  for (let i = 0; i < count; i++) {
    const seed = size * 1_000_003 + number * 7919 + 17;
    const puzzle = generatePuzzle(size, seed);
    if (countSolutions(size, puzzle.regions, 2) !== 1) {
      throw new Error(`level ${number} is not uniquely solvable`);
    }
    levels.push({
      n: number,
      s: size,
      r: puzzle.regions.join(''),
      a: puzzle.solution.join(''),
    });
    process.stdout.write(`\rgenerated ${number}/100`);
    number++;
  }
}

const body = levels
  .map((level) => `  { n: ${level.n}, s: ${level.s}, r: '${level.r}', a: '${level.a}' },`)
  .join('\n');

writeFileSync(
  new URL('../src/levels.js', import.meta.url),
  `// GENERATED FILE - do not edit by hand.
// Regenerate with: node tools/generate-levels.mjs
//
//   n = level number, s = board size,
//   r = region index per cell (row-major), a = solved column per row

export const LEVELS = [
${body}
];

export function loadLevel(number) {
  const level = LEVELS.find((entry) => entry.n === number);
  if (!level) return null;
  return {
    number: level.n,
    size: level.s,
    regions: [...level.r].map(Number),
    solution: [...level.a].map(Number),
  };
}
`,
);

process.stdout.write(`\rgenerated ${levels.length}/100 levels\n`);
