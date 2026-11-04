// The guided tours on the citizen pages, in English, Filipino and Bisaya. Each step
// lights up one part of the page (TOUR_PARTS, the same in every language); a step
// without a part is a card in the middle of the screen. The staff portal's tour is in
// English, in StaffLayout.

export const TOUR_PARTS = {
  home: [
    null,
    '[data-tour="language"]',
    '[data-tour="home-submit"]',
    '[data-tour="home-track"]',
    '[data-tour="home-charter"]',
    '[data-tour="home-guidelines"]',
    null,
  ],
  // The report form (complaints and suggestions)
  submit: [
    '[data-tour="submit-type"]',
    '[data-tour="submit-office"]',
    '[data-tour="submit-location"]',
    '[data-tour="submit-phone"]',
    '[data-tour="submit-description"]',
    '[data-tour="submit-photos"]',
    '[data-tour="submit-send"]',
  ],
  // The same page with Feedback chosen, before the code is checked
  rate: [
    '[data-tour="submit-type"]',
    '[data-tour="rate-code"]',
    null,
  ],
};

// The steps of one tour in the current language, for <Tour steps>.
export function tourSteps(name, text) {
  return TOUR_PARTS[name].map((target, i) => ({ target, ...text[name][i], welcome: name === 'home' && i === 0 }));
}

