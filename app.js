import {
  PRNG,
  appendRemainingDigits,
  choosePair,
  cloneState,
  crossPairIndices,
  findPairs,
  isMatch,
  pairKey,
  remainingCount,
  scanVisible,
} from "./game-rules.js";

const STORAGE_STATE_KEY = "numbers-game-web-state-v1";
const STORAGE_SETTINGS_KEY = "numbers-game-web-settings-v1";
const APP_STATE_VERSION = 2;

const DEFAULT_SETTINGS = {
  mode: "manual",
  collapseEmptyRows: true,
  validatePairs: true,
  showHintButton: true,
  feedbackBeforeAppend: false,
  autoStrategy: "search",
  autoDelayMs: 350,
  autoSeed: 1337,
  confettiAmount: 8,
};

const MAX_CONFETTI_AMOUNT = 32;
const CONFETTI_COLORS = ["#38bdf8", "#fbbf24", "#4ade80", "#f472b6", "#a78bfa"];
const HINT_SEARCH_MESSAGE = "Finding a hint…";

const SAFETY_LIMITS = {
  maxMoves: 20000,
  maxCells: 50000,
  maxAppends: 5000,
  maxRunMs: 600000,
};

/** @type {ReturnType<typeof createDefaultState>} */
let state;
let settings;
let selectedIndices = [];
let autoRunning = false;
let stopAutoRequested = false;
let autoRunStartedAt = null;
let autoRandomizer = new PRNG(DEFAULT_SETTINGS.autoSeed);
let deferredInstallPrompt = null;
let historyPast = [];
let historyFuture = [];
let activeDrawer = null;
let boardColumns = null;
let columnContextFrame = null;
let hintSearchWorker = null;

const MAX_HISTORY_DEPTH = 400;
const WIDE_PANELS_QUERY = window.matchMedia("(min-width: 1024px)");

const ui = {
  boardPanel: document.querySelector(".board-panel"),
  boardToolbar: document.querySelector(".board-toolbar"),
  boardWindow: document.querySelector(".board-window"),
  board: document.querySelector("#board"),
  boardContextAbove: document.querySelector("#board-context-above"),
  boardContextBelow: document.querySelector("#board-context-below"),
  boardManualActions: document.querySelector("#board-manual-actions"),
  boardSaveRoundBtn: document.querySelector("#board-save-round-btn"),
  boardHintBtn: document.querySelector("#board-hint-btn"),
  messageLine: document.querySelector("#message-line"),
  statusBadge: document.querySelector("#status-badge"),
  openControlsBtn: document.querySelector("#open-controls-btn"),
  openSummaryBtn: document.querySelector("#open-summary-btn"),
  openHelpBtn: document.querySelector("#open-help-btn"),
  undoBtn: document.querySelector("#undo-btn"),
  redoBtn: document.querySelector("#redo-btn"),
  drawerBackdrop: document.querySelector("#drawer-backdrop"),
  controlsDrawer: document.querySelector("#controls-drawer"),
  summaryDrawer: document.querySelector("#summary-drawer"),
  helpDrawer: document.querySelector("#help-drawer"),
  closeControlsBtn: document.querySelector("#close-controls-btn"),
  closeSummaryBtn: document.querySelector("#close-summary-btn"),
  closeHelpBtn: document.querySelector("#close-help-btn"),
  summaryRemaining: document.querySelector("#summary-remaining"),
  summaryCells: document.querySelector("#summary-cells"),
  summaryPairs: document.querySelector("#summary-pairs"),
  summaryAppends: document.querySelector("#summary-appends"),
  summaryElapsed: document.querySelector("#summary-elapsed"),
  modeSelect: document.querySelector("#mode-select"),
  collapseEmptyRowsToggle: document.querySelector("#collapse-empty-rows-toggle"),
  validateToggle: document.querySelector("#validate-toggle"),
  showHintToggle: document.querySelector("#show-hint-toggle"),
  feedbackToggle: document.querySelector("#feedback-toggle"),
  strategySelect: document.querySelector("#strategy-select"),
  delayRange: document.querySelector("#delay-range"),
  delayValue: document.querySelector("#delay-value"),
  widthInput: document.querySelector("#width-input"),
  confettiAmountInput: document.querySelector("#confetti-amount"),
  confettiAmountValue: document.querySelector("#confetti-amount-value"),
  manualControls: document.querySelector("#manual-controls"),
  autoControls: document.querySelector("#auto-controls"),
  saveRoundBtn: document.querySelector("#save-round-btn"),
  autoStepBtn: document.querySelector("#auto-step-btn"),
  autoRunBtn: document.querySelector("#auto-run-btn"),
  autoStopBtn: document.querySelector("#auto-stop-btn"),
  newGameBtn: document.querySelector("#new-game-btn"),
  newWidthBtn: document.querySelector("#new-width-btn"),
  resetStorageBtn: document.querySelector("#reset-storage-btn"),
  installBtn: document.querySelector("#install-btn"),
  summaryDialog: document.querySelector("#summary-dialog"),
  summaryTitle: document.querySelector("#summary-title"),
  summaryResultLine: document.querySelector("#summary-result-line"),
  finishConfetti: document.querySelector(".finish-confetti"),
  finalScore: document.querySelector("#final-score"),
  finalAccuracy: document.querySelector("#final-accuracy"),
  finalAccuracyDetail: document.querySelector("#final-accuracy-detail"),
  finalPairs: document.querySelector("#final-pairs"),
  finalAppends: document.querySelector("#final-appends"),
  finalCells: document.querySelector("#final-cells"),
  finalRemaining: document.querySelector("#final-remaining"),
  finalDuration: document.querySelector("#final-duration"),
  dialogNewGameForm: document.querySelector("#dialog-new-game-form"),
  dialogModeSelect: document.querySelector("#dialog-mode-select"),
  dialogWidthInput: document.querySelector("#dialog-width-input"),
};

