import { AQISeverity } from '../types/aqi';

export interface AQILevelMeta {
  severity: AQISeverity;
  range: [number, number];
  color: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  label: string;
  advisoryGeneral: string;
  advisorySensitive: string;
  maskRecommended: 'None' | 'Optional' | 'N95 Recommended' | 'N95 Mandatory';
  outdoorActivity: 'Safe' | 'Acceptable' | 'Reduce' | 'Avoid Strenuous' | 'Avoid All';
}

export const AQI_LEVELS: Record<AQISeverity, AQILevelMeta> = {
  Good: {
    severity: 'Good',
    range: [0, 50],
    color: '#10b981', // emerald-500
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    textColor: 'text-emerald-400',
    label: 'Good',
    advisoryGeneral: 'Air quality is satisfactory and poses little or no risk.',
    advisorySensitive: 'Ideal for all outdoor activities and natural room ventilation.',
    maskRecommended: 'None',
    outdoorActivity: 'Safe',
  },
  Moderate: {
    severity: 'Moderate',
    range: [51, 100],
    color: '#eab308', // yellow-500
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
    textColor: 'text-yellow-400',
    label: 'Moderate / Satisfactory',
    advisoryGeneral: 'Air quality is acceptable. Pollutants are moderately elevated.',
    advisorySensitive: 'Unusually sensitive individuals may experience slight respiratory irritation.',
    maskRecommended: 'Optional',
    outdoorActivity: 'Acceptable',
  },
  Poor: {
    severity: 'Poor',
    range: [101, 200],
    color: '#f97316', // orange-500
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
    textColor: 'text-orange-400',
    label: 'Poor',
    advisoryGeneral: 'Breathing discomfort likely to people with asthma and heart disease.',
    advisorySensitive: 'Children, seniors, and asthmatics should limit prolonged outdoor exertion.',
    maskRecommended: 'Optional',
    outdoorActivity: 'Reduce',
  },
  'Very Poor': {
    severity: 'Very Poor',
    range: [201, 300],
    color: '#ef4444', // red-500
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    textColor: 'text-red-400',
    label: 'Very Poor / Unhealthy',
    advisoryGeneral: 'Prolonged exposure may trigger respiratory illness even in healthy adults.',
    advisorySensitive: 'Vulnerable members must stay indoors. Keep windows closed.',
    maskRecommended: 'N95 Recommended',
    outdoorActivity: 'Avoid Strenuous',
  },
  Severe: {
    severity: 'Severe',
    range: [301, 400],
    color: '#a855f7', // purple-500
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    textColor: 'text-purple-400',
    label: 'Severe',
    advisoryGeneral: 'Hazardous air impacts healthy people and severely harms those with existing diseases.',
    advisorySensitive: 'Zero outdoor exertion. Run indoor air purifiers or DIY HEPA units continuously.',
    maskRecommended: 'N95 Mandatory',
    outdoorActivity: 'Avoid All',
  },
  Hazardous: {
    severity: 'Hazardous',
    range: [401, 999],
    color: '#881337', // rose-950 / deep maroon
    bgColor: 'bg-rose-950/20',
    borderColor: 'border-rose-600/40',
    textColor: 'text-rose-400',
    label: 'Hazardous / Emergency',
    advisoryGeneral: 'Health emergency. The entire population is at severe risk of acute toxic inhalation.',
    advisorySensitive: 'Strict isolation indoors. Seal door and window drafts. Seek tele-health if wheezing occurs.',
    maskRecommended: 'N95 Mandatory',
    outdoorActivity: 'Avoid All',
  },
};

/**
 * Returns the AQI severity category given an AQI number
 */
export function getAQISeverity(aqi: number): AQISeverity {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 200) return 'Poor';
  if (aqi <= 300) return 'Very Poor';
  if (aqi <= 400) return 'Severe';
  return 'Hazardous';
}

/**
 * Approximate conversion from PM2.5 (ug/m3) to Indian NAQI scale
 */
export function pm25ToIndianAqi(pm25: number): number {
  if (pm25 <= 30) return Math.round((50 / 30) * pm25);
  if (pm25 <= 60) return Math.round(50 + ((50 / 30) * (pm25 - 30)));
  if (pm25 <= 90) return Math.round(100 + ((100 / 30) * (pm25 - 60)));
  if (pm25 <= 120) return Math.round(200 + ((100 / 30) * (pm25 - 90)));
  if (pm25 <= 250) return Math.round(300 + ((100 / 130) * (pm25 - 120)));
  return Math.min(500, Math.round(400 + ((100 / 130) * (pm25 - 250))));
}
