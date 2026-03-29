import { useEffect, useRef, useCallback } from 'react';
import { EditorView, keymap, placeholder } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { python } from '@codemirror/lang-python';
import { oneDark } from '@codemirror/theme-one-dark';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { lineNumbers } from '@codemirror/view';

export default function Terminal({
  starterCode = '',
  output,
  submitResult,
  loading,
  onRun,
  onSubmit,
  editorRef,
}) {
  const editorContainerRef = useRef(null);
  const viewRef = useRef(null);

  // Initialize CodeMirror
  useEffect(() => {
    if (!editorContainerRef.current) return;

    const state = EditorState.create({
      doc: starterCode,
      extensions: [
        lineNumbers(),
        history(),
        python(),
        oneDark,
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          {
            key: 'Ctrl-Enter',
            run: () => {
              handleSubmit();
              return true;
            },
          },
        ]),
        placeholder('# Dein Code hier...'),
        EditorView.theme({
          '&': { height: '100%' },
          '.cm-scroller': { overflow: 'auto' },
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: editorContainerRef.current,
    });

    viewRef.current = view;
    if (editorRef) editorRef.current = view;

    return () => view.destroy();
  }, []); // Only once

  // Update content when starterCode changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentDoc = view.state.doc.toString();
    if (currentDoc !== starterCode) {
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: starterCode },
      });
    }
  }, [starterCode]);

  const getCode = useCallback(() => {
    return viewRef.current?.state.doc.toString() || '';
  }, []);

  // Insert text at cursor (for PythonKeybar)
  const insertText = useCallback((text) => {
    const view = viewRef.current;
    if (!view) return;
    const { from } = view.state.selection.main;
    view.dispatch({
      changes: { from, to: from, insert: text },
      selection: { anchor: from + text.length },
    });
    view.focus();
  }, []);

  // Expose insertText via ref
  useEffect(() => {
    if (editorRef) {
      editorRef.current = {
        getCode,
        insertText,
        focus: () => viewRef.current?.focus(),
      };
    }
  }, [editorRef, getCode, insertText]);

  const handleRun = () => onRun?.(getCode());
  const handleSubmit = () => onSubmit?.(getCode());

  return (
    <div className="flex flex-col">
      {/* Editor */}
      <div
        ref={editorContainerRef}
        className="panel overflow-hidden"
        style={{ height: '30vh', minHeight: '120px' }}
      />

      {/* Action buttons */}
      <div className="flex gap-2 px-1 py-2">
        <button
          onClick={handleRun}
          disabled={loading}
          className="btn-neon text-xs flex-1 py-2 disabled:opacity-30"
          style={{ borderColor: 'var(--text-dim)', color: 'var(--text-dim)' }}
        >
          {loading ? '...' : 'RUN'}
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="btn-neon btn-run text-xs flex-1 py-2 disabled:opacity-30"
        >
          {loading ? 'PRÜFE...' : 'SUBMIT'}
        </button>
      </div>

      {/* Output */}
      {output && (
        <div
          className="panel p-3 text-sm overflow-y-auto"
          style={{
            fontFamily: 'var(--font-code)',
            maxHeight: '20vh',
            minHeight: '40px',
          }}
        >
          {output.output && (
            <div className={submitResult?.success ? 'glow-success' : ''}>
              <span style={{ color: 'var(--text-dim)' }}>&gt; </span>
              <span style={{ whiteSpace: 'pre-wrap' }}>{output.output}</span>
            </div>
          )}
          {output.error && (
            <div className="glow-red mt-1">
              <span style={{ whiteSpace: 'pre-wrap' }}>{output.error}</span>
            </div>
          )}
          {submitResult?.success && (
            <div className="glow-magenta mt-2 font-semibold" style={{ fontFamily: 'var(--font-hud)', fontSize: '12px' }}>
              +{submitResult.xp_gained} XP
              {submitResult.streak_bonus > 0 && (
                <span className="ml-2" style={{ color: 'var(--cyan)' }}>
                  (Streak +{submitResult.streak_bonus})
                </span>
              )}
            </div>
          )}
          {submitResult?.success && submitResult?.level_up && (
            <div className="glow-magenta mt-1 font-bold glitch" style={{ fontFamily: 'var(--font-hud)', fontSize: '14px' }}>
              LEVEL UP! {submitResult.new_title}
            </div>
          )}
          {submitResult?.hp_lost && (
            <div className="glow-red mt-1" style={{ fontFamily: 'var(--font-hud)', fontSize: '11px' }}>
              -{submitResult.hp_lost} HP
            </div>
          )}
          {submitResult?.system_crash && (
            <div className="glow-red mt-1 glitch" style={{ fontFamily: 'var(--font-hud)', fontSize: '12px' }}>
              SYSTEM CRASH! Recovery in progress...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
