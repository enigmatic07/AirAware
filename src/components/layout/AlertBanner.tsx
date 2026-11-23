import React from 'react';
import { AlertTriangle, ShieldAlert, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const AlertBanner: React.FC = () => {
  const { currentAqi, setActiveTab } = useApp();
  const [isDismissed, setIsDismissed] = React.useState(false);

  if (!currentAqi || currentAqi.currentAqi < 201 || isDismissed) {
    return null;
  }

  const isSevere = currentAqi.currentAqi > 300;

  return (
    <div
      className={`relative w-full px-4 py-3 border-b text-sm transition-all ${
        isSevere
          ? 'bg-gradient-to-r from-purple-950/80 via-rose-950/90 to-purple-950/80 border-purple-500/40 text-purple-200 animate-hazard'
          : 'bg-red-950/60 border-red-500/30 text-red-200'
      }`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-black/40 border border-white/10 shrink-0">
            {isSevere ? (
              <ShieldAlert className="w-5 h-5 text-rose-400" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            )}
          </div>
          <div>
            <span className="font-semibold text-white">
              {isSevere ? 'CRITICAL SMOG EMERGENCY:' : 'VERY POOR AIR QUALITY ALERT:'}
            </span>{' '}
            AQI is <strong className="text-white underline">{currentAqi.currentAqi}</strong> ({currentAqi.severity}) in {currentAqi.city}.
            Atmospheric inversion is trapping toxic particulates. Vulnerable groups must stay indoors.
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('routines')}
            className="px-3 py-1 rounded-md bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-medium text-white transition-colors"
          >
            View Emergency Routine
          </button>
          <button
            onClick={() => setIsDismissed(true)}
            aria-label="Dismiss alert"
            className="p-1 hover:bg-white/10 rounded transition-colors text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
