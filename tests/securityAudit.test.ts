import * as crypto from 'crypto';
import { checkRateLimit, resetInMemoryStore } from '../api/_lib/rateLimiter.js';
import { verifyFirebaseToken } from '../api/_lib/auth.js';
import { callGeminiApi, sanitizeApiKey } from '../api/_lib/geminiClient.js';

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

// =============================================================================
// SECTION 3: GEMINI API KEY VALIDATION & CREDENTIAL SECURITY TESTS
// =============================================================================
console.log('\n--- SECTION 3: GEMINI API KEY VALIDATION & CREDENTIAL SECURITY TESTS ---');

const originalFetchBeforeSection3 = globalThis.fetch;
const savedApiKey = process.env.GEMINI_API_KEY;

try {
  // Test 3.1: Missing API key
  delete process.env.GEMINI_API_KEY;
  let geminiFetchCalled = false;
  globalThis.fetch = async () => {
    geminiFetchCalled = true;
    return new Response('{}', { status: 200 });
  };

  const resMissingKey = await callGeminiApi('system prompt', 'user message');
  assert(
    resMissingKey.success === false && resMissingKey.error?.code === 'SERVER_KEY_MISSING',
    'Missing API key: Returns SERVER_KEY_MISSING error without network call'
  );
  assert(!geminiFetchCalled, 'Missing API key: Upstream fetch was not called');

  // Test 3.2: Empty / Whitespace-only API key
  process.env.GEMINI_API_KEY = '   ';
  geminiFetchCalled = false;
  const resEmptyKey = await callGeminiApi('system prompt', 'user message');
  assert(
    resEmptyKey.success === false && resEmptyKey.error?.code === 'SERVER_KEY_MISSING',
    'Empty/whitespace API key: Safely rejected with SERVER_KEY_MISSING'
  );
  assert(!geminiFetchCalled, 'Empty/whitespace API key: Upstream fetch was not called');

  // Test 3.3: Accidental surrounding quotes (single and double quotes)
  assert(sanitizeApiKey('"AIzaSyKey_Test"') === 'AIzaSyKey_Test', 'Sanitizer strips outer double quotes');
  assert(sanitizeApiKey("'AIzaSyKey_Test'") === 'AIzaSyKey_Test', 'Sanitizer strips outer single quotes');
  assert(sanitizeApiKey('  "AIzaSyKey_Padded"  ') === 'AIzaSyKey_Padded', 'Sanitizer strips outer quotes and trims');

  process.env.GEMINI_API_KEY = '"AIzaSy_QuotedCredential_123"';
  let capturedHeaderKey: string | null = null;
  globalThis.fetch = async (_url: RequestInfo | URL, init?: RequestInit) => {
    geminiFetchCalled = true;
    capturedHeaderKey = (init?.headers as Record<string, string>)?.[('x-goog-api-key')];
    return new Response(
      JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Response OK' }] } }] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };

  geminiFetchCalled = false;
  const resQuoted = await callGeminiApi('system prompt', 'user message');
  assert(resQuoted.success === true, 'Accidental surrounding quotes: Dispatches successfully');
  assert(capturedHeaderKey === 'AIzaSy_QuotedCredential_123', 'Accidental surrounding quotes: Stripped before transmission');

  // Test 3.4: Key starting with AIza but not AIzaSy
  process.env.GEMINI_API_KEY = 'AIzaNA_AlternativePrefixFormat_456';
  geminiFetchCalled = false;
  capturedHeaderKey = null;
  const resNonSy = await callGeminiApi('system prompt', 'user message');
  assert(resNonSy.success === true, 'Key with alternative prefix (AIza non-Sy): Dispatches successfully without client rejection');
  assert(capturedHeaderKey === 'AIzaNA_AlternativePrefixFormat_456', 'Key with alternative prefix: Sent to Google API');

  // Test 3.5: Google rejecting with HTTP 401 (Authentication failure)
  const invalidKeyAttempt = 'AIzaSy_InvalidKey_789';
  process.env.GEMINI_API_KEY = invalidKeyAttempt;
  globalThis.fetch = async () => {
    return new Response(
      JSON.stringify({ error: { code: 401, message: 'Request had invalid authentication credentials.', status: 'UNAUTHENTICATED' } }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  };

  const resRejected401 = await callGeminiApi('system prompt', 'user message');
  assert(resRejected401.success === false, 'Google rejecting key (HTTP 401): Returns success=false');
  assert(resRejected401.error?.code === 'INVALID_API_KEY', 'Google rejecting key (HTTP 401): Mapped to INVALID_API_KEY');
  assert(
    resRejected401.error?.error === 'Authentication failed with the Gemini API service. Please verify server credentials.',
    'Google rejecting key (HTTP 401): Returns safe error message'
  );
  assert(!JSON.stringify(resRejected401).includes(invalidKeyAttempt), 'Google rejecting key (HTTP 401): Never exposes credential in response');

  // Test 3.6: Google HTTP 400 with structured invalid API-key response
  globalThis.fetch = async () => {
    return new Response(
      JSON.stringify({
        error: {
          code: 400,
          message: 'API key not valid. Please pass a valid API key.',
          status: 'INVALID_ARGUMENT',
          details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'API_KEY_INVALID' }],
        },
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  };

  const resRejected400Key = await callGeminiApi('system prompt', 'user message');
  assert(resRejected400Key.success === false, 'Google HTTP 400 (API_KEY_INVALID): Returns success=false');
  assert(resRejected400Key.error?.code === 'INVALID_API_KEY', 'Google HTTP 400 (API_KEY_INVALID): Mapped to INVALID_API_KEY');
  assert(
    resRejected400Key.error?.error === 'Authentication failed with the Gemini API service. Please verify server credentials.',
    'Google HTTP 400 (API_KEY_INVALID): Returns safe auth error message'
  );

  // Test 3.7: Google HTTP 400 with generic invalid payload / parameters
  globalThis.fetch = async () => {
    return new Response(
      JSON.stringify({ error: { code: 400, message: 'Invalid JSON payload.', status: 'INVALID_ARGUMENT' } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  };

  const resRejected400Payload = await callGeminiApi('system prompt', 'user message');
  assert(resRejected400Payload.success === false, 'Google HTTP 400 (malformed payload): Returns success=false');
  assert(resRejected400Payload.error?.code === 'INVALID_PAYLOAD', 'Google HTTP 400 (malformed payload): Mapped to INVALID_PAYLOAD');
  assert(
    resRejected400Payload.error?.error === 'Invalid request sent to the Gemini API service. Please verify request parameters.',
    'Google HTTP 400 (malformed payload): Returns safe request-error message'
  );

  // Test 3.8: Google rejecting with HTTP 403 (Permission / Access denied)
  globalThis.fetch = async () => {
    return new Response(
      JSON.stringify({ error: { code: 403, message: 'The caller does not have permission.', status: 'PERMISSION_DENIED' } }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  };

  const resRejected403 = await callGeminiApi('system prompt', 'user message');
  assert(resRejected403.success === false, 'Google returning HTTP 403: Returns success=false');
  assert(resRejected403.error?.code === 'ACCESS_DENIED', 'Google returning HTTP 403: Mapped to ACCESS_DENIED');
  assert(
    resRejected403.error?.error === 'Access denied by Gemini API. Check API project permissions, API restrictions, or billing setup.',
    'Google returning HTTP 403: Returns safe access-denied message'
  );

  // Test 3.9: Network failure diagnostic metadata logging & secret redaction
  const originalWarn = console.warn;
  const loggedWarns: string[] = [];
  console.warn = (...args: any[]) => {
    loggedWarns.push(args.join(' '));
  };

  try {
    const sensitiveKey = 'AIzaSy_SecretDiagnosticKey_AuditSuite';
    process.env.GEMINI_API_KEY = sensitiveKey;
    const sensitiveRawMsg = 'ECONNREFUSED connect 127.0.0.1:443';

    globalThis.fetch = async () => {
      const netErr = new TypeError(sensitiveRawMsg);
      Object.assign(netErr, { code: 'ECONNREFUSED' });
      throw netErr;
    };

    const netRes = await callGeminiApi('system secret instruction', 'user secret query');
    assert(netRes.success === false && netRes.error?.code === 'SERVICE_UNAVAILABLE', 'Network failure: Classified as SERVICE_UNAVAILABLE');

    const netLog = loggedWarns.find((log) => log.includes('[GeminiClient] Network failure:'));
    assert(Boolean(netLog), 'Network failure: Emits sanitized diagnostic log in catch block');
    assert(
      Boolean(netLog?.includes('errorName=TypeError') && netLog?.includes('errorCode=ECONNREFUSED')),
      'Network failure: Log includes safe metadata (errorName, errorCode)'
    );

    const joinedLogs = loggedWarns.join('\n');
    assert(!joinedLogs.includes(sensitiveKey), 'Network failure: Never logs API key');
    assert(!joinedLogs.includes(sensitiveRawMsg), 'Network failure: Never logs raw exception message');
    assert(!joinedLogs.includes('system secret instruction'), 'Network failure: Never logs prompts');
  } finally {
    console.warn = originalWarn;
  }

  // Test 3.10: Malicious alphanumeric name & uppercase code fall back to allowlist defaults
  const loggedMaliciousAuditWarns: string[] = [];
  console.warn = (...args: any[]) => {
    loggedMaliciousAuditWarns.push(args.join(' '));
  };

  try {
    process.env.GEMINI_API_KEY = 'AIzaSy_SecretDiagnosticKey_AuditSuite';
    const sensitiveAlphanumericName = 'SensitiveTokenInErrorName'; // matches /^[A-Za-z][A-Za-z0-9]{0,39}$/
    const sensitiveUppercaseCode = 'SENSITIVE_AUDIT_CODE'; // matches /^[A-Z0-9_]{3,20}$/

    globalThis.fetch = async () => {
      const errWithBadProps = new Error('generic message');
      errWithBadProps.name = sensitiveAlphanumericName;
      (errWithBadProps as any).code = sensitiveUppercaseCode;
      throw errWithBadProps;
    };

    const resBadProps = await callGeminiApi('system prompt', 'user message');
    assert(resBadProps.success === false, 'Alphanumeric malicious values: Returns failure');

    const badPropsLog = loggedMaliciousAuditWarns.find((log) => log.includes('[GeminiClient] Network failure:'));
    assert(Boolean(badPropsLog), 'Alphanumeric malicious values: Emits diagnostic log');
    assert(Boolean(badPropsLog?.includes('errorName=Error')), 'Alphanumeric malicious name: Strictly falls back to errorName=Error');
    assert(Boolean(badPropsLog?.includes('errorCode=NETWORK_ERROR')), 'Uppercase malicious code: Strictly falls back to errorCode=NETWORK_ERROR');
    assert(!badPropsLog?.includes(sensitiveAlphanumericName), 'Alphanumeric malicious name: Never leaks into logs');
    assert(!badPropsLog?.includes(sensitiveUppercaseCode), 'Uppercase malicious code: Never leaks into logs');
  } finally {
    console.warn = originalWarn;
  }
} finally {
  // Reliable restoration of global fetch and environment
  globalThis.fetch = originalFetchBeforeSection3;
  if (savedApiKey !== undefined) {
    process.env.GEMINI_API_KEY = savedApiKey;
  } else {
    delete process.env.GEMINI_API_KEY;
  }
}

console.log('\n===============================================================');
console.log(`AUDIT RESULTS: ${testsPassed} PASSED, ${testsFailed} FAILED`);
console.log('===============================================================');

if (testsFailed > 0) {
  process.exit(1);
}
