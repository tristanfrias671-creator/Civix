// The full office names citizens see in their emails; the system itself keeps the
// short names (HR, OSCA...). Keep in step with client/src/data/officeNames.js.
const FULL_NAMES = {
  "Mayor's Office – CRMO": "Mayor's Office – Coastal Resource Management Office (CRMO)",
  HR: 'Human Resource Management Office (HR)',
  CSDO: 'Civil Society Development Office (CSDO)',
  OSCA: 'Office of the Senior Citizens Affairs (OSCA)',
  MDRRMO: 'Municipal Disaster Risk Reduction and Management Office (MDRRMO)',
};

const officeLabel = name => FULL_NAMES[name] || name;

module.exports = { officeLabel };
