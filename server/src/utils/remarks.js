// The kind of remark a client wrote in the last box of the satisfaction form
// ("Suggestions on how we can further improve our services"): a comment, a
// complaint or a suggestion, read from its words in English, Filipino or Bisaya.
// It sits next to the form's label (Positive, Neutral or Negative, utils/csm.js),
// as the panel asked: Comments, Complaints and Suggestions, Positive, Negative and
// Neutral. The rule, as client/src/components/common/RemarkRule.jsx explains it:
//  - Complaint: the remark names a problem (slow, rude, matagal, bastos, dugay,
//    guba), or a good quality with "not" before it (not clear, hindi maayos, dili
//    maayo).
//  - Suggestion: if not, it asks for a change (should, add, improve, sana, dapat,
//    unta, dugangan).
//  - Comment: any other remark, such as thanks or praise.
// A word right after no, not, hindi, wala or dili (in the same part of a sentence)
// reads the other way: "walang problema" is no complaint. "None", "N/A" or "wala po"
// is no remark (null). Since Nov 10, 2026 the box is the only place a citizen writes
// a complaint or suggestion (one form for all three, the panel's request): the form
// shows this reading as the citizen types, the citizen may correct it, and a
// complaint or suggestion is then also sent to the office as a report, with a
// deadline (controllers/submissions.js, createForm). A comment stays with the answers.

const REMARKS = ['COMMENT', 'COMPLAINT', 'SUGGESTION'];
const REMARK_PLURAL = { COMMENT: 'Comments', COMPLAINT: 'Complaints', SUGGESTION: 'Suggestions' };

// Words for a problem with the service.
const PROBLEM_WORDS = new Set([
  // English
  'bad', 'terrible', 'awful', 'horrible', 'poor', 'worst', 'rude', 'disrespectful', 'unprofessional', 'arrogant',
  'angry', 'upset', 'disappointed', 'disappointing', 'dissatisfied', 'unsatisfied', 'complain', 'complained',
  'complaint', 'complaints', 'problem', 'problems', 'slow', 'delay', 'delayed', 'delays', 'late', 'waited',
  'waste', 'wasted', 'dirty', 'smelly', 'broken', 'damaged', 'unfair', 'corrupt', 'corruption', 'bribe', 'fixer',
  'fixers', 'favoritism', 'ignored', 'overcharged', 'absent', 'confusing', 'confused', 'unclear', 'lost', 'wrong',
  'mistake', 'mistakes', 'error', 'errors', 'failed', 'useless', 'inefficient', 'incompetent', 'negligent',
  'shouted', 'yelled', 'scolded', 'crowded', 'unorganized', 'disorganized', 'lacking',
  // Filipino
  'pangit', 'masama', 'mabagal', 'matagal', 'tagal', 'antagal', 'bastos', 'masungit', 'suplado', 'suplada',
  'mataray', 'mali', 'sira', 'nasira', 'mahirap', 'reklamo', 'problema', 'dismayado', 'nadismaya',
  'nakakadismaya', 'nakakainis', 'galit', 'marumi', 'madumi', 'magulo', 'siksikan', 'naghintay', 'pinaghintay',
  'palakasan', 'suhol', 'kulang',
  // Bisaya
  'daotan', 'hinay', 'dugay', 'kadugay', 'sayop', 'guba', 'nadaot', 'lisud', 'kapoy', 'hugaw', 'suko', 'nasuko',
  'naglagot', 'samok', 'naghulat', 'gipahulat', 'kuwang',
]);

// Groups of words for a problem.
const PROBLEM_PHRASES = [
  'too long', 'so long', 'very long', 'took long', 'is long', 'was long', 'are long', 'were long',
  'long line', 'long lines', 'long queue', 'long queues', 'long wait', 'long waiting',
  'mahaba ang pila', 'mahabang pila', 'taas ang linya', 'taas kaayo ang linya', 'taas ang pila',
].map(p => p.split(' '));

// Good qualities: with "not" before them, a problem (not clear, hindi maayos).
const GOOD_WORDS = new Set([
  'good', 'nice', 'clear', 'fast', 'quick', 'helpful', 'friendly', 'polite', 'kind', 'clean', 'organized',
  'satisfied', 'satisfactory', 'accommodating', 'efficient', 'easy', 'responsive', 'approachable', 'courteous',
  'fair', 'enough',
  'maganda', 'mabuti', 'maayos', 'mabilis', 'malinaw', 'malinis', 'magalang', 'mabait', 'matulungin',
  'kontento', 'madali', 'organisado', 'sapat',
  'maayo', 'nindot', 'paspas', 'klaro', 'limpyo', 'buotan', 'matinabangon', 'matinahuron', 'sayon', 'igo',
]);

