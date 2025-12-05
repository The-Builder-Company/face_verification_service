

export interface TokenPayload {
  user_id: number;
  phone?: string;
  email?: string;
  kyc_id?: number;
  callback_url?: string;
  exp?: number;
  iat?: number;
  // Additional fields that might be in the Dollr auth token
  sub?: string;
  aud?: string;
}

/**
 * Decode a JWT token to extract payload
 * Token validity is verified by the Dollr API when used as Bearer auth
 */
export function decodeToken(token: string): TokenPayload | null {
  try {
    // JWT format: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.error('Invalid JWT format');
      return null;
    }

    // Decode the payload (second part)
    const payload = parts[1];
    // Handle base64url encoding
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );

    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Failed to decode token:', error);
    return null;
  }
}

/**
 * Check if a token is expired
 */
export function isTokenExpired(payload: TokenPayload): boolean {
  if (!payload.exp) {
    // No expiry set, consider it valid
    return false;
  }
  
  // exp is in seconds, Date.now() is in milliseconds
  const expiryTime = payload.exp * 1000;
  return Date.now() > expiryTime;
}

/**
 * Extract user ID from token
 * Handles different possible field names
 */
export function getUserIdFromToken(payload: TokenPayload): number | null {
  // Try different possible field names
  if (payload.user_id) {
    return payload.user_id;
  }
  
  // Some tokens might use 'sub' as user identifier
  if (payload.sub && !isNaN(Number(payload.sub))) {
    return Number(payload.sub);
  }
  
  return null;
}

/**
 * Validate token and extract user context
 * Token validity is verified by Dollr API when used as Bearer auth
 */
export function validateAndExtractToken(token: string): {
  valid: boolean;
  payload?: TokenPayload;
  userId?: number;
  error?: string;
} {
  const payload = decodeToken(token);
  
  if (!payload) {
    return { valid: false, error: 'Invalid token format' };
  }
  
  if (isTokenExpired(payload)) {
    return { valid: false, error: 'Token has expired' };
  }
  
  const userId = getUserIdFromToken(payload);
  if (!userId) {
    return { valid: false, error: 'No user ID found in token' };
  }
  
  return {
    valid: true,
    payload,
    userId,
  };
}
