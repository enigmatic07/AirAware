import { AssistantRequestBody, RecommendationsRequestBody } from './types';

const MAX_BODY_BYTES = 64 * 1024; // 64 KB limit to prevent DoS

export async function parseJsonBody(req: any): Promise<any> {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }

  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      throw new Error('Malformed JSON payload');
    }
  }

  // Handle incoming stream (e.g. in Vite connect middleware)
  return new Promise((resolve, reject) => {
    let raw = '';
    let bytes = 0;

    req.on('data', (chunk: Buffer | string) => {
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) {
        req.destroy();
        reject(new Error('Payload size exceeds 64KB limit'));
        return;
      }
      raw += chunk.toString();
    });

    req.on('end', () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Malformed JSON payload'));
      }
    });

    req.on('error', (err: any) => reject(err));
  });
}

export function validateAssistantRequest(body: any): { valid: boolean; error?: string; data?: AssistantRequestBody } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a valid JSON object.' };
  }

  // Validate message
  if (typeof body.message !== 'string' || !body.message.trim()) {
    return { valid: false, error: 'Field "message" is required and must be a non-empty string.' };
  }
  if (body.message.length > 1000) {
    return { valid: false, error: 'Field "message" exceeds maximum length of 1000 characters.' };
  }

  // Validate aqiSnapshot
  const aqiValidation = validateAqiSnapshot(body.aqiSnapshot);
  if (!aqiValidation.valid) {
    return { valid: false, error: aqiValidation.error };
  }

  // Validate profile
  const profileValidation = validateProfile(body.profile);
  if (!profileValidation.valid) {
    return { valid: false, error: profileValidation.error };
  }

  return {
    valid: true,
    data: {
      message: body.message.trim(),
      aqiSnapshot: aqiValidation.data!,
      profile: profileValidation.data!,
    },
  };
}

export function validateRecommendationsRequest(body: any): { valid: boolean; error?: string; data?: RecommendationsRequestBody } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a valid JSON object.' };
  }

  const aqiValidation = validateAqiSnapshot(body.aqiSnapshot);
  if (!aqiValidation.valid) {
    return { valid: false, error: aqiValidation.error };
  }

  const profileValidation = validateProfile(body.profile);
  if (!profileValidation.valid) {
    return { valid: false, error: profileValidation.error };
  }

  return {
    valid: true,
    data: {
      aqiSnapshot: aqiValidation.data!,
      profile: profileValidation.data!,
    },
  };
}

function validateAqiSnapshot(snapshot: any): { valid: boolean; error?: string; data?: any } {
  if (!snapshot || typeof snapshot !== 'object') {
    return { valid: false, error: 'Field "aqiSnapshot" is required.' };
  }

  if (typeof snapshot.currentAqi !== 'number' || isNaN(snapshot.currentAqi) || snapshot.currentAqi < 0 || snapshot.currentAqi > 1000) {
    return { valid: false, error: '"currentAqi" must be a number between 0 and 1000.' };
  }

  const city = typeof snapshot.city === 'string' ? snapshot.city.slice(0, 100).trim() : 'Unknown Location';
  const severity = typeof snapshot.severity === 'string' ? snapshot.severity.slice(0, 50) : 'Moderate';
  const dominantPollutant = typeof snapshot.dominantPollutant === 'string' ? snapshot.dominantPollutant.slice(0, 20) : 'PM2.5';

  const pm25 = typeof snapshot.pollutants?.pm25 === 'number' ? Math.max(0, snapshot.pollutants.pm25) : 80;
  const pm10 = typeof snapshot.pollutants?.pm10 === 'number' ? Math.max(0, snapshot.pollutants.pm10) : 130;

  return {
    valid: true,
    data: {
      city,
      currentAqi: Math.round(snapshot.currentAqi),
      severity,
      dominantPollutant,
      pollutants: {
        pm25: Math.round(pm25),
        pm10: Math.round(pm10),
        no2: typeof snapshot.pollutants?.no2 === 'number' ? snapshot.pollutants.no2 : undefined,
        so2: typeof snapshot.pollutants?.so2 === 'number' ? snapshot.pollutants.so2 : undefined,
        co: typeof snapshot.pollutants?.co === 'number' ? snapshot.pollutants.co : undefined,
        o3: typeof snapshot.pollutants?.o3 === 'number' ? snapshot.pollutants.o3 : undefined,
      },
    },
  };
}

function validateProfile(profile: any): { valid: boolean; error?: string; data?: any } {
  if (!profile || typeof profile !== 'object') {
    return {
      valid: true,
      data: {
        familyName: 'Household',
        members: [],
        home: { hasAirPurifier: false, purifierCount: 0, hasAcWithFilter: false },
        commuteMode: 'public_transit',
      },
    };
  }

  const familyName = typeof profile.familyName === 'string' ? profile.familyName.slice(0, 80).trim() : 'Household';
  const rawMembers = Array.isArray(profile.members) ? profile.members.slice(0, 20) : [];

  const members = rawMembers.map((m: any, idx: number) => ({
    id: typeof m.id === 'string' ? m.id.slice(0, 40) : `m-${idx}`,
    name: typeof m.name === 'string' ? m.name.slice(0, 50).trim() : `Member ${idx + 1}`,
    age: typeof m.age === 'number' ? Math.min(120, Math.max(0, m.age)) : 30,
    relation: typeof m.relation === 'string' ? m.relation.slice(0, 30) : 'other',
    conditions: Array.isArray(m.conditions) ? m.conditions.map((c: any) => String(c).slice(0, 40)) : ['none'],
    isVulnerable: Boolean(m.isVulnerable),
  }));

  const home = {
    hasAirPurifier: Boolean(profile.home?.hasAirPurifier),
    purifierCount: typeof profile.home?.purifierCount === 'number' ? Math.max(0, Math.min(20, profile.home.purifierCount)) : 0,
    hasAcWithFilter: Boolean(profile.home?.hasAcWithFilter),
  };

  const commuteMode = typeof profile.commuteMode === 'string' ? profile.commuteMode.slice(0, 40) : 'public_transit';

  return {
    valid: true,
    data: { familyName, members, home, commuteMode },
  };
}
