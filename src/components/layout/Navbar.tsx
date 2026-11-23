import React, { useState } from 'react';
import {
  Wind,
  Bot,
  CalendarCheck,
  Home,
  Navigation,
  Activity,
  Users,
  MapPin,
  RefreshCw,
  ChevronDown
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { POPULAR_LOCATIONS } from '../../services/openMeteoService';
import { AQI_LEVELS } from '../../utils/aqiScale';

interface NavItem {
  id: 'dashboard' | 'assistant' | 'routines' | 'indoor-hacks' | 'transit' | 'tracker';
  label: string;
  icon: any;
  badge?: string;
}

export const Navbar: React.FC = () => {
  const {
    currentAqi,
    isLoadingAqi,
    selectedLocation,
    changeLocation,
    detectCurrentLocation,
    householdProfile,
    activeTab,
    setActiveTab,
    refreshAqi,
    setIsProfileModalOpen,
  } = useApp();

  const [isLocationMenuOpen, setIsLocationMenuOpen] = useState(false);

  const vulnerableCount = householdProfile.members.filter(m => m.isVulnerable).length;
  const aqiMeta = currentAqi ? AQI_LEVELS[currentAqi.severity] : AQI_LEVELS.Moderate;

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Live Dashboard', icon: Wind },
    { id: 'assistant', label: 'AI Advisor', icon: Bot, badge: 'GenAI' },
    { id: 'routines', label: 'Daily Routines', icon: CalendarCheck },
    { id: 'indoor-hacks', label: 'Indoor Hacks', icon: Home },
    { id: 'transit', label: 'Clean Transit', icon: Navigation },
    { id: 'tracker', label: 'Impact Tracker', icon: Activity },
  ];

  return (
    <header className="sticky top-0 z-40 bg-slate-950/85 backdrop-blur-md border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500 via-emerald-400 to-cyan-500 p-0.5 shadow-lg shadow-teal-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Wind className="w-5 h-5 text-teal-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xl tracking-tight text-white font-mono">
                  Air<span className="text-teal-400">Aware</span>
                </span>
                <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/30">
                  GenAI
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">Smog & Clean Air Resilience</p>
            </div>
          </div>

          {/* Location Selector Pill */}
          <div className="relative">
            <button
              onClick={() => setIsLocationMenuOpen(!isLocationMenuOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs text-slate-200 transition-colors"
            >
              <MapPin className="w-3.5 h-3.5 text-teal-400" />
              <span className="font-medium truncate max-w-[120px] sm:max-w-[160px]">
                {selectedLocation.name}
              </span>
              {currentAqi && (
                <span
                  className="px-2 py-0.5 rounded-full text-[11px] font-bold"
                  style={{ backgroundColor: `${aqiMeta.color}25`, color: aqiMeta.color }}
                >
                  AQI {currentAqi.currentAqi}
                </span>
              )}
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {/* Location Dropdown */}
            {isLocationMenuOpen && (
              <div className="absolute left-0 mt-2 w-64 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl p-2 z-50">
                <div className="px-3 py-2 border-b border-slate-800 text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Select City / Hotspot</span>
                  <button
                    onClick={refreshAqi}
                    disabled={isLoadingAqi}
                    className="hover:text-teal-400 transition-colors"
                    title="Refresh data"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAqi ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                <button
                  onClick={() => {
                    detectCurrentLocation();
                    setIsLocationMenuOpen(false);
                  }}
                  className="w-full mt-1 flex items-center gap-2 px-3 py-2 text-xs text-left rounded-lg text-teal-300 hover:bg-teal-500/10 transition-colors font-medium"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  Use My Current GPS Location
                </button>

                <div className="max-h-56 overflow-y-auto mt-1 space-y-0.5">
                  {POPULAR_LOCATIONS.map((loc) => (
                    <button
                      key={loc.name}
                      onClick={() => {
                        changeLocation(loc);
                        setIsLocationMenuOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs rounded-lg flex items-center justify-between transition-colors ${
                        selectedLocation.name === loc.name
                          ? 'bg-slate-800 text-teal-400 font-medium'
                          : 'text-slate-300 hover:bg-slate-800/60'
                      }`}
                    >
                      <span>{loc.name}</span>
                      <span className="text-[10px] text-slate-500">{loc.state || loc.country}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Navigation Tabs (Desktop) */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`relative flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30 shadow-sm shadow-teal-500/10'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-950 uppercase">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Action Icons: Household Profile & API Key */}
          <div className="flex items-center gap-2">
            
            {/* Household Profile Trigger */}
            <button
              onClick={() => setIsProfileModalOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-200 transition-colors"
              title="Household Profile & Vulnerabilities"
            >
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">{householdProfile.familyName}</span>
              {vulnerableCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40 text-[10px] font-bold flex items-center justify-center">
                  {vulnerableCount}
                </span>
              )}
            </button>

          </div>

        </div>
      </div>

      {/* Mobile Sub-Navigation Bar */}
      <div className="lg:hidden flex items-center overflow-x-auto px-4 py-2 bg-slate-900/90 border-t border-slate-800 gap-1.5 no-scrollbar">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs whitespace-nowrap shrink-0 transition-colors ${
                isActive
                  ? 'bg-teal-500/20 text-teal-300 font-semibold border border-teal-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
};
