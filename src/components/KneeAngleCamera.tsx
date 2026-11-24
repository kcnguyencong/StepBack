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
  Pause,
  Play,
  Sparkles,
  Crosshair,
  HelpCircle,
  Move,
  Smartphone,
  Timer,
  RotateCcw,
  Trophy,
  Check,
  ChevronRight,
  Activity
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

// Low-pass smoothing for points
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
  // Mode selection: 'gyro' (Inclinometer) vs 'camera' (Hands-Free AI Camera)
  const [activeTab, setActiveTab] = useState<'gyro' | 'camera'>('gyro');

  // Common configuration
  const [leg, setLeg] = useState<'left' | 'right'>(selectedLeg);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [historyRecords, setHistoryRecords] = useState<AngleRecord[]>([]);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // ==========================================
  // TAB 1: INCLINOMETER GYRO SENSOR STATES
  // ==========================================
  const [hasGyroSupport, setHasGyroSupport] = useState<boolean>(false);
  const [gyroPermissionStatus, setGyroPermissionStatus] = useState<'idle' | 'granted' | 'denied'>('idle');
  const [isGyroCalibrated, setIsGyroCalibrated] = useState<boolean>(false);
  const [gyroRawAngle, setGyroRawAngle] = useState<number>(0);
  const [gyroFlexionAngle, setGyroFlexionAngle] = useState<number>(0);
  const [gyroPeakAngle, setGyroPeakAngle] = useState<number>(0);
  const baselineBetaRef = useRef<number | null>(null);
  const smoothedBetaRef = useRef<number>(0);

  // ==========================================
  // TAB 2: HANDS-FREE AI CAMERA STATES
  // ==========================================
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isLoadingModel, setIsLoadingModel] = useState<boolean>(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [isFrozen, setIsFrozen] = useState<boolean>(false);

  // Hands-free Peak ROM & Countdown
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);
  const [isHandsFreeRecording, setIsHandsFreeRecording] = useState<boolean>(false);
  const [liveCameraFlexion, setLiveCameraFlexion] = useState<number | null>(null);
  const [cameraPeakFlexion, setCameraPeakFlexion] = useState<number | null>(null);
  const [jointDiag, setJointDiag] = useState<{
    hip: boolean;
    knee: boolean;
    ankle: boolean;
    guidance: string;
  }>({
    hip: false,
    knee: false,
    ankle: false,
    guidance: 'Đặt điện thoại tựa mép giường, cách ~1m',
  });

  // Manual 3-point Caliper
  const [isManualCaliper, setIsManualCaliper] = useState<boolean>(false);
  const [caliperPoints, setCaliperPoints] = useState<{
    hip: Point2D;
    knee: Point2D;
    ankle: Point2D;
  }>({
    hip: { x: 120, y: 110 },
    knee: { x: 210, y: 220 },
    ankle: { x: 140, y: 340 },
  });
  const [draggingNode, setDraggingNode] = useState<'hip' | 'knee' | 'ankle' | null>(null);

  // Photo Fallback
  const [isPhotoFallback, setIsPhotoFallback] = useState<boolean>(false);
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);

  // Point smoothing & MediaPipe refs
  const smoothedPointsRef = useRef<{ hip: Point2D | null; knee: Point2D | null; ankle: Point2D | null }>({
    hip: null,
    knee: null,
    ankle: null,
  });
  const missingFramesCountRef = useRef<number>(0);
  const lastInferenceTimeRef = useRef<number>(0);
  const lastReactUpdateRef = useRef<number>(0);
  const displayAngleRef = useRef<number | null>(null);
  const peakFlexionRef = useRef<number>(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const photoCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

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
  const playChime = useCallback((type: 'success' | 'warning' | 'beep' | 'peak') => {
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

      if (type === 'success' || type === 'peak') {
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else if (type === 'beep') {
        osc.frequency.setValueAtTime(660, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
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

  // Save record helper
  const handleSaveRecord = useCallback((angleVal: number, source: 'gyro' | 'live' | 'manual' | 'photo') => {
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
      note: isSafe ? 'Trong giới hạn an toàn' : 'Vượt giới hạn an toàn',
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
  }, [leg, safeMaxFlexion, historyRecords, onRecordSaved, playChime]);

  // =========================================================================
  // GYROSCOPE / INCLINOMETER LOGIC (TAB 1)
  // =========================================================================
  const handleOrientationEvent = useCallback((event: DeviceOrientationEvent) => {
    let beta = event.beta; // Tilt front-to-back [-180, 180]
    if (beta === null) return;

    setHasGyroSupport(true);

    // Exponential smoothing
    smoothedBetaRef.current = smoothedBetaRef.current * 0.75 + beta * 0.25;
    const currentBeta = smoothedBetaRef.current;
    setGyroRawAngle(Math.round(currentBeta));

    if (baselineBetaRef.current !== null) {
      // Calculate relative change from calibrated straight leg
      const diff = Math.abs(currentBeta - baselineBetaRef.current);
      const angle = Math.min(135, Math.max(0, Math.round(diff)));
      setGyroFlexionAngle(angle);

      // Track peak angle
      setGyroPeakAngle((prev) => {
        if (angle > prev) {
          if (angle > safeMaxFlexion && prev <= safeMaxFlexion) {
            playChime('warning');
          }
          return angle;
        }
        return prev;
      });
    }
  }, [safeMaxFlexion, playChime]);

  // Request gyro permission on iOS / start listener
  const requestGyroPermission = async () => {
    try {
      if (
        typeof DeviceOrientationEvent !== 'undefined' &&
        typeof (DeviceOrientationEvent as any).requestPermission === 'function'
      ) {
        const res = await (DeviceOrientationEvent as any).requestPermission();
        if (res === 'granted') {
          setGyroPermissionStatus('granted');
          window.addEventListener('deviceorientation', handleOrientationEvent, true);
        } else {
          setGyroPermissionStatus('denied');
        }
      } else {
        // Android / non-iOS standard
        setGyroPermissionStatus('granted');
        window.addEventListener('deviceorientation', handleOrientationEvent, true);
        setHasGyroSupport(true);
      }
    } catch (e) {
      console.warn('Gyro request error:', e);
      setGyroPermissionStatus('denied');
    }
  };

  useEffect(() => {
    if (activeTab === 'gyro') {
      window.addEventListener('deviceorientation', handleOrientationEvent, true);
      // Auto-detect if event fires
      const timeout = setTimeout(() => {
        if (smoothedBetaRef.current !== 0) {
          setHasGyroSupport(true);
        }
      }, 800);
      return () => {
        clearTimeout(timeout);
        window.removeEventListener('deviceorientation', handleOrientationEvent, true);
      };
    }
  }, [activeTab, handleOrientationEvent]);

  // Calibrate 0°
  const handleCalibrateZero = () => {
    baselineBetaRef.current = smoothedBetaRef.current;
    setIsGyroCalibrated(true);
    setGyroFlexionAngle(0);
    setGyroPeakAngle(0);
    playChime('beep');
    setSaveSuccessMsg('Đã hiệu chuẩn 0° thành công! Giờ hãy co chân từ từ.');
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  const handleResetGyro = () => {
    baselineBetaRef.current = null;
    setIsGyroCalibrated(false);
    setGyroFlexionAngle(0);
    setGyroPeakAngle(0);
  };

  // =========================================================================
  // HANDS-FREE AI CAMERA LOGIC (TAB 2)
  // =========================================================================
  useEffect(() => {
    if (activeTab !== 'camera') {
      stopCamera();
      return;
    }

    let isCancelled = false;
    const initPoseLandmarker = async () => {
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
        console.error('Error loading PoseLandmarker:', err);
        if (!isCancelled) {
          setModelError('Không thể tải mô hình AI. Bạn có thể dùng Thước Cảm Biến hoặc Tải ảnh.');
          setIsLoadingModel(false);
        }
      }
    };

    initPoseLandmarker();

    return () => {
      isCancelled = true;
    };
  }, [activeTab]);

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

  const startCamera = async () => {
    setIsPhotoFallback(false);
    setIsFrozen(false);
    smoothedPointsRef.current = { hip: null, knee: null, ankle: null };
    missingFramesCountRef.current = 0;
    peakFlexionRef.current = 0;
    setCameraPeakFlexion(null);

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
      console.warn('Camera error:', err);
      setCameraActive(false);
      setIsPhotoFallback(true);
    }
  };

  const stopCamera = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setCameraActive(false);
    setIsFrozen(false);
    setIsHandsFreeRecording(false);
    setCountdownSeconds(null);
    setLiveCameraFlexion(null);
    smoothedPointsRef.current = { hip: null, knee: null, ankle: null };
  }, []);

  // Hands-free countdown & auto peak capture
  const handleStartHandsFree = () => {
    if (!cameraActive) {
      startCamera();
    }
    peakFlexionRef.current = 0;
    setCameraPeakFlexion(null);
    setCountdownSeconds(5);
    playChime('beep');

    let count = 5;
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);

    countdownTimerRef.current = setInterval(() => {
      count -= 1;
      if (count > 0) {
        setCountdownSeconds(count);
        playChime('beep');
      } else if (count === 0) {
        setCountdownSeconds(0);
        setIsHandsFreeRecording(true);
        playChime('success');
      } else {
        // Count < 0: recording active for 12 seconds
        setCountdownSeconds(null);
        if (count <= -12) {
          // Finish recording session
          clearInterval(countdownTimerRef.current!);
          countdownTimerRef.current = null;
          setIsHandsFreeRecording(false);
          if (peakFlexionRef.current > 0) {
            handleSaveRecord(peakFlexionRef.current, 'live');
          }
        }
      }
    }, 1000);
  };

  // Video loop for MediaPipe
  const predictVideoFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !poseLandmarkerRef.current || isFrozen || isManualCaliper) {
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
    const isTimeToInfer = now - lastInferenceTimeRef.current >= 32;

    if (isTimeToInfer) {
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
          const isHipOk = Boolean(hip && (hip.visibility === undefined || hip.visibility > 0.12 || (isKneeOk && hip.y < 0.25)));
          const isAnkleOk = Boolean(ankle && (ankle.visibility === undefined || ankle.visibility > 0.12 || (isKneeOk && ankle.y > 0.75)));

          let guidance = 'Đang tìm khớp...';
          if (!isKneeOk) guidance = 'Đặt máy nhìn ngang mặt bên của gối (~1m)';
          else if (isKneeOk && !isHipOk && !isAnkleOk) guidance = '💡 Lùi camera xa hơn để thấy đùi và cẳng chân';
          else if (isKneeOk && !isHipOk) guidance = '💡 Lùi camera xa hoặc hướng nhẹ lên phần đùi';
          else if (isKneeOk && !isAnkleOk) guidance = '💡 Hướng camera nhẹ xuống để lấy cổ chân';
          else guidance = '✅ Đã bắt chuẩn khớp • Hãy co chân';

          if (now - lastReactUpdateRef.current > 120) {
            setJointDiag({ hip: isHipOk, knee: isKneeOk, ankle: isAnkleOk, guidance });
          }

          if (isHipOk && isKneeOk && isAnkleOk) {
            missingFramesCountRef.current = 0;
            const rawH = { x: hip.x * canvas.width, y: hip.y * canvas.height };
            const rawK = { x: knee.x * canvas.width, y: knee.y * canvas.height };
            const rawA = { x: ankle.x * canvas.width, y: ankle.y * canvas.height };

            const hPt = smoothPoint(smoothedPointsRef.current.hip, rawH, 0.25);
            const kPt = smoothPoint(smoothedPointsRef.current.knee, rawK, 0.25);
            const aPt = smoothPoint(smoothedPointsRef.current.ankle, rawA, 0.25);
            smoothedPointsRef.current = { hip: hPt, knee: kPt, ankle: aPt };

            // Caliper point sync
            if (!isManualCaliper && viewportRef.current) {
              const rect = viewportRef.current.getBoundingClientRect();
              const scaleX = rect.width / canvas.width;
              const scaleY = rect.height / canvas.height;
              setCaliperPoints({
                hip: { x: hPt.x * scaleX, y: hPt.y * scaleY },
                knee: { x: kPt.x * scaleX, y: kPt.y * scaleY },
                ankle: { x: aPt.x * scaleX, y: aPt.y * scaleY },
              });
            }
          } else {
            missingFramesCountRef.current++;
            if (missingFramesCountRef.current > 10) {
              smoothedPointsRef.current = { hip: null, knee: null, ankle: null };
            }
          }
        }
      } catch (e) {
        console.warn('Frame infer error:', e);
      }
    }

    // Render Canvas Skeleton
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
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.strokeStyle = lineColor;
      ctx.shadowColor = !isSafe ? 'rgba(244,63,94,0.45)' : 'rgba(16,185,129,0.35)';
      ctx.shadowBlur = 12;

      ctx.beginPath();
      ctx.moveTo(hPt.x, hPt.y);
      ctx.lineTo(kPt.x, kPt.y);
      ctx.lineTo(aPt.x, aPt.y);
      ctx.stroke();

      // Knee Arc
      const angleV1 = Math.atan2(hPt.y - kPt.y, hPt.x - kPt.x);
      const angleV2 = Math.atan2(aPt.y - kPt.y, aPt.x - kPt.x);
      const arcRadius = Math.min(75, Math.hypot(hPt.x - kPt.x, hPt.y - kPt.y) * 0.35);

      ctx.beginPath();
      ctx.moveTo(kPt.x, kPt.y);
      ctx.arc(kPt.x, kPt.y, arcRadius, angleV1, angleV2, false);
      ctx.fillStyle = !isSafe ? 'rgba(244,63,94,0.2)' : 'rgba(16,185,129,0.18)';
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
      drawNode(kPt, 10);
      drawNode(aPt, 6);

      ctx.restore();

      if (now - lastReactUpdateRef.current > 120) {
        lastReactUpdateRef.current = now;
        setLiveCameraFlexion(stableFlexion);

        // Peak Tracking
        if (stableFlexion > peakFlexionRef.current) {
          peakFlexionRef.current = stableFlexion;
          setCameraPeakFlexion(stableFlexion);
        }
      }
    } else {
      if (missingFramesCountRef.current > 10 && now - lastReactUpdateRef.current > 200) {
        lastReactUpdateRef.current = now;
        setLiveCameraFlexion(null);
      }
    }

    animationFrameRef.current = requestAnimationFrame(predictVideoFrame);
  }, [leg, safeMaxFlexion, isFrozen, isManualCaliper]);

  useEffect(() => {
    if (cameraActive && !isFrozen && !isManualCaliper) {
      animationFrameRef.current = requestAnimationFrame(predictVideoFrame);
    } else if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [cameraActive, isFrozen, isManualCaliper, predictVideoFrame]);

  // Caliper pointer events
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
      const rounded = Math.round(flexionAngle);
      setLiveCameraFlexion(rounded);
      if (rounded > (cameraPeakFlexion || 0)) {
        setCameraPeakFlexion(rounded);
      }
    }
  }, [isManualCaliper, caliperPoints, cameraPeakFlexion]);

  // Photo upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    stopCamera();
    setIsPhotoFallback(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = photoCanvasRef.current;
        if (!canvas) return;
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);

        try {
          if (poseLandmarkerRef.current) {
            await poseLandmarkerRef.current.setOptions({ runningMode: 'IMAGE' });
            const res = poseLandmarkerRef.current.detect(canvas);
            if (res.landmarks && res.landmarks.length > 0) {
              const lm = res.landmarks[0];
              const isLeft = leg === 'left';
              const hip = lm[isLeft ? 23 : 24];
              const knee = lm[isLeft ? 25 : 26];
              const ankle = lm[isLeft ? 27 : 28] || lm[isLeft ? 29 : 30];
              if (knee) {
                const hPt = hip ? { x: hip.x * canvas.width, y: hip.y * canvas.height } : { x: knee.x * canvas.width - 60, y: knee.y * canvas.height - 180 };
                const kPt = { x: knee.x * canvas.width, y: knee.y * canvas.height };
                const aPt = ankle ? { x: ankle.x * canvas.width, y: ankle.y * canvas.height } : { x: knee.x * canvas.width - 40, y: knee.y * canvas.height + 180 };
                const { flexionAngle } = calculateKneeAngle(hPt, kPt, aPt);
                const r = Math.round(flexionAngle);
                setLiveCameraFlexion(r);
                setCameraPeakFlexion(r);
              }
            }
            await poseLandmarkerRef.current.setOptions({ runningMode: 'VIDEO' });
          }
        } catch (err) {
          console.warn('Photo analyze error:', err);
        }
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const isAngleSafe = (ang: number) => ang <= safeMaxFlexion;

  return (
    <div className="bg-[#16181F] text-white rounded-[32px] p-5 border border-white/[0.08] shadow-2xl space-y-4 font-sans select-none">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-medium text-emerald-400 uppercase tracking-wider">
              {activeTab === 'gyro' ? 'Cảm Biến Cẳng Chân • Rảnh Tay 100%' : 'Camera AI • Bắt Góc Đỉnh'}
            </span>
          </div>
          <h2 className="text-xl font-light text-white tracking-tight">
            Đo Góc Gập Gối Chuẩn Lâm Sàng
          </h2>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowGuideModal(true)}
            title="Xem hướng dẫn đo chuẩn"
            className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/10 text-slate-300 border border-white/10 flex items-center justify-center transition"
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

      {/* Main Mode Switcher Tabs */}
      <div className="grid grid-cols-2 p-1.5 bg-[#0C0D11] rounded-2xl border border-white/[0.06] gap-1">
        <button
          onClick={() => setActiveTab('gyro')}
          className={`py-2.5 px-3 rounded-xl text-xs font-medium transition flex items-center justify-center gap-2 ${
            activeTab === 'gyro'
              ? 'bg-emerald-500 text-slate-950 shadow-lg font-semibold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Smartphone className="w-4 h-4" />
          <span>Thước Cảm Biến (Áp Chân)</span>
        </button>

        <button
          onClick={() => setActiveTab('camera')}
          className={`py-2.5 px-3 rounded-xl text-xs font-medium transition flex items-center justify-center gap-2 ${
            activeTab === 'camera'
              ? 'bg-emerald-500 text-slate-950 shadow-lg font-semibold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Camera className="w-4 h-4" />
          <span>Camera Rảnh Tay (Tựa Máy)</span>
        </button>
      </div>

      {/* Sub-bar: Leg Selection & Sound Toggle */}
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

        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="w-7 h-7 rounded-full bg-white/[0.06] hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition"
          title={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
        >
          {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5 text-slate-500" />}
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: INCLINOMETER GYRO SENSOR (ÁP ĐIỆN THOẠI LÊN CẲNG CHÂN) */}
      {/* ========================================================= */}
      {activeTab === 'gyro' && (
        <div className="space-y-4 animate-fade-in">
          {/* Main Visual Clinical Gauge */}
          <div className="bg-[#0C0D11] rounded-[28px] p-6 border border-white/[0.08] relative overflow-hidden flex flex-col items-center justify-center text-center shadow-inner min-h-[340px]">
            {/* Visual Angle Arc */}
            <div className="relative w-56 h-56 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                {/* Background Ring */}
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  fill="none"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="8"
                />
                {/* Safe Limit Zone (0 to safeMaxFlexion) */}
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  fill="none"
                  stroke="rgba(16,185,129,0.2)"
                  strokeWidth="8"
                  strokeDasharray={`${(safeMaxFlexion / 135) * 314} 314`}
                />
                {/* Current Angle Stroke */}
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  fill="none"
                  stroke={!isAngleSafe(gyroFlexionAngle) ? '#f43f5e' : gyroFlexionAngle > safeMaxFlexion - 10 ? '#fbbf24' : '#10b981'}
                  strokeWidth="9"
                  strokeDasharray={`${(Math.min(135, gyroFlexionAngle) / 135) * 314} 314`}
                  strokeLinecap="round"
                  className="transition-all duration-150"
                />
              </svg>

              {/* Central Big Angle readout */}
              <div className="absolute inset-0 flex flex-col items-center justify-center space-y-0.5">
                <span className="text-[11px] text-slate-400 uppercase tracking-widest font-light">
                  {isGyroCalibrated ? 'Góc gập hiện tại' : 'Đang chờ đặt máy'}
                </span>
                <div
                  className={`text-5xl font-light tracking-tight tabular-nums ${
                    !isAngleSafe(gyroFlexionAngle)
                      ? 'text-rose-400'
                      : gyroFlexionAngle > safeMaxFlexion - 10
                      ? 'text-amber-300'
                      : 'text-white'
                  }`}
                >
                  {gyroFlexionAngle}°
                </div>
                <div
                  className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${
                    !isAngleSafe(gyroFlexionAngle)
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                      : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  }`}
                >
                  {isAngleSafe(gyroFlexionAngle) ? `≤ Giới hạn ${safeMaxFlexion}°` : 'VƯỢT GIỚI HẠN!'}
                </div>
              </div>
            </div>

            {/* Peak Flexion Badge */}
            {gyroPeakAngle > 0 && (
              <div className="mt-2 flex items-center gap-2 bg-white/[0.04] border border-white/10 px-4 py-1.5 rounded-full text-xs">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-slate-300">Góc gập sâu nhất đạt được:</span>
                <span className="font-semibold text-emerald-400">{gyroPeakAngle}°</span>
              </div>
            )}

            {/* Instruction Banner */}
            {!isGyroCalibrated ? (
              <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-xs text-emerald-300 max-w-xs leading-relaxed">
                👉 <strong>Bước 1:</strong> Đặt điện thoại áp dọc theo xương ống chân (cẳng chân), chân duỗi thẳng trên giường, rồi bấm <strong>"Hiệu chuẩn 0°"</strong> bên dưới.
              </div>
            ) : (
              <div className="mt-3 text-xs text-slate-400 font-light max-w-xs">
                👉 <strong>Bước 2:</strong> Từ từ co chân trượt gót vào hông. Điện thoại sẽ tự đo góc theo chuyển động của cẳng chân.
              </div>
            )}
          </div>

          {/* Calibrate & Action Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {!isGyroCalibrated ? (
              <button
                onClick={handleCalibrateZero}
                className="py-3.5 px-5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-semibold rounded-full text-xs transition flex items-center justify-center gap-2 shadow-xl col-span-full"
              >
                <Check className="w-4 h-4" />
                <span>Đặt Lên Ống Chân & Hiệu Chuẩn 0°</span>
              </button>
            ) : (
              <>
                <button
                  onClick={handleCalibrateZero}
                  className="py-3 px-4 rounded-full border border-white/10 text-slate-300 hover:text-white hover:bg-white/[0.06] text-xs font-medium transition flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Hiệu Chuẩn Lại (Đặt lại 0°)</span>
                </button>

                <button
                  onClick={() => handleSaveRecord(gyroPeakAngle > 0 ? gyroPeakAngle : gyroFlexionAngle, 'gyro')}
                  className="py-3.5 px-5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-semibold rounded-full text-xs transition flex items-center justify-center gap-2 shadow-lg"
                >
                  <BookmarkPlus className="w-4 h-4" />
                  <span>Lưu Số Đo ({gyroPeakAngle > 0 ? gyroPeakAngle : gyroFlexionAngle}°)</span>
                </button>
              </>
            )}
          </div>

          {/* Gyro Sensor Permission note for iOS */}
          {gyroPermissionStatus !== 'granted' && (
            <div className="p-3 bg-white/[0.03] border border-white/[0.06] rounded-2xl flex items-center justify-between gap-3 text-xs">
              <span className="text-slate-400 font-light">Nếu dùng iPhone, hãy cấp quyền cảm biến góc:</span>
              <button
                onClick={requestGyroPermission}
                className="px-3 py-1 bg-white text-slate-950 font-medium rounded-full text-[11px] shrink-0"
              >
                Kích Hoạt Cảm Biến
              </button>
            </div>
          )}

          {/* Simulator Fallback for Desktop/Non-gyro */}
          <div className="p-3 bg-white/[0.02] border border-white/[0.04] rounded-2xl space-y-1.5 text-xs text-slate-400">
            <div className="flex justify-between items-center text-[11px]">
              <span>Kéo thử góc mô phỏng (Test thủ công):</span>
              <span className="text-white font-medium">{gyroFlexionAngle}°</span>
            </div>
            <input
              type="range"
              min="0"
              max="135"
              value={gyroFlexionAngle}
              onChange={(e) => {
                const val = Number(e.target.value);
                setIsGyroCalibrated(true);
                setGyroFlexionAngle(val);
                setGyroPeakAngle((p) => Math.max(p, val));
              }}
              className="w-full accent-emerald-400 h-1.5 bg-white/10 rounded-lg cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: HANDS-FREE AI CAMERA (TỰA MÁY ĐẾM NGƯỢC, TỰ BẮT ĐỈNH) */}
      {/* ========================================================= */}
      {activeTab === 'camera' && (
        <div className="space-y-4 animate-fade-in">
          {/* Viewport */}
          <div
            ref={viewportRef}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            className="relative aspect-[3/4] max-h-[460px] w-full bg-[#0C0D11] rounded-[28px] overflow-hidden border border-white/[0.08] flex items-center justify-center shadow-inner touch-none"
          >
            {/* Live Video */}
            <video
              ref={videoRef}
              playsInline
              muted
              className={`absolute inset-0 w-full h-full object-cover ${
                cameraActive && !isPhotoFallback ? 'block' : 'hidden'
              } ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
            />

            {/* Skeleton Canvas */}
            <canvas
              ref={canvasRef}
              className={`absolute inset-0 w-full h-full pointer-events-none ${
                cameraActive && !isPhotoFallback && !isManualCaliper ? 'block' : 'hidden'
              } ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
            />

            {/* Photo Canvas */}
            <canvas
              ref={photoCanvasRef}
              className={`absolute inset-0 w-full h-full object-contain ${
                isPhotoFallback ? 'block' : 'hidden'
              }`}
            />

            {/* Caliper SVG Lines */}
            {isManualCaliper && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-20">
                <line
                  x1={caliperPoints.hip.x}
                  y1={caliperPoints.hip.y}
                  x2={caliperPoints.knee.x}
                  y2={caliperPoints.knee.y}
                  stroke="#fbbf24"
                  strokeWidth="4"
                  strokeDasharray="6,4"
                  strokeLinecap="round"
                />
                <line
                  x1={caliperPoints.knee.x}
                  y1={caliperPoints.knee.y}
                  x2={caliperPoints.ankle.x}
                  y2={caliperPoints.ankle.y}
                  stroke="#fbbf24"
                  strokeWidth="4"
                  strokeDasharray="6,4"
                  strokeLinecap="round"
                />
              </svg>
            )}

            {/* Caliper Drag Handles */}
            {isManualCaliper && (
              <div className="absolute inset-0 z-30 pointer-events-auto">
                <div
                  style={{ left: `${caliperPoints.hip.x}px`, top: `${caliperPoints.hip.y}px`, transform: 'translate(-50%, -50%)' }}
                  onPointerDown={handlePointerDown('hip')}
                  className="absolute cursor-grab active:cursor-grabbing p-3 touch-none"
                >
                  <div className="w-8 h-8 rounded-full bg-amber-400 text-slate-950 font-bold text-[10px] flex items-center justify-center border-2 border-white shadow-xl">
                    H
                  </div>
                  <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-black/80 px-2 py-0.5 rounded text-[9px] text-amber-300 whitespace-nowrap">
                    Hông
                  </span>
                </div>

                <div
                  style={{ left: `${caliperPoints.knee.x}px`, top: `${caliperPoints.knee.y}px`, transform: 'translate(-50%, -50%)' }}
                  onPointerDown={handlePointerDown('knee')}
                  className="absolute cursor-grab active:cursor-grabbing p-3 touch-none"
                >
                  <div className="w-10 h-10 rounded-full bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center border-2 border-white shadow-2xl animate-pulse">
                    Gối
                  </div>
                  <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-black/80 px-2 py-0.5 rounded text-[9px] text-emerald-300 whitespace-nowrap">
                    Tâm Gối
                  </span>
                </div>

                <div
                  style={{ left: `${caliperPoints.ankle.x}px`, top: `${caliperPoints.ankle.y}px`, transform: 'translate(-50%, -50%)' }}
                  onPointerDown={handlePointerDown('ankle')}
                  className="absolute cursor-grab active:cursor-grabbing p-3 touch-none"
                >
                  <div className="w-8 h-8 rounded-full bg-sky-400 text-slate-950 font-bold text-[10px] flex items-center justify-center border-2 border-white shadow-xl">
                    C
                  </div>
                  <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-black/80 px-2 py-0.5 rounded text-[9px] text-sky-300 whitespace-nowrap">
                    Cổ Chân
                  </span>
                </div>
              </div>
            )}

            {/* Hands-Free Countdown Overlay */}
            {countdownSeconds !== null && countdownSeconds > 0 && (
              <div className="absolute inset-0 bg-black/75 backdrop-blur-md flex flex-col items-center justify-center z-40 text-center space-y-3 animate-fade-in">
                <span className="text-sm font-light text-slate-300 uppercase tracking-widest">
                  Chuẩn bị co chân sau
                </span>
                <div className="text-8xl font-light text-emerald-400 tracking-tighter tabular-nums animate-bounce">
                  {countdownSeconds}
                </div>
                <p className="text-xs text-slate-400 max-w-xs">
                  Tựa máy vào gối hoặc đầu giường, quay ngang mặt bên chân {leg === 'left' ? 'Trái' : 'Phải'}.
                </p>
              </div>
            )}

            {/* Standby State */}
            {!cameraActive && !isPhotoFallback && (
              <div className="p-6 text-center max-w-xs text-slate-400 space-y-3 z-10">
                <div className="w-14 h-14 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center mx-auto text-emerald-400 shadow-xl">
                  <Timer className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-white font-medium">Chế Độ Rảnh Tay (Hands-Free)</p>
                  <p className="text-xs text-slate-400 font-light leading-relaxed">
                    Tựa điện thoại vào gối/chai nước ở mép giường. Bấm đo đếm ngược để bạn thoải mái co gối, máy tự bắt góc đỉnh!
                  </p>
                </div>
                <button
                  onClick={handleStartHandsFree}
                  disabled={isLoadingModel}
                  className="py-3 px-6 bg-white hover:bg-slate-100 text-slate-950 font-semibold rounded-full text-xs transition shadow-xl mx-auto flex items-center gap-2"
                >
                  <Timer className="w-4 h-4" />
                  <span>Bắt Đầu Đếm Ngược 5s</span>
                </button>
              </div>
            )}

            {/* Top Live + Peak Badge */}
            {(liveCameraFlexion !== null || cameraPeakFlexion !== null) && (
              <div className="absolute top-3 left-3 bg-[#16181F]/90 backdrop-blur-xl border border-white/15 rounded-2xl p-2.5 shadow-2xl flex items-center gap-3 z-20">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center font-light text-2xl tabular-nums ${
                    !isAngleSafe(liveCameraFlexion || 0)
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  }`}
                >
                  {liveCameraFlexion ?? cameraPeakFlexion}°
                </div>
                <div className="text-left pr-1 space-y-0.5">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                    {cameraPeakFlexion ? `Đỉnh đạt: ${cameraPeakFlexion}°` : 'Góc gập'}
                  </div>
                  <div className="text-xs font-medium text-emerald-300 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>≤ Giới hạn {safeMaxFlexion}°</span>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Guidance Pill */}
            {cameraActive && !isPhotoFallback && !isManualCaliper && (
              <div className="absolute bottom-3 left-3 right-3 flex flex-col gap-1.5 z-20">
                <div className="flex items-center gap-1.5 self-start bg-[#0C0D11]/85 backdrop-blur-md border border-white/10 rounded-full px-2.5 py-1 text-[10px] text-slate-300">
                  <span className="text-slate-400">Khớp:</span>
                  <span className={jointDiag.hip ? 'text-emerald-400' : 'text-rose-400'}>● Hông</span>
                  <span className="text-white/20">|</span>
                  <span className={jointDiag.knee ? 'text-emerald-400' : 'text-rose-400'}>● Gối</span>
                  <span className="text-white/20">|</span>
                  <span className={jointDiag.ankle ? 'text-emerald-400' : 'text-rose-400'}>● Cổ chân</span>
                </div>
                <div className="p-2 rounded-xl backdrop-blur-md border text-[11px] font-light flex items-center gap-1.5 bg-[#16181F]/90 border-white/10 text-slate-200 shadow-lg">
                  <Crosshair className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>{jointDiag.guidance}</span>
                </div>
              </div>
            )}

            {/* Top Right Controls */}
            {cameraActive && !isPhotoFallback && (
              <div className="absolute top-3 right-3 flex items-center gap-2 z-20">
                <button
                  onClick={() => setIsManualCaliper(!isManualCaliper)}
                  className={`p-2.5 rounded-full backdrop-blur-md border shadow-xl transition ${
                    isManualCaliper ? 'bg-amber-400 text-slate-950 border-amber-300 font-bold' : 'bg-white/[0.08] text-white border-white/15'
                  }`}
                  title="Thước 3 điểm thủ công"
                >
                  <Move className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsFrozen(!isFrozen)}
                  className={`p-2.5 rounded-full backdrop-blur-md border shadow-xl transition ${
                    isFrozen ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-white/[0.08] text-white border-white/15'
                  }`}
                >
                  {isFrozen ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setFacingMode((m) => (m === 'environment' ? 'user' : 'environment'))}
                  className="p-2.5 rounded-full bg-white/[0.08] text-white border border-white/15 shadow-xl transition"
                >
                  <FlipHorizontal className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Action Button Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {cameraActive ? (
              <button
                onClick={stopCamera}
                className="py-3 px-4 rounded-full border border-white/10 text-slate-300 hover:text-white hover:bg-white/[0.06] text-xs font-medium transition"
              >
                Tắt Camera
              </button>
            ) : (
              <button
                onClick={handleStartHandsFree}
                className="py-3.5 px-5 bg-white hover:bg-slate-100 text-slate-950 font-semibold rounded-full text-xs transition flex items-center justify-center gap-2 shadow-xl"
              >
                <Timer className="w-4 h-4" />
                <span>Bắt Đầu Đếm Ngược 5s</span>
              </button>
            )}

            <label className="py-3 px-4 rounded-full bg-white/[0.06] hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-medium transition flex items-center justify-center gap-2 cursor-pointer">
              <Upload className="w-4 h-4 text-amber-300" />
              <span>Tải Ảnh Đo Góc</span>
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
            </label>

            <button
              onClick={() => handleSaveRecord(cameraPeakFlexion ?? liveCameraFlexion ?? 0, 'live')}
              disabled={liveCameraFlexion === null && cameraPeakFlexion === null}
              className="py-3.5 px-5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 disabled:opacity-40 disabled:pointer-events-none text-slate-950 font-semibold rounded-full text-xs transition flex items-center justify-center gap-2 shadow-lg"
            >
              <BookmarkPlus className="w-4 h-4" />
              <span>Lưu Góc Đỉnh ({cameraPeakFlexion ?? liveCameraFlexion ?? 0}°)</span>
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

      {/* Guide Modal */}
      {showGuideModal && (
        <div className="fixed sm:absolute inset-0 z-50 bg-[#0C0D11]/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#16181F] border border-white/[0.08] rounded-[32px] max-w-md w-full max-h-[85vh] flex flex-col shadow-2xl text-white">
            <div className="p-5 border-b border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-emerald-400" />
                <h3 className="font-light text-white text-base">Hướng Dẫn Tự Đo Góc Khi Ở Một Mình</h3>
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
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  Phương Án 1: Thước Cảm Biến Cẳng Chân (Khuyên Dùng)
                </div>
                <p>
                  Đặt điện thoại áp dọc xương ống đồng (cẳng chân), chân duỗi thẳng $\rightarrow$ Bấm <strong>Hiệu chuẩn 0°</strong> $\rightarrow$ Co chân từ từ. Điện thoại sẽ đo trực tiếp góc nghiêng cẳng chân mà <strong>không cần camera, không cần người khác cầm hộ</strong>.
                </p>
              </div>

              <div className="p-3.5 bg-white/[0.04] border border-white/[0.08] rounded-2xl space-y-1.5">
                <div className="font-medium text-white flex items-center gap-1.5">
                  <Timer className="w-4 h-4 text-emerald-400" />
                  Phương Án 2: Camera Rảnh Tay (Hands-Free)
                </div>
                <p>
                  Tựa điện thoại vào gối hoặc đầu giường nhìn ngang hông gối (~1 mét). Bấm <strong>Đếm ngược 5s</strong>. Bạn có đủ thời gian nằm xuống và co gối. Hệ thống tự động bắt khoảnh khắc bạn gập được sâu nhất (Peak ROM) và lưu lại mà không cần gồng giữ chân chịu đau!
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
                <h3 className="font-light text-white text-base">Lịch Sử Đo Biên Độ Gối</h3>
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
                  Chưa có lần đo nào được lưu.
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
                            • {record.source === 'gyro' ? 'Cảm biến cẳng chân' : record.source === 'live' ? 'Camera rảnh tay' : 'Thủ công'}
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
