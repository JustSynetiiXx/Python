import { useEffect, useRef, useCallback, useState } from 'react';
import { EditorView, keymap, placeholder, lineNumbers, drawSelection } from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { python } from '@codemirror/lang-python';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching } from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { highlightSelectionMatches } from '@codemirror/search';

// ── Custom Cyberpunk Theme ──
const cyberpunkTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '15px',
    backgroundColor: '#0d0d18 !important',
  },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: "'Share Tech Mono', monospace",
  },
  '.cm-content': {
    padding: '10px 6px',
    caretColor: '#00fff2',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: '#00fff2',
    borderLeftWidth: '2px',
  },
  '.cm-gutters': {
    backgroundColor: '#0a0a14',
    borderRight: '1px solid #ffffff0d',
    color: '#404060',
    minWidth: '32px',
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#ffffff08',
    color: '#00fff2',
  },
  '.cm-activeLine': {
    backgroundColor: '#ffffff06',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: '#00fff220 !important',
  },
  '.cm-matchingBracket': {
    backgroundColor: '#00fff230',
    color: '#00fff2 !important',
    outline: '1px solid #00fff244',
  },
  '.cm-placeholder': {
    color: '#404060',
    fontStyle: 'italic',
  },
  '.cm-line': {
    padding: '0 4px',
  },
}, { dark: true });

// Cyberpunk syntax highlighting
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

const cyberpunkHighlight = HighlightStyle.define([
  { tag: tags.keyword,        color: '#ff00aa', fontWeight: 'bold' },
  { tag: tags.controlKeyword, color: '#ff00aa', fontWeight: 'bold' },
  { tag: tags.operatorKeyword,color: '#ff00aa' },
  { tag: tags.definitionKeyword, color: '#ff00aa', fontWeight: 'bold' },
  { tag: tags.string,         color: '#00ff88' },
  { tag: tags.number,         color: '#ffaa00' },
  { tag: tags.bool,           color: '#ffaa00' },
  { tag: tags.comment,        color: '#404060', fontStyle: 'italic' },
  { tag: tags.function(tags.variableName), color: '#00ccff' },
  { tag: tags.definition(tags.variableName), color: '#00fff2' },
  { tag: tags.variableName,   color: '#c0c0d0' },
  { tag: tags.operator,       color: '#ff00aa' },
  { tag: tags.paren,          color: '#808090' },
  { tag: tags.bracket,        color: '#808090' },
  { tag: tags.brace,          color: '#808090' },
  { tag: tags.punctuation,    color: '#808090' },
  { tag: tags.className,      color: '#00fff2', fontWeight: 'bold' },
  { tag: tags.propertyName,   color: '#00ccff' },
  { tag: tags.self,           color: '#ff00aa', fontStyle: 'italic' },
  { tag: tags.null,           color: '#ffaa00' },
  { tag: tags.special(tags.string), color: '#00ff88' },
]);

// ── Error translation for beginners ──
const ERROR_TRANSLATIONS = {
  SyntaxError: 'Da stimmt was mit der Schreibweise nicht. Check Klammern und Anf\u00FChrungszeichen.',
  NameError: 'Diesen Namen kennt dein System nicht. Tippfehler?',
  TypeError: 'Du versuchst zwei Dinge zu kombinieren die nicht zusammenpassen.',
  IndentationError: 'Die Einr\u00FCckung stimmt nicht. Nutze 4 Leerzeichen oder TAB.',
  ValueError: 'Der Wert passt nicht. Pr\u00FCf den Datentyp.',
  ZeroDivisionError: 'Division durch Null. Das geht nicht \u2014 auch nicht im Netz.',
  IndexError: 'Index au\u00DFerhalb des Bereichs. Die Liste ist nicht so lang.',
  KeyError: 'Diesen Schl\u00FCssel gibt es nicht im Dictionary.',
  AttributeError: 'Dieses Objekt hat diese Eigenschaft nicht.',
};

function translateError(errorText) {
  if (!errorText) return null;
  for (const [errType, translation] of Object.entries(ERROR_TRANSLATIONS)) {
    if (errorText.includes(errType)) {
      return { type: errType, translation, original: errorText.trim() };
    }
  }
  return null;
}

