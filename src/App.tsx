import React from 'react';
import { useApp } from './context/AppContext';
import { Navbar } from './components/layout/Navbar';
import { AlertBanner } from './components/layout/AlertBanner';
import { Footer } from './components/layout/Footer';
import { AqiGauge } from './components/dashboard/AqiGauge';
import { PollutantGrid } from './components/dashboard/PollutantGrid';
import { ForecastChart } from './components/dashboard/ForecastChart';
import { HealthAdvisoryCard } from './components/dashboard/HealthAdvisoryCard';
import { AssistantView } from './components/assistant/AssistantView';
import { DailyRoutineView } from './components/routines/DailyRoutineView';
import { IndoorHacksView } from './components/indoor/IndoorHacksView';
import { TransitCompareView } from './components/transit/TransitCompareView';
import { ImpactTrackerView } from './components/tracker/ImpactTrackerView';
import { HouseholdProfileModal } from './components/profile/HouseholdProfileModal';

export const App: React.FC = () => {
  const { currentAqi, isLoadingAqi, refreshAqi, activeTab } = useApp();

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      
      {/* Top Emergency Smog Alert Banner */}
      <AlertBanner />

      {/* Main Navbar */}
      <Navbar />

      {/* Primary Dynamic Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* VIEW 1: LIVE DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {currentAqi ? (
              <>
                {/* Top Section: Radial AQI Gauge + Health Advisory Card */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <AqiGauge
                    data={currentAqi}
                    onRefresh={refreshAqi}
                    isLoading={isLoadingAqi}
                  />
                  <HealthAdvisoryCard data={currentAqi} />
                </div>

                {/* 24-Hour Forecast & Inversion Curve */}
                <ForecastChart forecast={currentAqi.hourlyForecast} />

                {/* Comprehensive Pollutants Grid (PM2.5, PM10, NO2, SO2, CO, O3) */}
                <div>
                  <div className="mb-3">
                    <h3 className="text-base font-bold text-white">Specific Pollutant Telemetry</h3>
                    <p className="text-xs text-slate-400">
                      Real-time concentrations compared against World Health Organization (WHO) 24-hour limits.
                    </p>
                  </div>
                  <PollutantGrid pollutants={currentAqi.pollutants} />
                </div>
              </>
            ) : (
              <div className="h-96 flex flex-col items-center justify-center text-slate-400">
                <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-sm">Fetching atmospheric telemetry...</p>
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: AI ADVISOR */}
        {activeTab === 'assistant' && <AssistantView />}

        {/* VIEW 3: DAILY ROUTINES */}
        {activeTab === 'routines' && <DailyRoutineView />}

        {/* VIEW 4: INDOOR HACKS */}
        {activeTab === 'indoor-hacks' && <IndoorHacksView />}

        {/* VIEW 5: SUSTAINABLE TRANSIT */}
        {activeTab === 'transit' && <TransitCompareView />}

        {/* VIEW 6: IMPACT TRACKER */}
        {activeTab === 'tracker' && <ImpactTrackerView />}

      </main>

      {/* Household Profile Modal */}
      <HouseholdProfileModal />

      {/* Footer */}
      <Footer />

    </div>
  );
};
