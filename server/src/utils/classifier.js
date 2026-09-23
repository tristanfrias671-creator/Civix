/**
 * CIVIX AI Department Classifier
 * Multilingual NLP engine: English, Tagalog, Bisaya/Cebuano
 * Supports typo tolerance, slang, abbreviations, mixed-language input
 */

// [term, weight]  weight: 3=highly specific, 2=specific, 1=generic
const KEYWORD_DB = {
  "Mayor's Office – CRMO": [
    // English
    ['mayor', 3], ["mayor's office", 3], ['crmo', 3], ['community relations', 3],
    ['office of the mayor', 3], ['municipal mayor', 3], ['complaint escalation', 3],
    ['escalate complaint', 3], ['executive', 2], ['public affairs', 2],
    ['public information', 2], ['mayor office', 3],
    // Tagalog
    ['alkalde', 3], ['tanggapan ng alkalde', 3], ['opisina ng alkalde', 3],
    ['reklamo para sa mayor', 3], ['opisina ng mayor', 3],
    // Bisaya/Cebuano
    ['opisina sa mayor', 3], ['opisina ni alkalde', 3], ['bise alkalde', 2],
    ['mayor mismo', 3], ['pakialam ni mayor', 3],
  ],
  'HR': [
    // English
    ['hr', 3], ['human resource', 3], ['human resources', 3], ['personnel', 2],
    ['hiring', 2], ['employee', 2], ['employment', 2], ['regularization', 3],
    ['leave', 2], ['salary', 2], ['benefits', 2], ['manpower', 2],
    ['staff concern', 3], ['hro', 3], ['recruitment', 2], ['payroll', 2],
    // Tagalog
    ['kawani', 2], ['tauhan', 2], ['mag-apply trabaho', 2], ['trabaho sa munisipyo', 3],
    ['reklamo sa empleyado', 3], ['human resource office', 3],
    // Bisaya/Cebuano
    ['concern sa staff', 3], ['sulod sa trabaho', 2], ['mag-apply sa trabaho', 2],
    ['trabaho sa gobierno', 2], ['empleyado sa munisipyo', 3],
  ],
  'Tourism': [
    // English
    ['tourism', 3], ['tourist', 3], ['tourist spot', 3], ['attraction', 2],
    ['heritage', 2], ['visitor', 2], ['resort', 2], ['beach', 2],
    ['festival', 2], ['heritage site', 3], ['dive site', 3], ['eco-tourism', 3],
    ['ecotourism', 3], ['nature park', 2], ['tourism office', 3],
    // Tagalog
    ['turismo', 3], ['turista', 3], ['lugar pasyalan', 2], ['pasyalan', 2],
    ['lugar na libugan', 2],
    // Bisaya/Cebuano
    ['libugan', 2], ['turismo sa cantilan', 3], ['lugar turista', 3],
    ['beach resort', 3], ['island tour', 2],
  ],
  'Motorpool': [
    // English
    ['motorpool', 3], ['motor pool', 3], ['government vehicle', 3],
    ['government car', 3], ['official vehicle', 3], ['municipal truck', 3],
    ['service vehicle', 2], ['vehicle maintenance', 3], ['ambulance', 2],
    ['backhoe', 3], ['dump truck', 3], ['government driver', 2],
    // Tagalog
    ['sasakyan ng munisipyo', 3], ['sasakyan ng gobyerno', 3],
    ['kotse ng munisipyo', 3], ['driver ng munisipyo', 2],
    // Bisaya/Cebuano
    ['sakyanan sa munisipyo', 3], ['sakyanan sa gobierno', 3],
    ['sakyanan ng gobierno', 3], ['kotse sa munisipyo', 3],
    ['pang-government na sakyanan', 3],
  ],
  'Traffic': [
    // English
    ['traffic', 3], ['illegal parking', 3], ['parking', 2], ['traffic light', 3],
    ['traffic enforcer', 3], ['crossing', 2], ['traffic jam', 3],
    ['traffic congestion', 3], ['traffic violation', 3], ['traffic management', 3],
    ['road obstruction', 2], ['no parking zone', 3], ['traffic signal', 3],
    ['pedestrian crossing', 2],
    // Tagalog
    ['trapik', 3], ['matinding trapik', 3], ['illegal na paradahan', 3],
    ['paradahan', 2], ['trapik sa daan', 3],
    // Bisaya/Cebuano
    ['trapik kaayo', 3], ['trapik sa kalsada', 3], ['siksikan sa daan', 2],
    ['illegal parking sa harap', 3], ['huminto sa gitna ng daan', 2],
    ['dili makaagi', 2],
  ],
  'CSDO': [
    // English
    ['csdo', 3], ['community service', 2], ['livelihood', 3], ['cooperative', 2],
    ['community development', 3], ['livelihood program', 3],
    ['livelihood assistance', 3], ['skills training', 3], ['community affairs', 2],
    ['livelihood project', 3],
    // Tagalog
    ['pangkabuhayan', 3], ['samahan', 2], ['kooperatiba', 2],
    ['livelihood sa komunidad', 3], ['negosyong pangkomunidad', 2],
    // Bisaya/Cebuano
    ['paagi sa pangita og trabaho', 2], ['tabang sa pangita og ikabuhay', 3],
    ['livelihood program', 3], ['kooperatibo', 2],
  ],
  'OSCA': [
    // English
    ['osca', 3], ['senior citizen', 3], ['elderly', 3], ['old age', 2],
    ['senior', 2], ['pensioner', 2], ['senior citizen id', 3],
    ['senior citizen allowance', 3], ['senior discount', 3],
    ['senior citizen benefit', 3], ['senior citizen card', 3],
    ['senior citizen assistance', 3], ['60 years old', 2], ['office for senior', 3],
    // Tagalog
    ['matanda', 3], ['lolo', 2], ['lola', 2], ['allowance ng senior', 3],
    ['senior citizen sa gobyerno', 3], ['benepisyo ng senior', 3],
    // Bisaya/Cebuano
    ['tigulang', 3], ['ayuda sa senior citizen', 3], ['tabang sa tigulang', 3],
    ['allowance sa senior', 3], ['benepisyo sa tigulang', 3],
    ['id sa tigulang', 3], ['discuento sa tigulang', 3],
  ],
  'MDRRMO': [
    // English
    ['mdrrmo', 3], ['disaster', 3], ['calamity', 3], ['flood', 3],
    ['typhoon', 3], ['emergency', 2], ['rescue', 3], ['evacuation', 3],
    ['earthquake', 3], ['landslide', 3], ['fire', 2], ['relief operations', 3],
    ['disaster relief', 3], ['storm surge', 3], ['disaster risk', 3],
    ['emergency response', 3], ['search and rescue', 3],
    // Tagalog
    ['baha', 3], ['lindol', 3], ['bagyo', 3], ['sunog', 2],
    ['likas', 2], ['evacuation center', 3], ['kalamidad', 3], ['relief goods', 3],
    // Bisaya/Cebuano
    ['linog', 3], ['baha kaayo', 3], ['naay baha', 3], ['naay linog', 3],
    ['guba dahil baha', 3], ['nalunod', 2], ['baha na diri', 3],
    ['linog diri', 3], ['bagyo diri', 3], ['aksidente', 2],
    ['emergency sa baha', 3], ['rescue diri', 3],
  ],
  'Municipal Budget Office': [
    // English
    ['budget', 3], ['appropriation', 3], ['fund release', 3],
    ['budget allocation', 3], ['annual budget', 3], ['supplemental budget', 3],
    ['budget office', 3], ['municipal budget', 3], ['fund', 2],
    ['expenditure', 2], ['budget review', 3],
    // Tagalog
    ['pondo', 3], ['badyet', 3], ['budget ng munisipyo', 3],
    ['pondo ng bayan', 3], ['pagpondo', 3], ['appropriasyon', 3],
    // Bisaya/Cebuano
    ['badyet sa munisipyo', 3], ['pondo sa munisipyo', 3],
    ['pagpondo sa gobierno', 3],
  ],
  'Municipal Accountant Office': [
    // English
    ['accountant', 3], ['accounting', 3], ['audit', 2], ['disbursement', 3],
    ['financial record', 2], ['voucher', 2], ['auditing', 3],
    ['internal audit', 3], ['accounts payable', 3], ['bookkeeping', 2],
    ['accounting office', 3], ['payroll accounting', 3],
    // Tagalog
    ['accounting ng munisipyo', 3], ['rekord pinansyal', 2],
    ['kuwenta ng gobyerno', 2],
    // Bisaya/Cebuano
    ['accounting sa munisipyo', 3], ['auditor sa munisipyo', 3],
    ['kuwenta sa gobierno', 2],
  ],
  'Municipal Agriculture Office': [
    // English
    ['agriculture', 3], ['farm', 2], ['farmer', 3], ['crop', 2],
    ['livestock', 3], ['irrigation', 3], ['fisherfolk', 3], ['planting', 2],
    ['harvest', 2], ['seeds', 2], ['fertilizer', 3], ['fisherman', 2],
    ['fishing', 2], ['poultry', 2], ['swine', 2], ['cattle', 2],
    ['carabao', 2], ['rice production', 2], ['corn production', 2],
    ['vegetable farming', 2], ['farm assistance', 3], ['agricultural loan', 3],
    ['fishery', 3], ['aquaculture', 3], ['mao', 3],
    // Tagalog
    ['pagsasaka', 3], ['magsasaka', 3], ['pananim', 3], ['tanim', 3],
    ['alagang hayop', 3], ['mangingisda', 3], ['patubig', 3],
    ['irigasyon', 3], ['sakahan', 3],
    // Bisaya/Cebuano
    ['tanom', 3], ['kahayopan', 3], ['pangisda', 3], ['mag-uuma', 3],
    ['isda', 2], ['baktin', 2], ['manok', 2], ['baka', 2],
    ['tubig sa bukid', 2], ['wala tubig sa bukid', 3],
    ['irigasyon diri', 3],
  ],
  'Municipal Health Office': [
    // English
    ['health', 3], ['medical', 3], ['hospital', 3], ['clinic', 3],
    ['doctor', 3], ['medicine', 3], ['disease', 2], ['vaccination', 3],
    ['dengue', 3], ['nutrition', 2], ['nurse', 3], ['midwife', 3],
    ['rural health unit', 3], ['rhu', 3], ['health center', 3],
    ['immunization', 3], ['malaria', 3], ['tuberculosis', 3], ['tb', 2],
    ['hiv', 3], ['checkup', 2], ['prenatal', 3], ['maternal health', 3],
    ['epidemic', 3], ['pandemic', 3], ['health services', 3],
    ['mho', 3], ['municipal health', 3],
    // Tagalog
    ['bakuna', 3], ['gamot', 3], ['doktor', 3], ['nars', 3],
    ['ospital', 3], ['klinika', 3], ['kalusugan', 3], ['sakit', 2],
    ['lagnat', 2], ['ubo', 2], ['check-up', 2],
    // Bisaya/Cebuano
    ['tambal', 3], ['manggagamot', 3], ['pagamutanan', 3],
    ['health center diri', 3], ['bakuna sa bata', 3], ['bakuna sa tigulang', 3],
    ['sakit diri', 2], ['naay nag-uyok', 1], ['nagmasakit', 2],
  ],
  'Municipal Civil Registry Office': [
    // English
    ['civil registry', 3], ['birth certificate', 3], ['death certificate', 3],
    ['marriage certificate', 3], ['psa', 2], ['civil registrar', 3],
    ['birth registration', 3], ['marriage registration', 3],
    ['late registration', 3], ['correction of entry', 3], ['cenomar', 3],
    ['certificate of no marriage', 3], ['birth record', 3],
    ['civil registration', 3], ['mcro', 3],
    // Tagalog
    ['sertipiko ng kapanganakan', 3], ['sertipiko ng kasal', 3],
    ['sertipiko ng kamatayan', 3], ['registro sibil', 3],
    ['pagpaparehistro ng kapanganakan', 3],
    // Bisaya/Cebuano
    ['birth cert', 3], ['kasal sertipiko', 3], ['kamatayon sertipiko', 3],
    ['pagkapanganak sertipiko', 3], ['reg sa pagkapanganak', 3],
  ],
  'Municipal Social Welfare & Development Office': [
    // English
    ['social welfare', 3], ['welfare', 2], ['4ps', 3], ['pantawid', 3],
    ['indigent', 3], ['pwd', 3], ['disability', 3], ['solo parent', 3],
    ['dswd', 3], ['financial assistance', 3], ['cash assistance', 3],
    ['burial assistance', 3], ['educational assistance', 3],
    ['person with disability', 3], ['mswdo', 3], ['mswd', 3],
    ['listahanan', 3], ['social protection', 2], ['family welfare', 2],
    ['pwd id', 3], ['solo parent id', 3], ['indigent certificate', 3],
    ['pantawid pamilya', 3],
    // Tagalog
    ['ayuda', 3], ['tulong', 2], ['tulong pinansyal', 3],
    ['may kapansanan', 2], ['karapatan ng may kapansanan', 3],
    ['nangangailangan', 2], ['mahirap na pamilya', 2],
    // Bisaya/Cebuano
    ['tabang pinansyal', 3], ['tabang sa may kapansanan', 3],
    ['tabang para sa kabos', 3], ['kabos kaayo', 2],
    ['4P beneficiary', 3], ['pantawid beneficiary', 3],
    ['burial tabang', 3], ['burial assistance', 3],
  ],
  'Municipal Economic & Natural Resource Office': [
    // English
    ['environment', 3], ['natural resource', 3], ['illegal logging', 3],
    ['mining', 3], ['pollution', 3], ['forest', 2], ['enro', 3],
    ['garbage collection', 3], ['solid waste', 3], ['littering', 3],
    ['tree cutting', 3], ['deforestation', 3], ['watershed', 3],
    ['quarrying', 3], ['illegal quarrying', 3], ['environmental permit', 3],
    ['garbage', 3], ['waste management', 3], ['mangrove', 2],
    ['wildlife', 2], ['coastal resource', 3],
    // Tagalog
    ['basura', 3], ['kalikasan', 3], ['di nagkolekta ng basura', 3],
    ['illegal na pagputol ng puno', 3], ['polusyon', 3],
    // Bisaya/Cebuano
    ['kinaiyahan', 3], ['illegal na pagputol sa kahoy', 3],
    ['dili magkolekta basura', 3], ['basura di makolekta', 3],
    ['basura wala makolekta', 3], ['kagubatan', 2], ['pagbasura', 2],
    ['pollusion', 2], ['polusyon sa hangin', 3], ['polusyon sa tubig', 3],
  ],
  'Municipal Treasurer Office': [
    // English
    ['treasurer', 3], ['tax', 2], ['real property tax', 3],
    ['business permit', 3], ['revenue', 2], ['clearance', 2],
    ['payment', 2], ['billing', 2], ['tax payment', 3], ['rpt', 3],
    ['business license', 3], ['municipal treasurer', 3], ['treasury', 3],
    ['land tax', 3], ['tax clearance', 3], ['community tax', 3],
    ['cedula', 3], ['tax certificate', 3],
    // Tagalog
    ['buwis', 3], ['bayad buwis', 3], ['amilyar', 3],
    ['permit sa negosyo', 3], ['bayad sa buwis', 3],
    // Bisaya/Cebuano
    ['buhis', 3], ['bayad buhis', 3], ['amilyar sa lupa', 3],
    ['permit sa negosyo', 3], ['business permit sa munisipyo', 3],
    ['bayad', 2], ['cedula sa munisipyo', 3],
  ],
  'Municipal Engineering Office': [
    // English
    ['engineering', 3], ['road', 2], ['infrastructure', 3], ['construction', 2],
    ['building permit', 3], ['bridge', 3], ['streetlight', 3], ['street light', 3],
    ['drainage', 3], ['sidewalk', 2], ['pothole', 3], ['potholes', 3],
    ['broken road', 3], ['damaged road', 3], ['road repair', 3],
    ['flood control', 3], ['retaining wall', 3], ['culvert', 3],
    ['meo', 3], ['public works', 3], ['road project', 3],
    ['water system', 3], ['slope protection', 3], ['road crack', 3],
    // Tagalog
    ['sirang kalsada', 3], ['butas na daan', 3], ['kalsada', 3],
    ['tulay', 3], ['kanal', 3], ['dreinaha', 2],
    // Bisaya/Cebuano
    ['guba nga dalan', 3], ['baradong kanal', 3], ['guba na tulay', 3],
    ['bangag sa dalan', 3], ['lubak sa daan', 3], ['potholes sa daan', 3],
    ['streetlight patay', 3], ['wala suga sa dalan', 3],
    ['sirang dalan', 3], ['guba na dalan', 3], ['butas sa dalan', 3],
    ['naay bato sa dalan', 2], ['guba sa imprastraktura', 3],
    ['dalan guba', 3], ['kalsada guba', 3],
  ],
  'Municipal Planning & Development Office': [
    // English
    ['planning', 3], ['zoning', 3], ['land use', 3], ['development plan', 3],
    ['mpdo', 3], ['urban planning', 3], ['comprehensive development plan', 3],
    ['cdp', 3], ['subdivision', 2], ['land subdivision', 3],
    ['zoning clearance', 3], ['land classification', 3],
    ['development permit', 3], ['planning office', 3], ['municipal plan', 3],
    // Tagalog
    ['pagpaplano', 3], ['plano ng munisipyo', 3], ['land use plan', 3],
    ['pagpapaunlad ng bayan', 3],
    // Bisaya/Cebuano
    ['plano sa munisipyo', 3], ['zoning clearance', 3],
    ['paagi sa pagpapaunlad', 2],
  ],
  'Sangguniang Bayan Office': [
    // English
    ['sangguniang bayan', 3], ['ordinance', 3], ['resolution', 3],
    ['council', 2], ['legislation', 3], ['councilor', 3], ['sb', 2],
    ['municipal council', 3], ['local legislation', 3], ['local ordinance', 3],
    ['regular session', 2], ['special session', 2], ['sanggunian', 3],
    // Tagalog
    ['batas pampook', 3], ['kapasyahan', 3], ['ordinansa', 3],
    ['konsehal', 3], ['resolusyon', 3],
    // Bisaya/Cebuano
    ['ordinansa sa munisipyo', 3], ['konsehal sa bayan', 3],
    ['balaod sa munisipyo', 3],
  ],
  'Office of the Vice Mayor': [
    // English
    ['vice mayor', 3], ['vice-mayor', 3], ['presiding officer', 3],
    ["vice mayor's office", 3], ['deputy mayor', 2],
    // Tagalog
    ['bise alkalde', 3], ['opisina ng bise alkalde', 3],
    ['bise mayor', 3],
    // Bisaya/Cebuano
    ['opisina sa bise mayor', 3], ['bise alkalde', 3],
    ['vice mayor sa bayan', 3],
  ],
};

