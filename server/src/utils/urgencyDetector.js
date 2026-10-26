/**
 * CIVIX AI urgency detection: how urgent a complaint is, read from what the citizen
 * wrote, in English, Filipino and Bisaya (utils/classifier.js reads the office the
 * same way). The report form shows the result while the citizen types, and the
 * server decides again when the report is sent (controllers/submissions.js).
 *
 *   URGENT    someone could get hurt, or something is dangerous right now
 *   LOW       "Can wait": a small or cosmetic problem, or the citizen says it can wait
 *   STANDARD  "Normal": everything else, and whenever the words give no clear sign
 *
 * Words are grouped into signs, and each sign counts once however many of its words
 * appear. A danger sign (3 points) makes a complaint Urgent on its own; a serious
 * sign (2) needs one more point: another sign, or words that raise the stakes
 * (children, many families, right now; at most 2 points). A word right after "no",
 * "not", "wala", "hindi", "dili"… doesn't count ("walang nasaktan" = no one was hurt),
 * and any danger or serious sign rules out "Can wait". Staff can change the result,
 * with a reason (controllers/staff.js).
 */
const { preprocessText, levenshtein } = require('./classifier');

const MAX_CHARS = 2000;   // reports are limited to this length
const URGENT_AT = 3;      // points that make a complaint Urgent
const CAN_WAIT_AT = 2;    // "can wait" points that make it Can wait (when nothing is serious)
const RAISE_MOST = 2;     // the most points that raising words add
const NEAR = 3;           // words on each side checked by `unlessNear`
const MAX_WORDS = 6;      // words returned to explain the result

// Words that turn around the next one or two words ("walang nasaktan", "not dangerous").
const NEGATIONS = new Set([
  'no', 'not', 'never', 'without', 'none', 'nobody', 'nothing', 'neither', 'nor',
  'isnt', 'wasnt', 'arent', 'werent', 'dont', 'doesnt', 'didnt', 'hasnt', 'havent', 'hadnt',
  'wont', 'wouldnt', 'cant', 'cannot', 'couldnt', 'shouldnt',
  'wala', 'walang', 'walay', 'wa', 'hindi', 'di', 'dili', 'huwag', 'ayaw',
]);
// Short words that are skipped when counting those one or two words, and inside
// phrases ("hindi naman delikado", "delikado gyud kaayo").
const FILLERS = new Set([
  'naman', 'man', 'pa', 'pang', 'pay', 'na', 'nang', 'ra', 'lang', 'lamang', 'po', 'ba',
  'gyud', 'jud', 'gud', 'talaga', 'kaayo', 'masyado', 'really', 'very', 'too', 'so',
  'yet', 'even', 'ever', 'seriously', 'badly', 'severely',
]);

// Root words ("sugat*" in a list): Filipino and Bisaya build many words from one root
// ("nasugatan", "sugatang", "bumagsak", "nahugawan"). A word counts for the root when
// it is the root with a common prefix and/or suffix, an -um-/-in- after the first
// letter, or its first syllable said twice. The bare root counts only if it is also
// listed without "*" ("kuryente" alone is just electricity).
const PREFIXES = ['', 'i', 'um', 'na', 'ma', 'ka', 'ga', 'gi', 'ni', 'mi', 'mo', 'nag', 'mag', 'nang', 'mang', 'naga', 'maga',
  'naka', 'maka', 'nagka', 'magka', 'nakaka', 'makaka', 'nagkaka', 'pag', 'pagka', 'gina', 'gipang', 'nanga', 'napa', 'gipa',
  'nagpa', 'ipa', 'nahi', 'pina', 'pinag'];
const SUFFIXES = ['', 'an', 'han', 'in', 'hin', 'on', 'hon', 'ng', 'g', 'ang', 'hang'];
function hasRoot(token, root) {
  if (token === root || token.length > root.length + 9 || !token.includes(root.slice(1))) return false;
  for (const p of PREFIXES) {
    if (!token.startsWith(p)) continue;
    for (const s of SUFFIXES) {
      if (!token.endsWith(s) || p.length + s.length >= token.length) continue;
      const middle = token.slice(p.length, token.length - s.length);
      if (middle === root) return true;
      const extra = middle.length - root.length;
      // b-um-agsak, s-in-aksak
      if (extra === 2 && (middle.slice(1, 3) === 'um' || middle.slice(1, 3) === 'in') && middle[0] + middle.slice(3) === root) return true;
      // su-sunog, ka-kagat; a-apaw
      if (extra === 2 && middle.slice(2) === root && middle.slice(0, 2) === root.slice(0, 2)) return true;
      if (extra === 1 && middle.slice(1) === root && middle[0] === root[0]) return true;
    }
  }
  return false;
}

