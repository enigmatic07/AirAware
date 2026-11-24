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
 * Sanitizes and extracts the API key from environment variables.
 * Trims whitespace and strips matching outer quotation marks (single or double).
 */
export function sanitizeApiKey(rawKey?: string): string | undefined {
  if (!rawKey) return undefined;
  let key = rawKey.trim();
  if (
    (key.startsWith('"') && key.endsWith('"') && key.length >= 2) ||
    (key.startsWith("'") && key.endsWith("'") && key.length >= 2)
  ) {
    key = key.slice(1, -1).trim();
  }
  return key.length > 0 ? key : undefined;
}

/**
 * Executes a call to Google Gemini with retry logic, timeouts, and sanitized errors.
 */
export async function callGeminiApi(
  systemInstruction: string,
  userPrompt: string,
  responseSchema?: any
): Promise<GeminiCallResult> {
  const apiKey = sanitizeApiKey(process.env.GEMINI_API_KEY);
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

        // Safe telemetry log: only metadata, no PII, keys, or prompt content
        console.log(`[GeminiClient] Success: model=${model} duration=${durationMs}ms`);
        return { success: true, text, model };
      }

      // Handle non-200 responses: log only safe metadata (HTTP status and duration)
      const status = response.status;
      console.warn(`[GeminiClient] Upstream HTTP ${status} (duration=${durationMs}ms)`);

      if (status === 401) {
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

      if (status === 400) {
        let isApiKeyError = false;
        try {
          const errJson: any = await response.json();
          const message: string = typeof errJson?.error?.message === 'string' ? errJson.error.message : '';
          const details: any[] = Array.isArray(errJson?.error?.details) ? errJson.error.details : [];
          const hasApiKeyReason = details.some((d: any) => d?.reason === 'API_KEY_INVALID');
          const hasApiKeyMessage = message.includes('API key not valid') || message.includes('API_KEY_INVALID');
          if (hasApiKeyReason || hasApiKeyMessage) {
            isApiKeyError = true;
          }
        } catch {
          // Default to non-key request error if body cannot be parsed as JSON
        }

        if (isApiKeyError) {
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

        return {
          success: false,
          model,
          error: {
            success: false,
            error: 'Invalid request sent to the Gemini API service. Please verify request parameters.',
            code: 'INVALID_PAYLOAD',
          },
        };
      }

      if (status === 403) {
        return {
          success: false,
          model,
          error: {
            success: false,
            error: 'Access denied by Gemini API. Check API project permissions, API restrictions, or billing setup.',
            code: 'ACCESS_DENIED',
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
    } finally {
      clearTimeout(timeoutId);
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
