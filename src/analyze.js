// Rates a puzzle by the hardest deduction a human needs to finish it, and can
// explain the next move from any board position.
//
// The solver only applies techniques a person could reasonably spot, always
// reaching for the cheapest one that makes progress. The rating is the hardest
// technique it was ever forced to use — a far better difficulty signal than
// board size.

export const TECHNIQUES = [
  {
    tier: 1,
    id: 'single',
    name: '唯一格',
    hint: '某一列、某一欄或某個顏色區塊，只剩下一格還能放。',
  },
  {
    tier: 2,
    id: 'confine',
    name: '區塊鎖定',
    hint: '某個顏色區塊的可能位置全擠在同一列（或同一欄），那一列的其他格就都不行了。',
  },
  {
    tier: 3,
    id: 'sweep',
    name: '共同排除',
    hint: '某一列／欄／區塊不管放在哪個位置，都會殺掉同一格——那格就是死的。',
  },
  {
    tier: 4,
    id: 'hall',
    name: '集合配對',
    hint: 'k 個區塊的可能位置只落在 k 列裡，這 k 列就被它們包了，其他區塊進不來。',
  },
  {
    tier: 5,
    id: 'assume',
    name: '假設反證',
    hint: '先假設放在某一格，一路推下去會出現矛盾，所以那一格不能放。',
  },
];

export const UNKNOWN = 0;
export const EXCLUDED = 1;
export const PLACED = 2;

const KIND_NAMES = { row: '列', col: '欄', region: '顏色區塊' };

function describe(unit) {
  return unit.kind === 'region' ? '這個顏色區塊' : `第 ${unit.index + 1} ${KIND_NAMES[unit.kind]}`;
}

export function buildContext(size, regions) {
  const cells = size * size;
  const rows = [];
  const cols = [];
  const regs = [];

  for (let i = 0; i < size; i++) {
    rows.push({ kind: 'row', index: i, cells: [] });
    cols.push({ kind: 'col', index: i, cells: [] });
    regs.push({ kind: 'region', index: i, cells: [] });
  }
  for (let i = 0; i < cells; i++) {
    rows[Math.floor(i / size)].cells.push(i);
    cols[i % size].cells.push(i);
    regs[regions[i]].cells.push(i);
  }

  // kills[c][x] — placing at c rules x out.
  const kills = [];
  for (let c = 0; c < cells; c++) {
    const row = Math.floor(c / size);
    const col = c % size;
    const mask = new Uint8Array(cells);
    for (let x = 0; x < cells; x++) {
      if (x === c) continue;
      const xr = Math.floor(x / size);
      const xc = x % size;
      if (
        xr === row ||
        xc === col ||
        regions[x] === regions[c] ||
        (Math.abs(xr - row) <= 1 && Math.abs(xc - col) <= 1)
      ) {
        mask[x] = 1;
      }
    }
    kills.push(mask);
  }

  return {
    size,
    cells,
    regions,
    rows,
    cols,
    regs,
    units: [...rows, ...cols, ...regs],
    kills,
    rowOf: (i) => Math.floor(i / size),
    colOf: (i) => i % size,
    regionOf: (i) => regions[i],
  };
}

const openCells = (unit, state) => unit.cells.filter((i) => state[i] === UNKNOWN);
const isFilled = (unit, state) => unit.cells.some((i) => state[i] === PLACED);

export function place(context, state, index) {
  state[index] = PLACED;
  const mask = context.kills[index];
  for (let x = 0; x < context.cells; x++) {
    if (mask[x] && state[x] === UNKNOWN) state[x] = EXCLUDED;
  }
}

function broken(context, state) {
  return context.units.some((unit) => !isFilled(unit, state) && openCells(unit, state).length === 0);
}

function complete(context, state) {
  return context.units.every((unit) => isFilled(unit, state));
}

/**
 * Techniques share one signature: mutate `state`, return truthy on progress.
 * With `first` set they stop after a single deduction and return a report, so
 * the same code drives both the difficulty rating and the in-game hint.
 */

/* ── Tier 1: only one square left in a row, column or region ─── */

