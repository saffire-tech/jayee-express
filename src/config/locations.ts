export interface LocationGroup {
  id: string;
  name: string;
  locations: string[];
}

// Communities grouped by city/zone for Tamale and Wa.
export const LOCATION_GROUPS: LocationGroup[] = [
  {
    id: 'tamale-central',
    name: 'Tamale Central',
    locations: [
      'Aboabo', 'Sakasaka', 'Lamashegu', 'Choggu', 'Vittin', 'Nyohini',
      'Gumbihini', 'Zogbeli', 'Tishigu', 'Kalpohin', 'Dakpema', 'Zongo',
    ],
  },
  {
    id: 'tamale-east',
    name: 'Tamale East',
    locations: [
      'Kanvili', 'Gurugu', 'Gumani', 'Kpalsi', 'Kakpagyili', 'Sognaayili',
      'Kanvili-Kukuo', 'Education Ridge',
    ],
  },
  {
    id: 'tamale-west-north',
    name: 'Tamale West & North',
    locations: [
      'Bulpiela', 'Changli', 'Kpene', 'Tugu', 'Nyanshegu', 'Jisonayili',
      'Kpalga', 'Kpanvo', 'Builpela',
    ],
  },
  {
    id: 'tamale-outskirts',
    name: 'Tamale Outskirts',
    locations: [
      'Savelugu', 'Tolon', 'Kasalgu', 'Datoyili', 'Sangani', 'Diare',
      'Nyankpala', 'Kumbungu',
    ],
  },
  {
    id: 'wa-central',
    name: 'Wa Central',
    locations: [
      'Wa Zongo', 'Dondoli', 'Kabanye', 'Kpaguri', 'Mangu', 'Nakori',
      'SSNIT Flats', 'Kpongu', 'Dobile',
    ],
  },
  {
    id: 'wa-outskirts',
    name: 'Wa Outskirts',
    locations: [
      'Bamahu', 'Sing', 'Charia', 'Busa', 'Loho', 'Kperisi', 'Jujeyiri',
      'Sombo', 'Nyagli',
    ],
  },
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
