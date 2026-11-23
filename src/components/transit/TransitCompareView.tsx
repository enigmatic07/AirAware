import React, { useState } from 'react';
import {
  Navigation,
  Train,
  Bus,
  Car,
  Bike,
  Footprints,
  PlusCircle,
  Check
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface TransitMode {
  id: string;
  name: string;
  icon: any;
  exposureRisk: 'Very Low' | 'Moderate' | 'High' | 'Severe Hazard';
  exposureRiskColor: string;
  breathingRateM3H: number; // Volume of air inhaled per hour (m3/h)
  pmInfiltrationFactor: number; // % of ambient outdoor PM2.5 that reaches lungs inside this mode
  co2GramsPerKm: number; // grams of CO2 per passenger-km
  commuteSpeedKmh: number;
  recommendation: string;
}

export const TransitCompareView: React.FC = () => {
  const { currentAqi, logHabit } = useApp();
  const [distanceKm, setDistanceKm] = useState<number>(15);
  const [loggedModeId, setLoggedModeId] = useState<string | null>(null);

  const ambientPm25 = currentAqi?.pollutants.pm25 || 180;

  const modes: TransitMode[] = [
    {
      id: 'metro',
      name: 'Delhi Metro / Rapid Rail',
      icon: Train,
      exposureRisk: 'Very Low',
      exposureRiskColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
      breathingRateM3H: 0.55,
      pmInfiltrationFactor: 0.18, // Heavy commercial HVAC filters
      co2GramsPerKm: 14,
      commuteSpeedKmh: 36,
      recommendation: 'Optimal choice: Heavy central HVAC filtration shields passengers from 80%+ of roadside tailpipe smog.',
    },
    {
      id: 'electric_bus',
      name: 'AC Electric / City Bus',
      icon: Bus,
      exposureRisk: 'Moderate',
      exposureRiskColor: 'text-teal-400 bg-teal-500/10 border-teal-500/30',
      breathingRateM3H: 0.60,
      pmInfiltrationFactor: 0.35,
      co2GramsPerKm: 28,
      commuteSpeedKmh: 20,
      recommendation: 'Low carbon footprint. Wear an N95 when boarding and disembarking at open-air bus stops.',
    },
    {
      id: 'carpool_ac',
      name: 'Carpool / Cab (AC Recirculate)',
      icon: Car,
      exposureRisk: 'Moderate',
      exposureRiskColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
      breathingRateM3H: 0.55,
      pmInfiltrationFactor: 0.30,
      co2GramsPerKm: 55, // shared across passengers
      commuteSpeedKmh: 28,
      recommendation: 'Crucial: Switch AC to "Internal Cabin Recirculation". Never leave fresh-air intake open in bumper-to-bumper traffic.',
    },
    {
      id: 'solo_car',
      name: 'Private Solo Car (Petrol/Diesel)',
      icon: Car,
      exposureRisk: 'Moderate',
      exposureRiskColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
      breathingRateM3H: 0.55,
      pmInfiltrationFactor: 0.30,
      co2GramsPerKm: 180,
      commuteSpeedKmh: 28,
      recommendation: 'Highest personal emissions. Consider alternating with metro or carpooling during peak winter smog.',
    },
    {
      id: 'two_wheeler',
      name: 'Motorbike / Scooter (2-Wheeler)',
      icon: Bike,
      exposureRisk: 'Severe Hazard',
      exposureRiskColor: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
      breathingRateM3H: 0.90,
      pmInfiltrationFactor: 1.0, // direct ambient air intake
      co2GramsPerKm: 45,
      commuteSpeedKmh: 26,
      recommendation: 'Severe risk: Commuters sit directly in the turbulent wake of diesel bus and truck tailpipes. Certified N95 mandatory.',
    },
    {
      id: 'walk_cycle',
      name: 'Cycling / Brisk Walking',
      icon: Footprints,
      exposureRisk: currentAqi && currentAqi.currentAqi > 200 ? 'Severe Hazard' : 'Very Low',
      exposureRiskColor: currentAqi && currentAqi.currentAqi > 200
        ? 'text-rose-400 bg-rose-500/10 border-rose-500/30'
        : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
      breathingRateM3H: 2.4, // Exercise minute volume surges 4-5x
      pmInfiltrationFactor: 1.0,
      co2GramsPerKm: 0,
      commuteSpeedKmh: 12,
      recommendation: currentAqi && currentAqi.currentAqi > 200
        ? 'Emergency caution: Inhaled particulate dosage spikes 8x due to elevated minute volume. DO NOT cycle or jog in high smog.'
        : 'Zero emissions and excellent cardiovascular health benefit when AQI is favorable.',
    },
  ];

  const handleLogTransit = (mode: TransitMode) => {
    const travelTimeHours = distanceKm / mode.commuteSpeedKmh;
    const inhaledPmUg = Math.round(
      ambientPm25 * mode.pmInfiltrationFactor * mode.breathingRateM3H * travelTimeHours
    );
    const soloCarCo2 = distanceKm * 180;
    const modeCo2 = distanceKm * mode.co2GramsPerKm;
    const co2Saved = Math.max(0, soloCarCo2 - modeCo2);

    logHabit({
      category: 'transport',
      title: `Took ${mode.name} for ${distanceKm} km commute`,
      description: `Avoided ${co2Saved}g CO2 vs solo driving and limited personal inhaled PM2.5 to ${inhaledPmUg} µg.`,
      co2SavedGrams: co2Saved,
      pmExposureAvoidedUg: Math.max(0, 300 - inhaledPmUg),
      cleanAirMinutes: Math.round(travelTimeHours * 60),
    });

    setLoggedModeId(mode.id);
    setTimeout(() => setLoggedModeId(null), 3000);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
            <Navigation className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Sustainable Commute & Inhaled Dose Comparator</h2>
            <p className="text-xs text-slate-400">
              Calculate toxic particulate inhalation dosage ($PM_{2.5}$) versus carbon footprint ($CO_2$)
            </p>
          </div>
        </div>

        {/* Distance Slider */}
        <div className="flex items-center gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
          <span className="text-xs font-semibold text-slate-300 whitespace-nowrap">
            Commute Distance:
          </span>
          <input
            type="range"
            min="2"
            max="40"
            step="1"
            value={distanceKm}
            onChange={(e) => setDistanceKm(Number(e.target.value))}
            className="w-28 sm:w-36 accent-teal-400"
          />
          <span className="text-sm font-bold font-mono text-teal-400 w-12">
            {distanceKm} km
          </span>
        </div>
      </div>

      {/* Transit Modes Comparison Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {modes.map((mode) => {
          const travelTimeHours = distanceKm / mode.commuteSpeedKmh;
          const travelTimeMins = Math.round(travelTimeHours * 60);

          // Inhaled particulate dosage: Concentration * Infiltration * Breathing Rate * Duration
          const inhaledPmUg = Math.round(
            ambientPm25 * mode.pmInfiltrationFactor * mode.breathingRateM3H * travelTimeHours
          );

          // Carbon footprint
          const tripCo2Grams = Math.round(distanceKm * mode.co2GramsPerKm);
          const isRecentlyLogged = loggedModeId === mode.id;

          return (
            <div
              key={mode.id}
              className="rounded-2xl bg-slate-900 border border-slate-800 p-5 flex flex-col justify-between hover:border-slate-700 transition-all shadow-lg"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-slate-800 text-teal-400">
                      <mode.icon className="w-5 h-5" />
                    </div>
                    <span className="text-sm font-bold text-white">{mode.name}</span>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">
                    Inhalation Risk:
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${mode.exposureRiskColor}`}>
                    {mode.exposureRisk}
                  </span>
                </div>

                {/* Metrics Breakdown */}
                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-800/80 font-mono">
                  <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">Inhaled PM2.5</span>
                    <span className={`text-base font-bold ${inhaledPmUg > 100 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {inhaledPmUg} µg
                    </span>
                  </div>

                  <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">Carbon Footprint</span>
                    <span className="text-base font-bold text-cyan-400">
                      {tripCo2Grams} g CO₂
                    </span>
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Est. Travel Time:</span>
                  <strong className="text-slate-200">{travelTimeMins} mins</strong>
                </div>

                <p className="text-xs text-slate-300 mt-2.5 leading-relaxed bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/50">
                  {mode.recommendation}
                </p>
              </div>

              {/* Action Button */}
              <button
                onClick={() => handleLogTransit(mode)}
                disabled={isRecentlyLogged}
                className={`w-full mt-4 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isRecentlyLogged
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                }`}
              >
                {isRecentlyLogged ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Logged to Impact Tracker!</span>
                  </>
                ) : (
                  <>
                    <PlusCircle className="w-3.5 h-3.5 text-teal-400" />
                    <span>Log this Commute</span>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

    </div>
  );
};
