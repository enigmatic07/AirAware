import React from 'react';
import { RefreshCw } from 'lucide-react';
import { AirQualitySnapshot } from '../../types/aqi';
import { AQI_LEVELS } from '../../utils/aqiScale';

interface AqiGaugeProps {
  data: AirQualitySnapshot;
  onRefresh: () => void;
  isLoading: boolean;
}

export const AqiGauge: React.FC<AqiGaugeProps> = ({ data, onRefresh, isLoading }) => {
  const meta = AQI_LEVELS[data.severity];
  const whoPm25Limit = 15; // WHO 24-hr guideline is 15 ug/m3
  const whoMultiplier = (data.pollutants.pm25 / whoPm25Limit).toFixed(1);

  // SVG Gauge Calculations (180-degree semi-circle gauge)
  const radius = 95;
  const circumference = Math.PI * radius; // 180 degrees arc
  const aqiClamped = Math.min(Math.max(data.currentAqi, 0), 500);
  const strokeDashoffset = circumference - (aqiClamped / 500) * circumference;

  return (
    <div className="relative rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 p-6 shadow-xl flex flex-col justify-between overflow-hidden">
      {/* Background ambient glow corresponding to AQI severity */}
      <div
        className="absolute -top-24 -right-24 w-64 h-64 rounded-full blur-3xl opacity-20 pointer-events-none transition-colors duration-700"
        style={{ backgroundColor: meta.color }}
      />

      {/* Header bar */}
      <div className="flex items-center justify-between z-10">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Live Air Quality Index (NAQI)
          </span>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            {data.city}
            {data.stationName && (
              <span className="text-xs font-normal text-slate-400 hidden sm:inline">
                ({data.stationName})
              </span>
            )}
          </h2>
        </div>

        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 text-slate-300 hover:text-white transition-all disabled:opacity-50"
          title="Refresh Station Data"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Semi-circular Radial Gauge */}
      <div className="relative flex flex-col items-center justify-center my-6 z-10">
        <svg className="w-64 h-36 overflow-visible" viewBox="0 0 220 120">
          <defs>
            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="25%" stopColor="#eab308" />
              <stop offset="50%" stopColor="#f97316" />
              <stop offset="75%" stopColor="#ef4444" />
              <stop offset="90%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#881337" />
            </linearGradient>
          </defs>

          {/* Background Track Arc */}
          <path
            d="M 15 110 A 95 95 0 0 1 205 110"
            fill="none"
            stroke="#1e293b"
            strokeWidth="16"
            strokeLinecap="round"
          />

          {/* Value Progress Arc */}
          <path
            d="M 15 110 A 95 95 0 0 1 205 110"
            fill="none"
            stroke="url(#gaugeGradient)"
            strokeWidth="16"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>

        {/* Center Display: Numeric AQI */}
        <div className="absolute top-10 flex flex-col items-center text-center">
          <div className="flex items-baseline gap-1">
            <span
              className="text-6xl font-black tracking-tight font-mono transition-colors duration-500"
              style={{ color: meta.color }}
            >
              {data.currentAqi}
            </span>
            <span className="text-xs text-slate-400 font-semibold uppercase">AQI</span>
          </div>

          <div
            className="mt-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border shadow-sm"
            style={{
              backgroundColor: `${meta.color}20`,
              borderColor: `${meta.color}50`,
              color: meta.color,
            }}
          >
            {data.severity}
          </div>
        </div>
      </div>

      {/* Primary Pollutant & WHO comparison callouts */}
      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-800/80 z-10 text-xs">
        <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between">
          <span className="text-slate-400 font-medium">Dominant Pollutant</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-base font-bold text-white font-mono">
              {data.dominantPollutant}
            </span>
            <span className="text-slate-300 font-semibold font-mono">
              {data.pollutants.pm25} µg/m³
            </span>
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between">
          <span className="text-slate-400 font-medium">WHO Safe Limit</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span
              className={`text-base font-bold font-mono ${
                Number(whoMultiplier) > 1 ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {whoMultiplier}×
            </span>
            <span className="text-slate-400 text-[11px]">
              {Number(whoMultiplier) > 1 ? 'Above limit (15µg)' : 'Within limit'}
            </span>
          </div>
        </div>
      </div>

      {/* Source attribution & sync time */}
      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 z-10">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-ping" />
          {data.dataSource === 'cpcb'
            ? 'Ground Truth: CAAQMS'
            : data.dataSource === 'hybrid'
            ? 'Hybrid: Ground CAAQMS + Satellite'
            : 'Open-Meteo High-Res Model'}
        </span>
        <span>Updated: {data.lastUpdated}</span>
      </div>
    </div>
  );
};