// ── Component ──
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
  const outputRef = useRef(null);
  const [outputHistory, setOutputHistory] = useState([]);
  const submitFnRef = useRef(onSubmit);
  const runFnRef = useRef(onRun);

  // Keep refs current
  useEffect(() => { submitFnRef.current = onSubmit; }, [onSubmit]);
  useEffect(() => { runFnRef.current = onRun; }, [onRun]);

  // Initialize CodeMirror
  useEffect(() => {
    if (!editorContainerRef.current) return;

    const state = EditorState.create({
      doc: starterCode,
      extensions: [
        lineNumbers(),
        history(),
        drawSelection(),
        bracketMatching(),
        closeBrackets(),
        highlightSelectionMatches(),
        python(),
        cyberpunkTheme,
        syntaxHighlighting(cyberpunkHighlight),
        keymap.of([
          ...closeBracketsKeymap,
          indentWithTab,
          ...defaultKeymap,
          ...historyKeymap,
          {
            key: 'Ctrl-Enter',
            run: () => {
              const code = viewRef.current?.state.doc.toString() || '';
              submitFnRef.current?.(code);
              return true;
            },
          },
          {
            key: 'Shift-Enter',
            run: () => {
              const code = viewRef.current?.state.doc.toString() || '';
              runFnRef.current?.(code);
              return true;
            },
          },
        ]),
        placeholder('# Dein Code hier...'),
        EditorView.lineWrapping,
      ],
    });

    const view = new EditorView({
      state,
      parent: editorContainerRef.current,
    });

    viewRef.current = view;

    return () => view.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update content when starterCode changes (new challenge)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentDoc = view.state.doc.toString();
    if (currentDoc !== starterCode) {
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: starterCode },
      });
      // Clear output history on new challenge
      setOutputHistory([]);
    }
  }, [starterCode]);

  const getCode = useCallback(() => {
    return viewRef.current?.state.doc.toString() || '';
  }, []);

  // Insert text at cursor (for PythonKeybar)
  const insertText = useCallback((text) => {
    const view = viewRef.current;
    if (!view) return;
    const { from, to } = view.state.selection.main;
    view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + text.length },
    });
    view.focus();
  }, []);

  // Insert paired characters: (), [], {}, ""
  const insertPaired = useCallback((open, close) => {
    const view = viewRef.current;
    if (!view) return;
    const { from, to } = view.state.selection.main;
    const selected = view.state.sliceDoc(from, to);
    if (selected.length > 0) {
      // Wrap selection
      view.dispatch({
        changes: { from, to, insert: open + selected + close },
        selection: { anchor: from + 1, head: from + 1 + selected.length },
      });
    } else {
      view.dispatch({
        changes: { from, to: from, insert: open + close },
        selection: { anchor: from + 1 },
      });
    }
    view.focus();
  }, []);

  // Expose editor API via ref
  useEffect(() => {
    if (editorRef) {
      editorRef.current = {
        getCode,
        insertText,
        insertPaired,
        focus: () => viewRef.current?.focus(),
      };
    }
  }, [editorRef, getCode, insertText, insertPaired]);

  // Add to output history when output changes
  useEffect(() => {
    if (!output) return;
    setOutputHistory(prev => [...prev, { ...output, submitResult, timestamp: Date.now() }]);
  }, [output, submitResult]);

  // Auto-scroll output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [outputHistory]);

  const handleRun = () => onRun?.(getCode());
  const handleSubmit = () => onSubmit?.(getCode());

  // Determine output panel animation class
  const lastEntry = outputHistory[outputHistory.length - 1];
  const lastResult = lastEntry?.submitResult;
  const outputPanelClass = lastResult?.success
    ? 'output-success'
    : (lastEntry?.error && lastResult && !lastResult.success)
      ? 'output-error'
      : '';

  return (
    <div className="flex flex-col gap-1 section-enter">
      {/* Editor header */}
      <div
        className="flex items-center justify-between px-3 py-1"
        style={{
          background: '#0a0a14',
          borderRadius: '4px 4px 0 0',
          border: '1px solid var(--panel-border)',
          borderBottom: 'none',
          fontFamily: 'var(--font-code)',
          fontSize: '11px',
        }}
      >
        <span style={{ color: 'var(--text-dim)' }}>
          <span style={{ color: 'var(--cyan)' }}>&gt;</span> terminal.py
        </span>
        <div className="flex gap-1">
          <span style={{ color: '#ff004066' }}>{'\u25CF'}</span>
          <span style={{ color: '#ffaa0066' }}>{'\u25CF'}</span>
          <span style={{ color: '#00ff8866' }}>{'\u25CF'}</span>
        </div>
      </div>

      {/* CodeMirror Editor */}
      <div
        ref={editorContainerRef}
        className="overflow-hidden"
        style={{
          height: '28vh',
          minHeight: '120px',
          maxHeight: '300px',
          background: '#0d0d18',
          border: '1px solid var(--panel-border)',
          borderTop: 'none',
          borderRadius: '0 0 4px 4px',
          boxShadow: 'var(--glow-cyan)',
        }}
      />

      {/* Action buttons */}
      <div className="flex gap-2 py-1">
        <button
          onClick={handleRun}
          disabled={loading}
          className="btn-neon text-xs flex-1 py-2.5 disabled:opacity-30"
          style={{ borderColor: 'var(--text-dim)', color: 'var(--text-dim)' }}
          title="Shift+Enter"
        >
          {loading ? (
            <span className="inline-flex items-center gap-1">
              <span className="inline-block w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
              RUN
            </span>
          ) : (
            '\u25B6 RUN'
          )}
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="btn-neon btn-run text-xs flex-[2] py-2.5 disabled:opacity-30"
          title="Ctrl+Enter"
        >
          {loading ? (
            <span className="inline-flex items-center gap-1">
              <span className="inline-block w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
              PR\u00DCFE...
            </span>
          ) : (
            '\u2713 SUBMIT'
          )}
        </button>
      </div>

      {/* Output area */}
      {outputHistory.length > 0 && (
        <div
          key={lastEntry?.timestamp}
          ref={outputRef}
          className={`panel p-3 text-sm overflow-y-auto space-y-2 ${outputPanelClass}`}
          style={{
            fontFamily: 'var(--font-code)',
            maxHeight: '25vh',
            minHeight: '48px',
          }}
        >
          {outputHistory.map((entry, i) => {
            const isLast = i === outputHistory.length - 1;
            const result = entry.submitResult;
            const translatedErr = translateError(entry.error);

            return (
              <div
                key={entry.timestamp}
                className={isLast ? 'output-enter' : 'opacity-40'}
              >
                {/* stdout */}
                {entry.output && (
                  <div className={result?.success ? 'glow-success' : ''}>
                    <span style={{ color: 'var(--text-dim)' }}>&gt; </span>
                    <span style={{ whiteSpace: 'pre-wrap' }}>{entry.output}</span>
                  </div>
                )}

                {/* stderr — with German translation for beginners */}
                {entry.error && (
                  <div className="mt-1">
                    {translatedErr ? (
                      <>
                        <div className="glow-red text-xs" style={{ fontFamily: 'var(--font-code)' }}>
                          {translatedErr.type}
                        </div>
                        <div className="mt-0.5 text-sm" style={{ color: 'var(--text)', fontFamily: 'var(--font-story)' }}>
                          {translatedErr.translation}
                        </div>
                        <div className="mt-1 text-xs" style={{ color: 'var(--text-dim)' }}>
                          {translatedErr.original}
                        </div>
                      </>
                    ) : (
                      <div className="glow-red">
                        <span style={{ whiteSpace: 'pre-wrap' }}>{entry.error}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Success feedback */}
                {isLast && result?.success && (
                  <div className="mt-2 pt-2" style={{ borderTop: '1px solid #ffffff10' }}>
                    <div
                      className="glow-magenta font-semibold"
                      style={{ fontFamily: 'var(--font-hud)', fontSize: '13px' }}
                    >
                      +{result.xp_gained} XP
                      {result.streak_bonus > 0 && (
                        <span className="ml-2" style={{ color: 'var(--cyan)', fontSize: '11px' }}>
                          STREAK +{result.streak_bonus}
                        </span>
                      )}
                    </div>
                    {result.level_up && (
                      <div
                        className="glow-magenta mt-1 font-bold level-up-flash glitch"
                        style={{ fontFamily: 'var(--font-hud)', fontSize: '15px' }}
                      >
                        {'\u2191'} LEVEL {result.new_level} {'\u2014'} {result.new_title}
                      </div>
                    )}
                    {result.reward && (
                      <div className="mt-1 text-xs" style={{ color: 'var(--cyan)' }}>
                        + {result.reward.name}
                      </div>
                    )}
                    {result.mission_complete && (
                      <div
                        className="glow-cyan mt-1 font-semibold"
                        style={{ fontFamily: 'var(--font-hud)', fontSize: '11px' }}
                      >
                        MISSION COMPLETE
                      </div>
                    )}
                  </div>
                )}

                {/* HP loss */}
                {isLast && result?.hp_lost && (
                  <div
                    className="glow-red mt-1 font-semibold"
                    style={{ fontFamily: 'var(--font-hud)', fontSize: '11px' }}
                  >
                    -{result.hp_lost} HP
                  </div>
                )}

                {/* System crash */}
                {isLast && result?.system_crash && (
                  <div
                    className="glow-red mt-2 py-2 text-center font-bold glitch"
                    style={{
                      fontFamily: 'var(--font-hud)',
                      fontSize: '13px',
                      background: '#ff004010',
                      borderRadius: '4px',
                    }}
                  >
                    {'\u26A0'} SYSTEM CRASH {'\u26A0'}
                    <div className="text-xs font-normal mt-1" style={{ fontFamily: 'var(--font-story)' }}>
                      Recovery l{'\u00E4'}uft... HP wiederhergestellt.
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
