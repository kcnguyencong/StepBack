'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  Upload,
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
  Play,
  RotateCcw,
  Trophy,
  Check,
  Timer,
  Crosshair,
  Sparkles,
  Move,
  HelpCircle,
  Activity,
  ArrowRight
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

type SessionState = 'IDLE' | 'COUNTDOWN' | 'MEASURING' | 'PEAK_LOCKED' | 'LIVE_FREE';

// Exponential low-pass filter for smooth landmark tracking
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
  // Main Autonomous Session State Machine
  const [sessionState, setSessionState] = useState<SessionState>('IDLE');
  const [countdown, setCountdown] = useState<number>(8);
  const [measuringSecondsLeft, setMeasuringSecondsLeft] = useState<number>(15);
  const [leg, setLeg] = useState<'left' | 'right'>(selectedLeg);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  // Real-time Angle Tracking
  const [liveAngle, setLiveAngle] = useState<number | null>(null);
  const [peakAngle, setPeakAngle] = useState<number>(0);
  const [lockedResult, setLockedResult] = useState<AngleRecord | null>(null);

  // Model & Hardware
  const [isLoadingModel, setIsLoadingModel] = useState<boolean>(true);
  const [modelError, setModelError] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [jointGuidance, setJointGuidance] = useState<string>('Đang tìm khớp gối...');
  const [jointReady, setJointReady] = useState<{ hip: boolean; knee: boolean; ankle: boolean }>({
    hip: false,
    knee: false,
    ankle: false,
  });

  // History & Tools
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);
  const [showManualTools, setShowManualTools] = useState<boolean>(false);
  const [isManualCaliper, setIsManualCaliper] = useState<boolean>(false);
  const [caliperPoints, setCaliperPoints] = useState<{ hip: Point2D; knee: Point2D; ankle: Point2D }>({
    hip: { x: 120, y: 110 },
    knee: { x: 210, y: 220 },
    ankle: { x: 140, y: 340 },
  });
  const [draggingNode, setDraggingNode] = useState<'hip' | 'knee' | 'ankle' | null>(null);
  const [isPhotoFallback, setIsPhotoFallback] = useState<boolean>(false);
  const [historyRecords, setHistoryRecords] = useState<AngleRecord[]>([]);

  // Refs for video & inference
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const photoCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Peak Auto-Lock Tracking Refs
  const currentMaxAngleRef = useRef<number>(0);
  const dropCounterRef = useRef<number>(0);
  const sessionStartTimeRef = useRef<number>(0);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const smoothedPointsRef = useRef<{ hip: Point2D | null; knee: Point2D | null; ankle: Point2D | null }>({
    hip: null,
    knee: null,
    ankle: null,
  });
  const lastInferenceTimeRef = useRef<number>(0);
  const lastReactUpdateRef = useRef<number>(0);
  const displayAngleRef = useRef<number | null>(null);

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

  // Audio chimes
  const playChime = useCallback((type: 'success' | 'warning' | 'beep' | 'tick') => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'success') {
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.15); // G5
        osc.frequency.exponentialRampToValueAtTime(1046.5, ctx.currentTime + 0.3); // C6
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      } else if (type === 'beep') {
        osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else if (type === 'tick') {
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(320, ctx.currentTime);
        gain.gain.setValueAtTime(0.22, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.28);
        osc.start();
        osc.stop(ctx.currentTime + 0.28);
      }
    } catch {}
  }, [soundEnabled]);

  // Speech feedback helper
  const speakVoice = (text: string) => {
    if (!soundEnabled) return;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'vi-VN';
        u.rate = 1.05;
        window.speechSynthesis.speak(u);
      } catch {}
    }
  };

  // Initialize MediaPipe PoseLandmarker
  useEffect(() => {
    let isCancelled = false;
    const initPoseLandmarker = async () => {
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
        console.error('PoseLandmarker init error:', err);
        if (!isCancelled) {
          setModelError('Không thể tải AI thị giác. Bạn có thể sử dụng tính năng tải ảnh.');
          setIsLoadingModel(false);
        }
      }
    };

    initPoseLandmarker();

    return () => {
      isCancelled = true;
      if (poseLandmarkerRef.current) {
        poseLandmarkerRef.current.close();
        poseLandmarkerRef.current = null;
      }
    };
  }, []);

  // Compute angle between Thigh (Hip-Knee) and Shin (Knee-Ankle)
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

    // True clinical flexion: 0° is straight leg, 90° is right angle, 135° is max
    const flexionAngle = Math.max(0, 180 - internalAngle);
    return { internalAngle, flexionAngle };
  };

  // Start Camera Stream
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
        };
      }
      return true;
    } catch (err) {
      console.warn('Camera stream error:', err);
      setIsPhotoFallback(true);
      return false;
    }
  };

  // Toggle Camera Front / Back (Selfie vs Rear)
  const toggleFacingMode = async () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    smoothedPointsRef.current = { hip: null, knee: null, ankle: null };

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (sessionState !== 'IDLE') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: nextMode, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
          };
        }
      } catch (err) {
        console.warn('Flip camera error:', err);
      }
    }
  };

  // Stop Camera Stream
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
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Lock Peak & Save Record Automatically
  const lockPeakAndAutoSave = useCallback((finalPeak: number) => {
    if (sessionState === 'PEAK_LOCKED') return;

    setSessionState('PEAK_LOCKED');
    playChime('success');
    speakVoice(`Đã chốt ${finalPeak} độ!`);

    const isSafe = finalPeak <= safeMaxFlexion;
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
      flexionAngle: finalPeak,
      internalAngle: 180 - finalPeak,
      safeLimit: safeMaxFlexion,
      isSafe,
      source: isManualCaliper ? 'manual' : 'live',
      note: isSafe ? 'Trong giới hạn an toàn' : 'Vượt giới hạn an toàn',
    };

    setLockedResult(newRecord);

    const updated = [newRecord, ...historyRecords];
    try {
      localStorage.setItem('goikhoe_angle_history', JSON.stringify(updated));
      setHistoryRecords(updated);
    } catch {}

    if (onRecordSaved) {
      onRecordSaved(newRecord);
    }
  }, [sessionState, safeMaxFlexion, leg, isManualCaliper, historyRecords, onRecordSaved, playChime]);

  // Start Autonomous Zero-Touch Session (8s Countdown + 15s Active Exercise Window)
  const handleStartAutonomousSession = async () => {
    setLockedResult(null);
    setPeakAngle(0);
    setLiveAngle(null);
    currentMaxAngleRef.current = 0;
    dropCounterRef.current = 0;

    await startCamera();
    setSessionState('COUNTDOWN');
    setCountdown(8);
    playChime('beep');
    speakVoice('Chuẩn bị nằm lên giường. Đo bắt đầu sau 8 giây.');

    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    let sec = 8;
    countdownIntervalRef.current = setInterval(() => {
      sec -= 1;
      setCountdown(sec);

      if (sec === 3 || sec === 2 || sec === 1) {
        playChime('beep');
      }

      if (sec <= 0) {
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;

        // Transition to active 15s measuring phase
        setSessionState('MEASURING');
        setMeasuringSecondsLeft(15);
        sessionStartTimeRef.current = performance.now();
        currentMaxAngleRef.current = 0;
        dropCounterRef.current = 0;
        playChime('beep');
        speakVoice('Bắt đầu co gối từ từ, bạn có 15 giây');

        // Start 15-second exercise countdown timer
        let mSec = 15;
        countdownIntervalRef.current = setInterval(() => {
          mSec -= 1;
          setMeasuringSecondsLeft(mSec);

          if (mSec <= 0) {
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;

            // Session completed! Lock highest peak reached in the 15s window
            const finalPeak = currentMaxAngleRef.current > 0 ? currentMaxAngleRef.current : (displayAngleRef.current || 0);
            lockPeakAndAutoSave(finalPeak);
          }
        }, 1000);
      }
    }, 1000);
  };

  // Start Free Live Camera (No timers, practice freely)
  const handleStartLiveFree = async () => {
    setLockedResult(null);
    setPeakAngle(0);
    setLiveAngle(null);
    currentMaxAngleRef.current = 0;
    dropCounterRef.current = 0;

    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    await startCamera();
    setSessionState('LIVE_FREE');
    playChime('beep');
  };

  // Video Prediction Loop with Auto Peak Detection
  const predictVideoFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !poseLandmarkerRef.current) {
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
    const isTimeToInfer = now - lastInferenceTimeRef.current >= 32; // ~30fps

    if (isTimeToInfer && sessionState !== 'PEAK_LOCKED') {
      lastInferenceTimeRef.current = now;

      try {
        const results = poseLandmarkerRef.current.detectForVideo(video, now);
        if (results.landmarks && results.landmarks.length > 0) {
          const lm = results.landmarks[0];
          const isLeft = leg === 'left';
          const hip = lm[isLeft ? 23 : 24];
          const knee = lm[isLeft ? 25 : 26];
          const ankle = lm[isLeft ? 27 : 28] || lm[isLeft ? 29 : 30];

          const isKneeOk = Boolean(knee && (knee.visibility === undefined || knee.visibility > 0.18));
          const isHipOk = Boolean(hip && (hip.visibility === undefined || hip.visibility > 0.12 || (isKneeOk && hip.y < 0.28)));
          const isAnkleOk = Boolean(ankle && (ankle.visibility === undefined || ankle.visibility > 0.12 || (isKneeOk && ankle.y > 0.72)));

          let guidance = 'Đang tìm chân...';
          if (!isKneeOk) guidance = 'Đặt camera nhìn ngang mặt bên của gối (~1m)';
          else if (!isHipOk && !isAnkleOk) guidance = 'Lùi camera xa để thấy đủ cả Đùi và Cẳng chân';
          else if (!isHipOk) guidance = 'Camera đang bị thiếu phần Hông/Đùi';
          else if (!isAnkleOk) guidance = 'Camera đang bị thiếu phần Cổ chân';
          else guidance = '✅ Đang bắt chuẩn góc Đùi & Cẳng chân';

          if (now - lastReactUpdateRef.current > 120) {
            setJointGuidance(guidance);
            setJointReady({ hip: isHipOk, knee: isKneeOk, ankle: isAnkleOk });
          }

          if (isHipOk && isKneeOk && isAnkleOk) {
            const rawH = { x: hip.x * canvas.width, y: hip.y * canvas.height };
            const rawK = { x: knee.x * canvas.width, y: knee.y * canvas.height };
            const rawA = { x: ankle.x * canvas.width, y: ankle.y * canvas.height };

            const hPt = smoothPoint(smoothedPointsRef.current.hip, rawH, 0.25);
            const kPt = smoothPoint(smoothedPointsRef.current.knee, rawK, 0.25);
            const aPt = smoothPoint(smoothedPointsRef.current.ankle, rawA, 0.25);
            smoothedPointsRef.current = { hip: hPt, knee: kPt, ankle: aPt };
          }
        }
      } catch (err) {
        console.warn('Landmark predict error:', err);
      }
    }

    // Render skeleton & goniometer overlay
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const pts = smoothedPointsRef.current;

    if (pts.hip && pts.knee && pts.ankle) {
      const { hip: hPt, knee: kPt, ankle: aPt } = pts;
      const { flexionAngle } = calculateKneeAngle(hPt, kPt, aPt);

      if (displayAngleRef.current === null || Math.abs(flexionAngle - displayAngleRef.current) >= 0.75) {
        displayAngleRef.current = Math.round(flexionAngle);
      }
      const stableFlexion = displayAngleRef.current;
      const isSafe = stableFlexion <= safeMaxFlexion;
      const lineColor = !isSafe ? '#f43f5e' : stableFlexion > safeMaxFlexion - 10 ? '#fbbf24' : '#10b981';

      ctx.save();
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.strokeStyle = lineColor;
      ctx.shadowColor = !isSafe ? 'rgba(244,63,94,0.5)' : 'rgba(16,185,129,0.4)';
      ctx.shadowBlur = 14;

      // Draw Femur (Thigh) and Tibia (Shin) lines
      ctx.beginPath();
      ctx.moveTo(hPt.x, hPt.y);
      ctx.lineTo(kPt.x, kPt.y);
      ctx.lineTo(aPt.x, aPt.y);
      ctx.stroke();

      // Knee Arc
      const angleV1 = Math.atan2(hPt.y - kPt.y, hPt.x - kPt.x);
      const angleV2 = Math.atan2(aPt.y - kPt.y, aPt.x - kPt.x);
      const arcRadius = Math.min(80, Math.hypot(hPt.x - kPt.x, hPt.y - kPt.y) * 0.35);

      ctx.beginPath();
      ctx.moveTo(kPt.x, kPt.y);
      ctx.arc(kPt.x, kPt.y, arcRadius, angleV1, angleV2, false);
      ctx.fillStyle = !isSafe ? 'rgba(244,63,94,0.22)' : 'rgba(16,185,129,0.2)';
      ctx.fill();

      // Nodes
      const drawNode = (p: Point2D, r: number) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, 2 * Math.PI);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 3;
        ctx.stroke();
      };
      drawNode(hPt, 6);
      drawNode(kPt, 11);
      drawNode(aPt, 6);

      ctx.restore();

      // Update React UI state
      if (now - lastReactUpdateRef.current > 120) {
        lastReactUpdateRef.current = now;
        setLiveAngle(stableFlexion);

        // ========================================================
        // AUTONOMOUS PEAK DETECTION ALGORITHM (REVERSE MOVEMENT)
        // ========================================================
        if (sessionState === 'MEASURING' || sessionState === 'LIVE_FREE') {
          // Track highest point reached
          if (stableFlexion > currentMaxAngleRef.current) {
            currentMaxAngleRef.current = stableFlexion;
            setPeakAngle(stableFlexion);
            dropCounterRef.current = 0;
            playChime('tick');
          } else if (sessionState === 'MEASURING') {
            const elapsed = (now - sessionStartTimeRef.current) / 1000;
            // ONLY auto-lock early if:
            // 1. At least 7 seconds of active exercise have passed
            // 2. Peak reached was significant (>= 40°)
            // 3. Leg has extended back down by >= 12° from peak
            // 4. Extended state persisted for 8 consecutive checks (~1 second)
            if (elapsed >= 7 && currentMaxAngleRef.current >= 40 && stableFlexion <= currentMaxAngleRef.current - 12) {
              dropCounterRef.current += 1;
              if (dropCounterRef.current >= 8) {
                if (countdownIntervalRef.current) {
                  clearInterval(countdownIntervalRef.current);
                  countdownIntervalRef.current = null;
                }
                lockPeakAndAutoSave(currentMaxAngleRef.current);
              }
            } else {
              dropCounterRef.current = 0;
            }
          }
        }
      }
    }

    animationFrameRef.current = requestAnimationFrame(predictVideoFrame);
  }, [leg, safeMaxFlexion, sessionState, lockPeakAndAutoSave, playChime]);

  useEffect(() => {
    if (sessionState === 'MEASURING' || sessionState === 'COUNTDOWN' || sessionState === 'LIVE_FREE') {
      animationFrameRef.current = requestAnimationFrame(predictVideoFrame);
    } else if (sessionState === 'IDLE' && animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [sessionState, predictVideoFrame]);

  // Pointer drag events for optional manual caliper fine-tuning
  const handlePointerDown = (node: 'hip' | 'knee' | 'ankle') => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDraggingNode(node);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isManualCaliper || !draggingNode || !viewportRef.current) return;
    const rect = viewportRef.current.getBoundingClientRect();
    const x = Math.max(10, Math.min(rect.width - 10, e.clientX - rect.left));
    const y = Math.max(10, Math.min(rect.height - 10, e.clientY - rect.top));
    setCaliperPoints((prev) => ({ ...prev, [draggingNode]: { x, y } }));
  };

  const handlePointerUp = () => setDraggingNode(null);

  useEffect(() => {
    if (isManualCaliper) {
      const { flexionAngle } = calculateKneeAngle(caliperPoints.hip, caliperPoints.knee, caliperPoints.ankle);
      const r = Math.round(flexionAngle);
      setLiveAngle(r);
      setPeakAngle((p) => Math.max(p, r));
    }
  }, [isManualCaliper, caliperPoints]);

  return (
    <div className="bg-[#16181F] text-white rounded-[32px] p-5 border border-white/[0.08] shadow-2xl space-y-4 font-sans select-none">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-medium text-emerald-400 uppercase tracking-wider">
              Zero-Touch AI Station • Rảnh Tay 100%
            </span>
          </div>
          <h2 className="text-xl font-light text-white tracking-tight">
            Trạm Đo Góc Gập Gối Tự Động
          </h2>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowGuideModal(true)}
            className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/10 text-slate-300 border border-white/10 flex items-center justify-center transition"
            title="Hướng dẫn đo tự động"
          >
            <HelpCircle className="w-4 h-4 text-emerald-400" />
          </button>
          <button
            onClick={() => setShowHistoryModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/10 text-slate-300 text-xs font-normal border border-white/10 transition"
          >
            <History className="w-3.5 h-3.5 text-emerald-400" />
            <span>Lịch sử ({historyRecords.length})</span>
          </button>
        </div>
      </div>

      {/* Selector: Left / Right Leg & Sound */}
      <div className="flex items-center justify-between p-2.5 bg-white/[0.03] rounded-2xl border border-white/[0.06]">
        <div className="flex items-center gap-1 text-xs">
          <span className="text-slate-400 font-light mr-1">Chân mổ:</span>
          <button
            onClick={() => setLeg('left')}
            className={`px-3 py-1 rounded-full transition ${
              leg === 'left' ? 'bg-white text-slate-950 font-medium' : 'text-slate-400 hover:text-white'
            }`}
          >
            Gối Trái (L)
          </button>
          <button
            onClick={() => setLeg('right')}
            className={`px-3 py-1 rounded-full transition ${
              leg === 'right' ? 'bg-white text-slate-950 font-medium' : 'text-slate-400 hover:text-white'
            }`}
          >
            Gối Phải (R)
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Camera Flip Selector (Sau vs Trước/Selfie) */}
          <div className="flex items-center bg-white/[0.04] p-0.5 rounded-full border border-white/10">
            <button
              onClick={() => {
                if (facingMode !== 'environment') toggleFacingMode();
              }}
              className={`px-2.5 py-1 rounded-full text-[11px] transition flex items-center gap-1 ${
                facingMode === 'environment'
                  ? 'bg-white text-slate-950 font-medium shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Dùng camera sau"
            >
              <Camera className="w-3 h-3" />
              <span>Cam Sau</span>
            </button>
            <button
              onClick={() => {
                if (facingMode !== 'user') toggleFacingMode();
              }}
              className={`px-2.5 py-1 rounded-full text-[11px] transition flex items-center gap-1 ${
                facingMode === 'user'
                  ? 'bg-emerald-400 text-slate-950 font-medium shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Dùng camera trước (Selfie để nhìn thấy màn hình khi nằm)"
            >
              <FlipHorizontal className="w-3 h-3" />
              <span>Cam Trước (Selfie)</span>
            </button>
          </div>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="w-7 h-7 rounded-full bg-white/[0.06] hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition"
            title={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5 text-slate-500" />}
          </button>
        </div>
      </div>

      {/* Main Viewport Stage */}
      <div
        ref={viewportRef}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="relative aspect-[3/4] max-h-[460px] w-full bg-[#0C0D11] rounded-[28px] overflow-hidden border border-white/[0.08] flex items-center justify-center shadow-inner touch-none"
      >
        {/* Floating Flip Camera button directly on video viewport */}
        {sessionState !== 'IDLE' && (
          <div className="absolute top-4 right-4 z-40 pointer-events-auto">
            <button
              onClick={toggleFacingMode}
              className="px-3 py-1.5 rounded-full bg-[#16181F]/90 backdrop-blur-md border border-white/20 text-white hover:bg-black shadow-2xl flex items-center gap-1.5 active:scale-95 transition"
              title="Đổi camera trước / sau"
            >
              <FlipHorizontal className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] font-medium">
                {facingMode === 'user' ? 'Đổi Cam Sau' : 'Đổi Cam Trước (Selfie)'}
              </span>
            </button>
          </div>
        )}

        {/* Live Video */}
        <video
          ref={videoRef}
          playsInline
          muted
          className={`absolute inset-0 w-full h-full object-cover ${
            sessionState !== 'IDLE' ? 'block' : 'hidden'
          } ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
        />

        {/* Live Skeleton Canvas */}
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 w-full h-full pointer-events-none ${
            sessionState !== 'IDLE' && !isManualCaliper ? 'block' : 'hidden'
          } ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
        />

        {/* 1. STATE: IDLE (Trạm chờ bắt đầu) */}
        {sessionState === 'IDLE' && (
          <div className="p-6 text-center max-w-sm text-slate-300 space-y-4 z-10 animate-fade-in">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-400 shadow-2xl">
              <Sparkles className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-normal text-white">Trạm Đo Rảnh Tay 100%</h3>
              <p className="text-xs text-slate-400 font-light leading-relaxed">
                Tựa máy mép giường nhìn ngang hông gối. Bấm nút dưới rồi nằm xuống co chân, AI tự tính góc giữa <strong>Xương Đùi</strong> & <strong>Cẳng Chân</strong> và tự lưu số đỉnh cao nhất!
              </p>
            </div>

            <div className="p-3 bg-white/[0.03] rounded-2xl border border-white/[0.06] text-[11px] text-slate-400 space-y-1.5 text-left">
              <div className="flex items-center gap-2 text-white font-medium">
                <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px]">1</span>
                <span>Đặt điện thoại tựa mép giường (~1m)</span>
              </div>
              <div className="flex items-center gap-2 text-white font-medium">
                <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px]">2</span>
                <span>Bấm nút đo $\to$ Nằm xuống trong 8s</span>
              </div>
              <div className="flex items-center gap-2 text-white font-medium">
                <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px]">3</span>
                <span>Co chân hết cỡ rồi duỗi ra $\to$ Máy tự chốt số!</span>
              </div>
            </div>

            <button
              onClick={handleStartAutonomousSession}
              disabled={isLoadingModel}
              className="w-full py-4 px-6 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-bold rounded-full text-sm transition flex items-center justify-center gap-2 shadow-2xl"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>BẮT ĐẦU ĐO TỰ ĐỘNG (ĐẾM LÙI 8S + 15S CO CHÂN)</span>
            </button>

            <button
              onClick={handleStartLiveFree}
              disabled={isLoadingModel}
              className="w-full py-3 px-5 rounded-full border border-white/10 hover:bg-white/[0.06] text-slate-300 hover:text-white text-xs font-medium transition flex items-center justify-center gap-2"
            >
              <Camera className="w-4 h-4 text-emerald-400" />
              <span>Mở Camera Đo Trực Tiếp (Tự do, không hẹn giờ)</span>
            </button>
          </div>
        )}

        {/* 2. STATE: COUNTDOWN (Đếm ngược 8s để người bệnh nằm ngay ngắn) */}
        {sessionState === 'COUNTDOWN' && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center z-40 text-center space-y-4 animate-fade-in p-6">
            <span className="text-xs font-light text-slate-300 uppercase tracking-widest">
              Nằm lên giường & chuẩn bị co chân
            </span>
            <div className="text-9xl font-light text-emerald-400 tracking-tighter tabular-nums animate-pulse">
              {countdown}
            </div>
            <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
              Đặt chân duỗi thẳng. Khi đếm về 0, bạn sẽ có 15 giây để từ từ co gối hết cỡ rồi duỗi ra.
            </p>
            <button
              onClick={() => {
                stopCamera();
                setSessionState('IDLE');
              }}
              className="py-2 px-4 rounded-full border border-white/10 text-slate-400 text-xs"
            >
              Hủy phiên đo
            </button>
          </div>
        )}

        {/* 3. STATE: MEASURING (Đang đo realtime trong 15 giây) */}
        {sessionState === 'MEASURING' && (
          <>
            {/* 15s Timer Progress Bar at top edge */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-white/10 z-30 overflow-hidden">
              <div
                style={{ width: `${(measuringSecondsLeft / 15) * 100}%` }}
                className="h-full bg-emerald-400 transition-all duration-1000 ease-linear shadow-[0_0_8px_#10b981]"
              />
            </div>

            {/* Giant Live Angle HUD (Visible from 1m away on bed) */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-20 pointer-events-none">
              <div className="bg-[#16181F]/90 backdrop-blur-xl border border-white/20 rounded-2xl p-3 shadow-2xl flex items-center gap-3">
                <div
                  className={`text-5xl font-light tracking-tight tabular-nums px-3 py-1 rounded-xl ${
                    (liveAngle || 0) > safeMaxFlexion
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  }`}
                >
                  {liveAngle ?? 0}°
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">Góc gập hiện tại</div>
                  <div className="text-xs font-medium text-emerald-300 flex items-center gap-1">
                    <span>Đỉnh:</span>
                    <span className="font-bold text-white text-sm">{peakAngle}°</span>
                  </div>
                </div>
              </div>

              {/* 15s countdown pill */}
              <div className="bg-emerald-500/20 border border-emerald-500/40 px-3.5 py-1.5 rounded-full text-xs font-medium text-emerald-300 flex items-center gap-1.5 shadow-xl">
                <Timer className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                <span>Còn {measuringSecondsLeft}s</span>
              </div>
            </div>

            {/* Bottom Guidance & Joint Presence */}
            <div className="absolute bottom-4 left-4 right-4 flex flex-col gap-2 z-20 pointer-events-none">
              <div className="flex items-center gap-1.5 self-start bg-[#0C0D11]/90 backdrop-blur-md border border-white/10 rounded-full px-3 py-1 text-[10px] text-slate-300">
                <span className="text-slate-400">Khớp:</span>
                <span className={jointReady.hip ? 'text-emerald-400' : 'text-rose-400'}>● Đùi/Hông</span>
                <span className="text-white/20">|</span>
                <span className={jointReady.knee ? 'text-emerald-400' : 'text-rose-400'}>● Khớp Gối</span>
                <span className="text-white/20">|</span>
                <span className={jointReady.ankle ? 'text-emerald-400' : 'text-rose-400'}>● Cẳng/Cổ chân</span>
              </div>

              <div className="p-2.5 rounded-2xl backdrop-blur-md border text-xs font-light bg-[#16181F]/90 border-emerald-500/30 text-emerald-200 flex items-center justify-between shadow-2xl">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Từ từ co chân hết cỡ rồi duỗi ra (còn {measuringSecondsLeft}s)</span>
                </div>
                <button
                  onClick={() => lockPeakAndAutoSave(peakAngle > 0 ? peakAngle : liveAngle || 0)}
                  className="pointer-events-auto py-1.5 px-3.5 bg-white text-slate-950 font-bold rounded-full text-xs hover:bg-slate-100 shadow-md"
                >
                  Chốt Ngay
                </button>
              </div>
            </div>
          </>
        )}

        {/* 3B. STATE: LIVE_FREE (Đo trực tiếp tự do không giới hạn giờ) */}
        {sessionState === 'LIVE_FREE' && (
          <>
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-20 pointer-events-none">
              <div className="bg-[#16181F]/90 backdrop-blur-xl border border-white/20 rounded-2xl p-3 shadow-2xl flex items-center gap-3">
                <div
                  className={`text-5xl font-light tracking-tight tabular-nums px-3 py-1 rounded-xl ${
                    (liveAngle || 0) > safeMaxFlexion
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  }`}
                >
                  {liveAngle ?? 0}°
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">Đo trực tiếp</div>
                  <div className="text-xs font-medium text-emerald-300 flex items-center gap-1">
                    <span>Đỉnh:</span>
                    <span className="font-bold text-white text-sm">{peakAngle}°</span>
                  </div>
                </div>
              </div>

              <div className="bg-white/10 border border-white/20 px-3 py-1.5 rounded-full text-[11px] font-medium text-white flex items-center gap-1.5 shadow-xl">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Đo tự do</span>
              </div>
            </div>

            <div className="absolute bottom-4 left-4 right-4 flex flex-col gap-2 z-20 pointer-events-none">
              <div className="p-2.5 rounded-2xl backdrop-blur-md border text-xs font-light bg-[#16181F]/90 border-white/15 text-white flex items-center justify-between shadow-2xl">
                <button
                  onClick={() => {
                    stopCamera();
                    setSessionState('IDLE');
                  }}
                  className="pointer-events-auto py-1.5 px-3 rounded-full border border-white/20 text-slate-300 hover:text-white text-xs"
                >
                  Dừng
                </button>
                <button
                  onClick={() => lockPeakAndAutoSave(peakAngle > 0 ? peakAngle : liveAngle || 0)}
                  className="pointer-events-auto py-1.5 px-4 bg-emerald-500 text-slate-950 font-bold rounded-full text-xs hover:bg-emerald-400 shadow-md"
                >
                  Lưu Góc Này ({peakAngle > 0 ? peakAngle : liveAngle || 0}°)
                </button>
              </div>
            </div>
          </>
        )}

        {/* 4. STATE: PEAK_LOCKED (Đã tự động bắt đỉnh & lưu) */}
        {sessionState === 'PEAK_LOCKED' && lockedResult && (
          <div className="absolute inset-0 bg-[#0C0D11]/90 backdrop-blur-xl flex flex-col items-center justify-center z-40 p-6 text-center space-y-4 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-2xl mx-auto animate-bounce">
              <Trophy className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <span className="text-xs text-emerald-400 font-medium uppercase tracking-widest">
                ĐÃ TỰ ĐỘNG CHỐT GÓC ĐỈNH
              </span>
              <div className="text-6xl font-light text-white tracking-tight tabular-nums">
                {lockedResult.flexionAngle}°
              </div>
              <p className="text-xs text-slate-300">
                {lockedResult.leg === 'left' ? 'Gối Trái (L)' : 'Gối Phải (R)'} • {lockedResult.note}
              </p>
            </div>

            <div className="p-3 bg-white/[0.04] border border-white/10 rounded-2xl text-xs text-slate-400 max-w-xs">
              ✅ Số đo đã được tự động lưu vào <strong>Hồ Sơ Phác Đồ Phục Hồi</strong> của bạn.
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={handleStartAutonomousSession}
                className="py-3 px-6 bg-white hover:bg-slate-100 text-slate-950 font-semibold rounded-full text-xs transition shadow-xl flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Đo Lại Lần Nữa</span>
              </button>

              <button
                onClick={() => {
                  stopCamera();
                  setSessionState('IDLE');
                }}
                className="py-3 px-5 rounded-full border border-white/10 text-slate-300 hover:text-white text-xs"
              >
                Hoàn Tất
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Manual Tools Toggle (Thước 3 điểm kéo thả & Tải ảnh dự phòng) */}
      <div className="pt-1">
        <button
          onClick={() => setShowManualTools(!showManualTools)}
          className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition mx-auto font-light"
        >
          <Move className="w-3.5 h-3.5 text-amber-400" />
          <span>{showManualTools ? 'Ẩn công cụ phụ' : 'Tùy chọn: Thước đo thủ công & Tải ảnh'}</span>
        </button>

        {showManualTools && (
          <div className="mt-3 p-3.5 bg-white/[0.02] border border-white/[0.06] rounded-2xl flex items-center justify-between gap-3 text-xs animate-fade-in">
            <span className="text-slate-400">Nếu bị vướng chăn hoặc góc chụp khó:</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsManualCaliper(!isManualCaliper)}
                className={`py-1.5 px-3 rounded-full text-xs font-medium border transition ${
                  isManualCaliper ? 'bg-amber-400 text-slate-950 border-amber-300' : 'bg-white/5 border-white/10 text-white'
                }`}
              >
                Thước 3 Điểm
              </button>

              <label className="py-1.5 px-3 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-medium cursor-pointer flex items-center gap-1">
                <Upload className="w-3 h-3 text-amber-300" />
                <span>Tải Ảnh</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setIsPhotoFallback(true);
                    setSessionState('MEASURING');
                  }}
                />
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Guide Modal */}
      {showGuideModal && (
        <div className="fixed sm:absolute inset-0 z-50 bg-[#0C0D11]/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#16181F] border border-white/[0.08] rounded-[32px] max-w-md w-full max-h-[85vh] flex flex-col shadow-2xl text-white">
            <div className="p-5 border-b border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-emerald-400" />
                <h3 className="font-light text-white text-base">Trạm Đo Góc Tự Động 100%</h3>
              </div>
              <button
                onClick={() => setShowGuideModal(false)}
                className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs font-light text-slate-300 leading-relaxed">
              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-1.5">
                <div className="font-medium text-emerald-300 flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-400" />
                  1. Chuẩn Bị: Tựa Điện Thoại Ở Mép Giường
                </div>
                <p>
                  Đặt điện thoại tựa vào gối hoặc kệ đầu giường cách khớp gối khoảng 1 mét, hướng nhìn vuông góc với mặt bên của chân.
                </p>
              </div>

              <div className="p-3.5 bg-white/[0.04] border border-white/[0.08] rounded-2xl space-y-1.5">
                <div className="font-medium text-white flex items-center gap-1.5">
                  <Timer className="w-4 h-4 text-emerald-400" />
                  2. Khởi Động Rảnh Tay (Đếm lùi 8 giây)
                </div>
                <p>
                  Bấm nút bắt đầu và nằm ngay ngắn lên giường. Khi đồng hồ đếm về 0, bạn chỉ việc co chân trượt gót sâu nhất có thể rồi thả lỏng duỗi ra.
                </p>
              </div>

              <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl space-y-1.5">
                <div className="font-medium text-amber-300 flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  3. Tự Động Bắt Điểm Đỉnh (Peak ROM) & Lưu
                </div>
                <p>
                  AI tự tính góc hình học chuẩn giữa <strong>Xương Đùi</strong> và <strong>Cẳng Chân</strong>. Ngay khi bạn co hết tầm và bắt đầu duỗi ra, máy tự chốt góc lớn nhất, phát chuông Ting! và tự động lưu mà không cần bạn với tay chạm máy.
                </p>
              </div>
            </div>

            <div className="p-4 border-t border-white/[0.06] flex justify-end">
              <button
                onClick={() => setShowGuideModal(false)}
                className="py-2.5 px-6 bg-white hover:bg-slate-100 text-slate-950 font-medium rounded-full text-xs transition"
              >
                Đã Hiểu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed sm:absolute inset-0 z-50 bg-[#0C0D11]/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#16181F] border border-white/[0.08] rounded-[32px] max-w-md w-full max-h-[85vh] flex flex-col shadow-2xl text-white">
            <div className="p-5 border-b border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-emerald-400" />
                <h3 className="font-light text-white text-base">Lịch Sử Biên Độ Gối</h3>
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
                            • Tự động bắt đỉnh
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
