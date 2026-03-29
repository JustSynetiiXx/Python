import { useState, useCallback } from 'react';
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
  const [storyDone, setStoryDone] = useState(false);

  const game = useGame();
  const {
    player, mission, currentChallenge, output, submitResult,
    loading, xpAnim, sidebarOpen, sidebarView,
    editorRef, loadSession, runCode, submitCode, getHint,
    openSidebar, closeSidebar,
  } = game;

  const handleLogin = useCallback(() => {
    setLoggedIn(true);
    loadSession();
  }, [loadSession]);

  const handleKeybarKey = useCallback((key) => {
    if (key === 'run') {
      const code = editorRef.current?.getCode?.() || '';
      submitCode(code);
    } else {
      editorRef.current?.insertText?.(key);
    }
  }, [editorRef, submitCode]);

  const handleHint = useCallback(async () => {
    const hint = await getHint();
    if (hint) {
      setHintMsg(hint.hint);
    }
  }, [getHint]);

  const handleStoryComplete = useCallback(() => {
    setStoryDone(true);
    setHintMsg(null);
  }, []);

  if (!loggedIn) {
    return (
      <div className="scanlines">
        <Login onLogin={handleLogin} />
      </div>
    );
  }

  // Determine story lines to show
  const storyLines = (!storyDone && mission?.story_intro)
    ? mission.story_intro
    : (submitResult?.mission_complete && mission?.story_complete)
      ? mission.story_complete
      : null;

  // ECHO dialogue after submit
  const echoMsg = submitResult
    ? (submitResult.success ? currentChallenge?.echo_success : currentChallenge?.echo_fail)
    : hintMsg;
  const echoType = submitResult
    ? (submitResult.success ? 'success' : 'error')
    : 'hint';

  return (
    <div className="scanlines flex flex-col h-[100dvh] relative">
      {/* HUD */}
      <HUD player={player} onMenuClick={() => openSidebar('character')} />

      {/* Main content - scrollable area between HUD and Keybar */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
        {/* Story Panel */}
        {storyLines && (
          <StoryPanel lines={storyLines} onComplete={handleStoryComplete} />
        )}

        {/* Mission Brief */}
        {storyDone && currentChallenge && (
          <MissionBrief challenge={currentChallenge} />
        )}

        {/* ECHO Dialogue */}
        {echoMsg && (
          <Dialogue message={echoMsg} type={echoType} />
        )}

        {/* Terminal (Editor + Output) */}
        {storyDone && (
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
        {storyDone && currentChallenge && !submitResult?.success && (
          <div className="flex justify-center">
            <button
              onClick={handleHint}
              className="text-xs px-4 py-2 rounded"
              style={{
                background: '#ffffff08',
                color: 'var(--text-dim)',
                fontFamily: 'var(--font-code)',
                border: '1px solid #ffffff10',
              }}
            >
              HINT anfordern
            </button>
          </div>
        )}
      </div>

      {/* Python Keybar - fixed at bottom */}
      {storyDone && (
        <PythonKeybar onKey={handleKeybarKey} />
      )}

      {/* XP Float Animation */}
      {xpAnim && (
        <div className="xp-float glow-magenta text-lg right-4 top-12">
          +{xpAnim.xp} XP
        </div>
      )}

      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={closeSidebar} />
      )}

      {/* Sidebar */}
      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        {/* Sidebar nav tabs */}
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

        {/* Sidebar content */}
        {sidebarView === 'character' && <CharacterPanel player={player} />}
        {sidebarView === 'inventory' && <Inventory />}
        {sidebarView === 'map' && <MapView />}
      </div>
    </div>
  );
}
