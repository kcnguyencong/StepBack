'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  RotateCw,
  BookmarkPlus,
  History,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Info,
  X,
  FlipHorizontal,
  Volume2,
  VolumeX,
  SlidersHorizontal,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

export interface AngleRecord {
  id: string;
  timestamp: string;
  leg: 'left' | 'right';
  flexionAngle: number;
  internalAngle: number;
  safeLimit: number;
  isSafe: boolean;
  source: 'live' | 'photo' | 'manual' | 'gyro';
  note?: string;
}

interface KneeAngleCameraProps {
  safeMaxFlexion?: number;
  selectedLeg?: 'left' | 'right';
  onRecordSaved?: (record: AngleRecord) => void;
}

interface Point2D {
  x: number;
  y: number;
}

// Low-pass coordinate smoothing
const smoothPoint = (prev: Point2D | null, next: Point2D, alpha = 0.25): Point2D => {
  if (!prev) return { ...next };
  const dist = Math.hypot(next.x - prev.x, next.y - prev.y);
  if (dist > 120) return { ...next };
  return {
    x: prev.x * (1 - alpha) + next.x * alpha,
    y: prev.y * (1 - alpha) + next.y * alpha,
  };
};

export default function KneeAngleCamera({
  safeMaxFlexion = 90,
  selectedLeg = 'left',
  onRecordSaved,
}: KneeAngleCameraProps) {
  // Mode: 'visual' (Thước đối chiếu hình học mắt nhìn) vs 'camera' (Camera soi trực tiếp)
  const [mode, setMode] = useState<'visual' | 'camera'>('visual');
  const [leg, setLeg] = useState<'left' | 'right'>(selectedLeg);

  // Visual Slider Angle (0° to 135°)
  const [visualAngle, setVisualAngle] = useState<number>(60);

  // Live Camera states
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('user'); // Default selfie for bedside use
  const [liveAngle, setLiveAngle] = useState<number | null>(null);
  const [isLoadingModel, setIsLoadingModel] = useState<boolean>(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // History & Toast
  const [historyRecords, setHistoryRecords] = useState<AngleRecord[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Refs for camera loop
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const smoothedPointsRef = useRef<{ hip: Point2D | null; knee: Point2D | null; ankle: Point2D | null }>({
    hip: null,
    knee: null,
    ankle: null,
  });
  const lastInferenceTimeRef = useRef<number>(0);
  const displayAngleRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Load history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('goikhoe_angle_history');
      if (saved) {
        setHistoryRecords(JSON.parse(saved));
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (selectedLeg) {
      setLeg(selectedLeg);
    }
  }, [selectedLeg]);

  // Audio feedback
  const playChime = useCallback((type: 'success' | 'warning') => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'success') {
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(320, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch {}
  }, [soundEnabled]);

  // Save Record
  const handleSaveAngle = (angleVal: number, source: 'manual' | 'live') => {
    const isSafe = angleVal <= safeMaxFlexion;
    const now = new Date();
    const newRecord: AngleRecord = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      timestamp: now.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      leg,
      flexionAngle: angleVal,
      internalAngle: 180 - angleVal,
      safeLimit: safeMaxFlexion,
      isSafe,
      source,
      note: isSafe ? `Trong ngưỡng an toàn (≤ ${safeMaxFlexion}°)` : `Vượt ngưỡng an toàn (${safeMaxFlexion}°)`,
    };

    const updated = [newRecord, ...historyRecords];
    try {
      localStorage.setItem('goikhoe_angle_history', JSON.stringify(updated));
      setHistoryRecords(updated);
    } catch {}

    if (onRecordSaved) {
      onRecordSaved(newRecord);
    }

    playChime(isSafe ? 'success' : 'warning');
    setSaveSuccessMsg(`Đã ghi nhận góc gập ${angleVal}° (${leg === 'left' ? 'Gối Trái' : 'Gối Phải'})`);
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  // ==========================================
  // CAMERA STREAM & MEDIAPIPE (TAB 2)
  // ==========================================
  const startCamera = async () => {
    smoothedPointsRef.current = { hip: null, knee: null, ankle: null };
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setCameraActive(true);
        };
      }
    } catch (err) {
      console.warn('Camera access error:', err);
      setCameraActive(false);
    }
  };

  const stopCamera = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setLiveAngle(null);
  }, []);

  const toggleFacingMode = async () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    smoothedPointsRef.current = { hip: null, knee: null, ankle: null };
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (cameraActive) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: nextMode, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => videoRef.current?.play();
        }
      } catch (e) {
        console.warn('Flip cam error:', e);
      }
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Load PoseLandmarker when entering camera mode
  useEffect(() => {
    if (mode !== 'camera') {
      stopCamera();
      return;
    }

    let isCancelled = false;
    const initPose = async () => {
      if (poseLandmarkerRef.current) return;
      try {
        setIsLoadingModel(true);
        setModelError(null);
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
        );
        if (isCancelled) return;

        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.25,
          minPosePresenceConfidence: 0.25,
          minTrackingConfidence: 0.25,
        });
        if (isCancelled) return;
        poseLandmarkerRef.current = landmarker;
        setIsLoadingModel(false);
      } catch (err: any) {
        console.error('Pose load error:', err);
        if (!isCancelled) {
          setModelError('Không thể tải AI thị giác. Bạn có thể dùng Thước Đối Chiếu trực quan.');
          setIsLoadingModel(false);
        }
      }
    };

    initPose();
    return () => {
      isCancelled = true;
    };
  }, [mode, stopCamera]);

  // Video Frame Loop
  const calculateKneeAngle = (hip: Point2D, knee: Point2D, ankle: Point2D) => {
    const v1 = { x: hip.x - knee.x, y: hip.y - knee.y };
    const v2 = { x: ankle.x - knee.x, y: ankle.y - knee.y };
    const dotProduct = v1.x * v2.x + v1.y * v2.y;
    const mag1 = Math.hypot(v1.x, v1.y);
    const mag2 = Math.hypot(v2.x, v2.y);
    if (mag1 === 0 || mag2 === 0) return { internalAngle: 180, flexionAngle: 0 };
    let cosAngle = Math.max(-1, Math.min(1, dotProduct / (mag1 * mag2)));
    const angleRad = Math.acos(cosAngle);
    const internalAngle = (angleRad * 180) / Math.PI;
    const flexionAngle = Math.max(0, 180 - internalAngle);
    return { internalAngle, flexionAngle };
  };

  const predictVideoFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !poseLandmarkerRef.current || !cameraActive) {
      animationFrameRef.current = requestAnimationFrame(predictVideoFrame);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx || video.readyState < 2 || video.paused || video.ended) {
      animationFrameRef.current = requestAnimationFrame(predictVideoFrame);
      return;
    }

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    const now = performance.now();
    if (now - lastInferenceTimeRef.current >= 32) {
      lastInferenceTimeRef.current = now;
      try {
        const results = poseLandmarkerRef.current.detectForVideo(video, now);
        if (results.landmarks && results.landmarks.length > 0) {
          const lm = results.landmarks[0];
          const isLeft = leg === 'left';
          const hip = lm[isLeft ? 23 : 24];
          const knee = lm[isLeft ? 25 : 26];
          const ankle = lm[isLeft ? 27 : 28] || lm[isLeft ? 29 : 30];

          if (knee && (hip || ankle)) {
            const rawH = hip ? { x: hip.x * canvas.width, y: hip.y * canvas.height } : { x: knee.x * canvas.width - 60, y: Math.max(10, knee.y * canvas.height - 180) };
            const rawK = { x: knee.x * canvas.width, y: knee.y * canvas.height };
            const rawA = ankle ? { x: ankle.x * canvas.width, y: ankle.y * canvas.height } : { x: knee.x * canvas.width - 40, y: Math.min(canvas.height - 10, knee.y * canvas.height + 180) };

            const hPt = smoothPoint(smoothedPointsRef.current.hip, rawH, 0.25);
            const kPt = smoothPoint(smoothedPointsRef.current.knee, rawK, 0.25);
            const aPt = smoothPoint(smoothedPointsRef.current.ankle, rawA, 0.25);
            smoothedPointsRef.current = { hip: hPt, knee: kPt, ankle: aPt };

            const { flexionAngle } = calculateKneeAngle(hPt, kPt, aPt);
            const r = Math.round(flexionAngle);
            if (displayAngleRef.current === null || Math.abs(r - displayAngleRef.current) >= 1) {
              displayAngleRef.current = r;
              setLiveAngle(r);
            }
          }
        }
      } catch (e) {
        console.warn('Frame error:', e);
      }
    }

    // Render skeleton lines on canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const pts = smoothedPointsRef.current;
    if (pts.hip && pts.knee && pts.ankle && displayAngleRef.current !== null) {
      const { hip: h, knee: k, ankle: a } = pts;
      const isSafe = displayAngleRef.current <= safeMaxFlexion;
      const color = isSafe ? '#10b981' : '#f43f5e';

      ctx.save();
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.strokeStyle = color;
      ctx.shadowColor = isSafe ? 'rgba(16,185,129,0.4)' : 'rgba(244,63,94,0.5)';
      ctx.shadowBlur = 12;

      ctx.beginPath();
      ctx.moveTo(h.x, h.y);
      ctx.lineTo(k.x, k.y);
      ctx.lineTo(a.x, a.y);
      ctx.stroke();

      const drawPoint = (p: Point2D) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 8, 0, 2 * Math.PI);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.stroke();
      };
      drawPoint(h);
      drawPoint(k);
      drawPoint(a);
      ctx.restore();
    }

    animationFrameRef.current = requestAnimationFrame(predictVideoFrame);
  }, [leg, safeMaxFlexion, cameraActive]);

  useEffect(() => {
    if (cameraActive) {
      animationFrameRef.current = requestAnimationFrame(predictVideoFrame);
    } else if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [cameraActive, predictVideoFrame]);

  // Reference Landmarks for Visual Matcher
  const landmarksDescriptions: Record<number, { title: string; desc: string }> = {
    0: { title: '0° (Duỗi thẳng hoàn toàn)', desc: 'Chân ép sát mặt giường. Bắt buộc phải đạt sớm để tránh đi khập khiễng.' },
    30: { title: '30° (Nhấc gối nhẹ)', desc: 'Gót chân cách mông khoảng 2 gang tay (~40cm). Thường đạt ở tuần 1.' },
    60: { title: '60° (Nửa tầm vận động)', desc: 'Đầu gối gập góc thoai thoải, gót cách mông ~28cm. Mốc quan trọng tuần 1 - 2.' },
    90: { title: '90° (Đầu gối vuông góc)', desc: 'Cẳng chân thẳng đứng vuông góc mặt giường. Trần an toàn tối đa của Giai đoạn 1.' },
    110: { title: '110° (Gập sâu)', desc: 'Gót chân kéo gần vào mông (~15cm). Thường bắt đầu tập từ tuần 3 - 4.' },
    120: { title: '120° (Gần chạm mông)', desc: 'Khớp gối gập sâu, gót chân cách mông dưới 10cm. Giai đoạn 5 - 6 tuần.' },
    135: { title: '135° (Gót chạm sát mông)', desc: 'Biên độ gập gối bình thường tối đa của người khỏe mạnh.' },
  };

  // Find nearest descriptive benchmark
  const getBenchmark = (deg: number) => {
    if (deg <= 10) return landmarksDescriptions[0];
    if (deg <= 40) return landmarksDescriptions[30];
    if (deg <= 75) return landmarksDescriptions[60];
    if (deg <= 95) return landmarksDescriptions[90];
    if (deg <= 115) return landmarksDescriptions[110];
    if (deg <= 125) return landmarksDescriptions[120];
    return landmarksDescriptions[135];
  };

  const currentBenchmark = getBenchmark(visualAngle);
  const isVisualSafe = visualAngle <= safeMaxFlexion;

  return (
    <div className="bg-[#16181F] text-white rounded-[32px] p-5 border border-white/[0.08] shadow-2xl space-y-4 font-sans select-none">
      {/* 1. Header: Trực diện vào bản chất Y Khoa */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-medium text-emerald-400 uppercase tracking-wider">
              Phục Hồi Khớp Gối • Kiểm Soát Biên Độ ROM
            </span>
          </div>
          <h2 className="text-xl font-light text-white tracking-tight">
            Theo Dõi Góc Gập Gối
          </h2>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowHistoryModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/10 text-slate-300 text-xs font-normal border border-white/10 transition"
          >
            <History className="w-3.5 h-3.5 text-emerald-400" />
            <span>Lịch sử ({historyRecords.length})</span>
          </button>
        </div>
      </div>

      {/* 2. BẢNG MỤC TIÊU GIAI ĐOẠN HIỆN TẠI (Trả lời câu hỏi 1: Tối đa & tối thiểu bao nhiêu độ) */}
      <div className="p-4 bg-white/[0.03] rounded-2xl border border-white/[0.06] space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400 font-light flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Mục tiêu tuần này của bạn:</span>
          </span>
          <span className="text-[11px] text-slate-400">
            Chân mổ: <strong className="text-white">{leg === 'left' ? 'Gối Trái (L)' : 'Gối Phải (R)'}</strong>
          </span>
        </div>

        {/* 2 Big Target Cards: Min (Extension) & Max (Flexion) */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* Min: Full Extension */}
          <div className="p-3 bg-[#0C0D11] rounded-xl border border-white/10 text-center space-y-0.5">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider">Duỗi thẳng tối thiểu</span>
            <div className="text-2xl font-light text-white">0°</div>
            <p className="text-[10px] text-emerald-400 font-light">Chạm sát giường</p>
          </div>

          {/* Max: Safe Flexion limit */}
          <div className="p-3 bg-[#0C0D11] rounded-xl border border-emerald-500/30 text-center space-y-0.5">
            <span className="text-[10px] text-emerald-300 uppercase tracking-wider">Gập tối đa cho phép</span>
            <div className="text-2xl font-light text-emerald-400">{safeMaxFlexion}°</div>
            <p className="text-[10px] text-slate-400 font-light">Không vượt quá trần</p>
          </div>
        </div>

        {/* Doctor Note */}
        <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[11px] text-emerald-300 font-light leading-relaxed flex items-start gap-2">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            <strong>Nguyên tắc vàng:</strong> Co gối đến khi bắt đầu <strong>căng đau thì dừng lại giữ 5 giây</strong>, tuyệt đối <strong>không gập quá {safeMaxFlexion}°</strong> trong giai đoạn này để bảo vệ mảnh ghép dây chằng mới mổ.
          </span>
        </div>
      </div>

      {/* 3. LỰA CHỌN CÔNG CỤ: THƯỚC TRỰC QUAN vs CAMERA SOI THẲNG */}
      <div className="grid grid-cols-2 p-1 bg-[#0C0D11] rounded-2xl border border-white/[0.06] gap-1">
        <button
          onClick={() => {
            setMode('visual');
            stopCamera();
          }}
          className={`py-2 px-3 rounded-xl text-xs font-medium transition flex items-center justify-center gap-1.5 ${
            mode === 'visual'
              ? 'bg-emerald-500 text-slate-950 shadow-md font-semibold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Thước So Khớp (Nhanh 2s)</span>
        </button>

        <button
          onClick={() => setMode('camera')}
          className={`py-2 px-3 rounded-xl text-xs font-medium transition flex items-center justify-center gap-1.5 ${
            mode === 'camera'
              ? 'bg-emerald-500 text-slate-950 shadow-md font-semibold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Camera Soi Góc</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* CÔNG CỤ 1: THƯỚC SO KHỚP TRỰC QUAN (Trả lời câu hỏi 2: Co mức đau là bao nhiêu độ) */}
      {/* ========================================================================= */}
      {mode === 'visual' && (
        <div className="space-y-4 animate-fade-in">
          {/* Dynamic Interactive Anatomical Leg Visualizer */}
          <div className="bg-[#0C0D11] rounded-[28px] p-5 border border-white/[0.08] relative overflow-hidden flex flex-col items-center justify-center text-center shadow-inner space-y-4">
            {/* Visual SVG Leg Diagram responding dynamically to visualAngle */}
            <div className="relative w-full max-w-[280px] h-40 flex items-center justify-center">
              <svg className="w-full h-full" viewBox="0 0 280 150">
                {/* Bed Mattress Horizon */}
                <line x1="20" y1="130" x2="260" y2="130" stroke="rgba(255,255,255,0.15)" strokeWidth="3" strokeDasharray="6,4" />
                <text x="30" y="144" fill="#64748b" fontSize="10" fontWeight="300">Mặt giường nằm</text>

                {/* Torso/Hip Anchor */}
                <circle cx="50" cy="120" r="10" fill="#334155" />
                <text x="35" y="105" fill="#94a3b8" fontSize="10">Hông</text>

                {/* Dynamic Leg Kinematics */}
                {(() => {
                  // Hip at (50, 120)
                  const hipX = 50;
                  const hipY = 120;
                  const femurLength = 75; // Thigh
                  const tibiaLength = 75; // Shank

                  // Angle of flexion: θ
                  // When θ = 0°: thigh is horizontal, shank is horizontal. Leg flat on bed.
                  // As θ increases to 90°: Knee elevates, thigh tilts up by ~40°, shank bends backwards.
                  const rad = (visualAngle * Math.PI) / 180;
                  const thighTilt = Math.min(0.7, rad * 0.45); // radians thigh lifts from bed

                  const kneeX = hipX + femurLength * Math.cos(thighTilt);
                  const kneeY = hipY - femurLength * Math.sin(thighTilt);

                  // Angle of shank relative to thigh
                  const shankAngle = thighTilt - (Math.PI - rad);
                  const footX = kneeX + tibiaLength * Math.cos(shankAngle);
                  const footY = Math.min(130, kneeY - tibiaLength * Math.sin(shankAngle));

                  const isSafe = visualAngle <= safeMaxFlexion;
                  const strokeColor = isSafe ? '#10b981' : '#f43f5e';

                  return (
                    <g>
                      {/* Thigh Bone */}
                      <line x1={hipX} y1={hipY} x2={kneeX} y2={kneeY} stroke="#ffffff" strokeWidth="6" strokeLinecap="round" />
                      {/* Shin Bone */}
                      <line x1={kneeX} y1={kneeY} x2={footX} y2={footY} stroke={strokeColor} strokeWidth="6" strokeLinecap="round" />
                      {/* Knee Joint Circle */}
                      <circle cx={kneeX} cy={kneeY} r="9" fill={strokeColor} stroke="#ffffff" strokeWidth="2" />
                      <text x={kneeX - 12} y={kneeY - 14} fill={strokeColor} fontSize="11" fontWeight="bold">
                        {visualAngle}°
                      </text>
                      {/* Foot/Heel Anchor */}
                      <circle cx={footX} cy={footY} r="7" fill="#64748b" />
                      <text x={footX - 10} y={footY + 14} fill="#94a3b8" fontSize="10">Gót chân</text>
                    </g>
                  );
                })()}
              </svg>
            </div>

            {/* Big Degree Display & Status */}
            <div className="space-y-1">
              <div className="flex items-center justify-center gap-2">
                <span className={`text-5xl font-light tracking-tight tabular-nums ${
                  isVisualSafe ? 'text-white' : 'text-rose-400'
                }`}>
                  {visualAngle}°
                </span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium border flex items-center gap-1 ${
                  isVisualSafe
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300 animate-pulse'
                }`}>
                  {isVisualSafe ? (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>An toàn (≤ {safeMaxFlexion}°)</span>
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                      <span>VƯỢT GIỚI HẠN!</span>
                    </>
                  )}
                </span>
              </div>

              {/* Clinical Landmark Description */}
              <div className="text-xs text-slate-300 font-light max-w-xs leading-relaxed pt-1">
                <strong className="text-white font-medium">{currentBenchmark.title}:</strong> {currentBenchmark.desc}
              </div>
            </div>

            {/* Interactive Slider */}
            <div className="w-full space-y-2 pt-2">
              <input
                type="range"
                min="0"
                max="135"
                step="5"
                value={visualAngle}
                onChange={(e) => setVisualAngle(Number(e.target.value))}
                className="w-full accent-emerald-400 h-2 bg-white/10 rounded-lg cursor-pointer"
              />

              {/* Quick Benchmark Pills */}
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                {[0, 30, 60, 90, 110, 120].map((deg) => (
                  <button
                    key={deg}
                    onClick={() => setVisualAngle(deg)}
                    className={`px-2 py-0.5 rounded-md transition ${
                      visualAngle === deg
                        ? 'bg-white text-slate-950 font-bold'
                        : 'hover:text-white'
                    }`}
                  >
                    {deg}°
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Action button */}
          <button
            onClick={() => handleSaveAngle(visualAngle, 'manual')}
            className="w-full py-3.5 px-5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-bold rounded-full text-xs transition flex items-center justify-center gap-2 shadow-lg"
          >
            <BookmarkPlus className="w-4 h-4" />
            <span>Lưu Số Đo Hôm Nay ({visualAngle}°) Vào Phác Đồ</span>
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CÔNG CỤ 2: CAMERA SOI THẲNG ĐƠN GIẢN (Mở lên là thấy góc, không hẹn giờ) */}
      {/* ========================================================================= */}
      {mode === 'camera' && (
        <div className="space-y-4 animate-fade-in">
          {/* Viewport */}
          <div className="relative aspect-[3/4] max-h-[440px] w-full bg-[#0C0D11] rounded-[28px] overflow-hidden border border-white/[0.08] flex items-center justify-center shadow-inner">
            {/* Live Video */}
            <video
              ref={videoRef}
              playsInline
              muted
              className={`absolute inset-0 w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'} ${
                facingMode === 'user' ? 'scale-x-[-1]' : ''
              }`}
            />

            {/* Skeleton Canvas */}
            <canvas
              ref={canvasRef}
              className={`absolute inset-0 w-full h-full pointer-events-none ${cameraActive ? 'block' : 'hidden'} ${
                facingMode === 'user' ? 'scale-x-[-1]' : ''
              }`}
            />

            {/* Standby State */}
            {!cameraActive && (
              <div className="p-6 text-center max-w-xs text-slate-400 space-y-3 z-10">
                <div className="w-14 h-14 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center mx-auto text-emerald-400 shadow-xl">
                  <Camera className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-white font-medium">Camera Đang Tắt</p>
                  <p className="text-xs text-slate-400 font-light leading-relaxed">
                    Bật camera và quay ngang khớp gối để thấy ngay số độ hiện tại trên màn hình.
                  </p>
                </div>
                <button
                  onClick={startCamera}
                  disabled={isLoadingModel}
                  className="py-3 px-6 bg-white hover:bg-slate-100 text-slate-950 font-bold rounded-full text-xs transition shadow-xl mx-auto flex items-center gap-2"
                >
                  <Camera className="w-4 h-4" />
                  <span>Bật Camera Soi Góc</span>
                </button>
              </div>
            )}

            {/* Live Big Angle Badge */}
            {cameraActive && liveAngle !== null && (
              <div className="absolute top-4 left-4 bg-[#16181F]/90 backdrop-blur-xl border border-white/20 rounded-2xl p-3 shadow-2xl flex items-center gap-3 z-20">
                <div
                  className={`text-4xl font-light tracking-tight tabular-nums px-3 py-1 rounded-xl ${
                    liveAngle > safeMaxFlexion
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  }`}
                >
                  {liveAngle}°
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">Độ gập chân hiện tại</div>
                  <div
                    className={`text-xs font-medium flex items-center gap-1 ${
                      liveAngle <= safeMaxFlexion ? 'text-emerald-300' : 'text-rose-400 font-bold'
                    }`}
                  >
                    {liveAngle <= safeMaxFlexion ? `An toàn (≤ ${safeMaxFlexion}°)` : '⚠️ VƯỢT GIỚI HẠN! DỪNG LẠI'}
                  </div>
                </div>
              </div>
            )}

            {/* Floating Camera Flip */}
            {cameraActive && (
              <div className="absolute top-4 right-4 z-20">
                <button
                  onClick={toggleFacingMode}
                  className="p-2.5 rounded-full bg-[#16181F]/80 backdrop-blur-md border border-white/20 text-white hover:bg-black shadow-xl"
                  title="Đổi camera trước/sau"
                >
                  <FlipHorizontal className="w-4 h-4 text-emerald-400" />
                </button>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2.5">
            {cameraActive ? (
              <button
                onClick={stopCamera}
                className="py-3 px-4 rounded-full border border-white/10 text-slate-300 hover:text-white text-xs font-medium"
              >
                Tắt Camera
              </button>
            ) : (
              <button
                onClick={startCamera}
                disabled={isLoadingModel}
                className="py-3 px-4 bg-white text-slate-950 font-bold rounded-full text-xs"
              >
                Bật Camera
              </button>
            )}

            <button
              onClick={() => handleSaveAngle(liveAngle || 0, 'live')}
              disabled={!cameraActive || liveAngle === null}
              className="py-3 px-4 bg-emerald-500 hover:bg-emerald-400 active:scale-95 disabled:opacity-40 disabled:pointer-events-none text-slate-950 font-bold rounded-full text-xs transition flex items-center justify-center gap-1.5 shadow-lg"
            >
              <BookmarkPlus className="w-4 h-4" />
              <span>Lưu Góc Này ({liveAngle || 0}°)</span>
            </button>
          </div>
        </div>
      )}

      {/* Success Notification Toast */}
      {saveSuccessMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 px-3.5 py-2.5 rounded-2xl text-xs font-light flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed sm:absolute inset-0 z-50 bg-[#0C0D11]/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#16181F] border border-white/[0.08] rounded-[32px] max-w-md w-full max-h-[85vh] flex flex-col shadow-2xl text-white">
            <div className="p-5 border-b border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-emerald-400" />
                <h3 className="font-light text-white text-base">Lịch Sử Biên Độ Gối (ROM)</h3>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-3">
              {historyRecords.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs font-light">
                  Chưa có lần đo nào được ghi nhận.
                </div>
              ) : (
                historyRecords.map((record) => (
                  <div
                    key={record.id}
                    className="p-3.5 bg-white/[0.03] border border-white/[0.06] rounded-2xl flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center font-light text-lg ${
                          record.isSafe
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                        }`}
                      >
                        {record.flexionAngle}°
                      </div>
                      <div>
                        <div className="text-xs font-medium text-white flex items-center gap-1.5">
                          <span>{record.leg === 'left' ? 'Gối Trái (L)' : 'Gối Phải (R)'}</span>
                          <span className="text-[10px] font-light text-slate-400">
                            • {record.source === 'live' ? 'Camera' : 'Thước đối chiếu'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-light mt-0.5">{record.timestamp}</div>
                        <div className={`text-[10px] font-medium mt-0.5 ${record.isSafe ? 'text-emerald-400' : 'text-rose-400'}`}>
                          Giới hạn: ≤ {record.safeLimit}° ({record.isSafe ? 'An toàn' : 'Vượt giới hạn'})
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        const updated = historyRecords.filter((r) => r.id !== record.id);
                        try {
                          localStorage.setItem('goikhoe_angle_history', JSON.stringify(updated));
                          setHistoryRecords(updated);
                        } catch {}
                      }}
                      className="p-2 text-slate-500 hover:text-rose-400 rounded-lg transition"
                      title="Xóa"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {historyRecords.length > 0 && (
              <div className="p-4 border-t border-white/[0.06] flex justify-end">
                <button
                  onClick={() => {
                    if (confirm('Xóa toàn bộ lịch sử?')) {
                      localStorage.setItem('goikhoe_angle_history', JSON.stringify([]));
                      setHistoryRecords([]);
                    }
                  }}
                  className="px-3 py-1.5 text-xs text-rose-400 hover:text-rose-300 font-light transition"
                >
                  Xóa tất cả
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
