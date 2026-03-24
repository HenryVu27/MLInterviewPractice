# Phase 1: Platform Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the ML Interview Practice static site engine -- Pyodide-powered Python execution, CodeMirror editor, problem loading, state persistence, and UI for both landing and problem pages.

**Architecture:** Static site (no build step) using ES modules. Two HTML pages (index.html for problem list, problem.html for solving). Pyodide runs in a classic Web Worker. State persisted in localStorage. All dependencies loaded from CDN (esm.sh for ES modules, jsdelivr for Pyodide).

**Tech Stack:** Vanilla JS (ES modules), CodeMirror 6 (via esm.sh), Pyodide 0.27.x (via jsdelivr), marked.js (via esm.sh), hand-written CSS.

**Spec:** `docs/superpowers/specs/2026-03-23-ml-interview-practice-phase1-design.md`

**Note on spec deviations:** The spec places all logic in `app.js` + `pyodide-runner.js`. This plan refines that into: `state.js` (shared state), `app.js` (landing page), `problem.js` (problem page), `editor.js` (CodeMirror wrapper), and `pyodide-worker.js` (worker). This decomposition gives each file a single responsibility and keeps files small enough to work with reliably. The worker is named `pyodide-worker.js` (spec says `pyodide-runner.js`) to clarify it runs as a Web Worker.

**Testing approach:** This is a static site with no test framework. Each task is verified by serving locally (`python3 -m http.server 8080`) and checking behavior in the browser. The 3 sample problems serve as end-to-end tests for the engine.

---

## File Structure

```
MLInterviewPractice/
  index.html              -- Landing page HTML shell
  problem.html            -- Problem page HTML shell
  style.css               -- All styles (dark-mode, responsive, editor, tables)
  state.js                -- localStorage state manager (ES module, shared)
  app.js                  -- Landing page logic (ES module, entry for index.html)
  problem.js              -- Problem page logic (ES module, entry for problem.html)
  editor.js               -- CodeMirror 6 setup (ES module, used by problem.js)
  pyodide-worker.js       -- Pyodide Web Worker (classic script, NOT ES module)
  problems/
    index.json            -- Manifest: all 253 problem metadata entries
    1.1.json              -- Sample: Matrix Multiplication (Easy)
    3.3.json              -- Sample: Logistic Regression (Medium)
    10.1.json             -- Sample: Scaled Dot-Product Attention (Medium)
```

**Responsibilities:**
- `state.js` -- Read/write localStorage, compute stats (solved count, streak), export getters/setters. No DOM access.
- `app.js` -- Renders problem table, handles filters, displays stats. Imports `state.js`.
- `problem.js` -- Loads problem JSON, manages editor, sends code to worker, displays results, handles timer/solution. Imports `state.js` and `editor.js`.
- `editor.js` -- Creates and configures CodeMirror 6 instance. Exports a function that takes a DOM element + initial code and returns editor API.
- `pyodide-worker.js` -- Classic worker script. Loads Pyodide via `importScripts()`, handles `message` events, runs Python, posts results back.

---

## Task 1: Project Scaffold + CSS Foundation

**Files:**
- Create: `index.html`
- Create: `problem.html`
- Create: `style.css`

This task creates the HTML shells and all CSS. Both pages will be visually complete (with placeholder content) before any JS is written.

- [ ] **Step 1: Create `style.css` with CSS custom properties and all styles**