function applySingle(context, state, first) {
  let progress = false;
  for (const unit of context.units) {
    if (isFilled(unit, state)) continue;
    const open = openCells(unit, state);
    if (open.length !== 1) continue;
    place(context, state, open[0]);
    if (first) {
      return { tier: 1, place: open[0], because: `${describe(unit)}只剩下這一格可以放。`, focus: unit.cells };
    }
    progress = true;
  }
  return progress;
}

/* ── Tier 2: a region confined to one line, or a line to one region ─── */

function applyConfine(context, state, first) {
  let progress = false;

  const lines = [
    [context.regs, context.rowOf, (i) => context.rows[i], '列'],
    [context.regs, context.colOf, (i) => context.cols[i], '欄'],
    [context.rows, context.regionOf, (i) => context.regs[i], '顏色區塊'],
    [context.cols, context.regionOf, (i) => context.regs[i], '顏色區塊'],
  ];

  for (const [units, keyOf, unitAt, label] of lines) {
    for (const unit of units) {
      if (isFilled(unit, state)) continue;
      const open = openCells(unit, state);
      if (open.length < 2) continue;

      const key = keyOf(open[0]);
      if (!open.every((i) => keyOf(i) === key)) continue;

      const target = unitAt(key);
      const hits = target.cells.filter((x) => state[x] === UNKNOWN && !open.includes(x));
      if (hits.length === 0) continue;

      for (const x of hits) state[x] = EXCLUDED;
      if (first) {
        const where = label === '顏色區塊' ? '同一個顏色區塊' : `第 ${key + 1} ${label}`;
        return {
          tier: 2,
          exclude: hits,
          because: `${describe(unit)}的可能位置全在${where}裡，所以${where}的其他格都不行。`,
          focus: open,
        };
      }
      progress = true;
    }
  }

  return progress;
}

/* ── Tier 3: a square every placement of some unit would kill ─── */

function applySweep(context, state, first) {
  let progress = false;

  for (const unit of context.units) {
    if (isFilled(unit, state)) continue;
    const open = openCells(unit, state);
    if (open.length < 2) continue;

    const hits = [];
    for (let x = 0; x < context.cells; x++) {
      if (state[x] !== UNKNOWN || open.includes(x)) continue;
      if (open.every((c) => context.kills[c][x])) hits.push(x);
    }
    if (hits.length === 0) continue;

    for (const x of hits) state[x] = EXCLUDED;
    if (first) {
      return {
        tier: 3,
        exclude: hits,
        because: `${describe(unit)}不管放在哪一格，都會殺掉標起來的格子。`,
        focus: open,
      };
    }
    progress = true;
  }

  return progress;
}

/* ── Tier 4: k units whose options fit in exactly k partners ─── */

function* subsets(items, size) {
  const pick = function* (start, chosen) {
    if (chosen.length === size) {
      yield chosen;
      return;
    }
    for (let i = start; i < items.length; i++) yield* pick(i + 1, [...chosen, items[i]]);
  };
  yield* pick(0, []);
}

function applyHall(context, state, first) {
  const pairings = [
    [context.rows, context.regs, context.regionOf, context.rowOf, '列', '顏色區塊'],
    [context.regs, context.rows, context.rowOf, context.regionOf, '顏色區塊', '列'],
    [context.cols, context.regs, context.regionOf, context.colOf, '欄', '顏色區塊'],
    [context.regs, context.cols, context.colOf, context.regionOf, '顏色區塊', '欄'],
    [context.rows, context.cols, context.colOf, context.rowOf, '列', '欄'],
    [context.cols, context.rows, context.rowOf, context.colOf, '欄', '列'],
  ];

  for (const [from, to, partnerOf, ownerOf, fromLabel, toLabel] of pairings) {
    const available = from.filter((unit) => !isFilled(unit, state));

    for (const width of [2, 3]) {
      if (available.length <= width) continue;

      for (const group of subsets(available, width)) {
        const owners = new Set(group.map((unit) => unit.index));
        const partners = new Set();
        const focus = [];
        for (const unit of group) {
          for (const cell of openCells(unit, state)) {
            partners.add(partnerOf(cell));
            focus.push(cell);
          }
        }
        if (partners.size !== width) continue;

        const hits = [];
        for (const partner of partners) {
          for (const cell of openCells(to[partner], state)) {
            if (!owners.has(ownerOf(cell))) hits.push(cell);
          }
        }
        if (hits.length === 0) continue;

        for (const x of hits) state[x] = EXCLUDED;
        // One set at a time: applying several at once would hide how much of
        // this technique the puzzle really demands.
        return first
          ? {
              tier: 4,
              exclude: hits,
              because: `這 ${width} 個${fromLabel}的可能位置，剛好只落在 ${width} 個${toLabel}裡，所以那些${toLabel}的其他格都被佔走了。`,
              focus,
            }
          : true;
      }
    }
  }

  return false;
}

