// Puzzle generation and solving.
//
// Rules (a Star Battle variant), with `stars` pieces per unit:
//   * exactly `stars` per row
//   * exactly `stars` per column
//   * exactly `stars` per coloured region
//   * no two pieces touch, including diagonally
//
// At one star per unit the "no touching" rule collapses to a single check
// between neighbouring rows. At two it does not: two pieces share a row, so
// they must also keep their distance from each other.
//
// A solution is a sorted list of cell indices, `size * stars` of them.

import { createRng } from './rng.js';

export const MIN_SIZE = 5;
export const MAX_SIZE = 12;

const rowOptionCache = new Map();

/** Every way to put `stars` pieces in one row without them touching. */
function rowOptions(size, stars) {
  const key = `${size}:${stars}`;
  const cached = rowOptionCache.get(key);
  if (cached) return cached;

  const options = [];
  const build = (start, chosen) => {
    if (chosen.length === stars) {
      options.push(chosen.slice());
      return;
    }
    for (let col = start; col < size; col++) build(col + 2, [...chosen, col]);
  };
  build(0, []);

  rowOptionCache.set(key, options);
  return options;
}

const clashes = (a, b) => a.some((x) => b.some((y) => Math.abs(x - y) <= 1));

/** Build a random legal placement, or null if the shape admits none. */
function randomPlacement(size, stars, rng) {
  const options = rowOptions(size, stars);
  if (options.length === 0) return null;

  const used = new Uint8Array(size); // pieces placed per column so far
  const rows = new Array(size);

  const place = (row) => {
    if (row === size) return true;
    const rowsLeft = size - row;

    for (const option of rng.shuffle(options)) {
      if (option.some((col) => used[col] === stars)) continue;
      if (row > 0 && clashes(option, rows[row - 1])) continue;

      for (const col of option) used[col]++;
      // Every column still short by more than the rows remaining is hopeless.
      const reachable = [...used].every((count) => stars - count <= rowsLeft - 1);
      rows[row] = option; // the next row reads this to check for touching
      if (reachable && place(row + 1)) return true;
      for (const col of option) used[col]--;
    }
    return false;
  };

  if (!place(0)) return null;
  return rows.flatMap((option, row) => option.map((col) => row * size + col)).sort((a, b) => a - b);
}

/* ── Regions ─────────────────────────────────────── */

const manhattan = (size, a, b) =>
  Math.abs(Math.floor(a / size) - Math.floor(b / size)) + Math.abs((a % size) - (b % size));

/**
 * Split the pieces into one bunch per region. Nearby pieces go together so the
 * region that has to contain them does not need to snake across the board.
 */
function bunchPieces(size, stars, solution, rng) {
  if (stars === 1) return solution.map((cell) => [cell]);

  const left = rng.shuffle(solution);
  const bunches = [];

  while (left.length > 0) {
    const anchor = left.pop();
    const bunch = [anchor];
    while (bunch.length < stars && left.length > 0) {
      left.sort((a, b) => manhattan(size, a, anchor) - manhattan(size, b, anchor));
      const [partner] = left.splice(rng.int(Math.min(3, left.length)), 1);
      bunch.push(partner);
    }
    bunches.push(bunch);
  }

  return bunches.length === size ? bunches : null;
}

function neighbours(size, index) {
  const row = Math.floor(index / size);
  const col = index % size;
  const out = [];
  if (row > 0) out.push(index - size);
  if (row < size - 1) out.push(index + size);
  if (col > 0) out.push(index - 1);
  if (col < size - 1) out.push(index + 1);
  return out;
}

/** Shortest corridor of free cells joining `from` to the rest of region `label`. */
function corridorTo(size, regions, isPiece, from, label) {
  const cameFrom = new Map([[from, -1]]);
  const queue = [from];

  while (queue.length > 0) {
    const current = queue.shift();
    for (const next of neighbours(size, current)) {
      if (cameFrom.has(next)) continue;
      if (regions[next] === label && next !== from) {
        const path = [];
        for (let step = current; step !== from; step = cameFrom.get(step)) path.push(step);
        return path;
      }
      if (regions[next] !== -1 || isPiece[next]) continue;
      cameFrom.set(next, current);
      queue.push(next);
    }
  }
  return null;
}

