import { useState, useCallback, useEffect, useRef } from 'react';
import { api, isLoggedIn } from '../utils/api';

export default function useGame() {
  const [player, setPlayer] = useState(null);
  const [mission, setMission] = useState(null);
  const [challengeIndex, setChallengeIndex] = useState(0);
  const [output, setOutput] = useState(null);
  const [submitResult, setSubmitResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarView, setSidebarView] = useState('character');
  const [xpAnim, setXpAnim] = useState(null);
  const [storyPhase, setStoryPhase] = useState('intro'); // 'intro' | 'play' | 'complete'
  const editorRef = useRef(null);

  // Recovery & review state
  const [sessionMode, setSessionMode] = useState('normal'); // 'normal' | 'recovery' | 'reviews_only' | 'daily_cap' | 'inline_review'
  const [recoveryChallenges, setRecoveryChallenges] = useState([]);
  const [recoveryIndex, setRecoveryIndex] = useState(0);
  const [reviewChallenges, setReviewChallenges] = useState([]);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [systemCrash, setSystemCrash] = useState(false);
  const [interleaveReviews, setInterleaveReviews] = useState(false);
  const [reviewAttempts, setReviewAttempts] = useState(0);
  const [levelUp, setLevelUp] = useState(null); // { level, title } or null

  // Saved state to restore after inline review
  const pendingNextRef = useRef(null); // { challengeIndex } to restore after review

  const currentChallenge = mission?.challenges?.[challengeIndex] || null;
  const currentRecovery = recoveryChallenges[recoveryIndex] || null;
  const currentReview = reviewChallenges[reviewIndex] || null;

  // Load session on mount
  const loadSession = useCallback(async () => {
    try {
      const session = await api.getSession();
      setPlayer(session.player);
      setSessionMode(session.mode);
      setInterleaveReviews(session.interleave_reviews || false);

      if (session.mode === 'recovery') {
        setRecoveryChallenges(session.recovery_challenges || []);
        setRecoveryIndex(0);
        setMission(null);
        setStoryPhase('play');
        return;
      }

      // Store review challenges
      if (session.review_challenges?.length > 0) {
        setReviewChallenges(session.review_challenges);
        setReviewIndex(0);
      } else {
        setReviewChallenges([]);
      }

      if (session.mode === 'reviews_only') {
        setMission(null);
        setStoryPhase('play');
        return;
      }

      if (session.mode === 'daily_cap') {
        setMission(null);
        setStoryPhase('play');
        return;
      }

      // Normal mode
      if (session.current_mission) {
        setMission(session.current_mission);
        const challenges = session.current_mission.challenges || [];
        const idx = challenges.findIndex(c => !c.progress?.completed);
        setChallengeIndex(idx >= 0 ? idx : 0);
        setStoryPhase('intro');
      }
    } catch (e) {
      console.error('Session load failed:', e);
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn()) loadSession();
  }, [loadSession]);

  // Run code (no validation, just execute)
  const runCode = useCallback(async (code) => {
    if (!code.trim()) return;
    setLoading(true);
    setSubmitResult(null);
    try {
      const result = await api.runCode(code);
      setOutput(result);
      return result;
    } catch (e) {
      setOutput({ output: '', error: e.message, success: false });
    } finally {
      setLoading(false);
    }
  }, []);

  // Helper: start an inline review (inject between normal challenges)
  const startInlineReview = useCallback((nextChallengeIndex) => {
    pendingNextRef.current = { challengeIndex: nextChallengeIndex };
    setSessionMode('inline_review');
    setReviewAttempts(0);
    setOutput(null);
    setSubmitResult(null);
  }, []);

  // Submit code for challenge validation
  const submitCode = useCallback(async (code) => {
    if (!currentChallenge || !code.trim()) return;
    setLoading(true);
    setSubmitResult(null);
    try {
      const result = await api.submit(currentChallenge.id, code);
      setOutput({
        output: result.output || '',
        error: result.error || '',
        success: result.success,
      });
      setSubmitResult(result);

      if (result.success) {
        // XP animation
        setXpAnim({ xp: result.xp_gained, streak: result.streak_bonus });
        setTimeout(() => setXpAnim(null), 1500);

        // Level-up overlay
        if (result.level_up) {
          setLevelUp({ level: result.new_level, title: result.new_title });
          setTimeout(() => setLevelUp(null), 2800);
        }

        // Update player
        const updatedPlayer = await api.getPlayer();
        setPlayer(updatedPlayer);

        // Advance after delay
        if (result.mission_complete) {
          setStoryPhase('complete');
          if (result.next_mission_id) {
            setTimeout(async () => {
              try {
                const nextMission = await api.getMission(result.next_mission_id);
                setMission(nextMission);
                setChallengeIndex(0);
                setOutput(null);
                setSubmitResult(null);
                setStoryPhase('intro');
              } catch (e) {
                console.error('Failed to load next mission:', e);
              }
            }, 3000);
          }
        } else {
          // Find next incomplete challenge
          const challenges = mission?.challenges || [];
          let nextIdx = -1;
          for (let i = challengeIndex + 1; i < challenges.length; i++) {
            if (!challenges[i].progress?.completed) {
              nextIdx = i;
              break;
            }
          }

          setTimeout(() => {
            // If reviews should be interleaved and we have one available, inject it
            if (interleaveReviews && currentReview && nextIdx >= 0) {
              startInlineReview(nextIdx);
            } else if (nextIdx >= 0) {
              setChallengeIndex(nextIdx);
              setOutput(null);
              setSubmitResult(null);
            }
          }, 2000);
        }
      } else {
        // Update HP if lost
        if (result.hp !== undefined) {
          setPlayer(prev => prev ? { ...prev, hp: result.hp } : prev);
        }
        // System crash -> switch to recovery
        if (result.system_crash) {
          setSystemCrash(true);
          setTimeout(async () => {
            setSystemCrash(false);
            await loadSession(); // Reload session in recovery mode
          }, 3000);
        }
      }

      return result;
    } catch (e) {
      setOutput({ output: '', error: e.message, success: false });
    } finally {
      setLoading(false);
    }
  }, [currentChallenge, mission, challengeIndex, loadSession, interleaveReviews, currentReview, startInlineReview]);

  // Submit recovery challenge
  const submitRecoveryCode = useCallback(async (code) => {
    if (!currentRecovery || !code.trim()) return;
    setLoading(true);
    setSubmitResult(null);
    try {
      const result = await api.submitRecovery(currentRecovery.id, code);
      setOutput({
        output: result.output || '',
        error: result.error || '',
        success: result.success,
      });
      setSubmitResult(result);

      if (result.success) {
        if (result.recovery_complete) {
          // Recovery done — reload normal session
          setTimeout(async () => {
            setOutput(null);
            setSubmitResult(null);
            await loadSession();
          }, 2000);
        } else {
          // Next recovery challenge
          setTimeout(() => {
            setRecoveryIndex(prev => prev + 1);
            setOutput(null);
            setSubmitResult(null);
          }, 1500);
        }
      }

      return result;
    } catch (e) {
      setOutput({ output: '', error: e.message, success: false });
    } finally {
      setLoading(false);
    }
  }, [currentRecovery, loadSession]);

  // Submit review challenge (works for both inline_review and reviews_only modes)
  const submitReviewCode = useCallback(async (code) => {
    if (!currentReview || !code.trim()) return;
    setLoading(true);
    setSubmitResult(null);
    try {
      // Dynamic quality based on attempt count
      const quality = reviewAttempts === 0 ? 5 : reviewAttempts === 1 ? 4 : 3;
      const result = await api.submitReview(currentReview.id, code, quality);
      setOutput({
        output: result.output || '',
        error: result.error || '',
        success: result.success,
      });
      setSubmitResult(result);

      if (result.success) {
        if (result.xp_gained) {
          setXpAnim({ xp: result.xp_gained, streak: 0 });
          setTimeout(() => setXpAnim(null), 1500);
        }

        setTimeout(() => {
          // Advance review index
          const nextReviewIdx = reviewIndex + 1;

          if (sessionMode === 'inline_review') {
            // Inline review done — return to normal mode
            setReviewIndex(nextReviewIdx);
            setReviewAttempts(0);
            setSessionMode('normal');
            setOutput(null);
            setSubmitResult(null);

            // Restore pending challenge index
            if (pendingNextRef.current) {
              setChallengeIndex(pendingNextRef.current.challengeIndex);
              pendingNextRef.current = null;
            }
          } else {
            // Reviews-only mode: advance to next review or reload
            if (nextReviewIdx < reviewChallenges.length) {
              setReviewIndex(nextReviewIdx);
              setReviewAttempts(0);
              setOutput(null);
              setSubmitResult(null);
            } else {
              setOutput(null);
              setSubmitResult(null);
              loadSession();
            }
          }
        }, 1500);
      } else {
        // Track failed attempts for quality degradation
        setReviewAttempts(prev => prev + 1);
      }

      return result;
    } catch (e) {
      setOutput({ output: '', error: e.message, success: false });
    } finally {
      setLoading(false);
    }
  }, [currentReview, reviewIndex, reviewChallenges.length, reviewAttempts, sessionMode, loadSession]);

  // Get hint
  const getHint = useCallback(async () => {
    if (!currentChallenge) return null;
    try {
      return await api.getHint(currentChallenge.id);
    } catch (e) {
      return null;
    }
  }, [currentChallenge]);

  // Story phase transitions
  const finishStoryIntro = useCallback(() => {
    setStoryPhase('play');
  }, []);

  // Sidebar
  const openSidebar = useCallback((view = 'character') => {
    setSidebarView(view);
    setSidebarOpen(true);
  }, []);

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  return {
    player,
    mission,
    currentChallenge,
    challengeIndex,
    output,
    submitResult,
    loading,
    xpAnim,
    storyPhase,
    sidebarOpen,
    sidebarView,
    editorRef,
    loadSession,
    runCode,
    submitCode,
    getHint,
    finishStoryIntro,
    openSidebar,
    closeSidebar,
    setPlayer,
    // Recovery & review
    sessionMode,
    recoveryChallenges,
    recoveryIndex,
    currentRecovery,
    submitRecoveryCode,
    reviewChallenges,
    reviewIndex,
    currentReview,
    submitReviewCode,
    systemCrash,
    interleaveReviews,
    reviewAttempts,
    levelUp,
  };
}
