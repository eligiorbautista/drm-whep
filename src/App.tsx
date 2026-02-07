import { useState } from 'react'
import { Player } from './components/Player'
import './App.css'

function App() {
  const [encrypted, setEncrypted] = useState(false);
  const streamDomain = import.meta.env.VITE_CLOUDFLARE_STREAM_DOMAIN;
  const defaultPath = import.meta.env.VITE_WHEP_ENDPOINT_DEFAULT;
  const [endpoint, setEndpoint] = useState(streamDomain + defaultPath);
  const merchant = import.meta.env.VITE_DRM_MERCHANT;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8 flex flex-col items-center gap-8">
      <header className="text-center">
        <h1 className="text-4xl font-bold mb-2">Embeddable Player</h1>
        <p className="text-gray-400">WebRTC WHEP + CastLabs DRM Prototype</p>
      </header>

      <main className="w-full max-w-4xl">
        <Player
          endpoint={endpoint}
          merchant={merchant}
          encrypted={encrypted}
        />

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Controls Panel */}
          <div className="p-6 bg-gray-800 rounded-lg border border-gray-700">
            <h2 className="font-bold mb-4 text-xl border-b border-gray-700 pb-2">Viewer Settings</h2>

            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="endpoint-input" className="block text-sm font-medium text-gray-400">
                  WHEP Endpoint URL
                </label>
                <input
                  id="endpoint-input"
                  type="text"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-xs font-mono"
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="drm-toggle"
                  checked={encrypted}
                  onChange={(e) => setEncrypted(e.target.checked)}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 bg-gray-700 border-gray-600"
                />
                <label htmlFor="drm-toggle" className="font-medium cursor-pointer select-none">
                  Enable DRM Decryption
                </label>
              </div>

              {encrypted && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300 border-t border-gray-700 pt-4">
                  <div className="text-sm text-gray-400">
                    <p className="mb-1">✓ Encryption: <span className="text-green-400 font-mono">AES-CBC (cbcs)</span></p>
                    <p className="mb-1">✓ Keys: <span className="text-green-400">From .env file</span></p>
                    <p>✓ Token: <span className="text-green-400">Auto-generated</span></p>
                  </div>
                  <div className="text-xs text-gray-500 bg-gray-900 p-2 rounded">
                    DRM configuration matches whep sender settings
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Config Display */}
          <div className="p-6 bg-gray-800 rounded-lg border border-gray-700">
            <h2 className="font-bold mb-4 text-xl border-b border-gray-700 pb-2">Viewer Configuration</h2>
            <pre className="text-blue-400 text-sm overflow-x-auto whitespace-pre-wrap font-mono bg-black/30 p-4 rounded">
              {JSON.stringify({
                endpoint,
                merchant,
                encrypted,
                encryptionMode: encrypted ? 'cbcs' : undefined,
                keys: encrypted ? 'From .env' : undefined,
                token: encrypted ? 'Auto-generated' : undefined
              }, null, 2)}
            </pre>
          </div>
        </div>
      </main>

      <footer className="mt-auto text-gray-500 text-sm">
        Conductor Track: player_embed_20260131 (Enhanced)
      </footer>
    </div>
  )
}

export default App