// Word groups used by more than one sign.
const ELECTRIC = ['electric', 'electrical', 'electricity', 'power', 'voltage', 'high voltage', 'transformer', 'kuryente', 'koryente', 'surseco'];
const WIRES = ['wire', 'wires', 'cable', 'cables', 'power line', 'power lines', 'kable', 'kawad', 'alambre', 'linya sa kuryente', 'linya ng kuryente'];
const LOOSE = [
  'hanging', 'dangling', 'fallen', 'fell', 'broken', 'loose', 'sagging', 'exposed', 'burning', 'smoking', 'on the ground', 'down',
  'nakalaylay', 'laylay', 'nakabitin', 'nakabiting', 'nahulog', 'naputol', 'putol', 'sira', 'umuusok',
  'nagbitay', 'nagbiting', 'lawlaw', 'nabugto', 'bugto', 'nahagsa', 'guba', 'naguba', 'nagaaso',
];
const SMOKE = ['smoke', 'smoking', 'smoky', 'sparks', 'burning', 'usok', 'umuusok', 'aso', 'nag-aso', 'nagaaso'];
const POSTS = ['post', 'posts', 'pole', 'poles', 'lamp post', 'lamppost', 'poste'];
const TREES = ['tree', 'trees', 'branch', 'branches', 'coconut tree', 'puno', 'punongkahoy', 'sanga', 'kahoy', 'lubi'];
const FALLING = [
  'fell', 'fallen', 'falling', 'fall', 'leaning', 'uprooted', 'toppled', 'tilted', 'tilting',
  'tumba', 'tumba*', 'tumutumba', 'bagsak', 'bagsak*', 'hagsa*', 'nahulog', 'mahuhulog',
  'nakatagilid', 'tagilid', 'nakahilig', 'nabali', 'nabuak',
];
const BRIDGES = ['bridge', 'bridges', 'footbridge', 'dike', 'seawall', 'sea wall', 'riprap', 'dam', 'tulay', 'taytayan'];
const CRACKED = [
  'crack', 'cracks', 'cracked', 'cracking', 'damaged', 'broken', 'broke', 'weak', 'sinking', 'shaking', 'rotten',
  'bitak', 'nabitak', 'liki', 'nagliki', 'naliki', 'sira', 'nasira', 'bulok', 'guba', 'naguba', 'gabok', 'nauga',
];
const WATER = ['water', 'drinking water', 'tubig', 'inuming tubig'];
const DIRTY = ['dirty', 'contaminated', 'murky', 'muddy', 'polluted', 'marumi', 'madumi', 'hugaw', 'hugaw*', 'lubog', 'kontaminado'];
const DOGS = ['dog', 'dogs', 'stray', 'aso', 'askal', 'iro'];
const BITES = ['bite', 'bites', 'bitten', 'biting', 'kagat', 'kagat*', 'nangangagat', 'paak', 'paak*', 'mangagat'];
const RIVERS = ['river', 'creek', 'water level', 'ilog', 'sapa', 'suba'];
const RISING = ['rising', 'rises', 'risen', 'tumataas', 'nagtaas', 'misaka', 'nisaka', 'nagsaka', 'mitaas', 'nitaas'];

