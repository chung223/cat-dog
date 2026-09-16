// Checks every shipped level, plus a sample of endless-mode puzzles.
//
//   node tools/verify-levels.mjs

import { LEVELS, LESSONS, loadLevel, loadLesson } from '../src/levels.js';
import { countSolutions, solve, generatePuzzle } from '../src/puzzle.js';
import { rate, techniqueOf } from '../src/analyze.js';

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
    const neighbours = [];
    if (row > 0) neighbours.push(current - size);
    if (row < size - 1) neighbours.push(current + size);
    if (col > 0) neighbours.push(current - 1);
    if (col < size - 1) neighbours.push(current + 1);
    for (const n of neighbours) {
      if (wanted.has(n) && !seen.has(n)) {
        seen.add(n);
        queue.push(n);
      }
    }
  }
  return seen.size === members.length;
}

function validate(label, size, regions, solution) {
  check(`${label}: cell count`, regions.length === size * size);
  check(`${label}: region ids in range`, regions.every((r) => r >= 0 && r < size));

  for (let region = 0; region < size; region++) {
    check(`${label}: region ${region} is connected`, connected(size, regions, region));
  }

  const columns = new Set(solution);
  check(`${label}: one shiba per column`, columns.size === size);
  check(`${label}: columns in range`, solution.every((c) => c >= 0 && c < size));

  const used = new Set(solution.map((col, row) => regions[row * size + col]));
  check(`${label}: one shiba per region`, used.size === size);

  for (let row = 1; row < size; row++) {
    check(`${label}: rows ${row - 1}/${row} not touching`, Math.abs(solution[row] - solution[row - 1]) > 1);
  }

  check(`${label}: exactly one solution`, countSolutions(size, regions, 3) === 1);
  check(`${label}: solver agrees`, String(solve(size, regions)) === String(solution));
}

check('100 levels shipped', LEVELS.length === 100);
check('level numbers are 1..100', LEVELS.every((level, i) => level.n === i + 1));

let previous = { tier: 0, size: 0 };
const spread = new Map();

for (const entry of LEVELS) {
  const level = loadLevel(entry.n);
  validate(`level ${entry.n}`, level.size, level.regions, level.solution);

  // Every campaign level must be reachable by pure logic, and the recorded
  // tier has to be the one the solver actually needs.
  const rating = rate(level.size, level.regions);
  check(`level ${entry.n}: solvable without guessing`, rating.solved);
  check(`level ${entry.n}: tier ${entry.d} matches solver (got ${rating.tier})`, rating.tier === entry.d);

  // Difficulty never goes backwards: tier first, board size second.
  const order = (x) => x.tier * 100 + x.size;
  check(
    `level ${entry.n}: not easier than level ${entry.n - 1}`,
    order({ tier: entry.d, size: entry.s }) >= order(previous),
  );
  previous = { tier: entry.d, size: entry.s };

  const key = `tier ${entry.d} ${techniqueOf(entry.d).name}`;
  spread.set(key, (spread.get(key) ?? 0) + 1);
}

check('one lesson per technique', LESSONS.length === 5);
for (let tier = 1; tier <= 5; tier++) {
  const lesson = loadLesson(tier);
  check(`lesson ${tier}: exists`, Boolean(lesson));
  if (!lesson) continue;

  validate(`lesson ${tier}`, lesson.size, lesson.regions, lesson.solution);
  const rating = rate(lesson.size, lesson.regions);
  check(`lesson ${tier}: needs exactly tier ${tier} (got ${rating.tier})`, rating.tier === tier);
  // A lesson that spends ten moves on easy stuff first teaches nothing.
  check(`lesson ${tier}: technique shows up early (step ${rating.topAt})`, rating.topAt <= 4);
  check(`lesson ${tier}: stays short (${rating.effort} steps)`, rating.effort <= 8);
}

for (const size of [5, 6, 7, 8, 9, 10]) {
  for (let i = 0; i < 5; i++) {
    const puzzle = generatePuzzle(size, 424242 + size * 1000 + i);
    validate(`endless ${size}x${size} #${i}`, size, puzzle.regions, puzzle.solution);
  }
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log(`all checks passed (${LEVELS.length} levels + ${LESSONS.length} lessons + 30 endless puzzles)`);
for (const [key, count] of spread) console.log(`  ${key}: ${count} levels`);