```css
/* === CSS Custom Properties === */
:root {
  --bg-primary: #0f0f1a;
  --bg-secondary: #1a1a2e;
  --bg-tertiary: #16213e;
  --bg-card: #1e1e3a;
  --text-primary: #e0e0e0;
  --text-secondary: #a0a0b0;
  --text-muted: #6c6c80;
  --accent: #4a9eff;
  --accent-hover: #6bb3ff;
  --accent-dim: #2a5a9e;
  --green: #4caf50;
  --yellow: #ffc107;
  --red: #f44336;
  --green-dim: #1b3a1b;
  --red-dim: #3a1b1b;
  --border: #2a2a4a;
  --font-mono: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --radius: 8px;
  --radius-sm: 4px;
}

/* === Reset & Base === */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { font-size: 16px; }
body {
  font-family: var(--font-sans);
  background: var(--bg-primary);
  color: var(--text-primary);
  line-height: 1.6;
  min-height: 100vh;
}
a { color: var(--accent); text-decoration: none; }
a:hover { color: var(--accent-hover); }
code, pre { font-family: var(--font-mono); }

/* === Header === */
.header {
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  padding: 1rem 2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.header h1 { font-size: 1.25rem; font-weight: 600; }
.header .tagline { color: var(--text-muted); font-size: 0.85rem; }

/* === Stats Bar === */
.stats-bar {
  display: flex;
  gap: 2rem;
  padding: 1rem 2rem;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
}
.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.stat-value { font-size: 1.5rem; font-weight: 700; color: var(--accent); }
.stat-label { font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; }

/* === Filter Bar === */
.filter-bar {
  display: flex;
  gap: 1rem;
  padding: 1rem 2rem;
  flex-wrap: wrap;
  align-items: center;
}
.filter-bar select,
.filter-bar input {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  font-family: var(--font-sans);
}
.filter-bar select:focus,
.filter-bar input:focus {
  outline: none;
  border-color: var(--accent);
}
.difficulty-toggles { display: flex; gap: 0.25rem; }
.difficulty-toggles button {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  border: 1px solid var(--border);
  padding: 0.4rem 0.75rem;
  font-size: 0.8rem;
  cursor: pointer;
  border-radius: var(--radius-sm);
  font-family: var(--font-sans);
}
.difficulty-toggles button.active { border-color: var(--accent); color: var(--text-primary); }
.difficulty-toggles button[data-diff="Easy"].active { color: var(--green); border-color: var(--green); }
.difficulty-toggles button[data-diff="Medium"].active { color: var(--yellow); border-color: var(--yellow); }
.difficulty-toggles button[data-diff="Hard"].active { color: var(--red); border-color: var(--red); }

/* === Problem Table === */
.problem-table { width: 100%; border-collapse: collapse; }
.problem-table th {
  text-align: left;
  padding: 0.75rem 1rem;
  font-size: 0.75rem;
  text-transform: uppercase;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border);
}
.problem-table td {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border);
  font-size: 0.9rem;
}
.problem-table tr:hover { background: var(--bg-tertiary); cursor: pointer; }
.problem-table .id-col { width: 60px; color: var(--text-muted); }
.problem-table .diff-col { width: 80px; }
.problem-table .cat-col { width: 200px; color: var(--text-secondary); font-size: 0.8rem; }
.problem-table .status-col { width: 60px; text-align: center; }
.problem-table .time-col { width: 80px; color: var(--text-muted); font-size: 0.8rem; }
.diff-easy { color: var(--green); }
.diff-medium { color: var(--yellow); }
.diff-hard { color: var(--red); }
.status-solved { color: var(--green); }
.status-attempted { color: var(--yellow); }

/* === Problem Page Layout === */
.problem-layout {
  display: flex;
  height: calc(100vh - 52px); /* header height */
  overflow: hidden;
}
.problem-left {
  width: 40%;
  overflow-y: auto;
  padding: 1.5rem;
  border-right: 1px solid var(--border);
}
.problem-right {
  width: 60%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* === Problem Description === */
.problem-title { font-size: 1.25rem; margin-bottom: 0.5rem; }
.problem-meta { display: flex; gap: 0.75rem; margin-bottom: 1rem; align-items: center; }
.problem-meta .tag {
  background: var(--bg-tertiary);
  padding: 0.2rem 0.5rem;
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  color: var(--text-secondary);
}
.problem-description { line-height: 1.7; }
.problem-description h1, .problem-description h2, .problem-description h3 {
  margin-top: 1.25rem;
  margin-bottom: 0.5rem;
}
.problem-description p { margin-bottom: 0.75rem; }
.problem-description code {
  background: var(--bg-tertiary);
  padding: 0.15rem 0.4rem;
  border-radius: var(--radius-sm);
  font-size: 0.85em;
}
.problem-description pre {
  background: var(--bg-tertiary);
  padding: 1rem;
  border-radius: var(--radius);
  overflow-x: auto;
  margin-bottom: 1rem;
}
.problem-description pre code { background: none; padding: 0; }

.constraints-list {
  list-style: none;
  margin: 1rem 0;
}
.constraints-list li {
  padding: 0.4rem 0;
  padding-left: 1.25rem;
  position: relative;
  color: var(--text-secondary);
  font-size: 0.9rem;
}
.constraints-list li::before {
  content: '\2022';
  position: absolute;
  left: 0;
  color: var(--red);
}

/* === Hints === */
.hints-section { margin-top: 1.5rem; }
.hint-toggle {
  background: none;
  border: 1px solid var(--border);
  color: var(--text-secondary);
  padding: 0.5rem 1rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.85rem;
  font-family: var(--font-sans);
}
.hint-toggle:hover { border-color: var(--accent); color: var(--text-primary); }
.hint-content {
  display: none;
  margin-top: 0.5rem;
  padding: 0.75rem 1rem;
  background: var(--bg-tertiary);
  border-radius: var(--radius);
  font-size: 0.9rem;
  color: var(--text-secondary);
}
.hint-content.visible { display: block; }

/* === Editor Area === */
.editor-container {
  flex: 1;
  overflow: hidden;
  border-bottom: 1px solid var(--border);
}
.editor-container .cm-editor {
  height: 100%;
}
.editor-container .cm-editor .cm-scroller {
  font-family: var(--font-mono);
  font-size: 14px;
  line-height: 1.5;
}

/* === Action Bar === */
.action-bar {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  align-items: center;
}
.btn {
  padding: 0.5rem 1rem;
  border-radius: var(--radius-sm);
  border: none;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 500;
  font-family: var(--font-sans);
  transition: background 0.15s;
}
.btn-primary { background: var(--accent); color: #fff; }
.btn-primary:hover { background: var(--accent-hover); }
.btn-primary:disabled { background: var(--accent-dim); cursor: not-allowed; }
.btn-secondary { background: var(--bg-tertiary); color: var(--text-secondary); border: 1px solid var(--border); }
.btn-secondary:hover { color: var(--text-primary); border-color: var(--accent); }
.btn-danger { background: transparent; color: var(--red); border: 1px solid var(--border); }
.btn-danger:hover { border-color: var(--red); }
.action-spacer { flex: 1; }

/* === Timer === */
.timer {
  font-family: var(--font-mono);
  font-size: 0.9rem;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.timer.running { color: var(--accent); }

/* === Test Results === */
.test-results {
  max-height: 250px;
  overflow-y: auto;
  padding: 0.75rem 1rem;
  background: var(--bg-primary);
}
.test-result {
  padding: 0.5rem 0.75rem;
  margin-bottom: 0.25rem;
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  font-family: var(--font-mono);
}
.test-result.pass { background: var(--green-dim); color: var(--green); }
.test-result.fail { background: var(--red-dim); color: var(--red); }
.test-result .test-name { font-weight: 600; }
.test-result .test-output {
  margin-top: 0.25rem;
  font-size: 0.8rem;
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
}
.test-result .test-time { float: right; color: var(--text-muted); font-size: 0.75rem; }

/* === Solution View === */
.solution-panel {
  display: none;
  padding: 1.5rem;
  overflow-y: auto;
  background: var(--bg-primary);
}
.solution-panel.visible {
  display: block;
}
.solution-panel h3 { margin-bottom: 0.75rem; }
.solution-panel pre {
  background: var(--bg-tertiary);
  padding: 1rem;
  border-radius: var(--radius);
  overflow-x: auto;
  margin-bottom: 1.5rem;
}

/* === Loading Overlay === */
.loading-overlay {
  position: fixed;
  bottom: 1rem;
  right: 1rem;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0.75rem 1.25rem;
  font-size: 0.85rem;
  color: var(--text-secondary);
  display: none;
  z-index: 100;
}
.loading-overlay.visible { display: flex; align-items: center; gap: 0.5rem; }
.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* === Error State === */
.error-message {
  padding: 2rem;
  text-align: center;
  color: var(--text-muted);
}
.error-message h2 { margin-bottom: 0.5rem; color: var(--text-secondary); }
.error-message a { color: var(--accent); }

/* === Navigation === */
.problem-nav {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}
.problem-nav a {
  color: var(--text-muted);
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
}
.problem-nav a:hover { color: var(--text-primary); background: var(--bg-tertiary); }

/* === Progress Ring === */
.progress-ring { display: inline-block; }
.progress-ring circle:last-child {
  transition: stroke-dashoffset 0.5s ease;
  transform: rotate(-90deg);
  transform-origin: 50% 50%;
}

/* === Responsive === */
@media (max-width: 1024px) {
  .problem-layout {
    flex-direction: column;
    height: auto;
  }
  .problem-left, .problem-right {
    width: 100%;
  }
  .problem-left {
    border-right: none;
    border-bottom: 1px solid var(--border);
    max-height: 40vh;
  }
  .editor-container { min-height: 300px; }
}
@media (max-width: 768px) {
  .header { padding: 0.75rem 1rem; }
  .stats-bar { padding: 0.75rem 1rem; gap: 1rem; flex-wrap: wrap; }
  .filter-bar { padding: 0.75rem 1rem; }
  .problem-table .cat-col { display: none; }
  .problem-table .time-col { display: none; }
}
```

- [ ] **Step 2: Create `index.html` shell**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ML Interview Practice</title>
  <link rel="stylesheet" href="style.css">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
</head>
<body>
  <header class="header">
    <div>
      <h1>ML Interview Practice</h1>
      <span class="tagline">253 problems. Pure numpy. No excuses.</span>
    </div>
  </header>

  <div class="stats-bar" id="stats-bar">
    <!-- Populated by app.js -->
  </div>

  <div class="filter-bar" id="filter-bar">
    <select id="filter-category">
      <option value="">All Categories</option>
    </select>
    <div class="difficulty-toggles" id="difficulty-toggles">
      <button data-diff="Easy" class="active">Easy</button>
      <button data-diff="Medium" class="active">Medium</button>
      <button data-diff="Hard" class="active">Hard</button>
    </div>
    <select id="filter-status">
      <option value="">All Status</option>
      <option value="solved">Solved</option>
      <option value="attempted">Attempted</option>
      <option value="unsolved">Unsolved</option>
    </select>
    <input type="text" id="filter-search" placeholder="Search problems...">
  </div>

  <div style="padding: 0 2rem; overflow-x: auto;">
    <table class="problem-table" id="problem-table">
      <thead>
        <tr>
          <th class="id-col">#</th>
          <th>Title</th>
          <th class="diff-col">Difficulty</th>
          <th class="cat-col">Category</th>
          <th class="status-col">Status</th>
          <th class="time-col">Best</th>
        </tr>
      </thead>
      <tbody id="problem-list">
        <!-- Populated by app.js -->
      </tbody>
    </table>
  </div>

  <script type="module" src="app.js"></script>
</body>
</html>
```

- [ ] **Step 3: Create `problem.html` shell**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Problem - ML Interview Practice</title>
  <link rel="stylesheet" href="style.css">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
</head>
<body>
  <header class="header">
    <div class="problem-nav">
      <a href="index.html">&larr; Problems</a>
      <a id="prev-link" href="#">&lsaquo; Prev</a>
      <a id="next-link" href="#">Next &rsaquo;</a>
    </div>
    <div class="timer" id="timer">
      <button class="btn btn-secondary" id="timer-btn">Start Timer</button>
      <span id="timer-display">00:00</span>
    </div>
  </header>

  <div class="problem-layout">
    <!-- Left: Description -->
    <div class="problem-left">
      <h2 class="problem-title" id="problem-title">Loading...</h2>
      <div class="problem-meta" id="problem-meta"></div>
      <div class="problem-description" id="problem-description"></div>

      <div id="constraints-section">
        <h3 style="margin-top: 1.5rem; margin-bottom: 0.5rem; font-size: 0.95rem;">Constraints</h3>
        <ul class="constraints-list" id="constraints-list"></ul>
      </div>

      <div class="hints-section" id="hints-section"></div>

      <div id="related-section" style="margin-top: 1.5rem;"></div>
    </div>

    <!-- Right: Editor + Results -->
    <div class="problem-right">
      <div class="action-bar">
        <button class="btn btn-primary" id="run-btn" disabled>Run Tests</button>
        <button class="btn btn-secondary" id="reset-btn">Reset Code</button>
        <span class="action-spacer"></span>
        <button class="btn btn-danger" id="solution-btn">Show Solution</button>
      </div>
      <div class="editor-container" id="editor-container"></div>
      <div class="test-results" id="test-results">
        <span style="color: var(--text-muted); font-size: 0.85rem;">Click "Run Tests" to execute your code.</span>
      </div>
      <div class="solution-panel" id="solution-panel"></div>
    </div>
  </div>

  <div class="loading-overlay" id="loading-overlay">
    <div class="spinner"></div>
    <span id="loading-text">Loading Python runtime...</span>
  </div>

  <script type="module" src="problem.js"></script>
</body>
</html>
```

