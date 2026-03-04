const STORAGE_STATE_KEY = "numbers-game-web-state-v1";
const STORAGE_SETTINGS_KEY = "numbers-game-web-settings-v1";
const APP_STATE_VERSION = 1;

const DEFAULT_SETTINGS = {
  mode: "manual",
  validatePairs: true,
  feedbackBeforeAppend: false,
  autoStrategy: "search",
  autoDelayMs: 350,
  autoSeed: 1337,
};

const SAFETY_LIMITS = {
  maxMoves: 20000,
  maxCells: 50000,
  maxAppends: 5000,
  maxRunMs: 600000,
};

class PRNG {
  constructor(seed = 1337) {
    this.state = seed >>> 0;
    if (this.state === 0) {
      this.state = 0x9e3779b9;
    }
  }

  next() {
    let value = (this.state += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  nextInt(maxExclusive) {
    return Math.floor(this.next() * maxExclusive);
  }

  fork() {
    return new PRNG(this.nextInt(0xffffffff));
  }
}

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

const MAX_HISTORY_DEPTH = 400;
const WIDE_PANELS_QUERY = window.matchMedia("(min-width: 1024px)");

const ui = {
  board: document.querySelector("#board"),
  boardManualActions: document.querySelector("#board-manual-actions"),
  boardSaveRoundBtn: document.querySelector("#board-save-round-btn"),
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
  validateToggle: document.querySelector("#validate-toggle"),
  feedbackToggle: document.querySelector("#feedback-toggle"),
  strategySelect: document.querySelector("#strategy-select"),
  delayRange: document.querySelector("#delay-range"),
  delayValue: document.querySelector("#delay-value"),
  widthInput: document.querySelector("#width-input"),
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
  summaryResultLine: document.querySelector("#summary-result-line"),
  finalStatus: document.querySelector("#final-status"),
  finalPairs: document.querySelector("#final-pairs"),
  finalAppends: document.querySelector("#final-appends"),
  finalCells: document.querySelector("#final-cells"),
  finalRemaining: document.querySelector("#final-remaining"),
  finalDuration: document.querySelector("#final-duration"),
  dialogNewGameBtn: document.querySelector("#dialog-new-game-btn"),
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

function cloneState(gameState) {
  return {
    ...gameState,
    cells: gameState.cells.map((cell) => ({ digit: cell.digit, crossed: cell.crossed })),
  };
}

function remainingCount(gameState) {
  return gameState.cells.reduce((total, cell) => total + (cell.crossed ? 0 : 1), 0);
}

function remainingDigits(gameState) {
  return gameState.cells.filter((cell) => !cell.crossed).map((cell) => cell.digit);
}

function isMatch(left, right) {
  return left === right || left + right === 10;
}

function scanRight(gameState, startIndex) {
  for (let index = startIndex + 1; index < gameState.cells.length; index += 1) {
    if (!gameState.cells[index].crossed) {
      return index;
    }
  }
  return null;
}

function scanDown(gameState, startIndex) {
  let index = startIndex + gameState.width;
  while (index < gameState.cells.length) {
    if (!gameState.cells[index].crossed) {
      return index;
    }
    index += gameState.width;
  }
  return null;
}

function findPairs(gameState) {
  /** @type {{ first: number; second: number; direction: "right" | "down"; reason: "equal" | "sum10" }[]} */
  const pairs = [];
  const seen = new Set();

  for (let index = 0; index < gameState.cells.length; index += 1) {
    const cell = gameState.cells[index];
    if (cell.crossed) {
      continue;
    }

    const scans = [
      { direction: "right", scanner: scanRight },
      { direction: "down", scanner: scanDown },
    ];
    for (const { direction, scanner } of scans) {
      const neighbor = scanner(gameState, index);
      if (neighbor === null) {
        continue;
      }

      const key = `${index}:${neighbor}`;
      if (seen.has(key)) {
        continue;
      }
      const left = gameState.cells[index].digit;
      const right = gameState.cells[neighbor].digit;
      if (!isMatch(left, right)) {
        continue;
      }

      pairs.push({
        first: index,
        second: neighbor,
        direction,
        reason: left === right ? "equal" : "sum10",
      });
      seen.add(key);
    }
  }

  return pairs;
}

function pairKey(first, second) {
  return first < second ? `${first}:${second}` : `${second}:${first}`;
}

function crossPairIndices(gameState, first, second, force = false) {
  if (first === second) {
    throw new Error("Select two different cells.");
  }
  const firstCell = gameState.cells[first];
  const secondCell = gameState.cells[second];
  if (!firstCell || !secondCell) {
    throw new Error("Selected pair is out of bounds.");
  }
  if (firstCell.crossed || secondCell.crossed) {
    throw new Error("Selected cells are already crossed.");
  }
  if (!force && !isMatch(firstCell.digit, secondCell.digit)) {
    throw new Error("Pair digits must be equal or sum to 10.");
  }
  firstCell.crossed = true;
  secondCell.crossed = true;
  gameState.pairMoves += 1;
}

function appendRemainingDigits(gameState) {
  const digits = remainingDigits(gameState);
  if (digits.length === 0) {
    return 0;
  }
  for (const digit of digits) {
    gameState.cells.push({ digit, crossed: false });
  }
  gameState.appendSteps += 1;
  return digits.length;
}

function choosePairFirst(pairs) {
  return pairs[0];
}

function choosePairMaxFuture(gameState, pairs, randomizer) {
  let bestScore = -1;
  let bestCandidates = [pairs[0]];
  for (const pair of pairs) {
    const simulated = cloneState(gameState);
    crossPairIndices(simulated, pair.first, pair.second);
    const score = findPairs(simulated).length;
    if (score > bestScore) {
      bestScore = score;
      bestCandidates = [pair];
    } else if (score === bestScore) {
      bestCandidates.push(pair);
    }
  }
  if (bestCandidates.length === 1) {
    return bestCandidates[0];
  }
  return bestCandidates[randomizer.nextInt(bestCandidates.length)];
}

function rolloutScore(baseState, randomizer, maxMoves, maxAppends) {
  const simulated = cloneState(baseState);
  let moves = 0;
  let appends = 0;

  while (moves < maxMoves) {
    const pairs = findPairs(simulated);
    if (pairs.length > 0) {
      const pair = choosePairMaxFuture(simulated, pairs, randomizer);
      crossPairIndices(simulated, pair.first, pair.second);
      moves += 1;
      continue;
    }

    if (remainingCount(simulated) === 0) {
      return 100000 - appends * 100 - moves;
    }
    if (appends >= maxAppends) {
      break;
    }
    const added = appendRemainingDigits(simulated);
    appends += 1;
    if (added === 0 || findPairs(simulated).length === 0) {
      break;
    }
  }

  return -(
    remainingCount(simulated) +
    appends * 15 +
    simulated.cells.length * 0.05
  );
}

function choosePairSearch(gameState, pairs, randomizer) {
  if (pairs.length === 1) {
    return pairs[0];
  }

  let rolloutCount;
  let rolloutMoves;
  let rolloutAppends;
  if (gameState.cells.length <= 180) {
    rolloutCount = 7;
    rolloutMoves = 70;
    rolloutAppends = 2;
  } else if (gameState.cells.length <= 400) {
    rolloutCount = 5;
    rolloutMoves = 45;
    rolloutAppends = 2;
  } else {
    rolloutCount = 3;
    rolloutMoves = 30;
    rolloutAppends = 1;
  }

  const candidates = pairs
    .map((pair) => {
      const simulated = cloneState(gameState);
      crossPairIndices(simulated, pair.first, pair.second);
      return {
        pair,
        simulated,
        immediateScore: findPairs(simulated).length,
      };
    })
    .sort((left, right) => right.immediateScore - left.immediateScore)
    .slice(0, 6);

  let bestPair = candidates[0].pair;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const candidate of candidates) {
    let total = candidate.immediateScore * 0.5;
    for (let index = 0; index < rolloutCount; index += 1) {
      total += rolloutScore(
        candidate.simulated,
        randomizer.fork(),
        rolloutMoves,
        rolloutAppends,
      );
    }
    const average = total / (rolloutCount + 0.5);
    if (average > bestScore) {
      bestScore = average;
      bestPair = candidate.pair;
    }
  }
  return bestPair;
}

function choosePair(gameState, pairs, strategy, randomizer) {
  if (strategy === "first") {
    return choosePairFirst(pairs);
  }
  if (strategy === "max-future") {
    return choosePairMaxFuture(gameState, pairs, randomizer);
  }
  return choosePairSearch(gameState, pairs, randomizer);
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

function renderBoard() {
  ui.board.style.setProperty("--board-width", String(state.width));
  const oneSelected = selectedIndices.length === 1 ? selectedIndices[0] : null;
  const possiblePairs = oneSelected === null ? [] : findPairs(state);
  const candidateMap = new Map();

  if (oneSelected !== null) {
    for (const pair of possiblePairs) {
      if (pair.first === oneSelected) {
        candidateMap.set(pair.second, true);
      } else if (pair.second === oneSelected) {
        candidateMap.set(pair.first, true);
      }
    }
  }

  const tokens = state.cells.map((cell, index) => {
    const classes = ["cell"];
    if (cell.crossed) {
      classes.push("crossed");
    }
    if (selectedIndices.includes(index)) {
      classes.push("selected");
    }
    if (oneSelected !== null && !cell.crossed && index !== oneSelected) {
      if (candidateMap.get(index)) {
        classes.push("candidate-valid");
      } else if (settings.validatePairs) {
        classes.push("candidate-invalid");
      }
    }
    const label = cell.crossed ? "·" : String(cell.digit);
    return `<button class="${classes.join(" ")}" data-index="${index}" type="button">${label}</button>`;
  });
  ui.board.innerHTML = tokens.join("");
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
    crossPairIndices(state, first, second, !settings.validatePairs && !legalPair);
    selectedIndices = [];
    const note = legalPair
      ? `Crossed ${first + 1} and ${second + 1} (${legalPair.reason}).`
      : `Crossed ${first + 1} and ${second + 1} (validation disabled).`;
    setMessage(note, "good");
    render();
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
  showSummaryDialog();
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
  ui.validateToggle.checked = settings.validatePairs;
  ui.feedbackToggle.checked = settings.feedbackBeforeAppend;
  ui.strategySelect.value = settings.autoStrategy;
  ui.delayRange.value = String(settings.autoDelayMs);
  ui.delayValue.textContent = `${settings.autoDelayMs} ms`;
  ui.widthInput.value = String(state.width);
}

function attachEvents() {
  ui.modeSelect.addEventListener("change", () => {
    settings.mode = ui.modeSelect.value;
    selectedIndices = [];
    setMessage(`Switched to ${settings.mode} mode.`);
    render();
  });

  ui.validateToggle.addEventListener("change", () => {
    settings.validatePairs = ui.validateToggle.checked;
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

  ui.newGameBtn.addEventListener("click", () => {
    startNewGame(state.width);
  });

  ui.newWidthBtn.addEventListener("click", () => {
    const width = Number(ui.widthInput.value);
    if (!Number.isInteger(width) || width < 3 || width > 18) {
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

  ui.summaryDialog.addEventListener("close", () => {
    saveState();
  });

  ui.dialogNewGameBtn.addEventListener("click", (event) => {
    event.preventDefault();
    ui.summaryDialog.close();
    startNewGame(state.width);
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
  ui.widthInput.value = String(width);
  setMessage("New game started.");
  render();
}

function showSummaryDialog() {
  ui.summaryResultLine.textContent = state.resultReason || "Game finished.";
  ui.finalStatus.textContent = state.status.toUpperCase();
  ui.finalPairs.textContent = String(state.pairMoves);
  ui.finalAppends.textContent = String(state.appendSteps);
  ui.finalCells.textContent = String(state.cells.length);
  ui.finalRemaining.textContent = String(remainingCount(state));
  ui.finalDuration.textContent = formatDuration(currentElapsedMs());

  if (!ui.summaryDialog.open) {
    ui.summaryDialog.showModal();
  }
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
    return {
      version: Number(parsed.version ?? APP_STATE_VERSION),
      width: Number(parsed.width),
      cells,
      appendSteps: Number(parsed.appendSteps ?? 0),
      pairMoves: Number(parsed.pairMoves ?? 0),
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
      validatePairs: parsed.validatePairs !== false,
      feedbackBeforeAppend: parsed.feedbackBeforeAppend === true,
      autoStrategy: ["first", "max-future", "search"].includes(parsed.autoStrategy)
        ? parsed.autoStrategy
        : "search",
      autoDelayMs: Math.max(0, Math.min(1500, delay)),
      autoSeed: Number.isInteger(parsed.autoSeed) ? Number(parsed.autoSeed) : 1337,
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
