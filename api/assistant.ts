import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getClientIp, checkRateLimit } from './_lib/rateLimiter';
import { parseJsonBody, validateAssistantRequest } from './_lib/validator';
import { callGeminiApi } from './_lib/geminiClient';
import { verifyFirebaseToken } from './_lib/auth';
import { ApiErrorResponse, ApiSuccessResponse } from './_lib/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enforce CORS & Allowed Methods
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    const errorResponse: ApiErrorResponse = {
      success: false,
      error: 'Method not allowed. Only POST requests are supported.',
      code: 'INVALID_PAYLOAD',
    };
    return res.status(405).json(errorResponse);
  }

  // Optional Firebase Authentication Verification
  const authResult = await verifyFirebaseToken(req);
  if (authResult.error) {
    const errorResponse: ApiErrorResponse = {
      success: false,
      error: authResult.error,
      code: 'INVALID_AUTH_TOKEN' as any,
    };
    return res.status(401).json(errorResponse);
  }

  // Rate Limiting (Higher tier for authenticated users)
  const clientIp = getClientIp(req);
  const rateLimitKey = authResult.authenticated && authResult.uid ? `auth_${authResult.uid}` : `ip_${clientIp}`;
  const rateLimit = await checkRateLimit(rateLimitKey, authResult.authenticated);

  res.setHeader('X-RateLimit-Limit', String(rateLimit.limit));
  res.setHeader('X-RateLimit-Remaining', String(rateLimit.remaining));
  res.setHeader('X-RateLimit-Reset', String(rateLimit.resetSeconds));

  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', String(rateLimit.resetSeconds));
    const isServiceUnavailable = rateLimit.statusCode === 503;
    const errorResponse: ApiErrorResponse = {
      success: false,
      error: isServiceUnavailable
        ? (rateLimit.error || 'Rate limit service temporarily unavailable in production.')
        : `Rate limit exceeded. Please wait ${rateLimit.resetSeconds} seconds before trying again.`,
      code: isServiceUnavailable ? 'SERVICE_UNAVAILABLE' : 'RATE_LIMITED',
    };
    return res.status(isServiceUnavailable ? 503 : 429).json(errorResponse);
  }

  // Parse and validate payload
  let rawBody: any;
  try {
    rawBody = await parseJsonBody(req);
  } catch (err: any) {
    const errorResponse: ApiErrorResponse = {
      success: false,
      error: err.message || 'Invalid JSON body.',
      code: 'INVALID_PAYLOAD',
    };
    return res.status(400).json(errorResponse);
  }

  const validation = validateAssistantRequest(rawBody);
  if (!validation.valid || !validation.data) {
    const errorResponse: ApiErrorResponse = {
      success: false,
      error: validation.error || 'Payload validation failed.',
      code: 'INVALID_PAYLOAD',
    };
    return res.status(400).json(errorResponse);
  }

  const { message, aqiSnapshot, profile } = validation.data;

  // Build grounded system prompt
  const systemInstruction = `
You are AirAware AI, an empathetic, highly knowledgeable clean air resilience expert and environmental epidemiologist.
Current Atmospheric Telemetry:
- Location: ${aqiSnapshot.city}
- AQI: ${aqiSnapshot.currentAqi} (${aqiSnapshot.severity})
- Primary Pollutant: ${aqiSnapshot.dominantPollutant} (${aqiSnapshot.pollutants.pm25} µg/m³ PM2.5, ${aqiSnapshot.pollutants.pm10} µg/m³ PM10)
- Other Pollutants: NO2: ${aqiSnapshot.pollutants.no2 ?? 'N/A'} µg/m³, CO: ${aqiSnapshot.pollutants.co ?? 'N/A'} mg/m³

Household Profile:
- Family: ${profile.familyName}
- Members: ${profile.members.length} total (${profile.members.map(m => `${m.name}, age ${m.age}${m.conditions.length > 0 ? `, conditions: ${m.conditions.join(', ')}` : ''}`).join('; ')})
- Home Air Filtration: ${profile.home.hasAirPurifier ? `Yes (${profile.home.purifierCount} units)` : 'No air purifier'}
- Typical Commute: ${profile.commuteMode}

Guidelines:
1. Provide actionable, realistic, scientifically sound guidance grounded in the ambient AQI and household vulnerabilities.
2. If children, pregnant women, asthmatics, or seniors are mentioned, prioritize their safety windows and emergency precautions.
3. Keep answers clear, empathetic, and structured with markdown headings/bullet points.
4. Disclaimer: Do not prescribe pharmaceutical medication. If acute wheezing, chest pain, or oxygen desaturation occurs, advise emergency clinical care.
`;

  const result = await callGeminiApi(systemInstruction, `User Query: ${message}`);

  if (!result.success || !result.text) {
    const statusMap: Record<string, number> = {
      SERVER_KEY_MISSING: 500,
      INVALID_API_KEY: 401,
      QUOTA_EXCEEDED: 429,
      SERVICE_UNAVAILABLE: 503,
      REQUEST_TIMEOUT: 504,
      INVALID_AI_RESPONSE: 502,
    };
    const statusCode = statusMap[result.error?.code || ''] || 500;
    return res.status(statusCode).json(result.error);
  }

  const successResponse: ApiSuccessResponse<{ reply: string }> = {
    success: true,
    data: { reply: result.text },
    source: 'gemini',
    model: result.model,
  };

  return res.status(200).json(successResponse);
}
