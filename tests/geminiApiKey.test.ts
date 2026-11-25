import { callGeminiApi, sanitizeApiKey, resolveModel, DEFAULT_MODEL } from '../api/_lib/geminiClient.js';

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
const originalEnvModel = process.env.GEMINI_MODEL;
const originalFetch = globalThis.fetch;

try {
  // ---------------------------------------------------------------------------
  // 1. UNIT TESTS: sanitizeApiKey & resolveModel helpers
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

  // resolveModel unit tests
  // Empty and whitespace-only values handled correctly (without warning, safely defaulting to DEFAULT_MODEL)
  assert(resolveModel(undefined) === DEFAULT_MODEL, 'resolveModel(undefined) returns default model');
  assert(resolveModel('') === DEFAULT_MODEL, 'resolveModel("") returns default model');
  assert(resolveModel('   ') === DEFAULT_MODEL, 'resolveModel("   ") returns default model');
  assert(resolveModel('""') === DEFAULT_MODEL, 'resolveModel empty double-quoted returns default model');
  assert(resolveModel("''") === DEFAULT_MODEL, 'resolveModel empty single-quoted returns default model');
  assert(resolveModel('  "   "  ') === DEFAULT_MODEL, 'resolveModel whitespace quoted returns default model');

  // Valid Gemini model identifiers accepted
  assert(resolveModel('gemini-3.8-flash') === 'gemini-3.8-flash', 'resolveModel accepts gemini-3.8-flash');
  assert(resolveModel('gemini-3.6-flash') === 'gemini-3.6-flash', 'resolveModel accepts gemini-3.6-flash');
  assert(resolveModel('  gemini-3.6-flash  ') === 'gemini-3.6-flash', 'resolveModel trims whitespace around model');
  assert(resolveModel('"gemini-3.6-flash"') === 'gemini-3.6-flash', 'resolveModel strips double quotes around model');
  assert(resolveModel("'gemini-3.6-flash'") === 'gemini-3.6-flash', 'resolveModel strips single quotes around model');
  assert(resolveModel('gemini-2.5-pro-preview-05-06') === 'gemini-2.5-pro-preview-05-06', 'resolveModel accepts valid preview-style identifier');
  assert(resolveModel('gemini-1.5-pro-preview-0409') === 'gemini-1.5-pro-preview-0409', 'resolveModel accepts preview identifier with date suffix');
  assert(resolveModel('gemini-2.0-flash-exp') === 'gemini-2.0-flash-exp', 'resolveModel accepts experimental preview identifier');
  assert(resolveModel('  "gemini-2.5-pro-preview-05-06"  ') === 'gemini-2.5-pro-preview-05-06', 'resolveModel strips quotes and trims whitespace around preview identifier');
  assert(resolveModel(" 'gemini-3.8-flash' ") === 'gemini-3.8-flash', 'resolveModel strips single quotes and trims whitespace around default model');

  // Maximum identifier length boundary tests (64 characters max, prefix 'gemini-' + up to 57 characters)
  const valid64CharModel = 'gemini-' + 'a'.repeat(57);
  assert(valid64CharModel.length === 64, 'valid64CharModel has length 64');
  assert(resolveModel(valid64CharModel) === valid64CharModel, 'resolveModel accepts 64-character gemini identifier');
  const invalid65CharModel = 'gemini-' + 'a'.repeat(58);
  assert(invalid65CharModel.length === 65, 'invalid65CharModel has length 65');
  assert(resolveModel(invalid65CharModel) === DEFAULT_MODEL, 'resolveModel rejects 65-character gemini identifier');

  // Arbitrary non-Gemini strings rejected and fall back to DEFAULT_MODEL
  assert(resolveModel('gpt-4o') === DEFAULT_MODEL, 'resolveModel rejects non-gemini arbitrary model identifier');
  assert(resolveModel('claude-3-5-sonnet') === DEFAULT_MODEL, 'resolveModel rejects arbitrary claude identifier');
  assert(resolveModel('custom-model-v1') === DEFAULT_MODEL, 'resolveModel rejects arbitrary model name');
  assert(resolveModel('gemini') === DEFAULT_MODEL, 'resolveModel rejects gemini without trailing hyphen');
  assert(resolveModel('gemini-') === DEFAULT_MODEL, 'resolveModel rejects bare gemini- with empty suffix');
  assert(resolveModel('gemini_3.8_flash') === DEFAULT_MODEL, 'resolveModel rejects gemini_ prefix without hyphen');
  assert(resolveModel('GEMINI-3.8-FLASH') === DEFAULT_MODEL, 'resolveModel rejects uppercase GEMINI- prefix');
  assert(resolveModel('invalid model with spaces') === DEFAULT_MODEL, 'resolveModel rejects strings with spaces');

  // API-key-like and secret strings rejected
  assert(resolveModel('AIzaSy_Secret_Key_In_Model==inject') === DEFAULT_MODEL, 'resolveModel rejects API-key-like or sensitive strings');
  assert(resolveModel('AIzaSyD-1234567890abcdefghijklmnopqrstuv') === DEFAULT_MODEL, 'resolveModel rejects AIza API keys');
  assert(resolveModel('secret_model_token') === DEFAULT_MODEL, 'resolveModel rejects tokens containing sensitive keywords');
  assert(resolveModel('bearer-token-12345') === DEFAULT_MODEL, 'resolveModel rejects bearer token strings');

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

  // Subtest 2.10: Network failure diagnostic logging & secret redaction
  const originalWarn = console.warn;
  const loggedWarns: string[] = [];
  console.warn = (...args: any[]) => {
    loggedWarns.push(args.join(' '));
  };

  try {
    const sensitiveSecretKey = 'AIzaSy_SuperSecret_DiagnosticKey_999';
    process.env.GEMINI_API_KEY = sensitiveSecretKey;
    const sensitiveRawErrorMessage = 'DNS resolution failed at gateway host 10.0.0.1';

    globalThis.fetch = async () => {
      const netErr = new TypeError(sensitiveRawErrorMessage);
      Object.assign(netErr, { code: 'ENOTFOUND' });
      throw netErr;
    };

    const netFailureRes = await callGeminiApi('sensitive system prompt', 'sensitive user message');
    assert(netFailureRes.success === false, 'Network failure: Returns failure');
    assert(netFailureRes.error?.code === 'SERVICE_UNAVAILABLE', 'Network failure: Error code is SERVICE_UNAVAILABLE');

    // Verify diagnostic logs were produced
    const networkLog = loggedWarns.find((log) => log.includes('[GeminiClient] Network failure:'));
    assert(Boolean(networkLog), 'Network failure: Emits diagnostic log in catch block');
    assert(
      Boolean(networkLog?.includes('errorName=TypeError') && networkLog?.includes('errorCode=ENOTFOUND') && networkLog?.includes('isTimeout=false')),
      'Network failure: Log contains sanitized metadata (errorName, errorCode, isTimeout)'
    );

    // Verify secrecy: no keys, raw error messages, or prompt content in logs
    const allLogsJoined = loggedWarns.join('\n');
    assert(!allLogsJoined.includes(sensitiveSecretKey), 'Network failure: API key is never logged');
    assert(!allLogsJoined.includes(sensitiveRawErrorMessage), 'Network failure: Raw exception message is never logged');
    assert(!allLogsJoined.includes('sensitive system prompt') && !allLogsJoined.includes('sensitive user message'), 'Network failure: Prompts are never logged');
  } finally {
    console.warn = originalWarn;
  }

  // Subtest 2.11: Timeout failure diagnostic logging
  const loggedTimeoutWarns: string[] = [];
  console.warn = (...args: any[]) => {
    loggedTimeoutWarns.push(args.join(' '));
  };

  try {
    process.env.GEMINI_API_KEY = 'AIzaSy_TimeoutTestKey_111';
    globalThis.fetch = async () => {
      const abortErr = new Error('The operation was aborted');
      abortErr.name = 'AbortError';
      throw abortErr;
    };

    const timeoutRes = await callGeminiApi('system prompt', 'user message');
    assert(timeoutRes.success === false && timeoutRes.error?.code === 'REQUEST_TIMEOUT', 'Timeout: Returns REQUEST_TIMEOUT code');
    const timeoutLog = loggedTimeoutWarns.find((log) => log.includes('[GeminiClient] Network failure:'));
    assert(
      Boolean(timeoutLog?.includes('errorName=AbortError') && timeoutLog?.includes('isTimeout=true')),
      'Timeout: Log accurately records AbortError and isTimeout=true'
    );
  } finally {
    console.warn = originalWarn;
  }

  // Subtest 2.12: Malicious alphanumeric/uppercase values (passing old regexes) fall back to allowlist defaults
  const loggedMaliciousWarns: string[] = [];
  console.warn = (...args: any[]) => {
    loggedMaliciousWarns.push(args.join(' '));
  };

  try {
    process.env.GEMINI_API_KEY = 'AIzaSy_ValidKey_MaliciousValuesTest';
    // Both values are entirely alphanumeric / uppercase and would pass character-class regexes
    const sensitiveAlphanumericName = 'SensitiveSecretTokenInErrorName'; // matches /^[A-Za-z][A-Za-z0-9]{0,39}$/
    const sensitiveUppercaseCode = 'SENSITIVE_KEY_CODE'; // matches /^[A-Z0-9_]{3,20}$/

    globalThis.fetch = async () => {
      const customErr = new Error('Some error');
      customErr.name = sensitiveAlphanumericName;
      (customErr as any).code = sensitiveUppercaseCode;
      throw customErr;
    };

    const maliciousNameRes = await callGeminiApi('system prompt', 'user message');
    assert(maliciousNameRes.success === false, 'Alphanumeric malicious values: Returns failure');

    const logEntry = loggedMaliciousWarns.find((log) => log.includes('[GeminiClient] Network failure:'));
    assert(Boolean(logEntry), 'Alphanumeric malicious values: Emits diagnostic log');
    assert(Boolean(logEntry?.includes('errorName=Error')), 'Alphanumeric malicious name: Falls back strictly to errorName=Error');
    assert(Boolean(logEntry?.includes('errorCode=NETWORK_ERROR')), 'Uppercase malicious code: Falls back strictly to errorCode=NETWORK_ERROR');
    assert(!logEntry?.includes(sensitiveAlphanumericName), 'Alphanumeric malicious name: Never leaks into logs');
    assert(!logEntry?.includes(sensitiveUppercaseCode), 'Uppercase malicious code: Never leaks into logs');
  } finally {
    console.warn = originalWarn;
  }

  // Subtest 2.13: Configured GEMINI_MODEL is logged, dispatched, and reported
  const originalLog = console.log;
  const loggedLines: string[] = [];
  console.log = (...args: any[]) => {
    loggedLines.push(args.join(' '));
  };

  try {
    process.env.GEMINI_API_KEY = 'AIzaSy_ValidKey_ModelDiagnosticTest';
    process.env.GEMINI_MODEL = 'gemini-3.6-flash';
    let dispatchedEndpoint = '';

    globalThis.fetch = async (url: any) => {
      dispatchedEndpoint = String(url);
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: 'Response from gemini-3.6-flash' }] } }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const resConfiguredModel = await callGeminiApi('system prompt', 'user message');
    assert(resConfiguredModel.success === true, 'Configured model: Returns success');
    assert(resConfiguredModel.model === 'gemini-3.6-flash', 'Configured model: Returns model in result');
    assert(
      dispatchedEndpoint.includes('/models/gemini-3.6-flash:generateContent'),
      'Configured model: Dispatches request to configured model endpoint'
    );

    const activeModelLog = loggedLines.find((log) => log.includes('[GeminiClient] Active model:'));
    assert(Boolean(activeModelLog), 'Configured model: Emits Active model diagnostic log');
    assert(
      Boolean(activeModelLog?.includes('Active model: gemini-3.6-flash')),
      'Configured model: Logs correct active model identifier'
    );
  } finally {
    console.log = originalLog;
  }

  // Subtest 2.13b: Valid Gemini preview-style identifier is logged, dispatched, and reported
  const loggedLinesPreview: string[] = [];
  console.log = (...args: any[]) => {
    loggedLinesPreview.push(args.join(' '));
  };

  try {
    process.env.GEMINI_API_KEY = 'AIzaSy_ValidKey_ModelDiagnosticTest';
    process.env.GEMINI_MODEL = 'gemini-2.5-pro-preview-05-06';
    let dispatchedEndpoint = '';

    globalThis.fetch = async (url: any) => {
      dispatchedEndpoint = String(url);
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: 'Response from preview model' }] } }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const resPreviewModel = await callGeminiApi('system prompt', 'user message');
    assert(resPreviewModel.success === true, 'Preview model: Returns success');
    assert(resPreviewModel.model === 'gemini-2.5-pro-preview-05-06', 'Preview model: Returns preview model in result');
    assert(
      dispatchedEndpoint.includes('/models/gemini-2.5-pro-preview-05-06:generateContent'),
      'Preview model: Dispatches request to preview model endpoint'
    );

    const activeModelLog = loggedLinesPreview.find((log) => log.includes('[GeminiClient] Active model:'));
    assert(Boolean(activeModelLog), 'Preview model: Emits Active model diagnostic log');
    assert(
      Boolean(activeModelLog?.includes('Active model: gemini-2.5-pro-preview-05-06')),
      'Preview model: Logs correct preview model identifier'
    );
  } finally {
    console.log = originalLog;
  }

  // Subtest 2.14: Absent GEMINI_MODEL defaults to DEFAULT_MODEL (gemini-3.8-flash)
  const loggedLinesDefault: string[] = [];
  console.log = (...args: any[]) => {
    loggedLinesDefault.push(args.join(' '));
  };

  try {
    process.env.GEMINI_API_KEY = 'AIzaSy_ValidKey_ModelDiagnosticTest';
    delete process.env.GEMINI_MODEL;
    let dispatchedEndpoint = '';

    globalThis.fetch = async (url: any) => {
      dispatchedEndpoint = String(url);
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: 'Response from default model' }] } }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const resDefaultModel = await callGeminiApi('system prompt', 'user message');
    assert(resDefaultModel.success === true, 'Default model: Returns success');
    assert(resDefaultModel.model === 'gemini-3.8-flash', 'Default model: Returns default model in result');
    assert(
      dispatchedEndpoint.includes('/models/gemini-3.8-flash:generateContent'),
      'Default model: Dispatches request to default model endpoint'
    );

    const activeModelLog = loggedLinesDefault.find((log) => log.includes('[GeminiClient] Active model:'));
    assert(Boolean(activeModelLog), 'Default model: Emits Active model diagnostic log');
    assert(
      Boolean(activeModelLog?.includes('Active model: gemini-3.8-flash')),
      'Default model: Logs default model identifier when env var is absent'
    );
  } finally {
    console.log = originalLog;
  }

  // Subtest 2.15: Sensitive values in GEMINI_MODEL are never logged
  const loggedLinesSensitive: string[] = [];
  console.log = (...args: any[]) => {
    loggedLinesSensitive.push(args.join(' '));
  };

  try {
    const sensitiveModelToken = 'AIzaSy_SecretApiKeyInModelEnv==malicious';
    process.env.GEMINI_API_KEY = 'AIzaSy_ValidKey_ModelDiagnosticTest';
    process.env.GEMINI_MODEL = sensitiveModelToken;

    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: 'Response from safe model' }] } }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const resSensitive = await callGeminiApi('system prompt', 'user message');
    assert(resSensitive.success === true, 'Sensitive model env: Returns success with safe fallback');
    assert(resSensitive.model === 'gemini-3.8-flash', 'Sensitive model env: Falls back to default model');

    const joinedLogs = loggedLinesSensitive.join('\n');
    assert(!joinedLogs.includes(sensitiveModelToken), 'Sensitive model env: Never exposes sensitive string in logs');
    assert(joinedLogs.includes('Active model: gemini-3.8-flash'), 'Sensitive model env: Logs safe fallback model');
  } finally {
    console.log = originalLog;
  }

  // Subtest 2.16: Active model is logged exactly once per Gemini request, NOT repeated on retries
  const loggedLinesRetries: string[] = [];
  console.log = (...args: any[]) => {
    loggedLinesRetries.push(args.join(' '));
  };

  try {
    process.env.GEMINI_API_KEY = 'AIzaSy_ValidKey_ModelDiagnosticTest';
    process.env.GEMINI_MODEL = 'gemini-3.6-flash';
    let fetchAttempts = 0;

    globalThis.fetch = async () => {
      fetchAttempts++;
      // Return 503 to trigger retries
      return new Response(JSON.stringify({ error: 'temporarily unavailable' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const resRetries = await callGeminiApi('system prompt', 'user message');
    assert(resRetries.success === false, 'Retry test: Ultimately returns failure on 503');
    assert(fetchAttempts === 3, 'Retry test: Executed initial request plus 2 retries (3 total attempts)');

    const activeModelOccurrences = loggedLinesRetries.filter((l) => l.includes('[GeminiClient] Active model:')).length;
    assert(
      activeModelOccurrences === 1,
      'Retry test: Active model is logged exactly once per Gemini request and not repeated on retries'
    );
  } finally {
    console.log = originalLog;
  }

  // Subtest 2.17: Safe diagnostic warning emitted when GEMINI_MODEL is explicitly provided but invalid
  const originalWarnSubtest17 = console.warn;
  const loggedWarnsSubtest17: string[] = [];
  console.warn = (...args: any[]) => {
    loggedWarnsSubtest17.push(args.join(' '));
  };

  try {
    const maliciousModelString = 'SensitiveSecretTokenInModelVariable==inject;drop-table';
    process.env.GEMINI_MODEL = maliciousModelString;

    const resolved = resolveModel();
    assert(resolved === DEFAULT_MODEL, 'Invalid model fallback: Returns DEFAULT_MODEL');

    const warningLog = loggedWarnsSubtest17.find((l) =>
      l.includes('[GeminiClient] Configured GEMINI_MODEL is invalid. Falling back to default model.')
    );
    assert(Boolean(warningLog), 'Invalid model fallback: Emits safe diagnostic warning');

    const allJoinedWarns = loggedWarnsSubtest17.join('\n');
    assert(
      !allJoinedWarns.includes(maliciousModelString),
      'Invalid model fallback: Never logs the invalid/sensitive model value'
    );

    // Arbitrary non-Gemini model string is rejected and never logged
    const arbitraryModelString = 'gpt-4o-arbitrary-model';
    process.env.GEMINI_MODEL = arbitraryModelString;
    const resolvedArbitrary = resolveModel();
    assert(resolvedArbitrary === DEFAULT_MODEL, 'Arbitrary model fallback: Returns DEFAULT_MODEL');
    assert(
      !loggedWarnsSubtest17.join('\n').includes(arbitraryModelString),
      'Arbitrary model fallback: Never logs the arbitrary model string'
    );
  } finally {
    console.warn = originalWarnSubtest17;
  }

} finally {
  // Restore environment and fetch
  if (originalEnvKey !== undefined) {
    process.env.GEMINI_API_KEY = originalEnvKey;
  } else {
    delete process.env.GEMINI_API_KEY;
  }
  if (originalEnvModel !== undefined) {
    process.env.GEMINI_MODEL = originalEnvModel;
  } else {
    delete process.env.GEMINI_MODEL;
  }
  globalThis.fetch = originalFetch;
}

console.log('\n===============================================================');
console.log(`GEMINI API KEY REGRESSION AUDIT: ${testsPassed} PASSED, ${testsFailed} FAILED`);
console.log('===============================================================\n');

if (testsFailed > 0) {
  process.exit(1);
}
