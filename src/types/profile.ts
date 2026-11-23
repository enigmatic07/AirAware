export type HealthCondition = 
  | 'asthma'
  | 'copd'
  | 'cardiovascular'
  | 'pregnancy'
  | 'infant'
  | 'elderly'
  | 'respiratory_allergy'
  | 'none';

export interface HouseholdMember {
  id: string;
  name: string;
  relation: 'self' | 'child' | 'parent' | 'partner' | 'other';
  age: number;
  conditions: HealthCondition[];
  isVulnerable: boolean;
}

export interface HomeAttributes {
  dwellingType: 'apartment' | 'independent_house' | 'villa';
  floorLevel?: number;
  hasAirPurifier: boolean;
  purifierCount: number;
  hasAcWithFilter: boolean;
  hasCookingExhaust: boolean;
  sealQuality: 'tight' | 'moderate' | 'drafty';
  indoorPlantsCount: number;
}

export interface UserHouseholdProfile {
  id: string;
  familyName: string;
  primaryLocation: {
    cityName: string;
    latitude: number;
    longitude: number;
  };
  members: HouseholdMember[];
  home: HomeAttributes;
  commuteMode: 'public_transit' | 'car_solo' | 'carpool' | 'two_wheeler' | 'walk_cycle' | 'remote';
}
