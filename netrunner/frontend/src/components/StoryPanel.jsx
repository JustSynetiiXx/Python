import { useState, useEffect, useRef } from 'react';

export default function StoryPanel({ lines, onComplete }) {
  const [displayedLines, setDisplayedLines] = useState([]);
  const [currentLine, setCurrentLine] = useState(0);
  const [currentChar, setCurrentChar] = useState(0);
  const [typing, setTyping] = useState(false);
  const [waitingForNext, setWaitingForNext] = useState(false);
  const containerRef = useRef(null);

  // Reset when lines change
  useEffect(() => {
    if (!lines || lines.length === 0) {
      setTyping(false);
      return;
    }
    setDisplayedLines([]);
    setCurrentLine(0);
    setCurrentChar(0);
    setTyping(true);
    setWaitingForNext(false);
  }, [lines]);

  // Typewriter effect — types one line, then pauses for user
  useEffect(() => {
    if (!typing || waitingForNext || !lines || currentLine >= lines.length) return;

    const line = lines[currentLine];
    if (currentChar >= line.length) {
      // Line finished — show it fully and wait for user
      setDisplayedLines(prev => [...prev, line]);
      setTyping(false);
      setWaitingForNext(true);
      return;
    }

    const ch = line[currentChar];
    const speed = ch === '.' || ch === ',' || ch === '!' || ch === '?' ? 80 : 25;
    const timer = setTimeout(() => setCurrentChar(prev => prev + 1), speed);
    return () => clearTimeout(timer);
  }, [typing, currentLine, currentChar, lines, waitingForNext]);

  // Auto-scroll
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [displayedLines, currentChar]);

  // Player presses "WEITER"
  const handleNext = () => {
    const nextLine = currentLine + 1;
    if (nextLine >= lines.length) {
      // All lines shown — story block complete
      setWaitingForNext(false);
      onComplete?.();
    } else {
      setCurrentLine(nextLine);
      setCurrentChar(0);
      setTyping(true);
      setWaitingForNext(false);
    }
  };

  // Skip entire story block
  const skipAll = () => {
    if (!lines) return;
    setDisplayedLines([...lines]);
    setCurrentLine(lines.length);
    setCurrentChar(0);
    setTyping(false);
    setWaitingForNext(false);
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

      {/* WEITER button — player controls the pace */}
      {waitingForNext && (
        <div className="flex justify-center mt-2">
          <button
            onClick={handleNext}
            className="px-5 py-2 text-xs tracking-wider rounded cursor-pointer"
            style={{
              fontFamily: 'var(--font-hud)',
              color: 'var(--cyan)',
              background: '#ffffff08',
              border: '1px solid var(--panel-border)',
            }}
          >
            WEITER {'\u25B8'}
          </button>
        </div>
      )}

      {/* SKIP button — visible during typing or waiting */}
      {(typing || waitingForNext) && (
        <button
          onClick={skipAll}
          className="absolute top-2 right-2 text-xs px-2 py-1 rounded cursor-pointer"
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
