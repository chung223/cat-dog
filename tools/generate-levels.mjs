// Pre-bakes the 100 campaign levels into src/levels.js.
//
// Difficulty runs on two axes. Board size grows for scale, but the real ramp
// is the hardest deduction each level demands (see src/analyze.js) — a 10x10
// with fat regions can be easier than a mean 7x7, so size alone is a bad
// curve. Levels are ordered by technique tier first, size second.
//
//   node tools/generate-levels.mjs

import { writeFileSync } from 'node:fs';
import { generatePuzzle, countSolutions } from '../src/puzzle.js';
import { rate, techniqueOf } from '../src/analyze.js';

// { levels, board size, hardest technique the level must actually require }
const CURVE = [
  { count: 10, size: 5, tier: 1 },
  { count: 8, size: 6, tier: 1 },
  { count: 10, size: 6, tier: 2 },
  { count: 8, size: 7, tier: 2 },
  { count: 12, size: 7, tier: 3 },
  { count: 12, size: 8, tier: 3 },
  { count: 10, size: 8, tier: 4 },
  { count: 10, size: 9, tier: 4 },
  { count: 10, size: 9, tier: 5 },
  { count: 10, size: 10, tier: 5 },
];

const MAX_ATTEMPTS = 6000;

/** Generate until every tier wanted at this size has a deep enough pool. */
function poolFor(size, wanted) {
  const pools = new Map([...wanted.keys()].map((tier) => [tier, []]));
  const target = (tier) => wanted.get(tier) * 2;

  let seed = size * 1_000_003 + 17;
  let attempts = 0;

  while (attempts < MAX_ATTEMPTS) {
    if ([...pools].every(([tier, pool]) => pool.length >= target(tier))) break;
    attempts++;

    const puzzle = generatePuzzle(size, seed++);
    if (countSolutions(size, puzzle.regions, 2) !== 1) continue;

    const rating = rate(size, puzzle.regions);
    if (!rating.solved) continue; // never ship a level that needs guessing

    const pool = pools.get(rating.tier);
    if (!pool || pool.length >= target(rating.tier)) continue;
    pool.push({ puzzle, rating });

    process.stdout.write(
      `\r${size}x${size}  ` +
        [...pools].map(([tier, list]) => `t${tier}:${list.length}/${target(tier)}`).join('  ') +
        `  (${attempts} tries)   `,
    );
  }

  // Easiest first inside a band, so difficulty still climbs within a tier.
  for (const pool of pools.values()) {
    pool.sort((a, b) => a.rating.effort - b.rating.effort || a.rating.counts[a.rating.tier - 1] - b.rating.counts[b.rating.tier - 1]);
  }
  process.stdout.write('\n');
  return pools;
}

const wantedBySize = new Map();
for (const band of CURVE) {
  if (!wantedBySize.has(band.size)) wantedBySize.set(band.size, new Map());
  const wanted = wantedBySize.get(band.size);
  wanted.set(band.tier, (wanted.get(band.tier) ?? 0) + band.count);
}

const poolsBySize = new Map();
for (const [size, wanted] of wantedBySize) {
  poolsBySize.set(size, poolFor(size, wanted));
}

const levels = [];
let number = 1;

for (const band of CURVE) {
  const pool = poolsBySize.get(band.size).get(band.tier);
  if (pool.length < band.count) {
    throw new Error(
      `only found ${pool.length}/${band.count} ${band.size}x${band.size} puzzles at tier ${band.tier}`,
    );
  }
  for (let i = 0; i < band.count; i++) {
    const { puzzle, rating } = pool.shift();
    levels.push({
      n: number++,
      s: band.size,
      d: band.tier,
      r: puzzle.regions.join(''),
      a: puzzle.solution.join(''),
      effort: rating.effort,
    });
  }
}

const body = levels
  .map((level) => `  { n: ${level.n}, s: ${level.s}, d: ${level.d}, r: '${level.r}', a: '${level.a}' },`)
  .join('\n');

writeFileSync(
  new URL('../src/levels.js', import.meta.url),
  `// GENERATED FILE - do not edit by hand.
// Regenerate with: node tools/generate-levels.mjs
//
//   n = level number, s = board size,
//   d = hardest deduction tier needed (see analyze.js TECHNIQUES),
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
    tier: level.d,
    regions: [...level.r].map(Number),
    solution: [...level.a].map(Number),
  };
}
`,
);

console.log('\ncurve:');
for (const band of CURVE) {
  const first = levels.find((level) => level.s === band.size && level.d === band.tier);
  console.log(
    `  ${String(band.count).padStart(3)} levels  ${band.size}x${band.size}  tier ${band.tier} ${techniqueOf(band.tier).name}` +
      `   (effort ${first.effort}…)`,
  );
}
