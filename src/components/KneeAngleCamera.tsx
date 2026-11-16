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
  FlipHorizontal
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
  const [currentFlexionAngle, setCurrentFlexionAngle] = useState<number | null>(null);
  const [currentInternalAngle, setCurrentInternalAngle] = useState<number | null>(null);
  const [isPhotoFallback, setIsPhotoFallback] = useState<boolean>(false);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [historyRecords, setHistoryRecords] = useState<AngleRecord[]>([]);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const photoCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef<number>(-1);
  const streamRef = useRef<MediaStream | null>(null);

  // Load history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('goikhoe_angle_history');
      if (saved) {
        setHistoryRecords(JSON.parse(saved));
      }
    } catch {
      // LocalStorage error
    }
  }, []);

  // Update selected leg if prop changes
  useEffect(() => {
    setLeg(selectedLeg);
  }, [selectedLeg]);

  // Save history to localStorage helper
  const saveToLocalStorage = (records: AngleRecord[]) => {
    try {
      localStorage.setItem('goikhoe_angle_history', JSON.stringify(records));
      setHistoryRecords(records);
    } catch {
      // LocalStorage error
    }
  };

  // Initialize PoseLandmarker
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

  // Calculate Angle in 2D degrees:
  // Hip -> Knee -> Ankle
  // Returns raw internal angle (180° = fully straight)
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

  // Clean up camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Video processing loop
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

    const currentTimeMs = performance.now();
    if (video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;
      try {
        const results = poseLandmarkerRef.current.detectForVideo(video, currentTimeMs);

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (results.landmarks && results.landmarks.length > 0) {
          const landmarks = results.landmarks[0];

          // Landmark indices:
          // Left: Hip = 23, Knee = 25, Ankle = 27
          // Right: Hip = 24, Knee = 26, Ankle = 28
          const isLeft = leg === 'left';
          const hipIdx = isLeft ? 23 : 24;
          const kneeIdx = isLeft ? 25 : 26;
          const ankleIdx = isLeft ? 27 : 28;

          const hip = landmarks[hipIdx];
          const knee = landmarks[kneeIdx];
          const ankle = landmarks[ankleIdx];

          // Check if key landmarks are visible / confident
          const minVisibility = 0.4;
          const areLandmarksValid =
            hip && knee && ankle &&
            (hip.visibility === undefined || hip.visibility > minVisibility) &&
            (knee.visibility === undefined || knee.visibility > minVisibility) &&
            (ankle.visibility === undefined || ankle.visibility > minVisibility);

          if (areLandmarksValid) {
            const hPt = { x: hip.x * canvas.width, y: hip.y * canvas.height };
            const kPt = { x: knee.x * canvas.width, y: knee.y * canvas.height };
            const aPt = { x: ankle.x * canvas.width, y: ankle.y * canvas.height };

            const { internalAngle, flexionAngle } = calculateKneeAngle(hPt, kPt, aPt);

            setCurrentInternalAngle(internalAngle);
            setCurrentFlexionAngle(flexionAngle);

            const isSafe = flexionAngle <= safeMaxFlexion;
            const lineColor = isSafe ? '#10b981' : '#ef4444'; // Emerald vs Red
            const glowColor = isSafe ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.6)';

            // Draw connecting bones
            ctx.save();
            ctx.lineWidth = 8;
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

            // Draw joint nodes
            const drawJoint = (pt: { x: number; y: number }, label: string, r = 12) => {
              ctx.beginPath();
              ctx.arc(pt.x, pt.y, r, 0, 2 * Math.PI);
              ctx.fillStyle = '#ffffff';
              ctx.fill();
              ctx.strokeStyle = lineColor;
              ctx.lineWidth = 4;
              ctx.stroke();

              // Label
              ctx.font = 'bold 16px sans-serif';
              ctx.fillStyle = '#ffffff';
              ctx.shadowColor = '#000000';
              ctx.shadowBlur = 6;
              ctx.fillText(label, pt.x + 14, pt.y + 6);
            };

            drawJoint(hPt, isLeft ? 'Háng T' : 'Háng P', 10);
            drawJoint(kPt, `${flexionAngle}°`, 16);
            drawJoint(aPt, isLeft ? 'Cổ chân T' : 'Cổ chân P', 10);

            // Draw safety warning badge on canvas if exceeded
            if (!isSafe) {
              const bannerH = 64;
              ctx.fillStyle = 'rgba(220, 38, 38, 0.9)';
              ctx.fillRect(0, canvas.height - bannerH, canvas.width, bannerH);
              ctx.font = 'bold 22px sans-serif';
              ctx.fillStyle = '#ffffff';
              ctx.textAlign = 'center';
              ctx.fillText(
                `⚠️ VƯỢT QUÁ GÓC AN TOÀN (${safeMaxFlexion}°)! DỪNG LẠI!`,
                canvas.width / 2,
                canvas.height - bannerH / 2 + 8
              );
              ctx.textAlign = 'start';
            }

            ctx.restore();
          } else {
            setCurrentFlexionAngle(null);
          }
        } else {
          setCurrentFlexionAngle(null);
        }
      } catch (err) {
        console.warn('Pose estimation error in loop:', err);
      }
    }

    animationFrameRef.current = requestAnimationFrame(predictVideoFrame);
  }, [leg, safeMaxFlexion]);

  // Start/Stop RAF based on cameraActive
  useEffect(() => {
    if (cameraActive) {
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
  }, [cameraActive, predictVideoFrame]);

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

        // Draw image onto canvas
        ctx.drawImage(img, 0, 0);

        try {
          // Switch to IMAGE mode or use detect with canvas
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
              const lineColor = isSafe ? '#10b981' : '#ef4444';

              // Draw skeleton overlay
              ctx.lineWidth = Math.max(6, Math.round(canvas.width / 120));
              ctx.strokeStyle = lineColor;
              ctx.lineCap = 'round';
              ctx.beginPath();
              ctx.moveTo(hPt.x, hPt.y);
              ctx.lineTo(kPt.x, kPt.y);
              ctx.lineTo(aPt.x, aPt.y);
              ctx.stroke();

              // Joint circles
              const r = Math.max(10, Math.round(canvas.width / 60));
              ctx.fillStyle = '#ffffff';
              ctx.beginPath();
              ctx.arc(kPt.x, kPt.y, r, 0, 2 * Math.PI);
              ctx.fill();
              ctx.stroke();

              // Text label
              ctx.font = `bold ${Math.max(24, Math.round(canvas.width / 30))}px sans-serif`;
              ctx.fillStyle = lineColor;
              ctx.fillText(`${flexionAngle}°`, kPt.x + r + 8, kPt.y + 10);
            }
          }
          // Restore running mode to VIDEO for when live is restarted
          await poseLandmarkerRef.current?.setOptions({ runningMode: 'VIDEO' });
        } catch (err) {
          console.error('Error analyzing photo:', err);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Save current angle to history
  const handleSaveRecord = () => {
    if (currentFlexionAngle === null) return;

    const isSafe = currentFlexionAngle <= safeMaxFlexion;
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
      flexionAngle: currentFlexionAngle,
      internalAngle: currentInternalAngle || 180 - currentFlexionAngle,
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

    setSaveSuccessMsg(`Đã lưu góc gập ${currentFlexionAngle}° (${leg === 'left' ? 'Gối Trái' : 'Gối Phải'})`);
    setTimeout(() => setSaveSuccessMsg(null), 3000);
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

  return (
    <div className="bg-slate-900 text-slate-100 rounded-3xl p-4 sm:p-6 border border-slate-800 shadow-xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Camera className="w-5 h-5 text-emerald-400" />
            Đo Góc Gối Bằng Camera AI
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Nhận diện xương Hông - Khớp Gối - Cổ chân chuẩn Y khoa
          </p>
        </div>

        <button
          onClick={() => setShowHistoryModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
        >
          <History className="w-4 h-4 text-emerald-400" />
          <span>Lịch sử ({historyRecords.length})</span>
        </button>
      </div>

      {/* Control Selector: Left/Right Leg & Limits */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-950/60 rounded-2xl border border-slate-800/80">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400 font-semibold mr-1">Chân đo:</span>
          <button
            onClick={() => setLeg('left')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              leg === 'left'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Gối Trái (L)
          </button>
          <button
            onClick={() => setLeg('right')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              leg === 'right'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Gối Phải (R)
          </button>
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-slate-400">Giới hạn an toàn:</span>
          <span className="font-bold px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30">
            &le; {safeMaxFlexion}°
          </span>
        </div>
      </div>

      {/* Model Loading / Error Status */}
      {isLoadingModel && (
        <div className="py-6 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
          <RotateCw className="w-4 h-4 animate-spin text-emerald-400" />
          Đang tải mô hình thị giác AI (MediaPipe PoseLandmarker)...
        </div>
      )}

      {modelError && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <span>{modelError}</span>
        </div>
      )}

      {/* Viewport Area (Mobile Portrait 3:4) */}
      <div className="relative aspect-[3/4] max-h-[480px] w-full bg-black rounded-3xl overflow-hidden border border-slate-800 flex items-center justify-center">
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

        {/* Standby Placeholder */}
        {!cameraActive && !isPhotoFallback && (
          <div className="p-6 text-center max-w-xs text-slate-400">
            <Camera className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-xs text-slate-300 font-medium mb-1">
              Camera đang tắt
            </p>
            <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">
              Bật camera và đặt điện thoại vuông góc với mặt bên khớp gối để đo chính xác nhất.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <button
                onClick={startCamera}
                disabled={isLoadingModel}
                className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold rounded-xl text-xs transition disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-md"
              >
                <Camera className="w-4 h-4" />
                Mở Camera Trực Tiếp
              </button>
            </div>
          </div>
        )}

        {/* On-screen Realtime Angle Badge */}
        {currentFlexionAngle !== null && (
          <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md border border-slate-700/80 rounded-2xl p-2.5 shadow-xl flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl tabular-nums ${
                isAngleSafe
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse'
              }`}
            >
              {currentFlexionAngle}°
            </div>
            <div className="text-left pr-1">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Góc gập gối (Flexion)</div>
              <div
                className={`text-xs font-bold flex items-center gap-1 ${
                  isAngleSafe ? 'text-emerald-300' : 'text-red-400'
                }`}
              >
                {isAngleSafe ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    An toàn (&le; {safeMaxFlexion}°)
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5" />
                    CẢNH BÁO QUÁ GÓC
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Floating switch camera button */}
        {cameraActive && !isPhotoFallback && (
          <button
            onClick={toggleFacingMode}
            title="Đổi camera trước/sau"
            aria-label="Đổi camera trước hoặc sau"
            className="absolute top-3 right-3 p-2.5 bg-slate-900/80 hover:bg-slate-800 text-white rounded-xl backdrop-blur border border-slate-700 shadow-lg active:scale-90 transition"
          >
            <FlipHorizontal className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Notification Toast */}
      {saveSuccessMsg && (
        <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          {saveSuccessMsg}
        </div>
      )}

      {/* Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {cameraActive ? (
          <button
            onClick={stopCamera}
            className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition border border-slate-700"
          >
            Tắt Camera
          </button>
        ) : (
          <button
            onClick={startCamera}
            disabled={isLoadingModel}
            className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition border border-emerald-500 flex items-center justify-center gap-1.5 shadow"
          >
            <Camera className="w-4 h-4" />
            Bật Camera
          </button>
        )}

        {/* Photo Upload fallback */}
        <label className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition border border-slate-700 flex items-center justify-center gap-1.5 cursor-pointer">
          <Upload className="w-4 h-4 text-sky-400" />
          <span>Tải Ảnh Gối Lên Đo</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoUpload}
          />
        </label>

        {/* Save Current Measurement */}
        <button
          onClick={handleSaveRecord}
          disabled={currentFlexionAngle === null}
          className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-40 disabled:pointer-events-none text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow"
        >
          <BookmarkPlus className="w-4 h-4" />
          Lưu Số Đo Này
        </button>
      </div>

      {/* Guide Note */}
      <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-3 flex items-start gap-2 text-[11px] text-slate-400">
        <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="text-slate-300">Mẹo đo chuẩn y khoa:</strong> Đặt điện thoại nghiêng một góc ngang vuông góc với cạnh bên chân mổ. Đảm bảo nhìn rõ cả 3 điểm: ụ mấu chuyển lớn xương đùi (hông), khe khớp gối ngoài và mắt cá ngoài. Duỗi thẳng hoàn toàn = 0°, gập vuông góc = 90°.
        </p>
      </div>

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed sm:absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full max-h-[85vh] flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-white text-base">Lịch Sử Đo Biên Độ Gối</h3>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              {historyRecords.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  Chưa có lần đo nào được lưu. Hãy mở camera hoặc tải ảnh để bắt đầu đo góc gối.
                </div>
              ) : (
                historyRecords.map((record) => (
                  <div
                    key={record.id}
                    className="p-3 bg-slate-950 border border-slate-800/80 rounded-2xl flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg ${
                          record.isSafe
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}
                      >
                        {record.flexionAngle}°
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">
                          {record.leg === 'left' ? 'Gối Trái (L)' : 'Gối Phải (R)'}
                          <span className="text-[10px] ml-2 font-normal text-slate-400">
                            {record.source === 'live' ? '• Live AI' : '• Ảnh tải lên'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {record.timestamp}
                        </div>
                        <div
                          className={`text-[10px] font-semibold mt-0.5 ${
                            record.isSafe ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          Giới hạn: &le; {record.safeLimit}° ({record.isSafe ? 'Đạt' : 'Vượt giới hạn'})
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteRecord(record.id)}
                      className="p-2 text-slate-500 hover:text-red-400 rounded-lg transition"
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
              <div className="p-3 border-t border-slate-800 flex justify-end">
                <button
                  onClick={handleClearHistory}
                  className="px-3 py-1.5 text-xs text-red-400 hover:text-red-300 font-semibold transition"
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