// The signs. `words`: single words or phrases ("~" after a long word lets it match a
// small typo). `all`: word groups that must all appear in one sentence (only the last
// group can be turned around by "no", "wala"…). `unlessNext`: words that cancel it
// right after it; `unlessNear`: words that cancel it within three words of it.
// kind: urgent (points 3 = danger, 2 = serious), raise, or wait ("can wait").
const SIGN_LIST = [
  // ── Danger: Urgent on its own ──
  { id: 'fire', kind: 'urgent', points: 3,
    words: ['fire', 'flames', 'on fire', 'caught fire', 'burned down', 'burnt down', 'house is burning', 'houses are burning',
      'burn our house', 'burn my house', 'burn the house', 'sunugin ang bahay', 'susunugin ang bahay', 'sunogon ang balay',
      'sunog', 'nasunog', 'nasusunog', 'nagliliyab', 'kalayo', 'nagkalayo'],
    unlessNext: ['extinguisher', 'extinguishers', 'exit', 'exits', 'hydrant', 'hydrants', 'drill', 'safety', 'permit', 'inspection',
      'station', 'truck', 'trucks', 'alarm', 'code', 'prevention', 'department', 'protection', 'fighter', 'fighters'],
    unlessNear: ['garbage', 'trash', 'rubbish', 'waste', 'leaves', 'plastic', 'rice', 'basura', 'basurahan', 'sagbot', 'dahon', 'plastik', 'kanin'] },
  { id: 'explosion', kind: 'urgent', points: 3,
    words: ['explosion', 'exploded', 'explode', 'exploding', 'gas leak', 'gas leaking', 'leaking gas', 'lpg leak', 'leaking lpg',
      'smell of gas', 'smells like gas', 'gas smell', 'sumabog', 'sumasabog', 'pagsabog', 'tagas ng gas', 'tumatagas na gas',
      'tumatagas ang gas', 'singaw ng gas', 'sabog*', 'nibuto', 'mibuto', 'nagbuto', 'mobuto', 'nagtulo ang gas', 'baho sa gas'] },
  { id: 'electric', kind: 'urgent', points: 3,
    words: ['live wire', 'live wires', 'exposed wire', 'exposed wires', 'naked wire', 'spark', 'sparks', 'sparking', 'short circuit',
      'electrocuted~', 'electrocution~', 'nag spark', 'nagspark', 'nagaspark', 'nakuryente', 'nakuryentehan~', 'nakoryente',
      'nakoryentehan', 'makuryente', 'makuryentehan', 'kuryentehan', 'kuryente*', 'koryente*'],
    // A loose or fallen live wire or post, or smoke from anything electric.
    all: [[ELECTRIC, WIRES, LOOSE], [ELECTRIC, POSTS, FALLING], [ELECTRIC, SMOKE]] },
  { id: 'landslide', kind: 'urgent', points: 3,
    words: ['landslide~', 'landslides', 'mudslide', 'rockslide', 'sinkhole', 'pagguho ng lupa', 'gumuho ang lupa', 'guho ng lupa',
      'nagdahili', 'dahili', 'pagdahili', 'nahugno ang yuta', 'nahugno nga yuta', 'nahugno ang bukid'] },
  { id: 'collapse', kind: 'urgent', points: 3,
    words: ['collapsed~', 'collapse', 'collapsing', 'caved in', 'cave in', 'about to collapse', 'about to fall',
      'gumuho', 'guguho', 'gumuguho', 'guho*', 'bumigay', 'nahugno', 'mahugno', 'nangahugno', 'hugno*', 'hapit na mahugno',
      'hapit na matumba'] },
  { id: 'injured', kind: 'urgent', points: 3,
    words: ['injured', 'injuries', 'injury', 'wounded', 'bleeding', 'unconscious~', 'fainted', 'not breathing', 'hospitalized~',
      'rushed to the hospital', 'brought to the hospital', 'run over', 'hit and run', 'lying on the road', 'lying on the ground',
      'not moving', 'not responding', 'unresponsive',
      'nasugatan', 'sugatan', 'sugat', 'sugat*', 'duguan', 'dugo', 'dugo*', 'nawalan ng malay', 'nahimatay', 'naospital',
      'dinala sa ospital', 'isinugod sa ospital',
      'nabundol', 'nasagasaan', 'nasagasa', 'nadisgrasya',
      'naangol', 'nasamaran', 'samaran', 'nasamad', 'samad', 'samad*', 'nagdugo', 'nakuyapan', 'gidala sa ospital'] },
  { id: 'death', kind: 'urgent', points: 3,
    words: ['died', 'dead body', 'dead person', 'killed', 'drowned', 'drowning', 'namatay', 'nalunod', 'bangkay', 'patay na tao',
      'nalumos', 'nangamatay', 'patay nga tawo', 'lunod*', 'lumos*'],
    // The lights or a phone "died" (namatay ang ilaw), not a person.
    unlessNear: ['light', 'lights', 'streetlight', 'streetlights', 'battery', 'engine', 'phone', 'cellphone', 'signal', 'plants',
      'ilaw', 'suga', 'kuryente', 'baterya', 'makina', 'halaman', 'tanom'] },
  { id: 'violence', kind: 'urgent', points: 3,
    words: ['stabbed', 'stabbing', 'gunshot', 'gunshots', 'was shot', 'got shot', 'shot dead', 'hostage', 'kidnapped', 'kidnapping',
      'beating', 'beaten', 'mauling', 'mauled', 'death threat', 'threatening to kill', 'threatened to kill', 'screaming for help',
      'binubugbog', 'binugbog', 'bugbog*', 'papatayin', 'gibunalan', 'ginabunalan', 'gikulata', 'patyon',
      'abducted', 'rape', 'raped', 'molested', 'nasaksak', 'sinaksak', 'pananaksak', 'binaril', 'barilan', 'pamamaril',
      'ginahasa', 'dinukot', 'kinidnap', 'saksak', 'saksak*', 'gidunggab', 'nadunggab', 'dunggab', 'dunggab*', 'gipusil', 'pinusil',
      'pinusilay', 'gilugos', 'gikidnap'] },
  { id: 'poison', kind: 'urgent', points: 3,
    words: ['food poisoning', 'poisoned', 'poisoning~', 'outbreak~', 'rabid', 'rabies', 'cholera', 'kolera', 'nalason', 'pagkalason',
      'asong ulol', 'ulol na aso', 'lason*', 'nahiloan', 'gihiloan', 'buang nga iro', 'iro nga buang'] },
  { id: 'trapped', kind: 'urgent', points: 3,
    words: ['trapped', 'missing child', 'missing person', 'capsized', 'nakulong', 'na trap', 'natrap', 'nawawalang bata',
      'nawawala ang bata', 'nawala ang bata', 'tumaob ang bangka', 'lumubog ang bangka', 'nawala nga bata', 'nabalintong ang',
      'swept away', 'carried away by the current', 'pinned', 'fell into the well', 'fell into a well', 'sinking boat',
      'boat is sinking', 'lumulubog', 'lulubog',
      'naanod', 'inanod', 'naipit sa loob', 'naipit sa ilalim', 'nahulog sa balon', 'nahulog sa bangin',
      'gianod', 'nabanlas', 'nahulog sa atabay', 'anod*', 'banlas*'] },
  { id: 'dam', kind: 'urgent', points: 3,
    all: [[['dam', 'dike'], ['crack', 'cracked', 'cracks', 'cracking', 'leaking', 'leak', 'leaks', 'breached', 'broken',
      'bitak', 'nabitak', 'tumutulo', 'tumatagas', 'liki', 'guba', 'naguba', 'nagtulo']]] },
  { id: 'snake bite', kind: 'urgent', points: 3,
    words: ['snake bite', 'snakebite', 'bitten by a snake', 'tinuklaw ng ahas', 'natuklaw ng ahas', 'natuklaw', 'tinuklaw',
      'gipaak sa halas', 'napaakan sa halas'],
    all: [[['snake', 'snakes', 'cobra', 'python', 'ahas', 'halas'], BITES]] },
  { id: 'grave', kind: 'urgent', points: 3,
    words: ['very dangerous', 'extremely dangerous', 'life threatening', 'deadly', 'flash flood',
      'sobrang delikado', 'napakadelikado', 'napaka delikado', 'delikadong delikado', 'sobrang mapanganib', 'napakamapanganib',
      'delikado kaayo', 'grabe ka delikado', 'peligroso kaayo', 'peligro kaayo'] },

  // ── Serious: Urgent with one more point ──
  { id: 'flood', kind: 'urgent', points: 2,
    words: ['flood', 'floods', 'flooded', 'flooding~', 'floodwater', 'floodwaters', 'baha', 'bumabaha', 'binaha', 'binabaha',
      'pagbaha', 'bahain', 'nabahaan', 'nagbaha', 'gibaha', 'nagabaha', 'baha*', 'lunop', 'nalunop', 'gilunop', 'nagalunop', 'lunop*'] },
  { id: 'overflow', kind: 'urgent', points: 2,
    words: ['overflowing', 'overflowed', 'overflow', 'river is rising', 'umaapaw', 'umapaw', 'tumataas ang ilog',
      'nag-apaw', 'apaw', 'apaw*', 'miawas', 'niawas', 'nag-awas', 'awas', 'awas*', 'suba misaka', 'misaka ang suba', 'nisaka ang suba'],
    all: [[RIVERS, RISING]],
    unlessNear: ['garbage', 'trash', 'bin', 'bins', 'septic', 'toilet', 'basura', 'basurahan', 'kasilyas', 'inidoro', 'sagbot'] },
  { id: 'fallen', kind: 'urgent', points: 2, all: [[[...POSTS, ...TREES], FALLING]] },
  { id: 'wires', kind: 'urgent', points: 2, all: [[WIRES, LOOSE]] },
  { id: 'accident', kind: 'urgent', points: 2,
    words: ['accident~', 'accidents', 'crash', 'crashed', 'collision', 'hit by', 'was hit', 'got hit', 'hit a child', 'hit a person',
      'hit a pedestrian', 'aksidente~', 'naaksidente', 'maaksidente', 'nabangga',
      'banggaan', 'nagbanggaan', 'disgrasya', 'madisgrasya', 'nagkadisgrasya'] },
  { id: 'hurt', kind: 'urgent', points: 2,
    words: ['hurt', 'harm', 'harmed', 'injure', 'fell into', 'fell from', 'nasaktan', 'masaktan', 'masasaktan', 'nahulog sa',
      'nasakitan', 'masakitan', 'maangol', 'mangaangol', 'nahagsa sa', 'nahulog gikan'] },
  { id: 'danger', kind: 'urgent', points: 2,
    words: ['dangerous~', 'danger', 'hazard', 'hazards', 'hazardous~', 'unsafe', 'risky', 'risk', 'perilous',
      'delikado~', 'delikadong', 'mapanganib~', 'panganib', 'nanganganib', 'peligro', 'peligroso~', 'kapeligrohan', 'makadisgrasya'] },
  { id: 'disease', kind: 'urgent', points: 2,
    words: ['dengue', 'typhoid', 'leptospirosis~', 'diarrhea', 'diarrhoea', 'measles', 'malaria', 'tigdas', 'pagtatae', 'nagtatae',
      'vomiting', 'vomited', 'got sick', 'getting sick', 'fell ill', 'nagsusuka', 'pagsusuka', 'nagkasakit', 'nagkakasakit',
      'kalibanga', 'nagkalibanga', 'nagsuka'] },
  { id: 'dirty water', kind: 'urgent', points: 2,
    words: ['contaminated~', 'contamination', 'sewage', 'oil spill', 'chemical spill', 'chemicals', 'chemical', 'toxic',
      'kontaminado', 'kemikal', 'nakakalason', 'makahilo'],
    all: [[WATER, DIRTY]] },
  { id: 'animal', kind: 'urgent', points: 2,
    words: ['dog bite', 'snake', 'snakes', 'cobra', 'python', 'crocodile', 'ahas', 'halas'],
    all: [[DOGS, BITES]] },
  { id: 'emergency', kind: 'urgent', points: 2,
    words: ['emergency~', 'urgent', 'urgently', 'rescue', 'ambulance', 'agaran', 'madalian', 'apurado', 'saklolo', 'ambulansya',
      'ambulansiya', 'dinalian', 'kinahanglan dayon'] },
  { id: 'no water', kind: 'urgent', points: 2,
    words: ['no water', 'no water supply', 'walang tubig', 'nawalan ng tubig', 'walay tubig', 'wala tubig', 'way tubig', 'wala nay tubig'] },
  { id: 'bridge', kind: 'urgent', points: 2, all: [[BRIDGES, CRACKED]] },
  { id: 'threat', kind: 'urgent', points: 2,
    words: ['threat', 'threatened', 'threatening', 'violence', 'violent', 'riot', 'brawl', 'rumble', 'banta', 'binantaan',
      'pinagbantaan', 'nagbabanta', 'pananakot', 'nananakot', 'tinakot', 'rambulan', 'suntukan', 'nag-aaway', 'nagaaway',
      'gihulga', 'hulga', 'gihulgaan', 'nanghulga', 'naghulga', 'gubot', 'nangaway', 'nag-away', 'banta*', 'hulga*',
      'amok', 'nag-amok', 'huramentado', 'naghuramentado', 'nagwawala', 'nagwala'] },
  { id: 'weapon', kind: 'urgent', points: 2,
    words: ['gun', 'guns', 'firearm', 'firearms', 'pistol', 'rifle', 'knife', 'knives', 'bolo', 'machete', 'armed',
      'baril', 'kutsilyo', 'itak', 'patalim', 'armas', 'sundang', 'pusil'] },
  { id: 'disaster', kind: 'urgent', points: 2,
    words: ['evacuate~', 'evacuation~', 'evacuated', 'stranded', 'typhoon', 'earthquake', 'tsunami', 'storm surge', 'daluyong',
      'big waves', 'huge waves',
      'lumikas', 'paglikas', 'bagyo', 'lindol', 'malalaking alon', 'bakwit', 'nibakwit', 'nagbakwit', 'linog', 'dagkong balod',
      'dako nga balod'] },

  // ── Raising the stakes: count only next to a danger or serious sign ──
  { id: 'vulnerable', kind: 'raise', points: 1,
    words: ['child', 'children', 'kid', 'kids', 'baby', 'babies', 'infant', 'toddler', 'students', 'pupils', 'school', 'schools',
      'elderly', 'senior', 'seniors', 'senior citizen', 'senior citizens', 'old people', 'pregnant', 'pwd', 'disabled',
      'patients', 'bata', 'mga bata', 'batang', 'kabataan', 'sanggol', 'estudyante', 'paaralan', 'eskwelahan',
      'matanda', 'matatanda', 'buntis', 'may sakit', 'tunghaan', 'eskuylahan', 'tigulang', 'mabdos', 'masakiton', 'maysakit'] },
  { id: 'many affected', kind: 'raise', points: 1,
    words: ['many families', 'many people', 'many houses', 'many residents', 'many households', 'families', 'whole barangay', 'entire barangay',
      'whole purok', 'entire purok', 'whole street', 'entire street', 'whole community', 'all residents',
      'maraming pamilya', 'maraming tao', 'maraming bahay', 'maraming residente', 'buong barangay', 'buong purok', 'buong kalye',
      'buong komunidad', 'lahat ng residente', 'daghang pamilya', 'daghang tawo', 'daghang balay', 'daghang residente',
      'tibuok barangay', 'tibuok purok', 'tanang residente', 'mga pamilya', 'mga pamilyang'] },
  { id: 'right now', kind: 'raise', points: 1,
    words: ['right now', 'happening now', 'at this moment', 'spreading', 'getting worse', 'worsening', 'water is rising', 'rising water',
      'ngayon mismo', 'lumalala', 'kumakalat', 'tumataas ang tubig', 'karon dayon', 'karon mismo', 'nagkagrabe',
      'nisaka ang tubig', 'misaka ang tubig', 'nagsaka ang tubig', 'nikaylap', 'mikaylap', 'nagkaylap',
      'entering the houses', 'entering our houses', 'entering houses', 'into the houses', 'into our houses',
      'pumapasok ang tubig', 'pumasok ang tubig', 'pumapasok sa mga bahay', 'nisulod sa mga balay', 'misulod sa mga balay',
      'nisulod sa balay', 'misulod sa balay', 'nisulod ang tubig', 'misulod ang tubig'] },
  { id: 'into homes', kind: 'raise', points: 1,
    all: [[['entering', 'entered', 'pumapasok', 'pumasok', 'misulod', 'nisulod', 'nagsulod'], ['houses', 'homes', 'bahay', 'balay']]] },
  { id: 'blocked', kind: 'raise', points: 1,
    words: ['blocking the road', 'blocks the road', 'road is blocked', 'road blocked', 'blocked road', 'impassable', 'cannot pass',
      'cant pass', 'no way to pass', 'not passable', 'hindi madaanan', 'di madaanan', 'hindi makadaan', 'sarado ang daan',
      'harang sa daan', 'nakaharang', 'dili maagian', 'di maagian', 'wala maagian', 'dili makaagi', 'babag sa dalan', 'nakababag'] },

  // ── Signs it can wait ──
  { id: 'small', kind: 'wait', points: 1,
    words: ['small', 'tiny', 'slight', 'slightly', 'minor', 'maliit', 'maliliit', 'kaunti', 'konti', 'kunti', 'gamay', 'gagmay',
      'gamayng', 'ginagmay', 'diyutay'] },
  { id: 'looks', kind: 'wait', points: 2,
    words: ['paint', 'painting', 'repaint', 'repainting', 'faded', 'peeling', 'cosmetic', 'beautify', 'beautification', 'landscaping',
      'mural', 'pintura', 'pinturahan', 'pinta', 'kupas', 'pagandahin', 'pagpapaganda',
      'pintal', 'pintalan', 'nangupas', 'pagpanindot', 'panindot'] },
  { id: 'can wait', kind: 'wait', points: 3,
    words: ['not urgent', 'not an emergency', 'no rush', 'no hurry', 'not a priority', 'low priority', 'can wait', 'when you have time',
      'whenever possible', 'when possible', 'whenever you can', 'someday', 'hindi urgent', 'hindi madalian', 'hindi kailangang madaliin',
      'walang madalian', 'kapag may oras', 'kung may oras', 'kapag may panahon', 'kahit kailan', 'pwedeng maghintay',
      'puwedeng maghintay', 'dili urgent', 'dili dinalian', 'walay dinalian', 'kung naa moy panahon', 'kung naay panahon',
      'kung adunay panahon', 'bisan kanus-a', 'pwede ra maghulat', 'pwede pa maghulat', 'puhon'] },
  { id: 'minor', kind: 'wait', points: 2,
    words: ['minor issue', 'minor problem', 'minor concern', 'minor repair', 'minor damage', 'small thing', 'small matter',
      'small issue', 'small problem', 'maliit na bagay', 'maliit na problema', 'gamay nga butang',
      'gamay nga problema', 'gamay ra nga problema'] },
  { id: 'nice to have', kind: 'wait', points: 2,
    words: ['would be nice', 'would be better', 'would be good', 'would be great', 'nice to have', 'mas maganda kung',
      'mas mabuti kung', 'mas maayo kung', 'maayo unta kung', 'mas nindot kung', 'nindot unta'] },
  { id: 'wish', kind: 'wait', points: 1,
    words: ['suggest', 'suggestion', 'recommend', 'improve', 'improvement', 'upgrade', 'hopefully', 'mungkahi', 'iminumungkahi',
      'dagdagan', 'sana magkaroon', 'decoration', 'decorations', 'decorate', 'dekorasyon', 'sugyot', 'gisugyot', 'dugangan',
      'unta adunay', 'unta naay'] },
];

