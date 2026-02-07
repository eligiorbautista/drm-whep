import React, { useRef, useState, useEffect } from 'react';
import { useWhep } from '../hooks/useWhep';
import { rtcDrmConfigure, rtcDrmOnTrack, rtcDrmEnvironments } from '../lib/rtc-drm-transform.min.js';
import { hexToUint8Array, generateAuthToken } from '../lib/drmUtils';

export interface PlayerProps {
  endpoint: string;
  merchant?: string;
  encrypted?: boolean;
}

function logDebug(msg: string) {
  console.log(`[DRM] ${msg}`);
}

export const Player: React.FC<PlayerProps> = ({ endpoint, merchant, encrypted }) => {
  console.log('Player Props Endpoint:', endpoint);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const { isConnected, isConnecting, error, connect, disconnect } = useWhep();
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
    }
  }, [isMuted]);

  const configureDrm = async (pc: RTCPeerConnection) => {
    const keyId = hexToUint8Array(import.meta.env.VITE_DRM_KEY_ID);
    const iv = hexToUint8Array(import.meta.env.VITE_DRM_IV);

    // Platform detection (same as whep)
    const uad = (navigator as any).userAgentData;
    const platform = uad?.platform || navigator.platform || '';
    const isMobile = uad?.mobile === true;
    const uaHasAndroid = /Android/i.test(navigator.userAgent);
    const isAndroid = platform.toLowerCase() === 'android' ||
                      uaHasAndroid ||
                      (isMobile && /linux/i.test(platform));
    
    const detectedPlatform = isAndroid ? 'Android' : (platform || 'Unknown');
    logDebug(`Platform detection: platform="${platform}", uad.mobile=${uad?.mobile}, uaHasAndroid=${uaHasAndroid}, isAndroid=${isAndroid}`);
    logDebug(`Detected platform: ${detectedPlatform}`);

    const params = new URLSearchParams(window.location.search);
    const robustnessOverride = params.get('robustness')?.toUpperCase();

    let androidRobustness = 'SW';
    if (isAndroid) {
      try {
        await navigator.requestMediaKeySystemAccess('com.widevine.alpha', [{
          initDataTypes: ['cenc'],
          videoCapabilities: [{
            contentType: 'video/mp4; codecs="avc1.42E01E"',
            robustness: 'HW_SECURE_ALL'
          }]
        }]);
        androidRobustness = 'HW';
        logDebug('Widevine L1 (HW_SECURE_ALL) is supported on this device');
      } catch {
        logDebug('Widevine L1 (HW) NOT supported — falling back to SW');
        androidRobustness = 'SW';
      }
    }

    if (robustnessOverride === 'HW' || robustnessOverride === 'SW') {
      androidRobustness = robustnessOverride;
      logDebug(`Robustness overridden via URL param: ${robustnessOverride}`);
    }

    let mediaBufferMs = -1;
    if (isAndroid && androidRobustness === 'HW' && mediaBufferMs < 600)
      mediaBufferMs = 1200;

    const video = {
      codec: 'H264' as const,
      encryption: 'cbcs' as const,
      robustness: (isAndroid ? androidRobustness : 'SW') as 'HW' | 'SW',
      keyId,
      iv
    };

    const crt = {
      profile: { purchase: {} },
      assetId: "test-key",
      outputProtection: {
        digital: true,
        analogue: true,
        enforce: false
      },
      storeLicense: true
    };

    const authToken = await generateAuthToken(
      merchant || import.meta.env.VITE_DRM_MERCHANT,
      hexToUint8Array(import.meta.env.VITE_DRM_SECRET),
      crt
    );

    const videoElement = videoRef.current!;
    const audioElement = audioRef.current!;

    const drmConfig = {
      merchant: merchant || import.meta.env.VITE_DRM_MERCHANT,
      environment: rtcDrmEnvironments.Staging,
      videoElement,
      audioElement,
      sessionId: `crtjson:${JSON.stringify(crt)}`,
      authToken,
      video,
      audio: { codec: 'opus' as const, encryption: 'clear' as const },
      logLevel: 3,
      mediaBufferMs
    };

    // Event listeners (same as whep)
    for (const evName of ['loadedmetadata', 'loadeddata', 'canplay', 'playing', 'waiting', 'stalled', 'error', 'emptied', 'suspend']) {
      videoElement.addEventListener(evName, () => logDebug(`video event: ${evName}`));
      audioElement.addEventListener(evName, () => logDebug(`audio event: ${evName}`));
    }
    videoElement.addEventListener('error', () => {
      const e = videoElement.error;
      logDebug(`video MediaError: code=${e?.code}, message=${e?.message}`);
    });

    videoElement.addEventListener('rtcdrmerror', (event: any) => {
      logDebug(`DRM ERROR: ${event.detail.message}`);
      alert(`DRM error: ${event.detail.message}`);
    });

    logDebug(`DRM config: isAndroid=${isAndroid}, encryption=${video.encryption}, robustness=${video.robustness}, mediaBufferMs=${mediaBufferMs}`);
    logDebug(`CRT: ${JSON.stringify(crt)}`);

    try {
      rtcDrmConfigure(drmConfig);
      logDebug('rtcDrmConfigure succeeded');
    } catch (err: any) {
      logDebug(`rtcDrmConfigure FAILED: ${err.message}`);
      throw err;
    }

    pc.addEventListener('track', (event) => {
      logDebug(`Track received: ${event.track.kind}`);
      try {
        rtcDrmOnTrack(event, drmConfig);
        logDebug(`rtcDrmOnTrack succeeded for ${event.track.kind}`);
        // Don't call play() here — the autoPlay attribute on the <video>/<audio>
        // elements handles playback start. Calling play() immediately races with
        // the DRM library's internal MediaSource setup, causing
        // "interrupted by new load request" errors.
      } catch (err: any) {
        logDebug(`rtcDrmOnTrack FAILED: ${err.message}`);
        alert(`rtcDrmOnTrack failed with: ${err.message}`);
      }
    });
  };

  const handleConnect = async () => {
    await connect({
      endpoint,
      encrypted,
      configureDrm: encrypted ? configureDrm : undefined
    }, videoRef.current, audioRef.current);
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
    }
  };

  return (
    <div className="relative group bg-black rounded-lg overflow-hidden w-full aspect-video">
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        autoPlay
        playsInline
        muted={isMuted}
      />
      {/* Hidden audio element for DRM (required by rtc-drm-transform library) */}
      <audio
        ref={audioRef}
        autoPlay
        playsInline
        muted={isMuted}
        style={{ display: 'none' }}
      />
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
          <div className="p-6 bg-red-900/90 border border-red-500 rounded-lg text-center max-w-sm mx-4 backdrop-blur-sm">
            <svg className="w-12 h-12 text-red-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h3 className="text-white font-bold text-lg mb-2">Connection Error</h3>
            <p className="text-red-100 text-sm mb-4">{error}</p>
            <button 
              onClick={handleConnect}
              className="px-4 py-2 bg-white text-red-900 hover:bg-gray-100 font-semibold rounded transition-colors shadow-lg"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {isConnecting && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10 pointer-events-none">
          <div className="flex flex-col items-center">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
            <span className="text-white font-medium text-shadow">Connecting...</span>
          </div>
        </div>
      )}
      
      {/* Controls Bar - Always visible if not connected or error, otherwise hover */}
      <div className={`absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent transition-opacity duration-300 ${isConnected ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {!isConnected ? (
              <button
                onClick={handleConnect}
                disabled={isConnecting}
                className={`px-4 py-2 text-white rounded font-medium transition-all shadow-lg ${
                  isConnecting 
                    ? 'bg-gray-600 cursor-not-allowed opacity-75' 
                    : 'bg-blue-600 hover:bg-blue-500 hover:scale-105 active:scale-95'
                }`}
              >
                {isConnecting ? 'Connecting...' : 'Connect'}
              </button>
            ) : (
              <button
                onClick={() => disconnect()}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded font-medium transition-all shadow-lg hover:scale-105 active:scale-95"
              >
                Disconnect
              </button>
            )}
            
            <div className="flex items-center gap-2 bg-black/30 px-3 py-1 rounded-full backdrop-blur-sm border border-white/10">
              <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-gray-500'}`}></span>
              <span className="text-white text-sm font-medium tracking-wide">
                {isConnected ? 'LIVE' : 'OFFLINE'}
              </span>
            </div>
          </div>
          
          <button
            onClick={toggleMute}
            className="p-2 text-white hover:bg-white/20 rounded-full transition-colors"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clipRule="evenodd" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};