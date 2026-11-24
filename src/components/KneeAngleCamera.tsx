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
  ArrowUpRight,
  ShieldCheck,
  Crosshair
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
  source: 'live' | 'photo';
  note?: string;
}

interface KneeAngleCameraProps {
  safeMaxFlexion?: number;
  selectedLeg?: 'left' | 'right';
  onRecordSaved?: (record: AngleRecord) => void;
}

export default function KneeAngleCamera({
  safeMaxFlexion = 90,
  selectedLeg = 'left',
  onRecordSaved,
}: KneeAngleCameraProps) {
  const [leg, setLeg] = useState<'left' | 'right'>(selectedLeg);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isLoadingModel, setIsLoadingModel] = useState<boolean>(true);
  const [modelError, setModelError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [isFrozen, setIsFrozen] = useState<boolean>(false);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Live Angle States
  const [currentFlexionAngle, setCurrentFlexionAngle] = useState<number | null>(null);
  const [currentInternalAngle, setCurrentInternalAngle] = useState<number | null>(null);
  const [landmarksStatus, setLandmarksStatus] = useState<'GOOD' | 'PARTIAL' | 'LOST'>('LOST');

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

  // Smooth filter ref
  const smoothedAngleRef = useRef<number | null>(null);

  // Elements & MediaPipe
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const photoCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef<number>(-1);
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

  // Update selected leg if prop changes
  useEffect(() => {
    setLeg(selectedLeg);
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
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
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

  // Calculate Angle in 2D degrees
  const calculateKneeAngle = (
    hip: { x: number; y: number },
    knee: { x: number; y: number },
    ankle: { x: number; y: number }
  ) => {
    const v1 = { x: hip.x - knee.x, y: hip.y - knee.y };
    const v2 = { x: ankle.x - knee.x, y: ankle.y - knee.y };

    const dotProduct = v1.x * v2.x + v1.y * v2.y;
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

    if (mag1 === 0 || mag2 === 0) return { internalAngle: 180, flexionAngle: 0 };

    let cosAngle = dotProduct / (mag1 * mag2);
    cosAngle = Math.max(-1, Math.min(1, cosAngle));
    const angleRad = Math.acos(cosAngle);
    const internalAngle = Math.round((angleRad * 180) / Math.PI);

    // Clinical Flexion Angle: 0° is fully straight, 90° is bent right angle
    const flexionAngle = Math.max(0, 180 - internalAngle);

    return { internalAngle, flexionAngle };
  };

  // Start Camera
  const startCamera = async () => {
    setIsPhotoFallback(false);
    setIsFrozen(false);
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
  }, []);

  // Toggle Camera Facing Mode
  const toggleFacingMode = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
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
      leg,
      flexionAngle: angle,
      internalAngle: 180 - angle,
      safeLimit: safeMaxFlexion,
      isSafe,
      source: isPhotoFallback ? 'photo' : 'live',
      note: isSafe ? 'Trong giới hạn an toàn' : 'Vượt giới hạn an toàn',
    };

    const updated = [newRecord, ...historyRecords];
    saveToLocalStorage(updated);
    if (onRecordSaved) {
      onRecordSaved(newRecord);
    }

    playChime(isSafe ? 'success' : 'warning');
    setSaveSuccessMsg(`Đã ghi nhận góc gập ${angle}° (${leg === 'left' ? 'Gối Trái' : 'Gối Phải'})`);
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  }, [currentFlexionAngle, safeMaxFlexion, leg, isPhotoFallback, historyRecords, onRecordSaved, playChime]);

  // Realtime Video processing loop with Smooth EMA & Goniometer Arc
  const predictVideoFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !poseLandmarkerRef.current || isFrozen) {
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

    const currentTimeMs = performance.now();
    if (video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;
      try {
        const results = poseLandmarkerRef.current.detectForVideo(video, currentTimeMs);

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (results.landmarks && results.landmarks.length > 0) {
          const landmarks = results.landmarks[0];

          // Left: Hip = 23, Knee = 25, Ankle = 27
          // Right: Hip = 24, Knee = 26, Ankle = 28
          const isLeft = leg === 'left';
          const hipIdx = isLeft ? 23 : 24;
          const kneeIdx = isLeft ? 25 : 26;
          const ankleIdx = isLeft ? 27 : 28;

          const hip = landmarks[hipIdx];
          const knee = landmarks[kneeIdx];
          const ankle = landmarks[ankleIdx];

          const minVisibility = 0.35;
          const isHipOk = hip && (hip.visibility === undefined || hip.visibility > minVisibility);
          const isKneeOk = knee && (knee.visibility === undefined || knee.visibility > minVisibility);
          const isAnkleOk = ankle && (ankle.visibility === undefined || ankle.visibility > minVisibility);

          if (isHipOk && isKneeOk && isAnkleOk) {
            setLandmarksStatus('GOOD');
            const hPt = { x: hip.x * canvas.width, y: hip.y * canvas.height };
            const kPt = { x: knee.x * canvas.width, y: knee.y * canvas.height };
            const aPt = { x: ankle.x * canvas.width, y: ankle.y * canvas.height };

            const { internalAngle, flexionAngle } = calculateKneeAngle(hPt, kPt, aPt);

            // Apply Exponential Moving Average (EMA) smoothing to avoid frame jitter
            let displayFlexion = flexionAngle;
            if (smoothedAngleRef.current === null) {
              smoothedAngleRef.current = flexionAngle;
            } else {
              smoothedAngleRef.current = Math.round(smoothedAngleRef.current * 0.7 + flexionAngle * 0.3);
              displayFlexion = smoothedAngleRef.current;
            }

            setCurrentInternalAngle(internalAngle);
            setCurrentFlexionAngle(displayFlexion);

            const isSafe = displayFlexion <= safeMaxFlexion;
            const isNearLimit = displayFlexion > safeMaxFlexion - 10 && isSafe;
            const lineColor = !isSafe ? '#f43f5e' : isNearLimit ? '#fbbf24' : '#10b981';
            const glowColor = !isSafe ? 'rgba(244, 63, 94, 0.5)' : 'rgba(16, 185, 129, 0.4)';

            ctx.save();

            // 1. Draw High-Tech Connecting Laser Bones
            ctx.lineWidth = 6;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = lineColor;
            ctx.shadowColor = glowColor;
            ctx.shadowBlur = 14;

            ctx.beginPath();
            ctx.moveTo(hPt.x, hPt.y);
            ctx.lineTo(kPt.x, kPt.y);
            ctx.lineTo(aPt.x, aPt.y);
            ctx.stroke();

            // 2. Draw Medical Goniometer Fan Arc at Knee Joint
            const angleV1 = Math.atan2(hPt.y - kPt.y, hPt.x - kPt.x);
            const angleV2 = Math.atan2(aPt.y - kPt.y, aPt.x - kPt.x);
            const arcRadius = Math.min(85, Math.hypot(hPt.x - kPt.x, hPt.y - kPt.y) * 0.4);

            ctx.beginPath();
            ctx.moveTo(kPt.x, kPt.y);
            ctx.arc(kPt.x, kPt.y, arcRadius, angleV1, angleV2, false);
            ctx.closePath();
            ctx.fillStyle = !isSafe ? 'rgba(244, 63, 94, 0.25)' : 'rgba(16, 185, 129, 0.2)';
            ctx.fill();

            // Arc Outline with ticks
            ctx.beginPath();
            ctx.arc(kPt.x, kPt.y, arcRadius, angleV1, angleV2, false);
            ctx.lineWidth = 3;
            ctx.strokeStyle = lineColor;
            ctx.stroke();

            // 3. Draw Joint Rings & Degree Indicator
            const drawJoint = (pt: { x: number; y: number }, r: number, isCenter = false) => {
              ctx.beginPath();
              ctx.arc(pt.x, pt.y, r + 4, 0, 2 * Math.PI);
              ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
              ctx.fill();

              ctx.beginPath();
              ctx.arc(pt.x, pt.y, r, 0, 2 * Math.PI);
              ctx.fillStyle = '#ffffff';
              ctx.fill();
              ctx.strokeStyle = lineColor;
              ctx.lineWidth = 3;
              ctx.stroke();

              if (isCenter) {
                // Central HUD Degree Display
                const boxW = 86;
                const boxH = 34;
                const boxX = pt.x + 16;
                const boxY = pt.y - boxH / 2;

                ctx.fillStyle = 'rgba(12, 13, 17, 0.85)';
                ctx.strokeStyle = lineColor;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.roundRect(boxX, boxY, boxW, boxH, 12);
                ctx.fill();
                ctx.stroke();

                ctx.font = '600 16px Outfit, sans-serif';
                ctx.fillStyle = '#ffffff';
                ctx.textAlign = 'center';
                ctx.fillText(`${displayFlexion}° Gập`, boxX + boxW / 2, boxY + 22);
                ctx.textAlign = 'start';
              }
            };

            drawJoint(hPt, 7);
            drawJoint(kPt, 12, true);
            drawJoint(aPt, 7);

            // 4. Over-limit warning header banner if exceeded
            if (!isSafe) {
              const bannerH = 50;
              ctx.fillStyle = 'rgba(225, 29, 72, 0.9)';
              ctx.fillRect(0, 0, canvas.width, bannerH);
              ctx.font = '600 16px Outfit, sans-serif';
              ctx.fillStyle = '#ffffff';
              ctx.textAlign = 'center';
              ctx.fillText(
                `⚠️ VƯỢT QUÁ GÓC AN TOÀN (${safeMaxFlexion}°) • HÃY DỪNG LẠI!`,
                canvas.width / 2,
                32
              );
              ctx.textAlign = 'start';
            }

            ctx.restore();

            // Auto-lock & Hold for 2.5s logic
            if (autoSaveEnabled && !hasAutoSavedRef.current) {
              const now = performance.now();
              if (lastAngleRef.current === null || Math.abs(lastAngleRef.current - displayFlexion) > 2) {
                lastAngleRef.current = displayFlexion;
                stableSinceRef.current = now;
                setStabilityProgress(0);
              } else if (stableSinceRef.current) {
                const elapsed = now - stableSinceRef.current;
                const progress = Math.min(100, Math.round((elapsed / 2500) * 100));
                setStabilityProgress(progress);

                if (progress >= 100) {
                  hasAutoSavedRef.current = true;
                  handleSaveRecord(displayFlexion);
                  setTimeout(() => {
                    hasAutoSavedRef.current = false;
                    setStabilityProgress(0);
                  }, 4000);
                }
              }
            }
          } else {
            setLandmarksStatus(isKneeOk ? 'PARTIAL' : 'LOST');
            setCurrentFlexionAngle(null);
            setStabilityProgress(0);
          }
        } else {
          setLandmarksStatus('LOST');
          setCurrentFlexionAngle(null);
          setStabilityProgress(0);
        }
      } catch (err) {
        console.warn('Pose estimation error in loop:', err);
      }
    }

    animationFrameRef.current = requestAnimationFrame(predictVideoFrame);
  }, [leg, safeMaxFlexion, isFrozen, autoSaveEnabled, handleSaveRecord]);

  // Start/Stop RAF
  useEffect(() => {
    if (cameraActive && !isFrozen) {
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
  }, [cameraActive, isFrozen, predictVideoFrame]);

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
            const landmarks = results.landmarks[0];
            const isLeft = leg === 'left';
            const hipIdx = isLeft ? 23 : 24;
            const kneeIdx = isLeft ? 25 : 26;
            const ankleIdx = isLeft ? 27 : 28;

            const hip = landmarks[hipIdx];
            const knee = landmarks[kneeIdx];
            const ankle = landmarks[ankleIdx];

            if (hip && knee && ankle) {
              const hPt = { x: hip.x * canvas.width, y: hip.y * canvas.height };
              const kPt = { x: knee.x * canvas.width, y: knee.y * canvas.height };
              const aPt = { x: ankle.x * canvas.width, y: ankle.y * canvas.height };

              const { internalAngle, flexionAngle } = calculateKneeAngle(hPt, kPt, aPt);
              setCurrentInternalAngle(internalAngle);
              setCurrentFlexionAngle(flexionAngle);

              const isSafe = flexionAngle <= safeMaxFlexion;
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
              ctx.fillText(`${flexionAngle}°`, kPt.x + r + 8, kPt.y + 10);
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

  return (
    <div className="bg-[#16181F] text-white rounded-[32px] p-5 border border-white/[0.08] shadow-2xl space-y-4 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-medium text-emerald-400 uppercase tracking-wider">
              Thị giác máy tính AI
            </span>
          </div>
          <h2 className="text-xl font-light text-white tracking-tight">
            Đo Góc Gập Gối Realtime
          </h2>
        </div>

        <button
          onClick={() => setShowHistoryModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/10 text-slate-300 text-xs font-normal border border-white/10 transition"
        >
          <History className="w-3.5 h-3.5 text-emerald-400" />
          <span>Lịch sử ({historyRecords.length})</span>
        </button>
      </div>

      {/* Control Selector Pill: Left/Right Leg & Limits */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-white/[0.03] rounded-2xl border border-white/[0.06]">
        <div className="flex items-center gap-1">
          <span className="text-xs text-slate-400 font-light mr-1">Chân mổ:</span>
          <button
            onClick={() => setLeg('left')}
            className={`px-3 py-1.5 rounded-full text-xs transition ${
              leg === 'left'
                ? 'bg-white text-slate-950 font-medium shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Gối Trái (L)
          </button>
          <button
            onClick={() => setLeg('right')}
            className={`px-3 py-1.5 rounded-full text-xs transition ${
              leg === 'right'
                ? 'bg-white text-slate-950 font-medium shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Gối Phải (R)
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
            className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition"
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5 text-slate-500" />}
          </button>

          {/* Auto-Lock Stability Toggle */}
          <button
            onClick={() => setAutoSaveEnabled(!autoSaveEnabled)}
            className={`px-3 py-1 rounded-full text-[11px] font-medium border transition flex items-center gap-1.5 ${
              autoSaveEnabled
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-white/[0.04] border-white/10 text-slate-400'
            }`}
          >
            <Sparkles className="w-3 h-3 text-emerald-400" />
            <span>Tự ghi (2.5s)</span>
          </button>
        </div>
      </div>

      {/* Model Loading / Error Status */}
      {isLoadingModel && (
        <div className="py-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
          <RotateCw className="w-4 h-4 animate-spin text-emerald-400" />
          Đang khởi động thị giác AI PoseLandmarker...
        </div>
      )}

      {modelError && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-xs text-rose-300 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{modelError}</span>
        </div>
      )}

      {/* Viewport Area: 3:4 Mobile Aspect Ratio */}
      <div className="relative aspect-[3/4] max-h-[460px] w-full bg-[#0C0D11] rounded-[28px] overflow-hidden border border-white/[0.08] flex items-center justify-center shadow-inner">
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
            cameraActive && !isPhotoFallback ? 'block' : 'hidden'
          } ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
        />

        {/* Photo Fallback Canvas */}
        <canvas
          ref={photoCanvasRef}
          className={`absolute inset-0 w-full h-full object-contain ${
            isPhotoFallback ? 'block' : 'hidden'
          }`}
        />

        {/* HUD Medical Alignment Reticles (Corner Crosshairs) */}
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
          <div className="p-6 text-center max-w-xs text-slate-400 space-y-3">
            <div className="w-14 h-14 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center mx-auto text-emerald-400 shadow-xl">
              <Camera className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm text-white font-medium">
                Camera đang tắt
              </p>
              <p className="text-xs text-slate-400 font-light leading-relaxed">
                Đặt điện thoại ngang tầm khớp gối, nhìn rõ mặt ngoài chân {leg === 'left' ? 'Trái' : 'Phải'}.
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

        {/* Top Floating Landmark Status & Angle Badge */}
        {currentFlexionAngle !== null && (
          <div className="absolute top-3 left-3 bg-[#16181F]/90 backdrop-blur-xl border border-white/15 rounded-2xl p-2.5 shadow-2xl flex items-center gap-3">
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
              <div className="text-[10px] text-slate-400 font-light uppercase tracking-wider">
                Góc gập (Flexion)
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
          <div className="absolute top-3.5 left-1/2 -translate-x-1/2 bg-[#16181F]/90 backdrop-blur-md border border-white/20 rounded-full py-1 px-3.5 flex items-center gap-2 shadow-2xl">
            <div className="w-3 h-3 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
            <span className="text-[11px] font-medium text-emerald-300">
              Giữ yên... {stabilityProgress}%
            </span>
          </div>
        )}

        {/* Landmark tracking quality badge */}
        {cameraActive && !isPhotoFallback && (
          <div className="absolute bottom-3 left-3 bg-[#0C0D11]/80 backdrop-blur-md border border-white/10 rounded-full px-2.5 py-1 flex items-center gap-1.5 text-[10px] text-slate-300 font-light">
            <Crosshair className={`w-3 h-3 ${landmarksStatus === 'GOOD' ? 'text-emerald-400' : landmarksStatus === 'PARTIAL' ? 'text-amber-400' : 'text-rose-400'}`} />
            <span>
              {landmarksStatus === 'GOOD' ? 'Khớp nhận diện chuẩn' : landmarksStatus === 'PARTIAL' ? 'Thiếu hông / cổ chân' : 'Đang tìm khớp gối...'}
            </span>
          </div>
        )}

        {/* Floating Controls (Flip camera + Freeze frame) */}
        {cameraActive && !isPhotoFallback && (
          <div className="absolute top-3 right-3 flex items-center gap-2">
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

      {/* Guide Note Box */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-3.5 flex items-start gap-2.5 text-xs text-slate-400 font-light leading-relaxed">
        <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <p>
          <strong className="text-white font-medium">Mẹo chuẩn y khoa:</strong> Đặt camera ngang vuông góc với cạnh bên gối {leg === 'left' ? 'Trái' : 'Phải'}. Đảm bảo thấy rõ ụ mấu chuyển lớn hông, khe khớp gối và mắt cá ngoài. Giữ yên 2.5s để hệ thống tự động ghi nhận.
        </p>
      </div>

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
                            {record.source === 'live' ? '• Live AI' : '• Ảnh tải lên'}
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