const TOUR_TEXT = {
  en: {
    ui: {
      dialog: 'Quick tour',
      stepOf: (i, n) => `Step ${i} of ${n}`,
      start: 'Start the tour',
      notNow: 'Not now',
      next: 'Next',
      back: 'Back',
      done: 'Finish',
      skip: 'Skip the tour',
      close: 'Close the tour',
      takeTour: 'New here? Take a quick tour',
      showMeHow: 'Show me how',
    },
    home: [
      { title: 'Welcome to CIVIX', body: "This is the Municipality of Cantilan's website for complaints, suggestions and feedback. This short tour shows you where everything is. It takes about a minute." },
      { title: 'Choose your language', body: 'Read CIVIX in English, Filipino or Bisaya. Press here to change the language at any time.' },
      { title: 'Send a complaint or suggestion', body: "Press here to write to the right municipal office. You don't need an account. You will get a Transaction Code to follow your report." },
      { title: 'Follow your report', body: 'Press here and type your Transaction Code to see what the office has done about your report.' },
      { title: "Citizen's Charter", body: "See each office's services, what to bring, the fees and how long each service takes." },
      { title: 'Guidelines', body: 'Learn what to write in a complaint or suggestion, and how long offices have to act on it.' },
      { title: "Rate an office's service", body: 'After an office serves you, the staff give you a slip with a code. Scan its QR code, or type the code in Track My Report, to answer a short satisfaction form. Your answers are anonymous.' },
    ],
    submit: [
      { title: 'What are you sending?', body: 'Choose Complaint for a problem or poor service, or Suggestion for an idea to improve a service. Choose Feedback to rate a service with the code from your slip.' },
      { title: 'Which office is it for?', body: 'Choose the office your report is for. Not sure? Write the description first and CIVIX will choose the office; you can still change it.' },
      { title: 'Where is it? (optional)', body: 'Choose or type the barangay, or pin the exact place on the map. It helps the office find the problem.' },
      { title: 'How can the office reach you?', body: 'Type your mobile number and, just below it, your email address. CIVIX emails you each time the status of your report changes.' },
      { title: 'Describe it', body: 'Say what happened, where and when, in your own words. Clear details help the office act sooner.' },
      { title: 'Add photos (optional)', body: 'Photos help the office see the problem. You can add up to 5.' },
      { title: 'Send it', body: 'Press Submit Report. You will get a Transaction Code: keep it to follow your report in Track My Report.' },
    ],
    rate: [
      { title: 'Feedback', body: "Feedback is for rating an office's service after it served you. Your answers are anonymous: the office sees them, not who gave them." },
      { title: 'Type the code from your slip', body: 'After serving you, the office gives you a slip with a code. Type the code here and press Check code. Scanning the QR code on the slip fills it in for you.' },
      { title: 'Answer the questions', body: 'When the code is accepted, the satisfaction form opens. Choose one answer for each question, then press Send Feedback. Each code works once, within 7 days.' },
    ],
  },
  fil: {
    ui: {
      dialog: 'Maikling tour',
      stepOf: (i, n) => `Hakbang ${i} sa ${n}`,
      start: 'Simulan ang tour',
      notNow: 'Hindi muna',
      next: 'Susunod',
      back: 'Bumalik',
      done: 'Tapos na',
      skip: 'Laktawan ang tour',
      close: 'Isara ang tour',
      takeTour: 'Bago ka rito? Subukan ang maikling tour',
      showMeHow: 'Ipakita kung paano',
    },
    home: [
      { title: 'Maligayang pagdating sa CIVIX', body: 'Ito ang website ng Munisipyo ng Cantilan para sa mga reklamo, mungkahi at puna. Ipapakita ng maikling tour na ito kung nasaan ang lahat. Mga isang minuto lang ito.' },
      { title: 'Piliin ang iyong wika', body: 'Basahin ang CIVIX sa English, Filipino o Bisaya. Pindutin ito para palitan ang wika anumang oras.' },
      { title: 'Magpadala ng reklamo o mungkahi', body: 'Pindutin ito para sumulat sa tamang opisina ng munisipyo. Hindi mo kailangan ng account. Bibigyan ka ng Transaction Code para masubaybayan ang iyong ulat.' },
      { title: 'Subaybayan ang iyong ulat', body: 'Pindutin ito at i-type ang iyong Transaction Code para makita kung ano na ang ginawa ng opisina sa iyong ulat.' },
      { title: "Citizen's Charter", body: 'Tingnan ang mga serbisyo ng bawat opisina, ang mga dapat dalhin, ang bayad, at kung gaano katagal ang bawat serbisyo.' },
      { title: 'Mga Gabay', body: 'Alamin kung ano ang isusulat sa reklamo o mungkahi, at kung gaano katagal bago ito aksyunan ng opisina.' },
      { title: 'I-rate ang serbisyo ng opisina', body: 'Pagkatapos kang pagsilbihan ng isang opisina, bibigyan ka ng kawani ng slip na may code. I-scan ang QR code nito, o i-type ang code sa Subaybayan ang Ulat, para sagutan ang maikling satisfaction form. Hindi malalaman kung sino ka.' },
    ],
    submit: [
      { title: 'Ano ang ipapadala mo?', body: 'Piliin ang Reklamo para sa problema o hindi maayos na serbisyo, o ang Mungkahi para sa ideyang magpapabuti sa serbisyo. Piliin ang Puna (Feedback) para i-rate ang serbisyo gamit ang code sa iyong slip.' },
      { title: 'Para sa aling opisina?', body: 'Piliin ang opisinang kinauukulan ng iyong ulat. Hindi sigurado? Isulat muna ang paglalarawan at pipili ang CIVIX ng opisina; maaari mo pa rin itong palitan.' },
      { title: 'Saan ito? (opsyonal)', body: 'Pumili o i-type ang barangay, o markahan sa mapa ang mismong lugar. Makakatulong ito sa opisina na mahanap ang problema.' },
      { title: 'Paano ka makokontak ng opisina?', body: 'I-type ang iyong numero ng cellphone at, sa ibaba nito, ang iyong email address. Ie-email ka ng CIVIX tuwing magbabago ang kalagayan ng iyong ulat.' },
      { title: 'Ilarawan ito', body: 'Sabihin kung ano ang nangyari, saan at kailan, sa sarili mong salita. Ang malinaw na detalye ay makakatulong para mas mabilis kumilos ang opisina.' },
      { title: 'Maglakip ng larawan (opsyonal)', body: 'Makakatulong ang mga larawan para makita ng opisina ang problema. Hanggang 5 larawan ang maaari mong ilakip.' },
      { title: 'Ipadala ito', body: 'Pindutin ang Ipadala ang Ulat. Bibigyan ka ng Transaction Code: itago ito para masubaybayan ang iyong ulat sa Subaybayan ang Ulat.' },
    ],
    rate: [
      { title: 'Puna (Feedback)', body: 'Ang Puna ay para i-rate ang serbisyo ng isang opisina pagkatapos ka nitong pagsilbihan. Hindi malalaman kung sino ka: nakikita ng opisina ang iyong mga sagot, hindi kung sino ang sumagot.' },
      { title: 'I-type ang code sa iyong slip', body: 'Pagkatapos kang pagsilbihan, bibigyan ka ng opisina ng slip na may code. I-type dito ang code at pindutin ang Suriin ang code. Kapag na-scan mo ang QR code sa slip, kusa na itong mapupunan.' },
      { title: 'Sagutan ang mga tanong', body: 'Kapag tinanggap ang code, bubukas ang satisfaction form. Pumili ng isang sagot sa bawat tanong, saka pindutin ang Ipadala ang Puna. Isang beses lang magagamit ang bawat code, sa loob ng 7 araw.' },
    ],
  },
  ceb: {
    ui: {
      dialog: 'Mubo nga tour',
      stepOf: (i, n) => `Lakang ${i} sa ${n}`,
      start: 'Sugdi ang tour',
      notNow: 'Dili sa karon',
      next: 'Sunod',
      back: 'Balik',
      done: 'Human na',
      skip: 'Laktawi ang tour',
      close: 'Isira ang tour',
      takeTour: 'Bag-o ka diri? Sulayi ang mubo nga tour',
      showMeHow: 'Ipakita kon unsaon',
    },
    home: [
      { title: 'Malipayong pag-abot sa CIVIX', body: 'Kini ang website sa Munisipyo sa Cantilan para sa mga reklamo, sugyot ug feedback. Ipakita niining mubo nga tour kon asa ang tanan. Mga usa ka minuto ra kini.' },
      { title: 'Pilia ang imong pinulongan', body: 'Basaha ang CIVIX sa English, Filipino o Bisaya. Pindota kini aron ilisan ang pinulongan bisan kanus-a.' },
      { title: 'Ipadala ang reklamo o sugyot', body: 'Pindota kini aron mosulat sa saktong opisina sa munisipyo. Dili kinahanglan og account. Hatagan ka og Transaction Code aron masundan ang imong report.' },
      { title: 'Sundan ang imong report', body: 'Pindota kini ug i-type ang imong Transaction Code aron makita kon unsa na ang nahimo sa opisina sa imong report.' },
      { title: "Citizen's Charter", body: 'Tan-awa ang mga serbisyo sa matag opisina, ang kinahanglan dad-on, ang bayad, ug unsa kadugay ang matag serbisyo.' },
      { title: 'Mga Giya', body: 'Hibal-i kon unsa ang isulat sa reklamo o sugyot, ug unsa kadugay kini aksyonan sa opisina.' },
      { title: 'I-rate ang serbisyo sa opisina', body: 'Human ka maserbisyohan sa usa ka opisina, hatagan ka sa kawani og slip nga adunay code. I-scan ang QR code niini, o i-type ang code sa Sundan ang Report, aron tubagon ang mubo nga satisfaction form. Dili mahibaloan kon kinsa ka.' },
    ],
    submit: [
      { title: 'Unsa ang imong ipadala?', body: 'Pilia ang Reklamo para sa problema o dili maayo nga serbisyo, o ang Sugyot para sa ideya nga makapaayo sa serbisyo. Pilia ang Feedback aron i-rate ang serbisyo gamit ang code sa imong slip.' },
      { title: 'Para asa nga opisina?', body: 'Pilia ang opisina nga nalambigit sa imong report. Dili sigurado? Isulat una ang paghulagway ug ang CIVIX ang mopili sa opisina; mahimo gihapon nimo kining ilisan.' },
      { title: 'Asa kini? (opsyonal)', body: 'Pili o i-type ang barangay, o markahi sa mapa ang mismong lugar. Makatabang kini sa opisina nga makit-an ang problema.' },
      { title: 'Unsaon ka pagkontak sa opisina?', body: 'I-type ang imong numero sa cellphone ug, sa ubos niini, ang imong email address. I-email ka sa CIVIX kada mausab ang kahimtang sa imong report.' },
      { title: 'Ihulagway kini', body: 'Isulti kon unsa ang nahitabo, asa ug kanus-a, sa imong kaugalingong pulong. Ang klaro nga detalye makatabang nga mas dali molihok ang opisina.' },
      { title: 'Ilakip ang hulagway (opsyonal)', body: 'Makatabang ang mga hulagway aron makita sa opisina ang problema. Hangtod 5 ka hulagway ang mahimo nimong ilakip.' },
      { title: 'Ipadala kini', body: 'Pindota ang Ipadala ang Report. Hatagan ka og Transaction Code: tipigi kini aron masundan ang imong report sa Sundan ang Report.' },
    ],
    rate: [
      { title: 'Feedback', body: 'Ang Feedback para sa pag-rate sa serbisyo sa usa ka opisina human ka niini maserbisyohan. Dili mahibaloan kon kinsa ka: makita sa opisina ang imong mga tubag, dili kon kinsa ang mitubag.' },
      { title: 'I-type ang code sa imong slip', body: 'Human ka maserbisyohan, hatagan ka sa opisina og slip nga adunay code. I-type dinhi ang code ug pindota ang Susiha ang code. Kon i-scan nimo ang QR code sa slip, kusa na kining mapuno.' },
      { title: 'Tubaga ang mga pangutana', body: 'Kon madawat ang code, moabli ang satisfaction form. Pili og usa ka tubag sa matag pangutana, dayon pindota ang Ipadala ang Feedback. Kausa ra magamit ang matag code, sulod sa 7 ka adlaw.' },
    ],
  },
};

export default TOUR_TEXT;
