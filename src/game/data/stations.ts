// Major train stations with intercity connections
// Local subway/metro stops are detected dynamically from Mapbox transit-label layer

export interface MajorStation {
  id: string;
  name: string;
  lng: number;
  lat: number;
  city: string;
}

// All major stations. Every major station connects to every other major station.
export const MAJOR_STATIONS: MajorStation[] = [
  // ─── North America ──────────────────────────────────────────────────────
  // New York
  { id: 'nyc-penn', name: 'Penn Station', lng: -73.9937, lat: 40.7506, city: 'New York' },
  { id: 'nyc-grand-central', name: 'Grand Central', lng: -73.9772, lat: 40.7527, city: 'New York' },
  { id: 'nyc-atlantic', name: 'Atlantic Terminal', lng: -73.9763, lat: 40.6849, city: 'New York' },
  // Chicago
  { id: 'chicago-union', name: 'Union Station', lng: -87.6401, lat: 41.8789, city: 'Chicago' },
  { id: 'chicago-ogilvie', name: 'Ogilvie Transportation Center', lng: -87.6406, lat: 41.8826, city: 'Chicago' },
  // Los Angeles
  { id: 'la-union', name: 'Union Station', lng: -118.2365, lat: 34.0561, city: 'Los Angeles' },
  // San Francisco
  { id: 'sf-caltrain', name: 'Caltrain Station', lng: -122.3945, lat: 37.7765, city: 'San Francisco' },
  { id: 'sf-embarcadero', name: 'Embarcadero', lng: -122.3964, lat: 37.7930, city: 'San Francisco' },
  // Washington DC
  { id: 'dc-union', name: 'Union Station', lng: -77.0069, lat: 38.8973, city: 'Washington DC' },
  // Boston
  { id: 'boston-south', name: 'South Station', lng: -71.0553, lat: 42.3519, city: 'Boston' },
  { id: 'boston-north', name: 'North Station', lng: -71.0614, lat: 42.3661, city: 'Boston' },
  // Philadelphia
  { id: 'philly-30th', name: '30th Street Station', lng: -75.1820, lat: 39.9557, city: 'Philadelphia' },
  // Toronto
  { id: 'toronto-union', name: 'Union Station', lng: -79.3807, lat: 43.6453, city: 'Toronto' },
  // Montreal
  { id: 'montreal-central', name: 'Gare Centrale', lng: -73.5673, lat: 45.4989, city: 'Montreal' },
  // Mexico City
  { id: 'cdmx-buenavista', name: 'Buenavista', lng: -99.1536, lat: 19.4489, city: 'Mexico City' },
  // Atlanta
  { id: 'atlanta-peachtree', name: 'Peachtree Station', lng: -84.3880, lat: 33.7812, city: 'Atlanta' },
  // Seattle
  { id: 'seattle-king', name: 'King Street Station', lng: -122.3302, lat: 47.5990, city: 'Seattle' },
  // Miami
  { id: 'miami-central', name: 'MiamiCentral', lng: -80.1946, lat: 25.7842, city: 'Miami' },
  // Denver
  { id: 'denver-union', name: 'Union Station', lng: -105.0002, lat: 39.7531, city: 'Denver' },
  // Minneapolis
  { id: 'minneapolis-target', name: 'Target Field Station', lng: -93.2779, lat: 44.9833, city: 'Minneapolis' },

  // ─── Europe ─────��───────────────────────────────────────────────────────
  // London
  { id: 'london-kings-cross', name: "King's Cross", lng: -0.1240, lat: 51.5320, city: 'London' },
  { id: 'london-paddington', name: 'Paddington', lng: -0.1756, lat: 51.5154, city: 'London' },
  { id: 'london-waterloo', name: 'Waterloo', lng: -0.1134, lat: 51.5031, city: 'London' },
  { id: 'london-victoria', name: 'Victoria', lng: -0.1443, lat: 51.4952, city: 'London' },
  // Paris
  { id: 'paris-gare-du-nord', name: 'Gare du Nord', lng: 2.3553, lat: 48.8809, city: 'Paris' },
  { id: 'paris-gare-de-lyon', name: 'Gare de Lyon', lng: 2.3731, lat: 48.8443, city: 'Paris' },
  { id: 'paris-gare-de-lest', name: "Gare de l'Est", lng: 2.3592, lat: 48.8764, city: 'Paris' },
  { id: 'paris-saint-lazare', name: 'Saint-Lazare', lng: 2.3254, lat: 48.8762, city: 'Paris' },
  // Berlin
  { id: 'berlin-hbf', name: 'Hauptbahnhof', lng: 13.3694, lat: 52.5251, city: 'Berlin' },
  { id: 'berlin-ostbahnhof', name: 'Ostbahnhof', lng: 13.4346, lat: 52.5106, city: 'Berlin' },
  // Madrid
  { id: 'madrid-atocha', name: 'Atocha', lng: -3.6906, lat: 40.4065, city: 'Madrid' },
  { id: 'madrid-chamartin', name: 'Chamartín', lng: -3.6825, lat: 40.4722, city: 'Madrid' },
  // Rome
  { id: 'rome-termini', name: 'Roma Termini', lng: 12.5016, lat: 41.9009, city: 'Rome' },
  // Barcelona
  { id: 'barcelona-sants', name: 'Barcelona Sants', lng: 2.1397, lat: 41.3793, city: 'Barcelona' },
  // Amsterdam
  { id: 'amsterdam-centraal', name: 'Amsterdam Centraal', lng: 4.9003, lat: 52.3791, city: 'Amsterdam' },
  // Brussels
  { id: 'brussels-midi', name: 'Bruxelles-Midi', lng: 4.3365, lat: 50.8358, city: 'Brussels' },
  // Vienna
  { id: 'vienna-hbf', name: 'Wien Hauptbahnhof', lng: 16.3756, lat: 48.1854, city: 'Vienna' },
  // Munich
  { id: 'munich-hbf', name: 'München Hauptbahnhof', lng: 11.5582, lat: 48.1403, city: 'Munich' },
  // Zurich
  { id: 'zurich-hb', name: 'Zürich HB', lng: 8.5403, lat: 47.3775, city: 'Zurich' },
  // Prague
  { id: 'prague-hlavni', name: 'Praha hlavní nádraží', lng: 14.4359, lat: 50.0832, city: 'Prague' },
  // Stockholm
  { id: 'stockholm-central', name: 'Stockholm Central', lng: 18.0580, lat: 59.3307, city: 'Stockholm' },
  // Copenhagen
  { id: 'copenhagen-central', name: 'København H', lng: 12.5649, lat: 55.6727, city: 'Copenhagen' },
  // Warsaw
  { id: 'warsaw-centralna', name: 'Warszawa Centralna', lng: 21.0032, lat: 52.2288, city: 'Warsaw' },
  // Moscow
  { id: 'moscow-leningradsky', name: 'Leningradsky', lng: 37.6553, lat: 55.7764, city: 'Moscow' },
  { id: 'moscow-kazansky', name: 'Kazansky', lng: 37.6571, lat: 55.7746, city: 'Moscow' },
  // Istanbul
  { id: 'istanbul-sirkeci', name: 'Sirkeci Terminal', lng: 28.9778, lat: 41.0117, city: 'Istanbul' },
  { id: 'istanbul-haydarpasa', name: 'Haydarpaşa', lng: 29.0194, lat: 40.9971, city: 'Istanbul' },
  // Lisbon
  { id: 'lisbon-oriente', name: 'Gare do Oriente', lng: -9.0990, lat: 38.7677, city: 'Lisbon' },
  // Helsinki
  { id: 'helsinki-central', name: 'Helsinki Central', lng: 24.9419, lat: 60.1718, city: 'Helsinki' },
  // Oslo
  { id: 'oslo-sentralstasjon', name: 'Oslo S', lng: 10.7530, lat: 59.9109, city: 'Oslo' },
  // Budapest
  { id: 'budapest-keleti', name: 'Budapest Keleti', lng: 19.0838, lat: 47.5003, city: 'Budapest' },
  // Milan
  { id: 'milan-centrale', name: 'Milano Centrale', lng: 9.2040, lat: 45.4865, city: 'Milan' },
  // Athens
  { id: 'athens-larissa', name: 'Larissa Station', lng: 23.7209, lat: 37.9920, city: 'Athens' },
  // Edinburgh
  { id: 'edinburgh-waverley', name: 'Edinburgh Waverley', lng: -3.1892, lat: 55.9520, city: 'Edinburgh' },

  // ─── Asia ──────────────���─────────────────────────────��──────────────────
  // Tokyo
  { id: 'tokyo-tokyo', name: 'Tokyo Station', lng: 139.7671, lat: 35.6812, city: 'Tokyo' },
  { id: 'tokyo-shinjuku', name: 'Shinjuku', lng: 139.7006, lat: 35.6896, city: 'Tokyo' },
  { id: 'tokyo-shibuya', name: 'Shibuya', lng: 139.7016, lat: 35.6580, city: 'Tokyo' },
  // Beijing
  { id: 'beijing-station', name: 'Beijing Station', lng: 116.4274, lat: 39.9042, city: 'Beijing' },
  { id: 'beijing-west', name: 'Beijing West', lng: 116.3226, lat: 39.8949, city: 'Beijing' },
  // Shanghai
  { id: 'shanghai-hongqiao', name: 'Hongqiao Station', lng: 121.3195, lat: 31.1948, city: 'Shanghai' },
  { id: 'shanghai-station', name: 'Shanghai Station', lng: 121.4559, lat: 31.2495, city: 'Shanghai' },
  // Seoul
  { id: 'seoul-station', name: 'Seoul Station', lng: 126.9722, lat: 37.5547, city: 'Seoul' },
  { id: 'seoul-gangnam', name: 'Gangnam', lng: 127.0282, lat: 37.4979, city: 'Seoul' },
  // Mumbai
  { id: 'mumbai-cst', name: 'Chhatrapati Shivaji Terminus', lng: 72.8353, lat: 18.9398, city: 'Mumbai' },
  // Delhi
  { id: 'delhi-new', name: 'New Delhi Station', lng: 77.2197, lat: 28.6436, city: 'Delhi' },
  { id: 'delhi-old', name: 'Old Delhi Station', lng: 77.2263, lat: 28.6616, city: 'Delhi' },
  // Hong Kong
  { id: 'hk-west-kowloon', name: 'West Kowloon', lng: 114.1605, lat: 22.3040, city: 'Hong Kong' },
  // Singapore
  { id: 'singapore-woodlands', name: 'Woodlands', lng: 103.7863, lat: 1.4369, city: 'Singapore' },
  // Bangkok
  { id: 'bangkok-hua-lamphong', name: 'Hua Lamphong', lng: 100.5170, lat: 13.7383, city: 'Bangkok' },
  { id: 'bangkok-bang-sue', name: 'Bang Sue Grand', lng: 100.5268, lat: 13.8036, city: 'Bangkok' },
  // Osaka
  { id: 'osaka-shin', name: 'Shin-Osaka', lng: 135.5003, lat: 34.7336, city: 'Osaka' },
  // Taipei
  { id: 'taipei-main', name: 'Taipei Main Station', lng: 121.5175, lat: 25.0478, city: 'Taipei' },
  // Kuala Lumpur
  { id: 'kl-sentral', name: 'KL Sentral', lng: 101.6864, lat: 3.1343, city: 'Kuala Lumpur' },
  // Jakarta
  { id: 'jakarta-gambir', name: 'Gambir Station', lng: 106.8276, lat: -6.1767, city: 'Jakarta' },
  // Dubai
  { id: 'dubai-metro-central', name: 'Union Metro', lng: 55.3091, lat: 25.2667, city: 'Dubai' },
  // Hanoi
  { id: 'hanoi-station', name: 'Hanoi Station', lng: 105.8418, lat: 21.0245, city: 'Hanoi' },
  // Ho Chi Minh City
  { id: 'hcmc-saigon', name: 'Saigon Station', lng: 106.6855, lat: 10.7821, city: 'Ho Chi Minh City' },

  // ���── Africa ────────���─────────────────────────��──────────────────────────
  // Cairo
  { id: 'cairo-ramses', name: 'Ramses Station', lng: 31.2470, lat: 30.0622, city: 'Cairo' },
  // Johannesburg
  { id: 'joburg-park', name: 'Park Station', lng: 28.0441, lat: -26.1952, city: 'Johannesburg' },
  // Nairobi
  { id: 'nairobi-central', name: 'Nairobi Central', lng: 36.8337, lat: -1.2894, city: 'Nairobi' },
  // Casablanca
  { id: 'casablanca-voyageurs', name: 'Casa-Voyageurs', lng: -7.5881, lat: 33.5883, city: 'Casablanca' },
  // Lagos
  { id: 'lagos-ebute-metta', name: 'Ebute Metta', lng: 3.3805, lat: 6.4858, city: 'Lagos' },
  // Addis Ababa
  { id: 'addis-lrt', name: 'Addis Ababa LRT', lng: 38.7468, lat: 9.0054, city: 'Addis Ababa' },

  // ─── South America ──────��───────────────────────────────────────────────
  // São Paulo
  { id: 'sp-luz', name: 'Estação da Luz', lng: -46.6352, lat: -23.5346, city: 'São Paulo' },
  { id: 'sp-julio-prestes', name: 'Júlio Prestes', lng: -46.6395, lat: -23.5343, city: 'São Paulo' },
  // Buenos Aires
  { id: 'ba-retiro', name: 'Retiro', lng: -58.3751, lat: -34.5912, city: 'Buenos Aires' },
  { id: 'ba-constitucion', name: 'Constitución', lng: -58.3817, lat: -34.6273, city: 'Buenos Aires' },
  // Lima
  { id: 'lima-desamparados', name: 'Desamparados', lng: -77.0263, lat: -12.0458, city: 'Lima' },
  // Bogotá
  { id: 'bogota-sabana', name: 'Estación de la Sabana', lng: -74.0860, lat: 4.6230, city: 'Bogotá' },
  // Santiago
  { id: 'santiago-central', name: 'Estación Central', lng: -70.6785, lat: -33.4517, city: 'Santiago' },
  // Rio de Janeiro
  { id: 'rio-central', name: 'Central do Brasil', lng: -43.1713, lat: -22.9026, city: 'Rio de Janeiro' },

  // ─── Oceania ─────────────────────────────────────���──────────────────────
  // Sydney
  { id: 'sydney-central', name: 'Central Station', lng: 151.2067, lat: -33.8830, city: 'Sydney' },
  // Melbourne
  { id: 'melbourne-flinders', name: 'Flinders Street', lng: 144.9671, lat: -37.8183, city: 'Melbourne' },
  { id: 'melbourne-southern-cross', name: 'Southern Cross', lng: 144.9527, lat: -37.8184, city: 'Melbourne' },
  // Auckland
  { id: 'auckland-britomart', name: 'Britomart', lng: 174.7677, lat: -36.8446, city: 'Auckland' },
];

/** Find the nearest major station within a radius (meters) */
export function findNearestMajorStation(lng: number, lat: number, maxMeters = 500): MajorStation | null {
  let best: MajorStation | null = null;
  let bestDist = Infinity;
  for (const s of MAJOR_STATIONS) {
    const d = haversineMeters(lng, lat, s.lng, s.lat);
    if (d < maxMeters && d < bestDist) {
      bestDist = d;
      best = s;
    }
  }
  return best;
}

/** Get all major stations NOT in the given city */
export function getIntercityStations(currentCity: string): MajorStation[] {
  return MAJOR_STATIONS.filter(s => s.city !== currentCity);
}

/** Get all major stations in the same city */
export function getSameCityMajorStations(city: string): MajorStation[] {
  return MAJOR_STATIONS.filter(s => s.city === city);
}

function haversineMeters(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
