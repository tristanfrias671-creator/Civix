// Barangays and common landmarks of Cantilan, Surigao del Sur.
// Used to power the Location autocomplete on the citizen Submit a Report form.
export const CANTILAN_BARANGAYS = [
  'Buntalid',
  'Cabas-an',
  'Calagdaan',
  'Consuelo',
  'Hain',
  'Handumanan',
  'Loyola',
  'Magasang',
  'Magosilom',
  'Mahayahay',
  'Malinao',
  'Palasao',
  'Parang',
  'Poblacion',
  'San Pedro',
  'Sungkit',
  'Tigabong',
];

export const CANTILAN_LANDMARKS = [
  'Cantilan Town Hall',
  'Cantilan Public Market',
  'Cantilan Police Station',
  'Cantilan Port',
  'Cantilan National High School',
  'Cantilan National Comprehensive High School',
  'Surigao del Sur Provincial Hospital – Cantilan',
  'Cantilan Central Elementary School',
  'Cantilan Plaza',
  'Cantilan National Highway',
  'Cantilan Bridge',
  'St. John the Baptist Parish Church',
  'Barangay Hall',
];

export const CANTILAN_LOCATIONS = [
  ...CANTILAN_BARANGAYS.map(b => `Barangay ${b}`),
  ...CANTILAN_LANDMARKS,
];
