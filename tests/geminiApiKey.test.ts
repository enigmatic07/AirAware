import { callGeminiApi, sanitizeApiKey } from '../api/_lib/geminiClient.js';

console.log('===============================================================');
console.log('       AIRAWARE GEMINI API KEY VALIDATION REGRESSION SUITE     ');
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

const originalEnvKey = process.env.GEMINI_API_KEY;
const originalFetch = globalThis.fetch;

try {
  // ---------------------------------------------------------------------------
  // 1. UNIT TESTS: sanitizeApiKey helper
  // ---------------------------------------------------------------------------
  console.log('--- 1. UNIT SANITIZATION TESTS ---');
  assert(sanitizeApiKey(undefined) === undefined, 'sanitizeApiKey(undefined) returns undefined');
  assert(sanitizeApiKey('') === undefined, 'sanitizeApiKey("") returns undefined');
  assert(sanitizeApiKey('   ') === undefined, 'sanitizeApiKey("   ") returns undefined');
  assert(sanitizeApiKey('""') === undefined, 'sanitizeApiKey(\'""\') returns undefined');
  assert(sanitizeApiKey("''") === undefined, 'sanitizeApiKey("\'\'") returns undefined');
  assert(sanitizeApiKey('"   "') === undefined, 'sanitizeApiKey(\'"   "\') returns undefined');
  assert(sanitizeApiKey('AIzaSyValidKey') === 'AIzaSyValidKey', 'Preserves unquoted AIzaSy key');
  assert(sanitizeApiKey('  AIzaSyValidKey  ') === 'AIzaSyValidKey', 'Trims whitespace around unquoted key');
  assert(sanitizeApiKey('"AIzaSyQuotedKey"') === 'AIzaSyQuotedKey', 'Strips surrounding double quotes');
  assert(sanitizeApiKey("'AIzaSySingleQuotedKey'") === 'AIzaSySingleQuotedKey', 'Strips surrounding single quotes');
  assert(sanitizeApiKey('  "AIzaSyPaddedQuotedKey"  ') === 'AIzaSyPaddedQuotedKey', 'Strips quotes with outer padding');
  assert(sanitizeApiKey('  "  AIzaSyInnerPadding  "  ') === 'AIzaSyInnerPadding', 'Strips quotes and inner padding');
  assert(sanitizeApiKey('AIzaNonSyKey123') === 'AIzaNonSyKey123', 'Accepts key starting with AIza but not AIzaSy');

  // ---------------------------------------------------------------------------
  // 2. REGRESSION TESTS: callGeminiApi with mocked fetch
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. REGRESSION TESTS: callGeminiApi ---');

  // Subtest 2.1: Missing API key
  delete process.env.GEMINI_API_KEY;
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    return new Response('{}', { status: 200 });
  };

  const missingRes = await callGeminiApi('system prompt', 'user message');
  assert(
    missingRes.success === false && missingRes.error?.code === 'SERVER_KEY_MISSING',
    'Missing API key: Returns SERVER_KEY_MISSING error'
  );
  assert(
    missingRes.error?.error.includes('GEMINI_API_KEY is not configured'),
    'Missing API key: Returns clear safe error message'
  );
  assert(!fetchCalled, 'Missing API key: Fetch was never called');

  // Subtest 2.2: Empty API key (whitespace or empty quotes)
  process.env.GEMINI_API_KEY = '   ';
  fetchCalled = false;
  const emptyRes1 = await callGeminiApi('system prompt', 'user message');
  assert(
    emptyRes1.success === false && emptyRes1.error?.code === 'SERVER_KEY_MISSING',
    'Whitespace-only API key: Returns SERVER_KEY_MISSING error'
  );
  assert(!fetchCalled, 'Whitespace-only API key: Fetch was never called');

  process.env.GEMINI_API_KEY = '""';
  fetchCalled = false;
  const emptyRes2 = await callGeminiApi('system prompt', 'user message');
  assert(
    emptyRes2.success === false && emptyRes2.error?.code === 'SERVER_KEY_MISSING',
    'Empty quoted API key (""): Returns SERVER_KEY_MISSING error'
  );
  assert(!fetchCalled, 'Empty quoted API key: Fetch was never called');

  // Subtest 2.3: A key beginning with AIzaSy
  const standardKey = 'AIzaSyTestKey_StandardFormat_0123456789';
  process.env.GEMINI_API_KEY = standardKey;
  let lastReceivedKey: string | null = null;
  globalThis.fetch = async (_url: RequestInfo | URL, init?: RequestInit) => {
    fetchCalled = true;
    lastReceivedKey = (init?.headers as Record<string, string>)?.[('x-goog-api-key')];
    return new Response(
      JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Response for AIzaSy key' }] } }] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };

  fetchCalled = false;
  const standardRes = await callGeminiApi('system prompt', 'user message');
  assert(standardRes.success === true, 'Key beginning with AIzaSy: Successfully dispatches and completes');
  assert(standardRes.text === 'Response for AIzaSy key', 'Key beginning with AIzaSy: Text response is returned');
  assert(lastReceivedKey === standardKey, 'Key beginning with AIzaSy: Transmits correct key in x-goog-api-key header');

  // Subtest 2.4: A non-empty key beginning with AIza but not AIzaSy
  const nonSyKey = 'AIzaNA_AlternativeFormat_9876543210';
  process.env.GEMINI_API_KEY = nonSyKey;
  fetchCalled = false;
  lastReceivedKey = null;
  const nonSyRes = await callGeminiApi('system prompt', 'user message');
  assert(nonSyRes.success === true, 'Key with AIza (non-Sy) prefix: Successfully dispatches and is not rejected');
  assert(lastReceivedKey === nonSyKey, 'Key with AIza (non-Sy) prefix: Transmits correct key to upstream API');

  // Subtest 2.5: Accidental surrounding quotes
  const quotedKey = '"AIzaSyTestKey_QuotedInEnv_12345"';
  process.env.GEMINI_API_KEY = quotedKey;
  fetchCalled = false;
  lastReceivedKey = null;
  const quotedRes = await callGeminiApi('system prompt', 'user message');
  assert(quotedRes.success === true, 'Accidental surrounding quotes: Stripped cleanly and succeeds');
  assert(
    lastReceivedKey === 'AIzaSyTestKey_QuotedInEnv_12345',
    'Accidental surrounding quotes: Header sent to Google contains unquoted key'
  );

  const singleQuotedKey = "  'AIzaSyTestKey_SingleQuoted_67890'  ";
  process.env.GEMINI_API_KEY = singleQuotedKey;
  fetchCalled = false;
  lastReceivedKey = null;
  const singleQuotedRes = await callGeminiApi('system prompt', 'user message');
  assert(singleQuotedRes.success === true, 'Accidental single quotes with spaces: Stripped cleanly and succeeds');
  assert(
    lastReceivedKey === 'AIzaSyTestKey_SingleQuoted_67890',
    'Accidental single quotes: Header sent to Google contains unquoted key'
  );

  // Subtest 2.6: Google authentication failure (HTTP 401)
  const rejectedKey = 'AIzaSy_InvalidKey_RejectedByGoogle';
  process.env.GEMINI_API_KEY = rejectedKey;
  globalThis.fetch = async () => {
    return new Response(
      JSON.stringify({
        error: {
          code: 401,
          message: 'Request had invalid authentication credentials.',
          status: 'UNAUTHENTICATED',
        },
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  };

  const rejected401Res = await callGeminiApi('system prompt', 'user message');
  assert(rejected401Res.success === false, 'Google rejecting key (HTTP 401): Returns failure');
  assert(
    rejected401Res.error?.code === 'INVALID_API_KEY',
    'Google rejecting key (HTTP 401): Error code is INVALID_API_KEY'
  );
  assert(
    rejected401Res.error?.error === 'Authentication failed with the Gemini API service. Please verify server credentials.',
    'Google rejecting key (HTTP 401): Returns sanitized safe authentication error message'
  );
  assert(
    !JSON.stringify(rejected401Res).includes(rejectedKey),
    'Google rejecting key (HTTP 401): API key is never leaked in response'
  );

  // Subtest 2.7: Google HTTP 400 with structured invalid API-key response
  const rawGoogleKeyError = 'API key not valid. Please pass a valid API key.';
  globalThis.fetch = async () => {
    return new Response(
      JSON.stringify({
        error: {
          code: 400,
          message: rawGoogleKeyError,
          status: 'INVALID_ARGUMENT',
          details: [
            {
              '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
              reason: 'API_KEY_INVALID',
              domain: 'googleapis.com',
            },
          ],
        },
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  };

  const rejected400KeyRes = await callGeminiApi('system prompt', 'user message');
  assert(rejected400KeyRes.success === false, 'Google HTTP 400 (API_KEY_INVALID): Returns failure');
  assert(
    rejected400KeyRes.error?.code === 'INVALID_API_KEY',
    'Google HTTP 400 (API_KEY_INVALID): Properly classified as INVALID_API_KEY'
  );
  assert(
    rejected400KeyRes.error?.error === 'Authentication failed with the Gemini API service. Please verify server credentials.',
    'Google HTTP 400 (API_KEY_INVALID): Returns safe authentication message'
  );
  assert(
    !JSON.stringify(rejected400KeyRes).includes(rawGoogleKeyError) && !JSON.stringify(rejected400KeyRes).includes(rejectedKey),
    'Google HTTP 400 (API_KEY_INVALID): Never exposes raw upstream error or API key'
  );

  // Subtest 2.8: Google HTTP 400 with ordinary malformed payload (not API key)
  const rawGooglePayloadError = 'Invalid JSON payload received. Unknown name "badProperty": Cannot find field.';
  globalThis.fetch = async () => {
    return new Response(
      JSON.stringify({
        error: {
          code: 400,
          message: rawGooglePayloadError,
          status: 'INVALID_ARGUMENT',
        },
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  };

  const rejected400PayloadRes = await callGeminiApi('system prompt', 'user message');
  assert(rejected400PayloadRes.success === false, 'Google HTTP 400 (malformed payload): Returns failure');
  assert(
    rejected400PayloadRes.error?.code === 'INVALID_PAYLOAD',
    'Google HTTP 400 (malformed payload): Properly classified as INVALID_PAYLOAD'
  );
  assert(
    rejected400PayloadRes.error?.error === 'Invalid request sent to the Gemini API service. Please verify request parameters.',
    'Google HTTP 400 (malformed payload): Returns safe generic payload error message'
  );
  assert(
    !JSON.stringify(rejected400PayloadRes).includes(rawGooglePayloadError),
    'Google HTTP 400 (malformed payload): Never exposes raw upstream error in response'
  );

  // Subtest 2.9: Google permission / access denied (HTTP 403)
  const rawGoogle403Error = 'The caller does not have permission to execute the specified operation.';
  globalThis.fetch = async () => {
    return new Response(
      JSON.stringify({
        error: {
          code: 403,
          message: rawGoogle403Error,
          status: 'PERMISSION_DENIED',
        },
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  };

  const rejected403Res = await callGeminiApi('system prompt', 'user message');
  assert(rejected403Res.success === false, 'Google access denied (HTTP 403): Returns failure');
  assert(
    rejected403Res.error?.code === 'ACCESS_DENIED',
    'Google access denied (HTTP 403): Classified as distinct ACCESS_DENIED code'
  );
  assert(
    rejected403Res.error?.error === 'Access denied by Gemini API. Check API project permissions, API restrictions, or billing setup.',
    'Google access denied (HTTP 403): Returns actionable safe guidance message'
  );
  assert(
    !JSON.stringify(rejected403Res).includes(rawGoogle403Error),
    'Google access denied (HTTP 403): Never exposes raw upstream error message'
  );

} finally {
  // Restore environment and fetch
  if (originalEnvKey !== undefined) {
    process.env.GEMINI_API_KEY = originalEnvKey;
  } else {
    delete process.env.GEMINI_API_KEY;
  }
  globalThis.fetch = originalFetch;
}

console.log('\n===============================================================');
console.log(`GEMINI API KEY REGRESSION AUDIT: ${testsPassed} PASSED, ${testsFailed} FAILED`);
console.log('===============================================================\n');

if (testsFailed > 0) {
  process.exit(1);
}
