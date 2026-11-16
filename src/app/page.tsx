'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import {
  Activity,
  AlertOctagon,
  Calendar,
  CheckCircle2,
  Clock,
  Dumbbell,
  Heart,
  HelpCircle,
  Home,
  Info,
  Maximize2,
  Play,
  RotateCcw,
  Pause,
  Settings,
  ShieldAlert,
  Sliders,
  Sparkles,
  TrendingUp,
  User,
  Volume2,
  ChevronRight,
  Flame,
  Award,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  Camera,
  Search,
  Check,
  AlertTriangle,
  ChevronDown
} from 'lucide-react';
import {
  SurgeryType,
  SURGERY_DETAILS,
  REHAB_PHASES,
  getRehabStatus,
  Exercise
} from '@/data/rehabProtocols';
import {
  RecoveryCase,
  Milestone,
  DailyExerciseSession,
  ROMRecord,
  DailyRecoveryLog,
  KnowledgeArticle,
  KNOWLEDGE_ARTICLES
} from '@/data/axvyraDomain';
import { AxvyraStore, getOrCreateDefaultCase } from '@/lib/axvyraStore';
import WorkoutPlayer from '@/components/WorkoutPlayer';
import KneeAngleCamera, { AngleRecord } from '@/components/KneeAngleCamera';
import OnboardingModal, { UserProfile } from '@/components/OnboardingModal';
import SessionFeedbackModal from '@/components/SessionFeedbackModal';

type MainTab = 'home' | 'plan' | 'progress' | 'explore';