init();

function init() {
  settings = loadSettings();
  state = loadState();
  if (!state) {
    state = createDefaultState(9);
  }
  state.status = normalizeStatus(state.status);
  if (state.status === "active") {
    state.finishedAt = null;
  }

  applySettingsToUI();
  attachEvents();
  applyResponsivePanelLayout();
  registerPWA();
  render();
  if (state.status !== "active") {
    showSummaryDialog();
  }
  window.setInterval(() => {
    renderSummary();
  }, 1000);
}

function defaultSeedDigits() {
  const numbers = [];
  for (let value = 1; value <= 9; value += 1) {
    numbers.push(value);
  }
  for (let value = 11; value <= 19; value += 1) {
    numbers.push(value);
  }
  const digits = [];
  for (const number of numbers) {
    for (const character of String(number)) {
      digits.push(Number(character));
    }
  }
  return digits;
}

function createDefaultState(width = 9, digits = defaultSeedDigits()) {
  return {
    version: APP_STATE_VERSION,
    width,
    cells: digits.map((digit) => ({ digit, crossed: false })),
    appendSteps: 0,
    pairMoves: 0,
    validPairMoves: 0,
    invalidPairMoves: 0,
    status: "active",
    startedAt: Date.now(),
    finishedAt: null,
    resultReason: "",
  };
}

function normalizeStatus(rawStatus) {
  if (rawStatus === "solved" || rawStatus === "stalled") {
    return rawStatus;
  }
  return "active";
}

