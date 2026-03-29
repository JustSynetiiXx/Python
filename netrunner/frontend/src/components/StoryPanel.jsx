import { useState, useEffect, useRef } from 'react';

export default function StoryPanel({ lines, onComplete }) {
  const [displayedLines, setDisplayedLines] = useState([]);
  const [currentLine, setCurrentLine] = useState(0);
  const [currentChar, setCurrentChar] = useState(0);
  const [typing, setTyping] = useState(true);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!lines || lines.length === 0) {
      setTyping(false);
      return;
    }
    setDisplayedLines([]);
    setCurrentLine(0);
    setCurrentChar(0);
    setTyping(true);
  }, [lines]);

  useEffect(() => {
    if (!typing || !lines || currentLine >= lines.length) {
      if (typing) {
        setTyping(false);
        onComplete?.();
      }
      return;
    }

    const line = lines[currentLine];
    if (currentChar >= line.length) {
      setDisplayedLines(prev => [...prev, line]);
      setCurrentLine(prev => prev + 1);
      setCurrentChar(0);
      return;
    }

    const speed = line[currentChar] === '.' || line[currentChar] === ',' ? 80 : 25;
    const timer = setTimeout(() => setCurrentChar(prev => prev + 1), speed);
    return () => clearTimeout(timer);
  }, [typing, currentLine, currentChar, lines, onComplete]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [displayedLines, currentChar]);

  const skipAll = () => {
    if (!lines) return;
    setDisplayedLines([...lines]);
    setCurrentLine(lines.length);
    setCurrentChar(0);
    setTyping(false);
    onComplete?.();
  };

  if (!lines || lines.length === 0) return null;

  const partialLine = typing && currentLine < lines.length
    ? lines[currentLine].slice(0, currentChar)
    : null;

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="panel p-3 overflow-y-auto text-sm leading-relaxed"
        style={{
          fontFamily: 'var(--font-story)',
          maxHeight: '35vh',
          minHeight: '80px',
        }}
      >
        {displayedLines.map((line, i) => (
          <p key={i} className="mb-1.5">
            {line.startsWith('ECHO:') ? (
              <>
                <span className="glow-cyan font-semibold">ECHO:</span>
                <span>{line.slice(5)}</span>
              </>
            ) : line.startsWith('[SYSTEM]') ? (
              <span className="glow-magenta font-semibold">{line}</span>
            ) : (
              <span>{line}</span>
            )}
          </p>
        ))}

        {partialLine !== null && (
          <p className="mb-1.5">
            {partialLine.startsWith('ECHO:') ? (
              <>
                <span className="glow-cyan font-semibold">ECHO:</span>
                <span>{partialLine.slice(5)}</span>
              </>
            ) : (
              <span>{partialLine}</span>
            )}
            <span className="cursor-blink" />
          </p>
        )}
      </div>

      {typing && (
        <button
          onClick={skipAll}
          className="absolute top-2 right-2 text-xs px-2 py-1 rounded"
          style={{
            background: '#ffffff10',
            color: 'var(--text-dim)',
            fontFamily: 'var(--font-code)',
          }}
        >
          SKIP &raquo;
        </button>
      )}
    </div>
  );
}
