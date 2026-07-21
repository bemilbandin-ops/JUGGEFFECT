import React from 'react';
import { Sliders } from 'lucide-react';
import CanvasHud from './CanvasHud';
import SettingsDrawer from './SettingsDrawer';
import VideoSourceSetup from './canvas/VideoSourceSetup';
import ExportModal from './canvas/ExportModal';
import ExportPreviewModal from './canvas/ExportPreviewModal';
import MobileTunerOverlay from './canvas/MobileTunerOverlay';
import { useTrackingRenderLoop } from '../hooks/useTrackingRenderLoop';

export default function TrackingCanvas() {
  const {
    videoRef,
    displayCanvasRef,
    containerRef,
    removalMaskCanvasRef,
    removalMaskCtxRef,
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
    fps,
    isFullscreen,
    isSidebarOpen,
    setIsSidebarOpen,
    activeTunerKey,
    setActiveTunerKey,
    settings,
    setSettings,
    originalSettings,
    appliedPresetId,
    activeTab,
    setActiveTab,
    isRecording,
    recordingSeconds,
    recordedVideoUrl,
    setRecordedVideoUrl,
    recordedExt,
    recordedSize,
    supportedMimeTypes,
    isDragging,
    showExportModal,
    setShowExportModal,
    exportConfigured,
    setExportConfigured,
    tunerSettings,
    getSettingColor,
    getAdjustmentMatrix,
    getSettingDisplayName,
    applyPreset,
    resetToOriginalSettings,
    resetToFactoryDefaults,
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
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerLeave,
    startRecording,
    stopRecording,
    toggleFullscreen,
  } = useTrackingRenderLoop();

  return (
    <div 
      className="w-full h-full relative bg-black"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* 1. Main Interactive Camera Viewport */}
      <div
        ref={containerRef}
        className={`absolute inset-0 z-0 bg-black flex items-center justify-center transition-all duration-300 ${
          isFullscreen ? 'fixed inset-0 z-50' : ''
        }`}
      >
        {/* Hidden video element */}
        <video
          ref={videoRef}
          className="hidden"
          playsInline
          muted
          crossOrigin="anonymous"
          onLoadedMetadata={handleDurationChange}
          onDurationChange={handleDurationChange}
          onTimeUpdate={handleTimeUpdate}
          onPlay={handlePlay}
          onPause={handlePause}
          onEnded={handlePause}
          onSeeked={handleSeeked}
        />

        {/* Display canvas */}
        <canvas
          ref={displayCanvasRef}
          className={`w-full h-full object-contain cursor-crosshair ${cameraActive ? 'block' : 'hidden'}`}
          id="effects-viewport"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={handlePointerLeave}
        />

        {isDragging && cameraActive && (
          <div className="absolute inset-0 z-50 bg-blue-500/10 backdrop-blur-sm flex items-center justify-center pointer-events-none">
            <div className="bg-blue-600 text-white px-8 py-4 rounded-full font-medium shadow-2xl scale-110">
              Drop video to load
            </div>
          </div>
        )}

        {!cameraActive && (
          <VideoSourceSetup
            isDragging={isDragging}
            videoSourceMode={videoSourceMode}
            setVideoSourceMode={setVideoSourceMode}
            devices={devices}
            selectedDeviceId={selectedDeviceId}
            setSelectedDeviceId={setSelectedDeviceId}
            cameraLoading={cameraLoading}
            startCamera={startCamera}
            loadDemoVideo={loadDemoVideo}
            isDemoSelected={isDemoSelected}
            handleFileSelected={handleFileSelected}
            videoFileUrl={videoFileUrl}
          />
        )}

        {/* Floating HUD overlays when Camera is Active */}
        <CanvasHud
          cameraActive={cameraActive}
          isSidebarOpen={isSidebarOpen}
          fps={fps}
          settings={settings}
          supportedMimeTypes={supportedMimeTypes}
          isFullscreen={isFullscreen}
          videoSourceMode={videoSourceMode}
          isPaused={isPaused}
          currentTime={currentTime}
          duration={duration}
          isRecording={isRecording}
          recordingSeconds={recordingSeconds}
          exportConfigured={exportConfigured}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          onToggleFullscreen={toggleFullscreen}
          onStopCamera={stopCamera}
          onTogglePlay={handleTogglePlay}
          onScrubChange={handleScrubChange}
          onScrubStart={handleScrubStart}
          onScrubEnd={handleScrubEnd}
          onClearTrails={handleClearTrails}
          onStopRecording={stopRecording}
          onShowExportModal={setShowExportModal}
          onStartRecording={startRecording}
        />
      </div>

      {/* Export Settings Modal */}
      <ExportModal
        showExportModal={showExportModal}
        setShowExportModal={setShowExportModal}
        settings={settings}
        setSettings={setSettings}
        supportedMimeTypes={supportedMimeTypes}
        setExportConfigured={setExportConfigured}
        startRecording={startRecording}
      />

      {/* Exported Video Preview / Download Card */}
      <ExportPreviewModal
        recordedVideoUrl={recordedVideoUrl}
        setRecordedVideoUrl={setRecordedVideoUrl}
        recordedExt={recordedExt}
        recordingSeconds={recordingSeconds}
        recordedSize={recordedSize}
      />

      {/* Floating Settings toggle for when camera is not active */}
      {!cameraActive && !isSidebarOpen && (
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="absolute top-14 right-4 z-20 bg-[#0a0a0a]/90 hover:bg-neutral-900 border border-neutral-800 text-neutral-200 py-2 px-3.5 rounded-lg transition-all active:scale-95 flex items-center gap-2 shadow-lg cursor-pointer"
        >
          <Sliders className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-semibold tracking-wider font-sans">Settings</span>
        </button>
      )}

      {/* Mobile Tuner Overlay */}
      <MobileTunerOverlay
        cameraActive={cameraActive}
        isSidebarOpen={isSidebarOpen}
        activeTunerKey={activeTunerKey}
        setActiveTunerKey={setActiveTunerKey}
        tunerSettings={tunerSettings}
        getSettingColor={getSettingColor}
        settings={settings}
      />

      {/* Control Panel Sidebar */}
      <SettingsDrawer
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        settings={settings}
        setSettings={setSettings}
        originalSettings={originalSettings}
        resetToOriginalSettings={resetToOriginalSettings}
        resetToFactoryDefaults={resetToFactoryDefaults}
        appliedPresetId={appliedPresetId}
        applyPreset={applyPreset}
        getSettingDisplayName={getSettingDisplayName}
        cameraActive={cameraActive}
        removalMaskCtxRef={removalMaskCtxRef}
        removalMaskCanvasRef={removalMaskCanvasRef}
        startCamera={startCamera}
      />

      <svg style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}>
        <filter id="camera-adjustments">
          <feColorMatrix type="matrix" values={getAdjustmentMatrix()} />
        </filter>
      </svg>
    </div>
  );
}
