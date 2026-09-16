// Progress and settings, kept in localStorage. Every access is guarded:
// private windows and blocked site data make these throw.

const KEY = 'shiba-grid/v1';

const DEFAULTS = {
  progress: {}, // level number -> { best: seconds, clean: boolean }
  settings: {
    autoMark: true,
    showTimer: true,
  },
  lastLevel: 1,
};

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const saved = JSON.parse(raw);
    return {
      ...structuredClone(DEFAULTS),
      ...saved,
      settings: { ...DEFAULTS.settings, ...(saved.settings || {}) },
      progress: saved.progress || {},
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

function write(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Nothing to do: the game stays playable, it just will not remember.
  }
}

let state = read();

export function getSettings() {
  return { ...state.settings };
}

export function setSetting(name, value) {
  state.settings[name] = value;
  write(state);
}

export function getProgress() {
  return state.progress;
}

export function getLevelRecord(number) {
  return state.progress[number] || null;
}

export function recordClear(number, seconds, clean) {
  const previous = state.progress[number];
  state.progress[number] = {
    best: previous ? Math.min(previous.best, seconds) : seconds,
    clean: Boolean(previous?.clean) || clean,
  };
  write(state);
}

export function getLastLevel() {
  return state.lastLevel;
}

export function setLastLevel(number) {
  state.lastLevel = number;
  write(state);
}

export function clearedCount() {
  return Object.keys(state.progress).length;
}

export function highestUnlocked() {
  // Everything up to the first unfinished level, plus that level itself.
  let level = 1;
  while (level < 100 && state.progress[level]) level++;
  return level;
}

export function resetAll() {
  state = structuredClone(DEFAULTS);
  write(state);
}
