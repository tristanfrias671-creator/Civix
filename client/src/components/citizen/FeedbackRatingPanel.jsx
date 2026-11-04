import React, { useEffect, useRef, useState } from 'react';
import { useText } from '../../i18n/LanguageContext';

// What the citizen sees, in English, Filipino and Bisaya. The saved values (reaction
// ids and the English tag names) stay the same in every language.
export const PANEL_TEXT = {
  en: {
    title: 'How was your experience?',
    lead: 'Tap a face. Your reaction helps the government improve services.',
    group: 'Your reaction',
    reactions: { EXCELLENT: 'Excellent', GOOD: 'Good', OKAY: 'Okay', POOR: 'Poor', TERRIBLE: 'Terrible' },
    messages: {
      EXCELLENT: "Thank you! We're glad you had a great experience.",
      GOOD: 'Thank you! Good to hear things went well.',
      OKAY: 'Thanks. Tell us below what could make it better.',
      POOR: "Sorry it wasn't better. Your feedback helps us improve.",
      TERRIBLE: "We're sorry. Please tell us what went wrong so we can fix it.",
    },
    faceLabel: (label, n) => `${label}, ${n} out of 5`,
    starLabel: n => `${n} star${n === 1 ? '' : 's'}`,
    overall: 'Overall rating',
    outOf5: n => `${n} out of 5`,
    tapHint: 'Tap a face or a star',
    standOut: 'What stood out?',
    optional: '(optional)',
    tags: {},
    youRated: (label, n) => `You rated: ${label} (${n}/5)`,
    yourRating: 'Your rating',
  },
  fil: {
    title: 'Kumusta ang iyong karanasan?',
    lead: 'Pumindot ng mukha. Nakatutulong ang iyong reaksyon para mapabuti ng pamahalaan ang serbisyo.',
    group: 'Ang iyong reaksyon',
    reactions: { EXCELLENT: 'Napakaganda', GOOD: 'Maganda', OKAY: 'Okay lang', POOR: 'Hindi maganda', TERRIBLE: 'Napakasama' },
    messages: {
      EXCELLENT: 'Salamat! Natutuwa kaming maganda ang iyong naging karanasan.',
      GOOD: 'Salamat! Mabuti at maayos ang lahat.',
      OKAY: 'Salamat. Sabihin sa ibaba kung ano ang makapagpapabuti nito.',
      POOR: 'Paumanhin at hindi ito naging mas maganda. Nakatutulong ang iyong puna para kami ay umunlad.',
      TERRIBLE: 'Paumanhin. Pakisabi kung ano ang naging problema para maayos namin ito.',
    },
    faceLabel: (label, n) => `${label}, ${n} sa 5`,
    starLabel: n => `${n} bituin`,
    overall: 'Kabuuang rating',
    outOf5: n => `${n} sa 5`,
    tapHint: 'Pumindot ng mukha o bituin',
    standOut: 'Ano ang napansin mo?',
    optional: '(opsyonal)',
    tags: {
      'Helpful staff': 'Matulunging kawani', 'Quick response': 'Mabilis na tugon', 'Easy to use': 'Madaling gamitin',
      'Clear updates': 'Malinaw na update', 'Needs improvement': 'Kailangang pagbutihin', 'Slow follow-up': 'Mabagal na follow-up',
    },
    youRated: (label, n) => `Ang rating mo: ${label} (${n}/5)`,
    yourRating: 'Ang iyong rating',
  },
  ceb: {
    title: 'Kumusta ang imong kasinatian?',
    lead: 'Pindota ang usa ka nawong. Ang imong reaksyon motabang sa gobyerno nga mapalambo ang serbisyo.',
    group: 'Ang imong reaksyon',
    reactions: { EXCELLENT: 'Maayo kaayo', GOOD: 'Maayo', OKAY: 'Okay ra', POOR: 'Dili maayo', TERRIBLE: 'Daotan kaayo' },
    messages: {
      EXCELLENT: 'Salamat! Nalipay kami nga maayo ang imong kasinatian.',
      GOOD: 'Salamat! Maayo nga hapsay ang tanan.',
      OKAY: 'Salamat. Isulti sa ubos kon unsa ang makapaayo pa niini.',
      POOR: 'Pasayloa nga wala kini nahimong mas maayo. Ang imong feedback motabang kanamo nga mouswag.',
      TERRIBLE: 'Pasayloa kami. Palihug isulti kon unsa ang sayop aron among maayo kini.',
    },
    faceLabel: (label, n) => `${label}, ${n} sa 5`,
    starLabel: n => `${n} ka bituon`,
    overall: 'Kinatibuk-ang rating',
    outOf5: n => `${n} sa 5`,
    tapHint: 'Pindota ang nawong o bituon',
    standOut: 'Unsa ang imong namatikdan?',
    optional: '(opsyonal)',
    tags: {
      'Helpful staff': 'Matinabangon nga kawani', 'Quick response': 'Paspas nga tubag', 'Easy to use': 'Sayon gamiton',
      'Clear updates': 'Klaro nga update', 'Needs improvement': 'Kinahanglan pauswagon', 'Slow follow-up': 'Hinay nga follow-up',
    },
    youRated: (label, n) => `Imong rating: ${label} (${n}/5)`,
    yourRating: 'Ang imong rating',
  },
};

