import React, { useState, useEffect, useRef } from 'react';
import { TrackingSettings } from '../types';

export interface UseVideoRecorderParams {
  displayCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  settings: TrackingSettings;
  setSettings: React.Dispatch<React.SetStateAction<TrackingSettings>>;
}

export function useVideoRecorder({
  displayCanvasRef,
  settings,
  setSettings,
}: UseVideoRecorderParams) {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [recordedExt, setRecordedExt] = useState<string>('webm');
  const [recordedSize, setRecordedSize] = useState<number>(0);
  const [supportedMimeTypes, setSupportedMimeTypes] = useState<
    { label: string; mimeType: string; ext: string }[]
  >([]);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [exportConfigured, setExportConfigured] = useState<boolean>(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const candidates = [
      { label: 'WebM (VP9) - Ultra Quality', mimeType: 'video/webm;codecs=vp9,opus', ext: 'webm' },
      { label: 'WebM (H.264) - High Compatibility', mimeType: 'video/webm;codecs=h264,opus', ext: 'webm' },
      { label: 'WebM (VP8)', mimeType: 'video/webm;codecs=vp8,opus', ext: 'webm' },
      { label: 'MP4 (H.264) - Apple/Standard', mimeType: 'video/mp4;codecs=h264,aac', ext: 'mp4' },
      { label: 'MP4 (AAC)', mimeType: 'video/mp4', ext: 'mp4' },
      { label: 'Matroska (MKV)', mimeType: 'video/x-matroska;codecs=avc1', ext: 'mkv' },
      { label: 'WebM (Default)', mimeType: 'video/webm', ext: 'webm' },
    ];
    const supported = candidates.filter((candidate) => {
      try {
        return MediaRecorder.isTypeSupported(candidate.mimeType);
      } catch (e) {
        return false;
      }
    });
    setSupportedMimeTypes(supported);
    if (supported.length > 0) {
      setSettings((prev) => ({
        ...prev,
        exportMimeType: prev.exportMimeType || supported[0].mimeType,
      }));
    }
  }, []);

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
    }

    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, [isRecording]);

  async function startRecording() {
    const canvas = displayCanvasRef.current;
    if (!canvas) return;

    setRecordedVideoUrl(null);
    setRecordingSeconds(0);
    recordedChunksRef.current = [];

    const targetFps = settings.exportFps || 30;
    const stream = canvas.captureStream(targetFps);

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

    const bitrates: Record<string, number> = {
      ultra: 30000000,
      high: 15000000,
      medium: 8000000,
      standard: 4000000,
    };
    const targetBitrate = bitrates[settings.exportQuality] || 15000000;
    const selectedMime = settings.exportMimeType || 'video/webm';

    const options = {
      mimeType: selectedMime,
      videoBitsPerSecond: targetBitrate,
    };

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, options);
    } catch (e) {
      try {
        recorder = new MediaRecorder(stream, { mimeType: selectedMime });
      } catch (e2) {
        recorder = new MediaRecorder(stream);
      }
    }

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      const mimeType = recorder.mimeType || selectedMime;

      let ext = 'webm';
      if (mimeType.includes('mp4')) {
        ext = 'mp4';
      } else if (mimeType.includes('matroska') || mimeType.includes('mkv')) {
        ext = 'mkv';
      }

      const blob = new Blob(recordedChunksRef.current, { type: mimeType });
      const url = URL.createObjectURL(blob);
      setRecordedVideoUrl(url);
      setRecordedExt(ext);
      setRecordedSize(blob.size);
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

  return {
    isRecording,
    recordingSeconds,
    recordedVideoUrl,
    setRecordedVideoUrl,
    recordedExt,
    recordedSize,
    supportedMimeTypes,
    showExportModal,
    setShowExportModal,
    exportConfigured,
    setExportConfigured,
    startRecording,
    stopRecording,
  };
}