- [ ] **Step 4: Verify -- serve and check both pages render**

Run: `cd /Users/vuducdung/personal/MLInterviewPractice && python3 -m http.server 8080`

Open `http://localhost:8080/` -- should see dark-themed landing page with header, empty stats bar, filter bar, and empty table.
Open `http://localhost:8080/problem.html` -- should see dark-themed split layout with "Loading..." title, empty editor area, action buttons.

- [ ] **Step 5: Commit**

```bash
git add index.html problem.html style.css
git commit -m "feat: add HTML shells and CSS foundation (dark theme)"
```

---

## Task 2: State Manager

**Files:**
- Create: `state.js`

Pure data module with no DOM dependencies. All localStorage access goes through this module.

- [ ] **Step 1: Create `state.js`**

```javascript
// state.js -- localStorage state manager
// All reads/writes to localStorage go through this module.

const PROBLEMS_KEY = 'ml-practice-problems';
const STATS_KEY = 'ml-practice-stats';
const TIMER_KEY = 'ml-practice-timer';

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// --- Problem State ---

export function getProblemState(id) {
  const all = load(PROBLEMS_KEY, {});
  return all[id] || { status: 'unsolved', code: null, bestTimeMs: null, peeked: false, lastAttempted: null };
}

export function setProblemState(id, updates) {
  const all = load(PROBLEMS_KEY, {});
  all[id] = { ...getProblemState(id), ...updates };
  save(PROBLEMS_KEY, all);
}

export function getAllProblemStates() {
  return load(PROBLEMS_KEY, {});
}

// --- Stats ---

export function getStats() {
  return load(STATS_KEY, { totalSolved: 0, streak: 0, lastSolveDate: null });
}

export function markSolved(problemId) {
  const state = getProblemState(problemId);
  if (state.status === 'solved') return; // already solved

  setProblemState(problemId, {
    status: 'solved',
    lastAttempted: new Date().toISOString()
  });

  const stats = getStats();
  stats.totalSolved += 1;

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  if (stats.lastSolveDate === today) {
    // Same day, streak unchanged
  } else if (stats.lastSolveDate === yesterday) {
    stats.streak += 1;
  } else {
    stats.streak = 1;
  }
  stats.lastSolveDate = today;

  save(STATS_KEY, stats);
}

export function markAttempted(problemId) {
  const state = getProblemState(problemId);
  if (state.status === 'solved') return; // don't downgrade
  setProblemState(problemId, {
    status: 'attempted',
    lastAttempted: new Date().toISOString()
  });
}

export function saveCode(problemId, code) {
  setProblemState(problemId, { code });
}

export function markPeeked(problemId) {
  setProblemState(problemId, { peeked: true });
}

export function saveBestTime(problemId, timeMs) {
  const state = getProblemState(problemId);
  if (state.peeked) return; // don't record if they peeked
  if (state.bestTimeMs === null || timeMs < state.bestTimeMs) {
    setProblemState(problemId, { bestTimeMs: timeMs });
  }
}

// --- Timer ---

export function getTimerState(problemId) {
  return load(TIMER_KEY, {})[problemId] || null;
}

export function startTimer(problemId) {
  const timers = load(TIMER_KEY, {});
  timers[problemId] = Date.now();
  save(TIMER_KEY, timers);
}

export function stopTimer(problemId) {
  const timers = load(TIMER_KEY, {});
  const started = timers[problemId];
  delete timers[problemId];
  save(TIMER_KEY, timers);
  return started ? Date.now() - started : null;
}

export function getElapsedMs(problemId) {
  const started = getTimerState(problemId);
  return started ? Date.now() - started : 0;
}

// --- Utility ---

export function formatTime(ms) {
  if (!ms) return '--:--';
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function computeCategoryStats(manifest) {
  const states = getAllProblemStates();
  const categories = {};

  for (const p of manifest) {
    if (!categories[p.category]) {
      categories[p.category] = { total: 0, solved: 0 };
    }
    categories[p.category].total += 1;
    if (states[p.id]?.status === 'solved') {
      categories[p.category].solved += 1;
    }
  }
  return categories;
}
```

- [ ] **Step 2: Verify -- import in browser console**

Open browser dev console on `http://localhost:8080/` and run:
```javascript
const s = await import('./state.js');
s.saveCode('test', 'print("hi")');
console.log(s.getProblemState('test'));
// Should show { status: 'unsolved', code: 'print("hi")', ... }
```

- [ ] **Step 3: Commit**

```bash
git add state.js
git commit -m "feat: add localStorage state manager"
```

---

## Task 3: Pyodide Web Worker

**Files:**
- Create: `pyodide-worker.js`

Classic Web Worker (not ES module). Loads Pyodide via `importScripts()`, handles run requests, returns test results.

- [ ] **Step 1: Create `pyodide-worker.js`**

```javascript
// pyodide-worker.js -- Classic Web Worker for Pyodide execution
// NOT an ES module. Uses importScripts() for Pyodide.

let pyodide = null;

async function initPyodide() {
  postMessage({ type: 'loading', progress: 'Downloading Python runtime...' });
  importScripts('https://cdn.jsdelivr.net/pyodide/v0.27.5/full/pyodide.js');
  pyodide = await loadPyodide();
  postMessage({ type: 'loading', progress: 'Loading numpy...' });
  await pyodide.loadPackage('numpy');
  postMessage({ type: 'ready' });
}

const initPromise = initPyodide();

onmessage = async function (e) {
  if (e.data.type !== 'run') return;

  await initPromise;

  const { userCode, tests } = e.data;
  const results = [];

  // Reset Python namespace to avoid stale definitions from previous runs
  try {
    pyodide.runPython(`
import sys
# Keep only initial modules and builtins
_keep = set(sys.modules.keys())
for _name in list(dir()):
    if not _name.startswith('_'):
        try:
            del globals()[_name]
        except:
            pass
import numpy as np
`);
  } catch {
    // ignore cleanup errors
  }

  // Execute user code first (defines classes/functions)
  try {
    pyodide.runPython(userCode);
  } catch (err) {
    // If user code itself fails, all tests fail
    for (const test of tests) {
      results.push({
        name: test.name,
        passed: false,
        output: '',
        error: `Error in your code:\n${err.message}`,
        timeMs: 0
      });
    }
    postMessage({ type: 'result', results });
    return;
  }

  // Run each test case
  for (const test of tests) {
    const start = performance.now();
    let passed = false;
    let output = '';
    let error = '';

    try {
      // Redirect stdout
      pyodide.runPython(`
import sys, io
_test_stdout = io.StringIO()
sys.stdout = _test_stdout
`);
      pyodide.runPython(test.code);
      passed = true;
      output = pyodide.runPython('_test_stdout.getvalue()');
    } catch (err) {
      error = err.message;
      try {
        output = pyodide.runPython('_test_stdout.getvalue()');
      } catch {
        // ignore
      }
    } finally {
      try {
        pyodide.runPython('sys.stdout = sys.__stdout__');
      } catch {
        // ignore
      }
    }

    results.push({
      name: test.name,
      passed,
      output,
      error,
      timeMs: Math.round(performance.now() - start)
    });
  }

  postMessage({ type: 'result', results });
};
```

