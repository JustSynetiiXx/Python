import { useState, useCallback, useRef, useEffect } from 'react';
import { isLoggedIn } from './utils/api';
import useGame from './hooks/useGame';
import Login from './components/Login';
import HUD from './components/HUD';
import StoryPanel from './components/StoryPanel';
import MissionBrief from './components/MissionBrief';
import Terminal from './components/Terminal';
import PythonKeybar from './components/PythonKeybar';
import Dialogue from './components/Dialogue';
import CharacterPanel from './components/CharacterPanel';
import Inventory from './components/Inventory';
import MapView from './components/MapView';

export default function App() {
  const [loggedIn, setLoggedIn] = useState(isLoggedIn());
  const [hintMsg, setHintMsg] = useState(null);
  const scrollAreaRef = useRef(null);

  const game = useGame();
  const {
    player, mission, currentChallenge, output, submitResult,
    loading, xpAnim, storyPhase, sidebarOpen, sidebarView,
    editorRef, loadSession, runCode, submitCode, getHint,
    finishStoryIntro, openSidebar, closeSidebar,
  } = game;

  const isPlaying = storyPhase === 'play';

  const handleLogin = useCallback(() => {
    setLoggedIn(true);
    loadSession();
  }, [loadSession]);

  // ── PythonKeybar handlers ──
  const handleKeyInsert = useCallback((char) => {
    editorRef.current?.insertText?.(char);
  }, [editorRef]);

  const handleKeyPair = useCallback((open, close) => {
    editorRef.current?.insertPaired?.(open, close);
  }, [editorRef]);

  const handleKeyRun = useCallback(() => {
    const code = editorRef.current?.getCode?.() || '';
    if (code.trim()) submitCode(code);
  }, [editorRef, submitCode]);

  // ── Hints ──
  const handleHint = useCallback(async () => {
    const hint = await getHint();
    if (hint) {
      setHintMsg(hint.hint);
    }
  }, [getHint]);

  // Clear hint on new challenge
  useEffect(() => {
    setHintMsg(null);
  }, [currentChallenge?.id]);

  // Auto-scroll to terminal when story finishes
  useEffect(() => {
    if (isPlaying && scrollAreaRef.current) {
      setTimeout(() => {
        scrollAreaRef.current?.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
      }, 100);
    }
  }, [isPlaying]);

  // ── Login screen ──
  if (!loggedIn) {
    return (
      <div className="scanlines">
        <Login onLogin={handleLogin} />
      </div>
    );
  }

  // ── Determine what story text to show ──
  const storyLines =
    storyPhase === 'intro' ? mission?.story_intro :
    storyPhase === 'complete' ? mission?.story_complete :
    null;

  // ── ECHO dialogue (success/fail/hint feedback) ──
  const echoMsg = submitResult
    ? (submitResult.success ? currentChallenge?.echo_success : currentChallenge?.echo_fail)
    : hintMsg;
  const echoType = submitResult
    ? (submitResult.success ? 'success' : 'error')
    : 'hint';

  // ── Challenge progress indicator ──
  const challengeCount = mission?.challenges?.length || 0;
  const challengeNum = game.challengeIndex + 1;

  return (
    <div className="scanlines flex flex-col h-[100dvh] relative">
      {/* ── HUD ── */}
      <HUD player={player} onMenuClick={() => openSidebar('character')} />

      {/* ── Main scrollable content ── */}
      <div ref={scrollAreaRef} className="flex-1 overflow-y-auto px-2 py-2 space-y-2">

        {/* Story Panel (intro or complete) */}
        {storyLines && (
          <StoryPanel
            lines={storyLines}
            onComplete={storyPhase === 'intro' ? finishStoryIntro : undefined}
          />
        )}

        {/* Challenge progress bar */}
        {isPlaying && challengeCount > 1 && (
          <div className="flex items-center gap-2 px-1">
            <span
              className="text-[10px] tracking-wider"
              style={{ fontFamily: 'var(--font-hud)', color: 'var(--text-dim)' }}
            >
              {challengeNum}/{challengeCount}
            </span>
            <div className="flex gap-1 flex-1">
              {mission.challenges.map((ch, i) => (
                <div
                  key={ch.id}
                  className="h-1 flex-1 rounded-full"
                  style={{
                    background:
                      ch.progress?.completed ? 'var(--success)' :
                      i === game.challengeIndex ? 'var(--cyan)' :
                      '#ffffff15',
                    boxShadow:
                      ch.progress?.completed ? '0 0 4px #00ff8844' :
                      i === game.challengeIndex ? '0 0 4px #00fff244' :
                      'none',
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Mission Brief */}
        {isPlaying && currentChallenge && (
          <MissionBrief challenge={currentChallenge} />
        )}

        {/* ECHO Dialogue (hint / success / error feedback) */}
        {isPlaying && echoMsg && (
          <Dialogue message={echoMsg} type={echoType} />
        )}

        {/* Terminal (Editor + Output) */}
        {isPlaying && (
          <Terminal
            starterCode={currentChallenge?.starter_code || ''}
            output={output}
            submitResult={submitResult}
            loading={loading}
            onRun={runCode}
            onSubmit={submitCode}
            editorRef={editorRef}
          />
        )}

        {/* Hint button */}
        {isPlaying && currentChallenge && !submitResult?.success && (
          <div className="flex justify-center pb-2">
            <button
              onClick={handleHint}
              className="text-xs px-5 py-2.5 rounded"
              style={{
                background: '#ffffff06',
                color: 'var(--text-dim)',
                fontFamily: 'var(--font-code)',
                border: '1px solid #ffffff10',
              }}
            >
              {'\u2139'} HINT
            </button>
          </div>
        )}
      </div>

      {/* ── Python Keybar (fixed at bottom) ── */}
      {isPlaying && (
        <PythonKeybar
          onKey={handleKeyInsert}
          onPair={handleKeyPair}
          onRun={handleKeyRun}
        />
      )}

      {/* ── XP Float Animation ── */}
      {xpAnim && (
        <div className="xp-float glow-magenta text-lg right-4 top-14">
          +{xpAnim.xp} XP
        </div>
      )}

      {/* ── Sidebar Overlay ── */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={closeSidebar} />
      )}

      {/* ── Sidebar ── */}
      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div
          className="flex"
          style={{ borderBottom: '1px solid var(--panel-border)' }}
        >
          {[
            { id: 'character', label: 'PROFIL' },
            { id: 'inventory', label: 'ITEMS' },
            { id: 'map', label: 'KARTE' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => openSidebar(tab.id)}
              className="flex-1 py-3 text-xs tracking-wider cursor-pointer"
              style={{
                fontFamily: 'var(--font-hud)',
                color: sidebarView === tab.id ? 'var(--cyan)' : 'var(--text-dim)',
                background: 'transparent',
                border: 'none',
                borderBottom: sidebarView === tab.id ? '2px solid var(--cyan)' : '2px solid transparent',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {sidebarView === 'character' && <CharacterPanel player={player} />}
        {sidebarView === 'inventory' && <Inventory />}
        {sidebarView === 'map' && <MapView />}
      </div>
    </div>
  );
}
