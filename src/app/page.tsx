'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import {
  Bell,
  Layers,
  Dumbbell,
  BarChart2,
  Calendar,
  Compass,
  Play,
  CheckCircle2,
  Clock,
  Heart,
  ChevronRight,
  TrendingUp,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Pause,
  Award,
  Search,
  BookOpen,
  Camera,
  Activity,
  Check,
  Zap,
  Flame,
  Home,
  ChevronDown,
  ChevronUp,
  ArrowRight
} from 'lucide-react';
import {
  SurgeryType,
  AgeGroup,
  SURGERY_DETAILS,
  AGE_GROUP_DETAILS,
  getRehabStatus,
  getSafeAgeGroup,
  getSafeSurgeryType,
  getAgeGroupDetails,
  getSurgeryDetails,
  Exercise
} from '@/data/rehabProtocols';
import {
  RecoveryCase,
  DailyExerciseSession,
  KNOWLEDGE_ARTICLES,
  KnowledgeArticle
} from '@/data/axvyraDomain';
import { AxvyraStore, getOrCreateDefaultCase } from '@/lib/axvyraStore';
import WorkoutPlayer from '@/components/WorkoutPlayer';
import KneeAngleCamera, { AngleRecord } from '@/components/KneeAngleCamera';
import OnboardingModal, { UserProfile } from '@/components/OnboardingModal';
import SessionFeedbackModal from '@/components/SessionFeedbackModal';
import AuthModal, { AuthUser } from '@/components/AuthModal';
import { LogOut, LogIn, UserCheck } from 'lucide-react';

type MainTab = 'home' | 'plan' | 'progress' | 'explore';

