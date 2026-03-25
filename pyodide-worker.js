let pyodide = null;

async function initPyodide() {
  try {
    postMessage({ type: 'loading', progress: 'Downloading Python runtime...' });
    importScripts('https://cdn.jsdelivr.net/pyodide/v0.27.5/full/pyodide.js');
    postMessage({ type: 'loading', progress: 'Initializing Python...' });
    pyodide = await loadPyodide();
    postMessage({ type: 'loading', progress: 'Loading numpy...' });
    await pyodide.loadPackage('numpy');
    postMessage({ type: 'ready' });
  } catch (err) {
    postMessage({ type: 'error', message: err.message || String(err) });
  }
}

const initPromise = initPyodide();

self.onmessage = async function (event) {
  const { type } = event.data;

  // --- REPL: execute a single command in the current namespace ---
  if (type === 'exec') {
    await initPromise;
    const { code } = event.data;

    // Redirect stdout
    pyodide.runPython(`
import sys, io
_stdout_capture = io.StringIO()
sys.stdout = _stdout_capture
`);

    let output = '';
    let error = '';
    let result = null;

    try {
      // Try eval first (expression that returns a value)
      try {
        result = pyodide.runPython(code);
        if (result !== undefined && result !== null && String(result) !== 'None') {
          result = String(result);
        } else {
          result = null;
        }
      } catch (evalErr) {
        // If eval fails, try exec (statement)
        result = null;
        pyodide.runPython(code);
      }
    } catch (err) {
      error = err.message || String(err);
    } finally {
      output = pyodide.runPython(`
sys.stdout = sys.__stdout__
_stdout_capture.getvalue()
`);
    }

    postMessage({ type: 'exec-result', output, error, result });
    return;
  }

  // --- Run user code (no tests, just execute and show output) ---
  if (type === 'run-code') {
    await initPromise;
    const { userCode } = event.data;

    // Reset namespace
    pyodide.runPython(`
for _name in list(dir()):
    if not _name.startswith('_'):
        try:
            del globals()[_name]
        except:
            pass
import numpy as np
`);

    // Redirect stdout
    pyodide.runPython(`
import sys, io
_stdout_capture = io.StringIO()
sys.stdout = _stdout_capture
`);

    let output = '';
    let error = '';

    try {
      pyodide.runPython(userCode);
    } catch (err) {
      error = err.message || String(err);
    } finally {
      output = pyodide.runPython(`
sys.stdout = sys.__stdout__
_stdout_capture.getvalue()
`);
    }

    postMessage({ type: 'run-code-result', output, error });
    return;
  }

  if (type !== 'run') return;

  const { userCode, tests } = event.data;

  await initPromise;

  // Reset Python namespace to avoid stale definitions from previous runs
  pyodide.runPython(`
for _name in list(dir()):
    if not _name.startswith('_'):
        try:
            del globals()[_name]
        except:
            pass
import numpy as np
`);

  // Execute user code; if it fails, all tests fail with the same error
  let userCodeError = null;
  try {
    pyodide.runPython(userCode);
  } catch (err) {
    userCodeError = err.message || String(err);
  }

  const results = [];

  for (const test of tests) {
    const start = performance.now();

    if (userCodeError !== null) {
      results.push({
        name: test.name,
        passed: false,
        output: '',
        error: userCodeError,
        timeMs: 0,
      });
      continue;
    }

    // Redirect stdout to StringIO before running the test
    pyodide.runPython(`
import sys
import io
_stdout_capture = io.StringIO()
sys.stdout = _stdout_capture
`);

    let passed = false;
    let errorMsg = '';
    let output = '';

    try {
      pyodide.runPython(test.code);
      passed = true;
    } catch (err) {
      passed = false;
      errorMsg = err.message || String(err);
    } finally {
      // Restore stdout and collect output
      output = pyodide.runPython(`
sys.stdout = sys.__stdout__
_stdout_capture.getvalue()
`);
    }

    const timeMs = performance.now() - start;

    results.push({
      name: test.name,
      passed,
      output,
      error: errorMsg,
      timeMs,
    });
  }

  postMessage({ type: 'result', results });
};
