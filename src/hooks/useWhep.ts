import { useState, useCallback, useRef } from 'react';

export interface WhepOptions {
  endpoint: string;
  token?: string;
  encrypted?: boolean;
  onTrack?: (event: RTCTrackEvent) => void;
}

export function useWhep() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const disconnect = useCallback((clearError = true) => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    streamRef.current = null;
    setIsConnected(false);
    setIsConnecting(false);
    if (clearError) {
      setError(null);
    }
  }, []);

  const connect = useCallback(async (options: WhepOptions, videoElement: HTMLVideoElement | null) => {
    disconnect();
    setError(null);
    setIsConnecting(true);

    const { endpoint, token, encrypted } = options;
    streamRef.current = new MediaStream();

    try {
      const pc = new RTCPeerConnection({
        bundlePolicy: 'max-bundle',
        iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }],
        // @ts-ignore
        encodedInsertableStreams: encrypted
      });
      pcRef.current = pc;

      pc.addTransceiver('video', { direction: 'recvonly' });
      pc.addTransceiver('audio', { direction: 'recvonly' });

      pc.ontrack = (event) => {
        console.log('Track received:', event.track.kind);
        if (options.onTrack) {
          options.onTrack(event);
        } else {
          streamRef.current?.addTrack(event.track);
          if (videoElement && !videoElement.srcObject) {
            videoElement.srcObject = streamRef.current;
          }
        }
      };

      const handleStateChange = () => {
        const state = pc.connectionState;
        console.log('WebRTC Connection State:', state);
        if (state === 'connected') {
          setIsConnected(true);
          setIsConnecting(false);
          if (videoElement && !videoElement.srcObject && streamRef.current) {
            videoElement.srcObject = streamRef.current;
          }
        } else if (['failed', 'closed', 'disconnected'].includes(state)) {
          setIsConnected(false);
          setIsConnecting(false);
        }
      };

      pc.addEventListener('connectionstatechange', handleStateChange);
      pc.addEventListener('iceconnectionstatechange', () => {
        console.log('ICE Connection State:', pc.iceConnectionState);
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for ICE gathering
      if (pc.iceGatheringState !== 'complete') {
        await Promise.race([
          new Promise<void>((resolve) => {
            const check = () => {
              if (pc.iceGatheringState === 'complete') {
                pc.removeEventListener('icegatheringstatechange', check);
                resolve();
              }
            };
            pc.addEventListener('icegatheringstatechange', check);
          }),
          new Promise<void>((resolve) => setTimeout(resolve, 2000))
        ]);
      }

      const headers = new Headers();
      headers.append('Content-Type', 'application/sdp');
      if (token) {
        headers.append('Authorization', `Bearer ${token}`);
      }

      console.log('WHEP Signaling URL:', endpoint);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(endpoint, {
        method: 'POST',
        mode: 'cors',
        headers,
        body: pc.localDescription?.sdp,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      console.log('WHEP Response Status:', response.status);

      if (response.status === 201) {
        const answerSdp = await response.text();
        await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: answerSdp }));
        console.log('Remote description set successfully');
      } else {
        throw new Error(`WHEP signaling failed with status ${response.status}`);
      }

    } catch (error: any) {
      console.error('WHEP connection error:', error);
      setError(error.message || 'Connection failed');
      setIsConnecting(false);
      disconnect(false);
    }
  }, [disconnect]);

  return {
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
    peerConnection: pcRef.current
  };
}