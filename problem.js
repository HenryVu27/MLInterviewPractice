import { createEditor } from './editor.js';
import {
  getProblemState, saveCode, getSavedCode, markAttempted, markSolved, markPeeked,
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

  // Find matching test code from the problem
  const testCases = window._currentProblem ? window._currentProblem.test_cases : [];

  let passCount = 0;

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.passed) passCount++;

    const testCode = testCases[i] ? testCases[i].code : '';

    const item = document.createElement('div');
    item.className = `test-result ${result.passed ? 'pass' : 'fail'}`;

    // Header row (clickable to expand)
    const headerRow = document.createElement('div');
    headerRow.className = 'test-result-header';
    headerRow.innerHTML = `
      <span class="test-result-icon">${result.passed ? '\u2713' : '\u2717'}</span>
      <span class="test-result-name">${escapeHtml(result.name)}</span>
      <span class="test-time">${result.timeMs.toFixed(1)}ms</span>
      <span class="test-expand-arrow">\u25B6</span>
    `;
    item.appendChild(headerRow);

    // Expandable details
    const details = document.createElement('div');
    details.className = 'test-result-details';

    // Test code
    if (testCode) {
      details.innerHTML += `
        <div class="test-detail-section">
          <span class="test-detail-label">Test Code</span>
          <pre class="test-detail-code">${escapeHtml(testCode)}</pre>
        </div>
      `;
    }

    // Stdout output
    if (result.output && result.output.trim()) {
      details.innerHTML += `
        <div class="test-detail-section">
          <span class="test-detail-label">Output</span>
          <pre class="test-detail-code">${escapeHtml(result.output)}</pre>
        </div>
      `;
    }

    // Error (for failed tests)
    if (!result.passed && result.error) {
      details.innerHTML += `
        <div class="test-detail-section">
          <span class="test-detail-label">Error</span>
          <pre class="test-detail-code test-detail-error">${escapeHtml(result.error)}</pre>
        </div>
      `;
    }

    // Status summary
    details.innerHTML += `
      <div class="test-detail-section">
        <span class="test-detail-label">Result</span>
        <span class="test-detail-status ${result.passed ? 'pass' : 'fail'}">${result.passed ? 'PASSED' : 'FAILED'}</span>
      </div>
    `;

    item.appendChild(details);

    // Toggle expand on click
    headerRow.addEventListener('click', () => {
      item.classList.toggle('expanded');
    });

    // Auto-expand failed tests
    if (!result.passed) {
      item.classList.add('expanded');
    }

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
let currentFramework = 'numpy';
let workerReady = false;