// Each word cleaned once, when the server starts, and filed under its first word (so
// a sentence is read once per sign); long words marked "~" also go on a typo list.
function prepareWords(list) {
  const byFirst = new Map();
  const fuzzy = new Map(); // first letter -> long words that may be typed with a typo
  const roots = [];        // "sugat*": words built on the root (see hasRoot)
  for (const entry of list) {
    if (entry.endsWith('*')) {
      roots.push(preprocessText(entry.slice(0, -1)));
      continue;
    }
    const text = entry.replace(/~$/, '');
    const word = { text, tokens: preprocessText(text).split(' ') };
    if (!byFirst.has(word.tokens[0])) byFirst.set(word.tokens[0], []);
    byFirst.get(word.tokens[0]).push(word);
    if (entry.endsWith('~') && word.tokens.length === 1) {
      const letter = word.tokens[0][0];
      if (!fuzzy.has(letter)) fuzzy.set(letter, []);
      fuzzy.get(letter).push(word);
    }
  }
  return { byFirst, fuzzy, roots };
}
// Strongest first (urgent signs by points, then raising words, then "can wait" signs
// by points), so the strongest sign takes a word that two signs could both use.
const KIND_ORDER = { urgent: 0, raise: 1, wait: 2 };
const SIGNS = SIGN_LIST.map(sign => ({
  ...sign,
  words: prepareWords(sign.words || []),
  all: (sign.all || []).map(groups => groups.map(prepareWords)),
  unlessNext: new Set(sign.unlessNext || []),
  unlessNear: new Set(sign.unlessNear || []),
})).sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || b.points - a.points);

