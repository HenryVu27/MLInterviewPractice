# ML Interview Practice -- Phase 1: Platform Engine

**Date:** 2026-03-23
**Phase:** 1 of 3 (Platform scaffold, Pyodide integration, problem runner, UI)

## Goal

Build the complete platform engine: a static site that can load problem JSON files, present them in a code editor, execute Python code in-browser via Pyodide, run test cases, and display results. After Phase 1, adding new problems is just adding JSON files.

## Architecture

```
MLInterviewPractice/
  index.html          -- landing page: stats dashboard + filterable problem list
  problem.html        -- problem page: editor + tests + solution
  style.css           -- global styles (dark-mode-first, responsive, no CSS frameworks)
  app.js              -- main app logic: state management, rendering, routing
  pyodide-runner.js   -- Pyodide integration: load runtime, execute user code, run tests
  problems/           -- one JSON file per problem (Phase 2+)
```

Single-page-like navigation using query params (e.g., `problem.html?id=3.3`). No build step, no bundler, vanilla ES modules.

## Tech Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Editor | CodeMirror 6 | ~150KB vs Monaco's ~2MB. Lean matters when Pyodide is ~15MB. |
| Python runtime | Pyodide (latest stable) | In-browser CPython via WebAssembly. Includes numpy. |
| Styling | Hand-written CSS | Dark-mode-first. No frameworks. CSS custom properties for theming. |
| State | localStorage | Persist solved/attempted status, user code, best times, stats. |
| Code execution | Web Worker | Run Pyodide in a worker to avoid blocking the UI thread. |
| Module system | ES modules (`type="module"`) | Native browser modules, no bundler needed. |
| CDN deps | CodeMirror 6 via esm.sh, Pyodide from official CDN | esm.sh wraps npm packages as ES modules -- no bundler needed. Pyodide loaded via `importScripts()` in worker. |
| Markdown | marked.js via esm.sh CDN | Lightweight markdown-to-HTML for problem descriptions and explanations. |

## Components

### 1. Pyodide Runner (`pyodide-runner.js`)

Runs in a **classic Web Worker** (not module worker -- better browser support). Uses `importScripts()` to load Pyodide from official CDN (`https://cdn.jsdelivr.net/pyodide/v0.27.x/full/`).

Responsibilities:
- Load Pyodide runtime (with numpy pre-loaded via `pyodide.loadPackage('numpy')`)
- Accept user code + test code strings via `postMessage`
- Execute user code first (defines classes/functions), then run each test case sequentially
- **Test pass/fail: assertion-based.** Each test's `code` string contains `assert` statements. If execution completes without AssertionError, the test passes. Any exception (AssertionError, TypeError, etc.) means failure -- the error message is captured.
- Capture stdout/stderr per test via Pyodide's `sys.stdout` redirection
- Return results per test: `{ name, passed, output, error, timeMs }`

**Timeout strategy:** The main thread sets a timer (10s per test, 30s total) and calls `worker.terminate()` if exceeded, then spawns a fresh worker. Pyodide must reinitialize (~3-5s on cache hit). The UI shows "Execution timed out -- possible infinite loop" for the timed-out test. This is the only reliable way to kill synchronous Pyodide execution.

Communication protocol:
```
Main thread --> Worker: { type: "run", userCode, tests: [{ name, code }] }
Worker --> Main thread: { type: "result", results: [{ name, passed, output, error, timeMs }] }
Worker --> Main thread: { type: "loading", progress: "Downloading Python runtime..." }
Worker --> Main thread: { type: "ready" }
```

**Loading UX:** Pyodide is ~20-25MB on first load (cached by browser after). Worker sends progress messages during init. Main thread shows a loading overlay with spinner and status text. After first load, subsequent page visits start in ~2-3s from cache.

### 2. Code Editor (CodeMirror 6)

- Python syntax highlighting
- Dark theme (One Dark or similar)
- Line numbers
- Basic keybindings (indent, comment toggle)
- Auto-save to localStorage on change (debounced, 1s)
- Restore saved code on page load (fall back to starter_code)

### 3. State Manager (in `app.js`)

localStorage schema:
```json
{
  "ml-practice-problems": {
    "3.3": {
      "status": "solved",       // "unsolved" | "attempted" | "solved"
      "code": "...",            // user's current code
      "bestTimeMs": 45000,      // best solve time in ms
      "peeked": false,          // true if user viewed solution
      "lastAttempted": "2026-03-23T..."
    }
  },
  "ml-practice-stats": {
    "totalSolved": 5,
    "streak": 3,
    "lastSolveDate": "2026-03-23"
  }
}
```

### 4. Landing Page (`index.html`)

- **Header:** "ML Interview Practice" + tagline "253 problems. Pure numpy. No excuses."
- **Stats bar:** X/253 solved, current streak, progress ring per category
- **Filter bar:** Category dropdown, difficulty toggles (Easy/Medium/Hard), status filter (All/Solved/Attempted/Unsolved), text search
- **Problem table:** Columns: #, Title, Difficulty (color-coded green/yellow/red), Category, Status icon, Best Time
- **Responsive:** Table becomes card layout on mobile

