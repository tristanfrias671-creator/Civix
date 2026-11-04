// The ARTA Client Satisfaction Measurement (CSM) form that citizens answer as
// Feedback: its question keys, answer scale and choices. The same values as the
// server (server/src/utils/csm.js); the wording is in i18n/csmText.js.

export const CLIENT_TYPES = ['CITIZEN', 'BUSINESS', 'GOVERNMENT'];
export const SEXES = ['MALE', 'FEMALE'];

// Region of residence, as saved (official names, the same in every language).
// Cantilan is in Caraga, so it comes first.
export const REGIONS = [
  'Caraga (Region XIII)',
  'National Capital Region (NCR)',
  'Cordillera Administrative Region (CAR)',
  'Ilocos Region (Region I)',
  'Cagayan Valley (Region II)',
  'Central Luzon (Region III)',
  'CALABARZON (Region IV-A)',
  'MIMAROPA (Region IV-B)',
  'Bicol Region (Region V)',
  'Western Visayas (Region VI)',
  'Negros Island Region (NIR)',
  'Central Visayas (Region VII)',
  'Eastern Visayas (Region VIII)',
  'Zamboanga Peninsula (Region IX)',
  'Northern Mindanao (Region X)',
  'Davao Region (Region XI)',
  'SOCCSKSARGEN (Region XII)',
  'Bangsamoro (BARMM)',
  'Outside the Philippines',
];

// CC1 has 4 choices, CC2 5 and CC3 4; the last choice of CC2 and CC3 is N/A, which
// they both are when the client doesn't know the Citizen's Charter (CC1 = 4).
export const CC_KEYS = ['cc1', 'cc2', 'cc3'];
export const CC_NA = { cc2: 5, cc3: 4 };

export const SQD_KEYS = ['sqd0', 'sqd1', 'sqd2', 'sqd3', 'sqd4', 'sqd5', 'sqd6', 'sqd7', 'sqd8'];
// What each statement measures (English, for the staff and admin pages).
export const SQD_DIMENSIONS = {
  sqd0: 'Overall', sqd1: 'Responsiveness', sqd2: 'Reliability', sqd3: 'Access and facilities',
  sqd4: 'Communication', sqd5: 'Costs', sqd6: 'Integrity', sqd7: 'Assurance', sqd8: 'Outcome',
};

// The answer scale in the form's order, Strongly disagree (1) to Strongly agree (5),
// then N/A ('NA'; saved as no answer). Each answer's face is drawn by
// components/common/CsmFace. On the staff and admin pages `color` tints an answer
// and `text` is its words on a light background (dark pages use light text).
export const SCALE = [
  { value: 1, color: '#dc2626', text: '#991b1b' },
  { value: 2, color: '#ea580c', text: '#9a3412' },
  { value: 3, color: '#d97706', text: '#92400e' },
  { value: 4, color: '#16a34a', text: '#166534' },
  { value: 5, color: '#059669', text: '#065f46' },
];
export const NA = 'NA';
export const scaleMeta = value => SCALE.find(s => s.value === value) || null;

// An empty form. `service` is what the client came for (filled in from the slip).
export const emptyCsm = () => ({
  clientType: '', sex: '', age: '', region: '', service: '',
  cc1: 0, cc2: 0, cc3: 0,
  ...Object.fromEntries(SQD_KEYS.map(key => [key, null])),
});

// The questions still to answer, in the order of the form (an age that isn't one
// counts too); empty when the form is complete. Sex, age, region and the service
// are optional.
export function unanswered(csm) {
  const age = Number(csm.age);
  return [
    !CLIENT_TYPES.includes(csm.clientType) && 'clientType',
    csm.age !== '' && !(Number.isInteger(age) && age >= 10 && age <= 120) && 'age',
    !csm.cc1 && 'cc1',
    csm.cc1 !== 4 && !csm.cc2 && 'cc2',
    csm.cc1 !== 4 && !csm.cc3 && 'cc3',
    ...SQD_KEYS.filter(key => csm[key] == null),
  ].filter(Boolean);
}

// The answers as the server reads them (POST /submissions, field `csm`). The
// service typed on the slip replaces the client's own words on the server.
export function csmPayload(csm) {
  const knowsCharter = csm.cc1 !== 4;
  return {
    clientType: csm.clientType,
    sex: csm.sex || null,
    age: csm.age === '' ? null : Number(csm.age),
    region: csm.region || null,
    service: csm.service.trim() || null,
    cc1: csm.cc1,
    cc2: knowsCharter ? csm.cc2 : CC_NA.cc2,
    cc3: knowsCharter ? csm.cc3 : CC_NA.cc3,
    ...Object.fromEntries(SQD_KEYS.map(key => [key, csm[key]])),
  };
}
