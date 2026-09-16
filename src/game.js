// Board state and rules for a single puzzle.

export const EMPTY = 0;
export const MARK = 1; // cross placed by the player
export const SHIBA = 2;
export const AUTO = 3; // cross the game filled in automatically

export class Game {
  constructor({ size, regions, solution, autoMark = true }) {
    this.size = size;
    this.regions = regions;
    this.solution = solution;
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

  /** Re-derive the automatic crosses from the shibas currently on the board. */
  refreshAuto() {
    for (let i = 0; i < this.cells.length; i++) {
      if (this.cells[i] === AUTO) this.cells[i] = EMPTY;
    }
    if (!this.autoMark) return;

    const { size } = this;
    for (let i = 0; i < this.cells.length; i++) {
      if (this.cells[i] !== SHIBA) continue;
      const row = this.rowOf(i);
      const col = this.colOf(i);
      const region = this.regions[i];

      for (let k = 0; k < size; k++) {
        this.markAuto(this.index(row, k));
        this.markAuto(this.index(k, col));
      }
      for (let j = 0; j < this.cells.length; j++) {
        if (this.regions[j] === region) this.markAuto(j);
      }
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const r = row + dr;
          const c = col + dc;
          if (r < 0 || c < 0 || r >= size || c >= size) continue;
          this.markAuto(this.index(r, c));
        }
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

  /** Indices of shibas that break a rule, with the reason for the first clash. */
  conflicts() {
    const placed = this.shibas();
    const bad = new Map();
    const note = (index, reason) => {
      if (!bad.has(index)) bad.set(index, reason);
    };

    for (let a = 0; a < placed.length; a++) {
      for (let b = a + 1; b < placed.length; b++) {
        const i = placed[a];
        const j = placed[b];
        let reason = null;
        if (this.rowOf(i) === this.rowOf(j)) reason = 'row';
        else if (this.colOf(i) === this.colOf(j)) reason = 'col';
        else if (this.regions[i] === this.regions[j]) reason = 'region';
        else if (
          Math.abs(this.rowOf(i) - this.rowOf(j)) <= 1 &&
          Math.abs(this.colOf(i) - this.colOf(j)) <= 1
        ) {
          reason = 'touch';
        }
        if (reason) {
          note(i, reason);
          note(j, reason);
        }
      }
    }
    return bad;
  }

  isSolved() {
    return this.shibas().length === this.size && this.conflicts().size === 0;
  }

  /**
   * Take one cell off the player's hands: clear a misplaced shiba if there is
   * one, otherwise reveal a correct shiba.
   */
  hint() {
    const correct = new Set(this.solution.map((col, row) => this.index(row, col)));

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
