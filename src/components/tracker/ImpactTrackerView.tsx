import React, { useState } from 'react';
import {
  Activity,
  Leaf,
  ShieldCheck,
  Clock,
  Flame,
  Plus,
  Users
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { HabitCategory } from '../../types/habits';

export const ImpactTrackerView: React.FC = () => {
  const { loggedHabits, impactSummary, logHabit } = useApp();
  const [isAddingHabit, setIsAddingHabit] = useState(false);
  const [habitTitle, setHabitTitle] = useState('');
  const [habitCategory, setHabitCategory] = useState<HabitCategory>('transport');
  const [co2Saved, setCo2Saved] = useState<number>(1200);

  const handleCreateCustomHabit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!habitTitle.trim()) return;

    logHabit({
      category: habitCategory,
      title: habitTitle.trim(),
      description: 'Custom community action logged in AirAware.',
      co2SavedGrams: co2Saved,
      pmExposureAvoidedUg: 150,
      cleanAirMinutes: 60,
    });

    setHabitTitle('');
    setIsAddingHabit(false);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Environmental Impact & Resilience Tracker</h2>
            <p className="text-xs text-slate-400">
              Quantifying your personal inhalation defense and community emissions reduction
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsAddingHabit(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs transition-all shadow-md shadow-teal-500/20"
        >
          <Plus className="w-4 h-4" />
          <span>Log Clean Habit</span>
        </button>
      </div>

      {/* Top 4 Impact KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* CO2 Avoided */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">CO₂ Avoided</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Leaf className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black font-mono text-emerald-400">
              {impactSummary.totalCo2SavedKg} <span className="text-xs text-slate-400 font-sans">kg</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Equivalent to saving ~{(impactSummary.totalCo2SavedKg * 4.2).toFixed(0)} km of car exhaust
            </p>
          </div>
        </div>

        {/* Toxic PM Inhalation Avoided */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">PM2.5 Inhalation Avoided</span>
            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black font-mono text-teal-400">
              {impactSummary.totalPmExposureAvoidedMg} <span className="text-xs text-slate-400 font-sans">mg</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Micrograms kept out of family alveolar lung tissue
            </p>
          </div>
        </div>

        {/* Clean Air Hours */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Clean Air Sanctuary</span>
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black font-mono text-cyan-400">
              {impactSummary.totalCleanAirHours} <span className="text-xs text-slate-400 font-sans">hrs</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Hours spent in rooms with verified filtration
            </p>
          </div>
        </div>

        {/* Active Streak */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Active Streak</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black font-mono text-amber-400">
              {impactSummary.streakDays} <span className="text-xs text-slate-400 font-sans">days</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Consistent daily smog defense logging
            </p>
          </div>
        </div>

      </div>

      {/* Community Collective Impact Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-teal-950/40 via-slate-900 to-slate-950 border border-teal-500/30 p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-teal-500/20 text-teal-300 border border-teal-500/40">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Neighborhood Collective Defense</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Together with 1,420 families in your municipal cluster, you have helped offset <strong className="text-teal-400 font-mono">14.8 tonnes of CO₂</strong> this winter!
            </p>
          </div>
        </div>
      </div>

      {/* Habit Log History */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-white">Activity Log & Milestones</h3>
          <span className="text-xs text-slate-400">{loggedHabits.length} actions logged</span>
        </div>

        <div className="space-y-3">
          {loggedHabits.map((habit) => (
            <div
              key={habit.id}
              className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition-colors"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">{habit.title}</span>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                    {habit.category.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">{habit.description}</p>
              </div>

              <div className="flex items-center gap-4 text-xs font-mono self-start sm:self-auto shrink-0">
                {habit.co2SavedGrams > 0 && (
                  <span className="text-emerald-400 font-semibold">
                    -{(habit.co2SavedGrams / 1000).toFixed(1)} kg CO₂
                  </span>
                )}
                {habit.pmExposureAvoidedUg > 0 && (
                  <span className="text-teal-400 font-semibold">
                    +{habit.pmExposureAvoidedUg} µg PM Protected
                  </span>
                )}
                <span className="text-[11px] text-slate-500 font-sans">
                  {new Date(habit.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Log Habit Modal */}
      {isAddingHabit && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1">Log a Clean Air Habit</h3>
            <p className="text-xs text-slate-400 mb-4">
              Track sustainable transit, room sealing, or purifier usage.
            </p>

            <form onSubmit={handleCreateCustomHabit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Habit Description
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Switched to Metro for office commute"
                  value={habitTitle}
                  onChange={(e) => setHabitTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Category
                </label>
                <select
                  value={habitCategory}
                  onChange={(e) => setHabitCategory(e.target.value as HabitCategory)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                >
                  <option value="transport">Sustainable Transport</option>
                  <option value="indoor_purification">Indoor Air Purification</option>
                  <option value="routine_timing">Routine Adjustment</option>
                  <option value="personal_protection">N95 / Personal Protection</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Estimated CO₂ Saved: {co2Saved} g
                </label>
                <input
                  type="range"
                  min="0"
                  max="5000"
                  step="100"
                  value={co2Saved}
                  onChange={(e) => setCo2Saved(Number(e.target.value))}
                  className="w-full accent-teal-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingHabit(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-md shadow-teal-500/20"
                >
                  Save Habit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
