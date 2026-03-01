export interface LocationGroup {
  id: string;
  name: string;
  locations: string[];
}

export const LOCATION_GROUPS: LocationGroup[] = [
  {
    id: 'accra-central',
    name: 'Accra Central',
    locations: [
      'Osu', 'Labadi', 'Cantonments', 'Airport Residential', 'Ridge',
      'Dzorwulu', 'Abelemkpe', 'Roman Ridge', 'Circle', 'Asylum Down', 'Adabraka'
    ]
  },
  {
    id: 'north-accra',
    name: 'North Accra',
    locations: [
      'Achimota', 'Lapaz', 'Dome', 'Haatso', 'Taifa',
      'Agbogba', 'Kwabenya', 'Pokuase', 'Amasaman'
    ]
  },
  {
    id: 'east-accra',
    name: 'East Accra',
    locations: [
      'East Legon', 'Madina', 'Adenta', 'Teshie', 'Nungua',
      'Spintex', 'Baatsonaa', 'Adjiriganor'
    ]
  },
  {
    id: 'west-accra',
    name: 'West Accra',
    locations: [
      'Dansoman', 'Darkuman', 'Odorkor', 'Kaneshie', 'Tesano',
      'Ablekuma', 'Bubiashie', 'Abeka'
    ]
  },
  {
    id: 'tema-surroundings',
    name: 'Tema & Surroundings',
    locations: [
      'Tema', 'Ashaiman', 'Sakumono', 'Kpone', 'Prampram', 'Dawhenya', 'Afienya'
    ]
  },
  {
    id: 'kasoa-surroundings',
    name: 'Kasoa & Surroundings',
    locations: [
      'Kasoa', 'Weija', 'Gbawe', 'Mallam', 'McCarthy Hill', 'Bortianor', 'Kokrobite'
    ]
  }
];

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
