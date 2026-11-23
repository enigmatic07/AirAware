export type HabitCategory = 
  | 'transport'
  | 'indoor_purification'
  | 'routine_timing'
  | 'personal_protection';

export interface LoggedHabit {
  id: string;
  category: HabitCategory;
  title: string;
  description: string;
  co2SavedGrams: number;
  pmExposureAvoidedUg: number;
  cleanAirMinutes: number;
  timestamp: string; // ISO string
}

export interface EnvironmentalImpactSummary {
  totalCo2SavedKg: number;
  totalPmExposureAvoidedMg: number;
  totalCleanAirHours: number;
  daysLogged: number;
  streakDays: number;
}
