'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, SkipForward, RotateCcw, Volume2, VolumeX, X, CheckCircle, AlertTriangle, ShieldCheck, Check } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Exercise } from '@/data/rehabProtocols';

interface WorkoutPlayerProps {
  exercises: Exercise[];
  initialExerciseIndex?: number;
  onClose: () => void;
  onFinishedWorkout?: () => void;
}

type WorkoutState = 'PREPARE' | 'HOLD' | 'REST' | 'SET_REST' | 'FINISHED';

export default function WorkoutPlayer({
  exercises,
  initialExerciseIndex = 0,
  onClose,
  onFinishedWorkout,
}: WorkoutPlayerProps) {
  const [exerciseIndex, setExerciseIndex] = useState(initialExerciseIndex);
  const currentExercise = exercises[exerciseIndex] || exercises[0];

  const [currentSet, setCurrentSet] = useState(1);
  const [currentRep, setCurrentRep] = useState(1);
  const [workoutState, setWorkoutState] = useState<WorkoutState>('PREPARE');
  const [timeLeft, setTimeLeft] = useState(5); // 5s initial prep
  const [isActive, setIsActive] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Audio Context Ref
  const audioCtxRef = useRef<AudioContext | null>(null);
  const wakeLockRef = useRef<any>(null);

  // Initialize Web Audio
  const playBeep = useCallback((freq = 587.33, duration = 0.12, type: OscillatorType = 'sine') => {
    if (isMuted || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Audio not permitted or failed
    }
  }, [isMuted]);

  // Voice Prompt using Web Speech API
  const speakVoice = useCallback((text: string) => {
    if (isMuted || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'vi-VN';
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch {
      // Speech failed silently
    }
  }, [isMuted]);

  // Wake Lock Setup
  useEffect(() => {
    let lock: any = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          lock = await (navigator as any).wakeLock.request('screen');
          wakeLockRef.current = lock;
        }
      } catch {
        // Wake lock not granted or supported
      }
    };

    requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !wakeLockRef.current) {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // When changing exercise or initial load
  useEffect(() => {
    setCurrentSet(1);
    setCurrentRep(1);
    setWorkoutState('PREPARE');
    setTimeLeft(5);
    setIsActive(true);
    speakVoice(`Chuẩn bị bài: ${currentExercise.vietnameseName}`);
  }, [exerciseIndex, currentExercise.vietnameseName, speakVoice]);

  // Trigger fanfare on finish
  useEffect(() => {
    if (workoutState === 'FINISHED') {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
      playBeep(880, 0.4);
      speakVoice("Xuất sắc! Bạn đã hoàn thành toàn bộ bài tập!");
    }
  }, [workoutState, playBeep, speakVoice]);

  // Interval timer tick
  useEffect(() => {
    if (!isActive || workoutState === 'FINISHED') return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Transition state logic
          handleTransition();
          return 0;
        }

        // Countdown beeps for last 3 seconds
        if (prev <= 4 && prev > 1) {
          playBeep(440, 0.08);
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive, workoutState, currentRep, currentSet, currentExercise]);

  const handleTransition = () => {
    if (workoutState === 'PREPARE') {
      // Transition from PREPARE to HOLD
      setWorkoutState('HOLD');
      setTimeLeft(currentExercise.holdSec);
      playBeep(880, 0.2);
      speakVoice("Bắt đầu gồng giữ!");
    } else if (workoutState === 'HOLD') {
      // Transition from HOLD to REST (or next rep/set/exercise)
      if (currentRep < currentExercise.targetReps) {
        setWorkoutState('REST');
        setTimeLeft(currentExercise.restSec);
        playBeep(523.25, 0.15);
        speakVoice("Nghỉ");
      } else {
        // Completed all reps for current set
        if (currentSet < currentExercise.targetSets) {
          setWorkoutState('SET_REST');
          const setRestTime = Math.max(15, currentExercise.restSec * 2);
          setTimeLeft(setRestTime);
          playBeep(659.25, 0.25);
          speakVoice(`Hoàn thành hiệp ${currentSet}. Nghỉ giữa hiệp!`);
        } else {
          // Completed all sets for this exercise
          if (exerciseIndex < exercises.length - 1) {
            setExerciseIndex((idx) => idx + 1);
          } else {
            setWorkoutState('FINISHED');
            setIsActive(false);
          }
        }
      }
    } else if (workoutState === 'REST') {
      // After rep rest, move to next rep
      setCurrentRep((r) => r + 1);
      setWorkoutState('HOLD');
      setTimeLeft(currentExercise.holdSec);
      playBeep(880, 0.2);
      speakVoice(`Lần ${currentRep + 1}, gồng giữ!`);
    } else if (workoutState === 'SET_REST') {
      // After set rest, move to next set
      setCurrentSet((s) => s + 1);
      setCurrentRep(1);
      setWorkoutState('HOLD');
      setTimeLeft(currentExercise.holdSec);
      playBeep(880, 0.2);
      speakVoice(`Bắt đầu hiệp ${currentSet + 1}!`);
    }
  };

  const handleSkipRep = () => {
    handleTransition();
  };

  const handleSkipExercise = () => {
    if (exerciseIndex < exercises.length - 1) {
      setExerciseIndex((idx) => idx + 1);
    } else {
      setWorkoutState('FINISHED');
      setIsActive(false);
    }
  };

  const handlePrevExercise = () => {
    if (exerciseIndex > 0) {
      setExerciseIndex((idx) => idx - 1);
    } else {
      setCurrentSet(1);
      setCurrentRep(1);
      setWorkoutState('PREPARE');
      setTimeLeft(5);
    }
  };

  const handleResetCurrent = () => {
    setCurrentSet(1);
    setCurrentRep(1);
    setWorkoutState('PREPARE');
    setTimeLeft(5);
    setIsActive(true);
  };

  // UI calculations
  const totalPhaseDuration =
    workoutState === 'PREPARE'
      ? 5
      : workoutState === 'HOLD'
      ? currentExercise.holdSec
      : workoutState === 'REST'
      ? currentExercise.restSec
      : Math.max(15, currentExercise.restSec * 2);

  const progressPercent = totalPhaseDuration > 0 ? ((totalPhaseDuration - timeLeft) / totalPhaseDuration) * 100 : 0;

  // Status color badge
  const getStatusBadge = () => {
    switch (workoutState) {
      case 'PREPARE':
        return { text: 'CHUẨN BỊ', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40' };
      case 'HOLD':
        return { text: 'GIỮ CƠ / TẬP TRUNG', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse' };
      case 'REST':
        return { text: 'NGHỈ NGẮN', color: 'bg-sky-500/20 text-sky-300 border-sky-500/40' };
      case 'SET_REST':
        return { text: 'NGHỈ GIỮA HIỆP', color: 'bg-purple-500/20 text-purple-300 border-purple-500/40' };
      case 'FINISHED':
        return { text: 'HOÀN THÀNH', color: 'bg-emerald-600 text-white border-emerald-400' };
    }
  };

  const badge = getStatusBadge();

  return (
    <div className="fixed sm:absolute inset-0 z-50 bg-slate-950 text-slate-100 flex flex-col justify-between overflow-y-auto">
      {/* Top Bar */}
      <div className="p-4 flex items-center justify-between border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (workoutState === 'FINISHED') {
                if (onFinishedWorkout) onFinishedWorkout();
                onClose();
              } else {
                setShowExitConfirm(true);
              }
            }}
            aria-label="Đóng bài tập"
            className="p-2 -ml-1 text-slate-400 hover:text-white rounded-xl active:bg-slate-800 transition"
          >
            <X className="w-6 h-6" />
          </button>
          <div>
            <div className="text-xs font-medium text-emerald-400 uppercase tracking-wider">
              Bài {exerciseIndex + 1}/{exercises.length}
            </div>
            <h1 className="text-sm font-semibold text-white line-clamp-1">
              {currentExercise.vietnameseName}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMuted(!isMuted)}
            aria-label={isMuted ? "Bật âm thanh" : "Tắt âm thanh"}
            className={`p-2.5 rounded-xl border transition ${
              isMuted
                ? 'border-red-500/40 text-red-400 bg-red-500/10'
                : 'border-slate-700 text-slate-300 bg-slate-800'
            }`}
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5 text-emerald-400" />}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 max-w-lg mx-auto w-full text-center">
        {workoutState !== 'FINISHED' ? (
          <>
            {/* Status Pill */}
            <div className={`px-4 py-1.5 rounded-full border text-xs font-bold tracking-wider mb-6 ${badge.color}`}>
              {badge.text}
            </div>

            {/* Circular Timer Display */}
            <div className="relative w-64 h-64 flex items-center justify-center my-2">
              <svg className="w-full h-full -rotate-90 transform">
                {/* Background Ring */}
                <circle
                  cx="128"
                  cy="128"
                  r="108"
                  className="text-slate-800"
                  strokeWidth="14"
                  stroke="currentColor"
                  fill="transparent"
                />
                {/* Progress Ring */}
                <circle
                  cx="128"
                  cy="128"
                  r="108"
                  className={`transition-all duration-300 ease-linear ${
                    workoutState === 'HOLD'
                      ? 'text-emerald-500'
                      : workoutState === 'PREPARE'
                      ? 'text-amber-500'
                      : 'text-sky-500'
                  }`}
                  strokeWidth="14"
                  strokeDasharray={2 * Math.PI * 108}
                  strokeDashoffset={2 * Math.PI * 108 * (1 - progressPercent / 100)}
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="transparent"
                />
              </svg>

              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-6xl font-black tabular-nums tracking-tight text-white drop-shadow">
                  {timeLeft}
                </span>
                <span className="text-xs uppercase font-semibold text-slate-400 mt-1">
                  giây
                </span>
              </div>
            </div>

            {/* Set & Rep Indicators */}
            <div className="grid grid-cols-2 gap-3 w-full max-w-xs mt-6 mb-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3">
                <div className="text-[11px] text-slate-400 uppercase font-semibold">Hiệp tập (Set)</div>
                <div className="text-2xl font-black text-white">
                  {currentSet} <span className="text-slate-500 text-base font-normal">/ {currentExercise.targetSets}</span>
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3">
                <div className="text-[11px] text-slate-400 uppercase font-semibold">Lần lặp (Rep)</div>
                <div className="text-2xl font-black text-emerald-400">
                  {currentRep} <span className="text-slate-500 text-base font-normal">/ {currentExercise.targetReps}</span>
                </div>
              </div>
            </div>

            {/* Safety Reminder Banner */}
            {currentExercise.safetyWarning && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-start gap-2 text-left w-full max-w-sm mb-3">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-200/90 leading-relaxed font-medium">
                  {currentExercise.safetyWarning}
                </p>
              </div>
            )}

            {/* Instructions preview */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3.5 text-left w-full max-w-sm">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 mb-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Hướng dẫn kỹ thuật:
              </div>
              <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">
                {currentExercise.instructions[0]}
              </p>
            </div>
          </>
        ) : (
          /* Finished Screen */
          <div className="p-6 bg-slate-900/80 border border-slate-800 rounded-3xl max-w-sm w-full text-center my-auto animate-fade-in">
            <div className="w-20 h-20 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/30">
              <CheckCircle className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Hoàn thành buổi tập!</h2>
            <p className="text-sm text-slate-300 mb-6 leading-relaxed">
              Bạn đã kiên trì thực hiện đầy đủ các bài tập phục hồi hôm nay. Khớp gối cần được nghỉ ngơi và chườm đá lạnh.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => {
                  if (onFinishedWorkout) onFinishedWorkout();
                  onClose();
                }}
                className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold rounded-xl transition shadow-lg shadow-emerald-900/40"
              >
                Lưu và Quay về Bảng tin
              </button>
              <button
                onClick={handleResetCurrent}
                className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-sm transition"
              >
                Tập lại bài này
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Controls Bar */}
      {workoutState !== 'FINISHED' && (
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 backdrop-blur sticky bottom-0 z-20">
          <div className="max-w-md mx-auto flex items-center justify-between gap-4">
            <button
              onClick={handlePrevExercise}
              disabled={exerciseIndex === 0}
              aria-label="Bài trước"
              className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 disabled:opacity-30 disabled:pointer-events-none text-slate-200 transition"
            >
              <RotateCcw className="w-5 h-5" />
            </button>

            <button
              onClick={() => setIsActive(!isActive)}
              aria-label={isActive ? "Tạm dừng" : "Tiếp tục"}
              className={`flex-1 py-3.5 px-6 rounded-2xl font-bold flex items-center justify-center gap-2 transition active:scale-95 shadow-md ${
                isActive
                  ? 'bg-amber-600 hover:bg-amber-500 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {isActive ? (
                <>
                  <Pause className="w-5 h-5 fill-current" />
                  <span>Tạm dừng</span>
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 fill-current" />
                  <span>Tiếp tục</span>
                </>
              )}
            </button>

            <button
              onClick={handleSkipRep}
              aria-label="Bỏ qua lần này"
              title="Bỏ qua lần gập này"
              className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 transition"
            >
              <SkipForward className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
      {/* Exit Confirmation Dialog */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 text-center shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <Check className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Bạn đã hoàn thành bài tập?</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Nếu bạn đã tự hoàn thành các động tác, hãy chọn <strong>Lưu kết quả</strong> để ghi nhận buổi tập hôm nay vào hồ sơ phục hồi.
              </p>
            </div>
            <div className="space-y-2 pt-2">
              <button
                onClick={() => {
                  setShowExitConfirm(false);
                  if (onFinishedWorkout) onFinishedWorkout();
                  onClose();
                }}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 transition"
              >
                <Check className="w-4 h-4" />
                Đã tập xong • Lưu kết quả
              </button>
              <button
                onClick={() => {
                  setShowExitConfirm(false);
                  onClose();
                }}
                className="w-full py-2.5 px-4 bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white font-medium rounded-xl text-xs transition"
              >
                Thoát không lưu
              </button>
              <button
                onClick={() => setShowExitConfirm(false)}
                className="w-full py-2 text-slate-500 hover:text-slate-300 text-xs transition"
              >
                Quay lại tiếp tục tập
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