function createWorker() {
  worker = new Worker('pyodide-worker.js');

  worker.addEventListener('message', (event) => {
    const { type, progress, results } = event.data;

    if (type === 'loading') {
      showOverlay(progress || 'Loading...');
    } else if (type === 'ready') {
      hideOverlay();
      workerReady = true;
      if (currentFramework !== 'pytorch') {
        document.getElementById('btn-run').disabled = false;
      }
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
// Study assistant panel
// ---------------------------------------------------------------------------

function setupStudyPanel(problem) {
  const panel = document.getElementById('study-panel');
  const btnStudy = document.getElementById('btn-study');
  const btnClose = document.getElementById('btn-close-study');

  // Populate explanation
  const explanationEl = document.getElementById('study-explanation');
  if (problem.explanation) {
    explanationEl.innerHTML = marked.parse(problem.explanation);
  } else {
    explanationEl.innerHTML = '<p style="color:var(--text-muted);font-style:italic;">No explanation available for this problem yet.</p>';
  }

  // Populate hints (progressive reveal)
  const hintsSection = document.getElementById('study-hints-section');
  const hintsEl = document.getElementById('study-hints');
  hintsEl.innerHTML = '';

  if (Array.isArray(problem.hints) && problem.hints.length > 0) {
    problem.hints.forEach((hint, idx) => {
      const item = document.createElement('div');
      item.className = 'study-hint-item';

      const btn = document.createElement('button');
      btn.className = 'study-hint-btn';
      btn.textContent = `Reveal Hint ${idx + 1}`;

      const text = document.createElement('div');
      text.className = 'study-hint-text';
      text.textContent = hint;

      btn.addEventListener('click', () => {
        const isVisible = text.classList.contains('visible');
        text.classList.toggle('visible');
        btn.classList.toggle('revealed');
        btn.textContent = isVisible ? `Reveal Hint ${idx + 1}` : `Hint ${idx + 1}`;
      });

      item.appendChild(btn);
      item.appendChild(text);
      hintsEl.appendChild(item);
    });
    hintsSection.style.display = '';
  } else {
    hintsSection.style.display = 'none';
  }

  // Populate solution walkthrough (called on init and framework switch)
  const solutionEl = document.getElementById('study-solution');
  function updateStudySolution() {
    const solCode = currentFramework === 'pytorch'
      ? (problem.pytorch_solution_code || problem.solution_code)
      : problem.solution_code;
    if (solCode) {
      solutionEl.innerHTML = `
        <p class="study-solution-note">Study the solution line by line. Try to understand each step before looking at the next problem.</p>
        <pre class="study-solution-code">${escapeHtml(solCode)}</pre>
      `;
    } else {
      solutionEl.innerHTML = '<p style="color:var(--text-muted);font-style:italic;">No solution available.</p>';
    }
  }
  updateStudySolution();
  // Expose for framework switching (called from init scope)
  problem.updateStudySolution = updateStudySolution;

  // Toggle panel
  function showStudy() {
    panel.classList.add('visible');
    btnStudy.classList.add('active');
  }

  function hideStudy() {
    panel.classList.remove('visible');
    btnStudy.classList.remove('active');
  }

  btnStudy.addEventListener('click', () => {
    if (panel.classList.contains('visible')) {
      hideStudy();
    } else {
      showStudy();
    }
  });

  btnClose.addEventListener('click', hideStudy);
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
    const solCode = currentFramework === 'pytorch'
      ? (problem.pytorch_solution_code || problem.solution_code || '')
      : (problem.solution_code || '');
    solutionCode.textContent = solCode;
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

  // Store problem for test result rendering
  window._currentProblem = problem;

  // Render problem description
  renderProblem(problem, manifest);

  // Set up prev/next navigation
  setupNavigation(problemId, manifest);

  // Set up editor
  function getCodeForFramework(fw) {
    const saved = getSavedCode(problemId, fw);
    if (saved) return saved;
    return fw === 'pytorch'
      ? (problem.pytorch_starter_code || '')
      : (problem.starter_code || '');
  }

  const initialCode = getCodeForFramework('numpy');
  const editorContainer = document.getElementById('editor-container');
  const editor = createEditor(editorContainer, initialCode, debounce((code) => {
    saveCode(problemId, code, currentFramework);
  }, 1000));

  // Framework tabs (NumPy / PyTorch)
  const frameworkTabs = document.querySelectorAll('.framework-tab');
  const pytorchBanner = document.getElementById('pytorch-banner');
  const hasPytorch = !!problem.pytorch_starter_code;
  document.getElementById('framework-tabs').style.display = hasPytorch ? '' : 'none';

  function switchFramework(fw) {
    if (fw === currentFramework) return;

    // Save current code to outgoing framework
    saveCode(problemId, editor.getCode(), currentFramework);

    currentFramework = fw;

    // Load code for new framework
    editor.setCode(getCodeForFramework(fw));

    // Update tab active states
    frameworkTabs.forEach(t => t.classList.toggle('active', t.dataset.framework === fw));

    // Toggle PyTorch banner
    pytorchBanner.style.display = fw === 'pytorch' ? '' : 'none';

    // Disable/enable run buttons
    const isPytorch = fw === 'pytorch';
    document.getElementById('btn-run').disabled = isPytorch || !workerReady;
    document.getElementById('btn-run-code').disabled = isPytorch || !workerReady;

    // Update solution displays for new framework
    if (problem.updateStudySolution) problem.updateStudySolution();
  }

  frameworkTabs.forEach(tab => {
    tab.addEventListener('click', () => switchFramework(tab.dataset.framework));
  });

  // Copy-to-clipboard for PyTorch code
  document.getElementById('btn-copy-pytorch').addEventListener('click', () => {
    navigator.clipboard.writeText(editor.getCode());
    const btn = document.getElementById('btn-copy-pytorch');
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = 'Copy Code'; }, 2000);
  });

  // Reset Code button
  document.getElementById('btn-reset').addEventListener('click', () => {
    if (confirm('Reset to starter code? Your current code will be lost.')) {
      const starterCode = currentFramework === 'pytorch'
        ? (problem.pytorch_starter_code || '')
        : (problem.starter_code || '');
      editor.setCode(starterCode);
      saveCode(problemId, starterCode, currentFramework);
    }
  });

  // Set up timer
  setupTimer(problemId);

  // Set up solution panel
  setupSolutionPanel(problem);

  // Set up study assistant panel
  setupStudyPanel(problem);

  // Initialize Pyodide worker
  showOverlay('Initializing Python runtime...');
  createWorker();

  // Run Tests button
  const btnRun = document.getElementById('btn-run');
  btnRun.addEventListener('click', async () => {
    btnRun.disabled = true;
    const originalText = btnRun.textContent;
    btnRun.textContent = 'Running...';

    // Switch to tests tab
    switchTab('tests');

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

  // -------------------------------------------------------------------------
  // Output tabs
  // -------------------------------------------------------------------------
  const tabs = document.querySelectorAll('.output-tab');
  const panels = document.querySelectorAll('.output-panel');

  function switchTab(tabName) {
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
    panels.forEach(p => p.classList.toggle('active', p.id === `panel-${tabName}`));
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // -------------------------------------------------------------------------
  // Console: Run Code button + REPL input
  // -------------------------------------------------------------------------
  const btnRunCode = document.getElementById('btn-run-code');
  const consoleOutput = document.getElementById('console-output');
  const consoleInput = document.getElementById('console-input');
  let consoleCommandHistory = [];
  let historyIdx = -1;

  function appendConsoleLine(text, cls) {
    const line = document.createElement('div');
    line.className = `console-line ${cls}`;
    line.textContent = text;
    consoleOutput.appendChild(line);
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
  }

  function appendConsoleSeparator() {
    const sep = document.createElement('div');
    sep.className = 'console-line console-separator';
    consoleOutput.appendChild(sep);
  }

  // "Run Code" button -- executes editor code and shows output in console
  btnRunCode.addEventListener('click', async () => {
    switchTab('console');
    btnRunCode.disabled = true;
    btnRunCode.textContent = 'Running...';

    appendConsoleSeparator();
    appendConsoleLine('Running your code...', 'console-info');

    const userCode = editor.getCode();

    const result = await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        worker.terminate();
        worker = createWorker();
        resolve({ output: '', error: 'Timed out after 30s.' });
      }, 30000);

      const handler = (e) => {
        if (e.data.type === 'run-code-result') {
          clearTimeout(timeout);
          worker.removeEventListener('message', handler);
          resolve(e.data);
        }
      };
      worker.addEventListener('message', handler);
      worker.postMessage({ type: 'run-code', userCode });
    });

    if (result.output) {
      appendConsoleLine(result.output, 'console-output-text');
    }
    if (result.error) {
      appendConsoleLine(result.error, 'console-error');
    }
    if (!result.output && !result.error) {
      appendConsoleLine('Code executed (no output). Add print() statements to see results.', 'console-info');
    }

    btnRunCode.textContent = 'Run Code';
    btnRunCode.disabled = false;
    consoleInput.disabled = false;
    consoleInput.placeholder = 'Type Python here... (Enter to run)';
  });

  // REPL input -- execute single commands in the same Pyodide context
  consoleInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter' && consoleInput.value.trim()) {
      const code = consoleInput.value.trim();
      consoleCommandHistory.push(code);
      historyIdx = consoleCommandHistory.length;

      appendConsoleLine(`>>> ${code}`, 'console-input-echo');
      consoleInput.value = '';
      consoleInput.disabled = true;

      const result = await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          worker.terminate();
          worker = createWorker();
          resolve({ output: '', error: 'Timed out.', result: null });
        }, 10000);

        const handler = (e) => {
          if (e.data.type === 'exec-result') {
            clearTimeout(timeout);
            worker.removeEventListener('message', handler);
            resolve(e.data);
          }
        };
        worker.addEventListener('message', handler);
        worker.postMessage({ type: 'exec', code });
      });

      if (result.result) {
        appendConsoleLine(result.result, 'console-output-text');
      }
      if (result.output) {
        appendConsoleLine(result.output, 'console-output-text');
      }
      if (result.error) {
        appendConsoleLine(result.error, 'console-error');
      }

      consoleInput.disabled = false;
      consoleInput.focus();
    }

    // Up/down arrow for command history
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIdx > 0) {
        historyIdx--;
        consoleInput.value = consoleCommandHistory[historyIdx];
      }
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx < consoleCommandHistory.length - 1) {
        historyIdx++;
        consoleInput.value = consoleCommandHistory[historyIdx];
      } else {
        historyIdx = consoleCommandHistory.length;
        consoleInput.value = '';
      }
    }
  });
}

init();
