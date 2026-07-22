import React, { useState, useEffect, useRef } from 'react';
import { TrackingSettings } from '../types';
import type { PixelCometState } from '../engine/pixelCometProcessor';

export interface UseVideoMediaControllerParams {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  streamRef: React.MutableRefObject<MediaStream | null>;
  animationFrameIdRef: React.MutableRefObject<number | null>;
  bgDataRef: React.MutableRefObject<Float32Array | null>;
  motionMaskDataRef: React.MutableRefObject<ImageData | null>;
  trailCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  povCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  trackedPointsRef: React.MutableRefObject<any[]>;
  poiTrailBufferRef: React.MutableRefObject<Map<number, any>>;
  poiProjectionStateRef: React.MutableRefObject<Map<number, any>>;
  poiAccumulatedDistRef: React.MutableRefObject<Map<number, number>>;
  pixelCometStateRef: React.MutableRefObject<PixelCometState>;
  settings: TrackingSettings;
  setFps: React.Dispatch<React.SetStateAction<number>>;
  setRecordedVideoUrl: (url: string | null) => void;
  clearRendererTemporalState: () => void;
  startRenderLoop: () => void;
}

export function useVideoMediaController({
  videoRef,
  containerRef,
  streamRef,
  animationFrameIdRef,
  bgDataRef,
  motionMaskDataRef,
  trailCanvasRef,
  povCanvasRef,
  trackedPointsRef,
  poiTrailBufferRef,
  poiProjectionStateRef,
  poiAccumulatedDistRef,
  pixelCometStateRef,
  settings,
  setFps,
  setRecordedVideoUrl,
  clearRendererTemporalState,
  startRenderLoop,
}: UseVideoMediaControllerParams) {
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraLoading, setCameraLoading] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const isScrubbingRef = useRef<boolean>(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [videoSourceMode, setVideoSourceMode] = useState<'camera' | 'file'>('camera');
  const [videoFileUrl, setVideoFileUrl] = useState<string | null>(null);
  const [isDemoSelected, setIsDemoSelected] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);

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
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
        }
      } catch (err) {
        console.error('Error fetching video devices:', err);
      }
    }
    getDevices();

    return () => {
      stopCamera();
    };
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      const url = URL.createObjectURL(e.target.files[0]);
      setVideoFileUrl(url);
      setIsDemoSelected(false);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('video/')) {
        const url = URL.createObjectURL(file);
        setVideoFileUrl(url);
        setVideoSourceMode('file');
        setIsDemoSelected(false);
        if (cameraActive) stopCamera();
      }
    }
  }

  function loadDemoVideo() {
    const baseUrl = import.meta.env.BASE_URL || '/';
    const videoUrl = `${baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'}juggling-demo.mp4`;
    setVideoFileUrl(videoUrl);
    setIsDemoSelected(true);
  }

  const handleDurationChange = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    setDuration(e.currentTarget.duration || 0);
  };

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    if (!isScrubbingRef.current) {
      setCurrentTime(e.currentTarget.currentTime || 0);
    }
  };

  const handlePlay = () => {
    setIsPaused(false);
  };

  const handlePause = () => {
    setIsPaused(true);
  };

  const handleSeeked = () => {
    bgDataRef.current = null;
    motionMaskDataRef.current = null;
    clearRendererTemporalState();
  };

  const handleScrubChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
  };

  const handleScrubStart = () => {
    isScrubbingRef.current = true;
  };

  const handleScrubEnd = () => {
    isScrubbingRef.current = false;
  };

  const handleTogglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch((err) => {
        if (err.name === 'AbortError' || err.message?.includes('interrupted')) {
          return;
        }
        console.error('Play error:', err);
      });
    } else {
      videoRef.current.pause();
    }
  };

  const handleClearTrails = () => {
    bgDataRef.current = null;
    motionMaskDataRef.current = null;
    if (trailCanvasRef.current) {
      const tCtx = trailCanvasRef.current.getContext('2d');
      if (tCtx) tCtx.clearRect(0, 0, trailCanvasRef.current.width, trailCanvasRef.current.height);
    }
    if (povCanvasRef.current) {
      const pCtx = povCanvasRef.current.getContext('2d');
      if (pCtx) pCtx.clearRect(0, 0, povCanvasRef.current.width, povCanvasRef.current.height);
    }
    trackedPointsRef.current = [];
    poiTrailBufferRef.current.clear();
    poiProjectionStateRef.current.clear();
    poiAccumulatedDistRef.current.clear();
    pixelCometStateRef.current.clear();
    clearRendererTemporalState();
  };

  async function startCamera() {
    setCameraLoading(true);
    stopCamera();
    setRecordedVideoUrl(null);
    clearRendererTemporalState();

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

    const onMetaLoaded = () => {
      if (videoRef.current) {
        setDuration(videoRef.current.duration || 0);
        setCurrentTime(videoRef.current.currentTime || 0);
      }
      bgDataRef.current = null;
      motionMaskDataRef.current = null;
      clearRendererTemporalState();
      if (trailCanvasRef.current) {
        const tCtx = trailCanvasRef.current.getContext('2d');
        if (tCtx) tCtx.clearRect(0, 0, trailCanvasRef.current.width, trailCanvasRef.current.height);
      }
      if (povCanvasRef.current) {
        const pCtx = povCanvasRef.current.getContext('2d');
        if (pCtx) pCtx.clearRect(0, 0, povCanvasRef.current.width, povCanvasRef.current.height);
      }
      startRenderLoop();
    };

    videoRef.current.onloadedmetadata = onMetaLoaded;

    videoRef.current
      .play()
      .then(() => {
        setCameraActive(true);
        if (videoRef.current) {
          setDuration(videoRef.current.duration || 0);
          setCurrentTime(videoRef.current.currentTime || 0);
        }
        if (videoRef.current && videoRef.current.videoWidth > 0 && !animationFrameIdRef.current) {
          bgDataRef.current = null;
          motionMaskDataRef.current = null;
          clearRendererTemporalState();
          if (trailCanvasRef.current) {
            const tCtx = trailCanvasRef.current.getContext('2d');
            if (tCtx) tCtx.clearRect(0, 0, trailCanvasRef.current.width, trailCanvasRef.current.height);
          }
          if (povCanvasRef.current) {
            const pCtx = povCanvasRef.current.getContext('2d');
            if (pCtx) pCtx.clearRect(0, 0, povCanvasRef.current.width, povCanvasRef.current.height);
          }
          startRenderLoop();
        }
      })
      .catch((err) => {
        if (err.name === 'AbortError' || err.message?.includes('interrupted')) {
          return;
        }
        console.error('Video play error:', err);
        alert('Video play error: ' + err.message);
      });
  }

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
    setIsPaused(false);
    setCurrentTime(0);
    setDuration(0);
    clearRendererTemporalState();
  }

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

  return {
    cameraActive,
    cameraLoading,
    isPaused,
    currentTime,
    duration,
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    videoSourceMode,
    setVideoSourceMode,
    videoFileUrl,
    isDemoSelected,
    isFullscreen,
    isDragging,
    handleFileSelected,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    loadDemoVideo,
    handleDurationChange,
    handleTimeUpdate,
    handlePlay,
    handlePause,
    handleSeeked,
    handleScrubChange,
    handleScrubStart,
    handleScrubEnd,
    handleTogglePlay,
    handleClearTrails,
    startCamera,
    stopCamera,
    toggleFullscreen,
  };
}