function currentElapsedMs() {
  const end = state.finishedAt ?? Date.now();
  return Math.max(0, end - state.startedAt);
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function setMessage(text, tone = "") {
  ui.messageLine.textContent = text;
  ui.messageLine.classList.remove("warn", "good");
  if (tone) {
    ui.messageLine.classList.add(tone);
  }
}

function pushHistorySnapshot() {
  historyPast.push(cloneState(state));
  if (historyPast.length > MAX_HISTORY_DEPTH) {
    historyPast.shift();
  }
  historyFuture = [];
}

function clearHistory() {
  historyPast = [];
  historyFuture = [];
}

function applyHistoricalState(nextState) {
  state = cloneState(nextState);
  state.status = normalizeStatus(state.status);
  selectedIndices = [];
  if (ui.summaryDialog.open) {
    ui.summaryDialog.close();
  }
}

function undoMove() {
  if (autoRunning || historyPast.length === 0) {
    return;
  }
  historyFuture.push(cloneState(state));
  const previous = historyPast.pop();
  applyHistoricalState(previous);
  setMessage("Undid last move.");
  render();
}

function redoMove() {
  if (autoRunning || historyFuture.length === 0) {
    return;
  }
  historyPast.push(cloneState(state));
  const next = historyFuture.pop();
  applyHistoricalState(next);
  setMessage("Redid move.");
  render();
  if (state.status !== "active") {
    showSummaryDialog();
  }
}

function hasWidePanelsLayout() {
  return WIDE_PANELS_QUERY.matches;
}

function setDrawerState(drawerElement, open) {
  drawerElement.classList.toggle("hidden", !open);
  drawerElement.setAttribute("aria-hidden", open ? "false" : "true");
  if (open) {
    drawerElement.removeAttribute("inert");
  } else {
    drawerElement.setAttribute("inert", "");
  }
}

function applyResponsivePanelLayout() {
  if (hasWidePanelsLayout()) {
    activeDrawer = null;
    setDrawerState(ui.controlsDrawer, true);
    setDrawerState(ui.summaryDrawer, true);
    setDrawerState(ui.helpDrawer, true);
    ui.drawerBackdrop.classList.add("hidden");
    return;
  }

  if (activeDrawer === "controls") {
    openDrawer("controls");
    return;
  }
  if (activeDrawer === "summary") {
    openDrawer("summary");
    return;
  }
  if (activeDrawer === "help") {
    openDrawer("help");
    return;
  }

  setDrawerState(ui.controlsDrawer, false);
  setDrawerState(ui.summaryDrawer, false);
  setDrawerState(ui.helpDrawer, false);
  ui.drawerBackdrop.classList.add("hidden");
}

function openDrawer(name) {
  if (hasWidePanelsLayout()) {
    applyResponsivePanelLayout();
    return;
  }
  activeDrawer = name;
  const drawers = {
    controls: ui.controlsDrawer,
    summary: ui.summaryDrawer,
    help: ui.helpDrawer,
  };
  const closeButtons = {
    controls: ui.closeControlsBtn,
    summary: ui.closeSummaryBtn,
    help: ui.closeHelpBtn,
  };
  for (const [drawerName, drawerElement] of Object.entries(drawers)) {
    const open = drawerName === name;
    setDrawerState(drawerElement, open);
  }
  ui.drawerBackdrop.classList.toggle("hidden", !name);
  if (name && closeButtons[name]) {
    closeButtons[name].focus({ preventScroll: true });
  }
}

function closeDrawers() {
  if (hasWidePanelsLayout()) {
    applyResponsivePanelLayout();
    return;
  }

  const openButtons = {
    controls: ui.openControlsBtn,
    summary: ui.openSummaryBtn,
    help: ui.openHelpBtn,
  };
  const currentDrawer =
    activeDrawer === "controls"
      ? ui.controlsDrawer
      : activeDrawer === "summary"
        ? ui.summaryDrawer
        : activeDrawer === "help"
          ? ui.helpDrawer
          : null;
  const activeElement = document.activeElement;
  if (
    activeDrawer &&
    currentDrawer &&
    activeElement instanceof HTMLElement &&
    currentDrawer.contains(activeElement)
  ) {
    openButtons[activeDrawer]?.focus({ preventScroll: true });
  }

  activeDrawer = null;
  setDrawerState(ui.controlsDrawer, false);
  setDrawerState(ui.summaryDrawer, false);
  setDrawerState(ui.helpDrawer, false);
  ui.drawerBackdrop.classList.add("hidden");
}

function render() {
  cancelHintSearch();
  renderModePanels();
  renderBoard();
  renderSummary();
  renderStatus();
  saveState();
  saveSettings();
}

function renderModePanels() {
  const manual = settings.mode === "manual";
  ui.manualControls.classList.toggle("hidden", !manual);
  ui.autoControls.classList.toggle("hidden", manual);
  ui.boardManualActions.classList.toggle("hidden", !manual);
  ui.boardHintBtn.hidden = !manual || !settings.showHintButton;
  ui.boardHintBtn.disabled = state.status !== "active" || autoRunning || hintSearchWorker !== null;

  ui.saveRoundBtn.disabled = !manual || state.status !== "active" || autoRunning;
  ui.boardSaveRoundBtn.disabled = !manual || state.status !== "active" || autoRunning;

  ui.autoStepBtn.disabled = manual || state.status !== "active" || autoRunning;
  ui.autoRunBtn.disabled = manual || state.status !== "active" || autoRunning;
  ui.autoStopBtn.disabled = !autoRunning;
  ui.undoBtn.disabled = autoRunning || historyPast.length === 0;
  ui.redoBtn.disabled = autoRunning || historyFuture.length === 0;
}

function renderStatus() {
  const statusText = state.status.toUpperCase();
  ui.statusBadge.textContent = statusText;
  ui.statusBadge.classList.remove("solved", "stalled", "paused");
  if (state.status === "solved") {
    ui.statusBadge.classList.add("solved");
  } else if (state.status === "stalled") {
    ui.statusBadge.classList.add("stalled");
  } else if (autoRunning) {
    ui.statusBadge.classList.add("paused");
  }
}

function renderSummary() {
  ui.summaryRemaining.textContent = String(remainingCount(state));
  ui.summaryCells.textContent = String(state.cells.length);
  ui.summaryPairs.textContent = String(state.pairMoves);
  ui.summaryAppends.textContent = String(state.appendSteps);
  ui.summaryElapsed.textContent = formatDuration(currentElapsedMs());
}

function buildBoardRows(gameState) {
  const rows = [];
  for (let start = 0; start < gameState.cells.length; start += gameState.width) {
    const cells = [];
    for (
      let index = start;
      index < Math.min(start + gameState.width, gameState.cells.length);
      index += 1
    ) {
      cells.push({ cell: gameState.cells[index], index });
    }
    rows.push({ cells });
  }
  return rows;
}

function isFullyCrossedRow(row) {
  return row.cells.length > 0 && row.cells.every(({ cell }) => cell.crossed);
}

function buildRenderableBoardRows(gameState, collapseEmptyRows) {
  const sourceRows = buildBoardRows(gameState);
  if (!collapseEmptyRows) {
    return sourceRows.map((row) => ({ type: "cells", cells: row.cells }));
  }

  const renderRows = [];
  let emptyRun = [];

  function flushEmptyRun() {
    if (emptyRun.length === 0) {
      return;
    }
    if (emptyRun.length === 1) {
      renderRows.push({ type: "cells", cells: emptyRun[0].cells });
    } else {
      renderRows.push({ type: "collapsed-empty", hiddenRowCount: emptyRun.length });
    }
    emptyRun = [];
  }

  for (const row of sourceRows) {
    if (isFullyCrossedRow(row)) {
      emptyRun.push(row);
      continue;
    }
    flushEmptyRun();
    renderRows.push({ type: "cells", cells: row.cells });
  }
  flushEmptyRun();

  return renderRows;
}

function renderCellButton(cell, index, candidateMap) {
  const classes = ["cell"];
  if (cell.crossed) {
    classes.push("crossed");
  }
  if (selectedIndices.includes(index)) {
    classes.push("selected");
  }
  if (candidateMap.has(index)) {
    classes.push(candidateMap.get(index) ? "candidate-valid" : "candidate-invalid");
  }
  const label = cell.crossed ? "·" : String(cell.digit);
  return `<button class="${classes.join(" ")}" data-index="${index}" type="button">${label}</button>`;
}

function renderCollapsedEmptyRow(hiddenRowCount) {
  const label = hiddenRowCount === 1 ? "1 empty row" : `${hiddenRowCount} empty rows`;
  return [
    '<div class="collapsed-empty-row" aria-hidden="true">',
    `<span class="collapsed-empty-row__count">${label}</span>`,
    "</div>",
  ].join("");
}

function renderBoard() {
  ui.boardWindow.style.setProperty("--board-width", String(state.width));
  const candidateMap = new Map();
  if (settings.validatePairs && selectedIndices.length === 1) {
    const [selected] = selectedIndices;
    const digit = state.cells[selected].digit;
    for (const step of [-1, 1, -state.width, state.width]) {
      const neighbor = scanVisible(state, selected, step);
      if (neighbor !== null) {
        candidateMap.set(neighbor, isMatch(digit, state.cells[neighbor].digit));
      }
    }
  }

  const tokens = [];
  for (const row of buildRenderableBoardRows(state, settings.collapseEmptyRows)) {
    if (row.type === "collapsed-empty") {
      tokens.push(renderCollapsedEmptyRow(row.hiddenRowCount));
      continue;
    }
    for (const { cell, index } of row.cells) {
      tokens.push(renderCellButton(cell, index, candidateMap));
    }
  }
  ui.board.innerHTML = tokens.join("");
  boardColumns = null;
  scheduleColumnContext();
}

function collectBoardColumns() {
  const columns = Array.from({ length: state.width }, () => []);
  for (const cell of ui.board.querySelectorAll(".cell:not(.crossed)")) {
    columns[Number(cell.dataset.index) % state.width].push(cell);
  }
  return columns;
}

function findColumnBoundary(cells, precedesBoundary) {
  let start = 0;
  let end = cells.length;
  while (start < end) {
    const middle = Math.floor((start + end) / 2);
    if (precedesBoundary(cells[middle].getBoundingClientRect())) {
      start = middle + 1;
    } else {
      end = middle;
    }
  }
  return start;
}

function renderColumnContext(row, direction, cells) {
  row.hidden = !cells.some(Boolean);
  if (row.hidden) {
    return;
  }
  const markup = cells.map((cell, column) => {
    if (!cell) {
      return "<span></span>";
    }
    const label = `Jump to ${cell.textContent} ${direction} in column ${column + 1}`;
    return `<button type="button" class="board-context-digit" data-context-index="${cell.dataset.index}" aria-label="${label}" title="${label}">${cell.textContent}</button>`;
  }).join("");
  if (row.innerHTML !== markup) {
    row.innerHTML = markup;
  }
}

function updateColumnContext() {
  columnContextFrame = null;
  const panel = hasWidePanelsLayout() ? ui.boardPanel : null;
  const viewportTop = panel ? panel.getBoundingClientRect().top + panel.clientTop : 0;
  const viewportBottom = panel ? viewportTop + panel.clientHeight : ui.boardToolbar.getBoundingClientRect().top;
  const top = Math.max(viewportTop, ui.boardContextAbove.parentElement.getBoundingClientRect().top);
  const bottom = Math.min(viewportBottom, ui.boardContextBelow.parentElement.getBoundingClientRect().top);
  const board = ui.board.getBoundingClientRect();
  const firstCell = ui.board.querySelector(".cell");
  const stripHeight = Math.min(22, firstCell?.getBoundingClientRect().height ?? 0);
  const fits = stripHeight > 0 && bottom - top > 2 * stripHeight;

  let above = [];
  let below = [];
  let clipTop = 0;
  let clipBottom = 0;
  if (fits && (board.top < top || board.bottom > viewportBottom)) {
    boardColumns ??= collectBoardColumns();
    if (board.top < top && boardColumns.some(cells => cells[0]?.getBoundingClientRect().top < top)) {
      const edge = top + stripHeight;
      above = boardColumns.map(cells => cells[findColumnBoundary(cells, rect => rect.top < edge) - 1]);
      clipTop = edge - board.top;
    }
    // The sticky anchor can sit inside the visible area because of panel padding.
    if (board.bottom > viewportBottom &&
        boardColumns.some(cells => cells.at(-1)?.getBoundingClientRect().bottom > viewportBottom)) {
      const edge = bottom - stripHeight;
      below = boardColumns.map(cells => cells[findColumnBoundary(cells, rect => rect.bottom <= edge)]);
      clipBottom = board.bottom - edge;
    }
  }

  ui.boardWindow.style.setProperty("--board-context-height", `${stripHeight}px`);
  ui.board.style.clipPath = clipTop || clipBottom ? `inset(${clipTop}px 0 ${clipBottom}px)` : "";
  renderColumnContext(ui.boardContextAbove, "above", above);
  renderColumnContext(ui.boardContextBelow, "below", below);
}

function scheduleColumnContext() {
  if (columnContextFrame === null) {
    columnContextFrame = requestAnimationFrame(updateColumnContext);
  }
}

function jumpToColumnDigit(event) {
  const target = event.target instanceof Element ? event.target.closest("[data-context-index]") : null;
  if (!target) {
    return;
  }
  const cell = ui.board.querySelector(`[data-index="${target.dataset.contextIndex}"]`);
  if (cell) {
    cell.focus({ preventScroll: true });
    cell.scrollIntoView({ block: "center", inline: "nearest" });
  }
}

function showBoardHint() {
  if (ui.boardHintBtn.hidden || ui.boardHintBtn.disabled) {
    return;
  }

  const pairs = findPairs(state);
  if (pairs.length === 0) {
    setMessage("No matching pairs are available.");
    return;
  }

  if (pairs.length === 1) {
    revealHint(pairs[0]);
    return;
  }

  let worker;
  try {
    worker = new Worker(new URL("./hint-worker.js", import.meta.url), { type: "module" });
  } catch {
    setMessage("Could not search for a hint.", "warn");
    return;
  }

  hintSearchWorker = worker;
  renderModePanels();
  setMessage(HINT_SEARCH_MESSAGE);

  const finish = () => {
    if (hintSearchWorker !== worker) {
      return false;
    }
    cancelHintSearch();
    renderModePanels();
    return true;
  };

  worker.addEventListener("message", ({ data: pair }) => {
    if (finish()) {
      revealHint(pair);
    }
  });
  worker.addEventListener("error", () => {
    if (finish()) {
      setMessage("Could not search for a hint.", "warn");
    }
  });
  worker.postMessage({ gameState: state, pairs, seed: settings.autoSeed });
}

function cancelHintSearch() {
  if (hintSearchWorker) {
    hintSearchWorker.terminate();
    hintSearchWorker = null;
    if (ui.messageLine.textContent === HINT_SEARCH_MESSAGE) {
      setMessage("");
    }
  }
}

function revealHint(pair) {
  const digitButton = ui.board.querySelector(`[data-index="${pair.first}"]`);
  digitButton.classList.add("hinted");
  digitButton.setAttribute("aria-label", `Digit ${state.cells[pair.first].digit} has a match`);
  digitButton.focus({ preventScroll: true });
  digitButton.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function isLegalVisiblePair(first, second) {
  const key = pairKey(first, second);
  for (const pair of findPairs(state)) {
    if (pairKey(pair.first, pair.second) === key) {
      return pair;
    }
  }
  return null;
}

function tryCrossSelected() {
  if (state.status !== "active") {
    setMessage("Game has finished. Start a new game to continue.", "warn");
    return false;
  }
  if (selectedIndices.length !== 2) {
    setMessage("Select exactly two cells to cross.", "warn");
    return false;
  }

  const [first, second] = [...selectedIndices].sort((left, right) => left - right);
  const legalPair = isLegalVisiblePair(first, second);
  if (settings.validatePairs && !legalPair) {
    setMessage("Selected cells are not a valid visible pair.", "warn");
    return false;
  }

  try {
    pushHistorySnapshot();
    crossPairIndices(state, first, second, !legalPair);
    selectedIndices = [];
    const note = legalPair
      ? `Crossed ${first + 1} and ${second + 1} (${legalPair.reason}).`
      : `Crossed ${first + 1} and ${second + 1} (validation disabled).`;
    setMessage(note, "good");
    if (remainingCount(state) === 0) {
      finishGame("solved", "All digits are crossed.");
    } else {
      render();
    }
    return true;
  } catch (error) {
    setMessage(error instanceof Error ? error.message : "Unable to cross selected pair.", "warn");
    return false;
  }
}

function finishGame(status, reason) {
  state.status = status;
  state.resultReason = reason;
  state.finishedAt = Date.now();
  autoRunning = false;
  autoRunStartedAt = null;
  stopAutoRequested = false;
  selectedIndices = [];
  render();
  showSummaryDialog({ celebrate: true });
}

function manualSaveRound() {
  if (state.status !== "active") {
    setMessage("Game already finished. Start a new game.", "warn");
    return;
  }

  if (remainingCount(state) === 0) {
    pushHistorySnapshot();
    finishGame("solved", "All digits are crossed.");
    return;
  }

  const pairs = findPairs(state);
  if (settings.feedbackBeforeAppend && pairs.length > 0) {
    setMessage("Feedback mode: not all pairs were found yet. Append skipped.", "warn");
    render();
    return;
  }

  pushHistorySnapshot();
  const added = appendRemainingDigits(state);
  if (added === 0 || remainingCount(state) === 0) {
    finishGame("solved", "All digits are crossed.");
    return;
  }

  if (findPairs(state).length === 0) {
    finishGame("stalled", "No pairs found after append.");
    return;
  }

  setMessage(`Appended ${added} remaining digits. Next round is ready.`, "good");
  render();
}

function runAutoStep() {
  if (state.status !== "active") {
    return "finished";
  }
  if (state.pairMoves >= SAFETY_LIMITS.maxMoves) {
    pushHistorySnapshot();
    finishGame("stalled", "Stopped by move safety limit.");
    return "finished";
  }
  if (state.cells.length >= SAFETY_LIMITS.maxCells) {
    pushHistorySnapshot();
    finishGame("stalled", "Stopped by cell safety limit.");
    return "finished";
  }
  if (autoRunStartedAt !== null && Date.now() - autoRunStartedAt >= SAFETY_LIMITS.maxRunMs) {
    pushHistorySnapshot();
    finishGame("stalled", "Stopped by runtime safety limit.");
    return "finished";
  }

  const pairs = findPairs(state);
  if (pairs.length > 0) {
    pushHistorySnapshot();
    const pair = choosePair(state, pairs, settings.autoStrategy, autoRandomizer);
    crossPairIndices(state, pair.first, pair.second);
    setMessage(
      `Auto crossed ${pair.first + 1} and ${pair.second + 1} (${pair.reason}, ${pair.direction}).`,
      "good",
    );
    if (remainingCount(state) === 0) {
      finishGame("solved", "All digits are crossed.");
      return "finished";
    }
    render();
    return "pair";
  }

  if (remainingCount(state) === 0) {
    pushHistorySnapshot();
    finishGame("solved", "All digits are crossed.");
    return "finished";
  }

  if (state.appendSteps >= SAFETY_LIMITS.maxAppends) {
    pushHistorySnapshot();
    finishGame("stalled", "Stopped by append safety limit.");
    return "finished";
  }

  pushHistorySnapshot();
  const added = appendRemainingDigits(state);
  if (added === 0 || remainingCount(state) === 0) {
    finishGame("solved", "All digits are crossed.");
    return "finished";
  }
  if (findPairs(state).length === 0) {
    finishGame("stalled", "No pairs found after append.");
    return "finished";
  }

  setMessage(`Auto appended ${added} digits and continues.`, "good");
  render();
  return "append";
}

async function runAutoLoop() {
  if (autoRunning || state.status !== "active") {
    return;
  }
  autoRunning = true;
  autoRunStartedAt = Date.now();
  stopAutoRequested = false;
  if (!hasWidePanelsLayout() && activeDrawer) {
    closeDrawers();
  }
  render();
  setMessage("Automatic play running…");

  while (!stopAutoRequested && state.status === "active") {
    const stepResult = runAutoStep();
    if (stepResult === "finished") {
      break;
    }
    if (settings.autoDelayMs > 0) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => window.setTimeout(resolve, settings.autoDelayMs));
    }
  }

  autoRunning = false;
  autoRunStartedAt = null;
  render();
  if (stopAutoRequested && state.status === "active") {
    setMessage("Automatic play stopped.", "warn");
  }
}