// A small typo in a long word ("dangerus", "dilikado"): one letter in words of 7
// letters or more, two in words of 10 or more (the first letter must be right).
function closeEnough(token, term) {
  if (term.length < 7 || token.length < 5) return false;
  const most = term.length >= 10 ? 2 : 1;
  return Math.abs(token.length - term.length) <= most && levenshtein(token, term) <= most;
}

// One past the last word of `phrase` when it starts at `i`, or 0 when it isn't there.
// Short words like "naman" may sit between its words.
function phraseEnd(tokens, i, phrase) {
  let j = i + 1;
  for (let k = 1; k < phrase.length; k++) {
    while (j < tokens.length && tokens[j] !== phrase[k] && FILLERS.has(tokens[j])) j++;
    if (tokens[j] !== phrase[k]) return 0;
    j++;
  }
  return j;
}

// Where the words appear in the sentence, in reading order: [{ start, end, text }]
// (end is one past the last word; a root's text is the word as written).
function findWords(tokens, { byFirst, fuzzy, roots }) {
  const found = [];
  for (let i = 0; i < tokens.length; i++) {
    for (const word of byFirst.get(tokens[i]) || []) {
      const end = phraseEnd(tokens, i, word.tokens);
      if (end) found.push({ start: i, end, text: word.text });
    }
    for (const root of roots) {
      if (hasRoot(tokens[i], root)) found.push({ start: i, end: i + 1, text: tokens[i] });
    }
    if (tokens[i].length < 5) continue;
    for (const word of fuzzy.get(tokens[i][0]) || []) {
      if (tokens[i] !== word.tokens[0] && closeEnough(tokens[i], word.tokens[0])) found.push({ start: i, end: i + 1, text: word.text });
    }
  }
  return found;
}

