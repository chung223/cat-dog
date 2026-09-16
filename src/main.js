// Screens, input handling and rendering.

import { LEVELS, loadLevel } from './levels.js';
import { generatePuzzle } from './puzzle.js';
import { Game, EMPTY, MARK, SHIBA } from './game.js';
import { SHIBA_SVG } from './shiba.js';
import * as store from './storage.js';

const $ = (id) => document.getElementById(id);

const TOTAL_LEVELS = LEVELS.length;
const DOUBLE_TAP_MS = 330;

const SIZE_LABELS = {
  5: '入門',
  6: '輕鬆',
  7: '普通',
  8: '偏難',
  9: '困難',
  10: '專家',
};

const state = {
  view: 'home',
  mode: 'campaign',
  levelNumber: 1,
  endlessSize: 7,
  game: null,
  cellNodes: [],
  seconds: 0,
  ticker: null,
  focusIndex: 0,
  tap: null,
  pointer: null,
};

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
    $('topbar-title').textContent = '柴犬謎陣';
  } else if (view === 'levels') {
    stopTimer();
    buildLevelGrid();
    $('topbar-title').textContent = '選擇關卡';
  } else {
    startPuzzle(options);
  }
}

function navigate(view, options = {}) {
  render(view, options);
  if (!options.fromPop) {
    history.pushState({ view, ...options, fromPop: true }, '');
  }
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

  const next = store.highestUnlocked();
  $('btn-continue').textContent = cleared === 0 ? '開始第 1 關' : `繼續第 ${next} 關`;
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
    button.innerHTML =
      `<span>${level.n}</span>` +
      `<span class="size">${level.s}×${level.s}</span>` +
      (record?.clean ? '<span class="star">⭐</span>' : record ? '<span class="star">✓</span>' : '');
    button.setAttribute(
      'aria-label',
      `第 ${level.n} 關，${level.s} 乘 ${level.s}${record ? `，已完成，最佳 ${formatTime(record.best)}` : ''}`,
    );
    button.addEventListener('click', () =>
      navigate('game', { mode: 'campaign', levelNumber: level.n }),
    );
    fragment.append(button);
  }

  grid.append(fragment);
}

/* ── Puzzle setup ────────────────────────────────── */

function startPuzzle({ mode = state.mode, levelNumber = state.levelNumber, endlessSize = state.endlessSize } = {}) {
  state.mode = mode;
  state.levelNumber = levelNumber;
  state.endlessSize = endlessSize;

  let puzzle;
  if (mode === 'campaign') {
    puzzle = loadLevel(levelNumber);
    store.setLastLevel(levelNumber);
    $('topbar-title').textContent = `第 ${levelNumber} 關`;
    $('hud-level').textContent = String(levelNumber);
    $('btn-next-puzzle').hidden = true;
  } else {
    puzzle = generatePuzzle(endlessSize, (Date.now() ^ (Math.random() * 1e9)) >>> 0);
    $('topbar-title').textContent = '無盡模式';
    $('hud-level').textContent = `${endlessSize}×${endlessSize}`;
    $('btn-next-puzzle').hidden = false;
  }

  const settings = store.getSettings();
  state.game = new Game({ ...puzzle, autoMark: settings.autoMark });
  state.focusIndex = 0;
  state.tap = null;

  buildBoard();
  paintBoard();
  setHint('');
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

    cell.innerHTML = `<span class="mark"></span><span class="pet">${SHIBA_SVG}</span>`;
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
    const label = value === SHIBA ? '柴犬' : value === EMPTY ? '空白' : '叉';
    cell.setAttribute('aria-label', `第 ${row} 列第 ${col} 欄，${label}`);
  }

  $('hud-count').textContent = `${game.shibas().length} / ${game.size}`;
  $('btn-undo').disabled = game.history.length === 0;

  if (conflicts.size > 0) {
    setHint(conflictMessage([...conflicts.values()][0]), 'warn');
  } else if ($('hint-line').classList.contains('warn')) {
    setHint('');
  }
}

function conflictMessage(reason) {
  return {
    row: '同一列有兩隻柴犬。',
    col: '同一欄有兩隻柴犬。',
    region: '同一個顏色區塊有兩隻柴犬。',
    touch: '兩隻柴犬貼在一起了，八個方向都不行。',
  }[reason] || '';
}

function setHint(text, tone = '') {
  const line = $('hint-line');
  line.textContent = text;
  line.className = `hint-line${tone ? ` ${tone}` : ''}`;
}

/* ── Timer ───────────────────────────────────────── */

