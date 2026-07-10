import React, { useRef, useEffect, useState, MouseEvent } from 'react';
import {
  Camera,
  Play,
  Square,
  Download,
  Maximize2,
  Minimize2,
  Trash2,
  Pipette,
  Check,
  Eye,
  Sliders,
  Sparkles,
  Info,
  ChevronRight,
  Activity,
  Award,
  Waves
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { HSV, TrackingSettings } from '../types';
import { updateBackgroundAndExtractMotion } from '../utils/cv';

export default function TrackingCanvas() {
  // Elements
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Tracking state refs (to avoid react state update overhead at 60fps)
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const frameCountRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(performance.now());
  const processingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const bgDataRef = useRef<Float32Array | null>(null);
  const motionMaskDataRef = useRef<ImageData | null>(null);
  const trailCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const blurredVideoCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskedBlurCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // React-controlled state
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraLoading, setCameraLoading] = useState<boolean>(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [videoSourceMode, setVideoSourceMode] = useState<'camera' | 'file'>('camera');
  const [videoFileUrl, setVideoFileUrl] = useState<string | null>(null);
  const [fps, setFps] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  
  // Settings state
  const [settings, setSettings] = useState<TrackingSettings>({
    enableTrails: true,
    motionThreshold: 45,
    echoFadeRate: 0.05,
    bgLearningRate: 0.05,
    blurAmount: 0,
    hueRotate: 0,
    compositeMode: 'screen',
    invertColors: false,
    showDebugFeed: false,
    enableAudioSync: false,
    strobeRate: 0,
    colorCycleSpeed: 0,
    verticalDrift: 0,
    horizontalDrift: 0,
    feedbackZoom: 1.0,
    motionBlur: 0,
  });

  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Recording states
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);

  // Initialize and list camera devices
  useEffect(() => {
    async function getDevices() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true }).catch(() => null);
        const devicesList = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devicesList.filter((device) => device.kind === 'videoinput');
        setDevices(videoDevices);
        if (videoDevices.length > 0) {
          setSelectedDeviceId(videoDevices[0].deviceId);
        }
        // stop dummy stream if created
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
        }
      } catch (err) {
        console.error('Error fetching video devices:', err);
      }
    }
    getDevices();

    // Clean up on unmount
    return () => {
      stopCamera();
    };
  }, []);

  // Update full screen state listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Timer for video recording
  useEffect(() => {
    if (isRecording) {
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      setRecordingSeconds(0);
    }

    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, [isRecording]);

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      const url = URL.createObjectURL(e.target.files[0]);
      setVideoFileUrl(url);
    }
  }

  // Start Camera Feed or Video File
  async function startCamera() {
    setCameraLoading(true);
    stopCamera();
    setRecordedVideoUrl(null);

    try {
      if (videoSourceMode === 'camera') {
        if (!selectedDeviceId) {
          setCameraLoading(false);
          return;
        }
        const constraints = {
          video: {
            deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 60 },
          },
          audio: settings.enableAudioSync,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.removeAttribute('src');
          videoRef.current.srcObject = stream;
          videoRef.current.loop = false;
          setupVideoPlayback();
        }
      } else {
        if (!videoFileUrl) {
          setCameraLoading(false);
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = null;
          videoRef.current.src = videoFileUrl;
          videoRef.current.loop = true;
          videoRef.current.load();
          setupVideoPlayback();
        }
      }
    } catch (err) {
      console.error('Error opening video source:', err);
      alert('Unable to access video source. Please check permissions and files.');
    } finally {
      setCameraLoading(false);
    }
  }

  function setupVideoPlayback() {
    if (!videoRef.current) return;
    
    // Start processing once video is playing and loaded
    videoRef.current.onloadedmetadata = () => {
      // Reset background model and buffers on camera start
      bgDataRef.current = null;
      motionMaskDataRef.current = null;
      if (trailCanvasRef.current) {
        const tCtx = trailCanvasRef.current.getContext('2d');
        if (tCtx) tCtx.clearRect(0, 0, trailCanvasRef.current.width, trailCanvasRef.current.height);
      }
      startRenderLoop();
    };

    videoRef.current.play().then(() => {
      setCameraActive(true);
      // In case metadata is already loaded (can happen with local files on re-play)
      if (videoRef.current!.videoWidth > 0 && !animationFrameIdRef.current) {
         videoRef.current!.onloadedmetadata = null;
         bgDataRef.current = null;
         motionMaskDataRef.current = null;
         if (trailCanvasRef.current) {
           const tCtx = trailCanvasRef.current.getContext('2d');
           if (tCtx) tCtx.clearRect(0, 0, trailCanvasRef.current.width, trailCanvasRef.current.height);
         }
         startRenderLoop();
      }
    }).catch(err => {
      console.error('Video play error:', err);
      alert('Video play error: ' + err.message);
    });
  }

  // Stop Camera Feed and loop
  function stopCamera() {
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
      videoRef.current.removeAttribute('src');
      videoRef.current.load();
    }

    setCameraActive(false);
    setFps(0);
  }

  const frameCountAbsRef = useRef<number>(0);
  const colorCycleAngleRef = useRef<number>(0);
  const lastStrobeTimeRef = useRef<number>(0);

  // High-performance CV processing and canvas rendering
  function startRenderLoop() {
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }

    const video = videoRef.current;
    const canvas = displayCanvasRef.current;
    if (!video || !canvas) return;

    // Create / configure the low-resolution hidden processing canvas
    if (!processingCanvasRef.current) {
      processingCanvasRef.current = document.createElement('canvas');
    }
    const procCanvas = processingCanvasRef.current;
    const procCtx = procCanvas.getContext('2d', { willReadFrequently: true });
    
    // Create / configure the persistent trail canvas for Echo effect
    if (!trailCanvasRef.current) {
      trailCanvasRef.current = document.createElement('canvas');
    }
    const trailCanvas = trailCanvasRef.current;
    const trailCtx = trailCanvas.getContext('2d');

    if (!blurredVideoCanvasRef.current) {
      blurredVideoCanvasRef.current = document.createElement('canvas');
    }
    const blurredVideoCanvas = blurredVideoCanvasRef.current;
    const blurredVideoCtx = blurredVideoCanvas.getContext('2d');

    // Set processing resolution (standard 640x480 for flow props)
    procCanvas.width = 640;
    procCanvas.height = 480;

    const ctx = canvas.getContext('2d');
    if (!ctx || !procCtx || !trailCtx || !blurredVideoCtx) return;

    const render = () => {
      if (video.paused || video.ended || video.videoWidth === 0 || video.videoHeight === 0) {
        animationFrameIdRef.current = requestAnimationFrame(render);
        return;
      }

      const now = performance.now();

      // 1. Match display canvas size to video aspect ratio dynamically
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      if (trailCanvas.width !== video.videoWidth || trailCanvas.height !== video.videoHeight) {
        trailCanvas.width = video.videoWidth;
        trailCanvas.height = video.videoHeight;
      }
      if (blurredVideoCanvas.width !== video.videoWidth || blurredVideoCanvas.height !== video.videoHeight) {
        blurredVideoCanvas.width = video.videoWidth;
        blurredVideoCanvas.height = video.videoHeight;
        blurredVideoCtx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight); // seed it
      }

      const w = canvas.width;
      const h = canvas.height;
      const currentSettings = settingsRef.current;

      // 2. Draw raw video frame to display canvas
      ctx.drawImage(video, 0, 0, w, h);

      // 3. Process frame for tracking
      // Draw frame to low-res canvas for high performance (using sharp video)
      procCtx.drawImage(video, 0, 0, procCanvas.width, procCanvas.height);
      const procImageData = procCtx.getImageData(0, 0, procCanvas.width, procCanvas.height);

      if (!bgDataRef.current || bgDataRef.current.length !== procImageData.data.length) {
        bgDataRef.current = new Float32Array(procImageData.data.length);
        for(let i=0; i<procImageData.data.length; i++) bgDataRef.current[i] = procImageData.data[i];
      }
      if (!motionMaskDataRef.current || motionMaskDataRef.current.width !== procCanvas.width) {
        motionMaskDataRef.current = new ImageData(procCanvas.width, procCanvas.height);
      }

      updateBackgroundAndExtractMotion(
        procImageData,
        bgDataRef.current,
        motionMaskDataRef.current,
        currentSettings.motionThreshold,
        currentSettings.bgLearningRate,
        currentSettings.invertColors
      );

      // Write the motion mask pixels to procCanvas immediately so we can use it for blur overlay and trails
      procCtx.putImageData(motionMaskDataRef.current, 0, 0);

      // 4. Temporal Motion Blur (Only applied to moving objects)
      if (currentSettings.motionBlur > 0) {
        // Accumulate video frames inside the blur canvas
        blurredVideoCtx.globalAlpha = 1.0 - currentSettings.motionBlur;
        blurredVideoCtx.drawImage(video, 0, 0, blurredVideoCanvas.width, blurredVideoCanvas.height);
        blurredVideoCtx.globalAlpha = 1.0;

        if (!maskedBlurCanvasRef.current) {
          maskedBlurCanvasRef.current = document.createElement('canvas');
        }
        const maskedBlurCanvas = maskedBlurCanvasRef.current;
        const maskedBlurCtx = maskedBlurCanvas.getContext('2d');

        if (maskedBlurCanvas.width !== video.videoWidth || maskedBlurCanvas.height !== video.videoHeight) {
          maskedBlurCanvas.width = video.videoWidth;
          maskedBlurCanvas.height = video.videoHeight;
        }

        if (maskedBlurCtx) {
          // Clear temp canvas
          maskedBlurCtx.clearRect(0, 0, maskedBlurCanvas.width, maskedBlurCanvas.height);
          
          // Draw the low-res motion mask (stretched to full size)
          maskedBlurCtx.drawImage(procCanvas, 0, 0, maskedBlurCanvas.width, maskedBlurCanvas.height);
          
          // Mask the accumulated blurred video frame
          maskedBlurCtx.globalCompositeOperation = 'source-in';
          maskedBlurCtx.drawImage(blurredVideoCanvas, 0, 0);
          maskedBlurCtx.globalCompositeOperation = 'source-over';
          
          // Draw only the blurred motion area on top of the sharp video
          ctx.drawImage(maskedBlurCanvas, 0, 0, w, h);
        }
      } else {
        // Keep it seeded so it doesn't blink black if turned on
        blurredVideoCtx.drawImage(video, 0, 0, blurredVideoCanvas.width, blurredVideoCanvas.height);
      }

      // Effect: Trail processing and rendering
      if (currentSettings.enableTrails) {
        // Effect: Feedback Zoom and Smoke Drift
        if (currentSettings.verticalDrift !== 0 || currentSettings.horizontalDrift !== 0 || currentSettings.feedbackZoom !== 1.0) {
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = trailCanvas.width;
          tempCanvas.height = trailCanvas.height;
          const tempCtx = tempCanvas.getContext('2d');
          if (tempCtx) {
            tempCtx.drawImage(trailCanvas, 0, 0);
            trailCtx.clearRect(0, 0, trailCanvas.width, trailCanvas.height);
            
            trailCtx.save();
            // Center for scaling
            trailCtx.translate(trailCanvas.width / 2, trailCanvas.height / 2);
            trailCtx.scale(currentSettings.feedbackZoom, currentSettings.feedbackZoom);
            trailCtx.translate(-trailCanvas.width / 2, -trailCanvas.height / 2);
            
            // Apply drift
            trailCtx.drawImage(tempCanvas, currentSettings.horizontalDrift, currentSettings.verticalDrift);
            trailCtx.restore();
          }
        }

        trailCtx.globalCompositeOperation = 'destination-out';
        trailCtx.fillStyle = `rgba(0, 0, 0, ${currentSettings.echoFadeRate})`;
        trailCtx.fillRect(0, 0, trailCanvas.width, trailCanvas.height);
        
        // Effect: Color Cycle and Stroboscopic rendering
        frameCountAbsRef.current++;
        colorCycleAngleRef.current = (colorCycleAngleRef.current + currentSettings.colorCycleSpeed) % 360;

        let shouldStrobe = false;
        if (currentSettings.strobeRate <= 0) {
          shouldStrobe = true;
        } else {
          if (now - lastStrobeTimeRef.current >= currentSettings.strobeRate * 1000) {
            shouldStrobe = true;
            lastStrobeTimeRef.current = now;
          }
        }

        if (shouldStrobe) {
          trailCtx.globalCompositeOperation = 'source-over';
          
          const filters = [];
          if (currentSettings.blurAmount > 0) {
            filters.push(`blur(${currentSettings.blurAmount}px)`);
          }
          
          const totalHueShift = (currentSettings.hueRotate + colorCycleAngleRef.current) % 360;
          if (totalHueShift > 0) {
            filters.push(`hue-rotate(${totalHueShift}deg)`);
          }
          
          trailCtx.filter = filters.length > 0 ? filters.join(' ') : 'none';
          
          trailCtx.drawImage(procCanvas, 0, 0, trailCanvas.width, trailCanvas.height);
          trailCtx.filter = 'none'; // reset filter
        }

        ctx.globalCompositeOperation = (currentSettings.compositeMode as GlobalCompositeOperation) || 'screen';
        ctx.drawImage(trailCanvas, 0, 0, w, h);
        ctx.globalCompositeOperation = 'source-over';
      } else {
        trailCtx.clearRect(0, 0, trailCanvas.width, trailCanvas.height);
      }

      // Draw debug binary mask overlay if enabled
      if (currentSettings.showDebugFeed) {
        ctx.globalAlpha = 0.65;
        ctx.drawImage(procCanvas, 0, 0, w, h);
        ctx.globalAlpha = 1.0;
      }


      // Compute FPS
      frameCountRef.current++;
      const delta = now - lastTimeRef.current;
      if (delta >= 1000) {
        setFps(Math.round((frameCountRef.current * 1000) / delta));
        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }

      animationFrameIdRef.current = requestAnimationFrame(render);
    };

    render();
  }

  // Video recording controls
  async function startRecording() {
    const canvas = displayCanvasRef.current;
    if (!canvas) return;

    setRecordedVideoUrl(null);
    recordedChunksRef.current = [];

    // Capture the processed canvas stream (matching whatever frame rate, ideal 30/60fps)
    const stream = canvas.captureStream(30);

    // Request audio stream from user mic if enabled
    if (settings.enableAudioSync) {
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioStream.getAudioTracks().forEach((track) => {
          stream.addTrack(track);
        });
      } catch (err) {
        console.warn('Audio capture failed or permission denied:', err);
      }
    }

    // Initialize media recorder
    const options = { mimeType: 'video/webm;codecs=vp9,opus' };
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, options);
    } catch (e) {
      // Fallback if VP9 not fully supported
      recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    }

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      setRecordedVideoUrl(url);
    };

    mediaRecorderRef.current = recorder;
    recorder.start();
    setIsRecording(true);
  }

  function stopRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }

  // Full screen toggle helper
  function toggleFullscreen() {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container
        .requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch((err) => console.error('Fullscreen failed:', err));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  }

  // Formatter for recorded time
  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* 1. Main Interactive Camera Viewport */}
      <div className="lg:col-span-8 flex flex-col gap-4 sticky top-6 z-10">
        <div
          ref={containerRef}
          className={`relative bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden flex items-center justify-center aspect-video shadow-2xl transition-all duration-300 ${
            isFullscreen ? 'fixed inset-0 z-50 rounded-none border-none' : ''
          }`}
        >
          {/* Unused raw video element (hidden offscreen, feed processed on canvas) */}
          <video
            ref={videoRef}
            className="hidden"
            playsInline
            muted
            crossOrigin="anonymous"
          />

          {/* Actual display canvas which merges raw camera + effects overlay */}
          <canvas
            ref={displayCanvasRef}
            className={`w-full h-full object-contain cursor-crosshair ${cameraActive ? 'block' : 'hidden'}`}
            id="effects-viewport"
          />

          {!cameraActive && (
            <div className="flex flex-col items-center justify-center p-8 text-center max-w-sm gap-4">
              <div className="w-16 h-16 bg-neutral-800 rounded-full flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                {videoSourceMode === 'camera' ? (
                  <Camera className="w-8 h-8 animate-pulse" />
                ) : (
                  <Play className="w-8 h-8 animate-pulse ml-1" />
                )}
              </div>
              <div>
                <h3 className="font-sans font-semibold text-lg text-neutral-200">
                  Ready to Start Juggling
                </h3>
                <p className="text-sm text-neutral-400 mt-1">
                  Connect your webcam or upload a video to unlock trailing and trajectory mapping.
                </p>
              </div>

              <div className="w-full flex bg-neutral-950/50 p-1 rounded-xl border border-neutral-800/80 mt-2">
                <button
                  onClick={() => setVideoSourceMode('camera')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    videoSourceMode === 'camera'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm'
                      : 'text-neutral-500 hover:text-neutral-300 border border-transparent'
                  }`}
                >
                  Live Camera
                </button>
                <button
                  onClick={() => setVideoSourceMode('file')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    videoSourceMode === 'file'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm'
                      : 'text-neutral-500 hover:text-neutral-300 border border-transparent'
                  }`}
                >
                  Upload Video
                </button>
              </div>

              {videoSourceMode === 'camera' ? (
                devices.length > 0 ? (
                  <div className="w-full flex flex-col gap-2">
                    <select
                      value={selectedDeviceId}
                      onChange={(e) => setSelectedDeviceId(e.target.value)}
                      className="w-full bg-neutral-800 text-sm text-neutral-200 border border-neutral-700 px-3 py-2 rounded-lg outline-none cursor-pointer focus:border-emerald-500 transition-all"
                    >
                      {devices.map((device) => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label || `Camera ${devices.indexOf(device) + 1}`}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={startCamera}
                      disabled={cameraLoading}
                      className="w-full bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] transition-all py-2.5 px-4 rounded-lg font-sans font-medium text-sm text-neutral-950 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 disabled:opacity-50"
                    >
                      {cameraLoading ? 'Starting Stream...' : 'Initialize Camera'}
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-rose-400 font-mono">
                    No video devices detected. Please verify your camera is connected.
                  </p>
                )
              ) : (
                <div className="w-full flex flex-col gap-2">
                  <input 
                    type="file" 
                    accept="video/*" 
                    onChange={handleFileSelected} 
                    className="w-full text-sm text-neutral-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-medium file:bg-emerald-500/10 file:text-emerald-400 hover:file:bg-emerald-500/20"
                  />
                  <button
                    onClick={startCamera}
                    disabled={cameraLoading || !videoFileUrl}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] transition-all py-2.5 px-4 rounded-lg font-sans font-medium text-sm text-neutral-950 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 disabled:opacity-50"
                  >
                    {cameraLoading ? 'Starting Video...' : 'Play Video'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Floaters overlays when Camera is Active */}
          {cameraActive && (
            <>
              {/* Top status bar */}
              <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
                <div className="flex gap-2">
                  <div className="bg-neutral-950/85 backdrop-blur-md px-3 py-1.5 rounded-lg border border-neutral-800/80 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span className="text-xs font-mono font-medium text-neutral-300">LIVE</span>
                    <span className="text-xs text-neutral-500">|</span>
                    <span className="text-xs font-mono text-emerald-400">{fps} FPS</span>
                  </div>
                </div>

                <div className="flex gap-2 pointer-events-auto">
                  {/* Full screen toggle */}
                  <button
                    onClick={toggleFullscreen}
                    className="bg-neutral-950/85 backdrop-blur-md border border-neutral-800 hover:bg-neutral-900 text-neutral-300 p-2 rounded-lg transition-all active:scale-95"
                    title={isFullscreen ? 'Exit Full Screen' : 'Enter Full Screen'}
                  >
                    {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>

                  <button
                    onClick={stopCamera}
                    className="bg-rose-500/20 backdrop-blur-md border border-rose-500/30 hover:bg-rose-500 text-rose-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95 flex items-center gap-1.5"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    Stop
                  </button>
                </div>
              </div>

              {/* Bottom control bar (Recording controls) */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-neutral-950/90 backdrop-blur-md px-4 py-2 rounded-full border border-neutral-800/90 pointer-events-auto shadow-2xl">
                {isRecording ? (
                  <button
                    onClick={stopRecording}
                    className="bg-rose-600 hover:bg-rose-700 active:scale-95 text-white py-1.5 px-4 rounded-full font-medium text-xs flex items-center gap-2 transition-all"
                  >
                    <span className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
                    <span>Stop ({formatTime(recordingSeconds)})</span>
                  </button>
                ) : (
                  <button
                    onClick={startRecording}
                    className="bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-neutral-950 py-1.5 px-4 rounded-full font-medium text-xs flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/10"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Record Overlay</span>
                  </button>
                )}

                {settings.showDebugFeed && (
                  <div className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-md font-mono flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5" /> Debug Mask
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* 2. Calibration Instructions */}
        <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 flex gap-3.5 items-start">
          <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20 mt-0.5 shrink-0">
            <Info className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-sans font-medium text-sm text-neutral-200">
              Calibration & Setup Guide
            </h4>
            <p className="text-xs text-neutral-400 leading-relaxed mt-1">
              {settings.trackingMode === 'color' 
                ? "Select a neon ball preset on the right, or click directly on any juggling ball in the camera view to track its custom color. For best results, use bright balls on a contrasting background."
                : "Motion detection tracks any moving object regardless of color. For best results, ensure your camera is completely stable and you're juggling against a solid background."}
            </p>
          </div>
        </div>

        {/* 3. Exported Video Preview / Download Card */}
        <AnimatePresence>
          {recordedVideoUrl && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 flex flex-col gap-4 shadow-xl"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <h3 className="font-sans font-semibold text-sm text-neutral-200">
                    Recorded Video Export Ready
                  </h3>
                </div>
                <button
                  onClick={() => setRecordedVideoUrl(null)}
                  className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
                >
                  Dismiss
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                <div className="md:col-span-8 overflow-hidden rounded-xl bg-black border border-neutral-800 aspect-video">
                  <video
                    src={recordedVideoUrl}
                    controls
                    className="w-full h-full object-contain"
                  />
                </div>

                <div className="md:col-span-4 flex flex-col gap-2.5">
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    This file contains the complete live performance with all trail lines, motion speeds,
                    and trajectory curve mappings baked in.
                  </p>

                  <a
                    href={recordedVideoUrl}
                    download={`juggling_tracking_${Date.now()}.webm`}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-neutral-950 font-sans font-medium text-xs py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] shadow-lg shadow-emerald-500/10"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Video
                  </a>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 2. Control Panel & Fine-tuning Sliders */}
      <div className="lg:col-span-4 flex flex-col gap-5">
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-neutral-800 pb-3">
            <Activity className="w-4 h-4 text-emerald-400" />
            <h3 className="font-sans font-semibold text-sm text-neutral-200">
              LED Echo Trails
            </h3>
          </div>
          
          <div className="flex flex-col gap-4 py-2">
            <div className="p-3 bg-neutral-950/40 border border-emerald-500/20 rounded-xl flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              <p className="text-xs text-emerald-400/90 leading-relaxed">
                Pixel-perfect masking extracts moving props and stamps them into an echo buffer. The trail matches the exact shape, brightness, and colors of your flow prop at each frame.
              </p>
            </div>

            <label className="flex items-center justify-between text-xs text-neutral-300 cursor-pointer select-none bg-neutral-950/20 border border-neutral-800/60 p-2.5 rounded-xl hover:border-neutral-700/60 transition-all">
              <div className="flex flex-col">
                <span className="font-medium">Enable Motion Trails</span>
                <span className="text-[10px] text-neutral-500">Stamp and draw moving paths on the screen</span>
              </div>
              <input
                type="checkbox"
                checked={settings.enableTrails}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, enableTrails: e.target.checked }))
                }
                className="sr-only peer"
              />
              <div className="relative w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-neutral-400 after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500 peer-checked:after:bg-neutral-950" />
            </label>
            
            <div className="flex flex-col gap-1.5 mt-2">
              <div className="flex justify-between text-xs">
                <div className="flex flex-col">
                  <span className="text-neutral-400">Mask Sensitivity</span>
                  <span className="text-[10px] text-neutral-500">Controls how much motion is picked up by the camera.</span>
                </div>
                <span className="text-neutral-200 font-mono shrink-0 text-right">{100 - settings.motionThreshold}%</span>
              </div>
              <input
                type="range"
                min="15"
                max="120"
                step="1"
                value={135 - settings.motionThreshold}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, motionThreshold: 135 - parseInt(e.target.value) }))
                }
                className="w-full accent-emerald-500 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-neutral-500 px-1 mt-1">
                <span>Less (Ignores noise)</span>
                <span>More (Extracts everything)</span>
              </div>
            </div>

            <div className={`flex flex-col gap-1.5 mt-2 transition-all duration-200 ${!settings.enableTrails ? 'opacity-40 pointer-events-none' : ''}`}>
              <div className="flex justify-between text-xs">
                <div className="flex flex-col">
                  <span className="text-neutral-400">Echo Trail Length</span>
                  <span className="text-[10px] text-neutral-500">How long the trail persists before fading away.</span>
                </div>
                <span className="text-neutral-200 font-mono">
                  {Math.round((1 - settings.echoFadeRate) * 100) === 0 
                    ? '0% (No Trail)' 
                    : Math.round((1 - settings.echoFadeRate) * 100) === 100 
                      ? '100% (Infinite)' 
                      : `${Math.round((1 - settings.echoFadeRate) * 100)}% retention`}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={Math.round((1 - settings.echoFadeRate) * 100)}
                onChange={(e) => {
                  const retention = parseInt(e.target.value);
                  setSettings((prev) => ({ ...prev, echoFadeRate: 1 - (retention / 100) }));
                }}
                className="w-full accent-emerald-500 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div className="flex flex-col gap-1.5 mt-2">
              <div className="flex justify-between text-xs">
                <div className="flex flex-col">
                  <span className="text-neutral-400">Trail Blur Amount</span>
                  <span className="text-[10px] text-neutral-500">Applies a soft glow-like blur to the trails.</span>
                </div>
                <span className="text-neutral-200 font-mono">{settings.blurAmount}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="20"
                step="1"
                value={settings.blurAmount}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, blurAmount: parseInt(e.target.value) }))
                }
                className="w-full accent-emerald-500 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div className="flex flex-col gap-1.5 mt-2">
              <div className="flex justify-between text-xs">
                <div className="flex flex-col">
                  <span className="text-neutral-400">Color Hue Shift</span>
                  <span className="text-[10px] text-neutral-500">Shifts the colors of the trail permanently.</span>
                </div>
                <span className="text-neutral-200 font-mono">{settings.hueRotate}°</span>
              </div>
              <input
                type="range"
                min="0"
                max="360"
                step="1"
                value={settings.hueRotate}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, hueRotate: parseInt(e.target.value) }))
                }
                className="w-full accent-emerald-500 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            
            <div className="flex flex-col gap-1.5 mt-2">
              <div className="flex flex-col mb-1">
                <span className="text-xs text-neutral-400">Blend Mode</span>
                <span className="text-[10px] text-neutral-500">How new frames blend with older trails.</span>
              </div>
              <select
                value={settings.enableTrails ? settings.compositeMode : 'none'}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'none') {
                    setSettings((prev) => ({ ...prev, enableTrails: false, compositeMode: 'none' }));
                  } else {
                    setSettings((prev) => ({ ...prev, enableTrails: true, compositeMode: val }));
                  }
                }}
                className="w-full bg-neutral-800 text-xs text-neutral-200 border border-neutral-700 px-3 py-2 rounded-lg outline-none cursor-pointer focus:border-emerald-500 transition-all"
              >
                <option value="none">Disabled (No Trails)</option>
                <option value="screen">Screen (Glow)</option>
                <option value="source-over">Normal (Solid)</option>
                <option value="lighter">Additive (Intense)</option>
                <option value="color-dodge">Color Dodge</option>
              </select>
            </div>
          </div>
        </div>

        {/* Cinematic Effects */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-neutral-800 pb-3">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <h3 className="font-sans font-semibold text-sm text-neutral-200">
              Cinematic Effects
            </h3>
          </div>

          <div className="flex flex-col gap-1.5 mt-1">
            <div className="flex justify-between text-xs">
              <div className="flex flex-col">
                <span className="text-neutral-400">Chronophotography (Strobe)</span>
                <span className="text-[10px] text-neutral-500">Captures distinct snapshot frames instead of a continuous trail.</span>
              </div>
              <span className="text-neutral-200 font-mono shrink-0 text-right">
                {settings.strobeRate === 0 ? 'Off' : `Every ${settings.strobeRate.toFixed(2)}s`}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="2.0"
              step="0.05"
              value={settings.strobeRate}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, strobeRate: parseFloat(e.target.value) }))
              }
              className="w-full accent-emerald-500 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div className="flex flex-col gap-1.5 mt-2">
            <div className="flex justify-between text-xs">
              <div className="flex flex-col">
                <span className="text-neutral-400">Rainbow Color Cycle</span>
                <span className="text-[10px] text-neutral-500">Continuously shifts the hue of the trail over time.</span>
              </div>
              <span className="text-neutral-200 font-mono shrink-0 text-right">
                {settings.colorCycleSpeed === 0 ? 'Off' : `${settings.colorCycleSpeed} deg/f`}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="20"
              step="1"
              value={settings.colorCycleSpeed}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, colorCycleSpeed: parseInt(e.target.value) }))
              }
              className="w-full accent-emerald-500 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div className="flex flex-col gap-1.5 mt-2">
            <div className="flex justify-between text-xs">
              <div className="flex flex-col">
                <span className="text-neutral-400">Fluid Smoke (Vertical Drift)</span>
                <span className="text-[10px] text-neutral-500">Makes the trail float upwards or downwards.</span>
              </div>
              <span className="text-neutral-200 font-mono shrink-0 text-right">{settings.verticalDrift} px/f</span>
            </div>
            <input
              type="range"
              min="-15"
              max="15"
              step="1"
              value={settings.verticalDrift}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, verticalDrift: parseInt(e.target.value) }))
              }
              className="w-full accent-emerald-500 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>
          
          <div className="flex flex-col gap-1.5 mt-2">
            <div className="flex justify-between text-xs">
              <div className="flex flex-col">
                <span className="text-neutral-400">Fluid Smoke (Horizontal Drift)</span>
                <span className="text-[10px] text-neutral-500">Makes the trail drift left or right.</span>
              </div>
              <span className="text-neutral-200 font-mono shrink-0 text-right">{settings.horizontalDrift} px/f</span>
            </div>
            <input
              type="range"
              min="-15"
              max="15"
              step="1"
              value={settings.horizontalDrift}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, horizontalDrift: parseInt(e.target.value) }))
              }
              className="w-full accent-emerald-500 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div className="flex flex-col gap-1.5 mt-2 mb-2">
            <div className="flex justify-between text-xs">
              <div className="flex flex-col">
                <span className="text-neutral-400">Feedback Loop (Zoom)</span>
                <span className="text-[10px] text-neutral-500">Scales the trail up/down for an infinite zoom.</span>
              </div>
              <span className="text-neutral-200 font-mono shrink-0 text-right">
                {settings.feedbackZoom === 1.0 ? 'Off' : `${((settings.feedbackZoom - 1) * 100).toFixed(1)}%`}
              </span>
            </div>
            <input
              type="range"
              min="0.95"
              max="1.1"
              step="0.005"
              value={settings.feedbackZoom}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, feedbackZoom: parseFloat(e.target.value) }))
              }
              className="w-full accent-emerald-500 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div className="flex flex-col gap-1.5 mt-2 mb-2">
            <div className="flex justify-between text-xs">
              <div className="flex flex-col">
                <span className="text-neutral-400">Motion Blur</span>
                <span className="text-[10px] text-neutral-500">Accumulates camera frames for a smooth ribbon effect.</span>
              </div>
              <span className="text-neutral-200 font-mono shrink-0 text-right">
                {settings.motionBlur === 0 ? 'Off' : `${(settings.motionBlur * 100).toFixed(0)}%`}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="0.95"
              step="0.05"
              value={settings.motionBlur}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, motionBlur: parseFloat(e.target.value) }))
              }
              className="w-full accent-emerald-500 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>

        {/* Universal settings */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-neutral-800 pb-3">
            <Sliders className="w-4 h-4 text-emerald-400" />
            <h3 className="font-sans font-semibold text-sm text-neutral-200">
              Advanced Settings
            </h3>
          </div>

          <div className="flex flex-col gap-1.5 mt-1 mb-2">
            <div className="flex justify-between text-xs">
              <div className="flex flex-col">
                <span className="text-neutral-400">Background Adaptation</span>
                <span className="text-[10px] text-neutral-500">How quickly the camera learns changes in the background.</span>
              </div>
              <span className="text-neutral-200 font-mono shrink-0 text-right">{(settings.bgLearningRate * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="1"
              max="20"
              step="1"
              value={Math.round(settings.bgLearningRate * 100)}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, bgLearningRate: parseInt(e.target.value) / 100 }))
              }
              className="w-full accent-emerald-500 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-neutral-500 px-1 mt-1">
              <span>Stable</span>
              <span>Fast Update</span>
            </div>
          </div>

          {/* Debug and audio settings */}
          <div className="flex flex-col gap-3 pt-1">
            <label className="flex items-center justify-between text-xs text-neutral-300 cursor-pointer select-none">
              <div className="flex flex-col">
                <span>Invert Tracked Colors</span>
                <span className="text-[10px] text-neutral-500">Creates a negative trail effect</span>
              </div>
              <input
                type="checkbox"
                checked={settings.invertColors}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, invertColors: e.target.checked }))
                }
                className="sr-only peer"
              />
              <div className="relative w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-neutral-400 after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500 peer-checked:after:bg-neutral-950" />
            </label>

            <label className="flex items-center justify-between text-xs text-neutral-300 cursor-pointer select-none">
              <div className="flex flex-col">
                <span>Show Debug Mask</span>
                <span className="text-[10px] text-neutral-500">Visualizes what camera currently extracts</span>
              </div>
              <input
                type="checkbox"
                checked={settings.showDebugFeed}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, showDebugFeed: e.target.checked }))
                }
                className="sr-only peer"
              />
              <div className="relative w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-neutral-400 after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500 peer-checked:after:bg-neutral-950" />
            </label>

            <label className="flex items-center justify-between text-xs text-neutral-300 cursor-pointer select-none">
              <div className="flex flex-col">
                <span>Record Audio Stream</span>
                <span className="text-[10px] text-neutral-500">Syncs background mic on export</span>
              </div>
              <input
                type="checkbox"
                checked={settings.enableAudioSync}
                onChange={(e) => {
                  const val = e.target.checked;
                  setSettings((prev) => ({ ...prev, enableAudioSync: val }));
                  if (cameraActive) {
                    // Restart camera to apply audio track setting change
                    setTimeout(() => startCamera(), 100);
                  }
                }}
                className="sr-only peer"
              />
              <div className="relative w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-neutral-400 after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500 peer-checked:after:bg-neutral-950" />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
