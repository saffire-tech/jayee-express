export interface LocationGroup {
  id: string;
  name: string;
  city?: string;
  locations: string[];
}

// Jayee Express serves Accra only.
export const DEFAULT_CITY = 'Accra';

// Communities grouped by zone in Accra.
export const LOCATION_GROUPS: LocationGroup[] = [
  {
    id: 'accra-central',
    name: 'Accra Central',
    city: 'Accra',
    locations: [
      'Osu', 'Adabraka', 'Asylum Down', 'Ridge', 'Kokomlemle', 'North Ridge',
      'Tudu', 'Jamestown', 'Korle Gonno',
    ],
  },
  {
    id: 'accra-east',
    name: 'Accra East',
    city: 'Accra',
    locations: [
      'East Legon', 'Adenta', 'Madina', 'Ashaley Botwe', 'Teshie', 'Nungua',
      'Spintex', 'Baatsona', 'Airport Residential', 'Cantonments', 'Labone',
    ],
  },
  {
    id: 'accra-west',
    name: 'Accra West',
    city: 'Accra',
    locations: [
      'Dansoman', 'Kaneshie', 'Odorkor', 'Mallam', 'Weija', 'Gbawe',
      'Darkuman', 'Lapaz', 'Achimota',
    ],
  },
  {
    id: 'accra-north',
    name: 'Accra North',
    city: 'Accra',
    locations: [
      'Tesano', 'Dome', 'Kwabenya', 'Haatso', 'Agbogba', 'Ashongman',
      'Legon', 'Abelemkpe', 'Dzorwulu',
    ],
  },
  {
    id: 'tema-outskirts',
    name: 'Tema & Outskirts',
    city: 'Accra',
    locations: [
      'Tema Community 1', 'Tema Community 25', 'Ashaiman', 'Sakumono',
      'Kasoa', 'Amasaman', 'Pokuase', 'Oyibi', 'Katamanso',
    ],
  },
];

// Get groups for a specific city (returns all groups when no city given)
export const getGroupsByCity = (city?: string | null): LocationGroup[] =>
  city ? LOCATION_GROUPS.filter(g => !g.city || g.city === city) : LOCATION_GROUPS;

// Get all locations as a flat array
export const getAllLocations = (): string[] => {
  return LOCATION_GROUPS.flatMap(group => group.locations);
};

// Get group by location name
export const getGroupByLocation = (location: string): LocationGroup | undefined => {
  return LOCATION_GROUPS.find(group => group.locations.includes(location));
};

// Get group by ID
export const getGroupById = (groupId: string): LocationGroup | undefined => {
  return LOCATION_GROUPS.find(group => group.id === groupId);
};

// Get all group names
export const getGroupNames = (): string[] => {
  return LOCATION_GROUPS.map(group => group.name);
};

// Check if a location exists
export const isLocationValid = (location: string): boolean => {
  return getAllLocations().includes(location);
};