// `code` names the animated emoji in public/emoji/<code>.json (`rest` is the frame
// shown while it is paused, the one that best shows its expression) — Noto Animated Emoji
// by Google, CC BY 4.0 (https://googlefonts.github.io/noto-emoji-animation/).
export const REACTIONS = [
  { id: 'EXCELLENT', label: 'Excellent', emoji: '😄', code: '1f604', rest: 60, rating: 5, color: '#059669', ring: 'ring-emerald-400', bg: 'bg-emerald-50', text: 'text-emerald-700',
    message: "Thank you! We're glad you had a great experience." },
  { id: 'GOOD', label: 'Good', emoji: '🙂', code: '1f642', rest: 0, rating: 4, color: '#16a34a', ring: 'ring-green-400', bg: 'bg-green-50', text: 'text-green-700',
    message: 'Thank you! Good to hear things went well.' },
  { id: 'OKAY', label: 'Okay', emoji: '😐', code: '1f610', rest: 0, rating: 3, color: '#d97706', ring: 'ring-amber-400', bg: 'bg-amber-50', text: 'text-amber-700',
    message: 'Thanks. Tell us below what could make it better.' },
  { id: 'POOR', label: 'Poor', emoji: '😞', code: '1f61e', rest: 100, rating: 2, color: '#ea580c', ring: 'ring-orange-400', bg: 'bg-orange-50', text: 'text-orange-700',
    message: "Sorry it wasn't better. Your feedback helps us improve." },
  { id: 'TERRIBLE', label: 'Terrible', emoji: '😠', code: '1f620', rest: 90, rating: 1, color: '#dc2626', ring: 'ring-red-400', bg: 'bg-red-50', text: 'text-red-700',
    message: "We're sorry. Please tell us what went wrong so we can fix it." },
];

export const EXPERIENCE_TAGS = [
  'Helpful staff',
  'Quick response',
  'Easy to use',
  'Clear updates',
  'Needs improvement',
  'Slow follow-up',
];

export function getReactionMeta(reactionId) {
  return REACTIONS.find(r => r.id === reactionId) || null;
}

const panelCss = `
@keyframes rxPop { 0% { transform: scale(1); } 40% { transform: scale(1.08); } 100% { transform: scale(1.03); } }
@keyframes rxBadge { from { transform: scale(0); } to { transform: scale(1); } }
@keyframes rxStarPop { 0% { transform: scale(.6) rotate(-15deg); } 60% { transform: scale(1.25) rotate(6deg); } 100% { transform: scale(1) rotate(0); } }
@keyframes rxFadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
@keyframes rxBounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
.rx-card { transition: transform .25s cubic-bezier(.22,1,.36,1), opacity .25s ease, filter .25s ease, box-shadow .25s ease, border-color .25s ease; }
.rx-card:hover { transform: translateY(-3px); }
.rx-card.rx-active { animation: rxPop .45s cubic-bezier(.34,1.56,.64,1) both; }
.rx-card.rx-dim { opacity: .55; filter: grayscale(.55); }
.rx-card.rx-dim:hover, .rx-card.rx-dim:focus-visible { opacity: 1; filter: none; }
.rx-badge { animation: rxBadge .35s cubic-bezier(.34,1.56,.64,1) both; }
.rx-star-pop { animation: rxStarPop .45s cubic-bezier(.34,1.56,.64,1) both; }
.rx-fade-up { animation: rxFadeUp .35s ease both; }
.rx-fallback-play { animation: rxBounce 1s ease-in-out infinite; }
.rx-tint { color: var(--rx-c); }
.dark .rx-tint { color: #f1f5f9; }
.dark .rx-tint-soft { color: #cbd5e1; }
@media (prefers-reduced-motion: reduce) {
  .rx-card, .rx-card.rx-active, .rx-badge, .rx-star-pop, .rx-fade-up, .rx-fallback-play { animation: none !important; transition: none !important; }
}
`;

