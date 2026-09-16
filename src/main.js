// Screens, input handling and rendering.

import { LEVELS, loadLevel } from './levels.js';
import { generatePuzzle } from './puzzle.js';
import { Game, EMPTY, MARK, SHIBA, AUTO } from './game.js';
import { TECHNIQUES, findNext, rate, techniqueOf } from './analyze.js';
import { MASCOTS, getMascot } from './mascots.js';
import * as store from './storage.js';

const $ = (id) => document.getElementById(id);

const TOTAL_LEVELS = LEVELS.length;
const DOUBLE_TAP_MS = 330;
const MAX_MISTAKES = 3;

// Board size of the daily puzzle, by weekday. Sunday gets the chunky one.
const DAILY_SIZES = [9, 7, 8, 8, 9, 8, 9];

const SIZE_LABELS = { 5: '入門', 6: '輕鬆', 7: '普通', 8: '偏難', 9: '困難', 10: '專家' };

const state = {
  view: 'home',
  mode: 'campaign', // campaign | endless | daily
  levelNumber: 1,
  endlessSize: 7,
  dayKey: null,
  game: null,
  cellNodes: [],
  seconds: 0,
  ticker: null,
  focusIndex: 0,
  tap: null,
  pointer: null,
  strict: true,
  tier: 1,
  mistakes: 0,
  finished: false,
};

let mascot = getMascot(store.getSettings().mascot);

/* ── Mascot theme ────────────────────────────────── */

/** Mascots may ship their own cross glyph; the rest fall back to a plain X. */
function markClass() {
  return mascot.mark ? 'mark mark-icon' : 'mark';
}

function applyMascot(id) {
  mascot = getMascot(id);
  document.documentElement.style.setProperty('--accent', mascot.accent);
  document.title = `${mascot.name}謎陣 · 100 關邏輯挑戰`;

  $('hero-title').textContent = `${mascot.name}謎陣`;
  for (const node of document.querySelectorAll('.mascot-name')) node.textContent = mascot.name;
  for (const id of ['hero-art', 'win-art', 'fail-art']) $(id).innerHTML = mascot.svg;
  for (const cell of state.cellNodes) {
    cell.querySelector('.pet').innerHTML = mascot.svg;
    const mark = cell.querySelector('.mark');
    mark.className = markClass();
    mark.innerHTML = mascot.mark ?? '';
  }

  for (const option of document.querySelectorAll('.mascot-option')) {
    option.setAttribute('aria-pressed', String(option.dataset.mascot === mascot.id));
  }
  if (state.view === 'home') $('topbar-title').textContent = `${mascot.name}謎陣`;
}

/* ── View switching ──────────────────────────────── */

function render(view, options = {}) {
  state.view = view;
  for (const name of ['home', 'levels', 'game']) {
    $(`view-${name}`).hidden = name !== view;
  }
  $('btn-back').hidden = view === 'home';

  if (view === 'home') {
    stopTimer();
    refreshHome();
    $('topbar-title').textContent = `${mascot.name}謎陣`;
  } else if (view === 'levels') {
    stopTimer();
    buildLevelGrid();
    $('topbar-title').textContent = '選擇關卡';
  } else {
    startPuzzle(options);
  }
}

/**
 * `replace` swaps the current history entry instead of stacking a new one,
 * so walking through levels from the win dialog does not leave the back
 * button with a dozen finished boards to retrace.
 */
function navigate(view, options = {}) {
  const previous = state.view;
  render(view, options);
  if (options.fromPop) return;
  // Replacing keeps whatever the entry underneath already was.
  const from = options.replace ? history.state?.from ?? previous : previous;
  const entry = { view, ...options, from, fromPop: true };
  if (options.replace) history.replaceState(entry, '');
  else history.pushState(entry, '');
}

window.addEventListener('popstate', (event) => {
  const saved = event.state || { view: 'home' };
  render(saved.view, { ...saved, fromPop: true });
});

/* ── Home ────────────────────────────────────────── */

