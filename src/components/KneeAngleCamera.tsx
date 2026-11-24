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
  SlidersHorizontal,
  ArrowRightLeft,
  Check
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
  source: 'live' | 'photo' | 'manual';
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

// Low-pass filter for point coordinates to eliminate sensor jitter
const smoothPoint = (prev: Point2D | null, next: Point2D, alpha = 0.22): Point2D => {
  if (!prev) return { ...next };
  const dist = Math.hypot(next.x - prev.x, next.y - prev.y);
  // If sudden jump > 120px (e.g. camera moved or person repositioned), snap faster
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
  const [leg, setLeg] = useState<'left' | 'right' | 'auto'>('auto');
  const [activeDetectedLeg, setActiveDetectedLeg] = useState<'left' | 'right'>(selectedLeg);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isLoadingModel, setIsLoadingModel] = useState<boolean>(true);
  const [modelError, setModelError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [isFrozen, setIsFrozen] = useState<boolean>(false);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Live Angle States (Throttled for React UI)
  const [currentFlexionAngle, setCurrentFlexionAngle] = useState<number | null>(null);
  const [landmarksStatus, setLandmarksStatus] = useState<'GOOD' | 'PARTIAL' | 'LOST'>('LOST');

  // Granular Joint Diagnostics
  const [jointDiag, setJointDiag] = useState<{
    hip: boolean;
    knee: boolean;
    ankle: boolean;
    guidance: string;
    oppositeLegVisible: boolean;
  }>({
    hip: false,
    knee: false,
    ankle: false,
    guidance: 'Đang tìm khớp gối...',
    oppositeLegVisible: false,
  });

  // Manual 3-Point Caliper Mode (Draggable)
  const [isManualCaliper, setIsManualCaliper] = useState<boolean>(false);
  const [caliperPoints, setCaliperPoints] = useState<{
    hip: Point2D;
    knee: Point2D;
    ankle: Point2D;
  }>({
    hip: { x: 120, y: 100 },
    knee: { x: 200, y: 220 },
    ankle: { x: 130, y: 340 },
  });
  const [draggingNode, setDraggingNode] = useState<'hip' | 'knee' | 'ankle' | null>(null);

  // Guide Modal
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);

  // Auto-Lock Stability Tracker
  const [stabilityProgress, setStabilityProgress] = useState<number>(0);
  const lastAngleRef = useRef<number | null>(null);
  const stableSinceRef = useRef<number | null>(null);
  const hasAutoSavedRef = useRef<boolean>(false);

  // Fallback & History
  const [isPhotoFallback, setIsPhotoFallback] = useState<boolean>(false);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [historyRecords, setHistoryRecords] = useState<AngleRecord[]>([]);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Point-Level Smoothing & Anti-Flicker Persistence Refs
  const smoothedPointsRef = useRef<{
    hip: Point2D | null;
    knee: Point2D | null;
    ankle: Point2D | null;
  }>({ hip: null, knee: null, ankle: null });
  const missingFramesCountRef = useRef<number>(0);
  const lastInferenceTimeRef = useRef<number>(0);
  const lastReactUpdateRef = useRef<number>(0);
  const displayAngleRef = useRef<number | null>(null);

  // Elements & MediaPipe
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const photoCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
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

  // Sync selectedLeg prop
  useEffect(() => {
    if (selectedLeg) {
      setActiveDetectedLeg(selectedLeg);
    }
  }, [selectedLeg]);

  // Audio chimes using Web Audio API
  const playChime = useCallback((type: 'success' | 'warning' | 'lock') => {
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
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } else if (type === 'lock') {
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      } else {
        // Warning
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(320, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch {}
  }, [soundEnabled]);

  // Save history helper
  const saveToLocalStorage = (records: AngleRecord[]) => {
    try {
      localStorage.setItem('goikhoe_angle_history', JSON.stringify(records));
      setHistoryRecords(records);
    } catch {}
  };

  // Initialize MediaPipe PoseLandmarker with relaxed sensitivity for close-up and bedside framing
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

        // Use lowered confidence thresholds (0.25) so it doesn't fail when body is partially framed or seated/lying down
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
        console.error('Error initializing PoseLandmarker:', err);
        if (!isCancelled) {
          setModelError('Không thể tải mô hình AI đo góc. Vui lòng kiểm tra kết nối mạng hoặc thử tính năng Tải ảnh.');
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

  // Calculate 2D Flexion Angle
  const calculateKneeAngle = (
    hip: Point2D,
    knee: Point2D,
    ankle: Point2D
  ) => {
    const v1 = { x: hip.x - knee.x, y: hip.y - knee.y };
    const v2 = { x: ankle.x - knee.x, y: ankle.y - knee.y };

    const dotProduct = v1.x * v2.x + v1.y * v2.y;
    const mag1 = Math.hypot(v1.x, v1.y);
    const mag2 = Math.hypot(v2.x, v2.y);

    if (mag1 === 0 || mag2 === 0) return { internalAngle: 180, flexionAngle: 0 };

    let cosAngle = dotProduct / (mag1 * mag2);
    cosAngle = Math.max(-1, Math.min(1, cosAngle));
    const angleRad = Math.acos(cosAngle);
    const internalAngle = (angleRad * 180) / Math.PI;

    // Clinical Flexion Angle: 0° is fully straight, 90° is bent right angle
    const flexionAngle = Math.max(0, 180 - internalAngle);

    return { internalAngle, flexionAngle };
  };

  // Start Camera
  const startCamera = async () => {
    setIsPhotoFallback(false);
    setIsFrozen(false);
    smoothedPointsRef.current = { hip: null, knee: null, ankle: null };
    missingFramesCountRef.current = 0;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
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
    } catch (err: any) {
      console.warn('Camera access error:', err);
      setCameraActive(false);
      setIsPhotoFallback(true);
    }
  };

  // Stop Camera
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
    setCameraActive(false);
    setIsFrozen(false);
    setCurrentFlexionAngle(null);
    setStabilityProgress(0);
    smoothedPointsRef.current = { hip: null, knee: null, ankle: null };
  }, []);

  // Toggle Camera Facing Mode
  const toggleFacingMode = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    smoothedPointsRef.current = { hip: null, knee: null, ankle: null };
  };

  useEffect(() => {
    if (cameraActive) {
      startCamera();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Save current record function
  const handleSaveRecord = useCallback((angleToSave?: number) => {
    const angle = angleToSave !== undefined ? angleToSave : currentFlexionAngle;
    if (angle === null) return;

    const targetLeg = leg === 'auto' ? activeDetectedLeg : leg;
    const isSafe = angle <= safeMaxFlexion;
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
      leg: targetLeg,
      flexionAngle: angle,
      internalAngle: 180 - angle,
      safeLimit: safeMaxFlexion,
      isSafe,
      source: isManualCaliper ? 'manual' : isPhotoFallback ? 'photo' : 'live',
      note: isSafe ? 'Trong giới hạn an toàn' : 'Vượt giới hạn an toàn',
    };

    const updated = [newRecord, ...historyRecords];
    saveToLocalStorage(updated);
    if (onRecordSaved) {
      onRecordSaved(newRecord);
    }

    playChime(isSafe ? 'success' : 'warning');
    setSaveSuccessMsg(`Đã ghi nhận góc gập ${angle}° (${targetLeg === 'left' ? 'Gối Trái' : 'Gối Phải'})`);
    setTimeout(() => setSaveSuccessMsg(null), 3200);
  }, [currentFlexionAngle, safeMaxFlexion, leg, activeDetectedLeg, isManualCaliper, isPhotoFallback, historyRecords, onRecordSaved, playChime]);

  // Recalculate manual caliper angle
  useEffect(() => {
    if (isManualCaliper && caliperPoints.hip && caliperPoints.knee && caliperPoints.ankle) {
      const { flexionAngle } = calculateKneeAngle(caliperPoints.hip, caliperPoints.knee, caliperPoints.ankle);
      const rounded = Math.round(flexionAngle);
      setCurrentFlexionAngle(rounded);
      setLandmarksStatus('GOOD');
    }
  }, [isManualCaliper, caliperPoints]);

  // Touch & Pointer event handling for Manual Caliper Mode
  const handlePointerDown = (node: 'hip' | 'knee' | 'ankle') => (e: React.PointerEvent) => {
    if (!isManualCaliper) return;
    e.stopPropagation();
    e.preventDefault();
    setDraggingNode(node);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isManualCaliper || !draggingNode || !viewportRef.current) return;
    const rect = viewportRef.current.getBoundingClientRect();
    const x = Math.max(10, Math.min(rect.width - 10, e.clientX - rect.left));
    const y = Math.max(10, Math.min(rect.height - 10, e.clientY - rect.top));

    setCaliperPoints((prev) => ({
      ...prev,
      [draggingNode]: { x, y },
    }));
  };

  const handlePointerUp = () => {
    setDraggingNode(null);
  };

  // ULTRA-STABLE REALTIME VIDEO LOOP
  // Enhanced with: Multi-point Fallback (Ankle/Heel/Foot), Auto-Leg Detection, Granular Diagnostics, and Edge Projection
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
    // Throttle neural net inference to ~30 FPS (32ms) to eliminate thermal throttling and dropped frames
    const isTimeToInfer = now - lastInferenceTimeRef.current >= 32;

    if (isTimeToInfer) {
      lastInferenceTimeRef.current = now;

      try {
        const results = poseLandmarkerRef.current.detectForVideo(video, now);

        if (results.landmarks && results.landmarks.length > 0) {
          const lm = results.landmarks[0];

          // Landmark indices:
          // Left: Hip = 23, Knee = 25, Ankle = 27, Heel = 29, Foot = 31
          // Right: Hip = 24, Knee = 26, Ankle = 28, Heel = 30, Foot = 32
          const lHip = lm[23];
          const lKnee = lm[25];
          const lAnkle = lm[27];
          const lHeel = lm[29];
          const lFoot = lm[31];

          const rHip = lm[24];
          const rKnee = lm[26];
          const rAnkle = lm[28];
          const rHeel = lm[30];
          const rFoot = lm[32];

          // Best lower extremity anchor (ankle -> heel -> foot index)
          const bestLAnkle = (lAnkle && (lAnkle.visibility === undefined || lAnkle.visibility > 0.15)) ? lAnkle
            : (lHeel && (lHeel.visibility === undefined || lHeel.visibility > 0.15)) ? lHeel
            : lFoot || lAnkle;

          const bestRAnkle = (rAnkle && (rAnkle.visibility === undefined || rAnkle.visibility > 0.15)) ? rAnkle
            : (rHeel && (rHeel.visibility === undefined || rHeel.visibility > 0.15)) ? rHeel
            : rFoot || rAnkle;

          const lKneeVis = lKnee?.visibility ?? 0;
          const rKneeVis = rKnee?.visibility ?? 0;
          const lScore = ((lHip?.visibility ?? 0) + lKneeVis + (bestLAnkle?.visibility ?? 0)) / 3;
          const rScore = ((rHip?.visibility ?? 0) + rKneeVis + (bestRAnkle?.visibility ?? 0)) / 3;

          // Determine target leg
          let targetLeg: 'left' | 'right';
          if (leg === 'auto') {
            targetLeg = lScore >= rScore ? 'left' : 'right';
          } else {
            targetLeg = leg;
          }

          setActiveDetectedLeg(targetLeg);

          const isLeft = targetLeg === 'left';
          const hip = isLeft ? lHip : rHip;
          const knee = isLeft ? lKnee : rKnee;
          const ankle = isLeft ? bestLAnkle : bestRAnkle;

          const otherKneeVis = isLeft ? rKneeVis : lKneeVis;
          const oppositeLegStrong = otherKneeVis > 0.45 && (isLeft ? lKneeVis : rKneeVis) < 0.2;

          // Visibility thresholds relaxed down to 0.18 for better bedside / close-up coverage
          const minVis = 0.18;
          const isKneeOk = Boolean(knee && (knee.visibility === undefined || knee.visibility > minVis));
          // If knee is very strong, accept hip even if near upper border
          const isHipOk = Boolean(hip && (hip.visibility === undefined || hip.visibility > 0.12 || (isKneeOk && hip.y < 0.25)));
          const isAnkleOk = Boolean(ankle && (ankle.visibility === undefined || ankle.visibility > 0.12 || (isKneeOk && ankle.y > 0.75)));

          // Real-time Guidance Message synthesis
          let guidanceMsg = 'Đang tìm khớp gối...';
          if (!isKneeOk) {
            guidanceMsg = oppositeLegStrong
              ? `Đang thấy rõ ${isLeft ? 'Gối Phải' : 'Gối Trái'}. Chạm nút đổi chân bên trên!`
              : 'Đặt camera nhìn ngang MẶT BÊN của gối (cách ~1m)';
          } else if (isKneeOk && !isHipOk && !isAnkleOk) {
            guidanceMsg = '💡 Đang soi quá sát đầu gối! Lùi xa ~1m để camera thấy cả Đùi và Cẳng chân';
          } else if (isKneeOk && !isHipOk) {
            guidanceMsg = '💡 Thiếu phần Hông/Đùi! Lùi camera ra xa hoặc nghiêng nhẹ lên trên';
          } else if (isKneeOk && !isAnkleOk) {
            guidanceMsg = '💡 Thiếu Cổ chân! Hướng camera xuống dưới để lấy mắt cá chân';
          } else {
            guidanceMsg = '✅ Khớp nhận diện chuẩn • Giữ yên 2.5s để tự ghi';
          }

          if (now - lastReactUpdateRef.current > 120) {
            setJointDiag({
              hip: isHipOk,
              knee: isKneeOk,
              ankle: isAnkleOk,
              guidance: guidanceMsg,
              oppositeLegVisible: oppositeLegStrong,
            });
          }

          if (isHipOk && isKneeOk && isAnkleOk) {
            missingFramesCountRef.current = 0;

            const rawH = { x: hip.x * canvas.width, y: hip.y * canvas.height };
            const rawK = { x: knee.x * canvas.width, y: knee.y * canvas.height };
            const rawA = { x: ankle.x * canvas.width, y: ankle.y * canvas.height };

            // Apply Point-Level Low-Pass Filter (EMA) to eliminate coordinate jitter
            const hPt = smoothPoint(smoothedPointsRef.current.hip, rawH, 0.22);
            const kPt = smoothPoint(smoothedPointsRef.current.knee, rawK, 0.22);
            const aPt = smoothPoint(smoothedPointsRef.current.ankle, rawA, 0.22);

            smoothedPointsRef.current = { hip: hPt, knee: kPt, ankle: aPt };

            // Sync caliper points so user can seamlessly transition to manual adjustment
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
        } else {
          missingFramesCountRef.current++;
          if (missingFramesCountRef.current > 10) {
            smoothedPointsRef.current = { hip: null, knee: null, ankle: null };
          }
        }
      } catch (err) {
        console.warn('Pose estimation frame error:', err);
      }
    }

    // RENDER SKELETON & GONIOMETER OVERLAY
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const pts = smoothedPointsRef.current;
    if (pts.hip && pts.knee && pts.ankle) {
      const { hip: hPt, knee: kPt, ankle: aPt } = pts;

      const { flexionAngle } = calculateKneeAngle(hPt, kPt, aPt);

      // Deadband Hysteresis: Only change display integer if angle changes by >= 0.75°
      if (displayAngleRef.current === null) {
        displayAngleRef.current = Math.round(flexionAngle);
      } else {
        if (Math.abs(flexionAngle - displayAngleRef.current) >= 0.75) {
          displayAngleRef.current = Math.round(flexionAngle);
        }
      }
      const stableFlexion = displayAngleRef.current;

      const isSafe = stableFlexion <= safeMaxFlexion;
      const isNearLimit = stableFlexion > safeMaxFlexion - 10 && isSafe;
      const lineColor = !isSafe ? '#f43f5e' : isNearLimit ? '#fbbf24' : '#10b981';
      const glowColor = !isSafe ? 'rgba(244, 63, 94, 0.45)' : 'rgba(16, 185, 129, 0.35)';

      ctx.save();

      // 1. Draw High-Tech Laser Bones (Anti-aliased & rock-solid)
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = lineColor;
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 12;

      ctx.beginPath();
      ctx.moveTo(hPt.x, hPt.y);
      ctx.lineTo(kPt.x, kPt.y);
      ctx.lineTo(aPt.x, aPt.y);
      ctx.stroke();

      // 2. Draw Medical Goniometer Arc at Knee Joint
      const angleV1 = Math.atan2(hPt.y - kPt.y, hPt.x - kPt.x);
      const angleV2 = Math.atan2(aPt.y - kPt.y, aPt.x - kPt.x);
      const arcRadius = Math.min(80, Math.hypot(hPt.x - kPt.x, hPt.y - kPt.y) * 0.38);

      ctx.beginPath();
      ctx.moveTo(kPt.x, kPt.y);
      ctx.arc(kPt.x, kPt.y, arcRadius, angleV1, angleV2, false);
      ctx.closePath();
      ctx.fillStyle = !isSafe ? 'rgba(244, 63, 94, 0.22)' : 'rgba(16, 185, 129, 0.18)';
      ctx.fill();

      // Arc Outline
      ctx.beginPath();
      ctx.arc(kPt.x, kPt.y, arcRadius, angleV1, angleV2, false);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = lineColor;
      ctx.stroke();

      // 3. Draw Joint Nodes
      const drawJoint = (pt: Point2D, r: number, isCenter = false) => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, r + 4, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(pt.x, pt.y, r, 0, 2 * Math.PI);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 3;
        ctx.stroke();

        if (isCenter) {
          // Central Glass HUD Angle Capsule
          const boxW = 92;
          const boxH = 34;
          const boxX = pt.x + 16;
          const boxY = pt.y - boxH / 2;

          ctx.fillStyle = 'rgba(12, 13, 17, 0.88)';
          ctx.strokeStyle = lineColor;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(boxX, boxY, boxW, boxH, 12);
          ctx.fill();
          ctx.stroke();

          ctx.font = '600 15px Outfit, sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.fillText(`${stableFlexion}° Gập`, boxX + boxW / 2, boxY + 22);
          ctx.textAlign = 'start';
        }
      };

      drawJoint(hPt, 7);
      drawJoint(kPt, 11, true);
      drawJoint(aPt, 7);

      // 4. Over-limit Warning Header
      if (!isSafe) {
        const bannerH = 46;
        ctx.fillStyle = 'rgba(225, 29, 72, 0.92)';
        ctx.fillRect(0, 0, canvas.width, bannerH);
        ctx.font = '600 15px Outfit, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(
          `⚠️ VƯỢT QUÁ GÓC AN TOÀN (${safeMaxFlexion}°) • HÃY DỪNG LẠI!`,
          canvas.width / 2,
          29
        );
        ctx.textAlign = 'start';
      }

      ctx.restore();

      // Throttled React UI State Update
      if (now - lastReactUpdateRef.current > 120) {
        lastReactUpdateRef.current = now;
        setCurrentFlexionAngle(stableFlexion);
        setLandmarksStatus('GOOD');
      }

      // Auto-Lock Hold Logic: Steady for 2.5s
      if (autoSaveEnabled && !hasAutoSavedRef.current) {
        if (lastAngleRef.current === null || Math.abs(lastAngleRef.current - stableFlexion) > 2) {
          lastAngleRef.current = stableFlexion;
          stableSinceRef.current = now;
          setStabilityProgress(0);
        } else if (stableSinceRef.current) {
          const elapsed = now - stableSinceRef.current;
          const progress = Math.min(100, Math.round((elapsed / 2500) * 100));
          setStabilityProgress(progress);

          if (progress >= 100) {
            hasAutoSavedRef.current = true;
            handleSaveRecord(stableFlexion);
            setTimeout(() => {
              hasAutoSavedRef.current = false;
              setStabilityProgress(0);
            }, 3500);
          }
        }
      }
    } else {
      // Missing landmarks
      if (missingFramesCountRef.current > 10 && now - lastReactUpdateRef.current > 200) {
        lastReactUpdateRef.current = now;
        setCurrentFlexionAngle(null);
        setLandmarksStatus(jointDiag.knee ? 'PARTIAL' : 'LOST');
        setStabilityProgress(0);
      }
    }

    animationFrameRef.current = requestAnimationFrame(predictVideoFrame);
  }, [leg, safeMaxFlexion, isFrozen, isManualCaliper, autoSaveEnabled, handleSaveRecord, jointDiag.knee]);

  // Start/Stop RAF
  useEffect(() => {
    if (cameraActive && !isFrozen && !isManualCaliper) {
      animationFrameRef.current = requestAnimationFrame(predictVideoFrame);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [cameraActive, isFrozen, isManualCaliper, predictVideoFrame]);

  // Handle Photo Upload
  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !poseLandmarkerRef.current) return;

    stopCamera();
    setIsPhotoFallback(true);

    const reader = new FileReader();
    reader.onload = (e) => {
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
          await poseLandmarkerRef.current?.setOptions({ runningMode: 'IMAGE' });
          const results = poseLandmarkerRef.current?.detect(canvas);

          if (results && results.landmarks && results.landmarks.length > 0) {
            const lm = results.landmarks[0];
            const isLeft = (leg === 'auto' ? activeDetectedLeg : leg) === 'left';
            const hip = lm[isLeft ? 23 : 24];
            const knee = lm[isLeft ? 25 : 26];
            const ankle = lm[isLeft ? 27 : 28] || lm[isLeft ? 29 : 30];

            if (knee && (hip || ankle)) {
              const hPt = hip
                ? { x: hip.x * canvas.width, y: hip.y * canvas.height }
                : { x: knee.x * canvas.width - 50, y: Math.max(10, knee.y * canvas.height - 180) };
              const kPt = { x: knee.x * canvas.width, y: knee.y * canvas.height };
              const aPt = ankle
                ? { x: ankle.x * canvas.width, y: ankle.y * canvas.height }
                : { x: knee.x * canvas.width - 40, y: Math.min(canvas.height - 10, knee.y * canvas.height + 180) };

              const { flexionAngle } = calculateKneeAngle(hPt, kPt, aPt);
              const roundedAngle = Math.round(flexionAngle);
              setCurrentFlexionAngle(roundedAngle);
              setLandmarksStatus('GOOD');

              const isSafe = roundedAngle <= safeMaxFlexion;
              const lineColor = isSafe ? '#10b981' : '#f43f5e';

              ctx.lineWidth = Math.max(6, Math.round(canvas.width / 120));
              ctx.strokeStyle = lineColor;
              ctx.lineCap = 'round';
              ctx.beginPath();
              ctx.moveTo(hPt.x, hPt.y);
              ctx.lineTo(kPt.x, kPt.y);
              ctx.lineTo(aPt.x, aPt.y);
              ctx.stroke();

              const r = Math.max(10, Math.round(canvas.width / 60));
              ctx.fillStyle = '#ffffff';
              ctx.beginPath();
              ctx.arc(kPt.x, kPt.y, r, 0, 2 * Math.PI);
              ctx.fill();
              ctx.stroke();

              ctx.font = `600 ${Math.max(24, Math.round(canvas.width / 30))}px Outfit, sans-serif`;
              ctx.fillStyle = lineColor;
              ctx.fillText(`${roundedAngle}°`, kPt.x + r + 8, kPt.y + 10);
            }
          }
          await poseLandmarkerRef.current?.setOptions({ runningMode: 'VIDEO' });
        } catch (err) {
          console.error('Error analyzing photo:', err);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteRecord = (id: string) => {
    const updated = historyRecords.filter((r) => r.id !== id);
    saveToLocalStorage(updated);
  };

  const handleClearHistory = () => {
    if (confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử đo góc gối không?')) {
      saveToLocalStorage([]);
    }
  };

  const isAngleSafe = currentFlexionAngle !== null && currentFlexionAngle <= safeMaxFlexion;
  const isNearLimit = currentFlexionAngle !== null && currentFlexionAngle > safeMaxFlexion - 10 && isAngleSafe;

  const currentDisplayLeg = leg === 'auto' ? activeDetectedLeg : leg;

  return (
    <div className="bg-[#16181F] text-white rounded-[32px] p-5 border border-white/[0.08] shadow-2xl space-y-4 font-sans select-none">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-medium text-emerald-400 uppercase tracking-wider">
              AI Vision Goniometer • Ổn Định Quang Học
            </span>
          </div>
          <h2 className="text-xl font-light text-white tracking-tight">
            Đo Góc Gập Gối Realtime
          </h2>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Guide Button */}
          <button
            onClick={() => setShowGuideModal(true)}
            title="Xem hướng dẫn đo chuẩn y khoa"
            className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/10 text-slate-300 border border-white/10 flex items-center justify-center transition"
          >
            <HelpCircle className="w-4 h-4 text-emerald-400" />
          </button>

          {/* History Button */}
          <button
            onClick={() => setShowHistoryModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/10 text-slate-300 text-xs font-normal border border-white/10 transition"
          >
            <History className="w-3.5 h-3.5 text-emerald-400" />
            <span>Lịch sử ({historyRecords.length})</span>
          </button>
        </div>
      </div>

      {/* Control Selector Pill: Left / Right / Auto Leg & Caliper Mode */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-white/[0.03] rounded-2xl border border-white/[0.06]">
        <div className="flex items-center gap-1">
          <span className="text-xs text-slate-400 font-light mr-1">Chân đo:</span>
          <button
            onClick={() => setLeg('auto')}
            className={`px-3 py-1 rounded-full text-xs transition ${
              leg === 'auto'
                ? 'bg-emerald-500 text-slate-950 font-medium shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Tự Động ({activeDetectedLeg === 'left' ? 'Trái' : 'Phải'})
          </button>
          <button
            onClick={() => setLeg('left')}
            className={`px-3 py-1 rounded-full text-xs transition ${
              leg === 'left'
                ? 'bg-white text-slate-950 font-medium shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Trái (L)
          </button>
          <button
            onClick={() => setLeg('right')}
            className={`px-3 py-1 rounded-full text-xs transition ${
              leg === 'right'
                ? 'bg-white text-slate-950 font-medium shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Phải (R)
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Caliper Mode Toggle */}
          <button
            onClick={() => setIsManualCaliper(!isManualCaliper)}
            title="Bật thước đo 3 điểm kéo thả thủ công"
            className={`px-3 py-1 rounded-full text-[11px] font-medium border transition flex items-center gap-1.5 ${
              isManualCaliper
                ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md font-semibold'
                : 'bg-white/[0.04] border-white/10 text-slate-400 hover:text-white'
            }`}
          >
            <Move className="w-3 h-3" />
            <span>Thước 3 Điểm</span>
          </button>

          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
            className="w-7 h-7 rounded-full bg-white/[0.06] hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition"
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5 text-slate-500" />}
          </button>

          {/* Auto-Lock Stability Toggle */}
          <button
            onClick={() => setAutoSaveEnabled(!autoSaveEnabled)}
            title="Tự động ghi khi giữ yên 2.5s"
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition flex items-center gap-1 ${
              autoSaveEnabled
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-white/[0.04] border-white/10 text-slate-400'
            }`}
          >
            <Sparkles className="w-3 h-3 text-emerald-400" />
            <span>Tự ghi</span>
          </button>
        </div>
      </div>

      {/* Model Loading / Error Status */}
      {isLoadingModel && (
        <div className="py-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
          <RotateCw className="w-4 h-4 animate-spin text-emerald-400" />
          Đang nạp bộ xử lý AI thị giác PoseLandmarker...
        </div>
      )}

      {modelError && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-xs text-rose-300 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{modelError}</span>
        </div>
      )}

      {/* Viewport Area: 3:4 Mobile Aspect Ratio */}
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

        {/* Live Skeleton Canvas */}
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 w-full h-full pointer-events-none ${
            cameraActive && !isPhotoFallback && !isManualCaliper ? 'block' : 'hidden'
          } ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
        />

        {/* Photo Fallback Canvas */}
        <canvas
          ref={photoCanvasRef}
          className={`absolute inset-0 w-full h-full object-contain ${
            isPhotoFallback ? 'block' : 'hidden'
          }`}
        />

        {/* Interactive Draggable 3-Point Caliper SVG Overlay */}
        {isManualCaliper && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-20">
            {/* Thigh Bone Line */}
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
            {/* Shin Bone Line */}
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

        {/* Interactive Draggable HTML Handles for 3 Points */}
        {isManualCaliper && (
          <div className="absolute inset-0 z-30 pointer-events-auto">
            {/* Hip Handle */}
            <div
              style={{
                left: `${caliperPoints.hip.x}px`,
                top: `${caliperPoints.hip.y}px`,
                transform: 'translate(-50%, -50%)',
              }}
              onPointerDown={handlePointerDown('hip')}
              className="absolute cursor-grab active:cursor-grabbing p-3 touch-none group"
            >
              <div className="w-8 h-8 rounded-full bg-amber-400 text-slate-950 font-bold text-[10px] flex items-center justify-center border-2 border-white shadow-xl group-hover:scale-110 transition">
                H
              </div>
              <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-black/80 px-2 py-0.5 rounded text-[9px] text-amber-300 whitespace-nowrap">
                Hông/Đùi
              </span>
            </div>

            {/* Knee Handle */}
            <div
              style={{
                left: `${caliperPoints.knee.x}px`,
                top: `${caliperPoints.knee.y}px`,
                transform: 'translate(-50%, -50%)',
              }}
              onPointerDown={handlePointerDown('knee')}
              className="absolute cursor-grab active:cursor-grabbing p-3 touch-none group"
            >
              <div className="w-10 h-10 rounded-full bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center border-2 border-white shadow-2xl group-hover:scale-110 transition animate-pulse">
                Gối
              </div>
              <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-black/80 px-2 py-0.5 rounded text-[9px] text-emerald-300 whitespace-nowrap">
                Tâm Gối
              </span>
            </div>

            {/* Ankle Handle */}
            <div
              style={{
                left: `${caliperPoints.ankle.x}px`,
                top: `${caliperPoints.ankle.y}px`,
                transform: 'translate(-50%, -50%)',
              }}
              onPointerDown={handlePointerDown('ankle')}
              className="absolute cursor-grab active:cursor-grabbing p-3 touch-none group"
            >
              <div className="w-8 h-8 rounded-full bg-sky-400 text-slate-950 font-bold text-[10px] flex items-center justify-center border-2 border-white shadow-xl group-hover:scale-110 transition">
                C
              </div>
              <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-black/80 px-2 py-0.5 rounded text-[9px] text-sky-300 whitespace-nowrap">
                Cổ Chân
              </span>
            </div>
          </div>
        )}

        {/* Alignment Reticles */}
        {cameraActive && !isPhotoFallback && (
          <div className="absolute inset-0 pointer-events-none p-4 flex flex-col justify-between">
            <div className="flex justify-between">
              <div className="w-6 h-6 border-t-2 border-l-2 border-white/20 rounded-tl-lg" />
              <div className="w-6 h-6 border-t-2 border-r-2 border-white/20 rounded-tr-lg" />
            </div>
            <div className="flex justify-between">
              <div className="w-6 h-6 border-b-2 border-l-2 border-white/20 rounded-bl-lg" />
              <div className="w-6 h-6 border-b-2 border-r-2 border-white/20 rounded-br-lg" />
            </div>
          </div>
        )}

        {/* Standby Placeholder */}
        {!cameraActive && !isPhotoFallback && (
          <div className="p-6 text-center max-w-xs text-slate-400 space-y-3 z-10">
            <div className="w-14 h-14 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center mx-auto text-emerald-400 shadow-xl">
              <Camera className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm text-white font-medium">
                Camera đang tắt
              </p>
              <p className="text-xs text-slate-400 font-light leading-relaxed">
                Đặt điện thoại ngang tầm khớp gối, nhìn từ MẶT NGOÀI bên hông chân.
              </p>
            </div>
            <button
              onClick={startCamera}
              disabled={isLoadingModel}
              className="py-3 px-6 bg-white hover:bg-slate-100 active:scale-95 text-slate-950 font-medium rounded-full text-xs transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-xl mx-auto"
            >
              <Camera className="w-4 h-4" />
              Bật Camera Realtime
            </button>
          </div>
        )}

        {/* Top Floating Angle Badge */}
        {currentFlexionAngle !== null && (
          <div className="absolute top-3 left-3 bg-[#16181F]/90 backdrop-blur-xl border border-white/15 rounded-2xl p-2.5 shadow-2xl flex items-center gap-3 z-20">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center font-light text-2xl tracking-tight tabular-nums ${
                !isAngleSafe
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                  : isNearLimit
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
              }`}
            >
              {currentFlexionAngle}°
            </div>
            <div className="text-left pr-1 space-y-0.5">
              <div className="text-[10px] text-slate-400 font-light uppercase tracking-wider flex items-center gap-1.5">
                <span>Góc gập</span>
                <span className="text-emerald-400 font-normal">({currentDisplayLeg === 'left' ? 'Gối Trái' : 'Gối Phải'})</span>
              </div>
              <div
                className={`text-xs font-medium flex items-center gap-1 ${
                  !isAngleSafe ? 'text-rose-400' : isNearLimit ? 'text-amber-300' : 'text-emerald-300'
                }`}
              >
                {!isAngleSafe ? (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5" />
                    CẢNH BÁO QUÁ GÓC
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    An toàn (≤ {safeMaxFlexion}°)
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Auto-Lock Countdown Ring in Live HUD */}
        {autoSaveEnabled && stabilityProgress > 0 && stabilityProgress < 100 && (
          <div className="absolute top-3.5 left-1/2 -translate-x-1/2 bg-[#16181F]/90 backdrop-blur-md border border-white/20 rounded-full py-1 px-3.5 flex items-center gap-2 shadow-2xl z-20">
            <div className="w-3 h-3 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
            <span className="text-[11px] font-medium text-emerald-300">
              Giữ yên... {stabilityProgress}%
            </span>
          </div>
        )}

        {/* Real-time Joint Status & Diagnostics Pills (Bottom-Left) */}
        {cameraActive && !isPhotoFallback && !isManualCaliper && (
          <div className="absolute bottom-3 left-3 right-3 flex flex-col gap-1.5 z-20">
            {/* Joint presence indicator dots */}
            <div className="flex items-center gap-1.5 self-start bg-[#0C0D11]/85 backdrop-blur-md border border-white/10 rounded-full px-2.5 py-1 text-[10px] text-slate-300">
              <span className="text-slate-400">Khớp:</span>
              <span className={`flex items-center gap-0.5 ${jointDiag.hip ? 'text-emerald-400' : 'text-rose-400'}`}>
                ● Hông
              </span>
              <span className="text-white/20">|</span>
              <span className={`flex items-center gap-0.5 ${jointDiag.knee ? 'text-emerald-400' : 'text-rose-400'}`}>
                ● Gối
              </span>
              <span className="text-white/20">|</span>
              <span className={`flex items-center gap-0.5 ${jointDiag.ankle ? 'text-emerald-400' : 'text-rose-400'}`}>
                ● Cổ chân
              </span>
            </div>

            {/* Guidance banner for user when framing is off */}
            <div className={`p-2 rounded-xl backdrop-blur-md border text-[11px] font-light flex items-center justify-between gap-2 shadow-lg ${
              landmarksStatus === 'GOOD'
                ? 'bg-emerald-950/70 border-emerald-500/30 text-emerald-300'
                : 'bg-[#16181F]/90 border-amber-500/30 text-amber-200'
            }`}>
              <div className="flex items-center gap-1.5 flex-1">
                <Crosshair className="w-3.5 h-3.5 shrink-0" />
                <span>{jointDiag.guidance}</span>
              </div>

              {jointDiag.oppositeLegVisible && (
                <button
                  onClick={() => setLeg(currentDisplayLeg === 'left' ? 'right' : 'left')}
                  className="px-2 py-0.5 bg-amber-400 text-slate-950 font-medium rounded-full text-[10px] shrink-0"
                >
                  Đổi chân
                </button>
              )}
            </div>
          </div>
        )}

        {/* Caliper Instruction Pill when in Manual Mode */}
        {isManualCaliper && (
          <div className="absolute bottom-3 left-3 right-3 bg-amber-500/20 backdrop-blur-md border border-amber-500/40 rounded-2xl p-2.5 text-xs text-amber-200 flex items-center justify-between gap-2 z-20">
            <div className="flex items-center gap-2">
              <Move className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Chạm và kéo 3 điểm (Hông, Gối, Cổ chân) vào đúng vị trí trên chân</span>
            </div>
            <button
              onClick={() => setIsManualCaliper(false)}
              className="px-2.5 py-1 bg-white text-slate-950 rounded-full text-[11px] font-medium shrink-0"
            >
              Xong
            </button>
          </div>
        )}

        {/* Floating Controls (Flip camera + Freeze frame) */}
        {cameraActive && !isPhotoFallback && (
          <div className="absolute top-3 right-3 flex items-center gap-2 z-20">
            <button
              onClick={() => setIsFrozen(!isFrozen)}
              title={isFrozen ? 'Tiếp tục live' : 'Đóng băng hình để đọc'}
              className={`p-2.5 rounded-full backdrop-blur-md border shadow-xl active:scale-90 transition ${
                isFrozen
                  ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                  : 'bg-white/[0.08] hover:bg-white/15 text-white border-white/15'
              }`}
            >
              {isFrozen ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4" />}
            </button>

            <button
              onClick={toggleFacingMode}
              title="Đổi camera trước/sau"
              className="p-2.5 rounded-full bg-white/[0.08] hover:bg-white/15 text-white border border-white/15 shadow-xl active:scale-90 transition"
            >
              <FlipHorizontal className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Visual Clinical ROM Ruler Gauge */}
      {currentFlexionAngle !== null && (
        <div className="p-3.5 bg-white/[0.03] rounded-2xl border border-white/[0.06] space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-light">Thang đo ROM lâm sàng:</span>
            <span className="font-medium text-white">
              {currentFlexionAngle}° / Giới hạn {safeMaxFlexion}°
            </span>
          </div>
          <div className="relative w-full h-2.5 bg-white/10 rounded-full overflow-hidden">
            <div
              style={{ width: `${Math.min(100, (currentFlexionAngle / 135) * 100)}%` }}
              className={`h-full rounded-full transition-all duration-300 ${
                !isAngleSafe ? 'bg-rose-500' : isNearLimit ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
            />
            {/* Safe limit tick marker */}
            <div
              style={{ left: `${(safeMaxFlexion / 135) * 100}%` }}
              className="absolute top-0 bottom-0 w-[2px] bg-white shadow-[0_0_6px_#fff]"
              title={`Ngưỡng an toàn: ${safeMaxFlexion}°`}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 font-light">
            <span>0° (Duỗi thẳng)</span>
            <span>{safeMaxFlexion}° (Ngưỡng an toàn)</span>
            <span>135° (Tối đa)</span>
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

      {/* Primary Action Button Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
        {cameraActive ? (
          <button
            onClick={stopCamera}
            className="py-3 px-4 rounded-full border border-white/10 text-slate-300 hover:text-white hover:bg-white/[0.06] text-xs font-medium transition"
          >
            Tắt Camera
          </button>
        ) : (
          <button
            onClick={startCamera}
            disabled={isLoadingModel}
            className="py-3.5 px-5 bg-white hover:bg-slate-100 text-slate-950 font-medium rounded-full text-xs transition flex items-center justify-center gap-2 shadow-xl"
          >
            <Camera className="w-4 h-4" />
            <span>Mở Camera Đo Góc</span>
          </button>
        )}

        {/* Photo Upload fallback */}
        <label className="py-3 px-4 rounded-full bg-white/[0.06] hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-medium transition flex items-center justify-center gap-2 cursor-pointer">
          <Upload className="w-4 h-4 text-amber-300" />
          <span>Tải Ảnh Đo Góc</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoUpload}
          />
        </label>

        {/* Save Current Measurement */}
        <button
          onClick={() => handleSaveRecord()}
          disabled={currentFlexionAngle === null}
          className="py-3.5 px-5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 disabled:opacity-40 disabled:pointer-events-none text-slate-950 font-medium rounded-full text-xs transition flex items-center justify-center gap-2 shadow-lg"
        >
          <BookmarkPlus className="w-4 h-4" />
          <span>Lưu Số Đo Này</span>
        </button>
      </div>

      {/* Clinical Guidance Tip Card */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-3.5 flex items-start gap-2.5 text-xs text-slate-400 font-light leading-relaxed">
        <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p>
            <strong className="text-white font-medium">Nguyên lý đo góc gối:</strong> Góc gập là góc giữa <strong className="text-emerald-400">Xương đùi (Hông → Gối)</strong> và <strong className="text-emerald-400">Cẳng chân (Gối → Cổ chân)</strong>.
          </p>
          <p className="text-[11px] text-slate-400">
            👉 Nếu soi thẳng mặt trước hoặc dí sát chỉ thấy đầu gối, AI sẽ không đủ 2 cạnh để tính góc. Hãy <strong className="text-white">quay nhìn từ mặt bên (ngang hông gối)</strong> và <strong className="text-white">lùi xa khoảng 1 mét</strong>. Hoặc bấm <strong className="text-amber-300">Thước 3 Điểm</strong> để kéo thả thủ công!
          </p>
        </div>
      </div>

      {/* Guide Modal: How to measure knee angle correctly */}
      {showGuideModal && (
        <div className="fixed sm:absolute inset-0 z-50 bg-[#0C0D11]/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#16181F] border border-white/[0.08] rounded-[32px] max-w-md w-full max-h-[85vh] flex flex-col shadow-2xl text-white">
            <div className="p-5 border-b border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-emerald-400" />
                <h3 className="font-light text-white text-base">Hướng Dẫn Đo Góc Gập Gối Chuẩn</h3>
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
                  1. Góc Quay Chuẩn: Nhìn Ngang Mặt Bên (Lateral View)
                </div>
                <p className="text-slate-300">
                  Đặt điện thoại ngang tầm khớp gối, ống kính nhìn vuông góc với cạnh bên ngoài của chân. Không quay từ đằng trước xương bánh chè vì góc nhìn trước sẽ che khuất cẳng chân.
                </p>
              </div>

              <div className="p-3.5 bg-white/[0.04] border border-white/[0.08] rounded-2xl space-y-1.5">
                <div className="font-medium text-white flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-400" />
                  2. Khoảng Cách: Lùi Xa Khoảng 1 - 1.5 Mét
                </div>
                <p className="text-slate-400">
                  Khung hình bắt buộc phải thấy trọn vẹn 3 mốc giải phẫu:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-slate-300">
                  <li><strong>Mấu chuyển lớn xương đùi (Hông)</strong></li>
                  <li><strong>Khe khớp gối ngoài (Tâm xoay gối)</strong></li>
                  <li><strong>Mắt cá ngoài (Cổ chân)</strong></li>
                </ul>
              </div>

              <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl space-y-1.5">
                <div className="font-medium text-amber-300 flex items-center gap-1.5">
                  <Move className="w-4 h-4 text-amber-400" />
                  3. Chế Độ Thước 3 Điểm Thủ Công
                </div>
                <p className="text-slate-300">
                  Nếu bạn đang mặc quần dài, đắp chăn hoặc ánh sáng yếu làm AI khó nhận diện, hãy bấm nút <strong>Thước 3 Điểm</strong> hoặc <strong>Đóng băng (Tạm dừng)</strong>, sau đó dùng ngón tay kéo 3 chấm tròn vào đúng Hông, Gối và Cổ chân để đo góc chính xác 100%!
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
            {/* Modal Header */}
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

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-3">
              {historyRecords.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs font-light">
                  Chưa có lần đo nào được lưu. Hãy mở camera để bắt đầu đo góc gối.
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
                        <div className="text-xs font-medium text-white">
                          {record.leg === 'left' ? 'Gối Trái (L)' : 'Gối Phải (R)'}
                          <span className="text-[10px] ml-2 font-light text-slate-400">
                            {record.source === 'live' ? '• Live AI' : record.source === 'manual' ? '• Thước thủ công' : '• Ảnh tải lên'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-light mt-0.5">
                          {record.timestamp}
                        </div>
                        <div
                          className={`text-[10px] font-medium mt-0.5 ${
                            record.isSafe ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          Giới hạn: ≤ {record.safeLimit}° ({record.isSafe ? 'An toàn' : 'Vượt giới hạn'})
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteRecord(record.id)}
                      className="p-2 text-slate-500 hover:text-rose-400 rounded-lg transition"
                      title="Xóa mục này"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            {historyRecords.length > 0 && (
              <div className="p-4 border-t border-white/[0.06] flex justify-end">
                <button
                  onClick={handleClearHistory}
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