function handleCellClick(index) {
  if (state.status !== "active" || autoRunning) {
    return;
  }
  const cell = state.cells[index];
  if (!cell || cell.crossed) {
    return;
  }

  const existing = selectedIndices.indexOf(index);
  if (existing >= 0) {
    selectedIndices.splice(existing, 1);
    render();
    return;
  }

  if (selectedIndices.length >= 2) {
    selectedIndices = [selectedIndices[1]];
  }
  selectedIndices.push(index);

  if (settings.mode === "manual" && selectedIndices.length === 2) {
    const crossed = tryCrossSelected();
    if (!crossed) {
      render();
    }
  } else {
    render();
  }
}

function applySettingsToUI() {
  ui.modeSelect.value = settings.mode;
  ui.collapseEmptyRowsToggle.checked = settings.collapseEmptyRows;
  ui.validateToggle.checked = settings.validatePairs;
  ui.showHintToggle.checked = settings.showHintButton;
  ui.feedbackToggle.checked = settings.feedbackBeforeAppend;
  ui.strategySelect.value = settings.autoStrategy;
  ui.delayRange.value = String(settings.autoDelayMs);
  ui.delayValue.textContent = `${settings.autoDelayMs} ms`;
  ui.widthInput.value = String(state.width);
  ui.confettiAmountInput.value = String(settings.confettiAmount);
  renderConfettiAmount();
}

