import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getClientIp, checkRateLimit } from './_lib/rateLimiter.js';
import { parseJsonBody, validateRecommendationsRequest } from './_lib/validator.js';
import { callGeminiApi } from './_lib/geminiClient.js';
import { verifyFirebaseToken } from './_lib/auth.js';
import type { ApiErrorResponse, ApiSuccessResponse } from './_lib/types.js';

const RECOMMENDATIONS_SCHEMA = {
  type: 'object',
  properties: {
    overallRiskLevel: {
      type: 'string',
      enum: ['Low', 'Moderate', 'High', 'Critical', 'Hazardous'],
    },
    headline: { type: 'string' },
    ventilationGuidance: {
      type: 'object',
      properties: {
        canVentilate: { type: 'boolean' },
        safeWindowStart: { type: 'string' },
        safeWindowEnd: { type: 'string' },
        ventilationInstructions: { type: 'string' },
      },
      required: ['canVentilate', 'ventilationInstructions'],
    },
    householdActionItems: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          targetMember: { type: 'string' },
          action: { type: 'string' },
          priority: { type: 'string', enum: ['Must Do', 'Recommended', 'Optional'] },
          reasoning: { type: 'string' },
        },
        required: ['action', 'priority', 'reasoning'],
      },
    },
    transitAdvice: {
      type: 'object',
      properties: {
        recommendedMode: { type: 'string' },
        commutePrecautions: { type: 'string' },
        exposureReductionPct: { type: 'number' },
      },
      required: ['recommendedMode', 'commutePrecautions'],
    },
    indoorAirQualityHack: {
      type: 'object',
      properties: {
        hackTitle: { type: 'string' },
        instructions: { type: 'string' },
        estimatedCost: { type: 'string' },
      },
      required: ['hackTitle', 'instructions'],
    },
  },
  required: [
    'overallRiskLevel',
    'headline',
    'ventilationGuidance',
    'householdActionItems',
    'transitAdvice',
    'indoorAirQualityHack',
  ],
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
        : `Rate limit exceeded. Please wait ${rateLimit.resetSeconds} seconds before requesting recommendations again.`,
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

  const validation = validateRecommendationsRequest(rawBody);
  if (!validation.valid || !validation.data) {
    const errorResponse: ApiErrorResponse = {
      success: false,
      error: validation.error || 'Payload validation failed.',
      code: 'INVALID_PAYLOAD',
    };
    return res.status(400).json(errorResponse);
  }

  const { aqiSnapshot, profile } = validation.data;

  const systemInstruction = `
You are AirAware AI, an elite environmental health specialist and community resilience planner.
Analyze the following live conditions and household profile to generate a structured daily resilience routine.

Live Environmental Data:
- Location: ${aqiSnapshot.city}
- Current AQI: ${aqiSnapshot.currentAqi} (${aqiSnapshot.severity})
- Dominant Pollutant: ${aqiSnapshot.dominantPollutant} (${aqiSnapshot.pollutants.pm25} µg/m³ PM2.5)

Household Profile:
- Family: ${profile.familyName}
- Members: ${profile.members.map(m => `${m.name} (${m.age}y, conditions: ${m.conditions.join(', ')})`).join('; ')}
- Home: Purifier: ${profile.home.hasAirPurifier ? `Yes (${profile.home.purifierCount})` : 'No'}, AC Filter: ${profile.home.hasAcWithFilter}
- Commute: ${profile.commuteMode}

Provide a JSON response adhering strictly to the provided response schema.
`;

  const result = await callGeminiApi(
    systemInstruction,
    'Generate the personalized daily resilience plan for this household based on current ambient smog levels.',
    RECOMMENDATIONS_SCHEMA
  );

  if (!result.success || !result.text) {
    const statusMap: Record<string, number> = {
      INVALID_PAYLOAD: 400,
      INVALID_API_KEY: 401,
      ACCESS_DENIED: 403,
      QUOTA_EXCEEDED: 429,
      SERVER_KEY_MISSING: 500,
      INVALID_AI_RESPONSE: 502,
      SERVICE_UNAVAILABLE: 503,
      REQUEST_TIMEOUT: 504,
    };
    const statusCode = statusMap[result.error?.code || ''] || 500;
    return res.status(statusCode).json(result.error);
  }

  try {
    const parsedData = JSON.parse(result.text);
    const successResponse: ApiSuccessResponse<any> = {
      success: true,
      data: parsedData,
      source: 'gemini',
      model: result.model,
    };
    return res.status(200).json(successResponse);
  } catch {
    const errorResponse: ApiErrorResponse = {
      success: false,
      error: 'The AI model returned an unparseable JSON structure.',
      code: 'INVALID_AI_RESPONSE',
    };
    return res.status(502).json(errorResponse);
  }
}
