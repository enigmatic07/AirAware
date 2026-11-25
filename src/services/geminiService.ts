import { AirQualitySnapshot } from '../types/aqi';
import { UserHouseholdProfile } from '../types/profile';
import { DailyRoutinePlan } from '../types/assistant';
import { auth } from './firebase';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (auth?.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    } catch {
      // Non-blocking token error fallback
    }
  }
  return headers;
}

/**
 * Generates an intelligent routine plan via the secure backend proxy endpoint (/api/recommendations).
 * Never communicates directly with Google Gemini from the browser.
 */
export async function generatePersonalizedRoutine(
  aqiSnapshot: AirQualitySnapshot,
  profile: UserHouseholdProfile
): Promise<DailyRoutinePlan> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/recommendations', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        aqiSnapshot,
        profile,
      }),
    });

    const json = await res.json().catch(() => null);

    if (res.ok && json && json.success && json.data) {
      return {
        ...json.data,
        source: 'gemini',
        model: json.model || 'gemini-3.8-flash',
        isOfflineFallback: false,
      };
    }

    const failureReason = json?.error || `Server responded with status ${res.status}`;
    console.warn('[AirAware Proxy] Recommendations error, activating calibrated offline engine:', failureReason);

    return generateLocalIntelligentRoutine(aqiSnapshot, profile, failureReason);
  } catch (err: any) {
    console.warn('[AirAware Proxy] Network error reaching /api/recommendations:', err.message);
    return generateLocalIntelligentRoutine(aqiSnapshot, profile, 'Network connectivity issue or backend server offline.');
  }
}

/**
 * Sends a message to the AI Assistant via the secure backend proxy endpoint (/api/assistant).
 */
export async function sendChatMessage(
  message: string,
  aqiSnapshot: AirQualitySnapshot,
  profile: UserHouseholdProfile
): Promise<string> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/assistant', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message,
        aqiSnapshot,
        profile,
      }),
    });

    const json = await res.json().catch(() => null);

    if (res.ok && json && json.success && json.data?.reply) {
      return json.data.reply;
    }

    const failureReason = json?.error || `Backend returned status ${res.status}`;
    console.warn('[AirAware Proxy] Assistant error, falling back to calibrated guidelines:', failureReason);

    // Explicitly identify offline content to the user
    return formatOfflineAssistantResponse(message, aqiSnapshot, failureReason);
  } catch (err: any) {
    console.warn('[AirAware Proxy] Network error reaching /api/assistant:', err.message);
    return formatOfflineAssistantResponse(message, aqiSnapshot, 'Backend proxy connection unavailable');
  }
}

/**
 * Intelligent local fallback rule-and-knowledge engine.
 * Explicitly marks provenance as offline_calibrated_engine with the underlying reason.
 */
