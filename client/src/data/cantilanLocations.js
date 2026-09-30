// Barangays and common landmarks of Cantilan, Surigao del Sur.
// Used to power the Location autocomplete on the citizen Submit a Report form.
export const CANTILAN_BARANGAYS = [
  'Bugsukan',
  'Buntalid',
  'Cabangahan',
  'Cabas-an',
  'Calagdaan',
  'Consuelo',
  'General Island',
  'Lininti-an',
  'Magasang',
  'Magosilom',
  'Pag-antayan',
  'Palasao',
  'Parang',
  'San Pedro',
  'San Roque',
  'Tapi',
  'Tinago',
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

export const CANTILAN_BARANGAY_OPTIONS = CANTILAN_BARANGAYS.map(b => `Barangay ${b}`);

export const CANTILAN_LOCATIONS = [
  ...CANTILAN_BARANGAY_OPTIONS,
  ...CANTILAN_LANDMARKS,
];

// Letters and digits only, so "cabasan" matches "Cabas-an".
const plain = text => text.toLowerCase().replace(/[^a-z0-9]/g, '');
// The same without a leading "Barangay" or "Brgy.", so "brgy parang" matches "Parang".
const bareName = text => plain(text.trim().toLowerCase().replace(/^(barangay|brgy\.?)(\s+|$)/, ''));

// Suggestions for the Location field: every barangay (CANTILAN_BARANGAY_OPTIONS
// itself) until a name is typed, then the matching barangays and landmarks, with
// names that start with the typed text first.
export function suggestLocations(value) {
  const typed = plain(value);
  const bare = bareName(value);
  const typingBarangay = typed.length >= 3 && 'barangay'.startsWith(typed);
  if (!typed || !bare || typingBarangay) return CANTILAN_BARANGAY_OPTIONS;
  const rank = loc => {
    const name = bareName(loc);
    if (name.startsWith(bare)) return 0;
    return name.includes(bare) ? 1 : -1;
  };
  return CANTILAN_LOCATIONS
    .map(loc => ({ loc, rank: rank(loc) }))
    .filter(item => item.rank >= 0)
    .sort((a, b) => a.rank - b.rank)
    .map(item => item.loc);
}