function renderConfettiAmount() {
  const amount = settings.confettiAmount;
  ui.confettiAmountValue.textContent = amount === 0 ? "Off" : `${amount} ${amount === 1 ? "piece" : "pieces"}`;
}

function attachEvents() {
  ui.modeSelect.addEventListener("change", () => {
    settings.mode = ui.modeSelect.value;
    selectedIndices = [];
    setMessage(`Switched to ${settings.mode} mode.`);
    render();
  });

  ui.collapseEmptyRowsToggle.addEventListener("change", () => {
    settings.collapseEmptyRows = ui.collapseEmptyRowsToggle.checked;
    render();
  });

  ui.validateToggle.addEventListener("change", () => {
    settings.validatePairs = ui.validateToggle.checked;
    render();
  });

  ui.showHintToggle.addEventListener("change", () => {
    settings.showHintButton = ui.showHintToggle.checked;
    render();
  });

  ui.feedbackToggle.addEventListener("change", () => {
    settings.feedbackBeforeAppend = ui.feedbackToggle.checked;
    render();
  });

  ui.strategySelect.addEventListener("change", () => {
    settings.autoStrategy = ui.strategySelect.value;
    render();
  });

  ui.delayRange.addEventListener("input", () => {
    settings.autoDelayMs = Number(ui.delayRange.value);
    ui.delayValue.textContent = `${settings.autoDelayMs} ms`;
    saveSettings();
  });

  ui.confettiAmountInput.addEventListener("input", () => {
    settings.confettiAmount = ui.confettiAmountInput.valueAsNumber;
    renderConfettiAmount();
    saveSettings();
  });

  ui.newGameBtn.addEventListener("click", () => {
    startNewGame(state.width);
  });

  ui.newWidthBtn.addEventListener("click", () => {
    const width = ui.widthInput.valueAsNumber;
    if (!ui.widthInput.validity.valid || !Number.isInteger(width)) {
      setMessage("Width must be an integer from 3 to 18.", "warn");
      return;
    }
    startNewGame(width);
  });

  ui.saveRoundBtn.addEventListener("click", () => {
    manualSaveRound();
  });

  ui.boardSaveRoundBtn.addEventListener("click", () => {
    manualSaveRound();
  });

  ui.boardHintBtn.addEventListener("click", showBoardHint);

  ui.autoStepBtn.addEventListener("click", () => {
    if (state.status !== "active") {
      return;
    }
    runAutoStep();
  });

  ui.autoRunBtn.addEventListener("click", () => {
    runAutoLoop();
  });

  ui.autoStopBtn.addEventListener("click", () => {
    stopAutoRequested = true;
  });

  ui.undoBtn.addEventListener("click", () => {
    undoMove();
  });

  ui.redoBtn.addEventListener("click", () => {
    redoMove();
  });

  ui.openControlsBtn.addEventListener("click", () => {
    openDrawer(activeDrawer === "controls" ? null : "controls");
  });

  ui.openSummaryBtn.addEventListener("click", () => {
    openDrawer(activeDrawer === "summary" ? null : "summary");
  });

  ui.openHelpBtn.addEventListener("click", () => {
    openDrawer(activeDrawer === "help" ? null : "help");
  });

  ui.closeControlsBtn.addEventListener("click", () => closeDrawers());
  ui.closeSummaryBtn.addEventListener("click", () => closeDrawers());
  ui.closeHelpBtn.addEventListener("click", () => closeDrawers());
  ui.drawerBackdrop.addEventListener("click", () => closeDrawers());
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && activeDrawer) {
      closeDrawers();
    }
  });
  const onWidePanelsChanged = () => {
    applyResponsivePanelLayout();
    renderModePanels();
    scheduleColumnContext();
  };
  if (typeof WIDE_PANELS_QUERY.addEventListener === "function") {
    WIDE_PANELS_QUERY.addEventListener("change", onWidePanelsChanged);
  } else {
    WIDE_PANELS_QUERY.addListener(onWidePanelsChanged);
  }

  ui.resetStorageBtn.addEventListener("click", () => {
    localStorage.removeItem(STORAGE_STATE_KEY);
    localStorage.removeItem(STORAGE_SETTINGS_KEY);
    settings = { ...DEFAULT_SETTINGS };
    state = createDefaultState(9);
    selectedIndices = [];
    autoRunning = false;
    autoRunStartedAt = null;
    stopAutoRequested = true;
    autoRandomizer = new PRNG(settings.autoSeed);
    clearHistory();
    closeDrawers();
    applySettingsToUI();
    setMessage("Local save reset.");
    render();
  });

  ui.board.addEventListener("click", (event) => {
    const target = /** @type {HTMLElement | null} */ (event.target instanceof HTMLElement ? event.target : null);
    const cellButton = target?.closest("[data-index]");
    if (!cellButton) {
      return;
    }
    const index = Number(cellButton.getAttribute("data-index"));
    handleCellClick(index);
  });
  ui.boardWindow.addEventListener("click", jumpToColumnDigit);
  ui.boardPanel.addEventListener("scroll", scheduleColumnContext, { passive: true });
  window.addEventListener("scroll", scheduleColumnContext, { passive: true });
  window.addEventListener("resize", scheduleColumnContext);

  ui.summaryDialog.addEventListener("close", () => {
    saveState();
  });

  ui.dialogNewGameForm.addEventListener("submit", (event) => {
    if (event.submitter?.value === "close") {
      return;
    }
    event.preventDefault();
    settings.mode = ui.dialogModeSelect.value;
    startNewGame(ui.dialogWidthInput.valueAsNumber);
    ui.board.querySelector("button")?.focus();
  });

  ui.installBtn.addEventListener("click", async () => {
    if (!deferredInstallPrompt) {
      return;
    }
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    ui.installBtn.hidden = true;
  });
}