export function generateLocalIntelligentRoutine(
  aqiSnapshot: AirQualitySnapshot,
  profile: UserHouseholdProfile,
  offlineReason: string = 'Using offline atmospheric heuristics'
): DailyRoutinePlan {
  const aqi = aqiSnapshot.currentAqi;
  const hasVulnerable = profile.members.some(m => m.isVulnerable);
  const asthmaticMembers = profile.members.filter(m => m.conditions.includes('asthma'));
  const children = profile.members.filter(m => m.age < 12);
  const elderly = profile.members.filter(m => m.age >= 60);

  let riskLevel: DailyRoutinePlan['overallRiskLevel'] = 'Moderate';
  if (aqi > 400 || (aqi > 300 && hasVulnerable)) riskLevel = 'Hazardous';
  else if (aqi > 300 || (aqi > 200 && hasVulnerable)) riskLevel = 'Critical';
  else if (aqi > 200) riskLevel = 'High';
  else if (aqi > 100) riskLevel = 'Moderate';
  else riskLevel = 'Low';

  const canVentilate = aqi < 180;
  const safeWindowStart = canVentilate ? '1:30 PM' : 'Not recommended today';
  const safeWindowEnd = canVentilate ? '3:00 PM' : 'Keep windows sealed';
  const ventilationInstructions = aqi > 250
    ? 'DO NOT open windows today. Severe thermal inversion will pull toxic particulate matter indoors. Use wet towel draught excluders along doors.'
    : 'Brief cross-ventilation permitted strictly between 1:30 PM and 3:00 PM when solar heating raises the mixing height.';

  const actionItems: DailyRoutinePlan['householdActionItems'] = [];

  if (asthmaticMembers.length > 0) {
    actionItems.push({
      targetMember: asthmaticMembers.map(m => m.name).join(', '),
      action: 'Keep rescue inhalers accessible; pre-dose if outdoor transit is mandatory.',
      priority: 'Must Do',
      reasoning: `PM2.5 concentration is ${aqiSnapshot.pollutants.pm25} µg/m³, triggering acute bronchial hyper-reactivity.`,
    });
  }

  if (children.length > 0) {
    actionItems.push({
      targetMember: children.map(m => m.name).join(', '),
      action: aqi > 200 ? 'Cancel all outdoor sports; switch to indoor yoga/reading.' : 'Limit playground time to 30 mins after 2 PM.',
      priority: aqi > 200 ? 'Must Do' : 'Recommended',
      reasoning: 'Children breathe 50% more air per pound of body weight than adults.',
    });
  }

  if (elderly.length > 0) {
    actionItems.push({
      targetMember: elderly.map(m => m.name).join(', '),
      action: 'Avoid morning walks before 10 AM. Perform light indoor mobility stretches.',
      priority: 'Must Do',
      reasoning: 'Morning smog spikes with high nitrogen dioxide and carbon monoxide increase cardiovascular strain.',
    });
  }

  if (!profile.home.hasAirPurifier) {
    actionItems.push({
      targetMember: 'Entire Household',
      action: 'Assemble a low-cost DIY HEPA Box-Fan Filter in the primary bedroom.',
      priority: 'Recommended',
      reasoning: 'Cuts indoor PM2.5 by up to 75% for under ₹2,000 / $25.',
    });
  } else {
    actionItems.push({
      targetMember: 'Entire Household',
      action: 'Run primary air purifiers on High in occupied bedrooms, sealed with doors closed.',
      priority: 'Must Do',
      reasoning: 'Air changes per hour (ACH) must remain above 3 to prevent indoor particulate accumulation.',
    });
  }

  let recommendedMode = 'Metro / Rapid Rail with N95 mask';
  let commutePrecautions = 'Wear an authentic certified N95 or FFP2 respirator. Pinch the nose clip tightly.';
  let exposureReductionPct = 68;

  if (profile.commuteMode === 'two_wheeler') {
    commutePrecautions = 'Two-wheelers experience 4x direct particulate intake. If possible, switch to Metro or carpool in a recirculated-AC vehicle.';
    exposureReductionPct = 82;
  } else if (profile.commuteMode === 'remote') {
    recommendedMode = 'Work From Home (Zero Transit)';
    commutePrecautions = 'Remain indoors during the peak morning inversion.';
    exposureReductionPct = 95;
  }

  return {
    overallRiskLevel: riskLevel,
    headline: aqi > 300 
      ? `Severe Smog Emergency in ${aqiSnapshot.city}: Prioritize Indoor Sealing & Inhalation Defense`
      : `Moderate Pollution Advisory for ${aqiSnapshot.city}: Optimize Routine to Avoid Morning Inversion Peak`,
    ventilationGuidance: {
      canVentilate,
      safeWindowStart,
      safeWindowEnd,
      ventilationInstructions,
    },
    householdActionItems: actionItems,
    transitAdvice: {
      recommendedMode,
      commutePrecautions,
      exposureReductionPct,
    },
    indoorAirQualityHack: {
      hackTitle: profile.home.hasAirPurifier 
        ? 'Wet-Mop & Microfiber Protocol (No Dry Sweeping)'
        : 'DIY Box-Fan HEPA Hack (Corsi-Rosenthal Minimal)',
      instructions: profile.home.hasAirPurifier
        ? 'Never use dry brooms today—they re-suspend settled fine particles into breathing zones. Damp-mop floors twice daily.'
        : 'Tape a standard MERV-13 or True HEPA furnace filter to the back of an ordinary box fan. Ensure airtight tape edges.',
      estimatedCost: profile.home.hasAirPurifier ? 'Free' : '₹1,500 - ₹2,200 ($18 - $26)',
    },
    source: 'offline_calibrated_engine',
    isOfflineFallback: true,
    offlineReason,
  };
}