// True when "no", "wala", "hindi"… comes at most two words before `at` (short words
// like "naman" or "very" in between don't count).
function negated(tokens, at) {
  let words = 0;
  for (let i = at - 1; i >= 0 && words < 2; i--) {
    if (FILLERS.has(tokens[i])) continue;
    if (NEGATIONS.has(tokens[i])) return true;
    words++;
  }
  return false;
}

function cancelled(sign, tokens, { start, end }) {
  if (sign.unlessNext.size) {
    let next = end;
    while (next < tokens.length && FILLERS.has(tokens[next])) next++;
    if (sign.unlessNext.has(tokens[next])) return true;
  }
  if (sign.unlessNear.size) {
    for (let i = Math.max(0, start - NEAR); i < Math.min(tokens.length, end + NEAR); i++) {
      if ((i < start || i >= end) && sign.unlessNear.has(tokens[i])) return true;
    }
  }
  return false;
}

// Each word counts for one sign only: the strongest signs come first (SIGNS) and take
// their words (`used`, word positions in the sentence), so "very dangerous" isn't also
// counted as "dangerous", nor "live wire" as a loose "wire".
const overlaps = ({ start, end }, used) => {
  for (let i = start; i < end; i++) if (used.has(i)) return true;
  return false;
};
const take = ({ start, end }, used) => { for (let i = start; i < end; i++) used.add(i); };

