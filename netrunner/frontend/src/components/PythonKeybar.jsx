const KEYS = ['(', ')', '[', ']', '{', '}', ':', '=', '"', '.', '_', '#', '\t', '\u23CE'];

export default function PythonKeybar({ onKey }) {
  const handleKey = (key) => {
    if (key === '\u23CE') {
      onKey('run');
    } else if (key === '\t') {
      onKey('    '); // 4 spaces for tab
    } else {
      onKey(key);
    }
  };

  return (
    <div
      className="flex gap-1 px-2 py-1.5 overflow-x-auto"
      style={{
        background: '#0d0d18',
        borderTop: '1px solid var(--panel-border)',
      }}
    >
      {KEYS.map((key) => (
        <button
          key={key}
          className="keybar-btn flex-shrink-0"
          onClick={() => handleKey(key)}
          style={
            key === '\u23CE'
              ? { color: 'var(--success)', borderColor: '#00ff8833' }
              : key === '\t'
              ? { fontSize: '12px', color: 'var(--text-dim)' }
              : {}
          }
        >
          {key === '\t' ? 'TAB' : key}
        </button>
      ))}
    </div>
  );
}
