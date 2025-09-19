import { createHmac } from "https://deno.land/std@0.190.0/crypto/hmac.ts";

export interface UnsubscribeToken {
  userId: string;
  email: string;
  cadence: string;
  timestamp: number;
}

// Utility functions for token management
export function generateUnsubscribeToken(userId: string, email: string, cadence: string): string {
  const secretKey = Deno.env.get('UNSUBSCRIBE_SECRET') || 'fallback-secret-key';
  const timestamp = Date.now();
  
  const payload = JSON.stringify({ userId, email, cadence, timestamp });
  const encoder = new TextEncoder();
  const key = encoder.encode(secretKey);
  const data = encoder.encode(payload);
  
  // Create HMAC signature
  const signature = createHmac("sha256", key).update(data).toString();
  
  // Combine payload and signature
  const token = btoa(payload) + '.' + signature;
  return token;
}

export function verifyUnsubscribeToken(token: string): UnsubscribeToken | null {
  try {
    const secretKey = Deno.env.get('UNSUBSCRIBE_SECRET') || 'fallback-secret-key';
    const [encodedPayload, signature] = token.split('.');
    
    if (!encodedPayload || !signature) {
      return null;
    }
    
    const payload = atob(encodedPayload);
    const encoder = new TextEncoder();
    const key = encoder.encode(secretKey);
    const data = encoder.encode(payload);
    
    // Verify signature
    const expectedSignature = createHmac("sha256", key).update(data).toString();
    if (signature !== expectedSignature) {
      return null;
    }
    
    const tokenData: UnsubscribeToken = JSON.parse(payload);
    
    // Check if token is not expired (90 days)
    const expirationTime = 90 * 24 * 60 * 60 * 1000; // 90 days in ms
    if (Date.now() - tokenData.timestamp > expirationTime) {
      return null;
    }
    
    return tokenData;
  } catch (error) {
    console.error('Error verifying token:', error);
    return null;
  }
}