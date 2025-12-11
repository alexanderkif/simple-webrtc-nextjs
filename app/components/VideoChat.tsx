'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import WaitingRoom from './WaitingRoom';
import VideoWindow from './VideoWindow';
import CallControls from './CallControls';
import FullscreenControls from './FullscreenControls';

const STUN_SERVERS = {
  iceServers: [
    // Google STUN (глобальные, надежные)
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    
    // Numb Viagenie TURN (глобальные, проверенные)
    {
      urls: 'turn:numb.viagenie.ca',
      username: 'webrtc@live.com',
      credential: 'muazkh',
    },
    {
      urls: 'turn:numb.viagenie.ca:3478?transport=tcp',
      username: 'webrtc@live.com',
      credential: 'muazkh',
    },
  ],
  iceTransportPolicy: 'all' as RTCIceTransportPolicy,
  bundlePolicy: 'max-bundle' as RTCBundlePolicy,
  iceCandidatePoolSize: 10,
};

type ConnectionState = 'idle' | 'creating' | 'waiting' | 'connecting' | 'connected';

export default function VideoChat() {
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeVideo, setActiveVideo] = useState<'local' | 'remote'>('remote');
  const [showFullscreenHint, setShowFullscreenHint] = useState(true);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const iceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasAutoJoinedRef = useRef(false);
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);
  const mediaMonitorIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastBytesReceivedRef = useRef<number>(0);
  const noMediaCountRef = useRef<number>(0);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const pendingMediaStateRef = useRef<{audioMuted: boolean, videoOff: boolean} | null>(null);
  const currentMediaStateRef = useRef<{audioMuted: boolean, videoOff: boolean}>({ audioMuted: false, videoOff: false });

  // Загрузка идентификатора комнаты из localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedRoomId = localStorage.getItem('myRoomId');
      if (savedRoomId) {
        setRoomName(savedRoomId);
      }
    }
  }, []);

  // Проверка URL параметров при загрузке
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomIdFromUrl = urlParams.get('room');
    
    if (roomIdFromUrl && !hasAutoJoinedRef.current) {
      hasAutoJoinedRef.current = true;
      setRoomName(roomIdFromUrl); // Просто заполняем поле, не подключаемся автоматически
    }
  }, []);

  // Очистка ресурсов при размонтировании
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  // Удаление комнаты при закрытии страницы
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

  // Установка srcObject когда video элементы появляются в DOM
  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      // Проверяем что поток активен и srcObject не установлен или отличается
      if (localStreamRef.current.active && localVideoRef.current.srcObject !== localStreamRef.current) {
        console.log('Setting local video srcObject');
        localVideoRef.current.srcObject = localStreamRef.current;
        // Явно запускаем воспроизведение
        localVideoRef.current.play().catch(e => console.log('Local video play error:', e));
      }
    }
  }, [state, isFullscreen, activeVideo]); // Перезапускается при изменении состояния (когда video появляется в DOM)

  useEffect(() => {
    if (remoteVideoRef.current && remoteStreamRef.current) {
      // Проверяем что поток активен и srcObject не установлен или отличается
      if (remoteStreamRef.current.active && remoteVideoRef.current.srcObject !== remoteStreamRef.current) {
        console.log('Setting remote video srcObject');
        remoteVideoRef.current.srcObject = remoteStreamRef.current;
        remoteVideoRef.current.volume = 1.0;
        // Явно запускаем воспроизведение
        remoteVideoRef.current.play().catch(e => console.log('Remote video play error:', e));
      }
    }
  }, [state, isFullscreen, activeVideo]); // Перезапускается при изменении состояния (когда video появляется в DOM)

  // Fallback проверка через статистику (если data channel не работает)
  useEffect(() => {
    if (state !== 'connected' || !peerConnectionRef.current) return;
    
    // Даем data channel время открыться
    const timeout = setTimeout(() => {
      if (!dataChannelRef.current || dataChannelRef.current.readyState !== 'open') {
        console.log('Data channel недоступен, используем fallback через статистику');
        
        const checkRemoteTracks = async () => {
          if (!peerConnectionRef.current || state !== 'connected') return;
          
          try {
            const stats = await peerConnectionRef.current.getStats();
            let hasAudioData = false;
            let hasVideoData = false;
            
            stats.forEach((report) => {
              if (report.type === 'inbound-rtp') {
                if (report.kind === 'audio' && report.packetsReceived > 0) {
                  hasAudioData = true;
                } else if (report.kind === 'video' && report.packetsReceived > 0) {
                  hasVideoData = true;
                }
              }
            });
            
            setIsRemoteMuted(!hasAudioData);
            setIsRemoteVideoOff(!hasVideoData);
          } catch (err) {
            console.error('Error checking remote tracks:', err);
          }
        };
        
        const interval = setInterval(checkRemoteTracks, 2000);
        return () => clearInterval(interval);
      }
    }, 3000);
    
    return () => clearTimeout(timeout);
  }, [state]);

  // Мониторинг реального медиа-трафика
  useEffect(() => {
    if (state !== 'connected' || !peerConnectionRef.current) {
      // Очищаем мониторинг если не connected
      if (mediaMonitorIntervalRef.current) {
        clearInterval(mediaMonitorIntervalRef.current);
        mediaMonitorIntervalRef.current = null;
      }
      lastBytesReceivedRef.current = 0;
      noMediaCountRef.current = 0;
      return;
    }

    console.log('Запуск мониторинга медиа-трафика');
    
    const monitorMediaTraffic = async () => {
      if (!peerConnectionRef.current || state !== 'connected') return;
      
      try {
        const stats = await peerConnectionRef.current.getStats();
        let currentBytesReceived = 0;
        let hasActiveVideo = false;
        
        stats.forEach((report) => {
          // Проверяем входящий медиа-трафик
          if (report.type === 'inbound-rtp') {
            if (report.bytesReceived !== undefined) {
              currentBytesReceived += report.bytesReceived;
            }
            if (report.kind === 'video' && report.bytesReceived > 0) {
              hasActiveVideo = true;
            }
          }
        });
        
        // Проверяем увеличились ли байты
        if (lastBytesReceivedRef.current > 0) {
          const bytesIncrease = currentBytesReceived - lastBytesReceivedRef.current;
          
          if (bytesIncrease < 1000) { // Меньше 1KB за 3 секунды = проблема
            noMediaCountRef.current++;
            console.warn(`Медиа-трафик отсутствует (${noMediaCountRef.current}/3), получено: ${bytesIncrease} байт`);
            
            if (noMediaCountRef.current >= 3) {
              console.error('Медиа-трафик не проходит 9 секунд. Соединение установлено но данные не идут.');
              setError('Медиа-трафик не проходит. Попробуйте переподключиться.');
              // Автоматически отключаем
              setTimeout(() => {
                cleanup();
                setState('idle');
              }, 2000);
            }
          } else {
            // Трафик идет - сбрасываем счетчик
            if (noMediaCountRef.current > 0) {
              console.log(`Медиа-трафик восстановлен: ${bytesIncrease} байт`);
            }
            noMediaCountRef.current = 0;
          }
        }
        
        lastBytesReceivedRef.current = currentBytesReceived;
        
        // Логируем статистику
        if (currentBytesReceived > 0) {
          console.log(`Статистика: получено ${currentBytesReceived} байт, видео: ${hasActiveVideo ? 'да' : 'нет'}`);
        }
      } catch (err) {
        console.error('Ошибка мониторинга трафика:', err);
      }
    };
    
    // Проверяем каждые 3 секунды
    mediaMonitorIntervalRef.current = setInterval(monitorMediaTraffic, 3000);
    
    return () => {
      if (mediaMonitorIntervalRef.current) {
        clearInterval(mediaMonitorIntervalRef.current);
        mediaMonitorIntervalRef.current = null;
      }
    };
  }, [state]);

  const cleanup = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    
    if (mediaMonitorIntervalRef.current) {
      clearInterval(mediaMonitorIntervalRef.current);
      mediaMonitorIntervalRef.current = null;
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

    // Очищаем ICE candidates
    iceCandidatesRef.current = [];
    
    // Сбрасываем состояние remote треков
    setIsRemoteMuted(false);
    setIsRemoteVideoOff(false);
  }, []);

  const generateRoomId = () => {
    // Если пользователь ввел идентификатор - используем его
    if (roomName.trim()) {
      const cleanId = roomName.trim().toLowerCase();
      
      // Сохраняем в localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('myRoomId', cleanId);
      }
      return cleanId;
    }
    
    // Пробуем получить сохраненный room ID
    const savedRoomId = typeof window !== 'undefined' ? localStorage.getItem('myRoomId') : null;
    if (savedRoomId) {
      return savedRoomId;
    }
    
    // Генерируем случайный и сохраняем
    const newRoomId = Math.random().toString(36).substring(2, 15);
    if (typeof window !== 'undefined') {
      localStorage.setItem('myRoomId', newRoomId);
    }
    return newRoomId;
  };

  // Отправка состояния медиа через data channel
  const sendMediaState = (customAudioMuted?: boolean, customVideoOff?: boolean) => {
    const audioMuted = customAudioMuted !== undefined ? customAudioMuted : currentMediaStateRef.current.audioMuted;
    const videoOff = customVideoOff !== undefined ? customVideoOff : currentMediaStateRef.current.videoOff;
    
    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      const state = {
        type: 'mediaState',
        audioMuted,
        videoOff,
      };
      console.log('Отправляем состояние:', state);
      dataChannelRef.current.send(JSON.stringify(state));
      pendingMediaStateRef.current = null; // Очищаем отложенное состояние
    } else {
      // Сохраняем состояние для отправки когда канал откроется
      console.log('Data channel не открыт, сохраняем состояние для отправки позже:', { audioMuted, videoOff });
      pendingMediaStateRef.current = { audioMuted, videoOff };
    }
  };

  const getLocalStream = async (videoFacingMode: 'user' | 'environment' = 'user') => {
    try {
      // Пробуем получить видео и аудио
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: videoFacingMode },
        audio: true,
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      // Логируем треки для отладки
      console.log('Local stream tracks:', stream.getTracks().map(t => ({
        kind: t.kind,
        enabled: t.enabled,
        muted: t.muted,
        readyState: t.readyState
      })));
      
      // Убеждаемся, что аудио трек включен
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = true;
        setIsMuted(false);
      }
      
      return stream;
    } catch (err) {
      console.log('Ошибка доступа к камере, пробуем только аудио:', err);
      
      // Если камера недоступна, пробуем только аудио
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: true,
        });
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        
        console.log('Подключено только аудио');
        setError('Камера недоступна. Подключен только звук.');
        
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.enabled = true;
          setIsMuted(false);
        }
        
        return stream;
      } catch (audioErr) {
        setError('Не удалось получить доступ к микрофону');
        throw audioErr;
      }
    }
  };

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection(STUN_SERVERS);

    // Создаем data channel для передачи состояния UI
    const dataChannel = pc.createDataChannel('mediaState');
    dataChannelRef.current = dataChannel;
    
    dataChannel.onopen = () => {
      console.log('Data channel открыт');
      // Отправляем текущее состояние с небольшой задержкой
      setTimeout(() => {
        if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
          // Если есть отложенное состояние, отправляем его, иначе текущее из ref
          const stateToSend = pendingMediaStateRef.current || currentMediaStateRef.current;
          const state = {
            type: 'mediaState',
            audioMuted: stateToSend.audioMuted,
            videoOff: stateToSend.videoOff
          };
          console.log('Отправляем начальное состояние:', state);
          dataChannelRef.current.send(JSON.stringify(state));
          pendingMediaStateRef.current = null; // Очищаем отложенное состояние
        }
      }, 200);
    };
    
    dataChannel.onclose = () => {
      console.log('Data channel закрыт');
    };
    
    dataChannel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Получено состояние от собеседника:', data);
        
        if (data.type === 'mediaState') {
          setIsRemoteMuted(data.audioMuted);
          setIsRemoteVideoOff(data.videoOff);
        }
      } catch (err) {
        console.error('Ошибка парсинга data channel сообщения:', err);
      }
    };
    
    // Обработчик для получающей стороны (когда другой участник создал канал)
    pc.ondatachannel = (event) => {
      const receiveChannel = event.channel;
      dataChannelRef.current = receiveChannel;
      
      receiveChannel.onopen = () => {
        console.log('Data channel получен и открыт');
        // Отправляем текущее состояние с небольшой задержкой
        setTimeout(() => {
          if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
            // Если есть отложенное состояние, отправляем его, иначе текущее из ref
            const stateToSend = pendingMediaStateRef.current || currentMediaStateRef.current;
            const state = {
              type: 'mediaState',
              audioMuted: stateToSend.audioMuted,
              videoOff: stateToSend.videoOff
            };
            console.log('Отправляем начальное состояние:', state);
            dataChannelRef.current.send(JSON.stringify(state));
            pendingMediaStateRef.current = null; // Очищаем отложенное состояние
          }
        }, 200);
      };
      
      receiveChannel.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          console.log('Получено состояние от собеседника:', data);
          
          if (data.type === 'mediaState') {
            setIsRemoteMuted(data.audioMuted);
            setIsRemoteVideoOff(data.videoOff);
          }
        } catch (err) {
          console.error('Ошибка парсинга data channel сообщения:', err);
        }
      };
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        iceCandidatesRef.current.push(event.candidate.toJSON());
      }
    };

    pc.ontrack = (event) => {
      console.log('Received track:', event.track.kind, event.streams[0]);
      
      // Отслеживаем изменения состояния трека
      const track = event.track;
      
      // Слушаем события изменения состояния (работает только для физических изменений)
      track.onmute = () => {
        console.log(`Remote ${track.kind} physically muted (no signal)`);
      };
      
      track.onunmute = () => {
        console.log(`Remote ${track.kind} physically unmuted (signal restored)`);
      };
      
      track.onended = () => {
        console.log(`Remote ${track.kind} ended`);
        if (track.kind === 'audio') {
          setIsRemoteMuted(true);
        } else if (track.kind === 'video') {
          setIsRemoteVideoOff(true);
        }
      };
      
      if (remoteVideoRef.current && event.streams[0]) {
        // Сохраняем ссылку на remote stream
        remoteStreamRef.current = event.streams[0];
        // Устанавливаем srcObject только если он еще не установлен
        if (remoteVideoRef.current.srcObject !== event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
          remoteVideoRef.current.volume = 1.0; // Устанавливаем громкость на максимум
          // Убедимся, что воспроизведение запустилось
          remoteVideoRef.current.play().catch(err => {
            console.error('Error playing remote video:', err);
          });
        }
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setState('connected');
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        setError('Соединение потеряно');
        cleanup();
        setState('idle');
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  };

  const startCall = async () => {
    try {
      setError('');
      
      // Сбрасываем состояние кнопок перед новым звонком
      setIsMuted(false);
      setIsVideoOff(false);
      setIsRemoteMuted(false);
      setIsRemoteVideoOff(false);
      currentMediaStateRef.current = { audioMuted: false, videoOff: false };
      pendingMediaStateRef.current = null;
      
      const targetRoomId = generateRoomId();
      if (!targetRoomId.trim()) {
        setError('ID комнаты не указан');
        return;
      }
      
      // Проверяем существует ли комната
      const checkResponse = await fetch(`/api/signaling/get?roomId=${targetRoomId}`);
      
      if (checkResponse.ok) {
        // Комната существует - подключаемся к ней
        console.log('Комната найдена, подключаемся...');
        setRoomId(targetRoomId);
        await joinCall(targetRoomId);
        return;
      }
      
      // Комната не существует - создаем новую
      console.log('Комната не найдена, создаем новую...');
      setState('creating');

      // Очищаем ICE candidates перед началом
      iceCandidatesRef.current = [];

      setRoomId(targetRoomId);

      const stream = await getLocalStream(facingMode);
      const pc = createPeerConnection();

      stream.getTracks().forEach((track) => {
        console.log('Adding local track:', track.kind, track.enabled);
        pc.addTrack(track, stream);
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Ждем дольше для сбора всех ICE candidates (особенно важно для России)
      await new Promise((resolve) => setTimeout(resolve, 4000));

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
          throw new Error('База данных не настроена. Создайте .env.local с переменными Vercel KV. См. README.md');
        }
        throw new Error(errorData.error || 'Не удалось создать комнату');
      }

      // Создаем ссылку для приглашения
      const inviteLink = `${window.location.origin}?room=${targetRoomId}`;
      setShareLink(inviteLink);

      setState('waiting');

      // Начинаем polling для получения answer (каждые 5 секунд)
      let pollAttempts = 0;
      const maxPollAttempts = 60; // 60 * 5сек = 5 минут максимум
      
      pollingIntervalRef.current = setInterval(async () => {
        pollAttempts++;
        
        // Проверка таймаута
        if (pollAttempts > maxPollAttempts) {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          setError('Время ожидания истекло. Второй пользователь не подключился.');
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
        } catch (err) {
          // Answer еще не готов, продолжаем polling
        }
      }, 5000); // 5 секунд между запросами
    } catch (err) {
      console.error('Error starting call:', err);
      setError('Ошибка при создании звонка');
      cleanup();
      setState('idle');
    }
  };

  const joinCall = async (roomIdParam?: string) => {
    const targetRoomId = roomIdParam || roomId;
    
    if (!targetRoomId.trim()) {
      setError('ID комнаты не указан');
      return;
    }

    try {
      setError('');
      setState('connecting');

      // Очищаем ICE candidates перед началом
      iceCandidatesRef.current = [];

      const stream = await getLocalStream(facingMode);
      const pc = createPeerConnection();

      stream.getTracks().forEach((track) => {
        console.log('Adding local track (join):', track.kind, track.enabled);
        pc.addTrack(track, stream);
      });

      const response = await fetch(`/api/signaling/get?roomId=${targetRoomId}`);
      if (!response.ok) {
        throw new Error('Комната не найдена');
      }

      const { offer, iceCandidates } = await response.json();

      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      for (const candidate of iceCandidates) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Ждем дольше для сбора всех ICE candidates (особенно важно для России)
      await new Promise((resolve) => setTimeout(resolve, 4000));

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
      setError('Ошибка при подключении к звонку');
      cleanup();
      setState('idle');
    }
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        const newMutedState = !audioTrack.enabled;
        setIsMuted(newMutedState);
        currentMediaStateRef.current.audioMuted = newMutedState;
        // Отправляем обновленное состояние напрямую
        setTimeout(() => sendMediaState(newMutedState, currentMediaStateRef.current.videoOff), 50);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        const newVideoOffState = !videoTrack.enabled;
        setIsVideoOff(newVideoOffState);
        currentMediaStateRef.current.videoOff = newVideoOffState;
        // Отправляем обновленное состояние напрямую
        setTimeout(() => sendMediaState(currentMediaStateRef.current.audioMuted, newVideoOffState), 50);
      }
    }
  };

  const toggleCamera = async () => {
    try {
      // Останавливаем текущий видео трек
      if (localStreamRef.current) {
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.stop();
        }
      }

      // Переключаем режим камеры
      const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
      setFacingMode(newFacingMode);

      // Получаем новый поток с другой камерой
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacingMode },
        audio: false, // Аудио уже есть, не трогаем
      });

      const newVideoTrack = newStream.getVideoTracks()[0];
      
      // Заменяем видео трек в существующем потоке
      if (localStreamRef.current) {
        const audioTrack = localStreamRef.current.getAudioTracks()[0];
        const newCombinedStream = new MediaStream();
        
        if (audioTrack) {
          newCombinedStream.addTrack(audioTrack);
        }
        newCombinedStream.addTrack(newVideoTrack);
        
        localStreamRef.current = newCombinedStream;
        
        // Обновляем srcObject для локального видео
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = newCombinedStream;
        }
        
        // Обновляем видео трек в peer connection
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
      console.error('Ошибка переключения камеры:', err);
      setError('Не удалось переключить камеру');
    }
  };

  const endCall = async () => {
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
    // Очищаем URL
    window.history.replaceState({}, '', '/');
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      // Можно добавить уведомление об успешном копировании
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const toggleFullscreen = (activeVideoToShow?: 'local' | 'remote') => {
    if (!isFullscreen) {
      // Устанавливаем активное видео, если передано
      if (activeVideoToShow) {
        setActiveVideo(activeVideoToShow);
      }
      // Входим в полноэкранный режим
      if (fullscreenContainerRef.current) {
        if (fullscreenContainerRef.current.requestFullscreen) {
          fullscreenContainerRef.current.requestFullscreen();
        }
      }
      setIsFullscreen(true);
    } else {
      // Выходим из полноэкранного режима
      if (document.fullscreenElement) {
        document.exitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  const switchVideo = () => {
    setActiveVideo(activeVideo === 'local' ? 'remote' : 'local');
  };

  // Отслеживаем выход из fullscreen через ESC
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
        setShowFullscreenHint(true); // Сбрасываем при выходе
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
        setShowFullscreenHint(true); // Сбрасываем при выходе
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

  // Автоматически скрываем подсказку в fullscreen через 4 секунды
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
        Видео-чат WebRTC
      </h1>

      {state === 'idle' && (
        <div className="bg-zinc-900 rounded-2xl p-8 max-w-md mx-auto">
          <div className="space-y-6">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="roomId" className="block text-sm font-medium text-zinc-400 mb-2">
                Идентификатор комнаты
              </label>
              <input
                id="roomId"
                type="text"
                value={roomName}
                onChange={(e) => {
                  // Фильтруем символы: только a-z, 0-9, дефис и подчеркивание
                  const filtered = e.target.value.toLowerCase().replace(/[^a-z0-9_\-]/g, '');
                  setRoomName(filtered);
                }}
                placeholder="Оставьте пустым для случайного ID"
                pattern="[a-z0-9_\-]*"
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                maxLength={50}
              />
              <p className="mt-1 text-xs text-zinc-500">
                Если комната существует - подключитесь, если нет - создастся новая
              </p>
            </div>

            <button
              onClick={startCall}
              className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              Начать звонок
            </button>
          </div>
        </div>
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