- [ ] **Step 2: Verify -- test worker manually from console**

Open `http://localhost:8080/problem.html` dev console:
```javascript
const w = new Worker('pyodide-worker.js');
w.onmessage = e => console.log('Worker:', e.data);
// Wait for { type: 'ready' } message (may take 5-15 seconds first time)
// Then:
w.postMessage({
  type: 'run',
  userCode: 'def add(a, b): return a + b',
  tests: [{ name: 'test add', code: 'assert add(1, 2) == 3' }]
});
// Should see { type: 'result', results: [{ name: 'test add', passed: true, ... }] }
```

- [ ] **Step 3: Commit**

```bash
git add pyodide-worker.js
git commit -m "feat: add Pyodide Web Worker for Python execution"
```

---

## Task 4: CodeMirror Editor Module

**Files:**
- Create: `editor.js`

Wraps CodeMirror 6 setup. Exports a single function to create an editor instance.

- [ ] **Step 1: Create `editor.js`**

```javascript
// editor.js -- CodeMirror 6 editor setup
// Loaded as ES module. All CM6 packages from esm.sh CDN.

import { basicSetup } from 'https://esm.sh/codemirror@6';
import { EditorView, keymap } from 'https://esm.sh/@codemirror/view@6';
import { EditorState } from 'https://esm.sh/@codemirror/state@6';
import { python } from 'https://esm.sh/@codemirror/lang-python@6';
import { oneDark } from 'https://esm.sh/@codemirror/theme-one-dark@6';
import { indentWithTab } from 'https://esm.sh/@codemirror/commands@6';

/**
 * Create a CodeMirror 6 editor instance.
 * @param {HTMLElement} parent - DOM element to mount the editor in
 * @param {string} initialCode - Starting code content
 * @param {function} onChange - Called with new code string on every change (debounced by caller)
 * @returns {{ getCode: () => string, setCode: (s: string) => void, view: EditorView }}
 */
export function createEditor(parent, initialCode, onChange) {
  const updateListener = EditorView.updateListener.of((update) => {
    if (update.docChanged && onChange) {
      onChange(update.state.doc.toString());
    }
  });

  const view = new EditorView({
    state: EditorState.create({
      doc: initialCode,
      extensions: [
        basicSetup,
        python(),
        oneDark,
        keymap.of([indentWithTab]),
        updateListener,
        EditorView.theme({
          '&': { height: '100%' },
          '.cm-scroller': { overflow: 'auto' }
        })
      ]
    }),
    parent
  });

  return {
    getCode: () => view.state.doc.toString(),
    setCode: (code) => {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: code }
      });
    },
    view
  };
}
```

**Note on CDN imports:** The exact version numbers for esm.sh packages may need adjustment. If `@codemirror/basic-setup@0.20.0` is not found, use the latest available version. The `esm.sh` CDN resolves transitive dependencies automatically.

- [ ] **Step 2: Verify -- mount editor on problem page**

Temporarily add to bottom of `problem.html` before the existing script tag (or in console):
```javascript
import { createEditor } from './editor.js';
const ed = createEditor(
  document.getElementById('editor-container'),
  '# Type Python here\nprint("hello")',
  (code) => console.log('Changed:', code.slice(0, 50))
);
```

Should see a dark-themed code editor with Python highlighting. Typing should log changes to console.

- [ ] **Step 3: Commit**

```bash
git add editor.js
git commit -m "feat: add CodeMirror 6 editor module"
```

---

## Task 5: Sample Problem JSON Files

**Files:**
- Create: `problems/index.json`
- Create: `problems/1.1.json`
- Create: `problems/3.3.json`
- Create: `problems/10.1.json`

Create the manifest (all 253 entries, metadata only) and 3 full sample problems.

- [ ] **Step 1: Create the 3 full sample problem JSON files**

Create `problems/1.1.json` (Matrix Multiplication -- Easy):

```json
{
  "id": "1.1",
  "title": "Matrix Multiplication from Scratch",
  "difficulty": "Easy",
  "category": "Linear Algebra & Matrix Operations",
  "tags": ["numpy", "from-scratch"],
  "description": "Implement matrix multiplication **without using numpy's built-in `@` operator or `np.dot`**.\n\nGiven two 2D lists (matrices), return their matrix product as a 2D list.\n\nYour function should:\n- Validate that the matrices can be multiplied (cols of A == rows of B)\n- Raise a `ValueError` if shapes are incompatible\n- Return the result as a list of lists\n\n**Example:**\n```\nA = [[1, 2], [3, 4]]\nB = [[5, 6], [7, 8]]\nmatmul(A, B) = [[19, 22], [43, 50]]\n```\n\n**Why this matters in interviews:** Matrix multiplication is the fundamental operation behind every neural network layer. Understanding the O(n^3) naive algorithm helps you appreciate why GPUs and optimized BLAS libraries exist.",
  "constraints": [
    "Do NOT use numpy, np.dot, np.matmul, or the @ operator",
    "Use only Python built-in lists and loops",
    "Must validate shape compatibility",
    "Return a list of lists (not numpy array)"
  ],
  "starter_code": "def matmul(A: list[list[float]], B: list[list[float]]) -> list[list[float]]:\n    \"\"\"Multiply two matrices A and B.\n    \n    Args:\n        A: Matrix of shape (m, n) as list of lists\n        B: Matrix of shape (n, p) as list of lists\n    \n    Returns:\n        Result matrix of shape (m, p) as list of lists\n    \n    Raises:\n        ValueError: If inner dimensions don't match\n    \"\"\"\n    pass",
  "solution_code": "def matmul(A: list[list[float]], B: list[list[float]]) -> list[list[float]]:\n    m = len(A)\n    n = len(A[0])\n    n2 = len(B)\n    p = len(B[0])\n    \n    if n != n2:\n        raise ValueError(f\"Cannot multiply: A has {n} cols but B has {n2} rows\")\n    \n    # Initialize result matrix with zeros\n    C = [[0.0] * p for _ in range(m)]\n    \n    for i in range(m):\n        for j in range(p):\n            for k in range(n):\n                C[i][j] += A[i][k] * B[k][j]\n    \n    return C",
  "explanation": "**Key concepts:**\n\n1. **Shape rule:** For A (m x n) and B (n x p), the result is (m x p). The inner dimensions must match.\n\n2. **Triple loop:** Each element C[i][j] is the dot product of row i of A with column j of B: `C[i][j] = sum(A[i][k] * B[k][j] for k in range(n))`.\n\n3. **Complexity:** O(m * n * p). For square matrices, this is O(n^3).\n\n4. **Why not use numpy?** In interviews, this tests whether you understand the operation at a fundamental level. In production, always use numpy/BLAS -- they use optimized algorithms (Strassen, cache-aware blocking) that are 100-1000x faster.",
  "test_cases": [
    {
      "name": "2x2 multiplication",
      "code": "result = matmul([[1, 2], [3, 4]], [[5, 6], [7, 8]])\nassert result == [[19, 22], [43, 50]], f'Expected [[19, 22], [43, 50]], got {result}'"
    },
    {
      "name": "Non-square matrices (2x3 @ 3x2)",
      "code": "A = [[1, 2, 3], [4, 5, 6]]\nB = [[7, 8], [9, 10], [11, 12]]\nresult = matmul(A, B)\nassert result == [[58, 64], [139, 154]], f'Expected [[58, 64], [139, 154]], got {result}'"
    },
    {
      "name": "Shape mismatch raises ValueError",
      "code": "try:\n    matmul([[1, 2]], [[3, 4]])\n    assert False, 'Should have raised ValueError'\nexcept ValueError:\n    pass  # expected"
    },
    {
      "name": "Identity matrix multiplication",
      "code": "I = [[1, 0], [0, 1]]\nA = [[3, 7], [2, 5]]\nresult = matmul(A, I)\nassert result == [[3, 7], [2, 5]], f'A @ I should equal A, got {result}'"
    }
  ],
  "hints": [
    "The result matrix has dimensions (rows of A) x (cols of B)",
    "Each element C[i][j] = sum of A[i][k] * B[k][j] for all k"
  ],
  "related_problems": ["1.2", "1.7", "1.12"]
}
```