function refreshHome() {
  const cleared = store.clearedCount();
  $('progress-text').textContent = `${cleared} / ${TOTAL_LEVELS}`;
  $('progress-fill').style.width = `${(cleared / TOTAL_LEVELS) * 100}%`;
  $('btn-continue').textContent =
    cleared === 0 ? '開始第 1 關' : `繼續第 ${store.highestUnlocked()} 關`;

  const today = new Date();
  const key = store.dateKey(today);
  const record = store.getDailyRecord(key);
  const streak = store.dailyStreak();

  $('daily-date').textContent = `${today.getMonth() + 1} 月 ${today.getDate()} 日`;
  $('daily-state').textContent = record ? `已完成 ${formatTime(record.seconds)}` : '尚未完成';
  $('daily-streak').textContent = streak > 0 ? `連續 ${streak} 天 🔥` : '';
}

/* ── Level select ────────────────────────────────── */

function buildLevelGrid() {
  const grid = $('level-grid');
  grid.textContent = '';
  const fragment = document.createDocumentFragment();

  for (const level of LEVELS) {
    const record = store.getLevelRecord(level.n);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = record ? 'level-cell done' : 'level-cell';
    button.style.setProperty('--tier', `var(--t${level.d})`);
    button.innerHTML =
      `<span>${level.n}</span>` +
      `<span class="size">${level.s}×${level.s}</span>` +
      (record?.clean ? '<span class="star">⭐</span>' : record ? '<span class="star">✓</span>' : '');
    button.setAttribute(
      'aria-label',
      `第 ${level.n} 關，${level.s} 乘 ${level.s}，難度 ${techniqueOf(level.d).name}` +
        (record ? `，已完成，最佳 ${formatTime(record.best)}` : ''),
    );
    button.addEventListener('click', () =>
      navigate('game', { mode: 'campaign', levelNumber: level.n }),
    );
    fragment.append(button);
  }

  grid.append(fragment);
}

/* ── Puzzle setup ────────────────────────────────── */

