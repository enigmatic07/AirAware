import React, { useState, useEffect } from 'react';
import {
  CalendarCheck,
  Clock,
  Wind,
  DoorClosed,
  DoorOpen,
  ShieldAlert,
  Sparkles,
  CheckCircle,
  Car,
  Home
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { generatePersonalizedRoutine } from '../../services/geminiService';
import { DailyRoutinePlan } from '../../types/assistant';

export const DailyRoutineView: React.FC = () => {
  const { currentAqi, householdProfile } = useApp();
  const [routinePlan, setRoutinePlan] = useState<DailyRoutinePlan | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadRoutine = async () => {
    if (!currentAqi) return;
    setIsLoading(true);
    try {
      const plan = await generatePersonalizedRoutine(currentAqi, householdProfile);
      setRoutinePlan(plan);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRoutine();
  }, [currentAqi, householdProfile]);

  if (!currentAqi) return null;

  const hourlyWindows = [
    {
      time: '06:00 - 09:30 AM',
      title: 'Dawn Radiation Inversion Peak',
      aqiEstimate: Math.round(currentAqi.currentAqi * 1.25),
      risk: 'Extreme Hazard',
      recommendation: 'Strict lockdown. No morning walks, jogging, or outdoor school assemblies.',
      icon: ShieldAlert,
      color: 'text-rose-400 bg-rose-950/20 border-rose-500/30',
    },
    {
      time: '09:30 - 12:30 PM',
      title: 'Mid-Morning Transition',
      aqiEstimate: Math.round(currentAqi.currentAqi * 1.05),
      risk: 'High Pollution',
      recommendation: 'Mandatory N95 respirator if stepping outside. Keep office AC on recirculation.',
      icon: Clock,
      color: 'text-amber-400 bg-amber-950/20 border-amber-500/30',
    },
    {
      time: '01:00 - 03:30 PM',
      title: 'Afternoon Solar Mixing Window',
      aqiEstimate: Math.round(currentAqi.currentAqi * 0.75),
      risk: 'Lowest Daily Exposure',
      recommendation: 'Safest window for necessary errands, pharmacy runs, or quick cross-ventilation if AQI < 180.',
      icon: Wind,
      color: 'text-teal-400 bg-teal-950/20 border-teal-500/30',
    },
    {
      time: '04:00 - 07:00 PM',
      title: 'Evening Rush Hour Dust',
      aqiEstimate: Math.round(currentAqi.currentAqi * 1.1),
      risk: 'Very High',
      recommendation: 'Heavy vehicular exhaust and road dust. Pick up children using enclosed transport.',
      icon: Car,
      color: 'text-orange-400 bg-orange-950/20 border-orange-500/30',
    },
    {
      time: '07:30 - 11:00 PM',
      title: 'Night Boundary Inversion',
      aqiEstimate: Math.round(currentAqi.currentAqi * 1.2),
      risk: 'Severe Hazard',
      recommendation: 'Cold surface air traps truck emissions. Seal bedroom windows and run purifiers.',
      icon: Home,
      color: 'text-purple-400 bg-purple-950/20 border-purple-500/30',
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* Banner & Header */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Daily Routine & Inversion Optimizer</h2>
              <p className="text-xs text-slate-400">
                Synchronized with the winter boundary-layer dynamics in {currentAqi.city}
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={loadRoutine}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs transition-all shadow-md shadow-teal-500/20 disabled:opacity-50"
        >
          <Sparkles className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Re-analyze with Gemini</span>
        </button>
      </div>

      {/* Routine Plan Summary Card */}
      {routinePlan && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-6 shadow-xl">
          <div className="border-b border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-400">
                AI Resilience Brief
              </span>
              <h3 className="text-lg font-bold text-white mt-1">{routinePlan.headline}</h3>
            </div>
            <div>
              {routinePlan.source === 'gemini' ? (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-teal-500/10 text-teal-300 border border-teal-500/30 flex items-center gap-1.5 whitespace-nowrap">
                  <Sparkles className="w-3 h-3 text-teal-400" />
                  Live {routinePlan.model || 'Gemini 2.0 Flash'}
                </span>
              ) : (
                <span
                  className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 whitespace-nowrap"
                  title={routinePlan.offlineReason}
                >
                  ⚠️ Calibrated Offline Engine
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Ventilation Guidance */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    {routinePlan.ventilationGuidance.canVentilate ? (
                      <DoorOpen className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <DoorClosed className="w-4 h-4 text-rose-400" />
                    )}
                    Natural Ventilation Status
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      routinePlan.ventilationGuidance.canVentilate
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    }`}
                  >
                    {routinePlan.ventilationGuidance.canVentilate ? 'Permitted' : 'Windows Locked'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  {routinePlan.ventilationGuidance.ventilationInstructions}
                </p>
              </div>

              {routinePlan.ventilationGuidance.canVentilate && (
                <div className="mt-3 pt-2 border-t border-slate-800 text-xs font-semibold text-teal-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Optimal Window: {routinePlan.ventilationGuidance.safeWindowStart} – {routinePlan.ventilationGuidance.safeWindowEnd}
                </div>
              )}
            </div>

            {/* Commute Advice */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Car className="w-4 h-4 text-cyan-400" />
                    Commute & Transit Shield
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                    {routinePlan.transitAdvice.exposureReductionPct}% Exposure Cut
                  </span>
                </div>
                <p className="text-xs text-slate-200 font-semibold mt-2">
                  Recommended: {routinePlan.transitAdvice.recommendedMode}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {routinePlan.transitAdvice.commutePrecautions}
                </p>
              </div>
            </div>
          </div>

          {/* Individual Household Action Items */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Member-Specific Protection Protocols ({householdProfile.familyName})
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {routinePlan.householdActionItems.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-start gap-3"
                >
                  <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400 shrink-0 mt-0.5">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">{item.targetMember}</span>
                      <span
                        className={`text-[9px] font-bold px-2 py-0.2 rounded ${
                          item.priority === 'Must Do'
                            ? 'bg-rose-500/20 text-rose-400'
                            : 'bg-amber-500/20 text-amber-400'
                        }`}
                      >
                        {item.priority}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 font-medium mt-1">{item.action}</p>
                    <p className="text-[11px] text-slate-500 mt-1 italic">{item.reasoning}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Hourly Inversion Schedule Breakdown */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-xl">
        <div className="mb-4">
          <h3 className="text-base font-bold text-white">24-Hour Activity Window Guidance</h3>
          <p className="text-xs text-slate-400">
            How ground-level cold air pooling alters exposure risk throughout the day.
          </p>
        </div>

        <div className="space-y-3">
          {hourlyWindows.map((slot, index) => {
            const Icon = slot.icon;
            return (
              <div
                key={index}
                className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-teal-400 shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400 font-mono">
                        {slot.time}
                      </span>
                      <span className="text-xs font-bold text-white">{slot.title}</span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1">{slot.recommendation}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end md:self-auto shrink-0">
                  <div className="text-right">
                    <div className="text-xs font-mono font-bold text-slate-300">
                      ~{slot.aqiEstimate} AQI
                    </div>
                    <div className="text-[10px] text-slate-500">Projected Peak</div>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${slot.color}`}>
                    {slot.risk}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
