import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AirQualitySnapshot, LocationPreset } from '../types/aqi';
import { UserHouseholdProfile } from '../types/profile';
import { LoggedHabit, EnvironmentalImpactSummary } from '../types/habits';
import { fetchAirQualityData, POPULAR_LOCATIONS } from '../services/openMeteoService';

interface AppContextType {
  currentAqi: AirQualitySnapshot | null;
  isLoadingAqi: boolean;
  selectedLocation: LocationPreset;
  changeLocation: (location: LocationPreset) => Promise<void>;
  detectCurrentLocation: () => Promise<void>;
  householdProfile: UserHouseholdProfile;
  updateHouseholdProfile: (profile: UserHouseholdProfile) => void;
  loggedHabits: LoggedHabit[];
  logHabit: (habit: Omit<LoggedHabit, 'id' | 'timestamp'>) => void;
  impactSummary: EnvironmentalImpactSummary;
  activeTab: 'dashboard' | 'assistant' | 'routines' | 'indoor-hacks' | 'transit' | 'tracker';
  setActiveTab: (tab: 'dashboard' | 'assistant' | 'routines' | 'indoor-hacks' | 'transit' | 'tracker') => void;
  refreshAqi: () => Promise<void>;
  isProfileModalOpen: boolean;
  setIsProfileModalOpen: (open: boolean) => void;
}

const DEFAULT_PROFILE: UserHouseholdProfile = {
  id: 'usr-default-01',
  familyName: 'Sharma Family',
  primaryLocation: {
    cityName: 'Delhi NCR',
    latitude: 28.6139,
    longitude: 77.2090,
  },
  members: [
    { id: 'm1', name: 'Rohan (Self)', relation: 'self', age: 38, conditions: ['none'], isVulnerable: false },
    { id: 'm2', name: 'Priya (Partner)', relation: 'partner', age: 36, conditions: ['none'], isVulnerable: false },
    { id: 'm3', name: 'Aarav (Son)', relation: 'child', age: 6, conditions: ['asthma'], isVulnerable: true },
    { id: 'm4', name: 'Kamala (Grandmother)', relation: 'parent', age: 68, conditions: ['elderly', 'cardiovascular'], isVulnerable: true },
  ],
  home: {
    dwellingType: 'apartment',
    floorLevel: 4,
    hasAirPurifier: true,
    purifierCount: 1,
    hasAcWithFilter: true,
    hasCookingExhaust: true,
    sealQuality: 'moderate',
    indoorPlantsCount: 6,
  },
  commuteMode: 'public_transit',
};

const INITIAL_HABITS: LoggedHabit[] = [
  {
    id: 'h-1',
    category: 'transport',
    title: 'Took Delhi Metro instead of driving private car',
    description: 'Switched 18km daily office commute to Delhi Metro Blue Line.',
    co2SavedGrams: 2800,
    pmExposureAvoidedUg: 140,
    cleanAirMinutes: 45,
    timestamp: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'h-2',
    category: 'indoor_purification',
    title: 'Ran Bedroom HEPA purifier overnight (8 hrs)',
    description: 'Maintained bedroom PM2.5 below 25 µg/m³ during night temperature inversion.',
    co2SavedGrams: 0,
    pmExposureAvoidedUg: 380,
    cleanAirMinutes: 480,
    timestamp: new Date(Date.now() - 43200000).toISOString(),
  },
  {
    id: 'h-3',
    category: 'personal_protection',
    title: 'Wore certified N95 mask for school drop-off',
    description: 'Protected Aarav and self with tight-seal N95 respirators.',
    co2SavedGrams: 0,
    pmExposureAvoidedUg: 195,
    cleanAirMinutes: 30,
    timestamp: new Date().toISOString(),
  },
];

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [selectedLocation, setSelectedLocation] = useState<LocationPreset>(POPULAR_LOCATIONS[0]);
  const [currentAqi, setCurrentAqi] = useState<AirQualitySnapshot | null>(null);
  const [isLoadingAqi, setIsLoadingAqi] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'assistant' | 'routines' | 'indoor-hacks' | 'transit' | 'tracker'>('dashboard');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);

  // Household Profile with local storage sync
  const [householdProfile, setHouseholdProfile] = useState<UserHouseholdProfile>(() => {
    const saved = localStorage.getItem('airaware_profile');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* fallback */ }
    }
    return DEFAULT_PROFILE;
  });

  // Logged habits with local storage sync
  const [loggedHabits, setLoggedHabits] = useState<LoggedHabit[]>(() => {
    const saved = localStorage.getItem('airaware_habits');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* fallback */ }
    }
    return INITIAL_HABITS;
  });

  const loadAqiForLocation = async (loc: LocationPreset) => {
    setIsLoadingAqi(true);
    try {
      const data = await fetchAirQualityData(loc.lat, loc.lng, loc.name);
      setCurrentAqi(data);
    } catch (err) {
      console.error('Error loading AQI data:', err);
    } finally {
      setIsLoadingAqi(false);
    }
  };

  useEffect(() => {
    loadAqiForLocation(selectedLocation);
  }, [selectedLocation]);

  const changeLocation = async (loc: LocationPreset) => {
    setSelectedLocation(loc);
    await loadAqiForLocation(loc);
  };

  const refreshAqi = async () => {
    await loadAqiForLocation(selectedLocation);
  };

  const detectCurrentLocation = async () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setIsLoadingAqi(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const customLoc: LocationPreset = {
          name: 'My Exact Location',
          country: 'Local',
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setSelectedLocation(customLoc);
        await loadAqiForLocation(customLoc);
      },
      (error) => {
        alert('Could not retrieve your location: ' + error.message);
        setIsLoadingAqi(false);
      }
    );
  };

  const updateHouseholdProfile = (newProfile: UserHouseholdProfile) => {
    setHouseholdProfile(newProfile);
    localStorage.setItem('airaware_profile', JSON.stringify(newProfile));
  };

  const logHabit = (habitInput: Omit<LoggedHabit, 'id' | 'timestamp'>) => {
    const newHabit: LoggedHabit = {
      ...habitInput,
      id: 'h-' + Date.now(),
      timestamp: new Date().toISOString(),
    };
    const updated = [newHabit, ...loggedHabits];
    setLoggedHabits(updated);
    localStorage.setItem('airaware_habits', JSON.stringify(updated));
  };

  // Compute total environmental impact
  const impactSummary: EnvironmentalImpactSummary = {
    totalCo2SavedKg: parseFloat((loggedHabits.reduce((acc, h) => acc + h.co2SavedGrams, 0) / 1000).toFixed(2)),
    totalPmExposureAvoidedMg: parseFloat((loggedHabits.reduce((acc, h) => acc + h.pmExposureAvoidedUg, 0) / 1000).toFixed(2)),
    totalCleanAirHours: Math.round(loggedHabits.reduce((acc, h) => acc + h.cleanAirMinutes, 0) / 60),
    daysLogged: new Set(loggedHabits.map(h => h.timestamp.slice(0, 10))).size,
    streakDays: 4, // simulated active habit streak
  };

  return (
    <AppContext.Provider
      value={{
        currentAqi,
        isLoadingAqi,
        selectedLocation,
        changeLocation,
        detectCurrentLocation,
        householdProfile,
        updateHouseholdProfile,
        loggedHabits,
        logHabit,
        impactSummary,
        activeTab,
        setActiveTab,
        refreshAqi,
        isProfileModalOpen,
        setIsProfileModalOpen,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
