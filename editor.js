// editor.js -- CodeMirror 6 editor setup
// All CM6 packages from esm.sh CDN (pinned to v6.x)

import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, dropCursor, highlightActiveLine } from 'https://esm.sh/@codemirror/view@6';
import { EditorState } from 'https://esm.sh/@codemirror/state@6';
import { python } from 'https://esm.sh/@codemirror/lang-python@6';
import { oneDark } from 'https://esm.sh/@codemirror/theme-one-dark@6';
import { defaultKeymap, history, historyKeymap, indentWithTab } from 'https://esm.sh/@codemirror/commands@6';
import { syntaxHighlighting, defaultHighlightStyle, indentOnInput, indentUnit, bracketMatching, foldGutter, foldKeymap } from 'https://esm.sh/@codemirror/language@6';
import { closeBrackets, closeBracketsKeymap } from 'https://esm.sh/@codemirror/autocomplete@6';
import { searchKeymap, highlightSelectionMatches } from 'https://esm.sh/@codemirror/search@6';

// Construct basicSetup equivalent from individual extensions
const basicSetup = [
  lineNumbers(),
  highlightActiveLineGutter(),
  highlightSpecialChars(),
  history(),
  foldGutter(),
  drawSelection(),
  dropCursor(),
  EditorState.allowMultipleSelections.of(true),
  indentOnInput(),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  bracketMatching(),
  closeBrackets(),
  highlightActiveLine(),
  highlightSelectionMatches(),
  keymap.of([
    ...closeBracketsKeymap,
    ...defaultKeymap,
    ...searchKeymap,
    ...historyKeymap,
    ...foldKeymap,
    indentWithTab
  ])
];

/**
 * Create a CodeMirror 6 editor instance.
 * @param {HTMLElement} parent - DOM element to mount the editor in
 * @param {string} initialCode - Starting code content
 * @param {function} onChange - Called with new code string on every change
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
        indentUnit.of("    "),
        EditorState.tabSize.of(4),
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
