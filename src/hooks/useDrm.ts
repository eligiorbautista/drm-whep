import { useCallback, useRef } from 'react';
import { rtcDrmConfigure, rtcDrmOnTrack, rtcDrmEnvironments } from '../lib/drm';
import type { DrmConfig, TrackConfig } from '../lib/drm';

export interface UseDrmOptions {
  merchant: string;
  videoElement: HTMLVideoElement | null;
  audioElement?: HTMLAudioElement | null;
  environment?: 'Staging' | 'Production' | 'Development';
  authToken?: string;
  keyId?: Uint8Array;
  iv?: Uint8Array;
  mediaBufferMs?: number;
}

export function useDrm() {
  const configRef = useRef<DrmConfig | null>(null);

  const setup = useCallback((options: UseDrmOptions, videoTrackConfig?: TrackConfig) => {
    if (!options.videoElement) return null;

    // Default sandbox keys if not provided
    const defaultKeyId = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01]);
    const defaultIv = new Uint8Array([0xd5, 0xfb, 0xd6, 0xb8, 0x2e, 0xd9, 0x3e, 0x4e, 0xf9, 0x8a, 0xe4, 0x09, 0x31, 0xee, 0x33, 0xb7]);

    // @ts-ignore: Accessing static properties via string index
    const env = rtcDrmEnvironments[options.environment || 'Staging'];

    const videoConfig = videoTrackConfig || { 
      codec: 'H264' as const, 
      encryption: 'cbcs' as const,
      keyId: options.keyId || defaultKeyId,
      iv: options.iv || defaultIv,
      robustness: 'HW' as const // Default to HW for better compatibility with output protection
    };

    const config: DrmConfig = {
      merchant: options.merchant,
      authToken: options.authToken,
      environment: env,
      videoElement: options.videoElement,
      audioElement: options.audioElement || undefined,
      video: videoConfig,
      audio: { codec: 'opus' as const, encryption: 'clear' as const },
      logLevel: 3,
      mediaBufferMs: options.mediaBufferMs || 1200
    };

    configRef.current = config;
    rtcDrmConfigure(config);

    return config;
  }, []);

  const handleTrack = useCallback((event: RTCTrackEvent) => {
    if (configRef.current) {
      rtcDrmOnTrack(event, configRef.current);
    }
  }, []);

  return {
    setup,
    handleTrack,
    config: configRef.current
  };
}