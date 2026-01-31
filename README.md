# Embeddable Secure Player

A React-based embeddable player component that supports secure live streaming via WebRTC (WHIP/WHEP) and integrates CastLabs DRM.

## Features

- **WHEP Playback:** Low-latency streaming via WebRTC.
- **DRM Integration:** Built-in support for CastLabs DRM decryption using `rtc-drm-transform`.
- **Embeddable:** Available as a standalone Iframe page or a React component.
- **Customizable:** Configurable via URL parameters or Props.

## Running Locally

1.  Install dependencies:
    ```bash
    npm install
    ```

2.  Start the development server:
    ```bash
    npm run dev
    ```

3.  Access the demo:
    -   **Main App:** `http://localhost:5173/`
    -   **Embed Page:** `http://localhost:5173/embed.html`

## Integration Guide

### Option 1: Iframe Embedding (Recommended for non-React apps)

You can embed the player into any website using an `<iframe>`. The player is configured via URL query parameters.

**Base URL:** `/embed.html`

**Query Parameters:**

| Parameter   | Type     | Required | Description |
| ----------- | -------- | -------- | ----------- |
| `endpoint`  | String   | **Yes**  | The WHEP playback URL (e.g., `https://your-stream.com/whep`). |
| `merchant`  | String   | **Yes**  | Your CastLabs Merchant ID (default: `sb_live`). |
| `encrypted` | Boolean  | No       | Set to `true` if the stream is DRM-protected. Default: `false`. |
| `token`     | String   | No       | The DRM authentication token (JWT). Required if `encrypted=true`. |

**Example:**

```html
<iframe
  src="https://your-player-domain.com/embed.html?endpoint=https://stream.com/whep&merchant=sb_live&encrypted=true&token=eyJ..."
  width="100%"
  height="500px"
  frameborder="0"
  allow="autoplay; encrypted-media; fullscreen"
  allowfullscreen
></iframe>
```

### Option 2: React Component

If you are building a React application, you can import the `Player` component directly.

**Installation:**
Ensure you have the necessary peer dependencies installed (`react`, `react-dom`). This package is currently designed to be part of the monorepo, but can be extracted.

**Usage:**

```tsx
import { Player } from './components/Player';

function App() {
  return (
    <div className="my-player-container">
      <Player
        endpoint="https://your-stream.com/whep"
        merchant="sb_live"
        encrypted={true}
        token="your-drm-token"
      />
    </div>
  );
}
```

**Props:**

| Prop        | Type     | Required | Description |
| ----------- | -------- | -------- | ----------- |
| `endpoint`  | string   | **Yes**  | The WHEP playback URL. |
| `merchant`  | string   | **Yes**  | Your CastLabs Merchant ID. |
| `encrypted` | boolean  | No       | Enable DRM decryption. |
| `token`     | string   | No       | DRM token. |

## Building for Production

To build the project for deployment (generates static files in `dist/`):

```bash
npm run build
```

The `dist/` folder will contain:
- `index.html` (Main App)
- `embed.html` (Standalone Embed Page)
- Assets (JS/CSS)

Deploy the contents of `dist/` to any static file server (Vercel, Netlify, S3, Nginx).