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
  ArrowRight,
  ArrowUpRight,
  User,
  FileText,
  Lock,
  KeyRound
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
  PHASE_RULES,
  Exercise,
  REHAB_EXERCISES
} from '@/data/rehabProtocols';
import {
  RecoveryCase,
  DailyExerciseSession,
  KNOWLEDGE_ARTICLES,
  KnowledgeArticle
} from '@/data/axvyraDomain';
import { AxvyraStore, getOrCreateDefaultCase, updateOrCreateCase } from '@/lib/axvyraStore';
import WorkoutPlayer from '@/components/WorkoutPlayer';
import KneeAngleCamera, { AngleRecord } from '@/components/KneeAngleCamera';
import OnboardingModal, { UserProfile } from '@/components/OnboardingModal';
import SessionFeedbackModal from '@/components/SessionFeedbackModal';
import AuthModal, { AuthUser } from '@/components/AuthModal';
import RoadmapModal from '@/components/RoadmapModal';
import { LogOut, LogIn, UserCheck } from 'lucide-react';

type MainTab = 'home' | 'plan' | 'progress' | 'account';

const AVATAR_PALETTES = [
  { bg: 'from-emerald-500 via-teal-600 to-emerald-800', border: 'border-emerald-400/40', glow: 'shadow-[0_0_15px_rgba(16,185,129,0.35)]', text: 'text-white' },
  { bg: 'from-indigo-500 via-purple-600 to-pink-600', border: 'border-indigo-400/40', glow: 'shadow-[0_0_15px_rgba(99,102,241,0.35)]', text: 'text-white' },
  { bg: 'from-amber-400 via-orange-500 to-rose-600', border: 'border-amber-400/40', glow: 'shadow-[0_0_15px_rgba(245,158,11,0.35)]', text: 'text-white' },
  { bg: 'from-rose-500 via-pink-600 to-purple-700', border: 'border-rose-400/40', glow: 'shadow-[0_0_15px_rgba(244,63,94,0.35)]', text: 'text-white' },
  { bg: 'from-cyan-400 via-blue-500 to-indigo-700', border: 'border-cyan-400/40', glow: 'shadow-[0_0_15px_rgba(6,182,212,0.35)]', text: 'text-white' },
  { bg: 'from-fuchsia-500 via-violet-600 to-purple-800', border: 'border-fuchsia-400/40', glow: 'shadow-[0_0_15px_rgba(217,70,239,0.35)]', text: 'text-white' },
  { bg: 'from-teal-400 via-cyan-600 to-blue-800', border: 'border-teal-400/40', glow: 'shadow-[0_0_15px_rgba(20,184,166,0.35)]', text: 'text-white' },
  { bg: 'from-orange-500 via-amber-500 to-yellow-600', border: 'border-amber-300/40', glow: 'shadow-[0_0_15px_rgba(251,191,36,0.35)]', text: 'text-slate-950' },
];

