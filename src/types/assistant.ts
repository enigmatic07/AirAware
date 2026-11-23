export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  source?: 'gemini' | 'offline_calibrated_engine';
  model?: string;
  isOfflineFallback?: boolean;
  offlineReason?: string;
  quickActions?: {
    label: string;
    actionPrompt: string;
  }[];
}

export interface DailyRoutinePlan {
  overallRiskLevel: 'Low' | 'Moderate' | 'High' | 'Critical' | 'Hazardous';
  headline: string;
  ventilationGuidance: {
    canVentilate: boolean;
    safeWindowStart?: string;
    safeWindowEnd?: string;
    ventilationInstructions: string;
  };
  householdActionItems: {
    targetMember: string;
    action: string;
    priority: 'Must Do' | 'Recommended' | 'Optional';
    reasoning: string;
  }[];
  transitAdvice: {
    recommendedMode: string;
    commutePrecautions: string;
    exposureReductionPct: number;
  };
  indoorAirQualityHack: {
    hackTitle: string;
    instructions: string;
    estimatedCost: string;
  };
  // Metadata on provenance
  source?: 'gemini' | 'offline_calibrated_engine';
  model?: string;
  isOfflineFallback?: boolean;
  offlineReason?: string;
}
