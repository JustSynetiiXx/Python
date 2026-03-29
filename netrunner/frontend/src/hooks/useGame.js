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

  const currentChallenge = mission?.challenges?.[challengeIndex] || null;

  // Load session on mount
  const loadSession = useCallback(async () => {
    try {
      const session = await api.getSession();
      setPlayer(session.player);
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
          // Move to next incomplete challenge in this mission
          setTimeout(() => {
            const challenges = mission?.challenges || [];
            let nextIdx = -1;
            for (let i = challengeIndex + 1; i < challenges.length; i++) {
              if (!challenges[i].progress?.completed) {
                nextIdx = i;
                break;
              }
            }
            if (nextIdx >= 0) {
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
      }

      return result;
    } catch (e) {
      setOutput({ output: '', error: e.message, success: false });
    } finally {
      setLoading(false);
    }
  }, [currentChallenge, mission, challengeIndex]);

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
  };
}
