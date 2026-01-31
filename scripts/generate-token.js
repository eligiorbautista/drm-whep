import { SignJWT } from 'jose';

// Default test secret from the integration guide.
// Uses VITE_DRM_SECRET from .env if available.
const secretKey = process.env.VITE_DRM_SECRET;
const merchant = process.env.VITE_DRM_MERCHANT;
const secret = new TextEncoder().encode(secretKey);

async function generate() {
  const optData = { merchant };
  // Asset ID 'poc' is commonly used for testing. Change if needed.
  const crt = [{ 
    assetId: 'poc', 
    storeLicense: true,
    profile: { purchase: {} },
    outputProtection: {
      digital: true,
      analogue: true,
      enforce: false
    }
  }];
  
  try {
    const jwt = await new SignJWT({
      optData: JSON.stringify(optData),
      crt: JSON.stringify(crt)
    })
    .setProtectedHeader({ alg: 'HS512' })
    .setIssuedAt()
    .setJti(Math.random().toString(36).substring(2))
    .sign(secret);

    console.log('\nGenerated DRM Token:');
    console.log('----------------------------------------');
    console.log(jwt);
    console.log('----------------------------------------');
    console.log('\nUse this token in the "DRM Token" field of the player.');
  } catch (err) {
    console.error('Error generating token:', err);
  }
}

generate();
