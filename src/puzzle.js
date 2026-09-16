// Puzzle generation and solving for "Shiba Hunt".
//
// Rules (a Star Battle / N-Queens variant):
//   * exactly one shiba per row
//   * exactly one shiba per column
//   * exactly one shiba per coloured region
//   * no two shibas touch, including diagonally
//
// Because rows and columns already hold one shiba each, the "no touching"
// rule collapses to a single check: shibas in adjacent rows must sit at
// least two columns apart.

import { createRng } from './rng.js';

export const MIN_SIZE = 5;
export const MAX_SIZE = 10;

/** Build a random valid shiba placement: solution[row] = column. */
function randomPlacement(size, rng) {
  const solution = new Array(size).fill(-1);
  const usedCols = new Array(size).fill(false);

  const place = (row) => {
    if (row === size) return true;
    for (const col of rng.shuffle([...Array(size).keys()])) {
      if (usedCols[col]) continue;
      if (row > 0 && Math.abs(col - solution[row - 1]) <= 1) continue;
      solution[row] = col;
      usedCols[col] = true;
      if (place(row + 1)) return true;
      usedCols[col] = false;
      solution[row] = -1;
    }
    return false;
  };

  return place(0) ? solution : null;
}

/**
 * Flood-fill `size` connected regions outwards from the shibas, so every
 * region is connected and holds exactly one shiba.
 */
function growRegions(size, solution, rng) {
  const cells = size * size;
  const regions = new Int8Array(cells).fill(-1);
  const frontiers = [];

  for (let row = 0; row < size; row++) {
    const index = row * size + solution[row];
    regions[index] = row;
    frontiers.push([]);
  }
  for (let row = 0; row < size; row++) {
    pushNeighbours(regions, frontiers[row], size, row * size + solution[row]);
  }

  let remaining = cells - size;
  while (remaining > 0) {
    const open = [];
    for (let r = 0; r < size; r++) {
      frontiers[r] = frontiers[r].filter((index) => regions[index] === -1);
      if (frontiers[r].length > 0) open.push(r);
    }
    if (open.length === 0) return null; // unreachable on a connected grid

    // Growing the same region a few steps in a row makes the shapes snake
    // instead of all puffing out into near-squares.
    let region = rng.pick(open);
    let streak = 1 + rng.int(3);
    while (streak-- > 0 && remaining > 0) {
      const options = frontiers[region].filter((index) => regions[index] === -1);
      if (options.length === 0) break;
      const index = rng.pick(options);
      regions[index] = region;
      remaining--;
      pushNeighbours(regions, frontiers[region], size, index);
    }
  }

  return regions;
}

function pushNeighbours(regions, frontier, size, index) {
  const row = Math.floor(index / size);
  const col = index % size;
  if (row > 0 && regions[index - size] === -1) frontier.push(index - size);
  if (row < size - 1 && regions[index + size] === -1) frontier.push(index + size);
  if (col > 0 && regions[index - 1] === -1) frontier.push(index - 1);
  if (col < size - 1 && regions[index + 1] === -1) frontier.push(index + 1);
}

/** Find a valid placement that differs from `solution`, or null. */
function findAlternate(size, regions, solution) {
  let found = null;

  const search = (row, usedCols, usedRegions, prevCol, path, differs) => {
    if (found) return;
    if (row === size) {
      if (differs) found = path.slice();
      return;
    }
    for (let col = 0; col < size; col++) {
      if (usedCols & (1 << col)) continue;
      if (prevCol >= 0 && Math.abs(col - prevCol) <= 1) continue;
      const region = regions[row * size + col];
      if (usedRegions & (1 << region)) continue;
      path.push(col);
      search(
        row + 1,
        usedCols | (1 << col),
        usedRegions | (1 << region),
        col,
        path,
        differs || col !== solution[row],
      );
      path.pop();
      if (found) return;
    }
  };

  search(0, 0, 0, -1, [], false);
  return found;
}