Create `problems/3.3.json` (Logistic Regression -- Medium):

```json
{
  "id": "3.3",
  "title": "Logistic Regression",
  "difficulty": "Medium",
  "category": "Classic ML Algorithms",
  "tags": ["numpy", "from-scratch", "optimization"],
  "description": "Implement binary logistic regression with sigmoid activation, binary cross-entropy loss, and gradient descent optimization.\n\nYour implementation should include:\n- `sigmoid(z)`: numerically stable sigmoid\n- `fit(X, y, lr, epochs)`: train via gradient descent\n- `predict_proba(X)`: return probabilities\n- `predict(X)`: return binary predictions (threshold 0.5)\n\n**Shapes:**\n- X: (n_samples, n_features)\n- y: (n_samples,) with values 0 or 1\n- predict_proba returns: (n_samples,)\n- predict returns: (n_samples,) with values 0 or 1",
  "constraints": [
    "Use only numpy -- no sklearn or other ML libraries",
    "Sigmoid must be numerically stable (handle large negative values)",
    "Gradient computation must be vectorized (no Python loops over samples)"
  ],
  "starter_code": "import numpy as np\n\nclass LogisticRegression:\n    def __init__(self, n_features: int):\n        \"\"\"Initialize weights and bias.\"\"\"\n        pass\n\n    def sigmoid(self, z: np.ndarray) -> np.ndarray:\n        \"\"\"Numerically stable sigmoid.\"\"\"\n        pass\n\n    def fit(self, X: np.ndarray, y: np.ndarray, lr: float = 0.01, epochs: int = 1000):\n        \"\"\"Train via gradient descent on binary cross-entropy loss.\"\"\"\n        pass\n\n    def predict_proba(self, X: np.ndarray) -> np.ndarray:\n        \"\"\"Return probability of class 1.\"\"\"\n        pass\n\n    def predict(self, X: np.ndarray) -> np.ndarray:\n        \"\"\"Return binary predictions (threshold 0.5).\"\"\"\n        pass",
  "solution_code": "import numpy as np\n\nclass LogisticRegression:\n    def __init__(self, n_features: int):\n        self.w = np.zeros(n_features)\n        self.b = 0.0\n\n    def sigmoid(self, z):\n        z = np.clip(z, -500, 500)\n        return 1 / (1 + np.exp(-z))\n\n    def fit(self, X, y, lr=0.01, epochs=1000):\n        N = X.shape[0]\n        for _ in range(epochs):\n            y_pred = self.predict_proba(X)\n            error = y_pred - y\n            self.w -= lr * (1/N) * (X.T @ error)\n            self.b -= lr * (1/N) * np.sum(error)\n\n    def predict_proba(self, X):\n        return self.sigmoid(X @ self.w + self.b)\n\n    def predict(self, X):\n        return (self.predict_proba(X) >= 0.5).astype(int)",
  "explanation": "**Key concepts:**\n\n1. **Sigmoid**: Maps any real number to (0,1). Must clip input to avoid overflow in exp().\n\n2. **Gradient of BCE w.r.t. weights**: dL/dw = (1/N) * X^T @ (y_pred - y). This elegant result comes from the chain rule: dL/dp * dp/dz * dz/dw, where the sigmoid derivative cancels neatly.\n\n3. **Why vectorized**: X.T @ error computes all feature gradients in one matrix multiply instead of looping over N samples.\n\n**Complexity**: O(N*D) per epoch where N=samples, D=features.",
  "test_cases": [
    {
      "name": "Basic binary classification",
      "code": "np.random.seed(42)\nX = np.random.randn(100, 2)\ny = (X[:, 0] + X[:, 1] > 0).astype(float)\nmodel = LogisticRegression(2)\nmodel.fit(X, y, lr=0.1, epochs=500)\nacc = np.mean(model.predict(X) == y)\nassert acc > 0.85, f'Accuracy {acc:.2f} too low, expected > 0.85'"
    },
    {
      "name": "Sigmoid numerical stability",
      "code": "model = LogisticRegression(1)\nassert model.sigmoid(np.array([-1000.0])) < 1e-6, 'Sigmoid(-1000) should be ~0'\nassert model.sigmoid(np.array([1000.0])) > 1 - 1e-6, 'Sigmoid(1000) should be ~1'\nassert not np.isnan(model.sigmoid(np.array([-1000.0]))), 'Sigmoid should not return NaN'"
    },
    {
      "name": "Predict probabilities in [0, 1]",
      "code": "np.random.seed(0)\nX = np.random.randn(50, 3)\nmodel = LogisticRegression(3)\nmodel.fit(X, (X[:, 0] > 0).astype(float), lr=0.1, epochs=100)\nprobs = model.predict_proba(X)\nassert np.all(probs >= 0) and np.all(probs <= 1), 'Probabilities must be in [0, 1]'"
    },
    {
      "name": "Predict returns 0 or 1",
      "code": "np.random.seed(0)\nX = np.random.randn(50, 3)\nmodel = LogisticRegression(3)\nmodel.fit(X, (X[:, 0] > 0).astype(float))\npreds = model.predict(X)\nassert set(np.unique(preds)).issubset({0, 1}), 'Predictions must be 0 or 1'"
    }
  ],
  "hints": [
    "The gradient of BCE loss w.r.t. the weights simplifies to (1/N) * X^T @ (predictions - labels)",
    "np.clip the input to sigmoid to prevent overflow in np.exp()"
  ],
  "related_problems": ["3.1", "3.2", "5.11", "7.1"]
}
```

Create `problems/10.1.json` (Scaled Dot-Product Attention -- Medium):

