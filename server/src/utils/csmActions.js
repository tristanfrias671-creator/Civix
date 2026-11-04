// What an office can do about a part of its service that clients rated low on the
// satisfaction form (ARTA CSM): on one form, a part answered Disagree or Strongly
// disagree; in the results, a part whose score is under 80% (below Satisfactory, so
// Fair or Poor). Suggestions for the office's action plan, based on the Citizen's
// Charter and Republic Act 11032 (Ease of Doing Business); each office decides its
// own actions. The same list is in client/src/data/csmActions.js: keep the two in step.
const { SQD } = require('./csm');

const LOW_ANSWER = 2; // Disagree (2) or Strongly disagree (1)
const LOW_SCORE = 80; // under Satisfactory

const SQD_ACTIONS = {
  // Overall: only when no single part was rated low
  sqd0: [
    "Read the client's comments and the parts of the service rated lowest, and talk them over at the next office meeting.",
    "Agree on one or two changes, write them in the office's action plan, and check next month's results.",
  ],
  // Responsiveness: the time spent
  sqd1: [
    "Compare the actual waiting and processing time with the time in the Citizen's Charter.",
    'Use queue numbers, and add a counter or a staff member at the busiest hours.',
    'Tell clients how long the service will take when they arrive.',
  ],
  // Reliability: the requirements and steps followed
  sqd2: [
    "Follow the requirements and steps exactly as the Citizen's Charter lists them, and ask for nothing that is not on the list.",
    'Give front-line staff a checklist of the requirements for each service.',
  ],
  // Access and facilities: easy, simple steps
  sqd3: [
    'Remove steps, signatures and forms that are not needed, so clients go to as few windows as possible.',
    'Put up clear signs, and have a help desk or a staff member guide clients.',
  ],
  // Communication: information easy to find
  sqd4: [
    "Post the requirements, steps, fees and processing time at the office and online, and keep the Citizen's Charter board up to date.",
    'Before the client leaves, explain the next step and anything still missing.',
  ],
  // Costs: reasonable fees
  sqd5: [
    'Post the official fees, explain each one, and give an official receipt for every payment.',
    "Make sure no one asks for a fee that is not in the Citizen's Charter.",
  ],
  // Integrity: fair to everyone ("walang palakasan")
  sqd6: [
    'Serve clients in the order they arrive, with queue numbers; give priority only to senior citizens, persons with disabilities and pregnant women.',
    'Apply the same rules to everyone, and remind staff that fixers are not allowed (RA 11032).',
  ],
  // Assurance: courteous, helpful staff
  sqd7: [
    'Hold a short courtesy and customer-service session for front-line staff.',
    'Have staff wear their ID or name plate, so clients know whom they talked to.',
    'Follow up on any complaint about how a staff member treated a client.',
  ],
  // Outcome: got what was needed, or a denial explained
  sqd8: [
    'When a request is denied, explain why in writing and tell the client what they can do next.',
    'Tell clients everything that is missing on their first visit, and follow up on requests still pending.',
  ],
};

// The parts one form rated Disagree or Strongly disagree, the lowest answer first.
// SQD0 only when no other part was rated low (its actions are general).
function lowAnswers(csm) {
  if (!csm) return [];
  const low = SQD.slice(1)
    .filter(key => csm[key] != null && csm[key] <= LOW_ANSWER)
    .sort((a, b) => csm[a] - csm[b] || SQD.indexOf(a) - SQD.indexOf(b));
  if (!low.length && csm.sqd0 != null && csm.sqd0 <= LOW_ANSWER) low.push('sqd0');
  return low;
}

// The parts of a result (csmResults.summarize) under 80%, the lowest score first.
// SQD0 only when no other part is that low.
function lowParts(result) {
  if (!result?.responses) return [];
  const low = SQD.slice(1)
    .filter(key => result.sqd[key].score != null && result.sqd[key].score < LOW_SCORE)
    .sort((a, b) => result.sqd[a].score - result.sqd[b].score || SQD.indexOf(a) - SQD.indexOf(b));
  if (!low.length && result.sqd.sqd0.score != null && result.sqd.sqd0.score < LOW_SCORE) low.push('sqd0');
  return low;
}

module.exports = { LOW_ANSWER, LOW_SCORE, SQD_ACTIONS, lowAnswers, lowParts };