/** True if `region` stays connected after `index` is taken out of it. */
function staysConnected(size, regions, region, index) {
  const members = [];
  for (let i = 0; i < regions.length; i++) {
    if (regions[i] === region && i !== index) members.push(i);
  }
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

/**
 * Kill one unwanted solution by moving a single cell to a neighbouring
 * region. The cell sits on `alternate` but not on the intended solution, so
 * the intended solution survives untouched while `alternate` stops being
 * legal. Returns false when no safe move exists.
 */
function breakAlternate(size, regions, solution, alternate, rng) {
  const rows = rng.shuffle(
    [...Array(size).keys()].filter((row) => alternate[row] !== solution[row]),
  );

  for (const row of rows) {
    const index = row * size + alternate[row];
    const from = regions[index];
    const sizeOfFrom = regions.reduce((total, r) => total + (r === from ? 1 : 0), 0);
    if (sizeOfFrom < 3) continue; // keep regions from withering away
    if (!staysConnected(size, regions, from, index)) continue;

    const col = index % size;
    const candidates = [];
    if (row > 0) candidates.push(index - size);
    if (row < size - 1) candidates.push(index + size);
    if (col > 0) candidates.push(index - 1);
    if (col < size - 1) candidates.push(index + 1);

    for (const neighbour of rng.shuffle(candidates)) {
      const to = regions[neighbour];
      if (to === from) continue;
      regions[index] = to;
      return true;
    }
  }

  return false;
}

/**
 * Nudge a multi-solution layout towards a single solution, one cell at a
 * time. Returns true once exactly one solution remains.
 */
function refine(size, regions, solution, rng, maxSteps = 600) {
  for (let step = 0; step < maxSteps; step++) {
    const alternate = findAlternate(size, regions, solution);
    if (!alternate) return true;
    if (!breakAlternate(size, regions, solution, alternate, rng)) return false;
  }
  return false;
}

/** Count solutions, stopping early once `limit` have been found. */
export function countSolutions(size, regions, limit = 2) {
  let count = 0;

  const search = (row, usedCols, usedRegions, prevCol) => {
    if (row === size) {
      count++;
      return;
    }
    for (let col = 0; col < size; col++) {
      if (usedCols & (1 << col)) continue;
      if (prevCol >= 0 && Math.abs(col - prevCol) <= 1) continue;
      const region = regions[row * size + col];
      if (usedRegions & (1 << region)) continue;
      search(row + 1, usedCols | (1 << col), usedRegions | (1 << region), col);
      if (count >= limit) return;
    }
  };

  search(0, 0, 0, -1);
  return count;
}

/** Solve a puzzle and return solution[row] = column, or null. */
export function solve(size, regions) {
  const solution = new Array(size).fill(-1);

  const search = (row, usedCols, usedRegions, prevCol) => {
    if (row === size) return true;
    for (let col = 0; col < size; col++) {
      if (usedCols & (1 << col)) continue;
      if (prevCol >= 0 && Math.abs(col - prevCol) <= 1) continue;
      const region = regions[row * size + col];
      if (usedRegions & (1 << region)) continue;
      solution[row] = col;
      if (search(row + 1, usedCols | (1 << col), usedRegions | (1 << region), col)) return true;
      solution[row] = -1;
    }
    return false;
  };

  return search(0, 0, 0, -1) ? solution : null;
}

/**
 * Generate a puzzle with exactly one solution.
 * The same (size, seed) pair always yields the same puzzle.
 */
export function generatePuzzle(size, seed) {
  if (size < MIN_SIZE || size > MAX_SIZE) {
    throw new RangeError(`size must be between ${MIN_SIZE} and ${MAX_SIZE}`);
  }
  const rng = createRng(seed);

  for (let attempt = 0; attempt < 200; attempt++) {
    const solution = randomPlacement(size, rng);
    if (!solution) continue;

    for (let shape = 0; shape < 20; shape++) {
      const regions = growRegions(size, solution, rng);
      if (!regions) continue;
      if (!refine(size, regions, solution, rng)) continue;
      if (countSolutions(size, regions, 2) !== 1) continue;
      return { size, seed, regions: Array.from(regions), solution };
    }
  }

  throw new Error(`could not generate a unique ${size}x${size} puzzle for seed ${seed}`);
}

/** Region index -> list of cell indices. Handy for rendering borders. */
export function regionCells(size, regions) {
  const buckets = Array.from({ length: size }, () => []);
  for (let i = 0; i < regions.length; i++) buckets[regions[i]].push(i);
  return buckets;
}