function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = [];
  for (let i = 0; i <= m; i++) { dp[i] = [i]; }
  for (let j = 0; j <= n; j++) { dp[0][j] = j; }
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1];
      else dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function preprocessText(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[''`]/g, '')        // normalize apostrophes
    .replace(/[^a-z0-9\s]/g, ' ') // strip special chars
    .replace(/\s+/g, ' ')
    .trim();
}

function classifyText(rawText) {
  if (!rawText || rawText.trim().length < 3) {
    return { department: 'UNASSIGNED', confidence: 0, matchedKeywords: [], allScores: {} };
  }

  const clean = preprocessText(rawText);
  const tokens = clean.split(' ').filter(t => t.length >= 3);
  const scores = {};
  const matchedMap = {};

  for (const [dept, keywords] of Object.entries(KEYWORD_DB)) {
    scores[dept] = 0;
    matchedMap[dept] = new Set();

    for (const [term, weight] of keywords) {
      const termClean = preprocessText(term);

      // Multi-word phrase: substring match in full preprocessed text
      if (termClean.includes(' ')) {
        if (clean.includes(termClean)) {
          scores[dept] += weight;
          matchedMap[dept].add(term);
        }
        continue;
      }

      // Single-word: exact token match first
      let found = false;
      for (const token of tokens) {
        if (token === termClean) {
          scores[dept] += weight;
          matchedMap[dept].add(term);
          found = true;
          break;
        }
      }
      if (found) continue;

      // Fuzzy match (Levenshtein) — only for longer terms to avoid false positives
      const minLen = 5;
      if (termClean.length >= minLen) {
        const maxDist = termClean.length >= 7 ? 2 : 1;
        for (const token of tokens) {
          if (Math.abs(token.length - termClean.length) <= maxDist) {
            const dist = levenshtein(token, termClean);
            if (dist > 0 && dist <= maxDist) {
              scores[dept] += weight * 0.6; // reduced weight for fuzzy hits
              matchedMap[dept].add(term);
              break;
            }
          }
        }
      }
    }
  }

  // Sort departments by score descending
  const sorted = Object.entries(scores)
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1]);

  if (sorted.length === 0) {
    return { department: 'UNASSIGNED', confidence: 0, matchedKeywords: [], allScores: {} };
  }

  const [[winner, winnerScore]] = sorted;
  const totalScore = sorted.reduce((sum, [, s]) => sum + s, 0);
  const confidence = Math.min(Math.round((winnerScore / totalScore) * 100), 99);

  // Build top-N scores for display
  const allScores = Object.fromEntries(
    sorted.slice(0, 5).map(([d, s]) => [d, Math.round(s * 10) / 10])
  );

  return {
    department: winner,
    confidence,
    matchedKeywords: [...matchedMap[winner]].slice(0, 8),
    allScores,
  };
}

module.exports = { classifyText };
