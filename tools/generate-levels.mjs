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
  { count: 5, size: 5, tier: 1 },
  { count: 5, size: 6, tier: 1 },
  { count: 7, size: 6, tier: 2 },
  { count: 7, size: 7, tier: 2 },
  { count: 12, size: 7, tier: 3 },
  { count: 12, size: 8, tier: 3 },
  { count: 13, size: 8, tier: 4 },
  { count: 13, size: 9, tier: 4 },
  { count: 13, size: 9, tier: 5 },
  { count: 13, size: 10, tier: 5 },
];

const MAX_ATTEMPTS = 20000;
// Deep pools so the top of each band reaches the genuinely nasty boards
// instead of whatever turned up first.
const POOL_FACTOR = 4;

/** Generate until every tier wanted at this size has a deep enough pool. */
function poolFor(size, wanted) {
  const pools = new Map([...wanted.keys()].map((tier) => [tier, []]));
  const target = (tier) => wanted.get(tier) * POOL_FACTOR;

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

  // Easiest first inside a band. How often the hardest technique is needed
  // hurts more than the raw step count, so it dominates the ordering.
  const score = ({ rating }) => rating.counts[rating.tier - 1] * 100 + rating.effort;
  for (const pool of pools.values()) pool.sort((a, b) => score(a) - score(b));
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

for (const [index, band] of CURVE.entries()) {
  const pool = poolsBySize.get(band.size).get(band.tier);
  if (pool.length < band.count) {
    throw new Error(
      `only found ${pool.length}/${band.count} ${band.size}x${band.size} puzzles at tier ${band.tier}`,
    );
  }
  // Spread the band evenly across its pool. Taking from the front would cap
  // the game at the easy end of every tier — the bug that left the old last
  // level easier than the middle of the game.
  //
  // A tier that spans two board sizes is one long ramp, so the second size
  // starts partway up its own pool; otherwise stepping up a size would reset
  // the climb and the bigger board would feel easier than the smaller one.
  const continuing = index > 0 && CURVE[index - 1].tier === band.tier;
  const floor = continuing ? Math.floor(pool.length * 0.45) : 0;
  const span = pool.length - 1 - floor;

  const picks = [];
  for (let i = 0; i < band.count; i++) {
    picks.push(pool[floor + Math.round((i * span) / (band.count - 1))]);
  }

  for (let i = 0; i < band.count; i++) {
    const { puzzle, rating } = picks[i];
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

/**
 * One lesson per technique: the smallest board that needs it, reaching for it
 * as early as possible so the student runs into the point of the lesson right
 * away rather than after ten routine moves.
 */
function findLesson(tier) {
  const sizes = tier <= 2 ? [5, 6] : [6, 7];
  let best = null;

  for (const size of sizes) {
    let seed = tier * 31_337 + size * 977;
    for (let attempt = 0; attempt < 4000; attempt++) {
      const puzzle = generatePuzzle(size, seed++);
      const rating = rate(size, puzzle.regions);
      if (!rating.solved || rating.tier !== tier) continue;

      const score = rating.topAt * 10 + rating.effort;
      if (!best || score < best.score) best = { puzzle, rating, size, score };
      if (rating.topAt <= 2 && rating.effort <= (tier <= 2 ? 3 : 6)) break;
    }
    if (best && best.rating.topAt <= 2) break;
  }

  if (!best) throw new Error(`no lesson found for tier ${tier}`);
  return best;
}

const lessons = [];
for (let tier = 1; tier <= 5; tier++) {
  const lesson = findLesson(tier);
  lessons.push({
    d: tier,
    s: lesson.size,
    r: lesson.puzzle.regions.join(''),
    a: lesson.puzzle.solution.join(''),
  });
  console.log(
    `lesson tier ${tier}: ${lesson.size}x${lesson.size}, technique appears at step ${lesson.rating.topAt} of ${lesson.rating.effort}`,
  );
}

const lessonBody = lessons
  .map((lesson) => `  { d: ${lesson.d}, s: ${lesson.s}, r: '${lesson.r}', a: '${lesson.a}' },`)
  .join('\n');

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
  return unpack(LEVELS.find((entry) => entry.n === number));
}

// One teaching board per technique, keyed by tier.
export const LESSONS = [
${lessonBody}
];

export function loadLesson(tier) {
  return unpack(LESSONS.find((entry) => entry.d === tier));
}

function unpack(entry) {
  if (!entry) return null;
  return {
    number: entry.n,
    size: entry.s,
    tier: entry.d,
    regions: [...entry.r].map(Number),
    solution: [...entry.a].map(Number),
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
