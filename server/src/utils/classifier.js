/**
 * CIVIX AI Department Classifier
 * Multilingual NLP engine: English, Tagalog, Bisaya/Cebuano
 * Supports typo tolerance, slang, abbreviations, mixed-language input
 */

// [term, weight]  weight: 4=names the office itself, 3=highly specific, 2=specific, 1=generic
// Words that mean something else in another language are left out on purpose:
// "mao" (Bisaya "that is"), "baka" (Tagalog "maybe"), a bare "leave" or "check".
const KEYWORD_DB = {
  // Coastal Resource Management Office (under the Mayor's Office): the sea, coast and
  // fishing rules. Mentions of the mayor count a little.
  "Mayor's Office – CRMO": [
    // English
    ['crmo', 4], ['coastal resource management office', 4], ['coastal resource', 3], ['coastal resources', 3], ['coastal resource management', 3],
    ['coastal', 2], ['coast', 2], ['coastline', 2], ['shoreline', 2], ['marine', 2],
    ['marine protected area', 3], ['mpa', 3], ['fish sanctuary', 3], ['marine sanctuary', 3], ['sanctuary', 2],
    ['illegal fishing', 3], ['illegal fishers', 3], ['illegal fisher', 3], ['dynamite fishing', 3], ['dynamite', 3],
    ['blast fishing', 3], ['cyanide', 3], ['compressor fishing', 3], ['compressor', 2], ['fine mesh', 3],
    ['fine net', 3], ['fine nets', 3], ['juvenile fish', 3], ['shore', 1],
    ['commercial fishing', 3], ['commercial fishing boat', 3], ['municipal waters', 3], ['trawl', 3], ['trawler', 3],
    ['mangrove', 3], ['mangroves', 3], ['coral', 3], ['corals', 3], ['coral reef', 3], ['reef', 2], ['seagrass', 3],
    ['sea turtle', 3], ['turtle', 2], ['pawikan', 3], ['dugong', 3], ['dolphin', 3], ['whale shark', 3], ['whale', 2],
    ['giant clam', 3], ['fish kill', 3], ['bantay dagat', 3], ['sea patrol', 3], ['patrol boat', 2], ['seaweed', 2],
    ['fishing gear', 2], ['fishing boat', 2], ['fishing boats', 2], ['anchoring', 2], ['coastal cleanup', 3],
    ['beach erosion', 2], ['sea', 1], ['ocean', 1],
    ['mayor', 1], ["mayor's office", 2], ['office of the mayor', 2], ['mayor office', 2], ['municipal mayor', 2],
    // Tagalog
    ['bakawan', 3], ['bahura', 3], ['baybayin', 2], ['dalampasigan', 2], ['santuwaryo', 3], ['santuwaryo ng isda', 3],
    ['dinamita', 3], ['lason sa isda', 3], ['lason', 1], ['kumpresor', 3], ['pukot', 2], ['lambat', 1],
    ['ilegal na pangingisda', 3], ['pangingisda gamit ang dinamita', 3], ['dagat', 1], ['karagatan', 1],
    ['alkalde', 1], ['opisina ng alkalde', 2], ['opisina ng mayor', 2], ['tanggapan ng alkalde', 2],
    // Bisaya/Cebuano
    ['bakhaw', 3], ['baybayon', 2], ['nagpabuto', 3], ['pabuto', 2], ['baklad', 2], ['hulbot-hulbot', 3], ['hulbot', 3],
    ['santuwaryo sa isda', 3], ['ilegal nga pangisda', 3], ['opisina sa mayor', 2], ['opisina ni mayor', 2],
  ],
  'HR': [
    // English
    ['hr', 3], ['hr office', 4], ['hrmo', 4], ['human resource', 3], ['human resources', 3], ['human resource office', 4],
    ['human resource management office', 4],
    ['personnel', 2], ['hiring', 3], ['hire', 2], ['job opening', 3], ['job vacancy', 3], ['vacancy', 3],
    ['vacant position', 3], ['position', 1], ['job application', 3], ['apply for a job', 3], ['application', 1],
    ['applicant', 2], ['resume', 2], ['recruitment', 3], ['employee', 2], ['employees', 2], ['employment', 2],
    ['municipal employee', 3], ['government employee', 3], ['job order', 3], ['contract of service', 3],
    ['casual employee', 3], ['plantilla', 3], ['regularization', 3], ['promotion', 1], ['salary', 3], ['salaries', 3],
    ['wage', 2], ['wages', 2], ['payroll', 2], ['unpaid salary', 3], ['delayed salary', 3], ['leave credits', 3],
    ['sick leave', 3], ['vacation leave', 3], ['maternity leave', 3], ['employee benefits', 3], ['staff concern', 3],
    ['manpower', 2], ['rude employee', 3], ['rude staff', 3], ['absent employee', 3], ['tardiness', 2], ['civil service', 2],
    // Tagalog
    ['empleyado', 3], ['mga empleyado', 3], ['kawani', 2], ['tauhan', 2], ['sweldo', 3], ['suweldo', 3], ['sahod', 3],
    ['trabaho', 1], ['trabaho sa munisipyo', 3], ['mag-apply ng trabaho', 3], ['mag-apply trabaho', 3], ['aplikasyon', 2],
    ['bakante', 3], ['bakanteng posisyon', 3], ['reklamo sa empleyado', 3], ['bastos na empleyado', 3],
    ['masungit na empleyado', 3],
    // Bisaya/Cebuano
    ['empleyado sa munisipyo', 3], ['suhol', 2], ['trabahante', 2], ['mag-apply og trabaho', 3], ['mag-apply sa trabaho', 3],
    ['trabaho sa gobierno', 2], ['bastos nga empleyado', 3], ['concern sa staff', 3], ['sulod sa trabaho', 2],
  ],
  'Tourism': [
    // English
    ['tourism', 3], ['tourism office', 4], ['tourist', 3], ['tourists', 3], ['tourist spot', 3], ['tourist spots', 3],
    ['tourist destination', 3], ['tourist attraction', 3], ['destination', 2], ['attraction', 2], ['heritage', 2],
    ['heritage site', 3], ['visitor', 2], ['visitors', 2], ['resort', 2], ['beach resort', 3], ['beach', 1], ['island', 1],
    ['island hopping', 3], ['island tour', 3], ['festival', 2], ['fiesta', 1], ['dive site', 3], ['diving', 2],
    ['snorkeling', 2], ['eco-tourism', 3], ['ecotourism', 3], ['nature park', 2], ['falls', 2], ['waterfall', 2],
    ['waterfalls', 2], ['hiking', 2], ['tour guide', 3], ['tour guides', 3], ['homestay', 3], ['cottage', 2],
    ['cottages', 2], ['entrance fee', 3], ['souvenir', 2], ['tourism promotion', 3], ['promote', 1],
    // Tagalog
    ['turismo', 3], ['turista', 3], ['mga turista', 3], ['pasyalan', 2], ['lugar pasyalan', 2], ['bakasyunan', 2],
    ['lugar na libugan', 2], ['isla', 1], ['pista', 1],
    // Bisaya/Cebuano
    ['libugan', 2], ['turismo sa cantilan', 3], ['lugar turista', 3], ['busay', 2],
  ],
  'Motorpool': [
    // English
    ['motorpool', 4], ['motor pool', 4], ['government vehicle', 3], ['government vehicles', 3], ['government car', 3],
    ['official vehicle', 3], ['municipal vehicle', 3], ['municipal truck', 3], ['service vehicle', 2],
    ['vehicle maintenance', 3], ['ambulance', 3], ['dump truck', 3], ['backhoe', 3], ['payloader', 3], ['grader', 2],
    ['government driver', 3], ['municipal driver', 3], ['municipal pickup', 3], ['government pickup', 3], ['pickup', 1], ['for government use only', 3], ['personal errands', 2],
    ['personal use', 2], ['garbage truck', 1], ['driver', 1],
    // Tagalog
    ['sasakyan ng munisipyo', 3], ['sasakyan ng gobyerno', 3], ['kotse ng munisipyo', 3], ['driver ng munisipyo', 3],
    ['ambulansya', 3], ['ambulansiya', 3], ['pansariling lakad', 2], ['pansariling gamit', 2],
    // Bisaya/Cebuano
    ['sakyanan sa munisipyo', 3], ['sakyanan sa gobierno', 3], ['sakyanan ng gobierno', 3], ['kotse sa munisipyo', 3],
    ['pang-government na sakyanan', 3], ['drayber sa munisipyo', 3], ['personal nga lakaw', 2], ['sakyanan', 1],
    ['drayber', 1],
  ],
  'Traffic': [
    // English
    ['traffic', 3], ['traffic management office', 4], ['heavy traffic', 3], ['traffic jam', 3], ['traffic congestion', 3], ['congestion', 2],
    ['illegal parking', 3], ['illegally parked', 3], ['parked', 2], ['parking', 2], ['double parking', 3],
    ['no parking', 3], ['no parking zone', 3], ['traffic light', 3], ['traffic signal', 3], ['traffic sign', 3],
    ['road sign', 2], ['traffic enforcer', 3], ['traffic enforcers', 3], ['traffic aide', 3], ['traffic violation', 3],
    ['traffic management', 3], ['traffic rules', 3], ['pedestrian', 2], ['pedestrian crossing', 3],
    ['pedestrian lane', 3], ['crossing', 2], ['tricycle', 2], ['tricycles', 2], ['habal-habal', 2], ['jeepney', 1],
    ['motorcycle', 1], ['motorcycles', 1], ['helmet', 3], ['helmets', 3], ['speeding', 3], ['overspeeding', 3],
    ['reckless driving', 3], ['drunk driving', 3], ['counterflow', 3], ['overloading', 3], ['overloaded', 3],
    ['colorum', 3], ['loading and unloading', 3], ['road obstruction', 2], ['obstruction', 2], ['block the road', 2],
    ['blocking the road', 2], ['highway', 1],
    // Tagalog
    ['trapik', 3], ['matinding trapik', 3], ['trapik sa daan', 3], ['illegal na paradahan', 3], ['paradahan', 2],
    ['nakaparada', 2], ['nakaparadang', 2], ['pumaparada', 2], ['tawiran', 3], ['walang helmet', 3],
    ['mabilis magpatakbo', 3], ['lasing na nagmamaneho', 3], ['siksikan sa daan', 2], ['huminto sa gitna ng daan', 2],
    // Bisaya/Cebuano
    ['trapik kaayo', 3], ['trapik sa kalsada', 3], ['nag-park', 2], ['nagpark', 2], ['illegal parking sa harap', 3],
    ['daplin sa dalan', 1], ['kaskas', 3], ['kaskasero', 3], ['walay helmet', 3], ['hubog nga drayber', 3],
    ['dili makaagi', 2],
  ],
  // Civil Society Development Office: organizations, cooperatives, livelihood.
  'CSDO': [
    // English
    ['csdo', 4], ['community social development office', 4], ['community social development', 3],
    ['social development office', 3], ['civil society development office', 4], ['civil society', 3], ['civil society organization', 3], ['civil society organizations', 3],
    ['cso', 3], ['csos', 3], ['ngo', 3], ['ngos', 3], ['non-government organization', 3], ["people's organization", 3],
    ['people organization', 3], ['organization', 1], ['organizations', 1], ['association', 2], ['associations', 2],
    ['accreditation', 3], ['accredited', 3], ['accredit', 3], ['youth organization', 3], ["women's organization", 3],
    ['volunteer', 2], ['volunteers', 2], ['community service', 2], ['livelihood', 3], ['livelihood program', 3],
    ['livelihood assistance', 3], ['livelihood project', 3], ['livelihood training', 3], ['skills training', 3],
    ['training', 1], ['seminar', 2], ['cooperative', 3], ['cooperatives', 3], ['community development', 3],
    ['community affairs', 2], ['out of school youth', 1],
    // Tagalog
    ['pangkabuhayan', 3], ['kabuhayan', 3], ['samahan', 2], ['organisasyon', 2], ['kooperatiba', 3],
    ['livelihood sa komunidad', 3], ['negosyong pangkomunidad', 2], ['mag-organisa', 2],
    // Bisaya/Cebuano
    ['kooperatibo', 3], ['asosasyon', 2], ['pag-accredit', 3], ['panginabuhian', 3], ['ikabuhi', 2],
    ['tabang sa pangita og ikabuhay', 3], ['paagi sa pangita og trabaho', 2],
  ],
  'OSCA': [
    // English
    ['osca', 4], ['office of the senior citizens affairs', 4], ['senior citizen', 3], ['senior citizens', 3], ['elderly', 3], ['old age', 2], ['senior', 2],
    ['seniors', 2], ['pensioner', 2], ['social pension', 3], ['pension', 2], ['senior citizen id', 3], ['osca id', 3],
    ['senior citizen allowance', 3], ['senior discount', 3], ['senior citizen discount', 3], ['senior citizen benefit', 3],
    ['senior citizen benefits', 3], ['senior citizen card', 3], ['senior citizen assistance', 3], ['centenarian', 3],
    ['octogenarian', 3], ['nonagenarian', 3], ['cash gift', 2], ['60 years old', 2], ['office for senior', 3],
    ['grandmother', 1], ['grandfather', 1], ['lolo', 2], ['lola', 2],
    // Tagalog
    ['matanda', 2], ['matatanda', 2], ['nakatatanda', 3], ['pensyon', 2], ['allowance ng senior', 3],
    ['senior citizen sa gobyerno', 3], ['benepisyo ng senior', 3], ['diskwento ng senior', 3],
    // Bisaya/Cebuano
    ['tigulang', 3], ['mga tigulang', 3], ['ayuda sa senior citizen', 3], ['tabang sa tigulang', 3],
    ['allowance sa senior', 3], ['benepisyo sa tigulang', 3], ['id sa tigulang', 3], ['discuento sa tigulang', 3],
    ['diskwento sa senior', 3],
  ],
  'MDRRMO': [
    // English
    ['mdrrmo', 4], ['drrm office', 4], ['drrm', 3], ['disaster', 3], ['disasters', 3], ['calamity', 3], ['flood', 3], ['floods', 2],
    ['flooded', 2], ['flooding', 2], ['flash flood', 3], ['typhoon', 3], ['storm', 2], ['emergency', 2], ['rescue', 3],
    ['rescue team', 3], ['search and rescue', 3], ['evacuation', 3], ['evacuate', 3], ['evacuated', 3],
    ['evacuation center', 3], ['earthquake', 3], ['landslide', 3], ['landslides', 3], ['fire', 3],
    ['relief operations', 3], ['relief goods', 3], ['relief', 2], ['disaster relief', 3], ['storm surge', 3],
    ['tsunami', 3], ['early warning', 3], ['warning system', 3], ['siren', 2], ['disaster risk', 3],
    ['emergency response', 3], ['preparedness', 3], ['trapped', 2], ['overflowing', 2], ['river overflow', 3],
    ['drowning', 2], ['drowned', 2],
    // Tagalog
    ['baha', 3], ['bumabaha', 2], ['binaha', 3], ['pagbaha', 3], ['lindol', 3], ['bagyo', 3], ['sunog', 3],
    ['likas', 1], ['lumikas', 3], ['paglikas', 3], ['kalamidad', 3], ['sakuna', 3], ['saklolo', 2], ['nalunod', 2],
    ['gumuho ang lupa', 3], ['pagguho ng lupa', 3],
    // Bisaya/Cebuano
    ['linog', 3], ['baha kaayo', 3], ['naay baha', 3], ['naay linog', 3], ['guba dahil baha', 3], ['baha na diri', 3],
    ['linog diri', 3], ['bagyo diri', 3], ['emergency sa baha', 3], ['rescue diri', 3], ['nag-baha', 3], ['nagbaha', 3],
    ['lunop', 3], ['nalunop', 3], ['bakwit', 3], ['nibakwit', 3], ['nahugno ang yuta', 3], ['dahili', 3], ['nagdahili', 3],
    ['aksidente', 1],
  ],
  'Municipal Budget Office': [
    // English
    ['budget', 3], ['budget office', 4], ['municipal budget', 3], ['annual budget', 3], ['supplemental budget', 3],
    ['budget allocation', 3], ['allocation', 2], ['allocated', 2], ['appropriation', 3], ['appropriations', 3],
    ['fund release', 3], ['release of funds', 3], ['released', 2], ['fund', 2], ['funds', 2], ['funding', 2],
    ['expenditure', 2], ['budget review', 3], ['line item', 2],
    // Tagalog
    ['pondo', 3], ['badyet', 3], ['budget ng munisipyo', 3], ['pondo ng bayan', 3], ['pagpondo', 3],
    ['appropriasyon', 3], ['ilalabas ang pondo', 3],
    // Bisaya/Cebuano
    ['badyet sa munisipyo', 3], ['pondo sa munisipyo', 3], ['pagpondo sa gobierno', 3], ['gi-release', 2],
  ],
  'Municipal Accountant Office': [
    // English
    ['accountant', 3], ['accounting', 3], ['accounting office', 4], ["accountant's office", 4], ['audit', 2], ['auditing', 3], ['internal audit', 3],
    ['disbursement', 3], ['disbursement voucher', 3], ['voucher', 3], ['vouchers', 3], ['financial record', 2],
    ['financial statement', 3], ['accounts payable', 3], ['bookkeeping', 2], ['payroll accounting', 3],
    ['liquidation', 3], ['liquidate', 3], ['cash advance', 3], ['supplier', 2], ['suppliers', 2], ['cheque', 3],
    ['check payment', 3], ['payment processing', 3],
    // Tagalog
    ['accounting ng munisipyo', 3], ['rekord pinansyal', 2], ['kuwenta ng gobyerno', 2], ['tseke', 3],
    // Bisaya/Cebuano
    ['accounting sa munisipyo', 3], ['auditor sa munisipyo', 3], ['kuwenta sa gobierno', 2],
  ],
  'Municipal Agriculture Office': [
    // English
    ['agriculture', 3], ['agriculture office', 4], ['agriculturist', 3], ['agricultural', 3], ['farm', 2], ['farms', 2], ['farmer', 3],
    ['farmers', 3], ['farming', 3], ['crop', 2], ['crops', 2], ['livestock', 3], ['irrigation', 3], ['fisherfolk', 3],
    ['planting', 2], ['harvest', 2], ['seeds', 2], ['seedlings', 2], ['fertilizer', 3], ['fertilizers', 3],
    ['pesticide', 3], ['pesticides', 3], ['pest', 3], ['pests', 3], ['insects', 2], ['rice field', 3],
    ['rice fields', 3], ['palay', 3], ['corn', 2], ['coconut', 2], ['coconut farmers', 3], ['banana', 1],
    ['fisherman', 2], ['fishermen', 2], ['fishing', 1], ['fishpond', 2], ['aquaculture', 3], ['fishery', 2],
    ['poultry', 2], ['swine', 2], ['pig', 2], ['pigs', 2], ['hogs', 2], ['african swine fever', 3], ['asf', 3],
    ['bird flu', 3], ['avian influenza', 3], ['cattle', 2], ['goat', 2], ['goats', 2], ['carabao', 2],
    ['veterinary', 3], ['veterinarian', 3], ['animal vaccination', 3], ['rice production', 2], ['corn production', 2],
    ['vegetable farming', 2], ['farm assistance', 3], ['agricultural loan', 3], ['crop insurance', 3], ['rsbsa', 3],
    ['farm equipment', 3], ['tractor', 2], ['harvester', 2], ['farm-to-market road', 1],
    // Tagalog
    ['pagsasaka', 3], ['magsasaka', 3], ['mga magsasaka', 3], ['pananim', 3], ['tanim', 3], ['alagang hayop', 3],
    ['mangingisda', 3], ['patubig', 3], ['irigasyon', 3], ['sakahan', 3], ['palayan', 3], ['binhi', 3], ['abono', 3],
    ['pataba', 3], ['peste', 3], ['baboy', 2], ['manok', 2], ['kalabaw', 2], ['kambing', 2], ['niyog', 2], ['mais', 2],
    // Bisaya/Cebuano
    ['tanom', 3], ['kahayopan', 3], ['pangisda', 2], ['mag-uuma', 3], ['uma', 2], ['isda', 1], ['baktin', 2],
    ['humay', 3], ['lubi', 2], ['liso', 3], ['ilaga', 2], ['kabaw', 2], ['kanding', 2], ['tubig sa bukid', 2],
    ['wala tubig sa bukid', 3], ['irigasyon diri', 3],
  ],
  'Municipal Health Office': [
    // English
    ['health', 3], ['medical', 3], ['hospital', 2], ['clinic', 3], ['doctor', 3], ['doctors', 3], ['medicine', 3],
    ['medicines', 3], ['medication', 3], ['disease', 2], ['vaccination', 3], ['vaccine', 3], ['vaccines', 3],
    ['dengue', 3], ['nutrition', 2], ['malnutrition', 3], ['malnourished', 3], ['nurse', 3], ['nurses', 3],
    ['midwife', 3], ['rural health unit', 3], ['rhu', 3], ['health center', 3], ['barangay health station', 3],
    ['bhs', 3], ['bhw', 3], ['health worker', 3], ['immunization', 3], ['malaria', 3], ['tuberculosis', 3], ['tb', 2],
    ['hiv', 3], ['health office', 4], ['municipal health office', 4], ['checkup', 2], ['check-up', 2], ['consultation', 2], ['patient', 2], ['patients', 2], ['sick', 2],
    ['illness', 2], ['fever', 2], ['cough', 2], ['flu', 2], ['diarrhea', 3], ['measles', 3], ['covid', 3],
    ['hypertension', 3], ['diabetes', 3], ['prenatal', 3], ['maternal health', 3], ['pregnant', 2],
    ['family planning', 3], ['epidemic', 3], ['pandemic', 3], ['health services', 3], ['mho', 4],
    ['municipal health', 3], ['rabies', 3], ['anti-rabies', 3], ['dog bite', 3], ['animal bite', 3], ['bite center', 3],
    ['fogging', 3], ['misting', 2], ['mosquito', 2], ['mosquitoes', 2], ['sanitation', 3], ['sanitary', 3],
    ['sanitary permit', 3], ['health certificate', 3], ['health certificates', 3], ['food handler', 3],
    ['food handlers', 3], ['unsanitary', 3], ['food poisoning', 3], ['mental health', 3], ['carinderia', 2],
    ['pharmacy', 1],
    // Tagalog
    ['bakuna', 3], ['gamot', 3], ['doktor', 3], ['nars', 3], ['ospital', 2], ['klinika', 3], ['kalusugan', 3],
    ['sakit', 2], ['nagkakasakit', 2], ['lagnat', 2], ['ubo', 2], ['sipon', 2], ['pagtatae', 3], ['lamok', 2],
    ['botika', 1],
    // Bisaya/Cebuano
    ['tambal', 3], ['manggagamot', 3], ['pagamutanan', 3], ['health center diri', 3], ['bakuna sa bata', 3],
    ['bakuna sa tigulang', 3], ['sakit diri', 2], ['nagmasakit', 2], ['masakiton', 2], ['hilanat', 2],
    ['kalibanga', 3],
  ],
  'Municipal Civil Registry Office': [
    // English
    ['civil registry', 3], ['civil registry office', 4], ["registrar's office", 4], ['birth certificate', 3], ['birth certificates', 3], ['death certificate', 3],
    ['marriage certificate', 3], ['marriage contract', 3], ['marriage license', 3], ['certificate of live birth', 3],
    ['live birth', 3], ['psa', 2], ['civil registrar', 4], ['local civil registrar', 4], ['registrar', 3],
    ['birth registration', 3], ['marriage registration', 3], ['late registration', 3], ['correction of entry', 3],
    ['clerical error', 3], ['cenomar', 3], ['certificate of no marriage', 3], ['birth record', 3],
    ['civil registration', 3], ['mcro', 4], ['legitimation', 3], ['annotation', 3], ['change of name', 3],
    ['foundling', 3], ['wrong spelling', 2], ['misspelled', 2], ['spelling', 1], ['surname', 2], ['middle name', 2],
    ['date of birth', 2], ['certified true copy', 2], ['registration', 1],
    // Tagalog
    ['sertipiko ng kapanganakan', 3], ['sertipiko ng kasal', 3], ['sertipiko ng kamatayan', 3], ['registro sibil', 3],
    ['pagpaparehistro ng kapanganakan', 3], ['kapanganakan', 2], ['petsa ng kapanganakan', 3], ['apelyido', 2],
    ['kasal', 2], ['naiparehistro', 2], ['rehistro', 2], ['magparehistro', 1],
    // Bisaya/Cebuano
    ['birth cert', 3], ['kasal sertipiko', 3], ['kamatayon sertipiko', 3], ['pagkapanganak sertipiko', 3],
    ['reg sa pagkapanganak', 3], ['pagkatawo', 2], ['adlaw sa pagkatawo', 3], ['kaminyoon', 2], ['marehistro', 2],
  ],
  'Municipal Social Welfare & Development Office': [
    // English
    ['social welfare', 3], ['social welfare office', 4], ['welfare', 2], ['4ps', 3], ['pantawid', 3], ['pantawid pamilya', 3], ['indigent', 3],
    ['indigency', 3], ['pwd', 3], ['person with disability', 3], ['persons with disability', 3], ['disability', 3],
    ['disabled', 2], ['wheelchair', 3], ['solo parent', 3], ['solo parents', 3], ['dswd', 3], ['mswdo', 4], ['mswd', 4],
    ['social worker', 3], ['financial assistance', 3], ['cash assistance', 3], ['medical assistance', 3],
    ['burial assistance', 3], ['educational assistance', 3], ['transportation assistance', 3], ['aics', 3],
    ['listahanan', 3], ['social protection', 2], ['family welfare', 2], ['pwd id', 3], ['solo parent id', 3],
    ['indigent certificate', 3], ['child abuse', 3], ['abused', 3], ['abuse', 2], ['street children', 3],
    ['abandoned', 2], ['neglected', 2], ['orphan', 3], ['beggar', 3], ['beggars', 3], ['mendicant', 3], ['vawc', 3],
    ['domestic violence', 3], ['violence against women', 3], ['battered', 3], ['child labor', 3], ['day care', 3],
    ['daycare', 3], ['child development center', 3], ['feeding program', 2], ['homeless', 3], ['no food', 2],
    ['nothing to eat', 3], ['lives alone', 2],
    ['hunger', 2], ['poor family', 2],
    // Tagalog
    ['ayuda', 3], ['tulong', 1], ['tulong pinansyal', 3], ['may kapansanan', 3], ['karapatan ng may kapansanan', 3],
    ['nangangailangan', 2], ['mahirap na pamilya', 2], ['palaboy', 3], ['batang palaboy', 3], ['pulubi', 3],
    ['inabuso', 3], ['binubugbog', 3], ['pinagtatrabaho', 3], ['sinasaktan', 2], ['pinabayaan', 2], ['ulila', 3], ['walang makain', 2],
    // Bisaya/Cebuano
    ['tabang pinansyal', 3], ['tabang sa may kapansanan', 3], ['tabang para sa kabos', 3], ['kabos kaayo', 2],
    ['kabos', 2], ['4p beneficiary', 3], ['pantawid beneficiary', 3], ['burial tabang', 3], ['gibunalan', 3],
    ['gidagmalan', 3], ['gibiyaan', 2], ['ilo', 2], ['nangayo og limos', 3], ['walay makaon', 2],
  ],
  // Economic enterprises (public market, slaughterhouse) and natural resources
  // (garbage, trees, quarrying, pollution).
  'Municipal Economic & Natural Resource Office': [
    // English
    ['environment', 3], ['environmental', 3], ['natural resource', 3], ['natural resources', 3], ['enro', 4],
    ['menro', 4], ['environment office', 4], ['garbage', 3], ['trash', 3], ['rubbish', 3], ['waste', 2], ['solid waste', 3],
    ['garbage collection', 3], ['garbage collector', 3], ['waste management', 3], ['littering', 3], ['litter', 2],
    ['dumping', 3], ['illegal dumping', 3], ['dumpsite', 3], ['dump site', 3], ['landfill', 3], ['mrf', 3],
    ['segregation', 3], ['recycling', 2], ['plastic', 2], ['plastics', 2], ['burning garbage', 3],
    ['burning plastic', 3], ['burns plastic', 3], ['open burning', 3], ['smoke', 2], ['illegal logging', 3],
    ['logging', 3], ['tree cutting', 3], ['cutting trees', 3], ['cutting of trees', 3], ['chainsaw', 3],
    ['deforestation', 3], ['kaingin', 3], ['charcoal', 2], ['forest', 2], ['watershed', 3], ['quarry', 3],
    ['quarrying', 3], ['illegal quarrying', 3], ['sand and gravel', 3], ['gravel extraction', 3], ['mining', 3],
    ['black sand', 3], ['pollution', 3], ['polluted', 3], ['air pollution', 3], ['water pollution', 3],
    ['noise pollution', 3], ['foul smell', 3], ['bad smell', 2], ['smell', 2], ['smells', 2], ['stench', 3],
    ['unbearable', 1], ['odor', 2], ['stink', 2], ['piggery', 3],
    ['environmental permit', 3], ['wildlife', 2], ['public market', 3], ['market stall', 3], ['market stalls', 3],
    ['stall', 2], ['stalls', 2], ['market vendors', 2], ['slaughterhouse', 3], ['abattoir', 3],
    // Tagalog
    ['basura', 3], ['basurahan', 3], ['kalikasan', 3], ['di nagkolekta ng basura', 3], ['kinokolekta', 2],
    ['nakokolekta', 2], ['illegal na pagputol ng puno', 3], ['pagputol ng puno', 3], ['nagpuputol', 2],
    ['pinuputol', 2], ['polusyon', 3], ['usok', 2], ['mabaho', 2], ['nagsusunog ng basura', 3],
    ['pagsusunog ng basura', 3], ['palengke', 3], ['pamilihan', 2], ['katayan', 3],
    // Bisaya/Cebuano
    ['kinaiyahan', 3], ['illegal na pagputol sa kahoy', 3], ['dili magkolekta basura', 3], ['basura di makolekta', 3],
    ['basura wala makolekta', 3], ['makolekta', 2], ['kagubatan', 2], ['pagbasura', 2], ['pollusion', 2],
    ['polusyon sa hangin', 3], ['polusyon sa tubig', 3], ['gipamutol ang kahoy', 3], ['gipamutol', 3], ['pagpamutol', 3], ['uling', 2],
    ['nag-quarry', 3], ['balas', 2], ['graba', 2], ['baho', 2], ['babuyan', 3], ['nagsunog og basura', 3],
    ['merkado', 2], ['ihawan', 3], ['sagbot', 3],
  ],
  'Municipal Treasurer Office': [
    // English
    ['treasurer', 3], ['treasury', 3], ['municipal treasurer', 3], ["treasurer's office", 4], ['treasurer office', 4], ['cashier', 3], ['tax', 2], ['taxes', 2],
    ['real property tax', 3], ['property tax', 3], ['business tax', 3], ['land tax', 3], ['rpt', 3],
    ['tax payment', 3], ['tax clearance', 3], ['tax certificate', 3], ['community tax', 3],
    ['community tax certificate', 3], ['ctc', 3], ['cedula', 3], ['business permit', 3], ['business permits', 3],
    ["mayor's permit", 3], ['business license', 3], ['permit renewal', 3], ['official receipt', 3], ['receipt', 2],
    ['receipts', 2], ['revenue', 2], ['clearance', 1], ['payment', 2], ['billing', 2], ['surcharge', 2],
    ['overcharged', 3], ['overcharging', 3],
    // Tagalog
    ['buwis', 3], ['bayad buwis', 3], ['bayad sa buwis', 3], ['amilyar', 3], ['permit sa negosyo', 3], ['resibo', 3],
    ['singil', 2], ['sinisingil', 2], ['bayarin', 2], ['kahera', 3], ['bayad', 2],
    // Bisaya/Cebuano
    ['buhis', 3], ['bayad buhis', 3], ['amilyar sa lupa', 3], ['business permit sa munisipyo', 3],
    ['cedula sa munisipyo', 3], ['pagbayad', 2], ['nagbayad', 2], ['bayranan', 2],
  ],
  'Municipal Engineering Office': [
    // English
    ['engineering', 3], ['engineering office', 4], ["engineer's office", 4], ['meo', 4], ['public works', 3], ['infrastructure', 3],
    ['construction', 2], ['building permit', 3], ['road', 2], ['roads', 2], ['national road', 2], ['barangay road', 2],
    ['road project', 2], ['road repair', 3], ['road damage', 3], ['broken road', 3], ['damaged road', 3],
    ['rough road', 3], ['muddy road', 3], ['unpaved road', 3], ['road concreting', 3], ['concreting', 3],
    ['asphalt', 3], ['road widening', 3], ['road crack', 3], ['pothole', 3], ['potholes', 3], ['sidewalk', 2],
    ['humps', 2], ['road humps', 3], ['speed bump', 3], ['bridge', 3], ['bridges', 3], ['footbridge', 3],
    ['drainage', 3], ['drainage canal', 3], ['canal', 2], ['canals', 2], ['clogged', 2], ['clogged drainage', 3],
    ['manhole', 3], ['culvert', 3], ['spillway', 3], ['seawall', 3], ['dike', 3], ['riprap', 3],
    ['retaining wall', 3], ['slope protection', 3], ['flood control', 3], ['streetlight', 3], ['streetlights', 3],
    ['street light', 3], ['street lights', 3], ['lamp post', 3], ['light post', 3], ['waiting shed', 3],
    ['covered court', 3], ['gymnasium', 2], ['public building', 2], ['building', 1], ['roof', 2], ['leaking roof', 3],
    ['water system', 3], ['water supply', 3], ['water pipe', 3], ['pipe', 2], ['pipes', 2], ['broken pipe', 3],
    ['leaking pipe', 3], ['water leak', 3], ['faucet', 2], ['farm-to-market road', 1],
    // Tagalog
    ['kalsada', 3], ['sirang kalsada', 3], ['butas na daan', 3], ['tulay', 3], ['kanal', 3], ['barado', 2],
    ['baradong kanal', 3], ['imburnal', 3], ['estero', 2], ['dreinaha', 2], ['lubak', 3], ['lubak-lubak', 3],
    ['baku-bako', 3], ['poste', 2], ['ilaw sa kalye', 3], ['ilaw ng poste', 3], ['gripo', 2], ['bubong', 2], ['tubo', 1],
    // Bisaya/Cebuano
    ['dalan', 2], ['guba nga dalan', 3], ['guba na tulay', 3], ['bangag sa dalan', 3], ['lubak sa daan', 3],
    ['potholes sa daan', 3], ['streetlight patay', 3], ['wala suga sa dalan', 3], ['sirang dalan', 3],
    ['guba na dalan', 3], ['butas sa dalan', 3], ['naay bato sa dalan', 2], ['guba sa imprastraktura', 3],
    ['dalan guba', 3], ['kalsada guba', 3], ['lungag', 3], ['lungag sa dalan', 3], ['suga sa dalan', 3],
    ['taytayan', 3], ['nabuak ang tubo', 3], ['atop', 2],
  ],
  'Municipal Planning & Development Office': [
    // English
    ['planning', 2], ['planning office', 4], ['zoning', 3], ['zone', 2], ['residential zone', 3],
    ['commercial zone', 3], ['industrial zone', 3], ['zoning clearance', 3], ['zoning permit', 3],
    ['zoning certificate', 3], ['locational clearance', 3], ['location clearance', 3], ['land use', 3],
    ['land use plan', 3], ['comprehensive land use plan', 3], ['clup', 3], ['development plan', 3],
    ['comprehensive development plan', 3], ['cdp', 3], ['annual investment plan', 3], ['mpdo', 4], ['mpdc', 4],
    ['urban planning', 3], ['subdivision', 2], ['land subdivision', 3], ['land classification', 3],
    ['development permit', 3], ['municipal plan', 3], ['project proposal', 2], ['feasibility study', 3],
    ['cbms', 3], ['statistics', 2],
    // Tagalog
    ['pagpaplano', 3], ['plano ng munisipyo', 3], ['pagpapaunlad ng bayan', 3],
    // Bisaya/Cebuano
    ['plano sa munisipyo', 3], ['paagi sa pagpapaunlad', 2],
  ],
  'Sangguniang Bayan Office': [
    // English
    ['sangguniang bayan', 4], ['sanggunian', 3], ['sb', 2], ['sb office', 4], ['sb member', 3], ['sb members', 3], ['ordinance', 3],
    ['ordinances', 3], ['pass an ordinance', 3], ['resolution', 1], ['council resolution', 3], ['sb resolution', 3],
    ['council', 2], ['municipal council', 3], ['councilor', 3], ['councilors', 3], ['legislation', 3],
    ['local legislation', 3], ['local ordinance', 3], ['legislative', 3], ['session', 2], ['regular session', 2],
    ['special session', 2], ['public hearing', 3], ['committee', 2], ['franchise', 3], ['tricycle franchise', 3],
    ['mtop', 3],
    // Tagalog
    ['batas pampook', 3], ['kapasyahan', 3], ['ordinansa', 3], ['ordinansya', 3], ['konsehal', 3],
    ['mga konsehal', 3], ['konseho', 3], ['resolusyon', 3],
    // Bisaya/Cebuano
    ['ordinansa sa munisipyo', 3], ['konsehal sa bayan', 3], ['balaod sa munisipyo', 3], ['balaod', 2],
  ],
  'Office of the Vice Mayor': [
    // English
    ['vice mayor', 4], ['vice-mayor', 4], ["vice mayor's office", 4], ['presiding officer', 3], ['deputy mayor', 2],
    // Tagalog
    ['bise alkalde', 4], ['opisina ng bise alkalde', 4], ['bise mayor', 4],
    // Bisaya/Cebuano
    ['opisina sa bise mayor', 4], ['vice mayor sa bayan', 4],
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

// Only the first MAX_CHARS characters are read: reports are limited to that length.
const MAX_CHARS = 2000;
// A typed word may differ from a keyword by one letter when the keyword has 6 or more
// letters, two when it has 10 or more (same first letter); such a match counts 60%.
const TYPO_MIN = 6;
const TYPO_WEIGHT = 0.6;

// Every keyword is cleaned once, when the server starts, and filed for a direct lookup:
//   WORDS    word -> the keywords that are that word (one per office using it)
//   PHRASES  first word -> the phrases that start with it
//   TYPOS    first letter + length -> long single words, for small typos
const WORDS = new Map();
const PHRASES = new Map();
const TYPOS = new Map();
const fileUnder = (map, key, entry) => {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(entry);
};
for (const [dept, keywords] of Object.entries(KEYWORD_DB)) {
  for (const [term, weight] of keywords) {
    const words = preprocessText(term).split(' ');
    const entry = { dept, term, weight, words };
    if (words.length > 1) {
      fileUnder(PHRASES, words[0], entry);
    } else {
      fileUnder(WORDS, words[0], entry);
      if (words[0].length >= TYPO_MIN) fileUnder(TYPOS, words[0][0] + words[0].length, entry);
    }
  }
}

// Every office the classifier has keywords for. Which of them the municipality uses
// is set in Settings → Departments; pass that list to classifyText.
const OFFICES = Object.keys(KEYWORD_DB);
const NO_OFFICE = () => ({ department: 'UNASSIGNED', confidence: 0, matchedKeywords: [], allScores: {} });

// `allowed`: the offices on the Settings list. Only those are suggested (leave it out
// to consider every office, as the evaluation scripts do). Confidence is still
// measured against every office's points, and a text that is mainly about an office
// no longer on the list gets no suggestion rather than a weak guess.
function classifyText(rawText, allowed) {
  if (!rawText || typeof rawText !== 'string' || rawText.trim().length < 3) return NO_OFFICE();

  const tokens = preprocessText(rawText.slice(0, MAX_CHARS)).split(' ').filter(t => t.length >= 2);
  const distinct = new Set(tokens);
  const matched = new Map(); // office -> Map(keyword -> { entry, points }); each keyword counts once
  const count = (entry, points) => {
    if (!matched.has(entry.dept)) matched.set(entry.dept, new Map());
    const found = matched.get(entry.dept);
    if (!found.has(entry.term)) found.set(entry.term, { entry, points });
  };

  // Whole words, then phrases wherever their first word is.
  for (const word of distinct) for (const entry of WORDS.get(word) || []) count(entry, entry.weight);
  tokens.forEach((word, i) => {
    for (const entry of PHRASES.get(word) || []) {
      if (entry.words.every((w, k) => tokens[i + k] === w)) count(entry, entry.weight);
    }
  });
  // A small typo in a long word that isn't a keyword itself.
  for (const word of distinct) {
    if (word.length < TYPO_MIN - 1 || WORDS.has(word)) continue;
    for (let length = word.length - 2; length <= word.length + 2; length++) {
      for (const entry of TYPOS.get(word[0] + length) || []) {
        const keyword = entry.words[0];
        const most = keyword.length >= 10 ? 2 : 1;
        if (Math.abs(word.length - keyword.length) <= most && levenshtein(word, keyword) <= most) {
          count(entry, entry.weight * TYPO_WEIGHT);
        }
      }
    }
  }

  // An office's score: its keywords' points, but of two matched keywords where one is
  // part of the other ("road" in "barangay road"), only the stronger counts (the longer on a tie).
  const scores = new Map();
  for (const [dept, found] of matched) {
    const hits = [...found.values()];
    const inside = (a, b) => a.entry.words.length < b.entry.words.length && a.entry.words.every(w => b.entry.words.includes(w));
    const beaten = a => hits.some(b => b !== a && (inside(a, b) || inside(b, a))
      && (b.points > a.points || (b.points === a.points && b.entry.words.length > a.entry.words.length)));
    scores.set(dept, hits.filter(a => !beaten(a)).reduce((sum, h) => sum + h.points, 0));
  }

  // Offices by score, highest first (a tie keeps the order of KEYWORD_DB).
  const scored = OFFICES.filter(o => scores.get(o) > 0);
  const totalScore = scored.reduce((sum, o) => sum + scores.get(o), 0);
  const topScore = Math.max(0, ...scored.map(o => scores.get(o)));
  const onList = Array.isArray(allowed) ? new Set(allowed) : null;
  const sorted = scored.filter(o => !onList || onList.has(o)).sort((a, b) => scores.get(b) - scores.get(a));
  if (sorted.length === 0) return NO_OFFICE();

  const winner = sorted[0];
  // Mainly about an office that was taken off the list: no suggestion.
  if (scores.get(winner) * 2 < topScore) return NO_OFFICE();
  const confidence = Math.min(Math.round((scores.get(winner) / totalScore) * 100), 99);
  const allScores = Object.fromEntries(sorted.slice(0, 5).map(o => [o, Math.round(scores.get(o) * 10) / 10]));

  return {
    department: winner,
    confidence,
    matchedKeywords: [...matched.get(winner).keys()].slice(0, 8),
    allScores,
  };
}

// preprocessText and levenshtein are shared with the urgency detection (utils/urgencyDetector.js).
module.exports = { classifyText, OFFICES, preprocessText, levenshtein };
