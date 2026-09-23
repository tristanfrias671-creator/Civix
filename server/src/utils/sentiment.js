const positiveWords = [
  'good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'happy',
  'satisfied', 'pleased', 'appreciate', 'thanks', 'thank', 'helpful', 'nice',
  'improve', 'improved', 'better', 'best', 'love', 'like', 'clean', 'safe',
  'efficient', 'quick', 'fast', 'effective', 'working', 'works', 'fixed',
  'resolved', 'solution', 'positive', 'benefit', 'excellent', 'outstanding',
];

const negativeWords = [
  'bad', 'terrible', 'awful', 'horrible', 'poor', 'worst', 'angry', 'upset',
  'disappointed', 'dissatisfied', 'complaint', 'problem', 'issue', 'broken',
  'dirty', 'unsafe', 'dangerous', 'negligent', 'neglect', 'slow', 'delay',
  'delayed', 'fail', 'failed', 'failure', 'wrong', 'error', 'corrupt',
  'waste', 'wasted', 'inefficient', 'useless', 'garbage', 'flood', 'damage',
  'damaged', 'urgent', 'emergency', 'critical', 'serious', 'severe',
];

function analyzeSentiment(text) {
  const lower = text.toLowerCase();
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
