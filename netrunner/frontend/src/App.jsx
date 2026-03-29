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
    // Recovery & review
    sessionMode, currentRecovery, submitRecoveryCode,
    reviewChallenges, currentReview, submitReviewCode,
    systemCrash, recoveryIndex, recoveryChallenges,
  } = game;

  const isPlaying = storyPhase === 'play';
  const isRecovery = sessionMode === 'recovery';
  const isReviewsOnly = sessionMode === 'reviews_only';
  const isDailyCap = sessionMode === 'daily_cap';

  // Active challenge depends on mode
  const activeChallenge = isRecovery ? currentRecovery
    : isReviewsOnly ? currentReview
    : currentChallenge;

  // Active submit function depends on mode
  const activeSubmit = isRecovery ? submitRecoveryCode
    : isReviewsOnly ? submitReviewCode
    : submitCode;

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
    if (code.trim()) activeSubmit(code);
  }, [editorRef, activeSubmit]);

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
  }, [currentChallenge?.id, currentRecovery?.id, currentReview?.id]);

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

  // ── ECHO dialogue (hint / success / error feedback) ──
  const echoMsg = submitResult
    ? (submitResult.success
        ? (submitResult.echo_success || activeChallenge?.echo_success)
        : (submitResult.echo_fail || activeChallenge?.echo_fail))
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

      {/* ── System Crash Overlay ── */}
      {systemCrash && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: 'rgba(255, 0, 64, 0.15)' }}
        >
          <div className="text-center glitch">
            <div
              className="glow-red text-3xl mb-4"
              style={{ fontFamily: 'var(--font-hud)' }}
            >
              SYSTEM CRASH
            </div>
            <div className="text-sm" style={{ color: 'var(--text-dim)' }}>
              Notfall-Reboot wird eingeleitet...
            </div>
          </div>
        </div>
      )}

      {/* ── Main scrollable content ── */}
      <div ref={scrollAreaRef} className="flex-1 overflow-y-auto px-2 py-2 space-y-2">

        {/* Story Panel (intro or complete) — normal mode only */}
        {!isRecovery && !isReviewsOnly && !isDailyCap && storyLines && (
          <StoryPanel
            lines={storyLines}
            onComplete={storyPhase === 'intro' ? finishStoryIntro : undefined}
          />
        )}

        {/* ── Recovery Mode UI ── */}
        {isRecovery && isPlaying && (
          <>
            <div className="panel p-3">
              <div
                className="glow-red text-sm mb-2"
                style={{ fontFamily: 'var(--font-hud)', letterSpacing: '0.1em' }}
              >
                ⚠ SYSTEM RECOVERY
              </div>
              <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
                Dein System ist abgestürzt. Löse {recoveryChallenges.length} einfache Aufgaben,
                um wieder online zu kommen.
              </p>
              <div className="flex gap-1 mt-2">
                {recoveryChallenges.map((_, i) => (
                  <div
                    key={i}
                    className="h-1.5 flex-1 rounded-full"
                    style={{
                      background: i < recoveryIndex ? 'var(--success)' :
                        i === recoveryIndex ? 'var(--red)' : '#ffffff15',
                      boxShadow: i < recoveryIndex ? '0 0 4px #00ff8844' :
                        i === recoveryIndex ? '0 0 4px #ff004044' : 'none',
                    }}
                  />
                ))}
              </div>
            </div>

            {currentRecovery && (
              <MissionBrief challenge={currentRecovery} />
            )}
          </>
        )}

        {/* ── Reviews Only Mode UI ── */}
        {isReviewsOnly && isPlaying && (
          <>
            <div className="panel p-3">
              <div
                className="glow-magenta text-sm mb-2"
                style={{ fontFamily: 'var(--font-hud)', letterSpacing: '0.1em' }}
              >
                INTRUSION ALERT
              </div>
              <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
                Du hast dein Tageslimit erreicht. Verteidige dein System gegen alte Bedrohungen!
              </p>
              {currentReview?.intrusion_alert && (
                <p className="text-xs mt-2 glow-magenta">
                  {currentReview.intrusion_alert}
                </p>
              )}
              <div className="flex gap-1 mt-2">
                {reviewChallenges.map((_, i) => (
                  <div
                    key={i}
                    className="h-1.5 flex-1 rounded-full"
                    style={{
                      background: i < game.reviewIndex ? 'var(--success)' :
                        i === game.reviewIndex ? 'var(--magenta)' : '#ffffff15',
                    }}
                  />
                ))}
              </div>
            </div>

            {currentReview && (
              <MissionBrief challenge={currentReview} />
            )}
          </>
        )}

        {/* ── Daily Cap Message ── */}
        {isDailyCap && isPlaying && (
          <div className="panel p-4 text-center">
            <div
              className="glow-cyan text-sm mb-3"
              style={{ fontFamily: 'var(--font-hud)', letterSpacing: '0.1em' }}
            >
              TAGESLIMIT ERREICHT
            </div>
            <p className="text-xs mb-2" style={{ color: 'var(--text-dim)' }}>
              Du hast heute {player?.daily_cap || 5} Challenges abgeschlossen.
              Komm morgen wieder für neue Missionen!
            </p>
            <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
              Tipp: Dein Fortschritt wird gespeichert. Jeder Tag zählt für deinen Streak!
            </p>
            <div className="mt-3">
              <span
                className="glow-success text-lg"
                style={{ fontFamily: 'var(--font-hud)' }}
              >
                🔥 {player?.streak || 0} Tage Streak
              </span>
            </div>
          </div>
        )}

        {/* Challenge progress bar — normal mode */}
        {!isRecovery && !isReviewsOnly && !isDailyCap && isPlaying && challengeCount > 1 && (
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

        {/* Mission Brief — normal mode */}
        {!isRecovery && !isReviewsOnly && !isDailyCap && isPlaying && currentChallenge && (
          <MissionBrief challenge={currentChallenge} />
        )}

        {/* Intrusion Alert banner before a review in normal mode */}
        {!isRecovery && !isReviewsOnly && !isDailyCap && isPlaying && currentReview && reviewChallenges.length > 0 && (
          <div className="panel p-2 text-center">
            <span
              className="glow-magenta text-xs"
              style={{ fontFamily: 'var(--font-hud)', letterSpacing: '0.05em' }}
            >
              {reviewChallenges.length} Review{reviewChallenges.length > 1 ? 's' : ''} ausstehend
            </span>
          </div>
        )}

        {/* ECHO Dialogue (hint / success / error feedback) */}
        {isPlaying && !isDailyCap && echoMsg && (
          <Dialogue message={echoMsg} type={echoType} />
        )}

        {/* Terminal (Editor + Output) */}
        {isPlaying && !isDailyCap && activeChallenge && (
          <Terminal
            starterCode={activeChallenge?.starter_code || ''}
            output={output}
            submitResult={submitResult}
            loading={loading}
            onRun={runCode}
            onSubmit={(code) => activeSubmit(code)}
            editorRef={editorRef}
          />
        )}

        {/* Hint button — normal mode only */}
        {!isRecovery && !isReviewsOnly && isPlaying && currentChallenge && !submitResult?.success && (
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
      {isPlaying && !isDailyCap && activeChallenge && (
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
