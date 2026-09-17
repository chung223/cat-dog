// Rates a puzzle by the hardest deduction a human needs to finish it, and can
// explain the next move from any board position.
//
// The solver only applies techniques a person could reasonably spot, always
// reaching for the cheapest one that makes progress. The rating is the hardest
// technique it was ever forced to use — a far better difficulty signal than
// board size.
//
// Everything is written in terms of what a unit still owes. At one piece per
// unit that collapses to the familiar rules; at two it does not, and the
// difference matters: placing a piece no longer closes its row, because the
// row still wants another one.

export const TECHNIQUES = [
  {
    tier: 1,
    id: 'single',
    name: '唯一格',
    hint: '某一列、某一欄或某個顏色區塊剩下的空格，剛好等於還要放的數量——那就全都是了。',
  },
  {
    tier: 2,
    id: 'confine',
    name: '區塊鎖定',
    hint: '某個顏色區塊剩下的位置全擠在同一列裡，而那一列剩下的數量剛好一樣多，那一列的其他格就都不行了。',
  },
  {
    tier: 3,
    id: 'sweep',
    name: '共同排除',
    hint: '某一列／欄／區塊剩下的位置，不管怎麼挑都一定會殺掉某一格——那格就是死的。',
  },
  {
    tier: 4,
    id: 'combo',
    name: '配對不成立',
    hint: '一個單位要放兩個以上時，有些格子放下去，剩下的就湊不出完整的一組了——那格可以直接排除。（每格只放一個時用不到這招。）',
  },
  {
    tier: 5,
    id: 'hall',
    name: '集合配對',
    hint: '幾個區塊還要放的總數，剛好等於它們能用的那幾列還能放的總數，那幾列就被包了。',
  },
  {
    tier: 6,
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

export function buildContext(size, regions, stars = 1) {
  const cells = size * size;
  const rows = [];
  const cols = [];
  const regs = [];

  for (let i = 0; i < size; i++) {
    rows.push({ kind: 'row', index: i, cells: [], stars });
    cols.push({ kind: 'col', index: i, cells: [], stars });
    regs.push({ kind: 'region', index: i, cells: [], stars });
  }
  for (let i = 0; i < cells; i++) {
    rows[Math.floor(i / size)].cells.push(i);
    cols[i % size].cells.push(i);
    regs[regions[i]].cells.push(i);
  }

  // touches[c][x] — a piece at c always rules x out, whatever else is going on.
  const touches = [];
  const unitsOf = [];
  for (let c = 0; c < cells; c++) {
    const row = Math.floor(c / size);
    const col = c % size;
    const mask = new Uint8Array(cells);
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const r = row + dr;
        const k = col + dc;
        if (r < 0 || k < 0 || r >= size || k >= size) continue;
        const x = r * size + k;
        if (x !== c) mask[x] = 1;
      }
    }
    touches.push(mask);
    unitsOf.push([rows[row], cols[col], regs[regions[c]]]);
  }

  return {
    size,
    stars,
    cells,
    regions,
    rows,
    cols,
    regs,
    units: [...rows, ...cols, ...regs],
    touches,
    unitsOf,
    rowOf: (i) => Math.floor(i / size),
    colOf: (i) => i % size,
    regionOf: (i) => regions[i],
  };
}

const openCells = (unit, state) => unit.cells.filter((i) => state[i] === UNKNOWN);
const owed = (unit, state) => unit.stars - unit.cells.filter((i) => state[i] === PLACED).length;

export function place(context, state, index) {
  state[index] = PLACED;

  const mask = context.touches[index];
  for (let x = 0; x < context.cells; x++) {
    if (mask[x] && state[x] === UNKNOWN) state[x] = EXCLUDED;
  }

  // A unit only closes once it holds its full quota.
  for (const unit of context.unitsOf[index]) {
    if (owed(unit, state) > 0) continue;
    for (const x of unit.cells) if (state[x] === UNKNOWN) state[x] = EXCLUDED;
  }
}