// The first of `words` that counts in the sentence, as { start, end, text }, or null.
function firstHit(sign, tokens, words, mayBeNegated, used) {
  for (const at of findWords(tokens, words)) {
    if (overlaps(at, used)) continue;
    if (mayBeNegated && negated(tokens, at.start)) continue;
    if (cancelled(sign, tokens, at)) continue;
    return at;
  }
  return null;
}

// What shows the sign in this sentence ("sunog", "kuryente + kable + nakalaylay"), or
// null. The words it uses are marked as taken.
function matchSign(sign, tokens, used) {
  const hit = firstHit(sign, tokens, sign.words, true, used);
  if (hit) {
    take(hit, used);
    return hit.text;
  }
  for (const groups of sign.all) {
    const hits = [];
    for (let g = 0; g < groups.length; g++) {
      const groupHit = firstHit(sign, tokens, groups[g], g === groups.length - 1, used);
      if (!groupHit) break;
      hits.push(groupHit);
    }
    if (hits.length === groups.length) {
      hits.forEach(h => take(h, used));
      return hits.map(h => h.text).join(' + ');
    }
  }
  return null;
}

/**
 * How urgent a complaint is: { priority: 'URGENT' | 'STANDARD' | 'LOW', words, points }.
 * `words` are what decided an Urgent or Can wait result (strongest first; none for
 * Normal), `points` the urgent and can-wait totals.
 */
