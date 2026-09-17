// Checks every shipped level and lesson, plus a sample of endless puzzles.
//
//   node tools/verify-levels.mjs

import { LEVELS, LEVELS_TWO_STAR, LESSONS, campaign, loadLevel, loadLesson } from '../src/levels.js';
import { countSolutions, solve, generatePuzzle } from '../src/puzzle.js';
import { rate, techniqueOf, TECHNIQUES } from '../src/analyze.js';

let failures = 0;

function check(label, condition) {
  if (!condition) {
    failures++;
    console.error(`FAIL  ${label}`);
  }
}

function connected(size, regions, region) {
  const members = [];
  for (let i = 0; i < regions.length; i++) if (regions[i] === region) members.push(i);
  if (members.length === 0) return false;

  const wanted = new Set(members);
  const seen = new Set([members[0]]);
  const queue = [members[0]];
  while (queue.length > 0) {
    const current = queue.pop();
    const row = Math.floor(current / size);
    const col = current % size;
    const around = [];
    if (row > 0) around.push(current - size);
    if (row < size - 1) around.push(current + size);
    if (col > 0) around.push(current - 1);
    if (col < size - 1) around.push(current + 1);
    for (const next of around) {
      if (wanted.has(next) && !seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen.size === members.length;
}

function validate(label, size, regions, solution, stars) {
  check(`${label}: cell count`, regions.length === size * size);
  check(`${label}: region ids in range`, regions.every((r) => r >= 0 && r < size));
  check(`${label}: piece count`, solution.length === size * stars);

  for (let region = 0; region < size; region++) {
    check(`${label}: region ${region} is connected`, connected(size, regions, region));
  }

  const per = (key) => {
    const tally = new Map();
    for (const cell of solution) tally.set(key(cell), (tally.get(key(cell)) ?? 0) + 1);
    return tally;
  };

  for (const [name, key] of [
    ['row', (c) => Math.floor(c / size)],
    ['column', (c) => c % size],
    ['region', (c) => regions[c]],
  ]) {
    const tally = per(key);
    check(
      `${label}: exactly ${stars} per ${name}`,
      tally.size === size && [...tally.values()].every((count) => count === stars),
    );
  }

  for (const a of solution) {
    for (const b of solution) {
      if (a >= b) continue;
      const touching =
        Math.abs(Math.floor(a / size) - Math.floor(b / size)) <= 1 &&
        Math.abs((a % size) - (b % size)) <= 1;
      check(`${label}: ${a} and ${b} not touching`, !touching);
    }
  }

  check(`${label}: exactly one solution`, countSolutions(size, regions, 3, stars) === 1);
  check(`${label}: solver agrees`, String(solve(size, regions, stars)) === String(solution));
}

/**
 * The two campaigns are ordered on different keys, so they are checked on
 * different keys. One star climbs by technique tier; two star cannot, because
 * nearly every board there needs the top technique, so it climbs by how much
 * of that technique it takes.
 */
function auditCampaign(stars) {
  const levels = campaign(stars);
  const name = `${stars}-star`;
  const byTier = stars === 1;
  check(`${name}: has levels`, levels.length > 0);
  check(`${name}: numbered 1..n`, levels.every((level, i) => level.n === i + 1));

  const scored = [];
  let previous = { tier: 0, size: 0 };

  for (const entry of levels) {
    const level = loadLevel(entry.n, stars);
    validate(`${name} level ${entry.n}`, level.size, level.regions, level.solution, stars);

    // Every campaign level must be reachable by pure logic, and the recorded
    // tier has to be the one the solver actually needs.
    const rating = rate(level.size, level.regions, stars);
    check(`${name} level ${entry.n}: solvable without guessing`, rating.solved);
    check(
      `${name} level ${entry.n}: tier ${entry.d} matches solver (got ${rating.tier})`,
      rating.tier === entry.d,
    );

    if (byTier) {
      const order = (x) => x.tier * 100 + x.size;
      check(
        `${name} level ${entry.n}: not easier than the one before`,
        order({ tier: entry.d, size: entry.s }) >= order(previous),
      );
      previous = { tier: entry.d, size: entry.s };
    }

    scored.push({
      n: entry.n,
      size: entry.s,
      tier: entry.d,
      score: rating.counts[entry.d - 1] * 100 + rating.effort,
    });
  }

  // Guard against the bug that once capped the game at the easy end of every
  // tier: the difficulty must climb, and the finale must be among the hardest.
  if (byTier) {
    let band = [scored[0]];
    for (const level of scored.slice(1).concat([null])) {
      if (level && level.tier === band[0].tier && level.size === band[0].size) {
        band.push(level);
        continue;
      }
      const first = band[0];
      const last = band.at(-1);
      check(
        `${name} band ${first.size}x${first.size} tier ${first.tier}: climbs (#${first.n} ${first.score} -> #${last.n} ${last.score})`,
        last.score > first.score,
      );
      if (level) band = [level];
    }
  } else {
    for (let i = 1; i < scored.length; i++) {
      check(
        `${name} level ${scored[i].n}: not easier than #${scored[i - 1].n} (${scored[i - 1].score} -> ${scored[i].score})`,
        scored[i].score >= scored[i - 1].score,
      );
    }
  }

  const ranked = scored.slice().sort((a, b) => b.score - a.score);
  const finaleRank = ranked.findIndex((level) => level.n === levels.length) + 1;
  check(`${name}: last level is a finale (ranked ${finaleRank} of ${levels.length})`, finaleRank <= 5);

  const spread = new Map();
  for (const level of scored) {
    const key = `tier ${level.tier} ${techniqueOf(level.tier).name}`;
    spread.set(key, (spread.get(key) ?? 0) + 1);
  }
  return spread;
}

const oneStar = auditCampaign(1);
const twoStar = auditCampaign(2);

check('one lesson per technique', LESSONS.length === TECHNIQUES.length);
for (const technique of TECHNIQUES) {
  const lesson = loadLesson(technique.tier);
  check(`lesson ${technique.tier}: exists`, Boolean(lesson));
  if (!lesson) continue;

  validate(`lesson ${technique.tier}`, lesson.size, lesson.regions, lesson.solution, lesson.stars);
  const rating = rate(lesson.size, lesson.regions, lesson.stars);
  check(
    `lesson ${technique.tier}: needs exactly tier ${technique.tier} (got ${rating.tier})`,
    rating.tier === technique.tier,
  );
  // A lesson that spends ten moves on easy stuff first teaches nothing.
  check(`lesson ${technique.tier}: technique shows up early (step ${rating.topAt})`, rating.topAt <= 4);
}

for (const [stars, sizes] of [
  [1, [5, 6, 7, 8, 9, 10]],
  [2, [8, 9]],
]) {
  for (const size of sizes) {
    for (let i = 0; i < 3; i++) {
      const puzzle = generatePuzzle(size, 424242 + size * 1000 + i, stars);
      validate(`endless ${stars}★ ${size}x${size} #${i}`, size, puzzle.regions, puzzle.solution, stars);
    }
  }
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}

console.log(
  `all checks passed (${LEVELS.length} one-star + ${LEVELS_TWO_STAR.length} two-star levels, ` +
    `${LESSONS.length} lessons, 24 endless puzzles)`,
);
for (const [label, spread] of [['one star', oneStar], ['two star', twoStar]]) {
  console.log(`  ${label}: ${[...spread].map(([k, v]) => `${k} ×${v}`).join(', ')}`);
}