function startNewGame(width) {
  stopAutoRequested = true;
  autoRunning = false;
  autoRunStartedAt = null;
  selectedIndices = [];
  autoRandomizer = new PRNG(settings.autoSeed);
  state = createDefaultState(width);
  clearHistory();
  closeDrawers();
  if (ui.summaryDialog.open) {
    ui.summaryDialog.close();
  }
  applySettingsToUI();
  setMessage("New game started.");
  render();
}

function showSummaryDialog({ celebrate = false } = {}) {
  const remaining = remainingCount(state);
  const total = state.cells.length;
  const score = remaining === 0 ? 100 : Math.floor((100 * (total - remaining)) / total);
  ui.summaryTitle.textContent = state.status === "solved" ? "Board cleared" : "Game finished";
  ui.summaryResultLine.textContent = state.resultReason || "Game finished.";
  ui.finalScore.textContent = `${score}%`;
  renderPairAccuracy();
  ui.finalPairs.textContent = String(state.pairMoves);
  ui.finalAppends.textContent = String(state.appendSteps);
  ui.finalCells.textContent = String(total);
  ui.finalRemaining.textContent = String(remaining);
  ui.finalDuration.textContent = formatDuration(currentElapsedMs());

  if (!ui.summaryDialog.open) {
    ui.dialogModeSelect.value = settings.mode;
    ui.dialogWidthInput.value = String(state.width);
    if (!ui.dialogWidthInput.validity.valid) {
      ui.dialogWidthInput.value = ui.dialogWidthInput.defaultValue;
    }
    renderFinishConfetti(celebrate ? settings.confettiAmount : 0);
    ui.summaryDialog.showModal();
  }
}