```json
{
  "id": "10.1",
  "title": "Scaled Dot-Product Attention",
  "difficulty": "Medium",
  "category": "Attention & Transformers",
  "tags": ["numpy", "from-scratch"],
  "description": "Implement **scaled dot-product attention** from the \"Attention Is All You Need\" paper.\n\nGiven queries Q, keys K, and values V:\n\n```\nAttention(Q, K, V) = softmax(Q @ K^T / sqrt(d_k)) @ V\n```\n\nWhere `d_k` is the dimension of the key vectors (last dimension of K).\n\nYour implementation should:\n- Compute attention scores as `Q @ K^T / sqrt(d_k)`\n- Apply an optional mask (set masked positions to `-inf` before softmax)\n- Apply softmax row-wise to get attention weights\n- Return both the output (`weights @ V`) and the attention weights\n\n**Shapes:**\n- Q: (seq_len_q, d_k)\n- K: (seq_len_k, d_k)\n- V: (seq_len_k, d_v)\n- mask: (seq_len_q, seq_len_k) boolean, True = mask out\n- Output: (seq_len_q, d_v)\n- Weights: (seq_len_q, seq_len_k)",
  "constraints": [
    "Use only numpy -- no PyTorch or TensorFlow",
    "Softmax must be numerically stable (subtract max trick)",
    "Support an optional boolean mask parameter",
    "Return a tuple of (output, attention_weights)"
  ],
  "starter_code": "import numpy as np\n\ndef scaled_dot_product_attention(\n    Q: np.ndarray,\n    K: np.ndarray,\n    V: np.ndarray,\n    mask: np.ndarray = None\n) -> tuple[np.ndarray, np.ndarray]:\n    \"\"\"Compute scaled dot-product attention.\n    \n    Args:\n        Q: Queries, shape (seq_len_q, d_k)\n        K: Keys, shape (seq_len_k, d_k)\n        V: Values, shape (seq_len_k, d_v)\n        mask: Optional boolean mask, shape (seq_len_q, seq_len_k).\n              True positions are masked (set to -inf before softmax).\n    \n    Returns:\n        output: Attention output, shape (seq_len_q, d_v)\n        weights: Attention weights, shape (seq_len_q, seq_len_k)\n    \"\"\"\n    pass",
  "solution_code": "import numpy as np\n\ndef scaled_dot_product_attention(Q, K, V, mask=None):\n    d_k = K.shape[-1]\n    \n    # Compute attention scores\n    scores = Q @ K.T / np.sqrt(d_k)\n    \n    # Apply mask if provided\n    if mask is not None:\n        scores = np.where(mask, -1e9, scores)\n    \n    # Stable softmax (subtract max per row)\n    scores_max = scores.max(axis=-1, keepdims=True)\n    exp_scores = np.exp(scores - scores_max)\n    weights = exp_scores / exp_scores.sum(axis=-1, keepdims=True)\n    \n    # Compute output\n    output = weights @ V\n    \n    return output, weights",
  "explanation": "**Key concepts:**\n\n1. **Scaling by sqrt(d_k):** Without scaling, dot products grow with dimension d_k, pushing softmax into regions with tiny gradients. Dividing by sqrt(d_k) keeps variance roughly constant.\n\n2. **Stable softmax:** Subtracting the max from each row before exp() prevents overflow. The result is mathematically identical: `softmax(x) == softmax(x - max(x))`.\n\n3. **Masking:** Setting positions to -inf before softmax makes those attention weights ~0 after softmax. This is how causal (autoregressive) attention prevents attending to future tokens.\n\n4. **Shapes:** Q@K^T gives (seq_q, seq_k) scores. After softmax, these weights sum to 1 per query. Multiplying by V (seq_k, d_v) gives (seq_q, d_v) output -- each query gets a weighted combination of values.\n\n**Complexity:** O(seq_q * seq_k * d_k) for score computation, O(seq_q * seq_k * d_v) for the weighted sum.",
  "test_cases": [
    {
      "name": "Basic attention (identity-like)",
      "code": "np.random.seed(42)\nQ = np.eye(3)\nK = np.eye(3)\nV = np.array([[1, 0], [0, 1], [1, 1]], dtype=float)\nout, weights = scaled_dot_product_attention(Q, K, V)\n# With identity Q and K, each query attends mostly to its matching key\nassert out.shape == (3, 2), f'Output shape should be (3, 2), got {out.shape}'\nassert weights.shape == (3, 3), f'Weights shape should be (3, 3), got {weights.shape}'\n# Diagonal of weights should be the largest values\nfor i in range(3):\n    assert weights[i, i] == weights[i].max(), f'Query {i} should attend most to key {i}'"
    },
    {
      "name": "Weights sum to 1 per row",
      "code": "np.random.seed(0)\nQ = np.random.randn(5, 8)\nK = np.random.randn(10, 8)\nV = np.random.randn(10, 4)\n_, weights = scaled_dot_product_attention(Q, K, V)\nrow_sums = weights.sum(axis=-1)\nassert np.allclose(row_sums, 1.0), f'Attention weights must sum to 1, got {row_sums}'"
    },
    {
      "name": "Causal mask blocks future tokens",
      "code": "np.random.seed(1)\nseq_len = 4\nd = 8\nQ = np.random.randn(seq_len, d)\nK = np.random.randn(seq_len, d)\nV = np.random.randn(seq_len, d)\n# Upper triangular mask (True = masked)\nmask = np.triu(np.ones((seq_len, seq_len), dtype=bool), k=1)\n_, weights = scaled_dot_product_attention(Q, K, V, mask=mask)\n# Check that masked positions have ~0 weight\nfor i in range(seq_len):\n    for j in range(i + 1, seq_len):\n        assert weights[i, j] < 1e-6, f'Position ({i},{j}) should be masked, got weight {weights[i,j]}'"
    },
    {
      "name": "Output shape matches (seq_q, d_v)",
      "code": "Q = np.random.randn(3, 16)\nK = np.random.randn(7, 16)\nV = np.random.randn(7, 32)\nout, w = scaled_dot_product_attention(Q, K, V)\nassert out.shape == (3, 32), f'Expected (3, 32), got {out.shape}'\nassert w.shape == (3, 7), f'Expected (3, 7), got {w.shape}'"
    }
  ],
  "hints": [
    "d_k is K.shape[-1] -- the last dimension of the key matrix",
    "For stable softmax: subtract the row-wise max before taking exp()",
    "Use np.where(mask, -1e9, scores) to apply the mask before softmax"
  ],
  "related_problems": ["10.2", "10.3", "5.9"]
}
```

- [ ] **Step 2: Create `problems/index.json` manifest**

Generate the full manifest with all 253 problem entries. Each entry has `id`, `title`, `difficulty`, `category`, and `tags`. Use the complete question bank from `/Users/vuducdung/personal/interview_prep/ml_coding_questions_bank.md` as the source.

The manifest is just metadata -- no code, no descriptions. Only the 3 sample problems above have full JSON files.

- [ ] **Step 3: Verify -- fetch and parse JSON**

Open `http://localhost:8080/` console:
```javascript
const manifest = await fetch('problems/index.json').then(r => r.json());
console.log(`Manifest: ${manifest.length} problems`); // Should be 253
const p = await fetch('problems/1.1.json').then(r => r.json());
console.log(p.title); // "Matrix Multiplication from Scratch"
```

- [ ] **Step 4: Commit**

```bash
git add problems/
git commit -m "feat: add problem manifest (253 entries) and 3 sample problems"
```

---

## Task 6: Problem Page Logic

**Files:**
- Create: `problem.js`

This is the main controller for `problem.html`. It loads the problem, sets up the editor, manages the worker, displays test results, handles timer/solution/navigation.

- [ ] **Step 1: Create `problem.js`**

```javascript
// problem.js -- Problem page controller
import { createEditor } from './editor.js';
import {
  getProblemState, saveCode, markAttempted, markSolved, markPeeked,
  saveBestTime, getTimerState, startTimer, stopTimer, getElapsedMs, formatTime
} from './state.js';

// --- Marked.js for markdown rendering ---
import { marked } from 'https://esm.sh/marked@15';

// --- DOM refs ---
const titleEl = document.getElementById('problem-title');
const metaEl = document.getElementById('problem-meta');
const descEl = document.getElementById('problem-description');
const constraintsEl = document.getElementById('constraints-list');
const hintsEl = document.getElementById('hints-section');
const relatedEl = document.getElementById('related-section');
const editorContainer = document.getElementById('editor-container');
const runBtn = document.getElementById('run-btn');
const resetBtn = document.getElementById('reset-btn');
const solutionBtn = document.getElementById('solution-btn');
const testResultsEl = document.getElementById('test-results');
const solutionPanel = document.getElementById('solution-panel');
const loadingOverlay = document.getElementById('loading-overlay');
const loadingText = document.getElementById('loading-text');
const timerBtn = document.getElementById('timer-btn');
const timerDisplay = document.getElementById('timer-display');
const timerEl = document.getElementById('timer');
const prevLink = document.getElementById('prev-link');
const nextLink = document.getElementById('next-link');

// --- State ---
let problem = null;
let editor = null;
let worker = null;
let manifest = null;
let timerInterval = null;
let solutionVisible = false;

// --- Init ---
async function init() {
  const id = new URLSearchParams(window.location.search).get('id');
  if (!id) {
    showError('No problem ID specified.');
    return;
  }

  // Load manifest for navigation
  try {
    manifest = await fetch('problems/index.json').then(r => r.json());
  } catch {
    manifest = [];
  }

  // Load problem
  try {
    const res = await fetch(`problems/${id}.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    problem = await res.json();
  } catch (err) {
    showError(`Problem "${id}" not found. It may not be available yet.`);
    return;
  }

  document.title = `${problem.id} ${problem.title} - ML Interview Practice`;
  renderProblem();
  setupEditor();
  setupNavigation();
  setupTimer();
  initWorker();
  setupEventListeners();
}

function showError(message) {
  document.querySelector('.problem-layout').innerHTML = `
    <div class="error-message">
      <h2>Problem Not Found</h2>
      <p>${message}</p>
      <a href="index.html">&larr; Back to problem list</a>
    </div>
  `;
}

