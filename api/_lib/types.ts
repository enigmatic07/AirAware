export interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
  source: 'gemini';
  model: string;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  code: 
    | 'SERVER_KEY_MISSING'
    | 'INVALID_API_KEY'
    | 'QUOTA_EXCEEDED'
    | 'RATE_LIMITED'
    | 'SERVICE_UNAVAILABLE'
    | 'INVALID_PAYLOAD'
    | 'INVALID_AUTH_TOKEN'
    | 'INVALID_AI_RESPONSE'
    | 'REQUEST_TIMEOUT'
    | 'INTERNAL_ERROR';
  details?: string;
}

export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface AssistantRequestBody {
  message: string;
  aqiSnapshot: {
    city: string;
    currentAqi: number;
    severity: string;
    dominantPollutant: string;
    pollutants: {
      pm25: number;
      pm10: number;
      no2?: number;
      so2?: number;
      co?: number;
      o3?: number;
    };
  };
  profile: {
    familyName: string;
    members: Array<{
      id: string;
      name: string;
      age: number;
      relation: string;
      conditions: string[];
      isVulnerable: boolean;
    }>;
    home: {
      hasAirPurifier: boolean;
      purifierCount: number;
      hasAcWithFilter: boolean;
    };
    commuteMode: string;
  };
}

export interface RecommendationsRequestBody {
  aqiSnapshot: AssistantRequestBody['aqiSnapshot'];
  profile: AssistantRequestBody['profile'];
}