/**
 * Formats an offline fallback assistant response with clear, transparent disclosure.
 */
function formatOfflineAssistantResponse(
  message: string,
  aqiSnapshot: AirQualitySnapshot,
  reason: string
): string {
  const disclosurePrefix = `> ⚠️ **Notice**: Gemini live AI service is currently unavailable (*${reason}*). Displaying verified offline environmental guidelines:\n\n`;

  const lower = message.toLowerCase();
  if (lower.includes('child') || lower.includes('kid') || lower.includes('play') || lower.includes('school')) {
    return `${disclosurePrefix}### Child Protection Guidelines for AQI ${aqiSnapshot.currentAqi} (${aqiSnapshot.severity})\n\n1. **Outdoor Exposure**: At an AQI of ${aqiSnapshot.currentAqi}, all outdoor school sports should be paused. Children breathe faster and their lungs are still developing.\n2. **Masking**: If traveling to school, ensure your child wears an authentic KF94 or child-sized N95. Cloth masks provide negligible (<10%) filtration against fine PM2.5.\n3. **Indoor Games**: Encourage quiet indoor board games or puzzles instead of vigorous running inside unless an air purifier is running.`;
  }
  if (lower.includes('purifier') || lower.includes('filter') || lower.includes('diy') || lower.includes('cost')) {
    return `${disclosurePrefix}### DIY Box-Fan Air Purifier Guide (Corsi-Rosenthal Minimal)\n\nIf commercial purifiers are costly or sold out:\n\n1. **Materials Needed**:\n   - Standard 20-inch box fan (or table fan with flat grill)\n   - One MERV-13 or True HEPA filter sheet\n   - Duct tape or masking tape\n2. **Assembly**:\n   - Check the airflow arrow on the filter sheet.\n   - Securely tape the filter flush against the **back (intake)** of the fan.\n   - Seal all 4 edges so air is forced *through* the filter rather than leaking around it.\n3. **Performance**:\n   - Achieves 70–80% single-pass PM2.5 reduction!`;
  }
  if (lower.includes('walk') || lower.includes('exercise') || lower.includes('run') || lower.includes('morning')) {
    return `${disclosurePrefix}### Exercise & Morning Activity Advisory\n\n- **Current AQI**: ${aqiSnapshot.currentAqi} (${aqiSnapshot.severity})\n- **Recommendation**: **Do NOT exercise outdoors today**.\n- **Scientific Reasoning**: During strenuous running or brisk walking, minute ventilation increases from $6\\text{ L/min}$ to over $50\\text{ L/min}$, driving toxic combustion particles deep into alveolar tissue.\n- **Alternative**: Perform indoor yoga or light stretching with closed windows.`;
  }

  return `${disclosurePrefix}### AirAware Advisory for ${aqiSnapshot.city} (AQI ${aqiSnapshot.currentAqi} - ${aqiSnapshot.severity})\n\nWith ambient $PM_{2.5}$ at **${aqiSnapshot.pollutants.pm25} µg/m³**, atmospheric pollution is in the **${aqiSnapshot.severity}** bracket.\n\n**Immediate Steps:**\n1. **Indoor Air Isolation**: Keep all external doors and windows firmly shut.\n2. **High-Efficiency Filtration**: Run air purifiers in the most occupied room.\n3. **Commute Protection**: Wear a certified N95 respirator when in transit.`;
}