/** Would a piece at `c` rule `x` out, given where things stand? */
function wouldKill(context, state, c, x) {
  if (context.touches[c][x]) return true;
  for (const unit of context.unitsOf[c]) {
    // Filling the unit's last slot closes it, taking x with it.
    if (owed(unit, state) === 1 && unit.cells.includes(x)) return true;
  }
  return false;
}

function broken(context, state) {
  return context.units.some((unit) => {
    const need = owed(unit, state);
    return need < 0 || openCells(unit, state).length < need;
  });
}

function complete(context, state) {
  return context.units.every((unit) => owed(unit, state) === 0);
}

/**
 * Techniques share one signature: mutate `state`, return truthy on progress.
 * With `first` set they stop after a single deduction and return a report, so
 * the same code drives both the difficulty rating and the in-game hint.
 */

/* ── Tier 1: the empty cells left are exactly what the unit still owes ─── */

function applySingle(context, state, first) {
  let progress = false;
  for (const unit of context.units) {
    const need = owed(unit, state);
    if (need <= 0) continue;
    const open = openCells(unit, state);
    if (open.length !== need) continue;

    for (const index of open) place(context, state, index);
    if (first) {
      return {
        tier: 1,
        place: open,
        because: `${describe(unit)}剩下的空格剛好只有 ${need} 格，全都要放。`,
        focus: unit.cells,
      };
    }
    progress = true;
  }
  return progress;
}

/* ── Tier 2: a unit's remaining places all sit inside another unit ─── */

function applyConfine(context, state, first) {
  let progress = false;

  const pairings = [
    [context.regs, context.rowOf, (i) => context.rows[i], '列'],
    [context.regs, context.colOf, (i) => context.cols[i], '欄'],
    [context.rows, context.regionOf, (i) => context.regs[i], '顏色區塊'],
    [context.cols, context.regionOf, (i) => context.regs[i], '顏色區塊'],
  ];

  for (const [units, keyOf, unitAt, label] of pairings) {
    for (const unit of units) {
      const need = owed(unit, state);
      if (need <= 0) continue;
      const open = openCells(unit, state);
      if (open.length < 2) continue;

      const key = keyOf(open[0]);
      if (!open.every((i) => keyOf(i) === key)) continue;

      // Only a partner that owes exactly the same amount is fully consumed.
      const target = unitAt(key);
      if (owed(target, state) !== need) continue;

      const hits = target.cells.filter((x) => state[x] === UNKNOWN && !open.includes(x));
      if (hits.length === 0) continue;

      for (const x of hits) state[x] = EXCLUDED;
      if (first) {
        const where = label === '顏色區塊' ? '同一個顏色區塊' : `第 ${key + 1} ${label}`;
        return {
          tier: 2,
          exclude: hits,
          because: `${describe(unit)}剩下的 ${need} 個位置全在${where}裡，剛好把${where}佔滿，其他格都不行。`,
          focus: open,
        };
      }
      progress = true;
    }
  }

  return progress;
}

/* ── Tier 3: too few survivors for the unit to spare ─── */

function applySweep(context, state, first) {
  let progress = false;

  for (const unit of context.units) {
    const need = owed(unit, state);
    if (need <= 0) continue;
    const open = openCells(unit, state);
    if (open.length <= need) continue; // tier 1 already handles the exact fit

    const hits = [];
    for (let x = 0; x < context.cells; x++) {
      if (state[x] !== UNKNOWN || open.includes(x)) continue;
      // If fewer than `need` of the unit's options spare x, some chosen piece
      // must be one that kills it.
      let spare = 0;
      for (const c of open) {
        if (!wouldKill(context, state, c, x)) spare++;
        if (spare >= need) break;
      }
      if (spare < need) hits.push(x);
    }
    if (hits.length === 0) continue;

    for (const x of hits) state[x] = EXCLUDED;
    if (first) {
      return {
        tier: 3,
        exclude: hits,
        because: `${describe(unit)}還要放 ${need} 個，不管怎麼挑都會殺掉標起來的格子。`,
        focus: open,
      };
    }
    progress = true;
  }

  return progress;
}

/* ── Tier 4: no legal combination can include this cell ─── */

