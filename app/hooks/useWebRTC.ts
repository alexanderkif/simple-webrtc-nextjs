import { useState, useRef, useEffect, useCallback } from 'react';
import type { ConnectionState, DataChannelMessage } from '../lib/webrtc-types';
import { generateRoomId as generateRoomIdHelper, getLocalStream as getLocalStreamHelper, createPeerConnection as createPeerConnectionHelper, sendMediaState as sendMediaStateHelper } from '../lib/webrtc-helpers';
import { ICE_GATHERING_DELAY, MEDIA_STATE_SEND_DELAY, POLLING_INTERVAL, MAX_POLL_ATTEMPTS } from '../lib/webrtc-constants';

export function useWebRTC() {
  const [roomId, setRoomId] = useState('');
  const [roomName, setRoomName] = useState('');
  const [state, setState] = useState<ConnectionState>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isRemoteMuted, setIsRemoteMuted] = useState(false);
  const [isRemoteVideoOff, setIsRemoteVideoOff] = useState(false);
  const [error, setError] = useState('');
  const [shareLink, setShareLink] = useState('');

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const iceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasAutoJoinedRef = useRef(false);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const pendingMediaStateRef = useRef<{audioMuted: boolean, videoOff: boolean} | null>(null);
  const currentMediaStateRef = useRef<{audioMuted: boolean, videoOff: boolean}>({ audioMuted: false, videoOff: false });

  // Load room identifier from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedRoomId = localStorage.getItem('myRoomId');
      if (savedRoomId) {
        setRoomName(savedRoomId);
      }
    }
  }, []);

  // Check URL parameters on load
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomIdFromUrl = urlParams.get('room');
    
    if (roomIdFromUrl && !hasAutoJoinedRef.current) {
      hasAutoJoinedRef.current = true;
      setRoomName(roomIdFromUrl);
    }
  }, []);

  // Cleanup resources on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  // Delete room on page close
  useEffect(() => {
    const handleBeforeUnload = async () => {
      if (roomId && (state === 'creating' || state === 'waiting')) {
        await fetch(`/api/signaling/delete?roomId=${roomId}`, {
          method: 'DELETE',
          keepalive: true,
        });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [roomId, state]);

  // Set srcObject when video elements appear in DOM
  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      if (localStreamRef.current.active && localVideoRef.current.srcObject !== localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
        localVideoRef.current.play().catch(() => {});
      }
    }
  }, [state]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStreamRef.current) {
      if (remoteStreamRef.current.active && remoteVideoRef.current.srcObject !== remoteStreamRef.current) {
        remoteVideoRef.current.srcObject = remoteStreamRef.current;
        remoteVideoRef.current.volume = 1.0;
        remoteVideoRef.current.play().catch(() => {});
      }
    }
  }, [state]);

  const cleanup = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    
    remoteStreamRef.current = null;

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    iceCandidatesRef.current = [];
    setIsRemoteMuted(false);
    setIsRemoteVideoOff(false);
  }, []);

  const sendMediaState = useCallback((customAudioMuted?: boolean, customVideoOff?: boolean) => {
    const audioMuted = customAudioMuted !== undefined ? customAudioMuted : currentMediaStateRef.current.audioMuted;
    const videoOff = customVideoOff !== undefined ? customVideoOff : currentMediaStateRef.current.videoOff;
    
    const sent = sendMediaStateHelper(dataChannelRef.current, { audioMuted, videoOff });
    if (sent) {
      pendingMediaStateRef.current = null;
    } else {
      pendingMediaStateRef.current = { audioMuted, videoOff };
    }
  }, []);

  const getLocalStream = useCallback(async (videoFacingMode: 'user' | 'environment' = 'user') => {
    const stream = await getLocalStreamHelper(videoFacingMode, setError);
    localStreamRef.current = stream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }
    
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = true;
      setIsMuted(false);
    }
    
    return stream;
  }, []);

  const createPeerConnection = useCallback(() => {
    const handleDataChannelMessage = (message: DataChannelMessage) => {
      if (message.type === 'mediaState') {
        setIsRemoteMuted(message.audioMuted || false);
        setIsRemoteVideoOff(message.videoOff || false);
      } else if (message.type === 'callEnded') {
        cleanup();
        setState('idle');
        setRoomId('');
        setShareLink('');
        setError('');
        hasAutoJoinedRef.current = false;
        window.history.replaceState({}, '', '/');
      }
    };

    const handleRemoteTrack = (stream: MediaStream) => {
      remoteStreamRef.current = stream;
      if (remoteVideoRef.current && remoteVideoRef.current.srcObject !== stream) {
        remoteVideoRef.current.srcObject = stream;
        remoteVideoRef.current.volume = 1.0;
        remoteVideoRef.current.play().catch(err => {
          console.error('Error playing remote video:', err);
        });
      }
    };

    const handleConnectionStateChange = (state: RTCPeerConnectionState) => {
      if (state === 'connected') {
        setState('connected');
      } else if (state === 'failed' || state === 'disconnected') {
        setError('Connection lost');
        cleanup();
        setState('idle');
      }
    };

    const { pc, dataChannel } = createPeerConnectionHelper(
      {
        onRemoteTrack: handleRemoteTrack,
        onConnectionStateChange: handleConnectionStateChange,
        onIceCandidate: (candidate) => iceCandidatesRef.current.push(candidate),
        onDataChannelMessage: handleDataChannelMessage,
        onDataChannelOpen: () => {
          if (pendingMediaStateRef.current) {
            sendMediaStateHelper(dataChannelRef.current, pendingMediaStateRef.current);
            pendingMediaStateRef.current = null;
          }
        },
      },
      currentMediaStateRef.current
    );

    peerConnectionRef.current = pc;
    dataChannelRef.current = dataChannel;
    return pc;
  }, [cleanup]);

  const startCall = useCallback(async () => {
    try {
      setError('');
      setIsMuted(false);
      setIsVideoOff(false);
      setIsRemoteMuted(false);
      setIsRemoteVideoOff(false);
      currentMediaStateRef.current = { audioMuted: false, videoOff: false };
      pendingMediaStateRef.current = null;
      
      const targetRoomId = generateRoomIdHelper(roomName);
      if (!targetRoomId.trim()) {
        setError('Room ID not specified');
        return;
      }
      
      const checkResponse = await fetch(`/api/signaling/get?roomId=${targetRoomId}`);
      
      if (checkResponse.ok) {
        setRoomId(targetRoomId);
        await joinCall(targetRoomId);
        return;
      }
      
      setState('creating');
      iceCandidatesRef.current = [];
      setRoomId(targetRoomId);

      const stream = await getLocalStream(facingMode);
      const pc = createPeerConnection();

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await new Promise((resolve) => setTimeout(resolve, ICE_GATHERING_DELAY));

      const response = await fetch('/api/signaling/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: targetRoomId,
          offer: pc.localDescription,
          iceCandidates: iceCandidatesRef.current,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 503) {
          throw new Error('Database not configured. Create .env.local with Vercel KV variables. See README.md');
        }
        throw new Error(errorData.error || 'Failed to create room');
      }

      const inviteLink = `${window.location.origin}?room=${targetRoomId}`;
      setShareLink(inviteLink);
      setState('waiting');

      let pollAttempts = 0;
      
      pollingIntervalRef.current = setInterval(async () => {
        pollAttempts++;
        
        if (pollAttempts > MAX_POLL_ATTEMPTS) {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          setError('Timeout. Second user did not connect.');
          cleanup();
          setState('idle');
          return;
        }
        
        try {
          const answerResponse = await fetch(`/api/signaling/get-answer?roomId=${targetRoomId}`);
          if (answerResponse.ok) {
            const { answer, iceCandidates } = await answerResponse.json();
            
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }

            setState('connecting');
            await pc.setRemoteDescription(new RTCSessionDescription(answer));

            for (const candidate of iceCandidates) {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            }
          }
        } catch {
          // Continue polling
        }
      }, POLLING_INTERVAL);
    } catch (err) {
      console.error('Error starting call:', err);
      setError('Error creating call');
      cleanup();
      setState('idle');
    }
  }, [roomName, facingMode, getLocalStream, createPeerConnection, cleanup]);

  const joinCall = useCallback(async (roomIdParam?: string) => {
    const targetRoomId = roomIdParam || roomId;
    
    if (!targetRoomId.trim()) {
      setError('Room ID not specified');
      return;
    }

    try {
      setError('');
      setState('connecting');
      iceCandidatesRef.current = [];

      const stream = await getLocalStream(facingMode);
      const pc = createPeerConnection();

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      const response = await fetch(`/api/signaling/get?roomId=${targetRoomId}`);
      if (!response.ok) {
        throw new Error('Room not found');
      }

      const { offer, iceCandidates } = await response.json();

      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      for (const candidate of iceCandidates) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await new Promise((resolve) => setTimeout(resolve, ICE_GATHERING_DELAY));

      await fetch('/api/signaling/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: targetRoomId,
          answer: pc.localDescription,
          iceCandidates: iceCandidatesRef.current,
        }),
      });
    } catch (err) {
      console.error('Error joining call:', err);
      setError('Error joining call');
      cleanup();
      setState('idle');
    }
  }, [roomId, facingMode, getLocalStream, createPeerConnection, cleanup]);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        const newMutedState = !audioTrack.enabled;
        setIsMuted(newMutedState);
        currentMediaStateRef.current.audioMuted = newMutedState;
        setTimeout(() => sendMediaState(newMutedState, currentMediaStateRef.current.videoOff), MEDIA_STATE_SEND_DELAY);
      }
    }
  }, [sendMediaState]);

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        const newVideoOffState = !videoTrack.enabled;
        setIsVideoOff(newVideoOffState);
        currentMediaStateRef.current.videoOff = newVideoOffState;
        setTimeout(() => sendMediaState(currentMediaStateRef.current.audioMuted, newVideoOffState), MEDIA_STATE_SEND_DELAY);
      }
    }
  }, [sendMediaState]);

  const toggleCamera = useCallback(async () => {
    try {
      if (localStreamRef.current) {
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.stop();
        }
      }

      const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
      setFacingMode(newFacingMode);

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacingMode },
        audio: false,
      });

      const newVideoTrack = newStream.getVideoTracks()[0];
      
      if (localStreamRef.current) {
        const audioTrack = localStreamRef.current.getAudioTracks()[0];
        const newCombinedStream = new MediaStream();
        
        if (audioTrack) {
          newCombinedStream.addTrack(audioTrack);
        }
        newCombinedStream.addTrack(newVideoTrack);
        
        localStreamRef.current = newCombinedStream;
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = newCombinedStream;
        }
        
        if (peerConnectionRef.current) {
          const sender = peerConnectionRef.current.getSenders().find(
            s => s.track?.kind === 'video'
          );
          if (sender) {
            await sender.replaceTrack(newVideoTrack);
          }
        }
      }
    } catch (err) {
      console.error('Camera switch error:', err);
      setError('Could not switch camera');
    }
  }, [facingMode]);

  const endCall = useCallback(async () => {
    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      try {
        dataChannelRef.current.send(JSON.stringify({ type: 'callEnded' }));
      } catch {
        // Ignore
      }
    }
    
    if (roomId && (state === 'creating' || state === 'waiting')) {
      await fetch(`/api/signaling/delete?roomId=${roomId}`, {
        method: 'DELETE',
      });
    }
    cleanup();
    setState('idle');
    setRoomId('');
    setShareLink('');
    setError('');
    hasAutoJoinedRef.current = false;
    window.history.replaceState({}, '', '/');
  }, [roomId, state, cleanup]);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [shareLink]);

  return {
    // State
    roomName,
    state,
    error,
    shareLink,
    isMuted,
    isVideoOff,
    isRemoteMuted,
    isRemoteVideoOff,
    
    // Refs
    localVideoRef,
    remoteVideoRef,
    
    // Actions
    setRoomName,
    startCall,
    endCall,
    copyLink,
    toggleMute,
    toggleVideo,
    toggleCamera,
  };
}
