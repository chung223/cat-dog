// Pre-bakes the campaigns into src/levels.js.
//
// Difficulty runs on two axes. Board size grows for scale, but the real ramp
// is the hardest deduction each level demands (see src/analyze.js) — a 10x10
// with fat regions can be easier than a mean 7x7, so size alone is a bad
// curve. Levels are ordered by technique tier first, size second.
//
// The two-star campaign is its own thing. Almost every two-star board needs
// the top technique, so tiers cannot separate them; they are ranked by how
// many rounds of assume-and-contradict the solver is forced into.
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
  { count: 13, size: 8, tier: 5 },
  { count: 13, size: 9, tier: 5 },
  { count: 13, size: 9, tier: 6 },
  { count: 13, size: 10, tier: 6 },
];

// Two stars per row, column and region. Below 8x8 there is no legal placement
// at all — the pieces cannot keep their distance.
const CURVE_2 = [
  { count: 6, size: 8 },
  { count: 12, size: 9 },
  { count: 12, size: 10 },
];

const MAX_ATTEMPTS = 20000;
// Deep pools so the top of each band reaches the genuinely nasty boards
// instead of whatever turned up first.
const POOL_FACTOR = 4;

const encode = (cells) => cells.map((cell) => cell.toString(36).padStart(2, '0')).join('');

// How often the hardest technique is needed hurts more than the raw step
// count, so it dominates the ordering.
const score = ({ rating }) => rating.counts[rating.tier - 1] * 100 + rating.effort;

/**
 * Spread a band evenly across its pool. Taking from the front would cap the
 * game at the easy end of every tier — the bug that once left the last level
 * easier than the middle of the game.
 *
 * A band continuing the previous one starts at the first puzzle that is at
 * least as hard as where the last band finished, so stepping up a board size
 * never hands the player an easier board than the one before it.
 */
function pick(pool, count, minScore) {
  let floor = minScore === undefined ? 0 : pool.findIndex((entry) => score(entry) >= minScore);
  if (floor < 0) floor = 0;
  floor = Math.max(0, Math.min(floor, pool.length - count));

  const span = pool.length - 1 - floor;
  return Array.from({ length: count }, (_, i) => pool[floor + Math.round((i * span) / (count - 1))]);
}

/** Generate until every tier wanted at this size has a deep enough pool. */
function poolFor(size, stars, wanted) {
  const pools = new Map([...wanted.keys()].map((tier) => [tier, []]));
  const target = (tier) => wanted.get(tier) * POOL_FACTOR;

  let seed = size * 1_000_003 + stars * 7_919 + 17;
  let attempts = 0;

  while (attempts < MAX_ATTEMPTS) {
    if ([...pools].every(([tier, pool]) => pool.length >= target(tier))) break;
    attempts++;

    const puzzle = generatePuzzle(size, seed++, stars);
    if (!puzzle || countSolutions(size, puzzle.regions, 2, stars) !== 1) continue;

    const rating = rate(size, puzzle.regions, stars);
    if (!rating.solved) continue; // never ship a level that needs guessing

    const pool = pools.get(rating.tier);
    if (!pool || pool.length >= target(rating.tier)) continue;
    pool.push({ puzzle, rating });

    process.stdout.write(
      `\r${stars}★ ${size}x${size}  ` +
        [...pools].map(([tier, list]) => `t${tier}:${list.length}/${target(tier)}`).join('  ') +
        `  (${attempts} tries)   `,
    );
  }

  for (const pool of pools.values()) pool.sort((a, b) => score(a) - score(b));
  process.stdout.write('\n');
  return pools;
}

function buildCampaign(curve, stars) {
  const wantedBySize = new Map();
  for (const band of curve) {
    const tier = band.tier ?? 'any';
    if (!wantedBySize.has(band.size)) wantedBySize.set(band.size, new Map());
    const wanted = wantedBySize.get(band.size);
    wanted.set(tier, (wanted.get(tier) ?? 0) + band.count);
  }

  // With no tier named, whatever the board turns out to need is fine — the
  // ranking inside the pool does the sorting.
  const poolsBySize = new Map();
  for (const [size, wanted] of wantedBySize) {
    if (wanted.has('any')) {
      const need = wanted.get('any');
      const merged = [];
      let seed = size * 1_000_003 + stars * 7_919 + 17;
      let attempts = 0;
      while (merged.length < need * 3 && attempts < MAX_ATTEMPTS) {
        attempts++;
        const puzzle = generatePuzzle(size, seed++, stars);
        if (!puzzle || countSolutions(size, puzzle.regions, 2, stars) !== 1) continue;
        const rating = rate(size, puzzle.regions, stars);
        if (!rating.solved) continue;
        merged.push({ puzzle, rating });
        process.stdout.write(`\r${stars}★ ${size}x${size}  ${merged.length}/${need * 3}  (${attempts} tries)   `);
      }
      merged.sort((a, b) => score(a) - score(b));
      poolsBySize.set(size, new Map([['any', merged]]));
      process.stdout.write('\n');
    } else {
      poolsBySize.set(size, poolFor(size, stars, wanted));
    }
  }

  const levels = [];
  let number = 1;
  let lastScore;

  for (const [index, band] of curve.entries()) {
    const tier = band.tier ?? 'any';
    const pool = poolsBySize.get(band.size).get(tier);
    if (pool.length < band.count) {
      throw new Error(
        `only found ${pool.length}/${band.count} ${band.size}x${band.size} ${stars}-star puzzles at tier ${tier}`,
      );
    }
    const continuing = index > 0 && (curve[index - 1].tier ?? 'any') === tier;
    const chosen = pick(pool, band.count, continuing ? lastScore : undefined);
    lastScore = score(chosen.at(-1));

    for (const { puzzle, rating } of chosen) {
      levels.push({
        n: number++,
        s: band.size,
        d: rating.tier,
        r: puzzle.regions.join(''),
        a: encode(puzzle.solution),
        effort: rating.effort,
        top: rating.counts[rating.tier - 1],
      });
    }
  }

  return levels;
}

