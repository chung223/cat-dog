// Board state and rules for a single puzzle.

export const EMPTY = 0;
export const MARK = 1; // cross placed by the player
export const SHIBA = 2;
export const AUTO = 3; // cross the game filled in automatically

export class Game {
  constructor({ size, regions, solution, stars = 1, autoMark = true }) {
    this.size = size;
    this.stars = stars;
    this.regions = regions;
    this.solution = solution; // cell indices, `size * stars` of them
    this.autoMark = autoMark;
    this.cells = new Int8Array(size * size);
    this.history = [];
    this.hintsUsed = 0;
  }

  index(row, col) {
    return row * this.size + col;
  }

  rowOf(index) {
    return Math.floor(index / this.size);
  }

  colOf(index) {
    return index % this.size;
  }

  snapshot() {
    this.history.push(Int8Array.from(this.cells));
    if (this.history.length > 500) this.history.shift();
  }

  undo() {
    const previous = this.history.pop();
    if (!previous) return false;
    this.cells = previous;
    return true;
  }

  reset() {
    this.snapshot();
    this.cells = new Int8Array(this.size * this.size);
    return true;
  }

  toggleMark(index) {
    const current = this.cells[index];
    this.cells[index] = current === MARK || current === AUTO ? EMPTY : MARK;
    if (current === SHIBA) this.refreshAuto();
  }

  toggleShiba(index) {
    this.cells[index] = this.cells[index] === SHIBA ? EMPTY : SHIBA;
    this.refreshAuto();
  }

  /** Used while dragging: force a cell to a cross or back to empty. */
  paint(index, value) {
    const current = this.cells[index];
    if (value === MARK && (current === EMPTY || current === AUTO)) {
      this.cells[index] = MARK;
      return true;
    }
    if (value === EMPTY && current === MARK) {
      this.cells[index] = EMPTY;
      this.refreshAuto();
      return true;
    }
    return false;
  }

  setAutoMark(enabled) {
    this.autoMark = enabled;
    this.refreshAuto();
  }

  /** Every cell of the row, column and region a cell belongs to. */
  units(index) {
    const { size } = this;
    const row = this.rowOf(index);
    const col = this.colOf(index);
    const region = this.regions[index];

    const across = [];
    const down = [];
    const area = [];
    for (let k = 0; k < size; k++) {
      across.push(this.index(row, k));
      down.push(this.index(k, col));
    }
    for (let j = 0; j < this.cells.length; j++) {
      if (this.regions[j] === region) area.push(j);
    }
    return [across, down, area];
  }

  /**
   * Re-derive the automatic crosses. A piece always rules out the eight cells
   * around it, but its row, column and region only close once they hold their
   * full quota — at two pieces per unit, one piece leaves room for another.
   */
  refreshAuto() {
    for (let i = 0; i < this.cells.length; i++) {
      if (this.cells[i] === AUTO) this.cells[i] = EMPTY;
    }
    if (!this.autoMark) return;

    const { size } = this;
    for (const i of this.shibas()) {
      const row = this.rowOf(i);
      const col = this.colOf(i);

      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const r = row + dr;
          const c = col + dc;
          if (r < 0 || c < 0 || r >= size || c >= size) continue;
          this.markAuto(this.index(r, c));
        }
      }

      for (const unit of this.units(i)) {
        if (unit.filter((j) => this.cells[j] === SHIBA).length < this.stars) continue;
        for (const j of unit) this.markAuto(j);
      }
    }
  }

  markAuto(index) {
    if (this.cells[index] === EMPTY) this.cells[index] = AUTO;
  }

  shibas() {
    const placed = [];
    for (let i = 0; i < this.cells.length; i++) {
      if (this.cells[i] === SHIBA) placed.push(i);
    }
    return placed;
  }

  /** Indices of pieces that break a rule, with the reason for the first clash. */
  conflicts() {
    const placed = this.shibas();
    const bad = new Map();
    const note = (index, reason) => {
      if (!bad.has(index)) bad.set(index, reason);
    };

    // Touching is always wrong; sharing a line or a region is only wrong once
    // there are more than `stars` of them in it.
    for (let a = 0; a < placed.length; a++) {
      for (let b = a + 1; b < placed.length; b++) {
        const i = placed[a];
        const j = placed[b];
        if (
          Math.abs(this.rowOf(i) - this.rowOf(j)) <= 1 &&
          Math.abs(this.colOf(i) - this.colOf(j)) <= 1
        ) {
          note(i, 'touch');
          note(j, 'touch');
        }
      }
    }

    const tally = (key, reason) => {
      const groups = new Map();
      for (const index of placed) {
        const bucket = key(index);
        if (!groups.has(bucket)) groups.set(bucket, []);
        groups.get(bucket).push(index);
      }
      for (const members of groups.values()) {
        if (members.length <= this.stars) continue;
        for (const index of members) note(index, reason);
      }
    };

    tally((i) => this.rowOf(i), 'row');
    tally((i) => this.colOf(i), 'col');
    tally((i) => this.regions[i], 'region');

    return bad;
  }

  isSolved() {
    // With every unit capped and the full count on the board, each unit must
    // hold exactly its quota.
    return this.shibas().length === this.size * this.stars && this.conflicts().size === 0;
  }

  /**
   * Take one cell off the player's hands: clear a misplaced shiba if there is
   * one, otherwise reveal a correct shiba.
   */
  hint() {
    const correct = new Set(this.solution);

    for (const index of this.shibas()) {
      if (!correct.has(index)) {
        this.snapshot();
        this.cells[index] = EMPTY;
        this.refreshAuto();
        this.hintsUsed++;
        return { type: 'wrong', index };
      }
    }

    const missing = [...correct].filter((index) => this.cells[index] !== SHIBA);
    if (missing.length === 0) return { type: 'none' };

    const index = missing[Math.floor(Math.random() * missing.length)];
    this.snapshot();
    this.cells[index] = SHIBA;
    this.refreshAuto();
    this.hintsUsed++;
    return { type: 'reveal', index };
  }
}
