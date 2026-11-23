export type AQISeverity = 
  | 'Good' 
  | 'Moderate' 
  | 'Poor' 
  | 'Very Poor' 
  | 'Severe' 
  | 'Hazardous';

export interface PollutantLevels {
  pm25: number;      // µg/m³
  pm10: number;      // µg/m³
  no2?: number;      // µg/m³
  so2?: number;      // µg/m³
  co?: number;       // µg/m³ or mg/m³
  o3?: number;       // µg/m³
}

export interface HourlyForecastPoint {
  time: string;           // ISO or formatted time
  timestamp: number;
  aqi: number;
  pm25: number;
  pm10: number;
  severity: AQISeverity;
}

export interface GroundStation {
  id: string;
  name: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  currentAqi: number;
  dominantPollutant: 'PM2.5' | 'PM10' | 'NO2';
  lastUpdated: string;
}

export interface AirQualitySnapshot {
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  currentAqi: number;
  usAqi?: number;
  severity: AQISeverity;
  dominantPollutant: string;
  pollutants: PollutantLevels;
  hourlyForecast: HourlyForecastPoint[];
  dataSource: 'open-meteo' | 'cpcb' | 'hybrid';
  stationName?: string;
  lastUpdated: string;
  temperature?: number;
  humidity?: number;
  windSpeed?: number;
}

export interface LocationPreset {
  name: string;
  state?: string;
  country: string;
  lat: number;
  lng: number;
  cpcbStationId?: string;
}
