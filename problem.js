import { createEditor } from './editor.js';
import {
  getProblemState, saveCode, markAttempted, markSolved, markPeeked,
  saveBestTime, getTimerState, startTimer, stopTimer, getElapsedMs, formatTime
} from './state.js';
import { marked } from 'https://esm.sh/marked@15';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function debounce(fn, delay) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function showError(message) {
  document.body.innerHTML = `
    <div style="padding:2rem;font-family:sans-serif;">
      <h2>Error</h2>
      <p>${escapeHtml(message)}</p>
      <a href="index.html">&larr; Back to problem list</a>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Loading overlay
// ---------------------------------------------------------------------------

function showOverlay(text) {
  const overlay = document.getElementById('loading-overlay');
  const loadingText = document.getElementById('loading-text');
  loadingText.textContent = text;
  overlay.classList.add('visible');
}

function hideOverlay() {
  document.getElementById('loading-overlay').classList.remove('visible');
}

function showOverlayError(message) {
  const overlay = document.getElementById('loading-overlay');
  const loadingText = document.getElementById('loading-text');
  loadingText.innerHTML =
    `${escapeHtml(message)} <button id="overlay-retry" style="margin-left:1rem;">Retry</button>`;
  overlay.classList.add('visible');
  document.getElementById('overlay-retry').addEventListener('click', () => {
    location.reload();
  });
}

// ---------------------------------------------------------------------------
// Problem rendering
// ---------------------------------------------------------------------------

function renderProblem(problem, manifest) {
  // Title
  document.getElementById('problem-title').textContent = `${problem.id}. ${problem.title}`;
  document.title = `${problem.id}. ${problem.title} - ML Interview Practice`;

  // Meta: difficulty badge + tags
  const meta = document.getElementById('problem-meta');
  const diffClass = `diff-${problem.difficulty.toLowerCase()}`;
  let metaHtml = `<span class="difficulty-badge ${diffClass}">${escapeHtml(problem.difficulty)}</span>`;
  if (Array.isArray(problem.tags)) {
    for (const tag of problem.tags) {
      metaHtml += `<span class="tag">${escapeHtml(tag)}</span>`;
    }
  }
  meta.innerHTML = metaHtml;

  // Description
  document.getElementById('problem-description').innerHTML = marked.parse(problem.description || '');

  // Constraints
  const constraintsList = document.getElementById('constraints-list');
  constraintsList.innerHTML = '';
  if (Array.isArray(problem.constraints)) {
    for (const c of problem.constraints) {
      const li = document.createElement('li');
      li.textContent = c;
      constraintsList.appendChild(li);
    }
  }

  // Hints
  const hintsList = document.getElementById('hints-list');
  hintsList.innerHTML = '';
  if (Array.isArray(problem.hints) && problem.hints.length > 0) {
    problem.hints.forEach((hint, idx) => {
      const btn = document.createElement('button');
      btn.className = 'hint-toggle';
      btn.textContent = `Hint ${idx + 1}`;

      const content = document.createElement('div');
      content.className = 'hint-content';
      content.textContent = hint;
      content.style.display = 'none';

      btn.addEventListener('click', () => {
        const visible = content.style.display !== 'none';
        content.style.display = visible ? 'none' : 'block';
      });

      hintsList.appendChild(btn);
      hintsList.appendChild(content);
    });
    document.getElementById('hints-section').style.display = '';
  } else {
    document.getElementById('hints-section').style.display = 'none';
  }

  // Related problems
  const relatedList = document.getElementById('related-list');
  relatedList.innerHTML = '';
  if (Array.isArray(problem.related_problems) && problem.related_problems.length > 0) {
    const manifestMap = new Map((manifest || []).map(p => [p.id, p]));
    for (const relId of problem.related_problems) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = `problem.html?id=${encodeURIComponent(relId)}`;
      const relProblem = manifestMap.get(relId);
      a.textContent = relProblem ? `${relId}. ${relProblem.title}` : relId;
      li.appendChild(a);
      relatedList.appendChild(li);
    }
    document.getElementById('related-section').style.display = '';
  } else {
    document.getElementById('related-section').style.display = 'none';
  }
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

function setupNavigation(problemId, manifest) {
  if (!manifest || manifest.length === 0) return;

  const idx = manifest.findIndex(p => p.id === problemId);
  const prevLink = document.getElementById('nav-prev');
  const nextLink = document.getElementById('nav-next');

  if (idx <= 0) {
    prevLink.style.visibility = 'hidden';
  } else {
    prevLink.href = `problem.html?id=${encodeURIComponent(manifest[idx - 1].id)}`;
    prevLink.style.visibility = '';
  }

  if (idx === -1 || idx >= manifest.length - 1) {
    nextLink.style.visibility = 'hidden';
  } else {
    nextLink.href = `problem.html?id=${encodeURIComponent(manifest[idx + 1].id)}`;
    nextLink.style.visibility = '';
  }
}

// ---------------------------------------------------------------------------
// Timer
// ---------------------------------------------------------------------------

let timerInterval = null;

function updateTimerDisplay(problemId) {
  const elapsed = getElapsedMs(problemId);
  document.getElementById('timer-display').textContent = formatTime(elapsed);
}

function startTimerUI(problemId) {
  startTimer(problemId);
  document.getElementById('timer-btn').textContent = 'Stop';
  timerInterval = setInterval(() => updateTimerDisplay(problemId), 1000);
  updateTimerDisplay(problemId);
}

function stopTimerUI(problemId) {
  const elapsed = stopTimer(problemId);
  clearInterval(timerInterval);
  timerInterval = null;
  document.getElementById('timer-btn').textContent = 'Start';
  if (elapsed !== null) {
    document.getElementById('timer-display').textContent = formatTime(elapsed);
  }
  return elapsed;
}

function setupTimer(problemId) {
  const timerBtn = document.getElementById('timer-btn');

  // Restore running timer
  const timerState = getTimerState(problemId);
  if (timerState !== null) {
    // Timer was running
    document.getElementById('timer-btn').textContent = 'Stop';
    timerInterval = setInterval(() => updateTimerDisplay(problemId), 1000);
    updateTimerDisplay(problemId);
  }

  timerBtn.addEventListener('click', () => {
    const running = timerInterval !== null;
    if (running) {
      stopTimerUI(problemId);
    } else {
      startTimerUI(problemId);
    }
  });
}

// ---------------------------------------------------------------------------
// Test results rendering
// ---------------------------------------------------------------------------

function renderResults(results, problemId) {
  const container = document.getElementById('test-results');
  const summary = document.getElementById('test-summary');

  // Remove previous result items (keep header row)
  const header = container.querySelector('.test-results-header');
  container.innerHTML = '';
  if (header) container.appendChild(header);

  let passCount = 0;

  for (const result of results) {
    if (result.passed) passCount++;

    const item = document.createElement('div');
    item.className = `test-result ${result.passed ? 'pass' : 'fail'}`;

    const nameRow = document.createElement('div');
    nameRow.className = 'test-result-name';
    nameRow.textContent = `${result.passed ? 'PASS' : 'FAIL'} — ${result.name}`;
    item.appendChild(nameRow);

    if (result.output && result.output.trim()) {
      const outputEl = document.createElement('pre');
      outputEl.className = 'test-output';
      outputEl.textContent = result.output;
      item.appendChild(outputEl);
    }

    if (!result.passed && result.error) {
      const errorEl = document.createElement('pre');
      errorEl.className = 'test-error';
      errorEl.textContent = result.error;
      item.appendChild(errorEl);
    }

    const timeEl = document.createElement('span');
    timeEl.className = 'test-time';
    timeEl.textContent = `${result.timeMs.toFixed(1)}ms`;
    item.appendChild(timeEl);

    container.appendChild(item);
  }

  const total = results.length;
  if (passCount === total) {
    summary.textContent = 'All passed!';
  } else {
    summary.textContent = `${passCount}/${total} passed`;
  }

  return passCount === total;
}

// ---------------------------------------------------------------------------
// Worker management
// ---------------------------------------------------------------------------

let worker = null;
let runTimeout = null;
let runResolve = null;

function createWorker() {
  worker = new Worker('pyodide-worker.js');

  worker.addEventListener('message', (event) => {
    const { type, progress, results } = event.data;

    if (type === 'loading') {
      showOverlay(progress || 'Loading...');
    } else if (type === 'ready') {
      hideOverlay();
      document.getElementById('btn-run').disabled = false;
    } else if (type === 'error') {
      showOverlayError(`Python runtime failed: ${event.data.message || 'Unknown error'}`);
    } else if (type === 'result') {
      if (runTimeout !== null) {
        clearTimeout(runTimeout);
        runTimeout = null;
      }
      if (runResolve) {
        runResolve(results);
        runResolve = null;
      }
    }
  });

  worker.addEventListener('error', (err) => {
    if (runTimeout !== null) {
      clearTimeout(runTimeout);
      runTimeout = null;
    }
    if (runResolve) {
      runResolve(null);
      runResolve = null;
    }
    showOverlayError(`Worker error: ${err.message || 'Unknown error'}`);
  });

  return worker;
}

function runInWorker(userCode, tests) {
  return new Promise((resolve) => {
    runResolve = resolve;

    runTimeout = setTimeout(() => {
      runResolve = null;
      worker.terminate();
      worker = createWorker();
      showOverlayError('Timed out after 30s. Worker restarted.');
      resolve(null);
    }, 30000);

    worker.postMessage({ type: 'run', userCode, tests });
  });
}

// ---------------------------------------------------------------------------
// Solution panel
// ---------------------------------------------------------------------------

function setupSolutionPanel(problem) {
  const panel = document.getElementById('solution-panel');
  const btnSolution = document.getElementById('btn-solution');
  const btnClose = document.getElementById('btn-close-solution');
  const solutionCode = document.getElementById('solution-code');

  function showSolution() {
    solutionCode.textContent = problem.solution_code || '';
    panel.classList.add('visible');
    btnSolution.textContent = 'Hide Solution';
    markPeeked(problem.id);
  }

  function hideSolution() {
    panel.classList.remove('visible');
    btnSolution.textContent = 'Show Solution';
  }

  btnSolution.addEventListener('click', () => {
    if (panel.classList.contains('visible')) {
      hideSolution();
    } else {
      showSolution();
    }
  });

  btnClose.addEventListener('click', hideSolution);
}

// ---------------------------------------------------------------------------
// Main init
// ---------------------------------------------------------------------------

async function init() {
  const params = new URLSearchParams(location.search);
  const problemId = params.get('id');

  if (!problemId) {
    showError('No problem ID specified. Use ?id=1.1 in the URL.');
    return;
  }

  // Fetch manifest (for nav + related titles)
  let manifest = [];
  try {
    const manifestRes = await fetch('problems/index.json');
    if (manifestRes.ok) {
      manifest = await manifestRes.json();
    }
  } catch {
    // Non-fatal; navigation and related titles will degrade gracefully
  }

  // Fetch problem data
  let problem;
  try {
    const res = await fetch(`problems/${encodeURIComponent(problemId)}.json`);
    if (!res.ok) {
      if (res.status === 404) {
        showError(`Problem "${escapeHtml(problemId)}" not found.`);
      } else {
        showError(`Failed to load problem (HTTP ${res.status}).`);
      }
      return;
    }
    problem = await res.json();
  } catch (err) {
    showError(`Failed to fetch problem: ${err.message}`);
    return;
  }

  // Render problem description
  renderProblem(problem, manifest);

  // Set up prev/next navigation
  setupNavigation(problemId, manifest);

  // Set up editor
  const state = getProblemState(problemId);
  const initialCode = state.code || problem.starter_code || '';
  const editorContainer = document.getElementById('editor-container');
  const editor = createEditor(editorContainer, initialCode, debounce((code) => {
    saveCode(problemId, code);
  }, 1000));

  // Reset Code button
  document.getElementById('btn-reset').addEventListener('click', () => {
    if (confirm('Reset to starter code? Your current code will be lost.')) {
      editor.setCode(problem.starter_code || '');
      saveCode(problemId, problem.starter_code || '');
    }
  });

  // Set up timer
  setupTimer(problemId);

  // Set up solution panel
  setupSolutionPanel(problem);

  // Initialize Pyodide worker
  showOverlay('Initializing Python runtime...');
  createWorker();

  // Run Tests button
  const btnRun = document.getElementById('btn-run');
  btnRun.addEventListener('click', async () => {
    btnRun.disabled = true;
    const originalText = btnRun.textContent;
    btnRun.textContent = 'Running...';

    markAttempted(problemId);

    const userCode = editor.getCode();
    const results = await runInWorker(userCode, problem.test_cases || []);

    btnRun.textContent = originalText;
    btnRun.disabled = false;

    if (results === null) {
      // timeout or worker error — already handled in runInWorker
      return;
    }

    const allPassed = renderResults(results, problemId);

    if (allPassed) {
      markSolved(problemId);
      const elapsed = getElapsedMs(problemId);
      if (elapsed !== null) {
        saveBestTime(problemId, elapsed);
      }
      if (timerInterval !== null) {
        stopTimerUI(problemId);
      }
    }
  });
}

init();