function renderFinishConfetti(amount) {
  const particles = Array.from({ length: amount }, (_, index) => {
    const particle = document.createElement("span");
    if (index >= DEFAULT_SETTINGS.confettiAmount) {
      particle.style.setProperty("--confetti-x", `${6 + (index * 37) % 88}%`);
      particle.style.setProperty("--confetti-color", CONFETTI_COLORS[index % CONFETTI_COLORS.length]);
      particle.style.setProperty("--confetti-delay", `${25 + (index * 43) % 220}ms`);
    }
    return particle;
  });
  ui.finishConfetti.replaceChildren(...particles);
  ui.finishConfetti.hidden = amount === 0;
}

function renderPairAccuracy() {
  const scored = state.validPairMoves + state.invalidPairMoves;
  const unscored = state.pairMoves - scored;
  ui.finalAccuracy.textContent = scored > 0
    ? `${Math.floor((100 * state.validPairMoves) / scored)}%`
    : "—";

  const detail = [];
  if (scored > 0) {
    detail.push(`${state.validPairMoves} of ${scored} valid`);
  }
  if (unscored > 0) {
    detail.push(`${unscored} unscored`);
  }
  ui.finalAccuracyDetail.textContent = detail.join(" · ") || "No crossings";
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_STATE_KEY, JSON.stringify(state));
  } catch {
    setMessage("Could not save game state to local storage.", "warn");
  }
}