function detectUrgency(rawText) {
  const text = typeof rawText === 'string' ? rawText.slice(0, MAX_CHARS) : '';
  const found = new Map(); // sign id -> { sign, word }
  for (const sentence of text.split(/[.!?;\n]+/)) {
    const clean = preprocessText(sentence).replace(/\bno one\b/g, 'nobody');
    if (!clean) continue;
    const tokens = clean.split(' ');
    const used = new Set();
    for (const sign of SIGNS) {
      if (found.has(sign.id)) continue;
      const word = matchSign(sign, tokens, used);
      if (word) found.set(sign.id, { sign, word });
    }
  }

  const hits = [...found.values()];
  const sum = kind => hits.filter(h => h.sign.kind === kind).reduce((total, h) => total + h.sign.points, 0);
  const base = sum('urgent');
  const urgent = base ? base + Math.min(sum('raise'), RAISE_MOST) : 0;
  const canWait = sum('wait');

  let priority = 'STANDARD';
  if (urgent >= URGENT_AT) priority = 'URGENT';
  else if (!base && canWait >= CAN_WAIT_AT) priority = 'LOW';

  const kinds = { URGENT: ['urgent', 'raise'], LOW: ['wait'], STANDARD: [] }[priority];
  const words = hits
    .filter(h => kinds.includes(h.sign.kind))
    .sort((a, b) => b.sign.points - a.sign.points)
    .slice(0, MAX_WORDS)
    .map(h => h.word);
  return { priority, words, points: { urgent, canWait } };
}

module.exports = { detectUrgency };
