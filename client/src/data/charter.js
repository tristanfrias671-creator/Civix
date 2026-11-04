// The public services of each office, from the Municipality of Cantilan's 2025
// Citizen's Charter (https://cantilan.gov.ph/citizens-charter/), in the charter's
// order and wording. Used by the Citizen's Charter page, the service list on the
// staff's "New client" slip and the satisfaction form. Service names stay in
// English on every language, like office names.
//
// `type` is the charter's classification. Under the Ease of Doing Business Act
// (RA 11032) it sets the longest an office may take: Simple 3, Complex 7, Highly
// Technical 20 working days. The Civil Registry's charter doesn't classify its
// services, so they have none.
//
// HR and CSDO are not in the 2025 charter, so they have no list; the page says so
// until their services are added here.

export const PROCESSING_DAYS = { SIMPLE: 3, COMPLEX: 7, HIGHLY_TECHNICAL: 20 };

export const CHARTER_HOME = 'https://cantilan.gov.ph/citizens-charter/';
const pdf = code => `https://cantilan.gov.ph/wp-content/uploads/2025/02/${code}-Citizens-Charter.pdf`;

const simple = names => names.map(name => ({ name, type: 'SIMPLE' }));

export const CHARTER = {
  'Municipal Health Office': {
    pdf: pdf('MHO'),
    services: simple([
      'Availing of Anti-Tuberculosis Drugs',
      'Availing of General Consultation, Treatment of Minor Cases and Emergencies',
      'Availing of Dental Services',
      'Availing of Reproductive Tract Health Examination',
      'Basic Laboratory Examinations',
      'Family Planning Services',
      'Issuance of Sanitary Permits and Health Certificates',
      'Maternal Care Services',
      'National Immunization Program',
      'Securing of Birth Certificate',
      'Securing Death Certificate',
      'Securing Medical Certificate',
      'Securing Medico-Legal Certificate',
    ]),
  },
  'Municipal Treasurer Office': {
    pdf: pdf('MTO'),
    // The charter lists the tricycle franchise receipt twice (services 8 and 10);
    // it is here once. Of its internal services, only the cash payment of financial
    // assistance is for the public; the page says the others (for employees and
    // offices) are in the official copy.
    employeeServicesLeftOut: true,
    services: simple([
      'Issuance of Community Tax Certificate (CEDULA)',
      'Issuance of Official Receipts on Business Licenses',
      'Issuance of Official Receipts on Building Permit Fees and other Fees',
      'Issuance of Official Receipts on Burial Permit Fees',
      'Issuance of Official Receipts on Cockpit',
      'Issuance of Official Receipts on Special Permit fee for Cockfighting',
      'Issuance of Official Receipt for Environmental Fee',
      'Issuance of Official Receipts for Franchise of Motorized Vehicle (Tricycle/Trisikad) and Bicycle',
      "Issuance of Official Receipts on Mayor's Permit to Conduct Group Activities",
      'Issuance of Official Receipts on Local Civil Registry Fees and Charges',
      "Issuance of Official Receipts on Mayor's Clearance Fees",
      'Issuance of Official Receipts on Real Property Taxes',
      'Issuance of Official Receipts on Real Property Tax Clearance',
      'Issuance of Official Receipts for Registration Fee of Large Cattle and Swine',
      'Issuance of Official Receipts on Secretary and Certification Fees',
      'Issuance of Official Receipts on Traffic Violations',
      'Issuance of Official Receipts for Weight and Measure Registration Fee',
      'Cash Payment for Financial Assistance',
    ]),
  },
  'Municipal Civil Registry Office': {
    pdf: pdf('MCR'),
    services: [
      { name: 'Issuance of Certified True/Machine Copy of Birth, Marriage, and Death Certificate' },
      { name: 'Registration of Vital Events (Timely Registration)', parts: ['Registration of Birth', 'Registration of Marriage', 'Registration of Death'] },
      { name: 'Delayed Registration of Birth, Marriage and Death' },
      { name: 'Application for Marriage License' },
      { name: 'Legitimation of a Natural Child' },
      { name: 'Correction of Entry/ies of Civil Registry Documents' },
      { name: 'Preparation of Annotation of Birth Certificate of an Illegitimate Child to Use the Surname of the Father' },
      { name: 'Registration and Annotation of Court Decision and Legal Instruments' },
      { name: 'Endorsement of Civil Registry Records to the Civil Registrar General (PSA)' },
      { name: 'Issuance of Supplemental Report' },
      { name: 'Request of Security Papers thru BREQS' },
    ].map(s => ({ ...s, type: null })),
  },
};

// The office's part of the charter ({ pdf, services }), or null if it has none.
export const charterFor = office => CHARTER[office] || null;

// The names of an office's services (for the service lists on the slip and the form).
export const serviceNames = office => (CHARTER[office]?.services || []).map(s => s.name);
