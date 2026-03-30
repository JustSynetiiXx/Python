import { useCallback } from 'react';

const KEYS = [
  { char: '(', pair: ')', label: '(' },
  { char: ')', label: ')' },
  { char: '[', pair: ']', label: '[' },
  { char: ']', label: ']' },
  { char: '{', pair: '}', label: '{' },
  { char: '}', label: '}' },
  { char: ':', label: ':' },
  { char: '=', label: '=' },
  { char: '"', pair: '"', label: '"' },
  { char: "'", pair: "'", label: "'" },
  { char: '.', label: '.' },
  { char: '_', label: '_' },
  { char: '#', label: '#' },
  { char: '\n', label: '\u21B5' },  // newline
  { char: 'TAB', label: 'TAB' },
  { char: 'RUN', label: '\u23CE', isRun: true },
];

export default function PythonKeybar({ onKey, onPair, onRun }) {
  const handlePress = useCallback((key) => {
    // Haptic feedback on supported devices
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }

    if (key.isRun) {
      onRun?.();
      return;
    }

    if (key.char === 'TAB') {
      onKey?.('    ');
      return;
    }

    if (key.char === '\n') {
      onKey?.('\n');
      return;
    }

    // Paired characters: insert both and place cursor between them
    if (key.pair) {
      onPair?.(key.char, key.pair);
      return;
    }

    onKey?.(key.char);
  }, [onKey, onPair, onRun]);

  return (
    <div
      className="flex-shrink-0"
      style={{
        background: '#0a0a14',
        borderTop: '1px solid var(--panel-border)',
        boxShadow: '0 -2px 12px rgba(0, 0, 0, 0.4)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div
        className="flex gap-[3px] px-1.5 py-1.5 overflow-x-auto"
        style={{
          /* Hide scrollbar but keep scrollable */
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {KEYS.map((key, i) => (
          <button
            key={i}
            onPointerDown={(e) => {
              // Prevent stealing focus from CodeMirror
              e.preventDefault();
              handlePress(key);
            }}
            className="keybar-btn flex-shrink-0"
            style={
              key.isRun
                ? {
                    color: 'var(--success)',
                    borderColor: '#00ff8844',
                    background: '#00ff8810',
                    fontWeight: 'bold',
                    fontSize: '18px',
                    minWidth: '52px',
                  }
                : key.char === 'TAB'
                ? {
                    fontSize: '10px',
                    color: 'var(--text-dim)',
                    minWidth: '40px',
                    letterSpacing: '0.05em',
                    fontFamily: 'var(--font-hud)',
                  }
                : key.char === '\n'
                ? {
                    fontSize: '14px',
                    color: 'var(--text-dim)',
                  }
                : key.pair
                ? { color: '#00ccdd' }
                : {}
            }
          >
            {key.label}
          </button>
        ))}
      </div>
    </div>
  );
}
