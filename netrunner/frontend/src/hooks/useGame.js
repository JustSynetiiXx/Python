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
  const editorRef = useRef(null);

  const currentChallenge = mission?.challenges?.[challengeIndex] || null;

  // Load session on mount
  const loadSession = useCallback(async () => {
    try {
      const session = await api.getSession();
      setPlayer(session.player);
      if (session.current_mission) {
        setMission(session.current_mission);
        // Find first incomplete challenge
        const challenges = session.current_mission.challenges || [];
        const idx = challenges.findIndex(c => !c.progress?.completed);
        setChallengeIndex(idx >= 0 ? idx : 0);
      }
    } catch (e) {
      console.error('Session load failed:', e);
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn()) loadSession();
  }, [loadSession]);

  // Run code (no validation)
  const runCode = useCallback(async (code) => {
    setLoading(true);
    setOutput(null);
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
    if (!currentChallenge) return;
    setLoading(true);
    setOutput(null);
    setSubmitResult(null);
    try {
      const result = await api.submit(currentChallenge.id, code);
      setOutput({ output: result.output || '', error: result.error || '', success: result.success });
      setSubmitResult(result);

      if (result.success) {
        // XP animation
        setXpAnim({ xp: result.xp_gained, streak: result.streak_bonus });
        setTimeout(() => setXpAnim(null), 1500);

        // Update player
        const updatedPlayer = await api.getPlayer();
        setPlayer(updatedPlayer);

        // Move to next challenge or next mission
        if (result.mission_complete && result.next_mission_id) {
          setTimeout(async () => {
            const nextMission = await api.getMission(result.next_mission_id);
            setMission(nextMission);
            setChallengeIndex(0);
            setOutput(null);
            setSubmitResult(null);
          }, 2000);
        } else if (!result.mission_complete) {
          setTimeout(() => {
            const nextIdx = (mission?.challenges || []).findIndex(
              (c, i) => i > challengeIndex && !c.progress?.completed
            );
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
    sidebarOpen,
    sidebarView,
    editorRef,
    loadSession,
    runCode,
    submitCode,
    getHint,
    openSidebar,
    closeSidebar,
    setPlayer,
  };
}
