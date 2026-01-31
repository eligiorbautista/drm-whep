import React, { useRef, useState, useEffect } from 'react';
import { useWhep } from '../hooks/useWhep';
import { useDrm } from '../hooks/useDrm';

export interface PlayerProps {
  endpoint: string;
  merchant: string;
  token?: string;
  encrypted?: boolean;
}

export const Player: React.FC<PlayerProps> = ({ endpoint, merchant, token, encrypted }) => {
  console.log('Player Props Endpoint:', endpoint);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { isConnected, isConnecting, error, connect, disconnect } = useWhep();
  const { setup, handleTrack } = useDrm();
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  const handleConnect = async () => {
    if (encrypted) {
      setup({ merchant, authToken: token, videoElement: videoRef.current });
    }
    
    await connect({
      endpoint,
      token,
      encrypted,
      onTrack: encrypted ? handleTrack : undefined
    }, videoRef.current);
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
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
                onClick={disconnect}
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