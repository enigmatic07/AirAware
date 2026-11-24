import { ApiErrorResponse } from './types.js';

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const REQUEST_TIMEOUT_MS = 15000; // 15s timeout
const MAX_RETRIES = 2;

export interface GeminiCallResult {
  success: boolean;
  text?: string;
  model: string;
  error?: ApiErrorResponse;
}

/**
 * Executes a call to Google Gemini with retry logic, timeouts, and sanitized errors.
 */
export async function callGeminiApi(
  systemInstruction: string,
  userPrompt: string,
  responseSchema?: any
): Promise<GeminiCallResult> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const model = DEFAULT_MODEL;

  if (!apiKey) {
    return {
      success: false,
      model,
      error: {
        success: false,
        error: 'Server configuration error: GEMINI_API_KEY is not configured on the backend.',
        code: 'SERVER_KEY_MISSING',
      },
    };
  }

  // Pre-validate key format: AI Studio keys start with AIzaSy
  if (!apiKey.startsWith('AIzaSy')) {
    return {
      success: false,
      model,
      error: {
        success: false,
        error: 'Server configuration error: The configured GEMINI_API_KEY has an invalid format. Valid Google AI Studio keys start with "AIzaSy".',
        code: 'INVALID_API_KEY',
      },
    };
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const payload: any = {
    contents: [
      {
        role: 'user',
        parts: [{ text: `${systemInstruction}\n\n${userPrompt}` }],
      },
    ],
    generationConfig: {
      maxOutputTokens: 2048,
    },
  };

  if (responseSchema) {
    payload.generationConfig.responseMimeType = 'application/json';
    payload.generationConfig.responseSchema = responseSchema;
  }

  let attempt = 0;
  while (attempt <= MAX_RETRIES) {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const durationMs = Date.now() - startTime;

      if (response.ok) {
        const json = await response.json();
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
          return {
            success: false,
            model,
            error: {
              success: false,
              error: 'AI model returned an empty response.',
              code: 'INVALID_AI_RESPONSE',
            },
          };
        }

        // Safe telemetry log: no PII or keys
        console.log(`[GeminiClient] Success: model=${model} duration=${durationMs}ms`);
        return { success: true, text, model };
      }

      // Handle non-200 responses
      const status = response.status;
      let errorDetails = '';
      try {
        const errJson = await response.json();
        errorDetails = errJson.error?.message || response.statusText;
      } catch {
        errorDetails = response.statusText;
      }

      console.warn(`[GeminiClient] Upstream HTTP ${status}: ${errorDetails.slice(0, 100)}`);

      // Handle specific HTTP codes
      if (status === 400 || status === 401) {
        return {
          success: false,
          model,
          error: {
            success: false,
            error: 'Authentication failed with the Gemini API service. Please verify server credentials.',
            code: 'INVALID_API_KEY',
          },
        };
      }

      if (status === 403) {
        return {
          success: false,
          model,
          error: {
            success: false,
            error: 'Access denied by Gemini API. Check API project permissions or billing setup.',
            code: 'INVALID_API_KEY',
          },
        };
      }

      if (status === 429) {
        // Transient quota limit: retry with backoff if attempts remaining
        if (attempt < MAX_RETRIES) {
          attempt++;
          const backoffMs = 600 * Math.pow(2, attempt) + Math.random() * 200;
          await new Promise((r) => setTimeout(r, backoffMs));
          continue;
        }
        return {
          success: false,
          model,
          error: {
            success: false,
            error: 'Gemini API rate limit or quota exceeded. Please try again in a few moments.',
            code: 'QUOTA_EXCEEDED',
          },
        };
      }

      if (status >= 500 && status < 600) {
        // Transient server error: retry
        if (attempt < MAX_RETRIES) {
          attempt++;
          const backoffMs = 500 * Math.pow(2, attempt) + Math.random() * 200;
          await new Promise((r) => setTimeout(r, backoffMs));
          continue;
        }
        return {
          success: false,
          model,
          error: {
            success: false,
            error: 'Google Gemini service is temporarily unavailable. Please try again shortly.',
            code: 'SERVICE_UNAVAILABLE',
          },
        };
      }

      return {
        success: false,
        model,
        error: {
          success: false,
          error: `Gemini API service returned status ${status}.`,
          code: 'INTERNAL_ERROR',
        },
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        return {
          success: false,
          model,
          error: {
            success: false,
            error: `Request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds.`,
            code: 'REQUEST_TIMEOUT',
          },
        };
      }

      // Transient network failure: retry
      if (attempt < MAX_RETRIES) {
        attempt++;
        const backoffMs = 500 * Math.pow(2, attempt) + Math.random() * 200;
        await new Promise((r) => setTimeout(r, backoffMs));
        continue;
      }

      return {
        success: false,
        model,
        error: {
          success: false,
          error: 'Network connectivity failure while contacting Gemini service.',
          code: 'SERVICE_UNAVAILABLE',
        },
      };
    }
  }

  return {
    success: false,
    model,
    error: {
      success: false,
      error: 'Max retries exceeded.',
      code: 'SERVICE_UNAVAILABLE',
    },
  };
}