/**
 * Grow `size` connected regions, each holding exactly `stars` pieces. The
 * pieces are placed first and joined up, then the leftover cells are flooded
 * outwards at random.
 */
function growRegions(size, stars, solution, rng) {
  const cells = size * size;
  const regions = new Int8Array(cells).fill(-1);
  const isPiece = new Uint8Array(cells);
  for (const cell of solution) isPiece[cell] = 1;

  const bunches = bunchPieces(size, stars, solution, rng);
  if (!bunches) return null;
  bunches.forEach((bunch, label) => bunch.forEach((cell) => (regions[cell] = label)));

  // Join tight bunches first; loose ones still have room once they come up.
  const spreadOf = (bunch) =>
    bunch.reduce((worst, a) => Math.max(worst, ...bunch.map((b) => manhattan(size, a, b))), 0);
  const order = bunches.map((_, i) => i).sort((a, b) => spreadOf(bunches[a]) - spreadOf(bunches[b]));

  for (const label of order) {
    for (const cell of bunches[label].slice(1)) {
      const corridor = corridorTo(size, regions, isPiece, cell, label);
      if (!corridor) return null;
      for (const step of corridor) regions[step] = label;
    }
  }

  const frontiers = bunches.map((_, label) => {
    const seed = [];
    for (let i = 0; i < cells; i++) {
      if (regions[i] === label) seed.push(...neighbours(size, i).filter((n) => regions[n] === -1));
    }
    return seed;
  });

  let remaining = 0;
  for (let i = 0; i < cells; i++) if (regions[i] === -1) remaining++;

  while (remaining > 0) {
    const open = [];
    for (let label = 0; label < size; label++) {
      frontiers[label] = frontiers[label].filter((index) => regions[index] === -1);
      if (frontiers[label].length > 0) open.push(label);
    }
    if (open.length === 0) return null;

    // Growing one region several steps in a row makes shapes snake instead of
    // every region puffing out into a near-square.
    let label = rng.pick(open);
    let streak = 1 + rng.int(3);
    while (streak-- > 0 && remaining > 0) {
      const choices = frontiers[label].filter((index) => regions[index] === -1);
      if (choices.length === 0) break;
      const index = rng.pick(choices);
      regions[index] = label;
      remaining--;
      frontiers[label].push(...neighbours(size, index).filter((n) => regions[n] === -1));
    }
  }

  return regions;
}

/* ── Solving ─────────────────────────────────────── */

// Backtracking is normally fast here, but a pathological shape could run
// away. Hitting the cap makes a puzzle look non-unique, so it gets discarded
// rather than shipped on a guess.
const NODE_CAP = 2_000_000;

/**
 * Walk every legal placement, handing each one to `onSolution`. Stops when
 * that returns false.
 */
function search(size, regions, stars, onSolution) {
  const options = rowOptions(size, stars);
  const colCount = new Uint8Array(size);
  const regionCount = new Uint8Array(size);
  const chosen = new Array(size);
  let nodes = 0;
  let capped = false;

  const step = (row, previous) => {
    if (nodes++ > NODE_CAP) {
      capped = true;
      return false;
    }
    if (row === size) {
      const cells = chosen.flatMap((option, r) => option.map((col) => r * size + col));
      return onSolution(cells.sort((a, b) => a - b));
    }

    const rowsLeft = size - row;

    for (const option of options) {
      if (previous && clashes(option, previous)) continue;

      let fits = true;
      const applied = [];
      for (const col of option) {
        const region = regions[row * size + col];
        if (colCount[col] === stars || regionCount[region] === stars) {
          fits = false;
          break;
        }
        colCount[col]++;
        regionCount[region]++;
        applied.push([col, region]);
      }

      if (fits) {
        let reachable = true;
        for (let col = 0; col < size; col++) {
          if (stars - colCount[col] > rowsLeft - 1) {
            reachable = false;
            break;
          }
        }
        if (reachable) {
          chosen[row] = option;
          if (!step(row + 1, option)) {
            for (const [col, region] of applied) {
              colCount[col]--;
              regionCount[region]--;
            }
            return false;
          }
        }
      }

      for (const [col, region] of applied) {
        colCount[col]--;
        regionCount[region]--;
      }
    }

    return true;
  };

  step(0, null);
  return capped;
}

