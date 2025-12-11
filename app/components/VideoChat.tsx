'use client';

import { useState, useRef, useEffect } from 'react';
import { useWebRTC } from '../hooks/useWebRTC';
import StartCallForm from './StartCallForm';
import WaitingRoom from './WaitingRoom';
import VideoWindow from './VideoWindow';
import CallControls from './CallControls';
import FullscreenControls from './FullscreenControls';

export default function VideoChat() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeVideo, setActiveVideo] = useState<'local' | 'remote'>('remote');
  const [showFullscreenHint, setShowFullscreenHint] = useState(true);
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);

  const {
    roomName,
    state,
    error,
    shareLink,
    isMuted,
    isVideoOff,
    isRemoteMuted,
    isRemoteVideoOff,
    localVideoRef,
    remoteVideoRef,
    setRoomName,
    startCall,
    endCall,
    copyLink,
    toggleMute,
    toggleVideo,
    toggleCamera,
  } = useWebRTC();

  const toggleFullscreen = (activeVideoToShow?: 'local' | 'remote') => {
    if (!isFullscreen) {
      // Set active video if provided
      if (activeVideoToShow) {
        setActiveVideo(activeVideoToShow);
      }
      // Enter fullscreen mode
      if (fullscreenContainerRef.current) {
        if (fullscreenContainerRef.current.requestFullscreen) {
          fullscreenContainerRef.current.requestFullscreen();
        }
      }
      setIsFullscreen(true);
    } else {
      // Exit fullscreen mode
      if (document.fullscreenElement) {
        document.exitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  const switchVideo = () => {
    setActiveVideo(activeVideo === 'local' ? 'remote' : 'local');
  };

  // Track exit from fullscreen via ESC
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
        setShowFullscreenHint(true); // Reset on exit
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
        setShowFullscreenHint(true); // Reset on exit
        if (document.fullscreenElement) {
          document.exitFullscreen();
        }
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen]);

  // Auto-hide fullscreen hint after 4 seconds
  useEffect(() => {
    if (isFullscreen && showFullscreenHint) {
      const timer = setTimeout(() => {
        setShowFullscreenHint(false);
      }, 4000);
      
      return () => clearTimeout(timer);
    }
  }, [isFullscreen, showFullscreenHint]);

  return (
    <div className="w-full max-w-6xl p-8">
      <h1 className="text-4xl font-bold text-white mb-8 text-center">
        Video Chat
      </h1>

      {state === 'idle' && (
        <StartCallForm
          roomName={roomName}
          error={error}
          onRoomNameChange={setRoomName}
          onStartCall={startCall}
        />
      )}

      {state === 'waiting' && (
        <WaitingRoom
          shareLink={shareLink}
          onCopyLink={copyLink}
          onCancel={endCall}
        />
      )}

      {(state === 'connecting' || state === 'connected') && (
        <div className={isFullscreen ? '' : 'space-y-6'}>
          <VideoWindow
            localVideoRef={localVideoRef}
            remoteVideoRef={remoteVideoRef}
            isFullscreen={isFullscreen}
            activeVideo={activeVideo}
            isConnecting={state === 'connecting'}
            isLocalMuted={isMuted}
            isLocalVideoOff={isVideoOff}
            isRemoteMuted={isRemoteMuted}
            isRemoteVideoOff={isRemoteVideoOff}
            onSwitchVideo={switchVideo}
            onEnterFullscreen={toggleFullscreen}
            fullscreenContainerRef={fullscreenContainerRef}
          >
            {isFullscreen && (
              <FullscreenControls
                isMuted={isMuted}
                isVideoOff={isVideoOff}
                showHint={showFullscreenHint}
                onToggleMute={toggleMute}
                onToggleVideo={toggleVideo}
                onToggleCamera={toggleCamera}
                onExitFullscreen={toggleFullscreen}
                onEndCall={endCall}
              />
            )}
          </VideoWindow>

          {!isFullscreen && (
            <>
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm text-center">
                  {error}
                </div>
              )}

              <CallControls
                isMuted={isMuted}
                isVideoOff={isVideoOff}
                isFullscreen={isFullscreen}
                onToggleMute={toggleMute}
                onToggleVideo={toggleVideo}
                onToggleFullscreen={() => toggleFullscreen('remote')}
                onEndCall={endCall}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