function startTimer() {
  stopTimer();
  state.seconds = 0;
  $('hud-timer').textContent = '0:00';
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
  if (event.button === 2) return; // right click is handled by contextmenu
  const cell = event.target.closest('.cell');
  if (!cell) return;
  event.preventDefault();
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
  state.tap = null;
  state.game.snapshot();
  state.game.toggleShiba(Number(cell.dataset.index));
  afterChange();
});

/**
 * A single tap drops a cross straight away so the board never feels laggy.
 * A second tap on the same cell rewinds that cross and puts a shiba there
 * instead, which keeps one undo step per gesture.
 */
function handleTap(index) {
  const now = performance.now();
  const isDouble = state.tap && state.tap.index === index && now - state.tap.time < DOUBLE_TAP_MS;

  if (isDouble) {
    state.game.undo();
    state.game.snapshot();
    state.game.toggleShiba(index);
    state.tap = null;
  } else {
    state.game.snapshot();
    state.game.toggleMark(index);
    state.tap = { index, time: now };
  }
  afterChange();
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

  if (event.key === ' ') {
    event.preventDefault();
    game.snapshot();
    game.toggleMark(index);
    afterChange();
  } else if (event.key === 'Enter') {
    event.preventDefault();
    game.snapshot();
    game.toggleShiba(index);
    afterChange();
  }
});

/* ── Turn resolution ─────────────────────────────── */

function afterChange() {
  paintBoard();
  if (state.game.isSolved()) win();
}

function win() {
  stopTimer();
  const { game } = state;
  const clean = game.hintsUsed === 0;

  if (state.mode === 'campaign') {
    store.recordClear(state.levelNumber, state.seconds, clean);
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
    $('win-stats').innerHTML =
      `用時 <b>${formatTime(state.seconds)}</b>` +
      (record && record.best < state.seconds ? `　最佳 <b>${formatTime(record.best)}</b>` : '') +
      (game.hintsUsed > 0 ? `<br>使用提示 ${game.hintsUsed} 次` : '<br>沒有用提示 ⭐');

    const isLast = state.mode === 'campaign' && state.levelNumber >= TOTAL_LEVELS;
    $('btn-win-next').textContent = state.mode === 'campaign' ? '下一關' : '再來一題';
    $('btn-win-next').hidden = isLast;
    $('btn-win-levels').hidden = state.mode !== 'campaign';
    $('dlg-win').showModal();
  }, 620);
}

/* ── Wiring ──────────────────────────────────────── */

$('hero-art').innerHTML = SHIBA_SVG;
$('win-art').innerHTML = SHIBA_SVG;

$('btn-back').addEventListener('click', () => history.back());

$('btn-continue').addEventListener('click', () =>
  navigate('game', { mode: 'campaign', levelNumber: store.highestUnlocked() }),
);
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
  const result = state.game.hint();
  paintBoard();
  if (result.type === 'wrong') {
    setHint('這隻柴放錯了，先幫你收回來。', 'warn');
  } else if (result.type === 'reveal') {
    setHint('這一隻的位置是確定的。', 'good');
    const cell = state.cellNodes[result.index];
    cell.classList.remove('nudge');
    void cell.offsetWidth;
    cell.classList.add('nudge');
  }
  if (state.game.isSolved()) win();
});

$('btn-next-puzzle').addEventListener('click', () =>
  startPuzzle({ mode: 'endless', endlessSize: state.endlessSize }),
);

$('btn-win-next').addEventListener('click', () => {
  $('dlg-win').close();
  if (state.mode === 'campaign') {
    navigate('game', { mode: 'campaign', levelNumber: state.levelNumber + 1 });
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
  navigate('levels');
});

// Endless-mode size picker
{
  const grid = $('size-grid');
  for (let size = 5; size <= 10; size++) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn';
    button.innerHTML = `${size}×${size}<small>${SIZE_LABELS[size]}</small>`;
    button.addEventListener('click', () => {
      $('dlg-endless').close();
      navigate('game', { mode: 'endless', endlessSize: size });
    });
    grid.append(button);
  }
}

// Settings
$('btn-settings').addEventListener('click', () => {
  const settings = store.getSettings();
  $('opt-auto').checked = settings.autoMark;
  $('opt-timer').checked = settings.showTimer;
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

$('btn-reset-progress').addEventListener('click', () => {
  if (!confirm('確定要清除所有闖關紀錄嗎？這個動作無法復原。')) return;
  store.resetAll();
  refreshHome();
  $('dlg-settings').close();
});

history.replaceState({ view: 'home', fromPop: true }, '');
render('home');
