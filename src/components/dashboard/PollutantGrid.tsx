import React from 'react';
import { PollutantLevels } from '../../types/aqi';

interface PollutantGridProps {
  pollutants: PollutantLevels;
}

interface PollutantDetail {
  name: string;
  formula: string;
  value: number;
  unit: string;
  safeLimit: number;
  description: string;
  primarySource: string;
}

export const PollutantGrid: React.FC<PollutantGridProps> = ({ pollutants }) => {
  const list: PollutantDetail[] = [
    {
      name: 'Fine Particulates',
      formula: 'PM2.5',
      value: pollutants.pm25,
      unit: 'µg/m³',
      safeLimit: 15,
      description: 'Microscopic particles that penetrate deep into alveolar sacs and bloodstream.',
      primarySource: 'Combustion, vehicular exhaust, biomass/stubble burning',
    },
    {
      name: 'Coarse Particulates',
      formula: 'PM10',
      value: pollutants.pm10,
      unit: 'µg/m³',
      safeLimit: 45,
      description: 'Inhalable dust that irritates nasal passages, trachea, and bronchial tubes.',
      primarySource: 'Road dust, construction debris, mechanical wear',
    },
    {
      name: 'Nitrogen Dioxide',
      formula: 'NO₂',
      value: pollutants.no2 ?? 42,
      unit: 'µg/m³',
      safeLimit: 25,
      description: 'Toxic reddish-brown gas that triggers airway inflammation and childhood asthma.',
      primarySource: 'Automobile tailpipes, diesel trucks, power stations',
    },
    {
      name: 'Carbon Monoxide',
      formula: 'CO',
      value: pollutants.co ?? 1.4,
      unit: 'mg/m³',
      safeLimit: 4.0,
      description: 'Odourless gas reducing oxygen-carrying capacity of hemoglobin in blood.',
      primarySource: 'Idling engines, bio-waste burning, unvented heaters',
    },
    {
      name: 'Sulphur Dioxide',
      formula: 'SO₂',
      value: pollutants.so2 ?? 16,
      unit: 'µg/m³',
      safeLimit: 40,
      description: 'Pungent irritant causing severe bronchospasm and precursor to acid rain.',
      primarySource: 'Coal power plants, heavy fuel oil, metal smelting',
    },
    {
      name: 'Ground-level Ozone',
      formula: 'O₃',
      value: pollutants.o3 ?? 24,
      unit: 'µg/m³',
      safeLimit: 100,
      description: 'Secondary photochemical smog formed when VOCs and NOx react in sunlight.',
      primarySource: 'Photochemical reaction between sunlight & exhaust',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {list.map((item) => {
        const ratio = item.value / item.safeLimit;
        const isElevated = ratio > 1;
        const isCritical = ratio > 3;

        let badgeColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
        if (isCritical) {
          badgeColor = 'bg-rose-500/15 text-rose-400 border-rose-500/40';
        } else if (isElevated) {
          badgeColor = 'bg-amber-500/15 text-amber-400 border-amber-500/30';
        }

        return (
          <div
            key={item.formula}
            className="rounded-xl bg-slate-900/90 border border-slate-800 p-4 flex flex-col justify-between hover:border-slate-700 transition-all group"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-mono text-slate-300">
                  {item.formula}
                </span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badgeColor}`}>
                  {ratio.toFixed(1)}× Safe Limit
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 truncate">{item.name}</p>
            </div>

            <div className="my-3">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black font-mono text-white tracking-tight">
                  {item.value}
                </span>
                <span className="text-xs text-slate-400 font-medium">{item.unit}</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                {item.description}
              </p>
            </div>

            <div className="pt-2 border-t border-slate-800/80 text-[10px] text-slate-400 flex items-center justify-between">
              <span>Limit: {item.safeLimit} {item.unit}</span>
              <span className="text-slate-500 truncate max-w-[120px]">{item.primarySource}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
