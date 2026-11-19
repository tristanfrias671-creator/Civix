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
  // The one form (feedback, complaints and suggestions; since Nov 10, 2026). Before
  // the code is checked only the code box is there: Submit.jsx then shows steps 2-4
  // as cards in the middle of the screen.
  form: [
    '[data-tour="form-code"]',
    '[data-tour="form-csm"]',
    '[data-tour="form-remark"]',
    '[data-tour="form-send"]',
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
      { title: 'Rate a service, or send a complaint or suggestion', body: "Press here to open the form. First type the code from the slip the office gives you. You don't need an account. You will get a Transaction Code to follow what you sent." },
      { title: 'Follow your report', body: 'Press here and type your Transaction Code to see what the office has done about your report.' },
      { title: "Citizen's Charter", body: "See each office's services, what to bring, the fees and how long each service takes." },
      { title: 'Guidelines', body: 'Learn what to write in a complaint or suggestion, and how long offices have to act on it.' },
      { title: 'Get a code at the office', body: 'Go to the office your concern is about. After serving you, the staff give you a slip with a code. Scan its QR code, or type the code in the form, to rate the service or send a complaint or suggestion. Each office gives its own code.' },
    ],
    form: [
      { title: 'Type the code from the office', body: 'Each office gives you a slip with a code after serving you. Type the code here and press Check code. Scanning the QR code on the slip fills it in for you.' },
      { title: 'Answer the questions', body: 'When the code is accepted, the form for that office opens. Choose one answer for each question. Your answers are anonymous: the office sees them, not who gave them.' },
      { title: 'Write a comment, complaint or suggestion', body: 'The last box is optional. Write in your own words. The AI tells whether it is a complaint, a suggestion or a comment, and you can change it.' },
      { title: 'Send it', body: 'Press Submit Form. You will get a Transaction Code: keep it to follow your form on Track My Report. Each office code works once, within 7 days.' },
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
      { title: 'I-rate ang serbisyo, o magpadala ng reklamo o mungkahi', body: 'Pindutin ito para buksan ang form. I-type muna ang code mula sa slip na ibinigay ng opisina. Hindi mo kailangan ng account. Bibigyan ka ng Transaction Code para masubaybayan ang iyong ipinadala.' },
      { title: 'Subaybayan ang iyong ulat', body: 'Pindutin ito at i-type ang iyong Transaction Code para makita kung ano na ang ginawa ng opisina sa iyong ulat.' },
      { title: "Citizen's Charter", body: 'Tingnan ang mga serbisyo ng bawat opisina, ang mga dapat dalhin, ang bayad, at kung gaano katagal ang bawat serbisyo.' },
      { title: 'Mga Gabay', body: 'Alamin kung ano ang isusulat sa reklamo o mungkahi, at kung gaano katagal bago ito aksyunan ng opisina.' },
      { title: 'Kumuha ng code sa opisina', body: 'Pumunta sa opisinang may kinalaman sa iyong hinaing. Pagkatapos kang pagsilbihan, bibigyan ka ng kawani ng slip na may code. I-scan ang QR code nito, o i-type ang code sa form, para i-rate ang serbisyo o magpadala ng reklamo o mungkahi. May sariling code ang bawat opisina.' },
    ],
    form: [
      { title: 'I-type ang code mula sa opisina', body: 'Pagkatapos kang pagsilbihan, bibigyan ka ng bawat opisina ng slip na may code. I-type dito ang code at pindutin ang Suriin ang code. Kapag na-scan mo ang QR code sa slip, kusa na itong mapupunan.' },
      { title: 'Sagutan ang mga tanong', body: 'Kapag tinanggap ang code, bubukas ang form para sa opisinang iyon. Pumili ng isang sagot sa bawat tanong. Hindi malalaman kung sino ka: nakikita ng opisina ang iyong mga sagot, hindi kung sino ang sumagot.' },
      { title: 'Sumulat ng komento, reklamo o mungkahi', body: 'Opsyonal ang huling kahon. Isulat ito sa sarili mong salita. Sasabihin ng AI kung reklamo, mungkahi o komento ito, at maaari mo itong palitan.' },
      { title: 'Ipadala ito', body: 'Pindutin ang Ipadala ang Form. Bibigyan ka ng Transaction Code: itago ito para masubaybayan ang iyong form sa Subaybayan ang Ulat. Isang beses lang magagamit ang code ng opisina, sa loob ng 7 araw.' },
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
      { title: 'I-rate ang serbisyo, o ipadala ang reklamo o sugyot', body: 'Pindota kini aron ablihan ang form. I-type una ang code gikan sa slip nga gihatag sa opisina. Dili kinahanglan og account. Hatagan ka og Transaction Code aron masundan ang imong gipadala.' },
      { title: 'Sundan ang imong report', body: 'Pindota kini ug i-type ang imong Transaction Code aron makita kon unsa na ang nahimo sa opisina sa imong report.' },
      { title: "Citizen's Charter", body: 'Tan-awa ang mga serbisyo sa matag opisina, ang kinahanglan dad-on, ang bayad, ug unsa kadugay ang matag serbisyo.' },
      { title: 'Mga Giya', body: 'Hibal-i kon unsa ang isulat sa reklamo o sugyot, ug unsa kadugay kini aksyonan sa opisina.' },
      { title: 'Pagkuha og code sa opisina', body: 'Adto sa opisina nga nalambigit sa imong kabalaka. Human ka maserbisyohan, hatagan ka sa kawani og slip nga adunay code. I-scan ang QR code niini, o i-type ang code sa form, aron i-rate ang serbisyo o ipadala ang reklamo o sugyot. Ang matag opisina adunay kaugalingong code.' },
    ],
    form: [
      { title: 'I-type ang code gikan sa opisina', body: 'Human ka maserbisyohan, hatagan ka sa matag opisina og slip nga adunay code. I-type dinhi ang code ug pindota ang Susiha ang code. Kon i-scan nimo ang QR code sa slip, kusa na kining mapuno.' },
      { title: 'Tubaga ang mga pangutana', body: 'Kon madawat ang code, moabli ang form para niadtong opisinaha. Pili og usa ka tubag sa matag pangutana. Dili mahibaloan kon kinsa ka: makita sa opisina ang imong mga tubag, dili kon kinsa ang mitubag.' },
      { title: 'Pagsulat og komento, reklamo o sugyot', body: 'Opsyonal ang katapusang kahon. Isulat kini sa imong kaugalingong pulong. Isulti sa AI kon reklamo, sugyot o komento kini, ug mahimo nimo kining ilisan.' },
      { title: 'Ipadala kini', body: 'Pindota ang Ipadala ang Form. Hatagan ka og Transaction Code: tipigi kini aron masundan ang imong form sa Sundan ang Report. Kausa ra magamit ang code sa opisina, sulod sa 7 ka adlaw.' },
    ],
  },
};

export default TOUR_TEXT;
