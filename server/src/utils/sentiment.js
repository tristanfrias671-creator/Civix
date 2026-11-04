// Positive, Neutral or Negative from the words of a text: each word on the first
// list counts +1, each on the second -1. Citizens write in English, Filipino or
// Bisaya, so the lists have the common words of all three. Feedback is labelled
// from its satisfaction answers instead (utils/csm.js); these words decide only
// when every answer is N/A. ("palakasan" is left out: "walang palakasan" is praise.)
const positiveWords = [
  'good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'happy',
  'satisfied', 'pleased', 'appreciate', 'thanks', 'thank', 'helpful', 'nice',
  'improve', 'improved', 'better', 'best', 'love', 'like', 'clean', 'safe',
  'efficient', 'quick', 'fast', 'effective', 'working', 'works', 'fixed',
  'resolved', 'solution', 'positive', 'benefit', 'excellent', 'outstanding',
  // Filipino
  'salamat', 'maganda', 'mabuti', 'magaling', 'mabilis', 'matulungin', 'mabait',
  'malinaw', 'malinis', 'natuwa', 'nasiyahan', 'masaya', 'magalang', 'maayos', 'kontento',
  // Bisaya
  'maayo', 'nindot', 'paspas', 'matinabangon', 'buotan', 'klaro', 'limpyo',
  'nalipay', 'malipayon', 'matinahuron',
];

const negativeWords = [
  'bad', 'terrible', 'awful', 'horrible', 'poor', 'worst', 'angry', 'upset',
  'disappointed', 'dissatisfied', 'complaint', 'problem', 'issue', 'broken',
  'dirty', 'unsafe', 'dangerous', 'negligent', 'neglect', 'slow', 'delay',
  'delayed', 'fail', 'failed', 'failure', 'wrong', 'error', 'corrupt',
  'waste', 'wasted', 'inefficient', 'useless', 'garbage', 'flood', 'damage',
  'damaged', 'urgent', 'emergency', 'critical', 'serious', 'severe', 'rude',
  // Filipino
  'pangit', 'masama', 'mabagal', 'matagal', 'bastos', 'masungit', 'mali', 'sira',
  'mahirap', 'reklamo', 'problema', 'dismayado', 'nadismaya', 'galit', 'marumi',
  // Bisaya
  'daotan', 'hinay', 'dugay', 'sayop', 'guba', 'lisud', 'kapoy', 'hugaw',
  'suko', 'nasuko',
];

function analyzeSentiment(text) {
  const lower = String(text || '').toLowerCase();
  const words = lower.split(/\W+/);
  let score = 0;
  for (const word of words) {
    if (positiveWords.includes(word)) score++;
    if (negativeWords.includes(word)) score--;
  }
  if (score > 0) return 'POSITIVE';
  if (score < 0) return 'NEGATIVE';
  return 'NEUTRAL';
}

module.exports = { analyzeSentiment };