/* ── Tier 5: assume, propagate, hit a contradiction ─── */

function applyAssume(context, state, first) {
  for (let x = 0; x < context.cells; x++) {
    if (state[x] !== UNKNOWN) continue;

    const trial = Int8Array.from(state);
    place(context, trial, x);
    let moving = true;
    while (moving && !broken(context, trial)) {
      moving =
        applySingle(context, trial) ||
        applyConfine(context, trial) ||
        applySweep(context, trial) ||
        applyHall(context, trial);
    }
    if (!broken(context, trial)) continue;

    state[x] = EXCLUDED;
    return first
      ? { tier: 5, exclude: [x], because: '假設放在這一格，推下去會矛盾，所以這格不能放。', focus: [x] }
      : true;
  }
  return false;
}

const STEPS = [applySingle, applyConfine, applySweep, applyHall, applyAssume];

/**
 * Solve with human techniques and report the hardest tier needed.
 * `tier` is null when even tier 5 runs dry, meaning the puzzle cannot be
 * finished without real guesswork.
 */
export function rate(size, regions) {
  const context = buildContext(size, regions);
  const state = new Int8Array(context.cells);
  const counts = [0, 0, 0, 0, 0];
  const firstUse = [0, 0, 0, 0, 0]; // 1-based step at which each tier first fires
  let step = 0;

  for (let guard = 0; guard < 4000; guard++) {
    if (complete(context, state)) {
      const tier = counts.reduce((top, count, i) => (count > 0 ? i + 1 : top), 1);
      return {
        solved: true,
        tier,
        counts,
        effort: counts.reduce((a, b) => a + b, 0),
        // How soon the hardest technique is needed. A lesson wants this small,
        // so the student meets the point of the lesson straight away.
        topAt: firstUse[tier - 1],
      };
    }
    if (broken(context, state)) break;

    let moved = false;
    for (let i = 0; i < STEPS.length; i++) {
      if (STEPS[i](context, state)) {
        step++;
        counts[i]++;
        if (firstUse[i] === 0) firstUse[i] = step;
        moved = true;
        break;
      }
    }
    if (!moved) break;
  }

  return { solved: false, tier: null, counts, effort: 0, topAt: 0 };
}

/**
 * Work out the next logical move from where the player actually is. The
 * crosses matter as much as the pieces: without them a hint that only rules
 * squares out would come back identical every time, because the board it
 * reasons from would never change.
 */
export function findNext(size, regions, placements, crossed = []) {
  const context = buildContext(size, regions);
  const state = new Int8Array(context.cells);

  for (const index of placements) {
    if (state[index] === EXCLUDED) return { type: 'wrong', index };
    place(context, state, index);
  }
  for (const index of crossed) {
    if (state[index] === UNKNOWN) state[index] = EXCLUDED;
  }
  if (broken(context, state)) return { type: 'wrong', index: placements[placements.length - 1] };
  if (complete(context, state)) return { type: 'done' };

  for (const step of STEPS) {
    const found = step(context, state, true);
    if (found) {
      const technique = TECHNIQUES.find((entry) => entry.tier === found.tier);
      return { type: 'move', technique, ...found };
    }
  }
  return { type: 'stuck' };
}

export function techniqueOf(tier) {
  return TECHNIQUES.find((technique) => technique.tier === tier) ?? TECHNIQUES[0];
}