export default function AxvyraApp() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<MainTab>('home');

  // Recovery Case State
  const [recoveryCase, setRecoveryCase] = useState<RecoveryCase | null>(null);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);
  const [hasCompletedProfile, setHasCompletedProfile] = useState<boolean>(false);
  const [showRedFlags, setShowRedFlags] = useState<boolean>(false);

  // Authentication State
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [ageGroup, setAgeGroup] = useState<AgeGroup>('AGE_31_45');

  // Workout Session State
  const [activeWorkoutExercises, setActiveWorkoutExercises] = useState<Exercise[] | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState<boolean>(false);
  const [feedbackSessionTitle, setFeedbackSessionTitle] = useState<string>('');

  // Ice Timer State
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
    }

    const storedCompleted = localStorage.getItem('axvyra_profile_completed');
    const storedDate = localStorage.getItem('surgeryDate');
    if (storedCompleted === 'true' || storedDate) {
      setHasCompletedProfile(true);
    } else {
      setHasCompletedProfile(false);
    }

    // Sync with LocalStorage custom surgery fields & ageGroup
    try {
      const storedDate = localStorage.getItem('surgeryDate');
      const storedType = localStorage.getItem('surgeryType');
      const storedLeg = localStorage.getItem('operatedLeg');
      const storedAge = localStorage.getItem('ageGroup');

      if (storedAge) {
        setAgeGroup(getSafeAgeGroup(storedAge));
      }

      if (storedDate || storedType || storedLeg) {
        currentCase = AxvyraStore.sanitizeCase({
          ...currentCase,
          surgeryDate: storedDate || currentCase.surgeryDate,
          surgeryType: getSafeSurgeryType(storedType || currentCase.surgeryType),
          surgeryLeg: storedLeg === 'right' ? 'right' : 'left',
        });
        AxvyraStore.saveRecoveryCase(currentCase);
      }
    } catch {}

    setRecoveryCase(currentCase);

    // Load Auth User - enforce Auth if none exists
    try {
      const savedUser = localStorage.getItem('axvyra_auth_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed && typeof parsed === 'object') {
          setAuthUser(parsed);
          setShowAuthModal(false);
        } else {
          setAuthUser(null);
          setShowAuthModal(true);
        }
      } else {
        setAuthUser(null);
        setShowAuthModal(true);
      }
    } catch {
      setShowAuthModal(true);
    }

    // Sync with Neon Serverless DB
    AxvyraStore.syncWithServer().then((serverCase) => {
      if (serverCase) setRecoveryCase(AxvyraStore.sanitizeCase(serverCase));
    });
  }, []);

  const handleAuthSuccess = (user: AuthUser) => {
    try {
      const rawName = user?.fullName || user?.email?.split('@')[0] || 'Bệnh nhân';
      const safeName = typeof rawName === 'string' && rawName.trim() ? rawName.trim() : 'Bệnh nhân';
      const safeUser: AuthUser = {
        id: user?.id || `usr-${Date.now()}`,
        email: user?.email || '',
        fullName: safeName,
        avatarUrl: user?.avatarUrl,
        provider: user?.provider || 'email',
        isVerified: true,
      };

      setAuthUser(safeUser);
      setShowAuthModal(false);
      try {
        localStorage.setItem('axvyra_auth_user', JSON.stringify(safeUser));
      } catch {}

      if (recoveryCase) {
        const updated = AxvyraStore.sanitizeCase({
          ...recoveryCase,
          patientName: safeName,
        });
        AxvyraStore.saveRecoveryCase(updated);
        setRecoveryCase(updated);
      }
    } catch (e) {
      console.error('handleAuthSuccess error:', e);
      setShowAuthModal(false);
    }
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem('axvyra_auth_user');
    } catch {}
    setAuthUser(null);
    setShowAuthModal(true);
  };

  // Compute live rehab clinical status
  const rehabStatus = useMemo(() => {
    const sDate = recoveryCase?.surgeryDate || new Date().toISOString().split('T')[0];
    const sType = recoveryCase?.surgeryType || 'ACL_MENISCUS_REPAIR';
    return getRehabStatus(sDate, sType, ageGroup);
  }, [recoveryCase, ageGroup]);

  // Ice Timer Tick
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

  // Onboarding Completion
  const handleOnboardingComplete = (profile: UserProfile) => {
    setHasCompletedProfile(true);
    try {
      localStorage.setItem('axvyra_profile_completed', 'true');
      localStorage.setItem('surgeryDate', profile.surgeryDate);
      localStorage.setItem('surgeryType', profile.surgeryType);
      localStorage.setItem('operatedLeg', profile.surgeryLeg);
      if (profile.ageGroup) {
        localStorage.setItem('ageGroup', profile.ageGroup);
        setAgeGroup(profile.ageGroup);
      }
    } catch {}

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

  // Start Session with guided interval timer
  const handleStartTodaySession = (session?: DailyExerciseSession) => {
    const sessionTitle = session?.title || `Buổi tập Phục hồi • ${rehabStatus.phase.title}`;
    setActiveSessionId(session?.id || `ses-${Date.now()}`);
    setFeedbackSessionTitle(sessionTitle);

    // Wire up clinical exercises from getRehabStatus
    const exercisesForPlayer: Exercise[] = rehabStatus.exercises.map((e) => ({
      ...e,
      vietnameseName: e.name,
      targetSets: e.sets,
      targetReps: e.reps,
      holdSec: e.holdSeconds,
      restSec: e.restSeconds,
      safetyWarning: e.contraindications,
      description: e.instructions[0] || e.targetGoal,
    }));

    setActiveWorkoutExercises(exercisesForPlayer);
  };

  const handleWorkoutFinished = () => {
    setActiveWorkoutExercises(null);
    setShowFeedbackModal(true);
  };

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

  const filteredArticles = useMemo(() => {
    return KNOWLEDGE_ARTICLES.filter((art) => {
      const matchCat = selectedCategory === 'all' || art.category === selectedCategory;
      const matchSearch =
        art.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        art.summary.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [searchQuery, selectedCategory]);

  // Recovery progress calculations (0% - 100%)
  const rehabProgressPercent = useMemo(() => {
    // Protocol spans 16 weeks (112 days)
    const pct = Math.round((rehabStatus.currentDay / 112) * 100);
    return Math.min(100, Math.max(0, pct));
  }, [rehabStatus.currentDay]);

  const roadmapLineWidth = useMemo(() => {
    if (rehabStatus.currentWeek <= 2) return 10;
    if (rehabStatus.currentWeek <= 6) return 35;
    if (rehabStatus.currentWeek <= 12) return 60;
    if (rehabStatus.currentWeek <= 16) return 85;
    return 100;
  }, [rehabStatus.currentWeek]);

  const ROADMAP_STEPS = [
    { id: 1, label: 'Hậu phẫu', minWeek: 1, maxWeek: 2 },
    { id: 2, label: 'Vận động', minWeek: 3, maxWeek: 6 },
    { id: 3, label: 'Tăng cường', minWeek: 7, maxWeek: 12 },
    { id: 4, label: 'Chạy & Nhảy', minWeek: 13, maxWeek: 16 },
    { id: 5, label: 'Thể thao', minWeek: 17, maxWeek: 999 },
  ];

  // ROM Delta between last 2 measurements
  const romDelta = useMemo(() => {
    const list = recoveryCase?.romHistory || [];
    if (list.length >= 2) {
      return list[0].flexionAngle - list[1].flexionAngle;
    }
    return null;
  }, [recoveryCase?.romHistory]);

  // Strength adherence: count of actual completed sessions
  const completedSessions = useMemo(() => {
    return recoveryCase?.sessionFeedbacks?.length || 0;
  }, [recoveryCase?.sessionFeedbacks]);

  // Mobility score: 10 - painScore from latest daily recovery log
  const latestDailyLog = recoveryCase?.dailyLogs?.[0];
  const mobilityScore = useMemo(() => {
    if (!latestDailyLog) return null;
    return Math.max(1, 10 - latestDailyLog.painScore);
  }, [latestDailyLog]);

  const todaySession = recoveryCase?.dailySessions?.[0] || null;
  const latestROM = recoveryCase?.romHistory?.[0] || null;

  const userDisplayName = typeof authUser?.fullName === 'string' && authUser.fullName.trim()
    ? authUser.fullName.trim()
    : 'Bệnh nhân';
  const userShortName = userDisplayName.split(' ').pop() || 'User';

  if (!mounted || !recoveryCase) {
    return (
      <div className="min-h-screen bg-[#F2F7F9] text-slate-800 flex items-center justify-center p-4">
        <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
          <Activity className="w-5 h-5 animate-spin" />
          Đang tải AXVYRA...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F2F7F9] text-slate-800 flex flex-col justify-between font-sans relative select-none">
      {/* ========================================================================= */}
      {/* HEADER: NATURAL FULL-BLEED (Using /images/home-header-bg.jpg)             */}
      {/* ========================================================================= */}
      <header className="relative w-full z-20 shrink-0">
        {/* Background 3D Translucent Knee & Wave Image */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          <Image
            src="/images/home-header-bg.jpg"
            alt="AXVYRA Medical Background"
            fill
            className="object-cover object-top"
            priority
          />
          {/* Natural soft gradient fade-out at the bottom into page background #F2F7F9 */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/15 via-transparent to-[#F2F7F9]" />
        </div>

        {/* Top App Bar Row: Logo + Auth / Logout + Notification Bell */}
        <div className="relative z-10 px-5 pt-4 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setShowOnboarding(true)}>
            {/* Stylized Brand Logo */}
            <div className="w-5 h-5 relative flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 drop-shadow-[0_1px_3px_rgba(16,185,129,0.3)]">
                <path
                  d="M12 3L22 20H2L12 3Z"
                  fill="#84CC16"
                  stroke="#10B981"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <path d="M12 8L18 19H6L12 8Z" fill="#10B981" />
              </svg>
            </div>
            <span className="font-black text-lg tracking-wider text-slate-900">
              AXVYRA
            </span>
          </div>

          <div className="flex items-center gap-2">
            {authUser ? (
              <button
                onClick={handleLogout}
                title="Nhấn để đăng xuất"
                className="flex items-center gap-1.5 py-1 px-3 rounded-full bg-white/80 hover:bg-white backdrop-blur-md border border-white/90 text-slate-800 text-[11px] font-bold shadow-xs transition"
              >
                <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span className="max-w-[80px] truncate">{userShortName}</span>
                <LogOut className="w-3 h-3 text-slate-400 ml-0.5" />
              </button>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="flex items-center gap-1 py-1 px-3 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-xs transition"
              >
                <LogIn className="w-3.5 h-3.5 text-white" />
                <span>Đăng nhập</span>
              </button>
            )}

            <button
              onClick={() => setShowOnboarding(true)}
              className="relative w-9 h-9 rounded-full bg-white/80 hover:bg-white backdrop-blur-md border border-white/90 flex items-center justify-center text-slate-700 hover:text-slate-900 transition shadow-xs"
              aria-label="Thông báo & Hồ sơ"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white" />
            </button>
          </div>
        </div>

        {/* Home Specific Greeting & Clinical Profile Row */}
        {activeTab === 'home' && (
          <div className="relative z-10 px-5 pt-2 pb-5 flex items-center justify-between">
            <div
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => {
                if (!authUser) setShowAuthModal(true);
                else setShowOnboarding(true);
              }}
            >
              {/* User Avatar with glowing border */}
              <div className="relative">
                <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-white shadow-sm ring-2 ring-emerald-400/40 shrink-0 bg-white flex items-center justify-center">
                  <Image
                    src={authUser?.avatarUrl || '/images/knee-hero.png'}
                    alt="Avatar"
                    width={44}
                    height={44}
                    className="object-cover scale-125"
                  />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white" />
              </div>

              {/* Name & Clinical Status Tag */}
              <div>
                <div className="flex items-center gap-1.5">
                  <h2 className="text-[15px] font-black text-slate-900 leading-tight">
                    Chào {authUser ? userDisplayName : (recoveryCase?.patientName || 'Bệnh nhân')}
                  </h2>
                  {!authUser && (
                    <span className="text-[9.5px] text-emerald-700 font-bold bg-emerald-100/90 border border-emerald-300/60 px-2 py-0.5 rounded-full">
                      Khách
                    </span>
                  )}
                </div>

                {hasCompletedProfile ? (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-white/85 backdrop-blur-md border border-white/90 shadow-xs text-[11px] font-bold text-slate-700">
                      Ngày {rehabStatus.currentDay} • {getSurgeryDetails(recoveryCase?.surgeryType).shortLabel} • {getAgeGroupDetails(ageGroup).shortLabel}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowOnboarding(true);
                      }}
                      className="text-[10px] font-bold text-teal-800 hover:text-teal-950 bg-teal-100/80 hover:bg-teal-200/90 border border-teal-200/80 px-2 py-0.5 rounded-full transition shadow-xs"
                    >
                      Sửa
                    </button>
                  </div>
                ) : (
                  <div className="mt-1">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50/95 border border-amber-200/80 shadow-xs text-[11px] font-bold text-amber-800">
                      ⚠️ Chưa thiết lập hồ sơ mổ
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Scrollable View */}
      <main className="flex-1 px-4 pt-1.5 pb-28 space-y-3.5 overflow-y-auto relative z-10">
        {/* ========================================================================= */}
        {/* TAB 1: HOME (MATCHING THE UPLOADED DESIGN IMAGE)                          */}
        {/* ========================================================================= */}
        {activeTab === 'home' && (
          <div className="space-y-3.5 animate-fade-in">

            {/* ========================================================================= */}
            {/* TRƯỜNG HỢP 1: USER CHƯA THIẾT LẬP HỒ SƠ -> CARD ĐẦU TIÊN LÀ THIẾT LẬP HỒ SƠ */}
            {/* ========================================================================= */}
            {!hasCompletedProfile ? (
              <div className="space-y-3 animate-fade-in">
                {/* HERO CARD 1: THIẾT LẬP HỒ SƠ PHỤC HỒI */}
                <div className="bg-gradient-to-br from-emerald-600 via-teal-700 to-slate-900 rounded-[32px] p-5 text-white shadow-xl shadow-emerald-950/20 space-y-4 border border-emerald-400/25 relative overflow-hidden">
                  <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-emerald-400/15 rounded-full blur-2xl pointer-events-none" />

                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-emerald-300 font-bold text-[10px] uppercase tracking-wider border border-white/10 flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-emerald-400" />
                      Bước 1: Khởi tạo quá trình
                    </span>
                    <span className="text-[10px] text-emerald-200/80 font-semibold">Chỉ 1 phút</span>
                  </div>

                  <div className="space-y-1.5 relative z-10">
                    <h2 className="text-xl font-black text-white leading-tight">
                      Thiết lập hồ sơ phẫu thuật
                    </h2>
                    <p className="text-xs text-emerald-100/85 leading-relaxed font-medium">
                      Nhập ngày mổ, loại can thiệp dây chằng / sụn chêm và độ tuổi để kích hoạt phác đồ chuẩn y khoa và khóa góc an toàn dành riêng cho bạn.
                    </p>
                  </div>

                  {/* 3 Steps Mini Badges */}
                  <div className="grid grid-cols-3 gap-2 py-1 text-center text-[10.5px]">
                    <div className="p-2.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 space-y-0.5">
                      <span className="text-base block">📋</span>
                      <strong className="block text-white font-bold">1. Thông tin</strong>
                      <span className="text-[9px] text-emerald-200/70 block">Ngày & Bên mổ</span>
                    </div>
                    <div className="p-2.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 space-y-0.5">
                      <span className="text-base block">🛡️</span>
                      <strong className="block text-white font-bold">2. An toàn</strong>
                      <span className="text-[9px] text-emerald-200/70 block">Khóa góc tối đa</span>
                    </div>
                    <div className="p-2.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 space-y-0.5">
                      <span className="text-base block">🎯</span>
                      <strong className="block text-white font-bold">3. Phục hồi</strong>
                      <span className="text-[9px] text-emerald-200/70 block">16 tuần chuẩn hóa</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowOnboarding(true)}
                    className="w-full py-3.5 px-4 rounded-full bg-white hover:bg-emerald-50 active:scale-[0.98] text-emerald-950 font-black text-xs shadow-lg flex items-center justify-center gap-2 transition"
                  >
                    <span>Bắt đầu thiết lập hồ sơ ngay</span>
                    <ArrowRight className="w-4 h-4 text-emerald-700" />
                  </button>
                </div>

                {/* Giới thiệu nhẹ nhàng */}
                <div className="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm space-y-2">
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Chuẩn Y học Thể thao Quốc tế (FIFA 11+ / Melbourne ACL)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Sau khi thiết lập, ứng dụng sẽ tự động phân loại giai đoạn, cung cấp bài tập có âm thanh đếm nhịp và sử dụng Camera AI đo góc gối chính xác.
                  </p>
                </div>

                {/* Chườm đá nhanh */}
                <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900">Chườm đá lạnh (15 Phút)</h3>
                      <p className="text-[10px] text-slate-500">Giảm sưng đau, chống phản ứng viêm</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-base font-black tabular-nums text-sky-600 font-mono">
                      {formatTimer(iceSeconds)}
                    </span>
                    <button
                      onClick={() => setIsIceRunning(!isIceRunning)}
                      className={`py-1.5 px-3 rounded-full text-xs font-bold transition ${
                        isIceRunning ? 'bg-amber-500 text-white' : 'bg-sky-600 text-white'
                      }`}
                    >
                      {isIceRunning ? 'Dừng' : 'Bắt đầu'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* ========================================================================= */
              /* TRƯỜNG HỢP 2: ĐÃ THIẾT LẬP HỒ SƠ -> GIAO DIỆN TINH GỌN, KHÔNG HỀ BỊ RỐI    */
              /* ========================================================================= */
              <div className="space-y-3.5 animate-fade-in">
                {/* 1. Lưu ý bảo vệ sụn chêm gọn gàng (nếu có) */}
                {rehabStatus.isMeniscusRepairStrictLimit && (
                  <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900 shadow-xs flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                    <span className="text-[11px] leading-tight">
                      <strong className="text-rose-950 font-bold">Lưu ý khâu sụn chêm:</strong> Tuyệt đối không gập quá 90° và không tỳ chân mổ trong 6 tuần đầu ({recoveryCase?.weightBearingStatus || 'NWB'}).
                    </span>
                  </div>
                )}

                {/* 2. CARD 1: BÀI TẬP HÔM NAY (ƯU TIÊN SỐ 1 KHI BỆNH NHÂN VÀO APP) */}
                <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100/90 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                        <Dumbbell className="w-4 h-4 text-teal-600" />
                      </div>
                      <span className="font-bold text-[13px] text-slate-900">
                        Bài tập hôm nay
                      </span>
                    </div>
                    <button
                      onClick={() => setActiveTab('plan')}
                      className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-0.5"
                    >
                      <span>{rehabStatus.exercises.length} bài tập • Guided Timer</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-3 bg-slate-50/60 p-2.5 rounded-2xl border border-slate-100">
                    <div
                      onClick={() => handleStartTodaySession()}
                      className="relative w-24 h-16 rounded-xl overflow-hidden bg-slate-800 shrink-0 cursor-pointer group shadow-xs"
                    >
                      <Image
                        src="/images/knee-hero.png"
                        alt="Exercise Thumbnail"
                        fill
                        className="object-cover opacity-80 group-hover:scale-105 transition"
                      />
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                        <div className="w-6 h-6 rounded-full bg-white/90 text-slate-900 flex items-center justify-center shadow-md">
                          <Play className="w-3 h-3 fill-current ml-0.5 text-slate-800" />
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 min-w-0 pr-1">
                      <h3 className="text-xs font-bold text-slate-900 truncate">
                        Buổi tập Phase {rehabStatus.phase.phase} • Ngày {rehabStatus.currentDay}
                      </h3>
                      <p className="text-[10.5px] text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                        {rehabStatus.exercises[0]?.name || 'Tăng sức mạnh gối và kiểm soát vận động'}
                      </p>
                    </div>

                    <button
                      onClick={() => handleStartTodaySession()}
                      className="py-2 px-3.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 active:scale-95 text-white font-bold text-xs shadow-sm shadow-emerald-500/20 flex items-center gap-1 shrink-0 transition"
                    >
                      <span>Bắt đầu</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* 3. CARD 2: HÀNH TRÌNH PHỤC HỒI (LỘ TRÌNH 5 CHẶNG) */}
                <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100/90 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <Layers className="w-4 h-4 text-emerald-600" />
                      </div>
                      <span className="font-bold text-[13px] text-slate-900">
                        Hành trình phục hồi
                      </span>
                    </div>
                    <button
                      onClick={() => setActiveTab('progress')}
                      className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-0.5"
                    >
                      <span>Tuần {rehabStatus.currentWeek} / 16</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-3 pt-1">
                    <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
                      <svg className="w-full h-full -rotate-90 transform">
                        <circle
                          cx="40"
                          cy="40"
                          r="32"
                          className="text-slate-100"
                          strokeWidth="6"
                          stroke="currentColor"
                          fill="transparent"
                        />
                        <circle
                          cx="40"
                          cy="40"
                          r="32"
                          className="text-emerald-500 transition-all duration-700"
                          strokeWidth="6"
                          strokeDasharray={2 * Math.PI * 32}
                          strokeDashoffset={2 * Math.PI * 32 * (1 - rehabProgressPercent / 100)}
                          strokeLinecap="round"
                          stroke="currentColor"
                          fill="transparent"
                        />
                      </svg>
                      <div className="absolute flex flex-col items-center justify-center text-center">
                        <span className="text-base font-black text-slate-900">{rehabProgressPercent}%</span>
                        <span className="text-[7.5px] font-bold text-slate-400 uppercase leading-none mt-0.5">
                          Kế hoạch
                        </span>
                      </div>
                    </div>

                    <div className="flex-1 relative pb-1">
                      <div className="absolute top-2.5 left-2 right-2 h-0.5 bg-slate-200 z-0" />
                      <div
                        className="absolute top-2.5 left-2 h-0.5 bg-emerald-500 z-0 transition-all duration-500"
                        style={{ width: `${roadmapLineWidth}%` }}
                      />

                      <div className="relative z-10 grid grid-cols-5 text-center gap-1">
                        {ROADMAP_STEPS.map((step) => {
                          const isCompleted = rehabStatus.currentWeek > step.maxWeek;
                          const isCurrent = rehabStatus.currentWeek >= step.minWeek && rehabStatus.currentWeek <= step.maxWeek;

                          return (
                            <div key={step.id} className="flex flex-col items-center">
                              {isCompleted ? (
                                <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                                  <Check className="w-3 h-3 stroke-[3]" />
                                </div>
                              ) : isCurrent ? (
                                <div className="w-5 h-5 rounded-full bg-white border-2 border-emerald-500 flex items-center justify-center shadow-xs animate-pulse">
                                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                                </div>
                              ) : (
                                <div className="w-5 h-5 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center" />
                              )}
                              <span
                                className={`text-[9px] mt-1 leading-tight ${
                                  isCurrent
                                    ? 'font-bold text-slate-900'
                                    : isCompleted
                                    ? 'font-semibold text-slate-600'
                                    : 'font-medium text-slate-400'
                                }`}
                              >
                                {step.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. CARD 3: TIẾN BỘ GẦN ĐÂY */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <BarChart2 className="w-4 h-4 text-emerald-600" />
                      <span className="font-bold text-[13px] text-slate-900">
                        Tiến bộ gần đây
                      </span>
                    </div>
                    <button
                      onClick={() => setActiveTab('progress')}
                      className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-0.5"
                    >
                      <span>Xem chi tiết</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {/* Metric 1: ROM Gối */}
                    <div
                      onClick={() => setActiveTab('progress')}
                      className="bg-white rounded-3xl p-3 border border-slate-100/90 shadow-sm flex flex-col justify-between overflow-hidden relative cursor-pointer hover:border-emerald-200 transition"
                    >
                      <div>
                        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-600">
                          <Compass className="w-3.5 h-3.5 text-emerald-600" />
                          <span>ROM gối</span>
                        </div>
                        <div className="flex items-baseline gap-1 mt-2">
                          <span className="text-base font-black text-slate-900">
                            {latestROM ? `${latestROM.flexionAngle}°` : '--°'}
                          </span>
                          {latestROM && romDelta !== null ? (
                            <span className={`text-[9px] font-bold px-1 py-0.2 rounded-md ${
                              romDelta >= 0 ? 'text-emerald-700 bg-emerald-50' : 'text-amber-700 bg-amber-50'
                            }`}>
                              {romDelta >= 0 ? `↑ +${romDelta}°` : `↓ ${romDelta}°`}
                            </span>
                          ) : (
                            <span className="text-[8.5px] font-medium text-slate-400 bg-slate-50 px-1 py-0.2 rounded-md">
                              {latestROM ? 'Đã đo' : 'Chưa đo'}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-50 text-[9.5px] text-emerald-600 font-semibold flex items-center justify-between">
                        <span>{latestROM ? 'Đo lại' : 'Đo AI'}</span>
                        <ChevronRight className="w-3 h-3" />
                      </div>
                    </div>

                    {/* Metric 2: Sức mạnh */}
                    <div
                      onClick={() => setActiveTab('plan')}
                      className="bg-white rounded-3xl p-3 border border-slate-100/90 shadow-sm flex flex-col justify-between overflow-hidden relative cursor-pointer hover:border-sky-200 transition"
                    >
                      <div>
                        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-600">
                          <Zap className="w-3.5 h-3.5 text-sky-600" />
                          <span>Sức mạnh</span>
                        </div>
                        <div className="flex items-baseline gap-1 mt-2">
                          <span className="text-base font-black text-slate-900">
                            {completedSessions > 0 ? `${completedSessions}` : '0'}
                          </span>
                          <span className="text-[9px] text-slate-400">buổi</span>
                          <span className={`text-[9px] font-bold px-1 py-0.2 rounded-md ml-auto ${
                            completedSessions > 0 ? 'text-emerald-700 bg-emerald-50' : 'text-slate-400 bg-slate-50'
                          }`}>
                            {completedSessions > 0 ? 'Đã tập' : 'Chưa tập'}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-50 text-[9.5px] text-sky-600 font-semibold flex items-center justify-between">
                        <span>Tập ngay</span>
                        <ChevronRight className="w-3 h-3" />
                      </div>
                    </div>

                    {/* Metric 3: Khả năng vận động */}
                    <div className="bg-white rounded-3xl p-3 border border-slate-100/90 shadow-sm flex flex-col justify-between overflow-hidden relative">
                      <div>
                        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-600 truncate">
                          <Activity className="w-3.5 h-3.5 text-purple-600" />
                          <span>Khả năng</span>
                        </div>
                        <div className="flex items-baseline gap-1 mt-2">
                          {mobilityScore !== null ? (
                            <>
                              <span className="text-base font-black text-slate-900">
                                {mobilityScore.toFixed(1)}
                              </span>
                              <span className="text-[8.5px] text-slate-400">/10</span>
                            </>
                          ) : (
                            <span className="text-base font-black text-slate-900">
                              --
                            </span>
                          )}
                          <span className={`text-[9px] font-bold px-1 py-0.2 rounded-md ml-auto ${
                            latestDailyLog ? 'text-emerald-700 bg-emerald-50' : 'text-slate-400 bg-slate-50'
                          }`}>
                            {latestDailyLog ? `Đau ${latestDailyLog.painScore}/10` : 'Chưa ghi'}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-50 text-[9.5px] text-purple-600 font-semibold truncate">
                        {latestDailyLog ? `Sưng: ${latestDailyLog.swellingLevel}` : 'Nhật ký đau'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 5. CARD 4: QUY CHUẨN AN TOÀN & CHƯỜM ĐÁ 15 PHÚT (TINH GỌN, KHÔNG CỒNG KỀNH) */}
                <div className="bg-gradient-to-br from-white via-emerald-50/20 to-teal-50/30 rounded-3xl p-4 shadow-sm border border-emerald-100/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                        <ShieldCheck className="w-4 h-4 text-emerald-700" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-slate-900 leading-tight">
                          Quy chuẩn an toàn • Phase {rehabStatus.phase.phase}
                        </h3>
                        <p className="text-[10px] text-emerald-700 font-semibold">
                          Tuần {rehabStatus.phase.weekRange[0]} - {rehabStatus.phase.weekRange[1]}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 font-medium block">Góc tối đa</span>
                      <span className="text-sm font-black text-emerald-700">{rehabStatus.allowedFlexionMax}°</span>
                    </div>
                  </div>

                  {/* 2 Badges */}
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2.5 rounded-2xl bg-white border border-slate-100 shadow-xs">
                      <span className="text-[9.5px] font-bold text-slate-400 uppercase block mb-0.5">Tỳ đè</span>
                      <p className="font-semibold text-slate-800 leading-snug line-clamp-2">{rehabStatus.weightBearingSummary}</p>
                    </div>
                    <div className="p-2.5 rounded-2xl bg-white border border-slate-100 shadow-xs">
                      <span className="text-[9.5px] font-bold text-slate-400 uppercase block mb-0.5">Nẹp gối</span>
                      <p className="font-semibold text-slate-800 leading-snug line-clamp-2">{rehabStatus.braceSummary}</p>
                    </div>
                  </div>

                  {/* Collapsible Red Flags & Dangerous Symptoms */}
                  <div className="pt-1 border-t border-slate-100/80">
                    <button
                      type="button"
                      onClick={() => setShowRedFlags(!showRedFlags)}
                      className="w-full flex items-center justify-between text-left py-1 text-[11px] font-bold text-rose-700 hover:text-rose-800 transition"
                    >
                      <span className="flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        <span>Dấu hiệu cờ đỏ cần khám ngay ({rehabStatus.redFlags.length})</span>
                      </span>
                      {showRedFlags ? (
                        <ChevronUp className="w-3.5 h-3.5 text-rose-600" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-rose-600" />
                      )}
                    </button>

                    {showRedFlags && (
                      <div className="mt-2 p-2.5 rounded-2xl bg-rose-50 border border-rose-200 text-[10.5px] text-rose-900 space-y-1 animate-fade-in">
                        <ul className="pl-4 list-disc space-y-1">
                          {rehabStatus.redFlags.map((flag, idx) => (
                            <li key={idx}>{flag}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Integrated Ice Timer Bar */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100">
                        <Clock className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[11px] font-bold text-slate-800">Chườm đá lạnh</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black tabular-nums text-sky-600 font-mono">
                        {formatTimer(iceSeconds)}
                      </span>
                      <button
                        onClick={() => setIsIceRunning(!isIceRunning)}
                        className={`py-1 px-3 rounded-full text-[11px] font-bold transition ${
                          isIceRunning ? 'bg-amber-500 text-white' : 'bg-sky-600 text-white'
                        }`}
                      >
                        {isIceRunning ? 'Dừng' : 'Bắt đầu'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: PLAN (KẾ HOẠCH BÀI TẬP)                                           */}
        {/* ========================================================================= */}
        {activeTab === 'plan' && (
          <div className="space-y-3.5 animate-fade-in">
            <div>
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                Kế hoạch phục hồi • Phase {rehabStatus.phase.phase}
              </span>
              <h1 className="text-xl font-black text-slate-900 mt-0.5">
                {rehabStatus.phase.title}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Phác đồ lâm sàng chuẩn y khoa cho {getSurgeryDetails(rehabStatus.surgeryType).shortLabel} ({getAgeGroupDetails(ageGroup).shortLabel}).
              </p>
            </div>

            {/* Day Selector Strip */}
            <div className="bg-white rounded-3xl p-2.5 border border-slate-100 shadow-sm flex items-center justify-between text-center">
              {[1, 2, 3, 4, 5, 6].map((d) => (
                <div
                  key={d}
                  className={`p-2 rounded-2xl flex flex-col items-center flex-1 cursor-pointer transition ${
                    d === 1
                      ? 'bg-emerald-600 text-white font-bold shadow-xs'
                      : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-[8.5px] uppercase tracking-wider">T.{d + 1}</span>
                  <span className="text-xs font-black mt-0.5">{d}</span>
                </div>
              ))}
            </div>

            {/* Session Detail */}
            <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-bold text-emerald-700 uppercase">
                    Bài tập chỉ định giai đoạn {rehabStatus.phase.phase}
                  </h2>
                  <h3 className="text-sm font-black text-slate-900 mt-0.5">
                    {rehabStatus.exercises.length} bài tập phục hồi chức năng
                  </h3>
                </div>
                <button
                  onClick={() => handleStartTodaySession()}
                  className="py-2 px-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-full text-xs flex items-center gap-1 shadow-sm transition"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Tập với Audio Timer</span>
                </button>
              </div>

              <div className="divide-y divide-slate-100">
                {rehabStatus.exercises.map((item, idx) => (
                  <div key={item.id} className="py-3 first:pt-1 last:pb-1 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold flex items-center justify-center border border-emerald-200 shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900">
                            {item.name}
                          </h4>
                          <span className="text-[10px] text-slate-400 italic">
                            {item.englishName}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full block">
                          {item.sets} hiệp × {item.reps} lần
                        </span>
                        <span className="text-[9px] text-slate-400 block mt-0.5">
                          Giữ {item.holdSeconds}s • Nghỉ {item.restSeconds}s
                        </span>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-600 pl-7 leading-relaxed font-medium">
                      🎯 <strong>Mục tiêu:</strong> {item.targetGoal}
                    </p>

                    <div className="pl-7 text-[10.5px] text-slate-500 space-y-0.5">
                      {item.instructions.map((inst, i) => (
                        <p key={i}>• {inst}</p>
                      ))}
                    </div>

                    {item.contraindications && (
                      <div className="mt-1 pl-7 text-[10px] text-rose-600 font-semibold bg-rose-50/60 p-1.5 rounded-xl border border-rose-100">
                        ⚠️ <strong>Lưu ý:</strong> {item.contraindications}
                      </div>
                    )}

                    <div className="pl-7 pt-0.5 text-[9.5px] text-slate-400">
                      Nguồn y khoa: {item.medicalSource}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: PROGRESS (TIẾN ĐỘ & CAMERA AI)                                     */}
        {/* ========================================================================= */}
        {activeTab === 'progress' && (
          <div className="space-y-3.5 animate-fade-in">
            <div>
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                Theo dõi phục hồi • Camera AI
              </span>
              <h1 className="text-xl font-black text-slate-900 mt-0.5">
                Tiến Độ & Biên Độ Góc Gối
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Nhận diện góc gập duỗi qua MediaPipe PoseLandmarker chuẩn xác.
              </p>
            </div>

            {/* AI Knee Camera Module */}
            <div className="bg-slate-900 rounded-3xl p-3 shadow-md border border-slate-800">
              <KneeAngleCamera
                safeMaxFlexion={recoveryCase.maxSafeFlexion}
                selectedLeg={recoveryCase.surgeryLeg}
                onRecordSaved={handleROMRecorded}
              />
            </div>

            {/* Milestone Timeline */}
            <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100 space-y-2.5">
              <h2 className="text-xs font-black text-slate-900 uppercase">
                Cột Mốc Phục Hồi Lâm Sàng
              </h2>
              <div className="space-y-2">
                {(recoveryCase?.milestones || []).map((m) => (
                  <div
                    key={m.id}
                    className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100 flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-900">{m.title}</div>
                      <div className="text-[10.5px] text-slate-500 mt-0.5">{m.targetCriteria}</div>
                    </div>
                    <span
                      className={`text-[9.5px] font-bold px-2 py-0.5 rounded-md shrink-0 ${
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
                        : 'Chờ'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: EXPLORE (KHÁM PHÁ & KIẾN THỨC)                                     */}
        {/* ========================================================================= */}
        {activeTab === 'explore' && (
          <div className="space-y-3.5 animate-fade-in">
            <div>
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                Thư viện kiến thức • Y khoa
              </span>
              <h1 className="text-xl font-black text-slate-900 mt-0.5">
                Cẩm Nang Phục Hồi Khớp Gối
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Kiến thức chính xác từ chuyên gia phục hồi chức năng và chấn thương chỉnh hình.
              </p>
            </div>

            {/* Search */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm bài viết, câu hỏi, lưu ý..."
                className="w-full bg-white border border-slate-200 focus:border-emerald-500 rounded-2xl p-3 pl-10 text-xs font-medium text-slate-900 placeholder-slate-400 outline-none shadow-xs"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>

            {/* Category Pills */}
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

            {/* Selected Article Detail */}
            {selectedArticle ? (
              <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm space-y-3">
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
              <div className="space-y-2.5">
                {filteredArticles.map((art) => (
                  <div
                    key={art.id}
                    onClick={() => setSelectedArticle(art)}
                    className="p-4 bg-white hover:bg-slate-50/80 border border-slate-100 rounded-3xl cursor-pointer transition shadow-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[9.5px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        {art.category === 'safety' ? 'An toàn' : 'Phác đồ'}
                      </span>
                      <span className="text-[10px] text-slate-400">{art.readTime}</span>
                    </div>
                    <h3 className="text-xs font-black text-slate-900">
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
          name: authUser ? authUser.fullName : (recoveryCase?.patientName || 'Minh'),
          surgeryDate: recoveryCase?.surgeryDate || new Date().toISOString().split('T')[0],
          surgeryType: recoveryCase?.surgeryType || 'ACL_MENISCUS_REPAIR',
          surgeryLeg: recoveryCase?.surgeryLeg || 'left',
          ageGroup: ageGroup,
          completedOnboarding: true,
        }}
        isOpen={showOnboarding}
        onComplete={handleOnboardingComplete}
        onClose={() => setShowOnboarding(false)}
      />

      {/* Auth Modal (Login / Register / Email OTP Verification) - Mandatory until logged in */}
      <AuthModal
        isOpen={Boolean(!authUser || showAuthModal)}
        isMandatory={!authUser}
        onClose={() => {
          setShowAuthModal(false);
        }}
        onAuthSuccess={handleAuthSuccess}
      />

      {/* FLOATING BOTTOM DOCK WITH 4 TABS (EXACT REPLICA OF DESIGN) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-2 pt-1 pointer-events-none max-w-[430px] mx-auto bg-gradient-to-t from-white/95 via-white/80 to-transparent">
        <nav className="w-full bg-white/95 backdrop-blur-md border border-slate-100 shadow-lg shadow-slate-200/50 rounded-full py-1.5 px-2 flex items-center justify-between pointer-events-auto">
          {/* Tab 1: Trang chủ (Active State) */}
          <button
            onClick={() => setActiveTab('home')}
            className={`flex items-center gap-1.5 py-2 px-3.5 rounded-full text-xs font-bold transition-all ${
              activeTab === 'home'
                ? 'bg-[#E8F8F0] text-[#059669]'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Home className="w-4 h-4 fill-current" />
            <span className="text-[11px]">Trang chủ</span>
          </button>

          {/* Tab 2: Kế hoạch */}
          <button
            onClick={() => setActiveTab('plan')}
            className={`flex flex-col items-center justify-center py-1 px-3 text-xs font-bold transition-all ${
              activeTab === 'plan'
                ? 'bg-[#E8F8F0] text-[#059669] rounded-full py-2 px-3.5 flex-row gap-1.5'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span className="text-[10px] mt-0.5">Kế hoạch</span>
          </button>

          {/* Tab 3: Tiến độ */}
          <button
            onClick={() => setActiveTab('progress')}
            className={`flex flex-col items-center justify-center py-1 px-3 text-xs font-bold transition-all ${
              activeTab === 'progress'
                ? 'bg-[#E8F8F0] text-[#059669] rounded-full py-2 px-3.5 flex-row gap-1.5'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            <span className="text-[10px] mt-0.5">Tiến độ</span>
          </button>

          {/* Tab 4: Khám phá */}
          <button
            onClick={() => setActiveTab('explore')}
            className={`flex flex-col items-center justify-center py-1 px-3 text-xs font-bold transition-all ${
              activeTab === 'explore'
                ? 'bg-[#E8F8F0] text-[#059669] rounded-full py-2 px-3.5 flex-row gap-1.5'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span className="text-[10px] mt-0.5">Khám phá</span>
          </button>
        </nav>

        {/* iPhone Home Indicator Bar */}
        <div className="w-32 h-1 bg-black/80 rounded-full mx-auto mt-2" />
      </div>
    </div>
  );
}
