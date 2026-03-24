import { basicSetup } from 'https://esm.sh/codemirror@6';
import { EditorView, keymap } from 'https://esm.sh/@codemirror/view@6';
import { EditorState } from 'https://esm.sh/@codemirror/state@6';
import { python } from 'https://esm.sh/@codemirror/lang-python@6';
import { oneDark } from 'https://esm.sh/@codemirror/theme-one-dark@6';
import { indentWithTab } from 'https://esm.sh/@codemirror/commands@6';

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