export default function AxvyraApp() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<MainTab>('home');

  // Recovery Case State
  const [recoveryCase, setRecoveryCase] = useState<RecoveryCase | null>(null);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);

  // Workout Session State
  const [activeWorkoutExercises, setActiveWorkoutExercises] = useState<Exercise[] | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState<boolean>(false);
  const [feedbackSessionTitle, setFeedbackSessionTitle] = useState<string>('');

  // Ice Timer State (15 min = 900s)
  const [iceSeconds, setIceSeconds] = useState<number>(15 * 60);
  const [isIceRunning, setIsIceRunning] = useState<boolean>(false);

  // Quick Daily Log State
  const [painScore, setPainScore] = useState<number>(3);
  const [swellingLevel, setSwellingLevel] = useState<'none' | 'mild' | 'moderate' | 'severe'>('mild');
  const [dailyNotes, setDailyNotes] = useState<string>('');
  const [logSuccessNotice, setLogSuccessNotice] = useState<boolean>(false);

  // Explore search & category
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedArticle, setSelectedArticle] = useState<KnowledgeArticle | null>(null);

  // Load state on mount
  useEffect(() => {
    setMounted(true);
    let currentCase = AxvyraStore.getRecoveryCase();
    if (!currentCase) {
      currentCase = getOrCreateDefaultCase();
      AxvyraStore.saveRecoveryCase(currentCase);
      setShowOnboarding(true);
    }
    setRecoveryCase(currentCase);
  }, []);

  // Compute live rehab clinical status
  const rehabStatus = useMemo(() => {
    if (!recoveryCase) return getRehabStatus(new Date(), 'ACL_MENISCUS_REPAIR');
    return getRehabStatus(recoveryCase.surgeryDate, recoveryCase.surgeryType);
  }, [recoveryCase]);

  // Ice Timer
  useEffect(() => {
    let interval: any = null;
    if (isIceRunning) {
      interval = setInterval(() => {
        setIceSeconds((prev) => {
          if (prev <= 1) {
            setIsIceRunning(false);
            try {
              const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
              const ctx = new AudioCtx();
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.type = 'triangle';
              osc.frequency.setValueAtTime(600, ctx.currentTime);
              gain.gain.setValueAtTime(0.2, ctx.currentTime);
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.start();
              osc.stop(ctx.currentTime + 1.2);
            } catch {}
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isIceRunning]);

  const resetIceTimer = () => {
    setIsIceRunning(false);
    setIceSeconds(15 * 60);
  };

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Handle Onboarding Completion
  const handleOnboardingComplete = (profile: UserProfile) => {
    const updated = getOrCreateDefaultCase(
      profile.name,
      profile.surgeryDate,
      profile.surgeryType,
      profile.surgeryLeg,
      {
        weightBearing: profile.weightBearingRestriction,
        maxFlexion: profile.maxFlexionRestriction,
      }
    );
    AxvyraStore.saveRecoveryCase(updated);
    setRecoveryCase(updated);
    setShowOnboarding(false);
  };

  // Start Today's Session
  const handleStartTodaySession = (session: DailyExerciseSession) => {
    setActiveSessionId(session.id);
    setFeedbackSessionTitle(session.title);

    // Convert prescription items to Exercise format for player
    const exercisesForPlayer: Exercise[] = session.exercises.map((e) => ({
      id: e.exerciseId,
      name: e.title,
      vietnameseName: e.vietnameseName,
      category: 'activation',
      targetSets: e.targetSets,
      targetReps: e.targetReps,
      holdSec: e.holdSec,
      restSec: e.restSec,
      description: e.instructions[0] || '',
      instructions: e.instructions,
      safetyWarning: e.safetyNote,
      maxFlexionAngle: e.maxFlexionAngle,
    }));

    setActiveWorkoutExercises(exercisesForPlayer);
  };

  // Handle Workout Complete -> open feedback modal
  const handleWorkoutFinished = () => {
    setActiveWorkoutExercises(null);
    setShowFeedbackModal(true);
  };

  // Save Session Feedback
  const handleSaveSessionFeedback = (feedback: {
    rpeScore: number;
    painDuringSession: number;
    notes: string;
  }) => {
    if (!activeSessionId) return;
    const updated = AxvyraStore.completeSession(activeSessionId, feedback);
    if (updated) setRecoveryCase({ ...updated });
    setShowFeedbackModal(false);
    setActiveSessionId(null);
  };

  // Save Quick Recovery Log
  const handleSaveQuickLog = () => {
    const todayStr = new Date().toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    const updated = AxvyraStore.addDailyRecoveryLog({
      date: todayStr,
      painScore,
      swellingLevel,
      iceDone: iceSeconds < 15 * 60,
      functionalConfidence: 8,
      patientNotes: dailyNotes,
    });

    if (updated) setRecoveryCase({ ...updated });
    setLogSuccessNotice(true);
    setTimeout(() => setLogSuccessNotice(false), 3000);
  };

  // ROM Measurement saved from Knee Camera
  const handleROMRecorded = (record: AngleRecord) => {
    const updated = AxvyraStore.addROMRecord({
      flexionAngle: record.flexionAngle,
      extensionAngle: record.internalAngle ? Math.max(0, 180 - record.internalAngle) : 0,
      leg: record.leg,
      isSafe: record.isSafe,
      safeLimit: record.safeLimit,
      source: record.source === 'live' ? 'camera_ai' : 'photo',
    });
    if (updated) setRecoveryCase({ ...updated });
  };

  // Filter explore articles
  const filteredArticles = useMemo(() => {
    return KNOWLEDGE_ARTICLES.filter((art) => {
      const matchCat = selectedCategory === 'all' || art.category === selectedCategory;
      const matchSearch =
        art.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        art.summary.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [searchQuery, selectedCategory]);

  if (!mounted || !recoveryCase) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex items-center justify-center p-4">
        <div className="flex items-center gap-3 text-emerald-600 font-semibold text-sm">
          <Activity className="w-5 h-5 animate-spin" />
          Đang nạp AXVYRA V1...
        </div>
      </div>
    );
  }

  const todaySession = recoveryCase.dailySessions[0] || null;
  const latestROM = recoveryCase.romHistory[0] || null;
  const latestLog = recoveryCase.dailyLogs[0] || null;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col justify-between selection:bg-emerald-500 selection:text-white relative">
      {/* Soft Ambient Background Glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] h-72 bg-gradient-to-b from-sky-100/50 via-emerald-50/40 to-transparent pointer-events-none z-0 blur-3xl" />

      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-slate-100 px-4 py-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="relative w-9 h-9 rounded-2xl overflow-hidden border border-emerald-100 shadow-xs bg-emerald-50 flex items-center justify-center">
              <Image
                src="/images/knee-hero.png"
                alt="AXVYRA Knee"
                fill
                className="object-cover"
                priority
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-slate-900 text-sm tracking-tight">AXVYRA</span>
                <span className="text-[9px] font-black tracking-widest px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 uppercase">
                  V1 • Rehab
                </span>
              </div>
              <div className="text-[11px] text-slate-500 font-medium">
                {recoveryCase.patientName} • Ngày {rehabStatus.currentDay} (Tuần {rehabStatus.currentWeek})
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowOnboarding(true)}
            aria-label="Cài đặt ca phục hồi"
            className="flex items-center gap-1 py-1.5 px-3 rounded-full bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-600 text-xs font-semibold border border-slate-200/80 transition"
          >
            <Settings className="w-3.5 h-3.5 text-emerald-600" />
            <span>Hồ sơ</span>
          </button>
        </div>
      </header>

      {/* Main Tab Content */}
      <main className="flex-1 p-4 space-y-4 pb-24 relative z-10 overflow-y-auto">
        {/* ========================================================================= */}
        {/* TAB 1: HOME — RECOVERY JOURNEY DASHBOARD                                  */}
        {/* ========================================================================= */}
        {activeTab === 'home' && (
          <div className="space-y-4 animate-fade-in">
            {/* Header: Recovery Context & Knee Asset */}
            <div className="relative rounded-[2rem] overflow-hidden bg-gradient-to-br from-emerald-600 to-teal-800 text-white p-5 shadow-lg shadow-emerald-700/20">
              <div className="relative z-10 max-w-[260px]">
                <div className="inline-flex items-center gap-1 text-[10px] text-emerald-200 font-bold uppercase tracking-wider mb-1 bg-white/10 px-2 py-0.5 rounded-full backdrop-blur-xs">
                  <Sparkles className="w-3 h-3" />
                  Hành trình phục hồi
                </div>
                <h1 className="text-xl font-black text-white leading-tight">
                  Từng bước vững chắc,
                  <br />
                  <span className="text-emerald-200">Trở lại mạnh mẽ.</span>
                </h1>
                <p className="text-xs text-emerald-100/90 mt-1 leading-relaxed">
                  {SURGERY_DETAILS[recoveryCase.surgeryType].shortLabel} • Gối {recoveryCase.surgeryLeg === 'left' ? 'Trái' : 'Phải'}
                </p>
              </div>

              {/* Knee illustration asset in header */}
              <div className="absolute -right-6 -bottom-6 w-40 h-40 opacity-30 pointer-events-none rounded-full overflow-hidden">
                <Image
                  src="/images/knee-hero.png"
                  alt="Knee Graphic"
                  fill
                  className="object-cover"
                />
              </div>
            </div>

            {/* Critical Safety Alert Banner if Meniscus Repair */}
            {rehabStatus.isMeniscusRepairStrictLimit && (
              <div className="p-3.5 rounded-3xl bg-rose-50 border border-rose-200 text-xs text-rose-900 shadow-xs flex items-start gap-2.5">
                <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong className="text-rose-950 font-black">QUY TẮC BẢO VỆ SỤN CHÊM:</strong> 6 tuần đầu tuyệt đối KHÔNG gập gối quá 90° và KHÔNG tì chân mổ ({recoveryCase.weightBearingStatus}).
                </div>
              </div>
            )}

            {/* B. Recovery Journey Section (Milestones & Next Milestone) */}
            <div className="bg-white border border-slate-100 rounded-3xl p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Cột mốc phục hồi (Recovery Journey)
                  </h2>
                  <div className="text-sm font-black text-slate-900 mt-0.5">
                    Giai đoạn {rehabStatus.phase.phaseNumber}: {rehabStatus.phase.weeksRange}
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                  Góc an toàn: &le; {recoveryCase.maxSafeFlexion}°
                </span>
              </div>

              {/* Active Milestone Card */}
              {recoveryCase.milestones.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase">
                      Mục tiêu tiếp theo (Next Milestone)
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                      {recoveryCase.milestones[0].status === 'IN_PROGRESS'
                        ? 'Đang thực hiện'
                        : 'Chờ đánh giá'}
                    </span>
                  </div>
                  <h3 className="text-xs font-black text-slate-900">
                    {recoveryCase.milestones[0].title}
                  </h3>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    {recoveryCase.milestones[0].description}
                  </p>
                  <div className="text-[10px] text-slate-400 font-medium pt-1">
                    🎯 Tiêu chuẩn: {recoveryCase.milestones[0].targetCriteria}
                  </div>
                </div>
              )}
            </div>

            {/* C. Today's Exercise Card */}
            {todaySession && (
              <div className="bg-white border border-slate-100 rounded-3xl p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                      <Dumbbell className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-xs font-black text-slate-900">
                        {todaySession.title}
                      </h2>
                      <p className="text-[11px] text-slate-500">
                        {todaySession.exercises.length} bài tập • ~{todaySession.estimatedMinutes} phút
                      </p>
                    </div>
                  </div>

                  {todaySession.completed ? (
                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Đã xong
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                      Chưa tập
                    </span>
                  )}
                </div>

                <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100 text-[11px] text-slate-600">
                  <strong className="text-slate-800">Trọng tâm: </strong>
                  {todaySession.focus}
                </div>

                <button
                  onClick={() => handleStartTodaySession(todaySession)}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold rounded-2xl text-xs transition shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>{todaySession.completed ? 'Tập Lại Buổi Này' : 'Bắt Đầu Buổi Tập Hôm Nay'}</span>
                </button>
              </div>
            )}

            {/* D. Recent Progress Summary */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-white border border-slate-100 rounded-3xl p-3.5 shadow-xs">
                <div className="text-[10px] text-slate-400 font-semibold uppercase">ROM Gối mới nhất</div>
                <div className="text-lg font-black text-emerald-600 mt-1">
                  {latestROM ? `${latestROM.flexionAngle}°` : 'Chưa đo'}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Giới hạn: &le; {recoveryCase.maxSafeFlexion}°
                </div>
              </div>

              <div className="bg-white border border-slate-100 rounded-3xl p-3.5 shadow-xs">
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Điểm đau gần nhất</div>
                <div className="text-lg font-black text-slate-900 mt-1">
                  {latestLog ? `${latestLog.painScore}/10` : '3/10'}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Sưng: {latestLog ? latestLog.swellingLevel : 'Nhẹ'}
                </div>
              </div>
            </div>

            {/* 15-Minute Ice Timer Card */}
            <div className="bg-white border border-slate-100 rounded-3xl p-4 shadow-xs">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 uppercase">Chườm Đá Lạnh (15 Phút)</h3>
                    <p className="text-[10px] text-slate-400">Giảm sưng đau sau tập</p>
                  </div>
                </div>

                <div className="text-2xl font-black tabular-nums text-sky-600 font-mono">
                  {formatTimer(iceSeconds)}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsIceRunning(!isIceRunning)}
                  className={`flex-1 py-2.5 px-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                    isIceRunning
                      ? 'bg-amber-500 hover:bg-amber-600 text-white'
                      : 'bg-sky-600 hover:bg-sky-500 text-white shadow-xs'
                  }`}
                >
                  {isIceRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  {isIceRunning ? 'Tạm Dừng' : 'Bắt Đầu Chườm Đá'}
                </button>
                <button
                  onClick={resetIceTimer}
                  className="py-2.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl text-xs font-semibold border border-slate-200 transition"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* E. Quick Recovery Log Button */}
            <div className="bg-white border border-slate-100 rounded-3xl p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Heart className="w-4 h-4 text-rose-500" />
                  <span className="text-xs font-black text-slate-900">Ghi Nhật Ký Triệu Chứng Nhanh</span>
                </div>
                <span className="text-[10px] font-bold text-slate-400">Hôm nay</span>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[11px] text-slate-600">Mức độ đau:</span>
                  <span className="font-bold text-slate-900">{painScore}/10 VAS</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={painScore}
                  onChange={(e) => setPainScore(parseInt(e.target.value, 10))}
                  className="w-full accent-emerald-600 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
                />
              </div>

              {logSuccessNotice && (
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-800 text-[11px] font-bold flex items-center gap-1.5 border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Đã ghi nhật ký hôm nay thành công!
                </div>
              )}

              <button
                onClick={handleSaveQuickLog}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl text-xs transition"
              >
                Lưu Nhật Ký Triệu Chứng
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: PLAN — KẾ HOẠCH BÀI TẬP & CHI TIẾT                                */}
        {/* ========================================================================= */}
        {activeTab === 'plan' && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                Kế hoạch phục hồi • Phase {rehabStatus.phase.phaseNumber}
              </span>
              <h1 className="text-xl font-black text-slate-900 mt-0.5">
                Chương Trình Tập Luyện
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Chỉ thực hiện các bài tập được chỉ định trong kế hoạch an toàn.
              </p>
            </div>

            {/* Week Selector / Calendar strip */}
            <div className="bg-white border border-slate-100 rounded-3xl p-3 shadow-xs flex items-center justify-between text-center">
              {[1, 2, 3, 4, 5, 6].map((dayNum) => (
                <div
                  key={dayNum}
                  className={`p-2 rounded-2xl flex flex-col items-center flex-1 cursor-pointer transition ${
                    dayNum === 1
                      ? 'bg-emerald-600 text-white font-bold shadow-xs'
                      : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-[9px] uppercase tracking-wider">T.{dayNum + 1}</span>
                  <span className="text-xs font-black mt-0.5">{dayNum}</span>
                </div>
              ))}
            </div>

            {/* Today Session Card */}
            {todaySession && (
              <div className="bg-white border border-slate-100 rounded-3xl p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-emerald-600 uppercase">
                      Buổi tập được chỉ định
                    </span>
                    <h2 className="text-sm font-black text-slate-900 mt-0.5">
                      {todaySession.title}
                    </h2>
                  </div>
                  <button
                    onClick={() => handleStartTodaySession(todaySession)}
                    className="py-2 px-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl text-xs flex items-center gap-1.5 shadow-xs transition"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Tập ngay</span>
                  </button>
                </div>

                <div className="divide-y divide-slate-100">
                  {todaySession.exercises.map((item, idx) => (
                    <div key={item.exerciseId} className="py-3 first:pt-1 last:pb-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold flex items-center justify-center border border-emerald-200">
                            {idx + 1}
                          </span>
                          <h3 className="text-xs font-bold text-slate-900">
                            {item.vietnameseName}
                          </h3>
                        </div>
                        <span className="text-[10px] font-semibold text-slate-500">
                          {item.targetSets} hiệp × {item.targetReps} lần
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 pl-7 leading-relaxed">
                        {item.instructions[0]}
                      </p>
                      {item.safetyNote && (
                        <div className="mt-1 pl-7 text-[10px] text-rose-600 font-semibold">
                          ⚠️ {item.safetyNote}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: PROGRESS — TIẾN ĐỘ, ROM & LỊCH SỬ                                */}
        {/* ========================================================================= */}
        {activeTab === 'progress' && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                Theo dõi phục hồi • Persisted Data
              </span>
              <h1 className="text-xl font-black text-slate-900 mt-0.5">
                Tiến Độ & Biên Độ Khớp Gối
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Dữ liệu đo đạc thực tế, không có chỉ số giả định.
              </p>
            </div>

            {/* Launch Camera ROM Measurement */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-4 shadow-md space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                    <Camera className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-xs font-bold text-white uppercase">Đo Góc Gối Bằng Camera AI</h2>
                    <p className="text-[10px] text-slate-400">MediaPipe Vision • Hông - Gối - Cổ chân</p>
                  </div>
                </div>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Live Vision
                </span>
              </div>

              <KneeAngleCamera
                safeMaxFlexion={recoveryCase.maxSafeFlexion}
                selectedLeg={recoveryCase.surgeryLeg}
                onRecordSaved={handleROMRecorded}
              />
            </div>

            {/* Milestones History */}
            <div className="bg-white border border-slate-100 rounded-3xl p-4 shadow-xs space-y-3">
              <h2 className="text-xs font-black text-slate-900 uppercase">
                Tiến Trình Cột Mốc Lâm Sàng
              </h2>
              <div className="space-y-2">
                {recoveryCase.milestones.map((m) => (
                  <div
                    key={m.id}
                    className="p-3 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-900">{m.title}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{m.targetCriteria}</div>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-lg shrink-0 ${
                        m.status === 'CONFIRMED'
                          ? 'bg-emerald-100 text-emerald-700'
                          : m.status === 'IN_PROGRESS'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {m.status === 'CONFIRMED'
                        ? 'Đã duyệt'
                        : m.status === 'IN_PROGRESS'
                        ? 'Đang tập'
                        : 'Chưa bắt đầu'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* ROM History List */}
            <div className="bg-white border border-slate-100 rounded-3xl p-4 shadow-xs space-y-3">
              <h2 className="text-xs font-black text-slate-900 uppercase">
                Lịch Sử Đo Góc ROM ({recoveryCase.romHistory.length})
              </h2>
              {recoveryCase.romHistory.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs">
                  Chưa có lần đo góc gối nào được ghi lại.
                </div>
              ) : (
                <div className="space-y-2">
                  {recoveryCase.romHistory.slice(0, 5).map((rom) => (
                    <div
                      key={rom.id}
                      className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-slate-900">Gập: {rom.flexionAngle}°</span>
                        <span className="text-[10px] text-slate-400 ml-2">
                          {new Date(rom.recordedAt).toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          rom.isSafe ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {rom.isSafe ? 'Đạt an toàn' : 'Vượt góc'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: EXPLORE — THƯ VIỆN KIẾN THỨC & AN TOÀN                             */}
        {/* ========================================================================= */}
        {activeTab === 'explore' && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                Thư viện kiến thức • Y khoa thường thức
              </span>
              <h1 className="text-xl font-black text-slate-900 mt-0.5">
                Cẩm Nang Phục Hồi Khớp Gối
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Kiến thức chính xác từ chuyên gia phục hồi chức năng và chấn thương chỉnh hình.
              </p>
            </div>

            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm bài viết, triệu chứng, lưu ý..."
                className="w-full bg-white border border-slate-200 focus:border-emerald-500 rounded-2xl p-3 pl-10 text-xs font-medium text-slate-900 placeholder-slate-400 outline-none shadow-xs"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>

            {/* Categories Strip */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              {[
                { id: 'all', label: 'Tất cả' },
                { id: 'safety', label: 'An toàn & R.I.C.E' },
                { id: 'protocol', label: 'Phác đồ ACL' },
                { id: 'nutrition', label: 'Dinh dưỡng' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`py-1.5 px-3 rounded-full font-bold whitespace-nowrap transition ${
                    selectedCategory === cat.id
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Article Modal Preview if selected */}
            {selectedArticle ? (
              <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-md space-y-3">
                <button
                  onClick={() => setSelectedArticle(null)}
                  className="text-xs text-emerald-700 font-bold flex items-center gap-1 hover:underline mb-1"
                >
                  &larr; Quay lại danh sách
                </button>
                <h2 className="text-base font-black text-slate-900">
                  {selectedArticle.title}
                </h2>
                <div className="text-[11px] text-slate-400">
                  {selectedArticle.readTime}
                </div>

                {selectedArticle.importantNotice && (
                  <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900 font-bold">
                    ⚠️ {selectedArticle.importantNotice}
                  </div>
                )}

                <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
                  {selectedArticle.content.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </div>
            ) : (
              /* Articles List */
              <div className="space-y-2.5">
                {filteredArticles.map((art) => (
                  <div
                    key={art.id}
                    onClick={() => setSelectedArticle(art)}
                    className="p-4 bg-white hover:bg-slate-50/80 border border-slate-100 rounded-3xl cursor-pointer transition shadow-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        {art.category === 'safety'
                          ? 'An toàn'
                          : art.category === 'protocol'
                          ? 'Phác đồ'
                          : 'Dinh dưỡng'}
                      </span>
                      <span className="text-[10px] text-slate-400">{art.readTime}</span>
                    </div>
                    <h3 className="text-xs font-black text-slate-900 leading-snug">
                      {art.title}
                    </h3>
                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                      {art.summary}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Full-Screen Workout Player Modal */}
      {activeWorkoutExercises && (
        <WorkoutPlayer
          exercises={activeWorkoutExercises}
          onClose={() => setActiveWorkoutExercises(null)}
          onFinishedWorkout={handleWorkoutFinished}
        />
      )}

      {/* Post-Session Feedback Modal */}
      <SessionFeedbackModal
        isOpen={showFeedbackModal}
        sessionTitle={feedbackSessionTitle}
        onSaveFeedback={handleSaveSessionFeedback}
        onClose={() => setShowFeedbackModal(false)}
      />

      {/* Clinical Onboarding Modal */}
      <OnboardingModal
        initialProfile={{
          name: recoveryCase.patientName,
          surgeryDate: recoveryCase.surgeryDate,
          surgeryType: recoveryCase.surgeryType,
          surgeryLeg: recoveryCase.surgeryLeg,
          completedOnboarding: true,
        }}
        isOpen={showOnboarding}
        onComplete={handleOnboardingComplete}
        onClose={() => setShowOnboarding(false)}
      />

      {/* Mobile Floating Bottom Navigation Bar (4 Primary Tabs) */}
      <div className="fixed bottom-3 left-0 right-0 z-40 px-3 pointer-events-none max-w-[430px] mx-auto">
        <nav className="w-full bg-white/95 backdrop-blur-xl border border-slate-200/90 shadow-xl rounded-full p-1.5 grid grid-cols-4 gap-1 pointer-events-auto">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-full text-[10px] font-bold transition ${
              activeTab === 'home'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Home className="w-4 h-4 mb-0.5" />
            <span>Trang chủ</span>
          </button>

          <button
            onClick={() => setActiveTab('plan')}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-full text-[10px] font-bold transition ${
              activeTab === 'plan'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Dumbbell className="w-4 h-4 mb-0.5" />
            <span>Kế hoạch</span>
          </button>

          <button
            onClick={() => setActiveTab('progress')}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-full text-[10px] font-bold transition ${
              activeTab === 'progress'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="w-4 h-4 mb-0.5" />
            <span>Tiến độ</span>
          </button>

          <button
            onClick={() => setActiveTab('explore')}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-full text-[10px] font-bold transition ${
              activeTab === 'explore'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-4 h-4 mb-0.5" />
            <span>Khám phá</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
