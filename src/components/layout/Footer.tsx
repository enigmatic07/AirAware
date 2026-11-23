import React from 'react';
import { Wind, ShieldAlert } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-16 border-t border-slate-900 bg-slate-950 py-10 text-xs text-slate-500">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <Wind className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-white font-mono text-sm">
                Air<span className="text-teal-400">Aware</span>
              </span>
              <p className="text-[11px] text-slate-500">Community Clean Air Resilience & GenAI Platform</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-[11px]">
            <span className="text-slate-400">Data Standards:</span>
            <span className="hover:text-slate-300">Open-Meteo High-Resolution Model</span>
            <span className="hover:text-slate-300">India CPCB / NAQI Scale</span>
            <span className="hover:text-slate-300">WHO 2021 AQ Guidelines</span>
          </div>
        </div>

        {/* Disclaimer Strip */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-start gap-3">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-slate-400 leading-relaxed">
            <strong className="text-slate-300">Public Health & Medical Disclaimer:</strong> AirAware generates environmental risk assessments and mitigation routines for informational and resilience planning purposes only. AirAware does not provide medical diagnoses or prescriptions. Sensitive individuals and individuals experiencing acute shortness of breath, chest constriction, or severe wheezing should immediately seek emergency clinical care.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px]">
          <span>© 2026 AirAware. Built with React, Tailwind CSS, Google Gemini, and Open Environmental Telemetry.</span>
          <span className="flex items-center gap-1">
            Defending urban respiratory health with GenAI
          </span>
        </div>

      </div>
    </footer>
  );
};