/**
 * One lesson per technique: the smallest board that needs it, reaching for it
 * as early as possible so the student runs into the point of the lesson right
 * away rather than after ten routine moves.
 */
function findLesson(tier) {
  // Pair-feasibility only exists once a unit holds more than one piece.
  const stars = tier === 4 ? 2 : 1;
  const sizes = stars === 2 ? [8] : tier <= 2 ? [5, 6] : [6, 7];
  let best = null;

  for (const size of sizes) {
    let seed = tier * 31_337 + size * 977;
    for (let attempt = 0; attempt < (stars === 2 ? 600 : 4000); attempt++) {
      const puzzle = generatePuzzle(size, seed++, stars);
      if (!puzzle) break;
      const rating = rate(size, puzzle.regions, stars);
      if (!rating.solved || rating.tier !== tier) continue;

      const value = rating.topAt * 10 + rating.effort;
      if (!best || value < best.value) best = { puzzle, rating, size, stars, value };
      if (rating.topAt <= 2 && rating.effort <= (tier <= 2 ? 3 : 8)) break;
    }
    if (best && best.rating.topAt <= 2) break;
  }

  if (!best) throw new Error(`no lesson found for tier ${tier}`);
  return best;
}

const levels = buildCampaign(CURVE, 1);
const levels2 = buildCampaign(CURVE_2, 2);

const lessons = [];
for (const tier of [1, 2, 3, 4, 5, 6]) {
  const lesson = findLesson(tier);
  lessons.push({
    d: tier,
    s: lesson.size,
    k: lesson.stars,
    r: lesson.puzzle.regions.join(''),
    a: encode(lesson.puzzle.solution),
  });
  console.log(
    `\nlesson tier ${tier} (${lesson.stars}★): ${lesson.size}x${lesson.size}, technique appears at step ${lesson.rating.topAt} of ${lesson.rating.effort}`,
  );
}

const asRows = (list, extra = '') =>
  list
    .map((level) => `  { ${extra}n: ${level.n ?? 0}, s: ${level.s}, d: ${level.d}, r: '${level.r}', a: '${level.a}' },`)
    .join('\n');

writeFileSync(
  new URL('../src/levels.js', import.meta.url),
  `// GENERATED FILE - do not edit by hand.
// Regenerate with: node tools/generate-levels.mjs
//
//   n = level number, s = board size, k = pieces per unit,
//   d = hardest deduction tier needed (see analyze.js TECHNIQUES),
//   r = region index per cell (row-major), a = solution cells in base 36

export const LEVELS = [
${asRows(levels)}
];

export const LEVELS_TWO_STAR = [
${asRows(levels2)}
];

export const LESSONS = [
${lessons.map((lesson) => `  { d: ${lesson.d}, s: ${lesson.s}, k: ${lesson.k}, r: '${lesson.r}', a: '${lesson.a}' },`).join('\n')}
];

export function campaign(stars = 1) {
  return stars === 2 ? LEVELS_TWO_STAR : LEVELS;
}

export function loadLevel(number, stars = 1) {
  return unpack(campaign(stars).find((entry) => entry.n === number), stars);
}

export function loadLesson(tier) {
  const lesson = LESSONS.find((entry) => entry.d === tier);
  return unpack(lesson, lesson?.k ?? 1);
}

function unpack(entry, stars) {
  if (!entry) return null;
  return {
    number: entry.n,
    size: entry.s,
    stars: entry.k ?? stars,
    tier: entry.d,
    regions: [...entry.r].map(Number),
    solution: (entry.a.match(/../g) ?? []).map((pair) => parseInt(pair, 36)),
  };
}
`,
);

console.log('\n1-star curve:');
for (const band of CURVE) {
  const first = levels.find((level) => level.s === band.size && level.d === band.tier);
  console.log(`  ${String(band.count).padStart(3)}  ${band.size}x${band.size}  tier ${band.tier} ${techniqueOf(band.tier).name}  (effort ${first.effort}…)`);
}
console.log('\n2-star campaign:');
for (const level of levels2) {
  console.log(`  #${String(level.n).padStart(2)}  ${level.s}x${level.s}  tier ${level.d}  ${level.effort} steps, ${level.top} of them ${techniqueOf(level.d).name}`);
}
