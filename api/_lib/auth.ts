import type { VercelRequest } from '@vercel/node';
import * as crypto from 'crypto';
import * as https from 'https';
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';

export interface AuthVerificationResult {
  authenticated: boolean;
  uid?: string;
  email?: string;
  error?: string;
  statusCode?: number;
}

// In-memory cache for Google public x509 certificates with TTL
interface CertCache {
  certs: Record<string, string>;
  expiresAt: number;
}

let googleCertCache: CertCache | null = null;
export const GOOGLE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

/**
 * Fetches and caches Google's public x509 certificates used to sign Firebase ID tokens.
 */
export async function getGooglePublicCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (googleCertCache && googleCertCache.expiresAt > now) {
    return googleCertCache.certs;
  }

  return new Promise((resolve, reject) => {
    https.get(GOOGLE_CERTS_URL, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            reject(new Error(`Failed to fetch Google certs: HTTP ${res.statusCode}`));
            return;
          }

          const certs = JSON.parse(data);

          // Parse Cache-Control header to respect Google's key rotation schedule
          let maxAgeSeconds = 21600; // default 6 hours
          const cacheControl = res.headers['cache-control'];
          if (cacheControl) {
            const match = cacheControl.match(/max-age=(\d+)/);
            if (match) {
              maxAgeSeconds = parseInt(match[1], 10);
            }
          }

          googleCertCache = {
            certs,
            expiresAt: Date.now() + maxAgeSeconds * 1000,
          };

          resolve(certs);
        } catch (e) {
          reject(e);
        }
      });
      res.on('error', reject);
    });
  });
}

/**
 * Helper to safely decode base64url encoded strings
 */
export function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * Safe singleton initialization for Firebase Admin SDK.
 *
 * Does not require committing or exposing service account secrets:
 * - If FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_PRIVATE_KEY is set in server env, uses it.
 * - Otherwise initializes with { projectId }, which is sufficient for official ID token verification.
 */
let adminApp: App | null = null;
let adminAuth: Auth | null = null;

export function getFirebaseAuth(projectId: string): Auth {
  if (adminAuth) {
    return adminAuth;
  }

  if (getApps().length > 0) {
    adminApp = getApps()[0];
    adminAuth = getAuth(adminApp);
    return adminAuth;
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  if (serviceAccountJson) {
    try {
      const parsed = JSON.parse(serviceAccountJson);
      adminApp = initializeApp({
        credential: cert(parsed),
        projectId,
      });
    } catch (err: any) {
      console.warn('[Auth] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY JSON. Initializing with projectId only:', err.message);
      adminApp = initializeApp({ projectId });
    }
  } else if (privateKey && clientEmail) {
    adminApp = initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
      projectId,
    });
  } else {
    adminApp = initializeApp({ projectId });
  }

  adminAuth = getAuth(adminApp);
  return adminAuth;
}

/**
 * Cryptographically verifies a Firebase Authentication ID Token according to RFC 7519
 * and official Firebase ID Token specifications:
 *
 * 1. Bearer format: "Bearer <token>".
 * 2. Header: alg must be 'RS256', non-empty kid corresponding to an active Google certificate.
 * 3. Expiration (exp): must be in the future.
 * 4. Issued At (iat): must be in the past (clock skew allowance: 5 mins).
 * 5. Authentication Time (auth_time): must be in the past (clock skew allowance: 5 mins).
 * 6. Audience (aud): must strictly match trusted server FIREBASE_PROJECT_ID.
 * 7. Issuer (iss): must strictly match "https://securetoken.google.com/<FIREBASE_PROJECT_ID>".
 * 8. Subject (sub): must be a non-empty string <= 128 characters.
 * 9. Cryptographic Signature: RS256 verified against Google's public x509 certs.
 *
 * Optional overrideCerts parameter is provided for deterministic cryptographic testing.
 */
