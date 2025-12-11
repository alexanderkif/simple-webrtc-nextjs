import { STUN_SERVERS } from './webrtc-config';
import { DATA_CHANNEL_OPEN_DELAY } from './webrtc-constants';
import type { MediaState, DataChannelMessage, PeerConnectionCallbacks } from './webrtc-types';

export function generateRoomId(roomName: string): string {
  if (roomName.trim()) {
    const cleanId = roomName.trim().toLowerCase();
    if (typeof window !== 'undefined') {
      localStorage.setItem('myRoomId', cleanId);
    }
    return cleanId;
  }
  
  const savedRoomId = typeof window !== 'undefined' ? localStorage.getItem('myRoomId') : null;
  if (savedRoomId) {
    return savedRoomId;
  }
  
  const newRoomId = Math.random().toString(36).substring(2, 15);
  if (typeof window !== 'undefined') {
    localStorage.setItem('myRoomId', newRoomId);
  }
  return newRoomId;
}

export async function getLocalStream(
  videoFacingMode: 'user' | 'environment' = 'user',
  onError: (message: string) => void
): Promise<MediaStream> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: videoFacingMode },
      audio: true,
    });
    return stream;
  } catch {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: true,
      });
      onError('Camera unavailable. Audio only.');
      return stream;
    } catch (audioErr) {
      onError('Could not access microphone');
      throw audioErr;
    }
  }
}

export function createPeerConnection(
  callbacks: PeerConnectionCallbacks,
  initialMediaState: MediaState
): { pc: RTCPeerConnection; dataChannel: RTCDataChannel } {
  const pc = new RTCPeerConnection(STUN_SERVERS);
  const dataChannel = pc.createDataChannel('mediaState');
  
  // Data channel setup (initiator)
  dataChannel.onopen = () => {
    callbacks.onDataChannelOpen();
    setTimeout(() => {
      if (dataChannel.readyState === 'open') {
        dataChannel.send(JSON.stringify({
          type: 'mediaState',
          audioMuted: initialMediaState.audioMuted,
          videoOff: initialMediaState.videoOff
        } as DataChannelMessage));
      }
    }, DATA_CHANNEL_OPEN_DELAY);
  };
  
  dataChannel.onclose = () => {};
  
  dataChannel.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as DataChannelMessage;
      callbacks.onDataChannelMessage(data);
    } catch (err) {
      console.error('Error parsing data channel message:', err);
    }
  };
  
  // Data channel setup (receiver)
  pc.ondatachannel = (event) => {
    const receiveChannel = event.channel;
    
    receiveChannel.onopen = () => {
      callbacks.onDataChannelOpen();
      setTimeout(() => {
        if (receiveChannel.readyState === 'open') {
          receiveChannel.send(JSON.stringify({
            type: 'mediaState',
            audioMuted: initialMediaState.audioMuted,
            videoOff: initialMediaState.videoOff
          } as DataChannelMessage));
        }
      }, DATA_CHANNEL_OPEN_DELAY);
    };
    
    receiveChannel.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as DataChannelMessage;
        callbacks.onDataChannelMessage(data);
      } catch (err) {
        console.error('Error parsing data channel message:', err);
      }
    };
  };

  // ICE candidate handling
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      callbacks.onIceCandidate(event.candidate.toJSON());
    }
  };

  // Remote track handling
  pc.ontrack = (event) => {
    if (event.streams[0]) {
      callbacks.onRemoteTrack(event.streams[0]);
    }
  };

  // Connection state monitoring
  pc.onconnectionstatechange = () => {
    callbacks.onConnectionStateChange(pc.connectionState);
  };

  return { pc, dataChannel };
}

export function sendMediaState(
  dataChannel: RTCDataChannel | null,
  mediaState: MediaState
): boolean {
  if (dataChannel && dataChannel.readyState === 'open') {
    dataChannel.send(JSON.stringify({
      type: 'mediaState',
      audioMuted: mediaState.audioMuted,
      videoOff: mediaState.videoOff,
    } as DataChannelMessage));
    return true;
  }
  return false;
}