const getInitials = (name?: string | null): string => {
  if (!name || typeof name !== 'string') return 'U';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].substring(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const getAvatarStyle = (seed?: string | null) => {
  const str = seed || 'User';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[idx];
};

const PHASE_5_EXERCISES: Exercise[] = [
  {
    id: 'ex-p5-agility-cutting',
    name: 'Chạy đổi hướng zíc-zắc (Shuttle Run / T-Test)',
    englishName: 'Agility & Cutting Drills',
    phase: 4,
    holdSeconds: 30,
    restSeconds: 60,
    reps: 6,
    sets: 3,
    frequencyPerDay: 1,
    targetGoal: 'Tập phản xạ hãm phanh và đổi hướng đột ngột chịu tải xoay khớp gối an toàn',
    instructions: [
      'Đặt 4 nón tiêu cự ly 5m hình chữ T trên sân cỏ hoặc sàn tập.',
      'Chạy nước rút tiến 5m, phanh lại tiếp đất bằng đùi chùng gối.',
      'Di chuyển ngang sang trái 5m, đổi hướng sang phải 10m rồi lùi về vị trí xuất phát.',
      'Gối luôn hơi chùng 20-30° khi tiếp đất đổi hướng, không để đầu gối sụp vào trong (valgus).',
    ],
    contraindications: 'Chỉ tập khi sức cơ đạt tối thiểu 85% so với chân lành.',
    medicalSource: 'Delaware-Oslo ACL Cohort / AAOS Return-to-Sport 2023',
    allowedSurgeries: ['ACL_ONLY', 'ACL_MENISCUS_REPAIR', 'ACL_MENISCUS_TRIM'],
    vietnameseName: 'Chạy đổi hướng zíc-zắc',
    targetSets: 3,
    targetReps: 6,
    holdSec: 30,
    restSec: 60,
  },
  {
    id: 'ex-p5-single-leg-hop',
    name: 'Nhảy tiếp đất 1 chân kiểm soát trục gối (Hop & Stick)',
    englishName: 'Single-Leg Hop and Stick Landing',
    phase: 4,
    holdSeconds: 5,
    restSeconds: 15,
    reps: 8,
    sets: 3,
    frequencyPerDay: 1,
    targetGoal: 'Huấn luyện cơ bắp hấp thụ xung lực khi tiếp đất một chân (bài kiểm tra Return-to-Sport chuẩn)',
    instructions: [
      'Đứng trên chân phẫu thuật, hai tay đặt ngang hông.',
      'Bật nhảy về phía trước khoảng cách bằng chiều dài cẳng chân.',
      'Tiếp đất dứt khoát trên chính chân phẫu thuật, gập gối khoảng 30-45° để hãm lực êm ái.',
      'Đóng băng tư thế (Stick) trong 3-5 giây không chao đảo.',
    ],
    contraindications: 'Dừng ngay nếu gối có hiện tượng trượt hoặc đau nhói.',
    medicalSource: 'IKDC / Hop Test Battery Guidelines',
    allowedSurgeries: ['ACL_ONLY', 'ACL_MENISCUS_REPAIR', 'ACL_MENISCUS_TRIM'],
    vietnameseName: 'Nhảy tiếp đất 1 chân kiểm soát trục gối',
    targetSets: 3,
    targetReps: 8,
    holdSec: 5,
    restSec: 15,
  },
  {
    id: 'ex-p5-sport-specific',
    name: 'Bài tập chuyên biệt môn thể thao (Sút bóng / Đập cầu / Bật rổ)',
    englishName: 'Sport-Specific Skill Training',
    phase: 4,
    holdSeconds: 60,
    restSeconds: 60,
    reps: 5,
    sets: 3,
    frequencyPerDay: 1,
    targetGoal: 'Lấy lại phản xạ phối hợp thần kinh - cơ với dụng cụ và tư thế thi đấu thực tế',
    instructions: [
      'Bắt đầu với bóng/dụng cụ ở tốc độ 50% không có đối kháng.',
      'Tập các động tác chuyền, sút nhẹ, di chuyển bộ chân chuyên môn.',
      'Tăng dần cường độ lên 80% khi khớp gối hoàn toàn không có phản ứng đau hay sưng.',
    ],
    medicalSource: 'Aspetar ACL Clinical Practice Guidelines 2023',
    allowedSurgeries: ['ACL_ONLY', 'ACL_MENISCUS_REPAIR', 'ACL_MENISCUS_TRIM'],
    vietnameseName: 'Bài tập chuyên biệt môn thể thao',
    targetSets: 3,
    targetReps: 5,
    holdSec: 60,
    restSec: 60,
  },
];

export default function AxvyraApp() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<MainTab>('home');

  // Recovery Case State
  const [recoveryCase, setRecoveryCase] = useState<RecoveryCase | null>(null);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);
  const [showRoadmapModal, setShowRoadmapModal] = useState<boolean>(false);
  const [hasCompletedProfile, setHasCompletedProfile] = useState<boolean>(false);
  const [showRedFlags, setShowRedFlags] = useState<boolean>(false);

  // Authentication State
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [ageGroup, setAgeGroup] = useState<AgeGroup>('AGE_31_45');

  // Password Change State
  const [showChangePasswordModal, setShowChangePasswordModal] = useState<boolean>(false);
  const [oldPassword, setOldPassword] = useState<string>('');
  const [changeNewPassword, setChangeNewPassword] = useState<string>('');
  const [changeConfirmPassword, setChangeConfirmPassword] = useState<string>('');
  const [changePwdLoading, setChangePwdLoading] = useState<boolean>(false);
  const [changePwdError, setChangePwdError] = useState<string | null>(null);
  const [changePwdSuccess, setChangePwdSuccess] = useState<string | null>(null);

  // Workout Session State
  const [activeWorkoutExercises, setActiveWorkoutExercises] = useState<Exercise[] | null>(null);
  const [startExerciseIdx, setStartExerciseIdx] = useState<number>(0);
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
  const [accountSubView, setAccountSubView] = useState<'main' | 'articles'>('main');

  // Today's completed individual exercises
  const [completedExerciseIds, setCompletedExerciseIds] = useState<string[]>([]);

  // Plan Tab Phase Selection State
  const [selectedPlanPhase, setSelectedPlanPhase] = useState<number>(1);
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);

  const getTodayExerciseStorageKey = () => {
    const today = new Date();
    return `axvyra_exercises_${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  };

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

    // Load today's completed exercises from local storage
    try {
      const today = new Date();
      const storageKey = `axvyra_exercises_${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const savedEx = localStorage.getItem(storageKey);
      if (savedEx) {
        const parsed = JSON.parse(savedEx);
        if (Array.isArray(parsed)) {
          setCompletedExerciseIds(parsed);
        }
      }
    } catch {}

    // Sync with Neon Serverless DB
    AxvyraStore.syncWithServer().then((serverCase) => {
      if (serverCase) setRecoveryCase(AxvyraStore.sanitizeCase(serverCase));
    });
  }, []);

  const handleAuthSuccess = (user: AuthUser, isNewUser: boolean = false) => {
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

      // If user is brand new or hasn't finished medical onboarding, auto-open onboarding wizard!
      const storedCompleted = typeof window !== 'undefined' ? localStorage.getItem('axvyra_profile_completed') : null;
      if (isNewUser || storedCompleted !== 'true') {
        setShowOnboarding(true);
      }

      // Sync with user's remote case in Neon if available
      fetch(`/api/sync?userId=${encodeURIComponent(safeUser.id)}`)
        .then((res) => res.json())
        .then((syncData) => {
          if (syncData.connected && syncData.data) {
            const serverCase = AxvyraStore.sanitizeCase(syncData.data);
            AxvyraStore.saveRecoveryCase(serverCase);
            setRecoveryCase(serverCase);
            setHasCompletedProfile(true);
          } else if (recoveryCase) {
            const updated = AxvyraStore.sanitizeCase({
              ...recoveryCase,
              userId: safeUser.id,
              patientName: safeName,
            });
            AxvyraStore.saveRecoveryCase(updated);
            setRecoveryCase(updated);
            // Push to server
            fetch('/api/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...updated, userId: safeUser.id }),
            }).catch(() => {});
          }
        })
        .catch(() => {});
    } catch (e) {
      console.error('handleAuthSuccess error:', e);
      setShowAuthModal(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePwdError(null);
    setChangePwdSuccess(null);

    if (!oldPassword || !changeNewPassword) {
      setChangePwdError('Vui lòng điền đầy đủ thông tin.');
      return;
    }

    if (changeNewPassword.length < 6) {
      setChangePwdError('Mật khẩu mới phải có tối thiểu 6 ký tự.');
      return;
    }

    if (changeNewPassword !== changeConfirmPassword) {
      setChangePwdError('Mật khẩu xác nhận không trùng khớp.');
      return;
    }

    setChangePwdLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: authUser?.email,
          oldPassword,
          newPassword: changeNewPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Đổi mật khẩu thất bại.');

      setChangePwdSuccess('Đổi mật khẩu thành công!');
      setOldPassword('');
      setChangeNewPassword('');
      setChangeConfirmPassword('');
      setTimeout(() => {
        setShowChangePasswordModal(false);
        setChangePwdSuccess(null);
      }, 1500);
    } catch (err: any) {
      setChangePwdError(err.message || 'Lỗi khi đổi mật khẩu.');
    } finally {
      setChangePwdLoading(false);
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

  // Automatically sync selectedPlanPhase with patient's current phase on initial load
  useEffect(() => {
    if (rehabStatus.phase?.phase) {
      setSelectedPlanPhase(rehabStatus.phase.phase);
    }
  }, [rehabStatus.phase?.phase]);

  // 5 Stages Clinical Plan Definition
  const PLAN_STAGES = useMemo(() => {
    const isMeniscus = recoveryCase?.surgeryType === 'ACL_MENISCUS_REPAIR';
    return [
      {
        id: 1,
        shortLabel: 'GĐ 1',
        tabLabel: 'Hậu phẫu',
        weekRange: 'Tuần 1 – 2 (Ngày 1–14)',
        title: 'Giai đoạn 1: Kiểm soát sưng đau & Đánh thức cơ đùi',
        focus: 'Phục hồi duỗi thẳng gối 0° khẩn cấp, kích hoạt cơ tứ đầu đùi và kiểm soát dịch phù nề.',
        flexion: '≤ 90°',
        weightBearing: isMeniscus ? 'Không tỳ lực (NWB) • Đi 2 nạng' : 'Tỳ lực 1 phần (PWB) có 2 nạng',
        brace: 'Khóa nẹp thẳng 0° liên tục 24/24',
        criteria: [
          'Duỗi thẳng gối hoàn toàn 0° chạm mặt phẳng',
          'Nâng chân thẳng có nẹp (SLR) 10 lần liên tục không rớt gối',
          'Gập gối đạt 70° – 90° êm ái không đau nhói',
        ],
      },
      {
        id: 2,
        shortLabel: 'GĐ 2',
        tabLabel: 'Bỏ nạng',
        weekRange: 'Tuần 3 – 6 (Ngày 15–42)',
        title: 'Giai đoạn 2: Phục hồi biên độ vận động & Bỏ nạng',
        focus: 'Mở rộng góc gập gối, tập đi bộ dáng chuẩn không khập khiễng và bỏ nạng dần.',
        flexion: isMeniscus ? '≤ 90° (Hạn chế bảo vệ sụn chêm)' : '≤ 125°',
        weightBearing: isMeniscus ? 'Chạm mũi chân nhẹ tuần 5-6 • Bỏ nạng tuần 7-8' : 'Tập bỏ nạng tuần 4 nếu đi chuẩn',
        brace: isMeniscus ? 'Khóa 0° khi đi • Mở 0°-90° khi ngồi' : 'Mở khóa 0°–90° khi đi lại',
        criteria: [
          'Duy trì duỗi 0° và gập đạt 120° (ACL) hoặc 90° (sụn chêm)',
          'Bỏ nạng đi bộ bình thường không khập khiễng',
          'Đạp xe đạp tĩnh không kháng lực trơn tru',
        ],
      },
      {
        id: 3,
        shortLabel: 'GĐ 3',
        tabLabel: 'Cơ bắp',
        weekRange: 'Tuần 7 – 12 (Ngày 43–84)',
        title: 'Giai đoạn 3: Tăng cường sức mạnh cơ & Thăng bằng',
        focus: 'Tăng cơ đùi và cơ mông, phục hồi cảm thụ bản thể và thăng bằng 1 chân vững vàng.',
        flexion: '≤ 135° (Gần bằng chân lành)',
        weightBearing: 'Tỳ lực hoàn toàn 100% • Bỏ nạng hoàn toàn',
        brace: 'Bỏ nẹp hoàn toàn trong sinh hoạt',
        criteria: [
          'Biên độ gập gối đạt 130° – 135°',
          'Đứng thăng bằng 1 chân mổ vững trong 30 giây',
          'Bước lên/xuống bục 15cm không sụp gối',
        ],
      },
      {
        id: 4,
        shortLabel: 'GĐ 4',
        tabLabel: 'Chạy bộ',
        weekRange: 'Tuần 13 – 24 (Ngày 85–168)',
        title: 'Giai đoạn 4: Sức bền cơ & Chạy bộ đường thẳng',
        focus: 'Tái lập phản xạ chịu tải động, chạy bộ ngắt quãng và tăng sức bền cơ đùi.',
        flexion: '140° – 145° (Đầy đủ)',
        weightBearing: 'Chạy bộ đường thẳng (Jogging)',
        brace: 'Không cần nẹp',
        criteria: [
          'Sức cơ đùi đạt ≥ 80% so với chân lành',
          'Chạy bộ đường thẳng 15-20 phút không sưng đau',
          'Thực hiện bài tập thang dây linh hoạt tiến lùi',
        ],
      },
      {
        id: 5,
        shortLabel: 'GĐ 5',
        tabLabel: 'Thể thao',
        weekRange: 'Tháng 6 – 9+ (Sau ngày 168)',
        title: 'Giai đoạn 5: Đổi hướng nhanh & Trở lại thể thao đỉnh cao',
        focus: 'Huấn luyện Plyometrics, chuyển hướng đột ngột (Cutting/Agility) và vượt qua bài test Return-to-Sport.',
        flexion: '145° – 150° (Bằng chân lành)',
        weightBearing: 'Thi đấu thể thao toàn phần',
        brace: 'Băng thun thể thao hỗ trợ tâm lý (tùy chọn)',
        criteria: [
          'Single-leg Hop Test đạt ≥ 90% so với chân lành',
          'Chỉ số tâm lý sẵn sàng ACL-RSI ≥ 65 điểm',
          'Bác sĩ phẫu thuật ký xác nhận đủ điều kiện thi đấu',
        ],
      },
    ];
  }, [recoveryCase?.surgeryType]);

  const currentPlanStage = useMemo(() => {
    return PLAN_STAGES.find((s) => s.id === selectedPlanPhase) || PLAN_STAGES[0];
  }, [PLAN_STAGES, selectedPlanPhase]);

  const currentPlanExercises = useMemo(() => {
    if (selectedPlanPhase === 5) {
      return PHASE_5_EXERCISES;
    }
    const matched = REHAB_EXERCISES.filter(
      (ex) =>
        ex.phase === selectedPlanPhase &&
        ex.allowedSurgeries.includes(recoveryCase?.surgeryType || 'ACL_MENISCUS_REPAIR')
    );
    return matched.length > 0 ? matched : REHAB_EXERCISES.filter((ex) => ex.phase === selectedPlanPhase);
  }, [selectedPlanPhase, recoveryCase?.surgeryType]);

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

  // Onboarding Completion & Protocol Dynamic Re-assignment
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

    const updated = updateOrCreateCase(
      recoveryCase,
      {
        name: profile.name,
        surgeryDate: profile.surgeryDate,
        surgeryType: profile.surgeryType,
        surgeryLeg: profile.surgeryLeg,
        ageGroup: profile.ageGroup,
        userId: authUser?.id,
      },
      {
        weightBearing: profile.weightBearingRestriction,
        maxFlexion: profile.maxFlexionRestriction,
      }
    );
    AxvyraStore.saveRecoveryCase(updated);
    setRecoveryCase(updated);
    setShowOnboarding(false);

    // Sync to Neon DB with user link
    if (authUser?.id) {
      fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updated, userId: authUser.id }),
      }).catch(() => {});
    }
  };

  // Start Session with guided interval timer
  const handleStartTodaySession = (session?: DailyExerciseSession, exerciseIdx = 0) => {
    const sessionTitle = session?.title || `Buổi tập Phục hồi • Ngày ${rehabStatus.currentDay}`;
    setActiveSessionId(session?.id || `ses-${Date.now()}`);
    setFeedbackSessionTitle(sessionTitle);
    setStartExerciseIdx(exerciseIdx);

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
    const sId = activeSessionId || `ses-${Date.now()}`;
    const updated = AxvyraStore.completeSession(sId, feedback);
    if (updated) setRecoveryCase({ ...updated });
    setShowFeedbackModal(false);
    setActiveSessionId(null);
  };

  const handleCloseFeedbackModal = () => {
    if (activeSessionId) {
      const updated = AxvyraStore.completeSession(activeSessionId, {
        rpeScore: 4,
        painDuringSession: 2,
        notes: 'Đã hoàn thành cữ tập phục hồi',
      });
      if (updated) setRecoveryCase({ ...updated });
      setActiveSessionId(null);
    }
    setShowFeedbackModal(false);
  };

  const handleQuickMarkTodayCompleted = () => {
    const updated = AxvyraStore.quickCompleteTodaySession({
      rpeScore: 4,
      painDuringSession: 2,
      notes: 'Đã tự tập hoàn thành theo phác đồ',
    });
    if (updated) setRecoveryCase({ ...updated });

    // Mark all exercises as done for today
    if (rehabStatus.exercises.length > 0) {
      const allIds = rehabStatus.exercises.map((e) => e.id);
      setCompletedExerciseIds(allIds);
      try {
        localStorage.setItem(getTodayExerciseStorageKey(), JSON.stringify(allIds));
      } catch {}
    }
  };

  const handleToggleExerciseDone = (exerciseId: string) => {
    setCompletedExerciseIds((prev) => {
      const next = prev.includes(exerciseId)
        ? prev.filter((id) => id !== exerciseId)
        : [...prev, exerciseId];
      try {
        localStorage.setItem(getTodayExerciseStorageKey(), JSON.stringify(next));
      } catch {}

      // If all exercises are now completed, automatically mark the day's session as completed!
      if (rehabStatus.exercises.length > 0 && next.length === rehabStatus.exercises.length && !isTodayCompleted) {
        handleQuickMarkTodayCompleted();
      }
      return next;
    });
  };

  const handleExerciseCompletedInWorkout = (exerciseId: string) => {
    setCompletedExerciseIds((prev) => {
      if (prev.includes(exerciseId)) return prev;
      const next = [...prev, exerciseId];
      try {
        localStorage.setItem(getTodayExerciseStorageKey(), JSON.stringify(next));
      } catch {}

      if (rehabStatus.exercises.length > 0 && next.length === rehabStatus.exercises.length && !isTodayCompleted) {
        handleQuickMarkTodayCompleted();
      }
      return next;
    });
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

  // Strength adherence: count of actual completed sessions
  const completedSessions = useMemo(() => {
    return recoveryCase?.sessionFeedbacks?.length || 0;
  }, [recoveryCase?.sessionFeedbacks]);

  // Today's completed sessions list
  const todayFeedbacks = useMemo(() => {
    if (!recoveryCase?.sessionFeedbacks) return [];
    const today = new Date();
    return recoveryCase.sessionFeedbacks.filter((fb) => {
      if (!fb.completedAt) return false;
      const d = new Date(fb.completedAt);
      return (
        d.getFullYear() === today.getFullYear() &&
        d.getMonth() === today.getMonth() &&
        d.getDate() === today.getDate()
      );
    });
  }, [recoveryCase?.sessionFeedbacks]);

  const isTodayCompleted = todayFeedbacks.length > 0 || (recoveryCase?.dailySessions?.[0]?.completed ?? false);

  // Sync today's completed exercises if whole session was marked completed
  useEffect(() => {
    if (isTodayCompleted && rehabStatus.exercises.length > 0 && completedExerciseIds.length === 0) {
      const allIds = rehabStatus.exercises.map((e) => e.id);
      setCompletedExerciseIds(allIds);
      try {
        localStorage.setItem(getTodayExerciseStorageKey(), JSON.stringify(allIds));
      } catch {}
    }
  }, [isTodayCompleted, rehabStatus.exercises, completedExerciseIds.length]);
  const latestTodayFeedback = todayFeedbacks[0] || (isTodayCompleted ? recoveryCase?.sessionFeedbacks?.[0] : null);

  // Tính 7 ngày trong tuần phục hồi hiện tại (chuẩn y khoa theo chu kỳ ngày sau mổ)
  const currentWeekDays = useMemo(() => {
    const curDay = Math.max(1, rehabStatus.currentDay);
    const weekStartDay = Math.max(1, (rehabStatus.currentWeek - 1) * 7 + 1);

    // Tính ngày dương lịch thực tế từ ngày phẫu thuật của bệnh nhân
    const surgeryDateStr = recoveryCase?.surgeryDate;
    const baseDate = surgeryDateStr ? new Date(surgeryDateStr) : new Date();
    const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

    return [0, 1, 2, 3, 4, 5, 6].map((offset) => {
      const dayNum = weekStartDay + offset;
      const isToday = dayNum === curDay;
      const isPast = dayNum < curDay;
      const isFuture = dayNum > curDay;
      const isDone = isPast || (isToday && isTodayCompleted);

      // Tính Thứ và ngày dương lịch thực tế đối chiếu
      const targetDate = new Date(baseDate.getTime() + (dayNum - 1) * 86400000);
      const realDayName = !isNaN(targetDate.getTime()) ? dayNames[targetDate.getDay()] : '';
      const realDateFormatted = !isNaN(targetDate.getTime()) ? `${targetDate.getDate()}/${targetDate.getMonth() + 1}` : '';

      return {
        dayInWeek: offset + 1,       // Ngày 1 -> Ngày 7 trong tuần phục hồi
        dayNum,                      // Ngày thứ X sau mổ (Post-op Day)
        realDayName,                 // Thứ thực tế theo lịch dương
        realDateFormatted,           // Ngày/tháng dương lịch
        isToday,
        isPast,
        isFuture,
        isDone,
      };
    });
  }, [rehabStatus.currentDay, rehabStatus.currentWeek, isTodayCompleted, recoveryCase?.surgeryDate]);

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

  const targetPatientName = authUser ? userDisplayName : (recoveryCase?.patientName || 'Bạn');
  const userInitials = getInitials(targetPatientName);
  const userAvatarStyle = getAvatarStyle(targetPatientName + (authUser?.id || ''));

  if (!mounted || !recoveryCase) {
    return (
      <div className="min-h-screen bg-[#0C0D11] text-white flex items-center justify-center p-4">
        <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
          <Activity className="w-5 h-5 animate-spin" />
          Đang tải AXVYRA...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0C0D11] text-white flex flex-col justify-between font-sans relative select-none">
      {/* ========================================================================= */}
      {/* HEADER: ATMOSPHERIC DARK GRAPHITE WITH 3D KNEE GLOW                       */}
      {/* ========================================================================= */}
      <header className="relative w-full z-20 shrink-0">
        {/* Background 3D Translucent Knee Image with deep obsidian gradient */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden opacity-25">
          <Image
            src="/images/rehab-hero.jpg"
            alt="AXVYRA Medical Background"
            fill
            className="object-cover object-center"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0C0D11]/30 via-[#0C0D11]/85 to-[#0C0D11]" />
        </div>

        {/* Top App Bar Row: Logo (Clean & minimal, account link removed) */}
        <div className="relative z-10 px-5 pt-5 pb-2 flex items-center justify-between">
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => {
              setActiveTab('home');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            <div className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            </div>
            <span className="font-medium text-lg tracking-widest text-white">
              AXVYRA
            </span>
          </div>

          {!authUser && (
            <button
              onClick={() => setShowAuthModal(true)}
              className="flex items-center gap-1.5 py-1.5 px-4 rounded-full bg-white hover:bg-slate-100 text-slate-950 text-xs font-medium transition shadow-lg shadow-white/5"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Đăng nhập</span>
            </button>
          )}
        </div>

        {/* Home Specific Headline: Clean & Direct */}
        {activeTab === 'home' && (
          <div className="relative z-10 px-5 pt-2 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl sm:text-3xl font-light text-white tracking-tight leading-tight">
                  Kế hoạch Ngày {rehabStatus.currentDay} sau mổ
                </h1>
                <p className="text-xs text-slate-400 font-light mt-0.5">
                  Tuần {rehabStatus.currentWeek} • GĐ {rehabStatus.phase.phase}/5: {rehabStatus.phase.title.split('&')[0].trim()}
                </p>
              </div>
              <button
                onClick={() => setShowRoadmapModal(true)}
                title="Xem toàn bộ lộ trình 16 tuần"
                className="inline-flex items-center gap-1 text-[10.5px] font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 px-2.5 py-1 rounded-full transition shrink-0"
              >
                <span>GĐ {rehabStatus.phase.phase}/5</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Scrollable View */}
      <main className="flex-1 px-4 pt-1 pb-28 space-y-3.5 overflow-y-auto relative z-10">
        {/* ========================================================================= */}
        {/* TAB 1: HOME (LUXURY DARK BENTO STYLE MATCHING REFERENCE)                  */}
        {/* ========================================================================= */}
        {activeTab === 'home' && (
          <div className="space-y-3.5 animate-fade-in">

            {/* ========================================================================= */}
            {/* TRƯỜNG HỢP 1: USER CHƯA THIẾT LẬP HỒ SƠ -> MÀN CHÀO ĐÓN CINEMATIC (SCREEN 1) */}
            {/* ========================================================================= */}
            {!hasCompletedProfile ? (
              <div className="relative rounded-[36px] overflow-hidden shadow-2xl border border-white/[0.08] min-h-[500px] flex flex-col justify-end p-6 animate-fade-in group">
                {/* Full-bleed Cinematic Image */}
                <Image
                  src="/images/rehab-hero.jpg"
                  alt="AXVYRA Rehabilitation"
                  fill
                  className="object-cover object-center scale-105"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0C0D11] via-[#0C0D11]/75 to-black/20" />

                {/* Content Overlay at bottom (Screen 1 Awaken style) */}
                <div className="relative z-10 space-y-4">
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-medium tracking-widest text-amber-300 uppercase flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]" />
                      AXVYRA Rehabilitation
                    </span>
                    <h2 className="text-3xl font-light text-white tracking-tight leading-tight">
                      Tái thiết sức mạnh.
                      <br />
                      Tự tin trở lại thể thao.
                    </h2>
                    <p className="text-xs text-slate-300 font-light leading-relaxed pt-0.5">
                      Phác đồ phục hồi chuẩn y khoa cho dây chằng và sụn chêm, kết hợp đo góc gập bằng Camera AI thời gian thực.
                    </p>
                  </div>

                  {/* Dual Action CTA (Screen 1 Pill + Circle style) */}
                  <div className="flex items-center gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowOnboarding(true)}
                      className="flex-1 py-4 px-6 rounded-full bg-white hover:bg-slate-100 active:scale-[0.98] text-slate-950 font-medium text-sm shadow-2xl flex items-center justify-center gap-2 transition"
                    >
                      <span>Bắt đầu thiết lập phác đồ</span>
                      <ArrowRight className="w-4 h-4 text-slate-950" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowOnboarding(true)}
                      title="Khám phá ngay"
                      className="w-13 h-13 p-3.5 rounded-full bg-white/[0.08] hover:bg-white/15 border border-white/15 flex items-center justify-center text-white transition shrink-0"
                    >
                      <ArrowUpRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* ========================================================================= */
              /* TRƯỜNG HỢP 2: ĐÃ THIẾT LẬP HỒ SƠ -> GIAO DIỆN DARK BENTO CAO CẤP           */
              /* ========================================================================= */
              <div className="space-y-3.5 animate-fade-in">
                {/* Cảnh báo an toàn đặc biệt (nếu có khâu sụn chêm) */}
                {rehabStatus.isMeniscusRepairStrictLimit && (
                  <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 shadow-sm flex items-center gap-3">
                    <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
                    <div className="text-xs leading-relaxed font-light">
                      <strong className="font-semibold text-amber-200">Khâu sụn chêm:</strong> Giữ góc gập ≤ 90° và đi 2 nạng không tỳ lực ({recoveryCase?.weightBearingStatus || 'NWB'}).
                    </div>
                  </div>
                )}

                {/* =================================================================== */}
                {/* KHỐI 1: TIẾN TRÌNH TUẦN (SCREEN 3 CALENDAR SCHEDULE STYLE)         */}
                {/* =================================================================== */}
                <div className="bg-[#16181F] border border-white/[0.08] rounded-[32px] p-5 space-y-3.5 shadow-2xl">
                  {/* Header: Title + Day & Progress Pill */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-lg font-light text-white tracking-tight">
                        Lịch trình hồi phục
                      </h4>
                      <p className="text-xs text-slate-400 font-light mt-0.5">
                        Ngày {rehabStatus.currentDay} sau mổ • Tuần {rehabStatus.currentWeek}
                      </p>
                    </div>
                    <button
                      onClick={() => setShowRoadmapModal(true)}
                      title="Nhấn để xem toàn bộ 5 giai đoạn lộ trình hồi phục"
                      className="text-xs font-normal text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 px-3 py-1 rounded-full whitespace-nowrap flex items-center gap-1 transition active:scale-95 group"
                    >
                      <span>{rehabProgressPercent}% Lộ trình</span>
                      <ChevronRight className="w-3.5 h-3.5 text-emerald-400 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </div>

                  {/* 7 Days Minimal Grid: Ký hiệu thứ tự ngày sau mổ (N1, N2...) */}
                  <div className="grid grid-cols-7 gap-1.5 text-center pt-1">
                    {currentWeekDays.map((item) => (
                      <div
                        key={item.dayNum}
                        className={`flex flex-col items-center py-2 px-1 rounded-2xl transition ${
                          item.isToday
                            ? 'bg-white text-slate-950 shadow-xl shadow-white/10'
                            : 'bg-white/[0.03] border border-white/[0.06] text-slate-400'
                        }`}
                      >
                        {/* Ký hiệu thứ tự ngày sau mổ (N1, N2, N3...) */}
                        <span
                          className={`text-[10px] font-semibold tracking-wider ${
                            item.isToday ? 'text-slate-950' : 'text-slate-400 font-medium'
                          }`}
                        >
                          N{item.dayNum}
                        </span>

                        {/* Trạng thái tập trong ngày */}
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center my-1 text-xs transition ${
                            item.isToday
                              ? 'bg-slate-950 text-white font-semibold'
                              : item.isDone
                              ? 'bg-emerald-500/20 text-emerald-400 font-medium'
                              : 'text-slate-400 font-light'
                          }`}
                        >
                          {item.isToday && isTodayCompleted ? (
                            <Check className="w-3.5 h-3.5 stroke-[3] text-emerald-400" />
                          ) : item.isDone && !item.isToday ? (
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          ) : item.isToday ? (
                            <Play className="w-3 h-3 fill-emerald-400 text-emerald-400 ml-0.5" />
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
                          )}
                        </div>

                        {/* Ngày dương lịch thực tế đối chiếu */}
                        <span
                          className={`text-[9px] font-medium h-3 flex items-center ${
                            item.isToday
                              ? 'text-slate-600 font-bold'
                              : 'text-slate-500'
                          }`}
                        >
                          {item.realDateFormatted}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Status Capsule with quick action */}
                  <div
                    onClick={() => setShowRoadmapModal(true)}
                    className="py-2.5 px-3.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] flex items-center justify-between text-xs cursor-pointer transition group"
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] shrink-0" />
                      <span className="text-slate-300 font-light truncate">
                        GĐ {rehabStatus.phase.phase}/5: {rehabStatus.phase.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-emerald-400 group-hover:text-emerald-300 text-[11px] font-medium shrink-0">
                      <span>Xem lộ trình</span>
                      <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </div>

                {/* =================================================================== */}
                {/* KHỐI 2: TIMELINE BUỔI TẬP HÔM NAY (DAILY WORKOUT TIMELINE)          */}
                {/* =================================================================== */}
                <div className="bg-[#16181F] border border-white/[0.08] rounded-[32px] p-5 space-y-4 shadow-2xl relative overflow-hidden group">
                  {/* Card Header: Title + Subtitle */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full whitespace-nowrap flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Ngày {rehabStatus.currentDay} sau mổ
                      </span>
                      {isTodayCompleted ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full whitespace-nowrap">
                          <Check className="w-3 h-3 stroke-[3]" />
                          Đã tập ({todayFeedbacks.length || 1} cữ)
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium text-slate-400 bg-white/[0.04] border border-white/[0.08] px-2.5 py-0.5 rounded-full whitespace-nowrap">
                          ~30 phút (Tập + Chườm đá)
                        </span>
                      )}
                    </div>
                    <h3 className="text-xl font-medium text-white tracking-tight">
                      Lịch tập hôm nay
                    </h3>
                    <p className="text-xs text-slate-400 font-light">
                      Thực hiện lần lượt các bài theo thứ tự, kết thúc bằng chườm đá lạnh
                    </p>
                  </div>

                  {/* Primary Action Button: Full-width, high contrast, thumb-friendly */}
                  <button
                    onClick={() => handleStartTodaySession()}
                    className="w-full py-3.5 px-6 rounded-2xl bg-white hover:bg-slate-100 active:scale-[0.98] text-slate-950 font-semibold text-sm flex items-center justify-center gap-2 shadow-xl transition"
                  >
                    <Play className="w-4 h-4 fill-current text-slate-950" />
                    <span>{isTodayCompleted ? 'Bắt đầu cữ tập tiếp theo' : 'Bắt đầu cữ tập hôm nay'}</span>
                  </button>

                  {/* Safety & Angle Reminder Capsule */}
                  <div className="py-2.5 px-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.05] flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                      <span className="text-slate-300 font-light truncate">
                        Góc an toàn: <strong>≤ {rehabStatus.allowedFlexionMax}°</strong> • Duỗi thẳng 0°
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-light shrink-0">
                      {rehabStatus.phase.phase === 1 ? '3–4 cữ/ngày' : '2 cữ/ngày'}
                    </span>
                  </div>

                  {/* Exercise Progress Bar */}
                  <div className="space-y-1.5 pt-0.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-light flex items-center gap-1.5">
                        <span>Tiến độ bài tập hôm nay:</span>
                        <strong className="text-white font-medium">
                          {rehabStatus.exercises.filter((e) => completedExerciseIds.includes(e.id)).length}/
                          {rehabStatus.exercises.length} bài
                        </strong>
                      </span>
                      <span className="text-emerald-400 font-mono font-medium text-[11px]">
                        {Math.round(
                          (rehabStatus.exercises.filter((e) => completedExerciseIds.includes(e.id)).length /
                            (rehabStatus.exercises.length || 1)) *
                            100
                        )}
                        %
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500 rounded-full"
                        style={{
                          width: `${Math.round(
                            (rehabStatus.exercises.filter((e) => completedExerciseIds.includes(e.id)).length /
                              (rehabStatus.exercises.length || 1)) *
                              100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Vertical Exercise Timeline */}
                  <div className="relative pl-6 pt-2 space-y-3.5 before:content-[''] before:absolute before:left-[11px] before:top-4 before:bottom-7 before:w-[2px] before:bg-white/[0.08]">
                    {/* Các bài tập phục hồi chức năng trong ngày */}
                    {rehabStatus.exercises.map((item, idx) => {
                      const isDone = completedExerciseIds.includes(item.id);

                      return (
                        <div key={item.id} className="relative group/item">
                          {/* Timeline Step Node Button (interactive checkmark toggle) */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleExerciseDone(item.id);
                            }}
                            title={isDone ? 'Đã xong • Nhấn để bỏ chọn' : 'Nhấn để đánh dấu đã tập xong'}
                            className={`absolute -left-6 top-1 w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold z-10 transition active:scale-90 ${
                              isDone
                                ? 'bg-emerald-500 text-white border-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                                : 'bg-[#16181F] border-white/20 text-slate-400 hover:border-emerald-400/60 hover:text-white'
                            }`}
                          >
                            {isDone ? <Check className="w-3 h-3 stroke-[3]" /> : idx + 1}
                          </button>

                          {/* Exercise Item Card */}
                          <div
                            onClick={() => handleStartTodaySession(undefined, idx)}
                            className={`p-3 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer transition ${
                              isDone
                                ? 'bg-emerald-500/[0.05] hover:bg-emerald-500/[0.08] border-emerald-500/20'
                                : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.06]'
                            }`}
                          >
                            <div className="space-y-0.5 min-w-0 pr-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4
                                  className={`text-xs font-semibold tracking-tight ${
                                    isDone ? 'text-emerald-300' : 'text-white'
                                  }`}
                                >
                                  {item.name}
                                </h4>
                                {isDone ? (
                                  <span className="text-[9.5px] font-medium text-emerald-400 bg-emerald-500/15 border border-emerald-500/25 px-2 py-0.2 rounded-full whitespace-nowrap flex items-center gap-0.5">
                                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                                    Đã xong
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap">
                                    {item.sets} hiệp × {item.reps} lần
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-400 font-light line-clamp-1">
                                {item.targetGoal}
                              </p>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {isDone ? (
                                <span className="text-[10px] font-medium text-slate-400 group-hover/item:text-emerald-300 flex items-center gap-1 transition">
                                  <span className="hidden sm:inline">Tập lại</span>
                                  <RotateCcw className="w-3 h-3" />
                                </span>
                              ) : (
                                <span className="text-[10px] font-medium text-slate-400 group-hover/item:text-emerald-400 flex items-center gap-1 transition">
                                  <span className="hidden sm:inline">Tập bài này</span>
                                  <Play className="w-3 h-3 fill-current" />
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* BƯỚC CUỐI CÙNG TRÊN TIMELINE: CHƯỜM ĐÁ LẠNH 15 PHÚT */}
                    <div className="relative">
                      {/* Node Snowflake Icon */}
                      <div className="absolute -left-6 top-2 w-5 h-5 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-cyan-400 flex items-center justify-center text-[10px] font-bold z-10 shadow-[0_0_8px_rgba(6,182,212,0.4)]">
                        ❄️
                      </div>

                      {/* Integrated Ice Compress Card */}
                      <div className="p-3.5 rounded-2xl bg-cyan-950/20 border border-cyan-500/25 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider">
                              Bước cuối • Chăm sóc sau tập
                            </span>
                            <h4 className="text-xs font-semibold text-white mt-0.5">
                              Chườm đá lạnh 15 phút & Kê cao chân 45°
                            </h4>
                            <p className="text-[11px] text-slate-400 font-light">
                              Hạ nhiệt bao khớp, chống sưng phù nề sau vận động
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-sm font-semibold tabular-nums text-white font-mono bg-black/40 px-2.5 py-1 rounded-lg border border-white/10">
                              {formatTimer(iceSeconds)}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsIceRunning(!isIceRunning);
                              }}
                              className={`py-1.5 px-3 rounded-full text-xs font-semibold transition active:scale-95 ${
                                isIceRunning
                                  ? 'bg-amber-500 text-slate-950'
                                  : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-md shadow-cyan-950/50'
                              }`}
                            >
                              {isIceRunning ? 'Tạm dừng' : 'Bắt đầu'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer note: Quick Mark Completed or Repeat */}
                  <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-[11px]">
                    {isTodayCompleted ? (
                      <span className="text-emerald-400 flex items-center gap-1.5 font-light">
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Hôm nay đã hoàn thành ({todayFeedbacks.length} cữ tập)</span>
                      </span>
                    ) : (
                      <span className="text-slate-400 font-light">
                        Trợ lý âm thanh sẽ tự động đếm nhịp cho từng bài
                      </span>
                    )}

                    <button
                      onClick={handleQuickMarkTodayCompleted}
                      className="text-slate-400 hover:text-emerald-400 font-light underline underline-offset-2 transition"
                    >
                      {isTodayCompleted ? 'Ghi nhận thêm 1 cữ' : 'Đã tự tập xong?'}
                    </button>
                  </div>
                </div>

                {/* =================================================================== */}
                {/* KHỐI 3: BENTO VITALS (SCREEN 2 YOGA / BREATH STYLE)                */}
                {/* =================================================================== */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Ô 1: Biên độ gập gối (ROM) */}
                  <div
                    onClick={() => setActiveTab('progress')}
                    className="bg-[#16181F] border border-white/[0.08] rounded-[28px] p-4 flex flex-col justify-between cursor-pointer hover:border-white/20 transition group min-h-[148px]"
                  >
                    <div className="flex items-center justify-between text-slate-400">
                      <div>
                        <span className="text-sm font-light text-white block">Góc gập ROM</span>
                        <span className="text-[11px] text-slate-500 font-light">Biên độ gối</span>
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition" />
                    </div>
                    <div className="my-2">
                      <div className="text-3xl font-light text-white tracking-tight">
                        {latestROM ? `${latestROM.flexionAngle}°` : '--°'}
                      </div>
                    </div>
                    <span className="text-[10px] font-normal text-slate-300 bg-white/[0.05] border border-white/10 px-3 py-1 rounded-full w-fit whitespace-nowrap">
                      Tối đa: {rehabStatus.allowedFlexionMax}°
                    </span>
                  </div>

                  {/* Ô 2: Mức đau & Sưng */}
                  <div
                    onClick={() => setActiveTab('progress')}
                    className="bg-[#16181F] border border-white/[0.08] rounded-[28px] p-4 flex flex-col justify-between cursor-pointer hover:border-white/20 transition group min-h-[148px]"
                  >
                    <div className="flex items-center justify-between text-slate-400">
                      <div>
                        <span className="text-sm font-light text-white block">Mức đau</span>
                        <span className="text-[11px] text-slate-500 font-light">Thang VAS</span>
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition" />
                    </div>
                    <div className="my-2">
                      <div className="text-3xl font-light text-emerald-400 tracking-tight">
                        {latestDailyLog ? `${latestDailyLog.painScore}/10` : '2/10'}
                      </div>
                    </div>
                    <span className="text-[10px] font-normal text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full w-fit whitespace-nowrap">
                      Sưng: {latestDailyLog ? latestDailyLog.swellingLevel : 'Nhẹ'}
                    </span>
                  </div>
                </div>

                {/* Red Flags / Emergency Warning Drawer */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowRedFlags(!showRedFlags)}
                    className="w-full flex items-center justify-between text-left text-xs font-semibold text-slate-400 hover:text-rose-400 transition py-2 px-1"
                  >
                    <span className="flex items-center gap-2 text-rose-400 font-bold">
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                      <span>Dấu hiệu bất thường cần liên hệ bác sĩ</span>
                    </span>
                    {showRedFlags ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </button>

                  {showRedFlags && (
                    <div className="mt-2 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 space-y-1.5 animate-fade-in">
                      <ul className="pl-4 list-disc space-y-1.5 leading-relaxed">
                        {rehabStatus.redFlags.map((flag, idx) => (
                          <li key={idx}>{flag}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: PLAN (KẾ HOẠCH BÀI TẬP 5 GIAI ĐOẠN - DARK BENTO CHUẨN Y KHOA)       */}
        {/* ========================================================================= */}
        {activeTab === 'plan' && (
          <div className="space-y-3.5 animate-fade-in pb-12">
            {/* Header: Title + Patient's Current Phase Pill */}
            <div className="bg-[#16181F] rounded-[32px] p-5 border border-white/[0.08] shadow-2xl space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" />
                  Phác đồ phục hồi chuẩn y khoa
                </span>
                <span className="text-[10.5px] text-slate-400 font-light">
                  Hiện tại: <strong className="text-emerald-400 font-medium">GĐ {rehabStatus.phase.phase}/5</strong>
                </span>
              </div>
              <h1 className="text-2xl font-light text-white tracking-tight">
                Kế Hoạch Phục Hồi Toàn Diện
              </h1>
              <p className="text-xs text-slate-400 font-light leading-relaxed">
                Khám phá đầy đủ 5 giai đoạn từ hậu phẫu đến thể thao. Chạm từng mốc để xem chi tiết bài tập & tiêu chuẩn.
              </p>
            </div>

            {/* 5-Phase Horizontal Stepper Selector */}
            <div className="grid grid-cols-5 gap-1.5 p-1.5 rounded-3xl bg-[#16181F] border border-white/[0.08] shadow-xl">
              {PLAN_STAGES.map((stg) => {
                const isSelected = selectedPlanPhase === stg.id;
                const isPatientCurrent = rehabStatus.phase.phase === stg.id;
                const isPast = stg.id < rehabStatus.phase.phase;

                return (
                  <button
                    key={stg.id}
                    onClick={() => {
                      setSelectedPlanPhase(stg.id);
                      setExpandedExerciseId(null);
                    }}
                    className={`py-2 px-1 rounded-2xl flex flex-col items-center justify-center text-center transition-all relative ${
                      isSelected
                        ? 'bg-white text-slate-950 font-semibold shadow-xl scale-[1.03] z-10'
                        : isPast
                        ? 'bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
                        : 'bg-transparent text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {isPatientCurrent && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#16181F] animate-pulse" />
                    )}
                    <span className={`text-[11px] font-bold ${isSelected ? 'text-slate-950' : isPast ? 'text-emerald-400' : ''}`}>
                      GĐ {stg.id}
                    </span>
                    <span className={`text-[9px] truncate w-full mt-0.5 ${isSelected ? 'text-slate-800 font-medium' : 'text-slate-400 font-light'}`}>
                      {stg.tabLabel}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Selected Phase Overview Card */}
            <div className="bg-[#16181F] rounded-[32px] p-5 border border-white/[0.08] shadow-2xl space-y-3.5">
              <div>
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                    {currentPlanStage.weekRange}
                  </span>
                  {selectedPlanPhase === rehabStatus.phase.phase ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Giai đoạn hiện tại của bạn
                    </span>
                  ) : selectedPlanPhase < rehabStatus.phase.phase ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400 bg-white/[0.04] border border-white/10 px-2.5 py-0.5 rounded-full">
                      <Check className="w-2.5 h-2.5 stroke-[3] text-emerald-400" />
                      Đã hoàn thành
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400 bg-white/[0.04] border border-white/10 px-2.5 py-0.5 rounded-full">
                      Giai đoạn tương lai
                    </span>
                  )}
                </div>
                <h2 className="text-lg font-medium text-white tracking-tight">
                  {currentPlanStage.title}
                </h2>
                <p className="text-xs text-slate-400 font-light mt-1 leading-relaxed">
                  {currentPlanStage.focus}
                </p>
              </div>

              {/* 3 Pillars Grid: Angle, Weight-Bearing, Brace */}
              <div className="grid grid-cols-3 gap-2 pt-0.5 text-center">
                <div className="p-2.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-0.5">
                  <span className="text-[9px] uppercase font-light text-slate-400 block tracking-wider">
                    Góc an toàn
                  </span>
                  <span className="text-xs font-semibold text-white block">
                    {currentPlanStage.flexion}
                  </span>
                </div>
                <div className="p-2.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-0.5">
                  <span className="text-[9px] uppercase font-light text-slate-400 block tracking-wider">
                    Mức tỳ lực
                  </span>
                  <span className="text-xs font-semibold text-amber-300 block truncate" title={currentPlanStage.weightBearing}>
                    {currentPlanStage.weightBearing.split('•')[0].trim()}
                  </span>
                </div>
                <div className="p-2.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-0.5">
                  <span className="text-[9px] uppercase font-light text-slate-400 block tracking-wider">
                    Quy tắc nẹp
                  </span>
                  <span className="text-xs font-semibold text-cyan-300 block truncate" title={currentPlanStage.brace}>
                    {currentPlanStage.brace.split('(')[0].trim()}
                  </span>
                </div>
              </div>

              {/* Clearance Criteria Checklist */}
              <div className="pt-2 border-t border-white/[0.06] space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Tiêu chuẩn hoàn thành giai đoạn {selectedPlanPhase}:
                </span>
                <div className="space-y-1.5">
                  {currentPlanStage.criteria.map((cr, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-slate-300 font-light leading-snug">
                      <span className="w-4 h-4 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                        ✓
                      </span>
                      <span>{cr}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Exercise List for Selected Phase */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between px-1">
                <div>
                  <h3 className="text-sm font-medium text-white tracking-tight">
                    Danh sách bài tập Giai đoạn {selectedPlanPhase}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-light">
                    {currentPlanExercises.length} bài tập theo phác đồ chỉ định
                  </p>
                </div>

                {selectedPlanPhase === rehabStatus.phase.phase && (
                  <button
                    onClick={() => handleStartTodaySession()}
                    className="py-2 px-3.5 bg-white hover:bg-slate-100 text-slate-950 font-medium rounded-full text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition shrink-0"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Tập trọn bộ</span>
                  </button>
                )}
              </div>

              {/* Exercise Bento Cards */}
              <div className="space-y-2.5">
                {currentPlanExercises.map((item, idx) => {
                  const isExpanded = expandedExerciseId === item.id;
                  const isCurrentPatientPhase = selectedPlanPhase === rehabStatus.phase.phase;
                  const isCompletedToday = isCurrentPatientPhase && completedExerciseIds.includes(item.id);

                  return (
                    <div
                      key={item.id}
                      className={`rounded-[28px] border transition-all ${
                        isExpanded
                          ? 'bg-[#181A24] border-white/20 shadow-xl'
                          : 'bg-[#16181F] hover:bg-[#1A1C24] border-white/[0.08]'
                      } p-4 space-y-3`}
                    >
                      {/* Exercise Header Row */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <span className={`w-7 h-7 rounded-2xl flex items-center justify-center text-xs font-bold border shrink-0 mt-0.5 ${
                            isCompletedToday
                              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                              : 'bg-white/[0.04] border-white/10 text-slate-300'
                          }`}>
                            {isCompletedToday ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : idx + 1}
                          </span>
                          <div className="min-w-0">
                            <h4 className="text-sm font-semibold text-white tracking-tight leading-snug">
                              {item.vietnameseName || item.name}
                            </h4>
                            <p className="text-[11px] text-slate-400 font-light italic truncate">
                              {item.englishName}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-[10.5px] font-medium text-white bg-white/[0.06] border border-white/10 px-2.5 py-0.5 rounded-full whitespace-nowrap block">
                            {item.sets} hiệp × {item.reps} lần
                          </span>
                          <span className="text-[9.5px] text-slate-400 block mt-1">
                            Giữ {item.holdSeconds}s • Nghỉ {item.restSeconds}s
                          </span>
                        </div>
                      </div>

                      {/* Single-line Target Goal */}
                      <div className="text-xs text-slate-300 font-light pl-1 flex items-start gap-1.5 leading-relaxed">
                        <span className="text-emerald-400 shrink-0">🎯</span>
                        <span>{item.targetGoal}</span>
                      </div>

                      {/* Action Buttons Row */}
                      <div className="flex items-center justify-between pt-1 border-t border-white/[0.05]">
                        <button
                          type="button"
                          onClick={() => setExpandedExerciseId(isExpanded ? null : item.id)}
                          className="text-xs text-slate-400 hover:text-white font-light flex items-center gap-1 transition py-1"
                        >
                          <span>{isExpanded ? 'Thu gọn kỹ thuật' : 'Xem kỹ thuật tập'}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        {isCurrentPatientPhase && (
                          <button
                            onClick={() => handleStartTodaySession(undefined, idx)}
                            className="py-1.5 px-3 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs font-medium flex items-center gap-1.5 transition active:scale-95"
                          >
                            <Play className="w-3 h-3 fill-current" />
                            <span>{isCompletedToday ? 'Tập lại' : 'Tập bài này'}</span>
                          </button>
                        )}
                      </div>

                      {/* Expanded Step-by-Step Instructions */}
                      {isExpanded && (
                        <div className="pt-2 border-t border-white/[0.06] space-y-2.5 animate-fade-in">
                          <div className="space-y-1.5">
                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                              Các bước thực hiện chuẩn:
                            </span>
                            {item.instructions.map((inst, i) => (
                              <div key={i} className="flex items-start gap-2 text-xs text-slate-300 font-light leading-relaxed">
                                <span className="w-4 h-4 rounded-full bg-white/5 text-slate-400 flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                                  {i + 1}
                                </span>
                                <span>{inst}</span>
                              </div>
                            ))}
                          </div>

                          {item.contraindications && (
                            <div className="p-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 font-light flex items-start gap-2">
                              <span className="text-sm shrink-0">⚠️</span>
                              <span><strong>Lưu ý an toàn:</strong> {item.contraindications}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: PROGRESS (TIẾN ĐỘ & CAMERA AI - DARK BENTO)                        */}
        {/* ========================================================================= */}
        {activeTab === 'progress' && (
          <div className="space-y-3.5 animate-fade-in">
            <div className="bg-[#16181F] rounded-[32px] p-5 border border-white/[0.08] shadow-2xl space-y-1">
              <span className="text-[10px] font-medium text-emerald-400 uppercase tracking-wider">
                Theo dõi phục hồi • Camera AI
              </span>
              <h1 className="text-2xl font-light text-white tracking-tight mt-0.5">
                Tiến Độ & Biên Độ Góc Gối
              </h1>
              <p className="text-xs text-slate-400 font-light mt-0.5">
                Nhận diện góc gập duỗi qua MediaPipe PoseLandmarker chuẩn xác.
              </p>
            </div>

            {/* AI Knee Camera Module */}
            <div className="bg-[#16181F] rounded-[32px] p-3 shadow-2xl border border-white/[0.08]">
              <KneeAngleCamera
                safeMaxFlexion={recoveryCase.maxSafeFlexion}
                selectedLeg={recoveryCase.surgeryLeg}
                onRecordSaved={handleROMRecorded}
              />
            </div>

            {/* Milestone Timeline */}
            <div className="bg-[#16181F] rounded-[32px] p-5 shadow-2xl border border-white/[0.08] space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-light text-slate-400 uppercase tracking-wider">
                  Cột Mốc Phục Hồi Lâm Sàng
                </h2>
                <button
                  onClick={() => setShowRoadmapModal(true)}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 font-light flex items-center gap-0.5 transition"
                >
                  <span>Xem lộ trình 16–24 tuần</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
              <div className="space-y-2">
                {(recoveryCase?.milestones || []).map((m) => (
                  <div
                    key={m.id}
                    className="p-3.5 bg-white/[0.03] rounded-2xl border border-white/[0.06] flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="text-xs font-bold text-white">{m.title}</div>
                      <div className="text-[10.5px] text-slate-400 mt-0.5">{m.targetCriteria}</div>
                    </div>
                    <span
                      className={`text-[9.5px] font-bold px-2.5 py-0.5 rounded-full shrink-0 ${
                        m.status === 'CONFIRMED'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : m.status === 'IN_PROGRESS'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-white/10 text-slate-400'
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

            {/* Exercise Sessions History */}
            <div className="bg-[#16181F] rounded-[32px] p-5 shadow-2xl border border-white/[0.08] space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-light text-slate-400 uppercase tracking-wider">
                  Lịch Sử Các Cữ Tập
                </h2>
                <span className="text-[11px] text-emerald-400 font-medium">
                  {recoveryCase?.sessionFeedbacks?.length || 0} cữ đã hoàn thành
                </span>
              </div>

              {recoveryCase?.sessionFeedbacks && recoveryCase.sessionFeedbacks.length > 0 ? (
                <div className="space-y-2">
                  {recoveryCase.sessionFeedbacks.slice(0, 5).map((fb, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 bg-white/[0.03] rounded-2xl border border-white/[0.06] flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 flex items-center justify-center shrink-0">
                          <Check className="w-4 h-4 stroke-[2.5]" />
                        </div>
                        <div>
                          <div className="font-semibold text-white">
                            Cữ tập phục hồi • {fb.completedAt ? new Date(fb.completedAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : 'Hôm nay'}
                          </div>
                          <div className="text-[11px] text-slate-400 font-light mt-0.5">
                            RPE: <strong className="text-slate-200">{fb.rpeScore}/10</strong> • Đau VAS: <strong className="text-emerald-400">{fb.painDuringSession}/10</strong>
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">
                        {fb.completedAt ? new Date(fb.completedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] text-center text-xs text-slate-400">
                  Chưa có lịch sử cữ tập. Hãy bắt đầu buổi tập hôm nay!
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: TÀI KHOẢN (ACCOUNT & MEDICAL PROFILE & REFERENCE & LOGOUT)         */}
        {/* ========================================================================= */}
        {activeTab === 'account' && (
          <div className="space-y-4 animate-fade-in pb-12">
            {accountSubView === 'articles' ? (
              /* VIEW CON: TÀI LIỆU & CẨM NANG THAM KHẢO Y KHOA */
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => {
                      setAccountSubView('main');
                      setSelectedArticle(null);
                    }}
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1.5 transition active:scale-95 py-1 px-2.5 rounded-full bg-white/[0.04] border border-white/[0.08]"
                  >
                    <span>&larr;</span>
                    <span>Quay lại Tài khoản</span>
                  </button>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {KNOWLEDGE_ARTICLES.length} tài liệu y khoa
                  </span>
                </div>

                <div className="bg-[#16181F] rounded-[32px] p-5 border border-white/[0.08] shadow-2xl space-y-1">
                  <span className="text-[10px] font-medium text-emerald-400 uppercase tracking-wider">
                    Thư viện kiến thức • Y khoa
                  </span>
                  <h1 className="text-2xl font-light text-white tracking-tight mt-0.5">
                    Tài Liệu Tham Khảo Y Khoa
                  </h1>
                  <p className="text-xs text-slate-400 font-light mt-0.5">
                    Cẩm nang chăm sóc chườm lạnh R.I.C.E, an toàn sụn chêm và dinh dưỡng phục hồi.
                  </p>
                </div>

                {/* Search */}
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm bài viết, lưu ý, dinh dưỡng..."
                    className="w-full bg-[#16181F] border border-white/10 focus:border-white/30 rounded-full p-3.5 pl-10 text-xs font-normal text-white placeholder-slate-500 outline-none shadow-md"
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
                      className={`py-2 px-4 rounded-full font-medium whitespace-nowrap transition text-xs ${
                        selectedCategory === cat.id
                          ? 'bg-white text-slate-950 shadow-md'
                          : 'bg-[#16181F] border border-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* Selected Article Detail */}
                {selectedArticle ? (
                  <div className="bg-[#16181F] border border-white/[0.08] rounded-[32px] p-5 shadow-2xl space-y-3 text-white">
                    <button
                      onClick={() => setSelectedArticle(null)}
                      className="text-xs text-emerald-400 font-medium flex items-center gap-1 hover:underline mb-1"
                    >
                      &larr; Quay lại danh sách bài
                    </button>
                    <h2 className="text-lg font-light text-white">
                      {selectedArticle.title}
                    </h2>
                    <div className="text-[11px] text-slate-400 font-light">
                      {selectedArticle.readTime}
                    </div>

                    {selectedArticle.importantNotice && (
                      <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 font-medium">
                        ⚠️ {selectedArticle.importantNotice}
                      </div>
                    )}

                    <div className="space-y-2 text-xs text-slate-300 font-light leading-relaxed">
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
                        className="p-4 bg-[#16181F] hover:bg-[#1C1F28] border border-white/[0.08] rounded-[28px] cursor-pointer transition shadow-sm space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[9.5px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                            {art.category === 'safety' ? 'An toàn' : 'Phác đồ'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-light">{art.readTime}</span>
                        </div>
                        <h3 className="text-xs font-medium text-white">
                          {art.title}
                        </h3>
                        <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                          {art.summary}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* VIEW CHÍNH: TỔNG QUAN TÀI KHOẢN & HỒ SƠ Y KHOA */
              <div className="space-y-3.5">
                {/* 1. Header Card: Profile Card */}
                <div className="bg-[#16181F] border border-white/[0.08] rounded-[32px] p-5 shadow-2xl relative overflow-hidden">
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-16 h-16 rounded-full bg-gradient-to-br ${userAvatarStyle.bg} border-2 border-white/20 flex items-center justify-center text-xl font-bold ${userAvatarStyle.text} shadow-xl shrink-0`}
                    >
                      {userInitials}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-medium text-white tracking-tight truncate">
                          {userDisplayName}
                        </h2>
                        {authUser && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full shrink-0">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                            Đã xác thực
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 font-light truncate">
                        {authUser?.email || 'Tài khoản bệnh nhân AXVYRA'}
                      </p>
                      <div className="pt-0.5">
                        <span className="text-[10.5px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 font-light">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                          Ngày {rehabStatus.currentDay} sau mổ • GĐ {rehabStatus.phase.phase}/5
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Medical Profile Card ("Cập nhật hồ sơ & phác đồ y khoa trong tài khoản") */}
                <div className="bg-[#16181F] border border-white/[0.08] rounded-[32px] p-5 shadow-2xl space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                        Phác đồ điều trị
                      </span>
                      <h3 className="text-base font-medium text-white tracking-tight mt-0.5">
                        Hồ Sơ Y Khoa & Phác Đồ Phục Hồi
                      </h3>
                    </div>
                    <button
                      onClick={() => setShowOnboarding(true)}
                      className="text-xs text-emerald-400 hover:text-emerald-300 font-light flex items-center gap-1 transition"
                    >
                      <span>Chỉnh sửa</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Clinical Data Grid */}
                  <div className="grid grid-cols-2 gap-2.5 pt-0.5">
                    <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.05] space-y-0.5">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-light">
                        Ngày phẫu thuật
                      </span>
                      <div className="text-xs font-medium text-white">
                        {recoveryCase?.surgeryDate
                          ? new Date(recoveryCase.surgeryDate).toLocaleDateString('vi-VN', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })
                          : 'Chưa cập nhật'}
                      </div>
                    </div>

                    <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.05] space-y-0.5">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-light">
                        Chân chấn thương
                      </span>
                      <div className="text-xs font-medium text-emerald-400">
                        {recoveryCase?.surgeryLeg === 'right' ? 'Khớp Gối Phải' : 'Khớp Gối Trái'}
                      </div>
                    </div>

                    <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.05] space-y-0.5 col-span-2">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-light">
                        Phương pháp phẫu thuật
                      </span>
                      <div className="text-xs font-medium text-white">
                        {SURGERY_DETAILS[recoveryCase?.surgeryType || 'ACL_MENISCUS_REPAIR']?.label ||
                          'Tái tạo DCCT & Khâu sụn chêm'}
                      </div>
                    </div>

                    <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.05] space-y-0.5">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-light">
                        Giới hạn tỳ lực
                      </span>
                      <div className="text-xs font-medium text-amber-300">
                        {recoveryCase?.weightBearingStatus ||
                          (rehabStatus.isMeniscusRepairStrictLimit
                            ? 'Không tỳ lực (NWB)'
                            : 'Tỳ lực 1 phần (PWB)')}
                      </div>
                    </div>

                    <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.05] space-y-0.5">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-light">
                        Góc gập cho phép
                      </span>
                      <div className="text-xs font-medium text-white">
                        ≤ {rehabStatus.allowedFlexionMax}° • Duỗi 0°
                      </div>
                    </div>
                  </div>

                  {/* Primary CTA Button to update Medical Profile */}
                  <button
                    onClick={() => setShowOnboarding(true)}
                    className="w-full py-3 px-4 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] active:scale-[0.99] border border-white/10 text-white font-medium text-xs flex items-center justify-between transition mt-1"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-emerald-400" />
                      <span>Cập nhật phác đồ & hồ sơ y khoa</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </button>
                </div>

                {/* 3. Link Section: "Tham khảo" (Reference library link inside account) */}
                <div
                  onClick={() => setAccountSubView('articles')}
                  className="p-4 rounded-[28px] bg-[#16181F] border border-white/[0.08] hover:border-emerald-500/30 cursor-pointer transition shadow-xl group space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-medium text-white group-hover:text-emerald-300 transition">
                            Tài liệu & Cẩm nang tham khảo
                          </h4>
                          <span className="text-[9.5px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.2 rounded-full">
                            {KNOWLEDGE_ARTICLES.length} bài
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-light mt-0.5">
                          Quy tắc chườm đá R.I.C.E, an toàn sụn chêm & dinh dưỡng liền gân
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition shrink-0 ml-2" />
                  </div>
                </div>

                {/* 4. Link Section: "Lộ trình 5 giai đoạn" */}
                <div
                  onClick={() => setShowRoadmapModal(true)}
                  className="p-4 rounded-[28px] bg-[#16181F] border border-white/[0.08] hover:border-cyan-500/30 cursor-pointer transition shadow-xl group space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                        <Compass className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-medium text-white group-hover:text-cyan-300 transition">
                            Lộ trình hồi phục chuẩn y khoa
                          </h4>
                          <span className="text-[9.5px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.2 rounded-full">
                            5 Giai đoạn
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-light mt-0.5">
                          Chi tiết từng cột mốc, tiêu chuẩn bỏ nạng và ngày dự kiến đạt mốc
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition shrink-0 ml-2" />
                  </div>
                </div>

                {/* 5. Security & Change Password Card */}
                {authUser && authUser.provider !== 'google' && (
                  <div className="p-4 rounded-[28px] bg-[#16181F] border border-white/[0.08] shadow-xl space-y-3">
                    <div
                      onClick={() => {
                        setShowChangePasswordModal(!showChangePasswordModal);
                        setChangePwdError(null);
                        setChangePwdSuccess(null);
                      }}
                      className="flex items-center justify-between cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                          <Lock className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-white group-hover:text-amber-300 transition">
                            Bảo mật & Đổi mật khẩu
                          </h4>
                          <p className="text-[11px] text-slate-400 font-light mt-0.5">
                            Cập nhật mật khẩu bảo vệ tài khoản cá nhân
                          </p>
                        </div>
                      </div>
                      <ChevronRight
                        className={`w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-transform ${
                          showChangePasswordModal ? 'rotate-90' : ''
                        }`}
                      />
                    </div>

                    {showChangePasswordModal && (
                      <form onSubmit={handleChangePassword} className="space-y-2.5 pt-2 border-t border-white/[0.06] animate-fade-in">
                        {changePwdError && (
                          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-light">
                            {changePwdError}
                          </div>
                        )}
                        {changePwdSuccess && (
                          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-light">
                            {changePwdSuccess}
                          </div>
                        )}

                        <input
                          type="password"
                          required
                          value={oldPassword}
                          onChange={(e) => setOldPassword(e.target.value)}
                          placeholder="Mật khẩu hiện tại"
                          className="w-full bg-white/[0.04] border border-white/10 focus:border-white/30 rounded-xl py-2.5 px-3 text-xs text-white placeholder-slate-500 outline-none"
                        />
                        <input
                          type="password"
                          required
                          value={changeNewPassword}
                          onChange={(e) => setChangeNewPassword(e.target.value)}
                          placeholder="Mật khẩu mới (tối thiểu 6 ký tự)"
                          className="w-full bg-white/[0.04] border border-white/10 focus:border-white/30 rounded-xl py-2.5 px-3 text-xs text-white placeholder-slate-500 outline-none"
                        />
                        <input
                          type="password"
                          required
                          value={changeConfirmPassword}
                          onChange={(e) => setChangeConfirmPassword(e.target.value)}
                          placeholder="Xác nhận mật khẩu mới"
                          className="w-full bg-white/[0.04] border border-white/10 focus:border-white/30 rounded-xl py-2.5 px-3 text-xs text-white placeholder-slate-500 outline-none"
                        />

                        <button
                          type="submit"
                          disabled={changePwdLoading}
                          className="w-full py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-950 font-medium text-xs transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                          {changePwdLoading ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
                        </button>
                      </form>
                    )}
                  </div>
                )}

                {/* 6. Logout Button ("Đăng xuất trong tài khoản") */}
                <button
                  onClick={handleLogout}
                  className="w-full p-4 rounded-[28px] bg-rose-500/[0.06] hover:bg-rose-500/[0.12] active:scale-[0.99] border border-rose-500/20 text-rose-300 flex items-center justify-between transition group cursor-pointer shadow-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0">
                      <LogOut className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <h4 className="text-xs font-semibold text-rose-300">
                        Đăng xuất tài khoản
                      </h4>
                      <p className="text-[11px] text-rose-400/70 font-light">
                        {authUser?.email ? `Đang đăng nhập: ${authUser.email}` : 'Thoát khỏi phiên làm việc hiện tại'}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-rose-400/60 group-hover:translate-x-0.5 transition" />
                </button>

                {/* Version / Clinical notice */}
                <div className="text-center pt-2">
                  <p className="text-[10px] text-slate-500 font-light">
                    AXVYRA Knee Rehabilitation System • v1.0.4 Medical AI
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Full-Screen Workout Player Modal */}
      {activeWorkoutExercises && (
        <WorkoutPlayer
          exercises={activeWorkoutExercises}
          initialExerciseIndex={startExerciseIdx}
          completedExerciseIds={completedExerciseIds}
          onClose={() => setActiveWorkoutExercises(null)}
          onFinishedWorkout={handleWorkoutFinished}
          onExerciseCompleted={handleExerciseCompletedInWorkout}
        />
      )}

      {/* Post-Session Feedback Modal */}
      <SessionFeedbackModal
        isOpen={showFeedbackModal}
        sessionTitle={feedbackSessionTitle}
        onSaveFeedback={handleSaveSessionFeedback}
        onClose={handleCloseFeedbackModal}
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

      {/* Clinical Recovery Roadmap Modal */}
      <RoadmapModal
        isOpen={showRoadmapModal}
        onClose={() => setShowRoadmapModal(false)}
        currentDay={rehabStatus.currentDay}
        currentWeek={rehabStatus.currentWeek}
        currentPhase={rehabStatus.phase.phase}
        surgeryDateStr={recoveryCase?.surgeryDate || new Date().toISOString()}
        surgeryType={rehabStatus.surgeryType}
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

      {/* FLOATING BOTTOM DOCK WITH DYNAMIC EXPANDING PILL (LUXURY WELLNESS STYLE) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-3 pt-2 pointer-events-none max-w-[430px] mx-auto bg-gradient-to-t from-[#0C0D11] via-[#0C0D11]/90 to-transparent">
        <nav className="w-full bg-[#16181F]/90 backdrop-blur-2xl border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.6)] rounded-full py-1.5 px-2.5 flex items-center justify-around pointer-events-auto">
          {/* Tab 1: Trang chủ */}
          <button
            onClick={() => setActiveTab('home')}
            aria-label="Trang chủ"
            className={`flex items-center gap-2 py-2 rounded-full text-xs transition-all shrink-0 whitespace-nowrap ${
              activeTab === 'home'
                ? 'bg-white text-slate-950 font-medium px-4 shadow-lg'
                : 'text-slate-400 hover:text-white px-3'
            }`}
          >
            <Home className="w-4 h-4 fill-current shrink-0" />
            {activeTab === 'home' && <span className="text-xs font-medium tracking-tight whitespace-nowrap">Trang chủ</span>}
          </button>

          {/* Tab 2: Kế hoạch */}
          <button
            onClick={() => setActiveTab('plan')}
            aria-label="Kế hoạch tập luyện"
            className={`flex items-center gap-2 py-2 rounded-full text-xs transition-all shrink-0 whitespace-nowrap ${
              activeTab === 'plan'
                ? 'bg-white text-slate-950 font-medium px-4 shadow-lg'
                : 'text-slate-400 hover:text-white px-3'
            }`}
          >
            <Calendar className="w-4 h-4 shrink-0" />
            {activeTab === 'plan' && <span className="text-xs font-medium tracking-tight whitespace-nowrap">Kế hoạch</span>}
          </button>

          {/* Tab 3: Tiến độ */}
          <button
            onClick={() => setActiveTab('progress')}
            aria-label="Tiến độ hồi phục"
            className={`flex items-center gap-2 py-2 rounded-full text-xs transition-all shrink-0 whitespace-nowrap ${
              activeTab === 'progress'
                ? 'bg-white text-slate-950 font-medium px-4 shadow-lg'
                : 'text-slate-400 hover:text-white px-3'
            }`}
          >
            <BarChart2 className="w-4 h-4 shrink-0" />
            {activeTab === 'progress' && <span className="text-xs font-medium tracking-tight whitespace-nowrap">Tiến độ</span>}
          </button>

          {/* Tab 4: Tài khoản */}
          <button
            onClick={() => {
              setActiveTab('account');
              setAccountSubView('main');
            }}
            aria-label="Tài khoản & Hồ sơ"
            className={`flex items-center gap-2 py-2 rounded-full text-xs transition-all shrink-0 whitespace-nowrap ${
              activeTab === 'account'
                ? 'bg-white text-slate-950 font-medium px-4 shadow-lg'
                : 'text-slate-400 hover:text-white px-3'
            }`}
          >
            <User className="w-4 h-4 shrink-0" />
            {activeTab === 'account' && <span className="text-xs font-medium tracking-tight whitespace-nowrap">Tài khoản</span>}
          </button>
        </nav>

        {/* iPhone Home Indicator Bar */}
        <div className="w-32 h-1 bg-white/20 rounded-full mx-auto mt-2" />
      </div>
    </div>
  );
}
