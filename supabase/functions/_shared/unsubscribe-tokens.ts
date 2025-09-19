export interface UnsubscribeToken {
  userId: string;
  email: string;
  cadence: string;
  timestamp: number;
}

// Utility functions for token management using Web Crypto API
export async function generateUnsubscribeToken(userId: string, email: string, cadence: string): Promise<string> {
  const secretKey = Deno.env.get('UNSUBSCRIBE_SECRET') || 'fallback-secret-key';
  const timestamp = Date.now();
  
  const payload = JSON.stringify({ userId, email, cadence, timestamp });
  const encoder = new TextEncoder();
  
  // Import the secret key
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  // Create HMAC signature
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const signature = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  // Combine payload and signature
  const token = btoa(payload) + '.' + signature;
  return token;
}

export async function verifyUnsubscribeToken(token: string): Promise<UnsubscribeToken | null> {
  try {
    const secretKey = Deno.env.get('UNSUBSCRIBE_SECRET') || 'fallback-secret-key';
    const [encodedPayload, signature] = token.split('.');
    
    if (!encodedPayload || !signature) {
      return null;
    }
    
    const payload = atob(encodedPayload);
    const encoder = new TextEncoder();
    
    // Import the secret key
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secretKey),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    // Verify signature
    const expectedSignatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    const expectedSignature = Array.from(new Uint8Array(expectedSignatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
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