/** Could these cells all hold pieces at once, as far as the units allow? */
function compatible(context, state, chosen) {
  for (let a = 0; a < chosen.length; a++) {
    for (let b = a + 1; b < chosen.length; b++) {
      if (context.touches[chosen[a]][chosen[b]]) return false;
    }
  }
  const load = new Map();
  for (const cell of chosen) {
    for (const unit of context.unitsOf[cell]) {
      const count = (load.get(unit) ?? 0) + 1;
      if (count > owed(unit, state)) return false;
      load.set(unit, count);
    }
  }
  return true;
}

/** Is there a legal way for `unit` to take `need` of its options, using `seed`? */
function canFill(context, state, options, need, seed) {
  const search = (start, chosen) => {
    if (chosen.length === need) return true;
    for (let i = start; i < options.length; i++) {
      if (options[i] === seed) continue;
      const next = [...chosen, options[i]];
      if (!compatible(context, state, next)) continue;
      if (search(i + 1, next)) return true;
    }
    return false;
  };
  return search(0, [seed]);
}

function applyCombo(context, state, first) {
  let progress = false;

  for (const unit of context.units) {
    const need = owed(unit, state);
    if (need < 2) continue; // with one to place, any single option is a combination
    const open = openCells(unit, state);
    if (open.length <= need) continue;

    const hits = open.filter((cell) => !canFill(context, state, open, need, cell));
    if (hits.length === 0) continue;

    for (const x of hits) state[x] = EXCLUDED;
    if (first) {
      return {
        tier: 4,
        exclude: hits,
        because: `${describe(unit)}還要放 ${need} 個。標起來的格子放下去，剩下的就湊不出另外 ${need - 1} 個了。`,
        focus: open,
      };
    }
    progress = true;
  }

  return progress;
}

/* ── Tier 5: demand meets capacity exactly ─── */

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
    const available = from.filter((unit) => owed(unit, state) > 0);

    for (const width of [2, 3]) {
      if (available.length <= width) continue;

      for (const group of subsets(available, width)) {
        const owners = new Set(group.map((unit) => unit.index));
        const partners = new Set();
        const focus = [];
        let demand = 0;

        for (const unit of group) {
          demand += owed(unit, state);
          for (const cell of openCells(unit, state)) {
            partners.add(partnerOf(cell));
            focus.push(cell);
          }
        }

        let capacity = 0;
        for (const partner of partners) capacity += owed(to[partner], state);
        if (demand !== capacity) continue;

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
              tier: 5,
              exclude: hits,
              because: `這 ${width} 個${fromLabel}還要放 ${demand} 個，而它們能用的${toLabel}加起來也只剩 ${capacity} 個位置，剛好被佔滿。`,
              focus,
            }
          : true;
      }
    }
  }

  return false;
}

/* ── Tier 6: assume, propagate, hit a contradiction ─── */

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
        applyCombo(context, trial) ||
        applyHall(context, trial);
    }
    if (!broken(context, trial)) continue;

    state[x] = EXCLUDED;
    return first
      ? { tier: 6, exclude: [x], because: '假設放在這一格，推下去會矛盾，所以這格不能放。', focus: [x] }
      : true;
  }
  return false;
}

const STEPS = [applySingle, applyConfine, applySweep, applyCombo, applyHall, applyAssume];

/**
 * Solve with human techniques and report the hardest tier needed.
 * `tier` is null when even tier 5 runs dry, meaning the puzzle cannot be
 * finished without real guesswork.
 */
export function rate(size, regions, stars = 1) {
  const context = buildContext(size, regions, stars);
  const state = new Int8Array(context.cells);
  const counts = [0, 0, 0, 0, 0, 0];
  const firstUse = [0, 0, 0, 0, 0, 0]; // 1-based step at which each tier first fires
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

  return { solved: false, tier: null, counts: [0, 0, 0, 0, 0, 0], effort: 0, topAt: 0 };
}

/**
 * Work out the next logical move from where the player actually is. The
 * crosses matter as much as the pieces: without them a hint that only rules
 * squares out would come back identical every time, because the board it
 * reasons from would never change.
 */
export function findNext(size, regions, placements, crossed = [], stars = 1) {
  const context = buildContext(size, regions, stars);
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
