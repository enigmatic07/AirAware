import { GroundStation } from '../types/aqi';

export const CPCB_STATIONS: GroundStation[] = [
  {
    id: 'cpcb-dl-01',
    name: 'Anand Vihar CAAQMS',
    city: 'Delhi',
    state: 'Delhi',
    latitude: 28.6508,
    longitude: 77.3153,
    currentAqi: 442,
    dominantPollutant: 'PM2.5',
    lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  },
  {
    id: 'cpcb-dl-02',
    name: 'ITO Crossing CAAQMS',
    city: 'Delhi',
    state: 'Delhi',
    latitude: 28.6289,
    longitude: 77.2407,
    currentAqi: 386,
    dominantPollutant: 'PM2.5',
    lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  },
  {
    id: 'cpcb-dl-03',
    name: 'R K Puram CAAQMS',
    city: 'Delhi',
    state: 'Delhi',
    latitude: 28.5638,
    longitude: 77.1738,
    currentAqi: 365,
    dominantPollutant: 'PM2.5',
    lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  },
  {
    id: 'cpcb-up-01',
    name: 'Sector 62 CAAQMS',
    city: 'Noida',
    state: 'Uttar Pradesh',
    latitude: 28.6245,
    longitude: 77.3639,
    currentAqi: 395,
    dominantPollutant: 'PM2.5',
    lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  },
  {
    id: 'cpcb-hr-01',
    name: 'Vikas Sadan CAAQMS',
    city: 'Gurugram',
    state: 'Haryana',
    latitude: 28.4595,
    longitude: 77.0266,
    currentAqi: 348,
    dominantPollutant: 'PM10',
    lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  },
  {
    id: 'cpcb-br-01',
    name: 'Muradpur CAAQMS',
    city: 'Patna',
    state: 'Bihar',
    latitude: 25.6197,
    longitude: 85.1613,
    currentAqi: 312,
    dominantPollutant: 'PM2.5',
    lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  },
  {
    id: 'cpcb-mh-01',
    name: 'Bandra Kurla Complex (BKC)',
    city: 'Mumbai',
    state: 'Maharashtra',
    latitude: 19.0657,
    longitude: 72.8687,
    currentAqi: 182,
    dominantPollutant: 'PM10',
    lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  },
  {
    id: 'cpcb-ka-01',
    name: 'BTM Layout CAAQMS',
    city: 'Bengaluru',
    state: 'Karnataka',
    latitude: 12.9166,
    longitude: 77.6101,
    currentAqi: 68,
    dominantPollutant: 'PM2.5',
    lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  },
  {
    id: 'cpcb-wb-01',
    name: 'Victoria Memorial CAAQMS',
    city: 'Kolkata',
    state: 'West Bengal',
    latitude: 22.5448,
    longitude: 88.3426,
    currentAqi: 245,
    dominantPollutant: 'PM2.5',
    lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  }
];

export function findNearestCpcbStation(lat: number, lng: number): GroundStation | null {
  let closest: GroundStation | null = null;
  let minDistance = Infinity;

  for (const station of CPCB_STATIONS) {
    const dist = Math.hypot(station.latitude - lat, station.longitude - lng);
    // Within roughly 75 km (~0.7 degrees)
    if (dist < 0.7 && dist < minDistance) {
      minDistance = dist;
      closest = station;
    }
  }

  return closest;
}