Data source: Loads a `problems/index.json` manifest that lists all problems with metadata (avoids fetching 253 individual files for the list).

### 5. Problem Page (`problem.html`)

Split layout:
- **Left panel (40%):** Problem description (rendered markdown), constraints, collapsible hints, related problems links
- **Right panel (60%):** CodeMirror editor, action bar (Run Tests / Reset Code / Show Solution), test results panel
- **Timer:** Top-right. Starts when user clicks "Start Timer." Stops when user clicks "Stop" OR when all tests pass. `bestTimeMs` records fastest all-pass time (only when not peeked). Timer state (`timerStartedAt`) stored in localStorage so it survives page reloads.
- **Navigation:** Prev/next arrows follow manifest order (by id). Back-to-list link.
- **Solution view:** Toggle shows reference code (syntax-highlighted) + explanation (rendered markdown). Marks problem as "peeked" in state.

### 6. Problem Index Manifest (`problems/index.json`)

```json
[
  {
    "id": "3.3",
    "title": "Logistic Regression",
    "difficulty": "Medium",
    "category": "Classic ML Algorithms",
    "tags": ["numpy", "from-scratch", "optimization"]
  },
  ...
]
```

Lightweight -- just enough for the landing page table and filters. Full problem data loaded on-demand when opening a problem.

### 7. Problem JSON Schema (individual files)

Each problem lives at `problems/{id}.json` (e.g., `problems/3.3.json`). Schema:

```json
{
  "id": "3.3",
  "title": "Logistic Regression",
  "difficulty": "Medium",
  "category": "Classic ML Algorithms",
  "tags": ["numpy", "from-scratch", "optimization"],
  "description": "Markdown string with problem statement, inputs/outputs, requirements.",
  "constraints": [
    "Use only numpy -- no sklearn or other ML libraries",
    "Sigmoid must be numerically stable"
  ],
  "starter_code": "import numpy as np\n\nclass LogisticRegression:\n    ...",
  "solution_code": "import numpy as np\n\nclass LogisticRegression:\n    ...",
  "explanation": "Markdown string with detailed explanation of the approach.",
  "test_cases": [
    {
      "name": "Basic binary classification",
      "code": "np.random.seed(42)\nX = ...\nassert acc > 0.85, f'Accuracy too low'"
    }
  ],
  "hints": [
    "The gradient of BCE loss simplifies to (1/N) * X^T @ (predictions - labels)"
  ],
  "related_problems": ["3.1", "3.2", "5.11"]
}
```

**Test case contract:** Each test's `code` is a Python string executed after the user's code. Tests use `assert` statements for validation. No exception = pass. Any exception = fail (message captured and shown).

### 8. Sample Problems (Phase 1 scope)

Phase 1 includes 3 sample problems to validate the engine end-to-end:
- `1.1.json` -- Matrix Multiplication from Scratch (Easy)
- `3.3.json` -- Logistic Regression (Medium)
- `10.1.json` -- Scaled Dot-Product Attention (Medium)

These 3 cover different categories and difficulties, enough to verify the full flow. The `problems/index.json` manifest will contain entries for all 253 problems (metadata only), but only these 3 will have full JSON files.

## Styling

- Dark mode primary (light background option later, not in Phase 1)
- Color palette: dark gray background (#1a1a2e or similar), accent blue for interactive elements, green/yellow/red for difficulty
- Monospace font for code (JetBrains Mono from Google Fonts, fallback to system monospace)
- Clean spacing, no visual clutter
- CSS custom properties for all colors (easy theming later)
- Responsive breakpoints: desktop (>1024px split layout), tablet (stack panels), mobile (single column)

## Markdown Rendering

Problem descriptions and explanations contain markdown with math notation. Use a lightweight markdown renderer:
- **marked.js** for markdown-to-HTML (small, fast, no dependencies)
- **KaTeX** for math rendering (if problems contain LaTeX math -- defer to Phase 2 if not needed for core 10)

## Error Handling

- **Pyodide load failure:** Show clear message with retry button ("Python runtime failed to load. Check your connection and try again.")
- **Infinite loop:** Main thread terminates worker after timeout, respawns fresh worker, shows timeout error for that test
- **Syntax errors:** Captured and displayed in test results panel with traceback
- **Problem fetch failure (404/malformed):** Show "Problem not found" message with link back to problem list. Graceful degradation -- don't crash the page.
- **Network offline:** Pyodide cached by browser after first load. Problem JSON files are small and can be cached by browser. Full service worker deferred to Phase 3.

## What Phase 1 Does NOT Include

- The 253 problem JSON files (Phase 2-3)
- Service worker / offline support
- Light mode toggle
- GitHub authentication or cloud sync
- Analytics
- Math/LaTeX rendering (defer unless needed by core 10 problems)

## Success Criteria

Phase 1 is complete when:
1. Landing page loads and displays problem list from index.json
2. Clicking a problem opens the editor with starter code
3. User can write Python and run tests -- results show pass/fail with output
4. Code auto-saves to localStorage
5. Solution toggle works and marks as "peeked"
6. Timer works
7. Filters (category, difficulty, status) work on the landing page
8. Site deploys to GitHub Pages and works without a server
