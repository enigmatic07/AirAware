import * as crypto from 'crypto';
import { checkRateLimit, resetInMemoryStore } from '../api/_lib/rateLimiter.js';
import { verifyFirebaseToken } from '../api/_lib/auth.js';

console.log('===============================================================');
console.log('       AIRAWARE PRODUCTION SECURITY & AUDIT TEST SUITE         ');
console.log('===============================================================\n');

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    testsPassed++;
  } else {
    console.error(`[FAIL] ${message}`);
    testsFailed++;
  }
}

// =============================================================================
// SECTION 1: PRODUCTION RATE-LIMIT FAIL-CLOSED BEHAVIOR
// =============================================================================
console.log('--- SECTION 1: PRODUCTION RATE LIMITING & FAIL-CLOSED TESTS ---');

// Test 1.1: Redis configured and working
console.log('\n[Subtest 1.1] Redis configured and working:');
const originalFetch = globalThis.fetch;
try {
  // Mock successful Upstash REST API response
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    return new Response(JSON.stringify([{ result: [1, 24, Date.now() + 60000] }]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  process.env.NODE_ENV = 'production';
  process.env.UPSTASH_REDIS_REST_URL = 'https://mock-live.upstash.io';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'mock_valid_token_xyz';

  const workingRedisRes = await checkRateLimit('user_mock_working_1', false);
  assert(
    workingRedisRes.allowed === true && workingRedisRes.provider === 'upstash',
    'Redis configured and working: allows valid requests through Upstash distributed provider'
  );
  assert(
    workingRedisRes.limit === 25 && workingRedisRes.remaining >= 0,
    'Redis configured and working: returns accurate limits and remaining quota'
  );
} finally {
  globalThis.fetch = originalFetch;
}

// Test 1.2: Redis unavailable in production (Fail-Closed)
console.log('\n[Subtest 1.2] Redis unavailable in production:');
try {
  // Simulate network/service failure on Redis call
  globalThis.fetch = async (): Promise<Response> => {
    throw new Error('Connection refused: Upstash cluster unreachable');
  };

  process.env.NODE_ENV = 'production';
  process.env.UPSTASH_REDIS_REST_URL = 'https://broken-cluster.upstash.io';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'broken_token';

  const failingRedisRes = await checkRateLimit('user_failing_redis_1', false);
  assert(
    failingRedisRes.allowed === false,
    'Redis unavailable in production: Request is rejected (Fail-Closed)'
  );
  assert(
    failingRedisRes.statusCode === 503,
    'Redis unavailable in production: Responds with HTTP 503 Service Unavailable'
  );
  assert(
    failingRedisRes.provider !== 'in_memory_fallback',
    'Redis unavailable in production: Strictly never silently downgrades to in-memory fallback'
  );
} finally {
  globalThis.fetch = originalFetch;
}

// Test 1.3: Redis credentials missing in production (Fail-Closed)
console.log('\n[Subtest 1.3] Redis credentials missing in production:');
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
process.env.NODE_ENV = 'production';

const missingCredsRes = await checkRateLimit('user_missing_creds_1', false);
assert(
  missingCredsRes.allowed === false,
  'Redis credentials missing in production: Request is rejected (Fail-Closed)'
);
assert(
  missingCredsRes.statusCode === 503,
  'Redis credentials missing in production: Responds with HTTP 503'
);
assert(
  missingCredsRes.provider !== 'in_memory_fallback',
  'Redis credentials missing in production: Never downgrades to in-memory fallback'
);

// Test 1.4: In-memory fallback in development
console.log('\n[Subtest 1.4] In-memory fallback in development:');
process.env.NODE_ENV = 'development';
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
resetInMemoryStore();

const anonIp = '198.51.100.42';
let devAnonCount = 0;
for (let i = 1; i <= 25; i++) {
  const r = await checkRateLimit(`ip_${anonIp}`, false);
  if (r.allowed && r.provider === 'in_memory_fallback') devAnonCount++;
}
assert(
  devAnonCount === 25,
  'In-memory fallback in development: Permits up to 25 anonymous requests/min'
);

const devAnonOverLimit = await checkRateLimit(`ip_${anonIp}`, false);
assert(
  !devAnonOverLimit.allowed && devAnonOverLimit.statusCode === 429,
  'In-memory fallback in development: 26th request blocked with HTTP 429'
);

const authUid = 'user_dev_auth_1';
let devAuthCount = 0;
for (let i = 1; i <= 60; i++) {
  const r = await checkRateLimit(`auth_${authUid}`, true);
  if (r.allowed && r.provider === 'in_memory_fallback') devAuthCount++;
}
assert(
  devAuthCount === 60,
  'In-memory fallback in development: Permits up to 60 authenticated requests/min'
);

const devAuthOverLimit = await checkRateLimit(`auth_${authUid}`, true);
assert(
  !devAuthOverLimit.allowed && devAuthOverLimit.statusCode === 429,
  'In-memory fallback in development: 61st authenticated request blocked with HTTP 429'
);


// =============================================================================
// SECTION 2: FIREBASE AUTHENTICATION & CRYPTOGRAPHIC VERIFICATION
// =============================================================================
console.log('\n--- SECTION 2: FIREBASE TOKEN VERIFICATION TESTS ---');

// Generate an RSA 2048 keypair to test cryptographic RS256 signature verification
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

// Another keypair for forging signatures
const unauthorizedKeyPair = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const TEST_KID = 'active_test_signing_key_id';
const certMap: Record<string, string> = {
  [TEST_KID]: publicKey,
};

const TRUSTED_PROJECT_ID = 'airaware-production-proj';
process.env.FIREBASE_PROJECT_ID = TRUSTED_PROJECT_ID;

function createMockJwt(header: any, payload: any, signingKey: string) {
  const h = Buffer.from(JSON.stringify(header)).toString('base64url');
  const p = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(`${h}.${p}`);
  sign.end();
  const s = sign.sign(signingKey, 'base64url');
  return `${h}.${p}.${s}`;
}

const mockReq = (headerVal?: string): any => ({
  headers: headerVal ? { authorization: headerVal } : {},
});

// Test 2.1: Missing Authorization Header (Anonymous / Guest)
const resNoHeader = await verifyFirebaseToken(mockReq(undefined), undefined, certMap);
assert(
  !resNoHeader.authenticated && !resNoHeader.error,
  'Missing Authorization header: allows anonymous access (authenticated: false, no error)'
);

// Test 2.2: Malformed Authorization Header
const resMalformedHeader = await verifyFirebaseToken(mockReq('Basic xyz123'), undefined, certMap);
assert(
  !resMalformedHeader.authenticated && resMalformedHeader.statusCode === 401,
  'Malformed Authorization header ("Basic ..."): rejected with HTTP 401'
);

// Test 2.3: Malformed JWT Structure (Not 3 segments)
const resMalformedJwt = await verifyFirebaseToken(mockReq('Bearer not.three.parts.token.extra'), undefined, certMap);
assert(
  !resMalformedJwt.authenticated && resMalformedJwt.statusCode === 401,
  'Malformed JWT structure: rejected with HTTP 401'
);

// Test 2.4: Non-RS256 Algorithm (e.g., HS256)
const hs256Token = 'Bearer ' + Buffer.from(JSON.stringify({ alg: 'HS256', kid: TEST_KID })).toString('base64url') + '.eyJuYW1lIjoidGVzdCJ9.sig';
const resWrongAlg = await verifyFirebaseToken(mockReq(hs256Token), undefined, certMap);
assert(
  !resWrongAlg.authenticated && Boolean(resWrongAlg.error?.includes('RS256')),
  'Non-RS256 algorithm (HS256): rejected with HTTP 401'
);

// Test 2.5: Missing kid in header
const noKidToken = 'Bearer ' + Buffer.from(JSON.stringify({ alg: 'RS256' })).toString('base64url') + '.eyJuYW1lIjoidGVzdCJ9.sig';
const resNoKid = await verifyFirebaseToken(mockReq(noKidToken), undefined, certMap);
assert(
  !resNoKid.authenticated && Boolean(resNoKid.error?.includes('Missing "kid"')),
  'Missing "kid" in JWT header: rejected with HTTP 401'
);

// Test 2.6: Expired Token (exp)
const nowSeconds = Math.floor(Date.now() / 1000);
const expiredPayload = {
  sub: 'user_expired_1',
  user_id: 'user_expired_1',
  aud: TRUSTED_PROJECT_ID,
  iss: `https://securetoken.google.com/${TRUSTED_PROJECT_ID}`,
  exp: nowSeconds - 300, // Expired 5 minutes ago
  iat: nowSeconds - 3600,
  auth_time: nowSeconds - 3600,
};
const expiredToken = 'Bearer ' + createMockJwt({ alg: 'RS256', kid: TEST_KID }, expiredPayload, privateKey);
const resExpired = await verifyFirebaseToken(mockReq(expiredToken), undefined, certMap);
assert(
  !resExpired.authenticated && Boolean(resExpired.error?.includes('expired')),
  'Expired token (exp in past): rejected with HTTP 401'
);

// Test 2.7: Issued At (iat) in the future
const futureIatPayload = {
  sub: 'user_future_iat',
  aud: TRUSTED_PROJECT_ID,
  iss: `https://securetoken.google.com/${TRUSTED_PROJECT_ID}`,
  exp: nowSeconds + 7200,
  iat: nowSeconds + 3600, // 1 hour in future
  auth_time: nowSeconds - 60,
};
const futureIatToken = 'Bearer ' + createMockJwt({ alg: 'RS256', kid: TEST_KID }, futureIatPayload, privateKey);
const resFutureIat = await verifyFirebaseToken(mockReq(futureIatToken), undefined, certMap);
assert(
  !resFutureIat.authenticated && Boolean(resFutureIat.error?.includes('future')),
  'Token with future "iat": rejected with HTTP 401'
);

// Test 2.8: Authentication Time (auth_time) in the future
const futureAuthTimePayload = {
  sub: 'user_future_auth_time',
  aud: TRUSTED_PROJECT_ID,
  iss: `https://securetoken.google.com/${TRUSTED_PROJECT_ID}`,
  exp: nowSeconds + 3600,
  iat: nowSeconds - 10,
  auth_time: nowSeconds + 1800, // 30 minutes in future
};
const futureAuthTimeToken = 'Bearer ' + createMockJwt({ alg: 'RS256', kid: TEST_KID }, futureAuthTimePayload, privateKey);
const resFutureAuthTime = await verifyFirebaseToken(mockReq(futureAuthTimeToken), undefined, certMap);
assert(
  !resFutureAuthTime.authenticated && Boolean(resFutureAuthTime.error?.includes('auth_time')),
  'Token with future "auth_time": rejected with HTTP 401'
);

// Test 2.9: Wrong Project / Audience (aud)
const wrongProjectPayload = {
  sub: 'user_attacker_1',
  aud: 'malicious-foreign-project',
  iss: 'https://securetoken.google.com/malicious-foreign-project',
  exp: nowSeconds + 3600,
  iat: nowSeconds - 60,
  auth_time: nowSeconds - 60,
};
const wrongProjectToken = 'Bearer ' + createMockJwt({ alg: 'RS256', kid: TEST_KID }, wrongProjectPayload, privateKey);
const resWrongProject = await verifyFirebaseToken(mockReq(wrongProjectToken), undefined, certMap);
assert(
  !resWrongProject.authenticated && Boolean(resWrongProject.error?.includes('Invalid token')),
  'Token from different Firebase project: rejected with HTTP 401'
);

// Test 2.10: Empty subject (sub)
const emptySubPayload = {
  sub: '   ',
  aud: TRUSTED_PROJECT_ID,
  iss: `https://securetoken.google.com/${TRUSTED_PROJECT_ID}`,
  exp: nowSeconds + 3600,
  iat: nowSeconds - 60,
  auth_time: nowSeconds - 60,
};
const emptySubToken = 'Bearer ' + createMockJwt({ alg: 'RS256', kid: TEST_KID }, emptySubPayload, privateKey);
const resEmptySub = await verifyFirebaseToken(mockReq(emptySubToken), undefined, certMap);
assert(
  !resEmptySub.authenticated && Boolean(resEmptySub.error?.includes('subject')),
  'Token with empty subject ("sub"): rejected with HTTP 401'
);

// Test 2.11: Missing server configuration for FIREBASE_PROJECT_ID
delete process.env.FIREBASE_PROJECT_ID;
const validPayload = {
  sub: 'user_legit_100',
  aud: TRUSTED_PROJECT_ID,
  iss: `https://securetoken.google.com/${TRUSTED_PROJECT_ID}`,
  exp: nowSeconds + 3600,
  iat: nowSeconds - 60,
  auth_time: nowSeconds - 60,
  email: 'user@example.com',
};
const validToken = 'Bearer ' + createMockJwt({ alg: 'RS256', kid: TEST_KID }, validPayload, privateKey);
const resNoServerConfig = await verifyFirebaseToken(mockReq(validToken), undefined, certMap);
assert(
  !resNoServerConfig.authenticated && Boolean(resNoServerConfig.error?.includes('FIREBASE_PROJECT_ID is not configured')),
  'Missing server FIREBASE_PROJECT_ID: rejected with HTTP 401 (never trusts token claims)'
);

// Restore trusted project ID
process.env.FIREBASE_PROJECT_ID = TRUSTED_PROJECT_ID;

// Test 2.12: Cryptographic Signature - Untrusted Key / Invalid Signature
const forgedToken = 'Bearer ' + createMockJwt({ alg: 'RS256', kid: TEST_KID }, validPayload, unauthorizedKeyPair.privateKey);
const resForged = await verifyFirebaseToken(mockReq(forgedToken), undefined, certMap);
assert(
  !resForged.authenticated && Boolean(resForged.error?.includes('signature verification failed')),
  'Cryptographic signature check: Token signed by unauthorized key is strictly rejected with HTTP 401'
);

// Test 2.13: Cryptographic Signature - Valid Token
const resValid = await verifyFirebaseToken(mockReq(validToken), undefined, certMap);
assert(
  resValid.authenticated === true && resValid.uid === 'user_legit_100' && resValid.email === 'user@example.com',
  'Cryptographic signature check: Valid signed token with matching claims is authenticated successfully'
);

console.log('\n===============================================================');
console.log(`AUDIT RESULTS: ${testsPassed} PASSED, ${testsFailed} FAILED`);
console.log('===============================================================');

if (testsFailed > 0) {
  process.exit(1);
}
