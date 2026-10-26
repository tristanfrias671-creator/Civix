// What citizens see for an office. The system keeps the short names (staff and
// admin pages, reports, tracking codes, the classifier); citizens see the full name
// with the short one in brackets, because few people know what HR or OSCA stand for.
// Official names stay in English on every language. Keep in step with
// server/src/utils/officeNames.js (the emails to citizens).
const FULL_NAMES = {
  "Mayor's Office – CRMO": "Mayor's Office – Coastal Resource Management Office (CRMO)",
  HR: 'Human Resource Management Office (HR)',
  CSDO: 'Community Social Development Office (CSDO)',
  OSCA: 'Office of the Senior Citizens Affairs (OSCA)',
  MDRRMO: 'Municipal Disaster Risk Reduction and Management Office (MDRRMO)',
};

export const officeLabel = name => FULL_NAMES[name] || name;
