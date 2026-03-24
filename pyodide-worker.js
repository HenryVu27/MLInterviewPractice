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

self.onmessage = async function (event) {
  const { type, userCode, tests } = event.data;

  if (type !== 'run') return;

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
