import { useEffect, useState } from 'react';
import { Player } from './Player';

export const EmbedApp = () => {
  const [params, setParams] = useState<any>(null);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    
    // Get endpoint - can be full URL or relative path
    let endpoint = searchParams.get('endpoint') || '';
    
    // If endpoint is a relative path, prepend the domain
    if (endpoint && !endpoint.startsWith('http')) {
      const streamDomain = import.meta.env.VITE_CLOUDFLARE_STREAM_DOMAIN;
      endpoint = streamDomain + endpoint;
    }
    
    const parsedParams = {
      endpoint,
      merchant: searchParams.get('merchant') || import.meta.env.VITE_DRM_MERCHANT,
      encrypted: searchParams.get('encrypted') === 'true'
    };
    console.log('EmbedApp Parsed Params:', parsedParams);
    setParams(parsedParams);
  }, []);

  if (!params) return null;

  if (!params.endpoint) {
    return (
      <div className="w-full h-screen bg-black text-white flex items-center justify-center">
        <div className="p-4 bg-red-900/50 border border-red-500 rounded">
          <h2 className="font-bold">Error: Missing configuration</h2>
          <p className="text-sm">Please provide an 'endpoint' query parameter.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-black">
      <Player
        endpoint={params.endpoint}
        merchant={params.merchant}
        encrypted={params.encrypted}
      />
    </div>
  );
};