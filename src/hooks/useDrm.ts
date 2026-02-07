import { useCallback, useRef } from 'react';
import { rtcDrmConfigure, rtcDrmOnTrack, rtcDrmEnvironments } from '../lib/drm';
import { hexToUint8Array, validateDrmKey, generateAuthToken } from '../lib/drmUtils';
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
  encryptionMode?: 'cenc' | 'cbcs';
}

/**
 * Platform detection utility
 */
function detectPlatform() {
  const uad = (navigator as any).userAgentData;
  const platform = uad?.platform || navigator.platform || '';
  const isMobile = uad?.mobile === true;
  const uaHasAndroid = /Android/i.test(navigator.userAgent);
  const isAndroid = platform.toLowerCase() === 'android' ||
                    uaHasAndroid ||
                    (isMobile && /linux/i.test(platform));
  
  return {
    isAndroid,
    platform: isAndroid ? 'Android' : (platform || 'Unknown')
  };
}

/**
 * Detect Android Widevine robustness level
 */
async function detectAndroidRobustness(): Promise<'HW' | 'SW'> {
  try {
    await navigator.requestMediaKeySystemAccess('com.widevine.alpha', [{
      initDataTypes: ['cenc'],
      videoCapabilities: [{
        contentType: 'video/mp4; codecs="avc1.42E01E"',
        robustness: 'HW_SECURE_ALL'
      }]
    }]);
    console.log('[DRM] Widevine L1 (HW_SECURE_ALL) is supported');
    return 'HW';
  } catch {
    console.log('[DRM] Widevine L1 (HW) NOT supported — falling back to SW');
    return 'SW';
  }
}

/**
 * Debug logger — console only, no on-screen overlay
 */
export function logDebug(msg: string) {
  console.log(`[DRM] ${msg}`);
}

