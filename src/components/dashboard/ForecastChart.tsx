import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import { HourlyForecastPoint } from '../../types/aqi';
import { AQI_LEVELS } from '../../utils/aqiScale';

interface ForecastChartProps {
  forecast: HourlyForecastPoint[];
}

export const ForecastChart: React.FC<ForecastChartProps> = ({ forecast }) => {
  const [metric, setMetric] = useState<'aqi' | 'pm'>('aqi');

  if (!forecast || forecast.length === 0) {
    return (
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 flex items-center justify-center text-slate-500 text-sm">
        No forecast data currently available.
      </div>
    );
  }

  // Find min & max for smart chart scaling
  const maxVal = Math.max(...forecast.map((f) => (metric === 'aqi' ? f.aqi : f.pm25)));
  const yDomainMax = Math.ceil((maxVal * 1.15) / 50) * 50;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data: HourlyForecastPoint = payload[0].payload;
      const meta = AQI_LEVELS[data.severity];

      return (
        <div className="rounded-xl bg-slate-900/95 border border-slate-700 p-3 shadow-2xl backdrop-blur-md text-xs">
          <div className="font-semibold text-slate-300 border-b border-slate-800 pb-1 mb-2">
            Time: {label}
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-400">AQI:</span>
              <span className="font-bold font-mono" style={{ color: meta.color }}>
                {data.aqi} ({data.severity})
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-400">PM2.5:</span>
              <span className="font-mono text-white font-semibold">{data.pm25} µg/m³</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-400">PM10:</span>
              <span className="font-mono text-slate-300">{data.pm10} µg/m³</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            24-Hour Pollution & Inversion Forecast
          </h3>
          <p className="text-xs text-slate-400">
            Diurnal curve highlighting morning thermal inversion spikes and afternoon mixing windows.
          </p>
        </div>

        {/* Metric Toggle */}
        <div className="flex items-center rounded-xl bg-slate-950 p-1 border border-slate-800 text-xs self-start sm:self-auto">
          <button
            onClick={() => setMetric('aqi')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              metric === 'aqi'
                ? 'bg-teal-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            AQI Trend
          </button>
          <button
            onClick={() => setMetric('pm')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              metric === 'pm'
                ? 'bg-teal-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            PM2.5 / PM10 (µg/m³)
          </button>
        </div>
      </div>

      {/* Recharts Area Container */}
      <div className="w-full h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={forecast} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="aqiAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.6} />
                <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="pmAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.6} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />

            <XAxis
              dataKey="time"
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#334155' }}
            />

            <YAxis
              stroke="#64748b"
              fontSize={11}
              domain={[0, yDomainMax]}
              tickLine={false}
              axisLine={{ stroke: '#334155' }}
            />

            <Tooltip content={<CustomTooltip />} />

            {/* Critical severity benchmark lines */}
            {metric === 'aqi' && (
              <>
                <ReferenceLine
                  y={300}
                  stroke="#ef4444"
                  strokeDasharray="4 4"
                  label={{ value: 'Severe (300)', fill: '#ef4444', fontSize: 10, position: 'right' }}
                />
                <ReferenceLine
                  y={100}
                  stroke="#eab308"
                  strokeDasharray="4 4"
                  label={{ value: 'Moderate (100)', fill: '#eab308', fontSize: 10, position: 'right' }}
                />
              </>
            )}

            {metric === 'aqi' ? (
              <Area
                type="monotone"
                dataKey="aqi"
                stroke="#14b8a6"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#aqiAreaGrad)"
                name="AQI"
              />
            ) : (
              <>
                <Area
                  type="monotone"
                  dataKey="pm10"
                  stroke="#64748b"
                  strokeWidth={1.5}
                  fillOpacity={0.1}
                  fill="#64748b"
                  name="PM10"
                />
                <Area
                  type="monotone"
                  dataKey="pm25"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#pmAreaGrad)"
                  name="PM2.5"
                />
              </>
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between text-[11px] text-slate-500 border-t border-slate-800 pt-3 gap-2">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-400" /> Hourly Projected Curve
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400" /> Severe Threshold (&gt;300)
          </span>
        </div>
        <span className="italic">
          * Winter diurnal peaks typically occur at 07:00-09:30 and 20:00-23:00.
        </span>
      </div>
    </div>
  );
};