const reduceMotion = typeof window !== 'undefined'
  && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// The animation player is only downloaded when this panel is shown.
let lottiePromise = null;
function loadLottie() {
  if (!lottiePromise) lottiePromise = import('lottie-web/build/player/lottie_light').then(m => m.default);
  return lottiePromise;
}

// An animated emoji that plays while `playing` is true and rests on frame `rest`
// otherwise. Shows the regular emoji until the animation loads, or if it can't.
export function AnimatedEmoji({ code, rest = 0, fallback, playing, className }) {
  const box = useRef(null);
  const anim = useRef(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadLottie().then(lottie => {
      if (cancelled || !box.current) return;
      const a = lottie.loadAnimation({
        container: box.current, renderer: 'svg', loop: true, autoplay: false,
        path: `${process.env.PUBLIC_URL}/emoji/${code}.json`,
      });
      a.addEventListener('DOMLoaded', () => { if (!cancelled) setReady(true); });
      a.addEventListener('data_failed', () => { if (!cancelled) setFailed(true); });
      anim.current = a;
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => {
      cancelled = true;
      if (anim.current) anim.current.destroy();
      anim.current = null;
    };
  }, [code]);

  useEffect(() => {
    const a = anim.current;
    if (!a || !ready) return;
    if (playing && !reduceMotion) a.play();
    else a.goToAndStop(rest, true);
  }, [playing, ready, rest]);

  if (failed) {
    return (
      <span className={`${className} flex items-center justify-center text-3xl sm:text-4xl leading-none ${playing ? 'rx-fallback-play' : ''}`} aria-hidden>
        {fallback}
      </span>
    );
  }
  return (
    <span className={`${className} relative`} aria-hidden>
      {!ready && <span className="absolute inset-0 flex items-center justify-center text-3xl sm:text-4xl leading-none">{fallback}</span>}
      <span ref={box} className="block w-full h-full" style={{ opacity: ready ? 1 : 0 }} />
    </span>
  );
}

function Star({ n, filled, pop, onClick, onHover, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onHover}
      onFocus={onHover}
      className="w-10 h-10 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-lg"
      aria-label={label}
    >
      <svg viewBox="0 0 24 24" className={`w-full h-full ${pop ? 'rx-star-pop' : ''} ${filled ? 'text-amber-400 fill-amber-400' : 'text-gray-300 fill-gray-200 dark:text-slate-600 dark:fill-slate-600'}`}
        style={pop ? { animationDelay: `${(n - 1) * 60}ms`, filter: 'drop-shadow(0 2px 4px rgba(245,158,11,0.35))' } : undefined}>
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    </button>
  );
}