export function useDrm() {
  const configRef = useRef<DrmConfig | null>(null);

  const setup = useCallback(async (options: UseDrmOptions, videoTrackConfig?: TrackConfig) => {
    if (!options.videoElement) return null;

    // Get encryption keys from environment variables (DRMtoday configuration)
    const keyIdHex = import.meta.env.VITE_DRM_KEY_ID;
    const ivHex = import.meta.env.VITE_DRM_IV;
    const merchantId = import.meta.env.VITE_DRM_MERCHANT;
    const secretHex = import.meta.env.VITE_DRM_SECRET;

    // Validate keys before conversion
    if (!validateDrmKey(keyIdHex, 16)) {
      console.error('[DRM] Invalid VITE_DRM_KEY_ID format:', keyIdHex);
    }
    if (!validateDrmKey(ivHex, 16)) {
      console.error('[DRM] Invalid VITE_DRM_IV format:', ivHex);
    }

    // Convert hex strings to Uint8Arrays
    const keyId = options.keyId || hexToUint8Array(keyIdHex);
    const iv = options.iv || hexToUint8Array(ivHex);
    const secret = hexToUint8Array(secretHex);

    // Detect platform and robustness
    const { isAndroid, platform } = detectPlatform();
    logDebug(`Platform detected: ${platform} (isAndroid=${isAndroid})`);

    // Allow URL param override: ?robustness=HW or ?robustness=SW
    const params = new URLSearchParams(window.location.search);
    const robustnessOverride = params.get('robustness')?.toUpperCase() as 'HW' | 'SW' | null;

    let androidRobustness: 'HW' | 'SW' = 'SW';
    if (isAndroid) {
      androidRobustness = await detectAndroidRobustness();
    }

    // Apply override if provided
    if (robustnessOverride === 'HW' || robustnessOverride === 'SW') {
      androidRobustness = robustnessOverride;
      logDebug(`Robustness overridden via URL param: ${robustnessOverride}`);
    }

    // Determine media buffer size
    let mediaBufferMs = options.mediaBufferMs || -1;
    // Widevine L1 (HW) requires a larger buffer
    if (isAndroid && androidRobustness === 'HW' && mediaBufferMs < 600) {
      mediaBufferMs = 1200;
      logDebug(`Increased mediaBufferMs to ${mediaBufferMs} for Android HW robustness`);
    }

    // Encryption mode MUST match the sender
    const encryptionMode = options.encryptionMode || 'cbcs';
    
    // CRT (Customer Rights Token) configuration
    const crt = {
      profile: { purchase: {} },
      assetId: "test-key",
      outputProtection: {
        digital: true,
        analogue: true,
        enforce: false   // disable on Android where HDCP may not be available
      },
      storeLicense: true
    };

    // Generate authentication token
    const authToken = await generateAuthToken(
      options.merchant || merchantId,
      secret,
      crt
    );
    logDebug(`Generated auth token (first 20 chars): ${authToken.substring(0, 20)}...`);

    // @ts-ignore: Accessing static properties via string index
    const env = rtcDrmEnvironments[options.environment || 'Staging'];

    const robustness: 'HW' | 'SW' = isAndroid ? androidRobustness : 'SW';
    
    const videoConfig: TrackConfig = videoTrackConfig || {
      codec: 'H264' as const,
      encryption: encryptionMode as 'cenc' | 'cbcs',
      keyId: keyId,
      iv: iv,
      robustness: robustness
    };

    const config: DrmConfig = {
      merchant: options.merchant || merchantId,
      authToken,
      environment: env,
      videoElement: options.videoElement,
      audioElement: options.audioElement || undefined,
      // IMPORTANT: sessionId format must match DRMtoday expectations
      sessionId: `crtjson:${JSON.stringify(crt)}`,
      video: videoConfig,
      audio: { codec: 'opus' as const, encryption: 'clear' as const },
      logLevel: 3,
      mediaBufferMs
    };

    logDebug(`DRM config: isAndroid=${isAndroid}, encryption=${encryptionMode}, robustness=${videoConfig.robustness}, mediaBufferMs=${mediaBufferMs}`);
    logDebug(`CRT: ${JSON.stringify(crt)}`);

    configRef.current = config;

    // Attach error listener for debugging
    const onDrmError = (e: Event) => {
      const errorMsg = (e as CustomEvent).detail?.message || 'Unknown DRM error';
      logDebug(`DRM ERROR: ${errorMsg}`);
      console.error('[DRM-HOOK] DRM Error Event:', (e as CustomEvent).detail);
    };
    options.videoElement.removeEventListener('rtcdrmerror', onDrmError);
    options.videoElement.addEventListener('rtcdrmerror', onDrmError);

    // Add diagnostic video/audio element event listeners
    const videoElement = options.videoElement;
    const audioElement = options.audioElement;
    
    for (const evName of ['loadedmetadata', 'loadeddata', 'canplay', 'playing', 'waiting', 'stalled', 'error', 'emptied', 'suspend']) {
      videoElement.addEventListener(evName, () => logDebug(`video event: ${evName}`));
      if (audioElement) {
        audioElement.addEventListener(evName, () => logDebug(`audio event: ${evName}`));
      }
    }
    videoElement.addEventListener('error', () => {
      const e = videoElement.error;
      logDebug(`video MediaError: code=${e?.code}, message=${e?.message}`);
    });

    try {
      rtcDrmConfigure(config);
      logDebug('rtcDrmConfigure succeeded');
    } catch (err: any) {
      logDebug(`rtcDrmConfigure FAILED: ${err.message}`);
      console.error('[DRM-HOOK] rtcDrmConfigure failed:', err);
      throw err;
    }

    return config;
  }, []);

  const handleTrack = useCallback((event: RTCTrackEvent) => {
    logDebug(`Track received: ${event.track.kind}`);
    if (configRef.current) {
      try {
        // Call rtcDrmOnTrack - it uses the config from rtcDrmConfigure
        rtcDrmOnTrack(event, configRef.current);
        
        // After the DRM library processes the track, try to start playback
        const videoElement = configRef.current.videoElement;
        const audioElement = configRef.current.audioElement;
        
        if (event.track.kind === 'video' && videoElement) {
          const playPromise = videoElement.play();
          if (playPromise !== undefined) {
            playPromise
              .then(() => logDebug('videoElement.play() resolved'))
              .catch(err => {
                // Only log non-abort errors  
                if (err.name !== 'AbortError') {
                  logDebug(`videoElement.play() rejected: ${err.message}`);
                }
              });
          }
        } else if (event.track.kind === 'audio' && audioElement) {
          const playPromise = (audioElement as HTMLAudioElement).play();
          if (playPromise !== undefined) {
            playPromise
              .then(() => logDebug('audioElement.play() resolved'))
              .catch(err => {
                if (err.name !== 'AbortError') {
                  logDebug(`audioElement.play() rejected: ${err.message}`);
                }
              });
          }
        }
      } catch (err: any) {
        logDebug(`rtcDrmOnTrack FAILED: ${err.message}`);
        console.error('[DRM-HOOK] rtcDrmOnTrack failed:', err);
        throw err;
      }
    }
  }, []);

  return {
    setup,
    handleTrack,
    config: configRef.current
  };
}