function hashString(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function startPuzzle({
  mode = state.mode,
  levelNumber = state.levelNumber,
  endlessSize = state.endlessSize,
} = {}) {
  state.mode = mode;
  state.levelNumber = levelNumber;
  state.endlessSize = endlessSize;

  let puzzle;
  let tier;
  if (mode === 'campaign') {
    puzzle = loadLevel(levelNumber);
    tier = puzzle.tier;
    store.setLastLevel(levelNumber);
    $('topbar-title').textContent = `第 ${levelNumber} 關`;
    $('hud-level-label').textContent = '關卡';
    $('hud-level').textContent = String(levelNumber);
    $('btn-next-puzzle').hidden = true;
  } else if (mode === 'daily') {
    const today = new Date();
    state.dayKey = store.dateKey(today);
    // Everyone gets the same board on the same date, with no server involved.
    puzzle = generatePuzzle(DAILY_SIZES[today.getDay()], hashString(state.dayKey));
    $('topbar-title').textContent = '每日挑戰';
    $('hud-level-label').textContent = '日期';
    $('hud-level').textContent = `${today.getMonth() + 1}/${today.getDate()}`;
    $('btn-next-puzzle').hidden = true;
  } else {
    puzzle = generatePuzzle(endlessSize, (Date.now() ^ (Math.random() * 1e9)) >>> 0);
    $('topbar-title').textContent = '無盡模式';
    $('hud-level-label').textContent = '盤面';
    $('hud-level').textContent = `${endlessSize}×${endlessSize}`;
    $('btn-next-puzzle').hidden = false;
  }

  // Daily and endless boards are fresh, so their difficulty is measured here.
  state.tier = tier ?? rate(puzzle.size, puzzle.regions).tier ?? 5;

  const settings = store.getSettings();
  state.game = new Game({ ...puzzle, autoMark: settings.autoMark });
  state.strict = settings.strict;
  state.mistakes = 0;
  state.finished = false;
  state.focusIndex = 0;
  state.tap = null;

  buildBoard();
  paintBoard();
  renderLives();
  setHint(`本關難度：${techniqueOf(state.tier).name}`);
  $('hud-timer-wrap').hidden = !settings.showTimer;
  startTimer();
}

/* ── Board rendering ─────────────────────────────── */

function buildBoard() {
  const { game } = state;
  const board = $('board');
  const { size, regions } = game;

  board.style.setProperty('--n', size);
  board.textContent = '';
  state.cellNodes = [];

  const thickness = size <= 7 ? 3 : 2.5;
  const fragment = document.createDocumentFragment();

  for (let index = 0; index < size * size; index++) {
    const row = Math.floor(index / size);
    const col = index % size;
    const region = regions[index];

    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'cell';
    cell.dataset.index = String(index);
    cell.tabIndex = index === 0 ? 0 : -1;
    cell.style.setProperty('--rc', `var(--rg${region})`);

    const edges = ['inset 0 0 0 .5px var(--grid-line)'];
    if (row > 0 && regions[index - size] !== region) edges.push(`inset 0 ${thickness}px var(--region-line)`);
    if (row < size - 1 && regions[index + size] !== region) edges.push(`inset 0 -${thickness}px var(--region-line)`);
    if (col > 0 && regions[index - 1] !== region) edges.push(`inset ${thickness}px 0 var(--region-line)`);
    if (col < size - 1 && regions[index + 1] !== region) edges.push(`inset -${thickness}px 0 var(--region-line)`);
    cell.style.boxShadow = edges.join(',');

    cell.innerHTML =
      `<span class="${markClass()}">${mascot.mark ?? ''}</span>` +
      `<span class="pet">${mascot.svg}</span>`;
    fragment.append(cell);
    state.cellNodes.push(cell);
  }

  board.append(fragment);
}

function paintBoard() {
  const { game, cellNodes } = state;
  const conflicts = game.conflicts();

  for (let index = 0; index < cellNodes.length; index++) {
    const cell = cellNodes[index];
    const value = game.cells[index];
    if (cell.dataset.state !== String(value)) cell.dataset.state = String(value);
    cell.classList.toggle('bad', conflicts.has(index));

    const row = Math.floor(index / game.size) + 1;
    const col = (index % game.size) + 1;
    const label = value === SHIBA ? mascot.name : value === EMPTY ? '空白' : '叉';
    cell.setAttribute('aria-label', `第 ${row} 列第 ${col} 欄，${label}`);
  }

  $('hud-count').textContent = `${game.shibas().length} / ${game.size}`;
  $('btn-undo').disabled = game.history.length === 0;

  if (conflicts.size > 0) {
    setHint(conflictMessage([...conflicts.values()][0]), 'warn', 'conflict');
  } else if ($('hint-line').dataset.source === 'conflict') {
    setHint('');
  }
}

function conflictMessage(reason) {
  const who = `兩${mascot.unit}${mascot.name}`;
  return {
    row: `同一列有${who}。`,
    col: `同一欄有${who}。`,
    region: `同一個顏色區塊有${who}。`,
    touch: `${who}貼在一起了，八個方向都不行。`,
  }[reason] || '';
}

/**
 * `source` marks who wrote the line, so the board repaint only clears its own
 * conflict messages and leaves mistake or hint text alone.
 */
function setHint(text, tone = '', source = 'ui') {
  const line = $('hint-line');
  line.textContent = text;
  line.className = `hint-line${tone ? ` ${tone}` : ''}`;
  line.dataset.source = text ? source : '';
}

function focusCells(indices) {
  for (const index of indices) state.cellNodes[index]?.classList.add('focus');
}

function clearFocus() {
  for (const cell of state.cellNodes) cell.classList.remove('focus');
}

function renderLives() {
  const lives = $('lives');
  lives.hidden = !state.strict;
  if (!state.strict) return;
  lives.innerHTML = Array.from(
    { length: MAX_MISTAKES },
    (_, i) => `<span class="${i < state.mistakes ? 'gone' : ''}"></span>`,
  ).join('');
  lives.setAttribute('aria-label', `還剩 ${MAX_MISTAKES - state.mistakes} 次機會`);
}

/* ── Timer ───────────────────────────────────────── */

function startTimer() {
  state.seconds = 0;
  $('hud-timer').textContent = '0:00';
  resumeTimer();
}

function resumeTimer() {
  stopTimer();
  state.ticker = setInterval(() => {
    state.seconds++;
    $('hud-timer').textContent = formatTime(state.seconds);
  }, 1000);
}

function stopTimer() {
  if (state.ticker) clearInterval(state.ticker);
  state.ticker = null;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/* ── Input ───────────────────────────────────────── */

const board = $('board');

function cellIndexFromPoint(x, y) {
  const element = document.elementFromPoint(x, y);
  const cell = element?.closest?.('.cell');
  if (!cell || !board.contains(cell)) return null;
  return Number(cell.dataset.index);
}

board.addEventListener('pointerdown', (event) => {
  if (event.button === 2 || state.finished) return; // right click goes to contextmenu
  const cell = event.target.closest('.cell');
  if (!cell) return;
  event.preventDefault();
  clearFocus();
  cell.focus({ preventScroll: true });
  setFocusIndex(Number(cell.dataset.index));
  board.setPointerCapture(event.pointerId);
  state.pointer = {
    id: event.pointerId,
    start: Number(cell.dataset.index),
    last: Number(cell.dataset.index),
    moved: false,
    paint: null,
  };
});

board.addEventListener('pointermove', (event) => {
  const pointer = state.pointer;
  if (!pointer || pointer.id !== event.pointerId) return;

  const index = cellIndexFromPoint(event.clientX, event.clientY);
  if (index === null || index === pointer.last) return;

  if (!pointer.moved) {
    pointer.moved = true;
    state.tap = null;
    state.game.snapshot();
    pointer.paint = state.game.cells[pointer.start] === MARK ? EMPTY : MARK;
    state.game.paint(pointer.start, pointer.paint);
  }
  state.game.paint(index, pointer.paint);
  pointer.last = index;
  paintBoard();
});

function endPointer(event) {
  const pointer = state.pointer;
  if (!pointer || pointer.id !== event.pointerId) return;
  state.pointer = null;
  if (pointer.moved) {
    afterChange();
  } else {
    handleTap(pointer.start);
  }
}

board.addEventListener('pointerup', endPointer);
board.addEventListener('pointercancel', endPointer);

board.addEventListener('contextmenu', (event) => {
  const cell = event.target.closest('.cell');
  if (!cell) return;
  event.preventDefault();
  if (state.finished) return;
  state.tap = null;
  placeOrRemove(Number(cell.dataset.index));
  afterChange();
});

/**
 * A single tap drops a cross straight away so the board never feels laggy.
 * A second tap on the same cell rewinds that cross and puts a mascot there
 * instead, which keeps one undo step per gesture.
 */
function handleTap(index) {
  if (state.finished) return;
  const now = performance.now();
  const isDouble = state.tap && state.tap.index === index && now - state.tap.time < DOUBLE_TAP_MS;

  if (isDouble) {
    state.game.undo();
    placeOrRemove(index);
    state.tap = null;
  } else {
    state.game.snapshot();
    state.game.toggleMark(index);
    state.tap = { index, time: now };
  }
  afterChange();
}

/** Put a mascot down (or pick it up), counting a mistake if it is wrong. */
function placeOrRemove(index) {
  const { game } = state;
  const placing = game.cells[index] !== SHIBA;
  game.snapshot();
  game.toggleShiba(index);

  if (!placing || !state.strict) return;
  const row = Math.floor(index / game.size);
  if (game.solution[row] === index % game.size) return;

  state.mistakes++;
  game.cells[index] = MARK; // it is provably wrong, so leave a cross behind
  game.refreshAuto();
  renderLives();

  const cell = state.cellNodes[index];
  cell.classList.remove('wrong');
  void cell.offsetWidth;
  cell.classList.add('wrong');

  if (state.mistakes >= MAX_MISTAKES) {
    lose();
  } else {
    setHint(`放錯了，還剩 ${MAX_MISTAKES - state.mistakes} 次機會。`, 'warn');
  }
}

function setFocusIndex(index) {
  state.cellNodes[state.focusIndex]?.setAttribute('tabindex', '-1');
  state.focusIndex = index;
  state.cellNodes[index]?.setAttribute('tabindex', '0');
}

board.addEventListener('keydown', (event) => {
  const { game } = state;
  const size = game.size;
  const index = state.focusIndex;
  const row = Math.floor(index / size);
  const col = index % size;

  const moves = {
    ArrowUp: [row - 1, col],
    ArrowDown: [row + 1, col],
    ArrowLeft: [row, col - 1],
    ArrowRight: [row, col + 1],
  };

  if (moves[event.key]) {
    const [r, c] = moves[event.key];
    if (r < 0 || c < 0 || r >= size || c >= size) return;
    event.preventDefault();
    const target = r * size + c;
    setFocusIndex(target);
    state.cellNodes[target].focus({ preventScroll: true });
    return;
  }

  if (state.finished) return;

  if (event.key === ' ') {
    event.preventDefault();
    game.snapshot();
    game.toggleMark(index);
    afterChange();
  } else if (event.key === 'Enter') {
    event.preventDefault();
    placeOrRemove(index);
    afterChange();
  }
});

/* ── Turn resolution ─────────────────────────────── */

function afterChange() {
  paintBoard();
  if (!state.finished && state.game.isSolved()) win();
}

function win() {
  state.finished = true;
  stopTimer();
  const { game } = state;
  const clean = game.hintsUsed === 0 && state.mistakes === 0;

  if (state.mode === 'campaign') {
    store.recordClear(state.levelNumber, state.seconds, clean);
  } else if (state.mode === 'daily') {
    store.recordDaily(state.dayKey, state.seconds, state.mistakes);
  }

  $('board-flash').classList.remove('on');
  void $('board-flash').offsetWidth;
  $('board-flash').classList.add('on');

  for (const index of game.shibas()) {
    const cell = state.cellNodes[index];
    cell.classList.remove('nudge');
    void cell.offsetWidth;
    cell.classList.add('nudge');
  }

  setHint('全部找到了！', 'good');

  setTimeout(() => {
    const record = state.mode === 'campaign' ? store.getLevelRecord(state.levelNumber) : null;
    $('win-title').textContent = clean ? '完美過關！' : '過關！';

    const lines = [`用時 <b>${formatTime(state.seconds)}</b>`];
    if (record && record.best < state.seconds) lines.push(`最佳 <b>${formatTime(record.best)}</b>`);
    let html = lines.join('　');
    if (game.hintsUsed > 0) html += `<br>使用提示 ${game.hintsUsed} 次`;
    if (state.mistakes > 0) html += `<br>放錯 ${state.mistakes} 次`;
    if (clean) html += '<br>沒有用提示、一次都沒錯 ⭐';
    if (state.mode === 'daily') html += `<br>連續 ${store.dailyStreak()} 天 🔥`;
    $('win-stats').innerHTML = html;

    const isLast = state.mode === 'campaign' && state.levelNumber >= TOTAL_LEVELS;
    $('btn-win-next').textContent = state.mode === 'campaign' ? '下一關' : '再來一題';
    $('btn-win-next').hidden = isLast || state.mode === 'daily';
    $('btn-win-levels').hidden = state.mode !== 'campaign';
    $('dlg-win').showModal();
  }, 620);
}

function lose() {
  state.finished = true;
  stopTimer();
  setHint('三次機會都用完了。', 'warn');

  setTimeout(() => {
    $('fail-stats').innerHTML =
      `已經放好 <b>${state.game.shibas().length} / ${state.game.size}</b>　用時 <b>${formatTime(state.seconds)}</b>` +
      '<br>答案還在，隨時可以重來。';
    $('dlg-fail').showModal();
  }, 520);
}

/* ── Wiring ──────────────────────────────────────── */

$('btn-back').addEventListener('click', () => history.back());

$('btn-continue').addEventListener('click', () =>
  navigate('game', { mode: 'campaign', levelNumber: store.highestUnlocked() }),
);
$('btn-daily').addEventListener('click', () => navigate('game', { mode: 'daily' }));
$('btn-levels').addEventListener('click', () => navigate('levels'));
$('btn-endless').addEventListener('click', () => $('dlg-endless').showModal());
$('btn-rules').addEventListener('click', () => $('dlg-help').showModal());
$('btn-help').addEventListener('click', () => $('dlg-help').showModal());

$('btn-undo').addEventListener('click', () => {
  state.tap = null;
  if (state.game.undo()) paintBoard();
});

$('btn-clear').addEventListener('click', () => {
  state.tap = null;
  state.game.reset();
  paintBoard();
  setHint('');
});

$('btn-hint').addEventListener('click', () => {
  if (state.finished) return;
  const { game } = state;
  clearFocus();

  // Work out the next move the way a player would, from what is on the board.
  const step = findNext(game.size, game.regions, game.shibas());

  if (step.type === 'wrong') {
    game.snapshot();
    game.cells[step.index] = EMPTY;
    game.refreshAuto();
    game.hintsUsed++;
    paintBoard();
    setHint(`這${mascot.unit}放錯了，先幫你收回來。`, 'warn');
    focusCells([step.index]);
    return;
  }

  if (step.type === 'move') {
    game.snapshot();
    if (step.place !== undefined) game.cells[step.place] = SHIBA;
    for (const index of step.exclude ?? []) {
      if (game.cells[index] === EMPTY || game.cells[index] === AUTO) game.cells[index] = MARK;
    }
    game.refreshAuto();
    game.hintsUsed++;
    paintBoard();
    setHint(`用「${step.technique.name}」：${step.because}`, 'good');
    focusCells(step.focus ?? []);
    if (game.isSolved()) win();
    return;
  }

  // Nothing logical left to say: just hand over one correct square.
  const result = game.hint();
  paintBoard();
  if (result.type === 'reveal') {
    setHint('這個位置是確定的。', 'good');
    focusCells([result.index]);
  } else {
    setHint('已經沒有東西可以推了。');
  }
  if (game.isSolved()) win();
});

$('btn-next-puzzle').addEventListener('click', () =>
  startPuzzle({ mode: 'endless', endlessSize: state.endlessSize }),
);

$('btn-win-next').addEventListener('click', () => {
  $('dlg-win').close();
  if (state.mode === 'campaign') {
    navigate('game', { mode: 'campaign', levelNumber: state.levelNumber + 1, replace: true });
  } else {
    startPuzzle({ mode: 'endless', endlessSize: state.endlessSize });
  }
});

$('btn-win-replay').addEventListener('click', () => {
  $('dlg-win').close();
  startPuzzle({});
});

$('btn-win-levels').addEventListener('click', () => {
  $('dlg-win').close();
  // Step back onto the grid we came from rather than stacking a second copy.
  if (history.state?.from === 'levels') history.back();
  else navigate('levels', { replace: true });
});

$('btn-fail-retry').addEventListener('click', () => {
  $('dlg-fail').close();
  startPuzzle({});
});

$('btn-fail-relax').addEventListener('click', () => {
  $('dlg-fail').close();
  store.setSetting('strict', false);
  state.strict = false;
  state.finished = false;
  renderLives();
  setHint('機會限制關掉了，慢慢玩。');
  resumeTimer();
});

$('btn-fail-back').addEventListener('click', () => {
  $('dlg-fail').close();
  history.back();
});

// Endless-mode size picker
for (let size = 5; size <= 10; size++) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn';
  button.innerHTML = `${size}×${size}<small>${SIZE_LABELS[size]}</small>`;
  button.addEventListener('click', () => {
    $('dlg-endless').close();
    navigate('game', { mode: 'endless', endlessSize: size });
  });
  $('size-grid').append(button);
}

// Difficulty legend and the technique rundown in the help sheet
for (const technique of TECHNIQUES) {
  const chip = document.createElement('span');
  chip.className = 'chip';
  chip.innerHTML = `<i style="background: var(--t${technique.tier})"></i>${technique.name}`;
  $('legend').append(chip);

  const item = document.createElement('li');
  item.innerHTML =
    `<b><i style="background: var(--t${technique.tier})"></i>${technique.name}</b>` +
    `<small>${technique.hint}</small>`;
  $('technique-list').append(item);
}

// Mascot picker
for (const option of MASCOTS) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'mascot-option';
  button.dataset.mascot = option.id;
  button.innerHTML = `${option.svg}${option.name}`;
  button.addEventListener('click', () => {
    store.setSetting('mascot', option.id);
    applyMascot(option.id);
  });
  $('mascot-grid').append(button);
}

// Settings
$('btn-settings').addEventListener('click', () => {
  const settings = store.getSettings();
  $('opt-auto').checked = settings.autoMark;
  $('opt-timer').checked = settings.showTimer;
  $('opt-strict').checked = settings.strict;
  $('dlg-settings').showModal();
});

$('opt-auto').addEventListener('change', (event) => {
  store.setSetting('autoMark', event.target.checked);
  if (state.game) {
    state.game.setAutoMark(event.target.checked);
    paintBoard();
  }
});

$('opt-timer').addEventListener('change', (event) => {
  store.setSetting('showTimer', event.target.checked);
  $('hud-timer-wrap').hidden = !event.target.checked;
});

$('opt-strict').addEventListener('change', (event) => {
  store.setSetting('strict', event.target.checked);
  state.strict = event.target.checked;
  renderLives();
});

$('btn-reset-progress').addEventListener('click', () => {
  if (!confirm('確定要清除所有闖關紀錄嗎？這個動作無法復原。')) return;
  store.resetAll();
  refreshHome();
  $('dlg-settings').close();
});

applyMascot(mascot.id);
history.replaceState({ view: 'home', fromPop: true }, '');
render('home');
