import { RefObject } from 'react';

interface VideoWindowProps {
  localVideoRef: RefObject<HTMLVideoElement | null>;
  remoteVideoRef: RefObject<HTMLVideoElement | null>;
  isFullscreen: boolean;
  activeVideo: 'local' | 'remote';
  isConnecting: boolean;
  isLocalMuted: boolean;
  isLocalVideoOff: boolean;
  isRemoteMuted: boolean;
  isRemoteVideoOff: boolean;
  onSwitchVideo: () => void;
  onEnterFullscreen?: (activeVideo: 'local' | 'remote') => void;
  fullscreenContainerRef: RefObject<HTMLDivElement | null>;
  children?: React.ReactNode;
}

export default function VideoWindow({
  localVideoRef,
  remoteVideoRef,
  isFullscreen,
  activeVideo,
  isConnecting,
  isLocalMuted,
  isLocalVideoOff,
  isRemoteMuted,
  isRemoteVideoOff,
  onSwitchVideo,
  onEnterFullscreen,
  fullscreenContainerRef,
  children
}: VideoWindowProps) {
  return (
    <div 
      ref={isFullscreen ? fullscreenContainerRef : null}
      className={isFullscreen ? 'fixed inset-0 z-50 bg-black' : ''}
    >
      <div className={isFullscreen ? 'relative w-full h-full' : 'grid grid-cols-1 md:grid-cols-2 gap-6'}>
        {/* Local video */}
        <div 
          className={(
            isFullscreen
              ? activeVideo === 'local'
                ? 'absolute inset-0'
                : 'absolute top-4 right-4 w-32 h-32 md:w-48 md:h-36 bg-zinc-900 rounded-xl overflow-hidden border-2 border-white/20 cursor-pointer hover:border-white/40 transition-colors z-20'
              : 'relative bg-zinc-900 rounded-2xl overflow-hidden aspect-video cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all'
          )}
          onClick={
            isFullscreen 
              ? (e) => { e.stopPropagation(); onSwitchVideo(); }
              : () => onEnterFullscreen?.('local')
          }
        >
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className={isFullscreen && activeVideo === 'local' ? 'w-full h-full object-contain' : 'w-full h-full object-cover'}
          />
          
          {/* Local state indicators */}
          {isLocalMuted && (
            <div className="absolute top-4 left-4 p-2 bg-black/70 backdrop-blur-sm rounded-lg shadow-md z-30">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
              </svg>
            </div>
          )}
          
          {isLocalVideoOff && (
            <>
              {/* Background instead of black screen */}
              <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 via-zinc-900 to-black z-10" />
              {/* Icon in center */}
              <div className="absolute inset-0 flex items-center justify-center z-20">
                <div className="p-6 bg-black/50 backdrop-blur-sm rounded-2xl shadow-lg">
                  <svg className="w-16 h-16 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3l18 18" />
                  </svg>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Remote video */}
        <div 
          className={(
            isFullscreen
              ? activeVideo === 'remote'
                ? 'absolute inset-0'
                : 'absolute top-4 right-4 w-32 h-32 md:w-48 md:h-36 bg-zinc-900 rounded-xl overflow-hidden border-2 border-white/20 cursor-pointer hover:border-white/40 transition-colors z-20'
              : 'relative bg-zinc-900 rounded-2xl overflow-hidden aspect-video cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all'
          )}
          onClick={
            isFullscreen 
              ? (e) => { e.stopPropagation(); onSwitchVideo(); }
              : () => onEnterFullscreen?.('remote')
          }
        >
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className={isFullscreen && activeVideo === 'remote' ? 'w-full h-full object-contain' : 'w-full h-full object-cover'}
          />
          
          {/* Remote peer state indicators */}
          {isRemoteMuted && (
            <div className="absolute top-4 left-4 p-2 bg-black/70 backdrop-blur-sm rounded-lg shadow-md z-30">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
              </svg>
            </div>
          )}
          
          {isRemoteVideoOff && (
            <>
              {/* Background instead of black screen */}
              <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 via-zinc-900 to-black z-10" />
              {/* Icon in center */}
              <div className="absolute inset-0 flex items-center justify-center z-20">
                <div className="p-6 bg-black/50 backdrop-blur-sm rounded-2xl shadow-lg">
                  <svg className="w-16 h-16 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3l18 18" />
                  </svg>
                </div>
              </div>
            </>
          )}
          
          {!isFullscreen && isConnecting && (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-white">Connecting...</p>
              </div>
            </div>
          )}
        </div>

        {isFullscreen && children}
      </div>
    </div>
  );
}