// --- Render Problem ---
function renderProblem() {
  titleEl.textContent = `${problem.id}. ${problem.title}`;

  const diffClass = { Easy: 'diff-easy', Medium: 'diff-medium', Hard: 'diff-hard' }[problem.difficulty];
  metaEl.innerHTML = `
    <span class="${diffClass}">${problem.difficulty}</span>
    ${problem.tags.map(t => `<span class="tag">${t}</span>`).join('')}
  `;

  descEl.innerHTML = marked.parse(problem.description);

  constraintsEl.innerHTML = problem.constraints.map(c => `<li>${c}</li>`).join('');

  // Hints
  if (problem.hints && problem.hints.length > 0) {
    hintsEl.innerHTML = problem.hints.map((hint, i) => `
      <button class="hint-toggle" data-hint="${i}">Hint ${i + 1}</button>
      <div class="hint-content" id="hint-${i}">${hint}</div>
    `).join('');
    hintsEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.hint-toggle');
      if (!btn) return;
      const content = document.getElementById(`hint-${btn.dataset.hint}`);
      content.classList.toggle('visible');
    });
  }

  // Related problems
  if (problem.related_problems && problem.related_problems.length > 0) {
    relatedEl.innerHTML = `
      <h3 style="font-size: 0.95rem; margin-bottom: 0.5rem;">Related Problems</h3>
      <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
        ${problem.related_problems.map(id => {
          const entry = manifest.find(p => p.id === id);
          const title = entry ? entry.title : `Problem ${id}`;
          return `<a href="problem.html?id=${id}" class="tag" style="cursor:pointer;">${id}: ${title}</a>`;
        }).join('')}
      </div>
    `;
  }
}

// --- Editor ---
function setupEditor() {
  const state = getProblemState(problem.id);
  const initialCode = state.code || problem.starter_code;

  let debounceTimer = null;
  editor = createEditor(editorContainer, initialCode, (code) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => saveCode(problem.id, code), 1000);
  });
}

// --- Worker ---
function initWorker() {
  createWorker();
}

function createWorker() {
  if (worker) worker.terminate();
  worker = new Worker('pyodide-worker.js');
  runBtn.disabled = true;

  loadingOverlay.classList.add('visible');

  worker.onmessage = (e) => {
    const { type } = e.data;

    if (type === 'loading') {
      loadingText.textContent = e.data.progress;
    } else if (type === 'ready') {
      loadingOverlay.classList.remove('visible');
      runBtn.disabled = false;
    } else if (type === 'result') {
      handleResults(e.data.results);
    }
  };

  worker.onerror = () => {
    loadingOverlay.classList.remove('visible');
    loadingOverlay.innerHTML = `
      <span>Python runtime failed to load.</span>
      <button class="btn btn-secondary" onclick="location.reload()" style="margin-left:0.5rem;padding:0.25rem 0.75rem;font-size:0.8rem;">Retry</button>
    `;
    loadingOverlay.classList.add('visible');
  };
}

// --- Run Tests ---
let runTimeout = null;

function runTests() {
  if (!worker || runBtn.disabled) return;

  runBtn.disabled = true;
  runBtn.textContent = 'Running...';
  testResultsEl.innerHTML = '<span style="color: var(--text-muted); font-size: 0.85rem;">Running tests...</span>';

  markAttempted(problem.id);

  const userCode = editor.getCode();

  // Timeout: terminate worker after 30s total
  clearTimeout(runTimeout);
  runTimeout = setTimeout(() => {
    createWorker(); // kills old worker, creates new
    testResultsEl.innerHTML = `
      <div class="test-result fail">
        <span class="test-name">Execution Timed Out</span>
        <div class="test-output">Your code took too long to execute (>30s). Check for infinite loops.</div>
      </div>
    `;
    runBtn.textContent = 'Run Tests';
  }, 30000);

  worker.postMessage({
    type: 'run',
    userCode,
    tests: problem.test_cases
  });
}

function handleResults(results) {
  clearTimeout(runTimeout);
  runBtn.disabled = false;
  runBtn.textContent = 'Run Tests';

  const allPassed = results.every(r => r.passed);

  testResultsEl.innerHTML = results.map(r => `
    <div class="test-result ${r.passed ? 'pass' : 'fail'}">
      <span class="test-name">${r.passed ? '\u2713' : '\u2717'} ${r.name}</span>
      <span class="test-time">${r.timeMs}ms</span>
      ${r.error ? `<div class="test-output">${escapeHtml(r.error)}</div>` : ''}
      ${r.output ? `<div class="test-output">${escapeHtml(r.output)}</div>` : ''}
    </div>
  `).join('');

  if (allPassed) {
    markSolved(problem.id);
    // Stop timer and record best time
    const elapsed = stopTimer(problem.id);
    if (elapsed) {
      saveBestTime(problem.id, elapsed);
      clearInterval(timerInterval);
      timerBtn.textContent = 'Start Timer';
      timerEl.classList.remove('running');
    }
  }
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// --- Timer ---
function setupTimer() {
  const started = getTimerState(problem.id);
  if (started) {
    // Timer was running from previous visit
    timerEl.classList.add('running');
    timerBtn.textContent = 'Stop Timer';
    startTimerDisplay();
  }
}

function startTimerDisplay() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timerDisplay.textContent = formatTime(getElapsedMs(problem.id));
  }, 1000);
  timerDisplay.textContent = formatTime(getElapsedMs(problem.id));
}

function toggleTimer() {
  const running = getTimerState(problem.id);
  if (running) {
    stopTimer(problem.id);
    clearInterval(timerInterval);
    timerBtn.textContent = 'Start Timer';
    timerEl.classList.remove('running');
  } else {
    startTimer(problem.id);
    timerEl.classList.add('running');
    timerBtn.textContent = 'Stop Timer';
    startTimerDisplay();
  }
}

// --- Navigation ---
function setupNavigation() {
  if (!manifest || manifest.length === 0) return;
  const idx = manifest.findIndex(p => p.id === problem.id);
  if (idx > 0) {
    prevLink.href = `problem.html?id=${manifest[idx - 1].id}`;
  } else {
    prevLink.style.visibility = 'hidden';
  }
  if (idx < manifest.length - 1) {
    nextLink.href = `problem.html?id=${manifest[idx + 1].id}`;
  } else {
    nextLink.style.visibility = 'hidden';
  }
}

// --- Solution ---
function toggleSolution() {
  solutionVisible = !solutionVisible;

  if (solutionVisible) {
    markPeeked(problem.id);
    solutionBtn.textContent = 'Hide Solution';
    solutionPanel.classList.add('visible');
    solutionPanel.innerHTML = `
      <h3>Reference Solution</h3>
      <pre><code>${escapeHtml(problem.solution_code)}</code></pre>
      <h3>Explanation</h3>
      <div>${marked.parse(problem.explanation)}</div>
    `;
  } else {
    solutionBtn.textContent = 'Show Solution';
    solutionPanel.classList.remove('visible');
  }
}

// --- Event Listeners ---
function setupEventListeners() {
  runBtn.addEventListener('click', runTests);
  resetBtn.addEventListener('click', () => {
    editor.setCode(problem.starter_code);
    saveCode(problem.id, problem.starter_code);
  });
  solutionBtn.addEventListener('click', toggleSolution);
  timerBtn.addEventListener('click', toggleTimer);
}

// --- Boot ---
init();
```

- [ ] **Step 2: Verify -- open a sample problem**

Open `http://localhost:8080/problem.html?id=1.1`

Check:
- Problem title, description, constraints, hints all render
- Editor loads with starter code
- Loading overlay appears while Pyodide downloads, then disappears
- Click "Run Tests" -- should see all tests fail (starter code returns None)
- Type a solution, click "Run Tests" -- should see pass/fail results
- Timer start/stop works
- Reset Code restores starter code
- Show Solution displays reference solution and explanation

- [ ] **Step 3: Commit**

```bash
git add problem.js
git commit -m "feat: add problem page controller (editor, worker, tests, timer, solution)"
```

---

## Task 7: Landing Page Logic

**Files:**
- Create: `app.js`

Renders the problem table, stats bar, and handles filters.

- [ ] **Step 1: Create `app.js`**

