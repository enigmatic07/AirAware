import React from 'react';
import { ShieldCheck, DoorClosed, HeartPulse, UserX } from 'lucide-react';
import { AirQualitySnapshot } from '../../types/aqi';
import { AQI_LEVELS } from '../../utils/aqiScale';
import { useApp } from '../../context/AppContext';

interface HealthAdvisoryCardProps {
  data: AirQualitySnapshot;
}

export const HealthAdvisoryCard: React.FC<HealthAdvisoryCardProps> = ({ data }) => {
  const { householdProfile, setActiveTab } = useApp();
  const meta = AQI_LEVELS[data.severity];
  const vulnerableMembers = householdProfile.members.filter(m => m.isVulnerable);

  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-xl flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Household Safety Protocols</h3>
              <p className="text-xs text-slate-400">Tailored to current {data.severity} exposure</p>
            </div>
          </div>

          <button
            onClick={() => setActiveTab('routines')}
            className="text-xs font-semibold text-teal-400 hover:text-teal-300 transition-colors"
          >
            Optimize Routine →
          </button>
        </div>

        <div className="space-y-3">
          {/* Outdoor Activity Rule */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-start gap-3">
            <div className="p-1.5 rounded-lg bg-slate-800 text-slate-300 shrink-0 mt-0.5">
              <UserX className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-200">Outdoor Exertion:</span>
                <span
                  className="text-xs font-bold px-2 py-0.2 rounded"
                  style={{ backgroundColor: `${meta.color}20`, color: meta.color }}
                >
                  {meta.outdoorActivity}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {data.currentAqi > 300
                  ? 'Zero running, cycling, or strenuous walking. Inhaled particulate dosage spikes 8× during exertion.'
                  : meta.advisoryGeneral}
              </p>
            </div>
          </div>

          {/* Masking Rule */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-start gap-3">
            <div className="p-1.5 rounded-lg bg-slate-800 text-slate-300 shrink-0 mt-0.5">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-200">Mask Protection:</span>
                <span className="text-xs font-bold text-teal-400">
                  {meta.maskRecommended}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Cloth and surgical masks do not block PM2.5. Wear a certified N95, FFP2, or KF94 with an airtight nose-bridge seal.
              </p>
            </div>
          </div>

          {/* Ventilation Status */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-start gap-3">
            <div className="p-1.5 rounded-lg bg-slate-800 text-slate-300 shrink-0 mt-0.5">
              <DoorClosed className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-200">Room Ventilation:</span>
                <span className={`text-xs font-bold ${data.currentAqi > 200 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {data.currentAqi > 200 ? 'Windows Sealed' : 'Brief Ventilation Permitted'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {data.currentAqi > 200
                  ? 'Inversion conditions will contaminate your indoor sanctuary. Keep all balconies and exterior windows tightly shut.'
                  : 'Open windows only during afternoon solar convection (1:00 PM – 3:30 PM).'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Household Vulnerability Callout */}
      {vulnerableMembers.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between bg-rose-950/20 rounded-xl p-3 border border-rose-500/20">
          <div className="flex items-center gap-2">
            <HeartPulse className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="text-xs text-rose-200">
              <strong>{vulnerableMembers.length} vulnerable</strong> family members protected ({vulnerableMembers.map(m => m.name.split(' ')[0]).join(', ')}).
            </span>
          </div>
          <button
            onClick={() => setActiveTab('assistant')}
            className="text-xs font-bold text-rose-400 hover:text-rose-300 underline shrink-0"
          >
            Ask AI Care Plan
          </button>
        </div>
      )}
    </div>
  );
};
