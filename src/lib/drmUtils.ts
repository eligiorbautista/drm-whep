/**
 * DRM Utility Functions
 * Helper functions for DRM key conversion and validation
 */

import * as jose from 'jose';

/**
 * Convert hex string to Uint8Array
 * @param hex - Hex string (e.g., "abcd1234...")
 * @returns Uint8Array of bytes
 */
export function hexToUint8Array(hex: string): Uint8Array {
    // Remove any spaces or separators
    const cleanHex = hex.replace(/[\s:-]/g, '');

    if (cleanHex.length % 2 !== 0) {
        throw new Error(`Invalid hex string length: ${cleanHex.length}. Must be even.`);
    }

    const bytes = [];
    for (let i = 0; i < cleanHex.length; i += 2) {
        bytes.push(parseInt(cleanHex.substr(i, 2), 16));
    }

    return new Uint8Array(bytes);
}

/**
 * Generate random string for JWT jti
 * @param minLength - Minimum length of the string
 * @returns Random string
 */
function generateRandomString(minLength: number = 16): string {
    let str = '';
    while (str.length < minLength) {
        str += Math.random().toString(36).substring(2);
    }
    return str;
}

/**
 * Generate DRMtoday authentication token (JWT)
 * @param merchant - DRMtoday merchant ID
 * @param secret - DRMtoday secret key (as Uint8Array)
 * @param crt - Customer Rights Token configuration
 * @returns JWT token string
 */
export async function generateAuthToken(
    merchant: string, 
    secret: Uint8Array, 
    crt: any
): Promise<string> {
    const optData = { 
        merchant: merchant, 
        userId: "elidev-test" 
    };

    const jwt = await new jose.SignJWT({
        optData: JSON.stringify(optData),
        crt: JSON.stringify(crt)
    })
        .setProtectedHeader({ 
            alg: 'HS512', 
            kid: '890c580d-4b51-4a71-b20e-5e126121bf4c' 
        })
        .setIssuedAt()
        .setJti(generateRandomString())
        .sign(secret);
    
    console.log('[DRM] Generated JWT:', jwt);
    return jwt;
}

/**
 * Convert Uint8Array to hex string
 * @param bytes - Uint8Array
 * @returns Hex string
 */
export function uint8ArrayToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Validate DRM key format
 * @param key - Key as hex string or Uint8Array
 * @param expectedLength - Expected byte length (default: 16)
 */
export function validateDrmKey(key: string | Uint8Array, expectedLength: number = 16): boolean {
    if (typeof key === 'string') {
        const cleanHex = key.replace(/[\s:-]/g, '');
        return cleanHex.length === expectedLength * 2 && /^[0-9a-fA-F]+$/.test(cleanHex);
    } else {
        return key.length === expectedLength;
    }
}