/** Count solutions, stopping early once `limit` have been found. */
export function countSolutions(size, regions, limit = 2, stars = 1) {
  let count = 0;
  const capped = search(size, regions, stars, () => {
    count++;
    return count < limit;
  });
  return capped ? limit : count;
}

/** Solve a puzzle and return the piece cells, or null. */
export function solve(size, regions, stars = 1) {
  let found = null;
  search(size, regions, stars, (cells) => {
    found = cells;
    return false;
  });
  return found;
}

/** Up to `limit` legal placements that differ from `solution`. */
function findAlternates(size, regions, stars, solution, limit) {
  const wanted = solution.join(',');
  const found = [];
  search(size, regions, stars, (cells) => {
    if (cells.join(',') !== wanted) found.push(cells);
    return found.length < limit;
  });
  return found;
}

/* ── Forcing a unique answer ─────────────────────── */

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
    for (const next of neighbours(size, current)) {
      if (wanted.has(next) && !seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen.size === members.length;
}

/**
 * Move one cell to a neighbouring region, killing every unwanted solution
 * that used it. Such a cell carries a piece in those solutions but not in the
 * intended one, so the intended answer survives untouched while each of them
 * now crowds `stars + 1` pieces into the region the cell moved to.
 *
 * Which cell matters enormously. Taking them one solution at a time barely
 * dents a two-star board, where a loose layout can admit thousands; going for
 * the cell the most unwanted solutions share knocks out a swathe per move.
 */
function breakAlternates(size, regions, stars, solution, alternates, rng) {
  const intended = new Set(solution);
  const shared = new Map();
  for (const alternate of alternates) {
    for (const cell of alternate) {
      if (!intended.has(cell)) shared.set(cell, (shared.get(cell) ?? 0) + 1);
    }
  }

  const ranked = rng.shuffle([...shared.keys()]).sort((a, b) => shared.get(b) - shared.get(a));

  for (const index of ranked) {
    const from = regions[index];
    let sizeOfFrom = 0;
    for (const region of regions) if (region === from) sizeOfFrom++;
    if (sizeOfFrom < stars + 2) continue; // keep regions from withering away
    if (!staysConnected(size, regions, from, index)) continue;

    for (const neighbour of rng.shuffle(neighbours(size, index))) {
      if (regions[neighbour] === from) continue;
      regions[index] = regions[neighbour];
      return index;
    }
  }

  return null;
}

/**
 * Nudge a multi-solution layout towards a single answer.
 *
 * Each search is the expensive part, and it costs the most once solutions are
 * scarce: proving that only three remain means walking the whole tree. So one
 * search feeds several moves — after each move the solutions that used the
 * moved cell are struck off in memory, and only when the batch runs dry does
 * the solver run again. Moving cells does let fresh solutions appear, which
 * is exactly what the next round is for.
 */
function refine(size, regions, stars, solution, rng, rounds = 80) {
  for (let round = 0; round < rounds; round++) {
    let alternates = findAlternates(size, regions, stars, solution, 40);
    if (alternates.length === 0) return true;

    let moves = 0;
    while (alternates.length > 0 && moves < 8) {
      const moved = breakAlternates(size, regions, stars, solution, alternates, rng);
      if (moved === null) return false;
      moves++;
      alternates = alternates.filter((alternate) => !alternate.includes(moved));
    }
  }
  return false;
}

/**
 * Generate a puzzle with exactly one solution.
 * The same (size, seed, stars) triple always yields the same puzzle.
 */
export function generatePuzzle(size, seed, stars = 1) {
  if (size < MIN_SIZE || size > MAX_SIZE) {
    throw new RangeError(`size must be between ${MIN_SIZE} and ${MAX_SIZE}`);
  }
  const rng = createRng(seed);

  for (let attempt = 0; attempt < 200; attempt++) {
    const solution = randomPlacement(size, stars, rng);
    if (!solution) return null; // this size cannot hold that many pieces

    for (let shape = 0; shape < 20; shape++) {
      const regions = growRegions(size, stars, solution, rng);
      if (!regions) continue;
      if (!refine(size, regions, stars, solution, rng)) continue;
      if (countSolutions(size, regions, 2, stars) !== 1) continue;
      return { size, stars, seed, regions: Array.from(regions), solution };
    }
  }

  throw new Error(`could not generate a unique ${size}x${size} ${stars}-star puzzle for seed ${seed}`);
}
