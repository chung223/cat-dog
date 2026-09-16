// Progress and settings, kept in localStorage. Every access is guarded:
// private windows and blocked site data make these throw.

const KEY = 'shiba-grid/v1';

const DEFAULTS = {
  progress: {}, // level number -> { best: seconds, clean: boolean }
  settings: {
    autoMark: true,
    showTimer: true,
    strict: true, // three mistakes and the puzzle is over
    mascot: 'poop',
  },
  daily: {}, // 'YYYY-MM-DD' -> { seconds, mistakes }
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
      daily: saved.daily || {},
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

/* ── Daily challenge ─────────────────────────────── */

export function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDailyRecord(key) {
  return state.daily[key] || null;
}

export function recordDaily(key, seconds, mistakes) {
  if (state.daily[key]) return;
  state.daily[key] = { seconds, mistakes };
  write(state);
}

/** How many days in a row, counting back from today (or yesterday). */
export function dailyStreak() {
  const day = new Date();
  if (!state.daily[dateKey(day)]) day.setDate(day.getDate() - 1);

  let streak = 0;
  while (state.daily[dateKey(day)]) {
    streak++;
    day.setDate(day.getDate() - 1);
  }
  return streak;
}

export function resetAll() {
  state = structuredClone(DEFAULTS);
  write(state);
}