export async function verifyFirebaseToken(
  req: VercelRequest,
  customToken?: string,
  overrideCerts?: Record<string, string>
): Promise<AuthVerificationResult> {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  let token = customToken;

  if (!token) {
    if (!authHeader || typeof authHeader !== 'string') {
      // Anonymous request - permitted with lower rate limit tier
      return { authenticated: false };
    }

    const parts = authHeader.trim().split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      return {
        authenticated: false,
        error: 'Malformed Authorization header. Format must be "Bearer <id_token>".',
        statusCode: 401,
      };
    }
    token = parts[1];
  }

  // Token must consist of 3 dot-separated base64url segments
  const segments = token.split('.');
  if (segments.length !== 3) {
    return {
      authenticated: false,
      error: 'Malformed JWT: Token must consist of 3 dot-separated base64url segments.',
      statusCode: 401,
    };
  }

  const [headerSegment, payloadSegment, signatureSegment] = segments;

  // 1. Header Validation: alg must be RS256, kid must be present
  let header: { alg?: string; kid?: string };
  try {
    header = JSON.parse(base64UrlDecode(headerSegment));
  } catch {
    return {
      authenticated: false,
      error: 'Malformed JWT Header: Invalid JSON format.',
      statusCode: 401,
    };
  }

  if (header.alg !== 'RS256') {
    return {
      authenticated: false,
      error: `Invalid algorithm: Expected RS256 but received "${header.alg}".`,
      statusCode: 401,
    };
  }

  if (!header.kid || typeof header.kid !== 'string' || header.kid.trim().length === 0) {
    return {
      authenticated: false,
      error: 'Invalid JWT Header: Missing "kid" (Key Identifier).',
      statusCode: 401,
    };
  }

  // 2. Payload Parsing
  let payload: any;
  try {
    payload = JSON.parse(base64UrlDecode(payloadSegment));
  } catch {
    return {
      authenticated: false,
      error: 'Malformed JWT Payload: Invalid JSON format.',
      statusCode: 401,
    };
  }

  const nowSeconds = Math.floor(Date.now() / 1000);

  // 3. Expiration Check (exp)
  if (typeof payload.exp !== 'number' || payload.exp <= nowSeconds) {
    return {
      authenticated: false,
      error: 'Firebase ID token has expired. Please re-authenticate.',
      statusCode: 401,
    };
  }

  // 4. Issued At Check (iat) with 5-minute clock skew tolerance
  if (typeof payload.iat !== 'number' || payload.iat > nowSeconds + 300 || payload.iat <= 0) {
    return {
      authenticated: false,
      error: 'Token issue time is in the future or invalid.',
      statusCode: 401,
    };
  }

  // 5. Authentication Time Check (auth_time) with 5-minute clock skew tolerance
  if (
    typeof payload.auth_time !== 'number' ||
    payload.auth_time > nowSeconds + 300 ||
    payload.auth_time <= 0
  ) {
    return {
      authenticated: false,
      error: 'Invalid auth_time: Authentication time must be in the past.',
      statusCode: 401,
    };
  }

  // 6. Trusted Server Project ID, Audience (aud) & Issuer (iss) Check
  // The Firebase project ID must come strictly from server configuration, not from the incoming token.
  const expectedProjectId = process.env.FIREBASE_PROJECT_ID;
  if (!expectedProjectId) {
    return {
      authenticated: false,
      error: 'Server configuration error: FIREBASE_PROJECT_ID is not configured on the server.',
      statusCode: 401,
    };
  }

  const expectedIssuer = `https://securetoken.google.com/${expectedProjectId}`;
  if (payload.iss !== expectedIssuer) {
    return {
      authenticated: false,
      error: `Invalid token issuer: Expected "${expectedIssuer}" but received "${payload.iss}".`,
      statusCode: 401,
    };
  }

  if (payload.aud !== expectedProjectId) {
    return {
      authenticated: false,
      error: `Invalid token audience: Expected "${expectedProjectId}" but received "${payload.aud}".`,
      statusCode: 401,
    };
  }

  // 7. Subject Check (sub)
  const uid = payload.sub;
  if (!uid || typeof uid !== 'string' || uid.trim().length === 0 || uid.length > 128) {
    return {
      authenticated: false,
      error: 'Token is missing a valid subject ("sub"). Must be a non-empty string up to 128 characters.',
      statusCode: 401,
    };
  }

  // 8. Cryptographic Signature Verification
  // If overrideCerts is provided (for isolated cryptographic testing), verify directly against those certs
  if (overrideCerts) {
    const cert = overrideCerts[header.kid];
    if (!cert) {
      return {
        authenticated: false,
        error: `Invalid key identifier: "kid" "${header.kid}" was not found in active certificates.`,
        statusCode: 401,
      };
    }

    const dataToVerify = `${headerSegment}.${payloadSegment}`;
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(dataToVerify);
    verifier.end();

    const isSignatureValid = verifier.verify(cert, signatureSegment, 'base64url');
    if (!isSignatureValid) {
      return {
        authenticated: false,
        error: 'Cryptographic signature verification failed: The token signature does not match public key.',
        statusCode: 401,
      };
    }

    return {
      authenticated: true,
      uid,
      email: payload.email,
    };
  }

  // Official Firebase Admin SDK Verification Engine
  try {
    const auth = getFirebaseAuth(expectedProjectId);
    const decoded = await auth.verifyIdToken(token);

    const maskedUid = decoded.uid.slice(0, 4) + '...' + decoded.uid.slice(-4);
    console.log(`[Auth] Firebase Admin SDK cryptographically verified token for UID: ${maskedUid}`);

    return {
      authenticated: true,
      uid: decoded.uid,
      email: decoded.email,
    };
  } catch (adminErr: any) {
    // Terminal rejection: If Admin SDK reports any token validation, claim, or signature failure,
    // immediately reject with HTTP 401. Never allow fallback for invalid tokens.
    if (
      adminErr.code?.startsWith('auth/') ||
      adminErr.name === 'FirebaseAuthError' ||
      adminErr.message?.toLowerCase().includes('token') ||
      adminErr.message?.toLowerCase().includes('signature') ||
      adminErr.message?.toLowerCase().includes('claim') ||
      adminErr.message?.toLowerCase().includes('expired')
    ) {
      return {
        authenticated: false,
        error: `Cryptographic verification failed: ${adminErr.message}`,
        statusCode: 401,
      };
    }

    // Direct x509 public key verification fallback (only for Admin SDK network/fetch infrastructure issues)
    try {
      const publicCerts = await getGooglePublicCerts();
      const cert = publicCerts[header.kid];

      if (!cert) {
        return {
          authenticated: false,
          error: `Invalid key identifier: "kid" "${header.kid}" was not found in Google active certificates.`,
          statusCode: 401,
        };
      }

      const dataToVerify = `${headerSegment}.${payloadSegment}`;
      const verifier = crypto.createVerify('RSA-SHA256');
      verifier.update(dataToVerify);
      verifier.end();

      const isSignatureValid = verifier.verify(cert, signatureSegment, 'base64url');
      if (!isSignatureValid) {
        return {
          authenticated: false,
          error: 'Cryptographic signature verification failed: The token signature does not match Google public key.',
          statusCode: 401,
        };
      }

      const maskedUid = uid.slice(0, 4) + '...' + uid.slice(-4);
      console.log(`[Auth] Directly cryptographically verified Firebase ID token for UID: ${maskedUid}`);

      return {
        authenticated: true,
        uid,
        email: payload.email,
      };
    } catch (certErr: any) {
      return {
        authenticated: false,
        error: `Cryptographic verification error: ${adminErr.message || certErr.message}`,
        statusCode: 401,
      };
    }
  }
}