// Words that ask for a change.
const SUGGEST_WORDS = new Set([
  // English
  'suggest', 'suggestion', 'suggestions', 'suggested', 'recommend', 'recommendation', 'recommended', 'should',
  'hope', 'hopefully', 'wish', 'add', 'additional', 'more', 'improve', 'improvement', 'provide', 'install',
  'extend', 'increase', 'hire', 'upgrade', 'prioritize', 'need', 'needs', 'kindly', 'maybe', 'perhaps', 'consider',
  // Filipino
  'sana', 'sanay', 'dapat', 'mungkahi', 'imungkahi', 'dagdagan', 'magdagdag', 'dagdag', 'karagdagang', 'lagyan',
  'maglagay', 'ayusin', 'pagbutihin', 'bilisan', 'pabilisin', 'nawa', 'paki', 'pakiayos', 'pakibilisan',
  'madagdagan', 'pakidagdagan', 'pakilagyan', 'iminumungkahi',
  // Bisaya
  'unta', 'untaa', 'sugyot', 'isugyot', 'dugangan', 'idugang', 'dugang', 'butangan', 'ayuha', 'ayohon',
  'paspasan', 'papaspasa', 'hinaut', 'madugangan', 'dugangi', 'butangi', 'ipaayo',
]);

// Groups of words that ask for a change.
const SUGGEST_PHRASES = [
  'would be', 'could be', 'could also', 'it would', 'better if', 'would like',
  'mas maganda kung', 'mas mabuti kung', 'mas maayo kung', 'mas maayo kon',
].map(p => p.split(' '));

// Taken out before reading: service names and greetings that would read wrong
// ("late registration" is a service of the Civil Registry; "more power" is praise).
const IGNORE = ['late registration', 'delayed registration', 'more power', 'god bless'];

const NEGATORS = new Set(['not', 'no', 'never', 'hindi', 'di', 'wala', 'walang', 'dili', 'walay', 'wa', 'without']);
// "not only", "hindi lang": no negation.
const ONLY = new Set(['only', 'just', 'lang', 'lamang', 'ra']);

// "None", "N/A", "Wala po", "No comment, thank you": no remark.
const NONE_CORE = new Set(['none', 'nothing', 'no', 'n', 'na', 'nil', 'nope', 'wala', 'walay']);
const NONE_OTHER = new Set([
  'a', 'comment', 'comments', 'suggestion', 'suggestions', 'remark', 'remarks', 'feedback', 'po', 'so', 'far',
  'yet', 'for', 'now', 'at', 'the', 'moment', 'pa', 'ko', 'koy', 'akoy', 'ako', 'kay', 'lang', 'ra', 'man', 'sir',
  'maam', 'mam', 'thank', 'thanks', 'you', 'salamat', 'ty', 'more', 'else', 'any', 'is', 'there', 'other', 'than', 'that',
]);

// The parts of a text (split at . , ! ? ; : and new lines), each a list of words.
function clauses(text) {
  let s = String(text || '').toLowerCase().replace(/[‘’]/g, "'").replace(/n't\b/g, ' not').replace(/-/g, ' ');
  for (const phrase of IGNORE) s = s.split(phrase).join(' ');
  return s.split(/[.,!?;:\n]+/).map(part => part.split(/[^a-zñ]+/).filter(Boolean)).filter(words => words.length);
}

// Whether a negator comes just before position i (one word, or two with a word
// that is not "only" between).
function negated(words, i) {
  if (NEGATORS.has(words[i - 1])) return true;
  return NEGATORS.has(words[i - 2]) && !ONLY.has(words[i - 1]);
}

const startsAt = (words, i, phrase) => phrase.every((w, k) => words[i + k] === w);

function hasProblem(words) {
  return words.some((w, i) => {
    if (PROBLEM_WORDS.has(w) || PROBLEM_PHRASES.some(p => startsAt(words, i, p))) return !negated(words, i);
    return GOOD_WORDS.has(w) && negated(words, i);
  });
}

const asksForChange = words => words.some((w, i) => SUGGEST_WORDS.has(w) || SUGGEST_PHRASES.some(p => startsAt(words, i, p)));

// COMMENT, COMPLAINT or SUGGESTION; null when there is no remark.
function remarkKind(text) {
  const parts = clauses(text);
  const all = parts.flat();
  if (!all.length) return null;
  if (all.some(w => NONE_CORE.has(w)) && all.every(w => NONE_CORE.has(w) || NONE_OTHER.has(w))) return null;
  if (parts.some(hasProblem)) return 'COMPLAINT';
  if (parts.some(asksForChange)) return 'SUGGESTION';
  return 'COMMENT';
}

module.exports = { REMARKS, REMARK_PLURAL, remarkKind };