```javascript
// app.js -- Landing page controller
import { getAllProblemStates, getStats, computeCategoryStats, formatTime } from './state.js';

let manifest = [];
let problemStates = {};
let activeFilters = {
  category: '',
  difficulties: new Set(['Easy', 'Medium', 'Hard']),
  status: '',
  search: ''
};

async function init() {
  try {
    manifest = await fetch('problems/index.json').then(r => r.json());
  } catch (err) {
    document.getElementById('problem-list').innerHTML =
      '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-muted)">Failed to load problems.</td></tr>';
    return;
  }

  problemStates = getAllProblemStates();
  renderStats();
  populateCategoryFilter();
  renderTable();
  setupFilterListeners();
}

// --- Stats Bar ---
function renderStats() {
  const stats = getStats();
  const total = manifest.length;

  document.getElementById('stats-bar').innerHTML = `
    <div class="stat-item">
      <span class="stat-value">${stats.totalSolved}/${total}</span>
      <span class="stat-label">Solved</span>
    </div>
    <div class="stat-item">
      <span class="stat-value">${stats.streak}</span>
      <span class="stat-label">Day Streak</span>
    </div>
    ${renderCategoryRings()}
  `;
}

function renderCategoryRings() {
  const catStats = computeCategoryStats(manifest);
  // Show top 5 categories with most problems
  const sorted = Object.entries(catStats)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 5);

  return sorted.map(([cat, { total, solved }]) => {
    const pct = total > 0 ? (solved / total * 100) : 0;
    const r = 18;
    const circ = 2 * Math.PI * r;
    const offset = circ - (pct / 100 * circ);
    const shortCat = cat.length > 15 ? cat.slice(0, 14) + '...' : cat;
    return `
      <div class="stat-item">
        <svg class="progress-ring" width="44" height="44">
          <circle cx="22" cy="22" r="${r}" fill="none" stroke="var(--border)" stroke-width="3"/>
          <circle cx="22" cy="22" r="${r}" fill="none" stroke="var(--accent)" stroke-width="3"
            stroke-dasharray="${circ}" stroke-dashoffset="${offset}"/>
        </svg>
        <span class="stat-label" title="${cat}">${shortCat}</span>
      </div>
    `;
  }).join('');
}

// --- Category Filter ---
function populateCategoryFilter() {
  const categories = [...new Set(manifest.map(p => p.category))].sort();
  const select = document.getElementById('filter-category');
  for (const cat of categories) {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    select.appendChild(opt);
  }
}

// --- Render Table ---
function renderTable() {
  const filtered = manifest.filter(p => {
    if (activeFilters.category && p.category !== activeFilters.category) return false;
    if (!activeFilters.difficulties.has(p.difficulty)) return false;
    const state = problemStates[p.id];
    const status = state?.status || 'unsolved';
    if (activeFilters.status && status !== activeFilters.status) return false;
    if (activeFilters.search) {
      const q = activeFilters.search.toLowerCase();
      if (!p.title.toLowerCase().includes(q) &&
          !p.id.includes(q) &&
          !p.tags.some(t => t.includes(q))) {
        return false;
      }
    }
    return true;
  });

  const tbody = document.getElementById('problem-list');
  tbody.innerHTML = filtered.map(p => {
    const state = problemStates[p.id] || {};
    const status = state.status || 'unsolved';
    const diffClass = { Easy: 'diff-easy', Medium: 'diff-medium', Hard: 'diff-hard' }[p.difficulty];

    let statusIcon = '';
    if (status === 'solved') statusIcon = '<span class="status-solved">\u2713</span>';
    else if (status === 'attempted') statusIcon = '<span class="status-attempted">\u2012</span>';

    const time = state.bestTimeMs ? formatTime(state.bestTimeMs) : '';

    return `
      <tr onclick="location.href='problem.html?id=${p.id}'">
        <td class="id-col">${p.id}</td>
        <td>${p.title}</td>
        <td class="diff-col ${diffClass}">${p.difficulty}</td>
        <td class="cat-col">${p.category}</td>
        <td class="status-col">${statusIcon}</td>
        <td class="time-col">${time}</td>
      </tr>
    `;
  }).join('');

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-muted)">No problems match your filters.</td></tr>';
  }
}

// --- Filter Listeners ---
function setupFilterListeners() {
  document.getElementById('filter-category').addEventListener('change', (e) => {
    activeFilters.category = e.target.value;
    renderTable();
  });

  document.getElementById('filter-status').addEventListener('change', (e) => {
    activeFilters.status = e.target.value;
    renderTable();
  });

  document.getElementById('filter-search').addEventListener('input', (e) => {
    activeFilters.search = e.target.value;
    renderTable();
  });

  document.getElementById('difficulty-toggles').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-diff]');
    if (!btn) return;
    const diff = btn.dataset.diff;
    btn.classList.toggle('active');
    if (activeFilters.difficulties.has(diff)) {
      activeFilters.difficulties.delete(diff);
    } else {
      activeFilters.difficulties.add(diff);
    }
    renderTable();
  });
}

// --- Boot ---
init();
```

- [ ] **Step 2: Verify -- landing page with real data**

Open `http://localhost:8080/`

Check:
- Stats bar shows 0/253 solved, 0 streak
- Category progress rings appear for top categories
- All 253 problems listed in the table
- Category dropdown populated
- Difficulty toggles filter the table
- Search box filters by title, id, or tag
- Clicking a row navigates to problem.html?id=X
- Problems without full JSON show error page gracefully

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "feat: add landing page with problem table, stats, and filters"
```

---

## Task 8: End-to-End Verification and Deploy

**Files:**
- Possibly modify: any file that needs fixes found during E2E testing
- Create: `.gitignore`
- Create: `.nojekyll` (for GitHub Pages to serve files starting with _)

- [ ] **Step 1: Create `.gitignore` and `.nojekyll`**

`.gitignore`:
```
.DS_Store
node_modules/
```

`.nojekyll`: empty file (tells GitHub Pages not to process with Jekyll)

- [ ] **Step 2: Full E2E walkthrough**

Serve locally and test the complete flow:

1. Open landing page -- see 253 problems
2. Filter by "Classic ML Algorithms" -- see only those problems
3. Toggle off "Easy" -- Easy problems disappear
4. Click "3.3. Logistic Regression" -- opens problem page
5. See description, constraints, hints
6. Start timer -- timer starts counting
7. Wait for "Run Tests" to become enabled (Pyodide loaded)
8. Click "Run Tests" -- see all tests fail (starter code)
9. Paste the solution code, click "Run Tests" -- all 4 tests pass (green)
10. Check that problem is now marked "solved" on landing page
11. Navigate to 10.1 via "Next" arrow
12. Click "Show Solution" -- solution and explanation render
13. Check that 10.1 is now marked "peeked" in localStorage
14. Go back to landing page -- stats show 1/253 solved

- [ ] **Step 3: Fix any issues found during E2E testing**

Address any bugs, styling issues, or broken interactions. Common issues:
- esm.sh import URLs may need version pinning adjustments
- CodeMirror height may need CSS tweaks
- Pyodide version URL may need updating to latest stable

- [ ] **Step 4: Commit fixes**

```bash
git add -A
git commit -m "fix: address E2E testing issues"
```

- [ ] **Step 5: Push to GitHub and enable Pages**

```bash
git add .gitignore .nojekyll
git commit -m "chore: add .gitignore and .nojekyll for GitHub Pages"
git branch -M main
git push -u origin main
```

Then enable GitHub Pages in repo settings (Settings > Pages > Source: "Deploy from a branch" > main > / (root)).

- [ ] **Step 6: Verify live site**

Open `https://henryvu27.github.io/MLInterviewPractice/` and run the same E2E checks from Step 2.

- [ ] **Step 7: Final commit with any live-site fixes**

If the live URL needs path adjustments (all links should be relative, not absolute), fix and push.

---

## Summary

| Task | Description | Key Files |
|------|-------------|-----------|
| 1 | HTML shells + CSS | index.html, problem.html, style.css |
| 2 | State manager | state.js |
| 3 | Pyodide Web Worker | pyodide-worker.js |
| 4 | CodeMirror editor module | editor.js |
| 5 | Sample problems + manifest | problems/*.json |
| 6 | Problem page controller | problem.js |
| 7 | Landing page controller | app.js |
| 8 | E2E testing + deploy | .gitignore, .nojekyll, fixes |
