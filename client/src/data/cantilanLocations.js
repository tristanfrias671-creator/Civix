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
  'Lobo',
  'Magasang',
  'Magosilom',
  'Pag-antayan',
  'Palasao',
  'Parang',
  'San Pedro',
  'Tapi',
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

export const CANTILAN_BARANGAY_OPTIONS = CANTILAN_BARANGAYS.map(b => `Barangay ${b}`);

export const CANTILAN_LOCATIONS = [
  ...CANTILAN_BARANGAY_OPTIONS,
  ...CANTILAN_LANDMARKS,
];

// Letters and digits only, so "cabasan" matches "Cabas-an".
const plain = text => text.toLowerCase().replace(/[^a-z0-9]/g, '');
// The same without a leading "Barangay" or "Brgy.", so "brgy parang" matches "Parang".
const bareName = text => plain(text.trim().toLowerCase().replace(/^(barangay|brgy\.?)(\s+|$)/, ''));

const escapeRegex = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// "Barangay Parang", "Brgy. Parang" or "brgy parang" at the start of the text.
const LEADING_BARANGAY = new RegExp(
  `^(?:barangay|brgy\\.?)\\s*(?:${[...CANTILAN_BARANGAYS].sort((a, b) => b.length - a.length).map(escapeRegex).join('|')})(?![a-z])`,
  'i',
);

// The Location text with the barangay from a map pin, keeping what the citizen
// typed: an empty field becomes "Barangay X"; a leading barangay is swapped
// ("Barangay Parang, Purok 2" → "Barangay Lobo, Purok 2"); text that already
// names X is kept; anything else gets "Barangay X, " in front.
export function withBarangay(address, barangay) {
  const name = `Barangay ${barangay}`;
  const text = String(address || '').trim();
  if (!text) return name;
  if (LEADING_BARANGAY.test(text)) return text.replace(LEADING_BARANGAY, name);
  if (mentions(text, barangay)) return text;
  return `${name}, ${text}`;
}

// Whether the text names the barangay as a whole word ("Cabas-an" also matches
// "cabas an" and "cabasan"). No lookbehind: older iPhones can't parse it.
function mentions(text, barangay) {
  const word = escapeRegex(barangay.toLowerCase()).replace(/[-\s]+/g, '[-\\s]?');
  return new RegExp(`(?:^|[^a-z])${word}(?![a-z])`, 'i').test(text);
}

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
