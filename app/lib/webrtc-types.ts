export type ConnectionState = 'idle' | 'creating' | 'waiting' | 'connecting' | 'connected';

export interface MediaState {
  audioMuted: boolean;
  videoOff: boolean;
}

export interface DataChannelMessage {
  type: 'mediaState' | 'callEnded';
  audioMuted?: boolean;
  videoOff?: boolean;
}

export interface PeerConnectionCallbacks {
  onRemoteTrack: (stream: MediaStream) => void;
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
  onIceCandidate: (candidate: RTCIceCandidateInit) => void;
  onDataChannelMessage: (message: DataChannelMessage) => void;
  onDataChannelOpen: () => void;
}
