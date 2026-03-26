// state.js -- localStorage state manager

const KEYS = {
  PROBLEMS: 'ml-practice-problems',
  STATS: 'ml-practice-stats',
  TIMER: 'ml-practice-timer',
};

const DEFAULT_PROBLEM_STATE = {
  status: 'unsolved',
  code: null,
  pytorchCode: null,
  bestTimeMs: null,
  peeked: false,
  lastAttempted: null,
};

const DEFAULT_STATS = {
  totalSolved: 0,
  streak: 0,
  lastSolveDate: null,
};

// --- Private helpers ---

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // silently ignore quota or access errors
  }
}

// --- Problem state ---

export function getProblemState(id) {
  const all = load(KEYS.PROBLEMS, {});
  return Object.assign({}, DEFAULT_PROBLEM_STATE, all[id] || {});
}

export function setProblemState(id, updates) {
  const all = load(KEYS.PROBLEMS, {});
  const current = Object.assign({}, DEFAULT_PROBLEM_STATE, all[id] || {});
  all[id] = Object.assign(current, updates);
  save(KEYS.PROBLEMS, all);
}

export function getAllProblemStates() {
  return load(KEYS.PROBLEMS, {});
}

// --- Stats ---

export function getStats() {
  return Object.assign({}, DEFAULT_STATS, load(KEYS.STATS, {}));
}

export function markSolved(problemId) {
  const state = getProblemState(problemId);
  if (state.status !== 'solved') {
    setProblemState(problemId, { status: 'solved', lastAttempted: new Date().toISOString() });

    const stats = getStats();
    stats.totalSolved += 1;

    const today = new Date().toISOString().slice(0, 10);
    if (stats.lastSolveDate === null) {
      stats.streak = 1;
    } else if (stats.lastSolveDate === today) {
      // already solved today, no change to streak
    } else {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      if (stats.lastSolveDate === yesterday) {
        stats.streak += 1;
      } else {
        stats.streak = 1;
      }
    }
    stats.lastSolveDate = today;
    save(KEYS.STATS, stats);
  }
}

export function markAttempted(problemId) {
  const state = getProblemState(problemId);
  if (state.status !== 'solved') {
    setProblemState(problemId, { status: 'attempted', lastAttempted: new Date().toISOString() });
  }
}

// --- Code persistence ---

export function saveCode(problemId, code, framework = 'numpy') {
  if (framework === 'pytorch') {
    setProblemState(problemId, { pytorchCode: code });
  } else {
    setProblemState(problemId, { code });
  }
}

export function getSavedCode(problemId, framework = 'numpy') {
  const state = getProblemState(problemId);
  return framework === 'pytorch' ? state.pytorchCode : state.code;
}

// --- Solution peeking ---

export function markPeeked(problemId) {
  setProblemState(problemId, { peeked: true });
}

// --- Best time ---

export function saveBestTime(problemId, timeMs) {
  const state = getProblemState(problemId);
  if (state.peeked) return;
  if (state.bestTimeMs === null || timeMs < state.bestTimeMs) {
    setProblemState(problemId, { bestTimeMs: timeMs });
  }
}

// --- Timer ---

export function getTimerState(problemId) {
  const timers = load(KEYS.TIMER, {});
  return timers[problemId] !== undefined ? timers[problemId] : null;
}

export function startTimer(problemId) {
  const timers = load(KEYS.TIMER, {});
  timers[problemId] = Date.now();
  save(KEYS.TIMER, timers);
}

export function stopTimer(problemId) {
  const timers = load(KEYS.TIMER, {});
  const started = timers[problemId];
  if (started === undefined) return null;
  const elapsed = Date.now() - started;
  delete timers[problemId];
  save(KEYS.TIMER, timers);
  return elapsed;
}

export function getElapsedMs(problemId) {
  const started = getTimerState(problemId);
  if (started === null) return null;
  return Date.now() - started;
}

// --- Utilities ---

export function formatTime(ms) {
  if (ms === null || ms === undefined) return '00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
}

export function computeCategoryStats(manifest) {
  const allStates = getAllProblemStates();
  const result = {};
  for (const problem of manifest) {
    const category = problem.category;
    if (!result[category]) {
      result[category] = { total: 0, solved: 0 };
    }
    result[category].total += 1;
    const state = allStates[problem.id];
    if (state && state.status === 'solved') {
      result[category].solved += 1;
    }
  }
  return result;
}