function saveSettings() {
  try {
    localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage failures silently for settings.
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_STATE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    if (!Array.isArray(parsed.cells) || typeof parsed.width !== "number") {
      return null;
    }
    const cells = parsed.cells
      .map((cell) => ({
        digit: Number(cell.digit),
        crossed: Boolean(cell.crossed),
      }))
      .filter((cell) => Number.isInteger(cell.digit) && cell.digit >= 0 && cell.digit <= 9);
    if (cells.length !== parsed.cells.length || parsed.width <= 0) {
      return null;
    }
    const savedPairMoves = Number(parsed.pairMoves ?? 0);
    const pairMoves = Number.isSafeInteger(savedPairMoves) && savedPairMoves >= 0 ? savedPairMoves : 0;
    const hasAccuracy = Number(parsed.version) === APP_STATE_VERSION
      && Number.isSafeInteger(parsed.validPairMoves) && parsed.validPairMoves >= 0
      && Number.isSafeInteger(parsed.invalidPairMoves) && parsed.invalidPairMoves >= 0
      && parsed.validPairMoves + parsed.invalidPairMoves <= pairMoves;
    return {
      version: APP_STATE_VERSION,
      width: Number(parsed.width),
      cells,
      appendSteps: Number(parsed.appendSteps ?? 0),
      pairMoves,
      validPairMoves: hasAccuracy ? parsed.validPairMoves : 0,
      invalidPairMoves: hasAccuracy ? parsed.invalidPairMoves : 0,
      status: normalizeStatus(parsed.status),
      startedAt: Number(parsed.startedAt ?? Date.now()),
      finishedAt: parsed.finishedAt ? Number(parsed.finishedAt) : null,
      resultReason: String(parsed.resultReason ?? ""),
    };
  } catch {
    return null;
  }
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_SETTINGS_KEY);
    if (!raw) {
      return { ...DEFAULT_SETTINGS };
    }
    const parsed = JSON.parse(raw);
    const delay = Number.isFinite(parsed.autoDelayMs) ? Number(parsed.autoDelayMs) : 350;
    return {
      mode: parsed.mode === "auto" ? "auto" : "manual",
      collapseEmptyRows: parsed.collapseEmptyRows !== false,
      validatePairs: parsed.validatePairs !== false,
      showHintButton: parsed.showHintButton !== false,
      feedbackBeforeAppend: parsed.feedbackBeforeAppend === true,
      autoStrategy: ["first", "max-future", "search"].includes(parsed.autoStrategy)
        ? parsed.autoStrategy
        : "search",
      autoDelayMs: Math.max(0, Math.min(1500, delay)),
      autoSeed: Number.isInteger(parsed.autoSeed) ? Number(parsed.autoSeed) : 1337,
      confettiAmount: Number.isInteger(parsed.confettiAmount) && parsed.confettiAmount >= 0
        && parsed.confettiAmount <= MAX_CONFETTI_AMOUNT ? parsed.confettiAmount : DEFAULT_SETTINGS.confettiAmount,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function registerPWA() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {
        // Ignore service worker registration failures.
      });
    });
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    ui.installBtn.hidden = false;
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    ui.installBtn.hidden = true;
  });
}
