import { useEffect, useState } from 'react';
import { Player } from './Player';

export const EmbedApp = () => {
  const [params, setParams] = useState<any>(null);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const parsedParams = {
      endpoint: searchParams.get('endpoint') || '',
      merchant: searchParams.get('merchant') || 'sb_live',
      token: searchParams.get('token') || undefined,
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
        token={params.token}
        encrypted={params.encrypted}
      />
    </div>
  );
};