export default function FeedbackRatingPanel({ rating, reaction, tags, onRatingChange, onReactionChange, onTagsChange }) {
  const t = useText(PANEL_TEXT);
  const [hoverStar, setHoverStar] = useState(0);
  const [hoverReaction, setHoverReaction] = useState(null);
  const [visible, setVisible] = useState(true);
  const gridRef = useRef(null);
  const displayStars = hoverStar || rating || 0;
  const selectedReaction = getReactionMeta(reaction);
  const starReaction = REACTIONS.find(r => r.rating === displayStars);

  // Pause the faces while the panel is scrolled out of view.
  useEffect(() => {
    if (!gridRef.current || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    io.observe(gridRef.current);
    return () => io.disconnect();
  }, []);

  function selectReaction(r) {
    onReactionChange(r.id);
    onRatingChange(r.rating);
  }

  function toggleTag(tag) {
    if (tags.includes(tag)) onTagsChange(tags.filter(t => t !== tag));
    else onTagsChange([...tags, tag]);
  }

  return (
    <div className="rounded-2xl border border-green-200 bg-gradient-to-br from-green-50 via-white to-emerald-50/40 dark:border-emerald-800/60 dark:from-emerald-950/40 dark:via-slate-800 dark:to-slate-800 p-5 space-y-5">
      <style>{panelCss}</style>
      <div>
        <h3 className="text-base font-bold text-gray-800">{t.title}</h3>
        <p className="text-sm text-gray-500 mt-0.5">{t.lead}</p>
      </div>

      <div ref={gridRef} className="grid grid-cols-5 gap-2 sm:gap-3" role="radiogroup" aria-label={t.group}>
        {REACTIONS.map(r => {
          const active = reaction === r.id;
          // Before a choice, every face animates; after it, only the chosen one
          // (and whichever the pointer is over).
          const playing = visible && (active || hoverReaction === r.id || !reaction);
          return (
            <button
              key={r.id}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={t.faceLabel(t.reactions[r.id], r.rating)}
              onClick={() => selectReaction(r)}
              onMouseEnter={() => setHoverReaction(r.id)}
              onMouseLeave={() => setHoverReaction(null)}
              onFocus={() => setHoverReaction(r.id)}
              onBlur={() => setHoverReaction(null)}
              className={`rx-card relative flex flex-col items-center gap-1.5 px-1 py-3 sm:p-3 rounded-xl border-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                active ? 'rx-active' : `bg-white border-gray-100 hover:shadow-md ${reaction ? 'rx-dim' : ''}`
              }`}
              style={active ? { background: `${r.color}14`, borderColor: r.color, boxShadow: `0 10px 24px -10px ${r.color}88` } : undefined}
            >
              {active && (
                <span className="rx-badge absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-white shadow"
                  style={{ background: r.color }}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                </span>
              )}
              <AnimatedEmoji code={r.code} rest={r.rest} fallback={r.emoji} playing={playing} className="w-10 h-10 sm:w-14 sm:h-14" />
              <span className={`text-[11px] sm:text-sm font-semibold ${active ? 'rx-tint' : 'text-gray-600'}`} style={active ? { '--rx-c': r.color } : undefined}>
                {t.reactions[r.id]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col items-center py-3 border-y border-green-100/80 dark:border-slate-700">
        <p className="text-sm font-medium text-gray-500 mb-1.5">{t.overall}</p>
        <div className="flex gap-1" onMouseLeave={() => setHoverStar(0)}>
          {[1, 2, 3, 4, 5].map(star => (
            <Star
              key={`${star}-${rating}`}
              n={star}
              filled={star <= displayStars}
              pop={!hoverStar && star <= (rating || 0)}
              onClick={() => {
                onRatingChange(star);
                const match = REACTIONS.find(r => r.rating === star);
                if (match) onReactionChange(match.id);
              }}
              onHover={() => setHoverStar(star)}
              label={t.starLabel(star)}
            />
          ))}
        </div>
        <p className="text-base font-semibold text-gray-700 mt-1.5 min-h-[1.5rem]">
          {displayStars > 0
            ? <>{t.outOf5(displayStars)}{starReaction && <span style={{ color: starReaction.color }}> · {t.reactions[starReaction.id]}</span>}</>
            : t.tapHint}
        </p>
      </div>

      <div>
        <p className="text-sm font-medium text-gray-600 mb-2">{t.standOut} <span className="text-gray-500 font-normal">{t.optional}</span></p>
        <div className="flex flex-wrap gap-2">
          {EXPERIENCE_TAGS.map(tag => {
            const on = tags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={on}
                onClick={() => toggleTag(tag)}
                className={`px-3.5 py-1.5 rounded-full text-sm font-medium border ${
                  on
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-primary/40'
                }`}
              >
                {on ? '✓ ' : ''}{t.tags[tag] || tag}
              </button>
            );
          })}
        </div>
      </div>

      {selectedReaction && (
        <div key={selectedReaction.id} className="rx-fade-up rx-tint flex items-center gap-3 text-sm font-medium px-4 py-3 rounded-xl"
          style={{ '--rx-c': selectedReaction.color, background: `${selectedReaction.color}1a`, border: `1px solid ${selectedReaction.color}33` }}>
          <span className="text-2xl leading-none" aria-hidden>{selectedReaction.emoji}</span>
          <span>
            {t.messages[selectedReaction.id]}
            <span className="rx-tint-soft block text-xs font-semibold opacity-80 mt-0.5">{t.youRated(t.reactions[selectedReaction.id], rating)}</span>
          </span>
        </div>
      )}
    </div>
  );
}
