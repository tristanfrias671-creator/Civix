import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// A short guided tour for first-time users: the page dims, one part of it stays lit,
// and a card beside it says what that part is for (Back, Next, Skip). A step points
// at its part with a CSS selector; when several elements match (a phone and a desktop
// version), the first one on the screen is used, and a step whose part isn't on the
// screen at all (a hidden menu, a narrower layout) is left out. Nothing under the dim
// layer can be pressed while the tour is open; Esc ends it.

const STORE_KEY = 'civix_tours';
const EDGE = 12;  // space kept free at the screen's edges
const GAP = 14;   // between the lit part and the card
const PAD = 8;    // the lit area around the part

function readTours() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) || {};
  } catch {
    return {};
  }
}

// Remembers on this device that a tour was finished ('done') or skipped ('skipped').
export function markTour(id, how) {
  if (how !== 'done' && how !== 'skipped') return;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ ...readTours(), [id]: how }));
  } catch { /* storage unavailable: the tour may show again */ }
}

// Whether a tour opens by itself: only the first time, and not after the person
// skipped one of the related tours. Automated browsers (the test robots) don't get it,
// so they can test the pages as they are; "?tour=1" in the address always opens it.
export function shouldAutoStart(id, related = []) {
  if (new URLSearchParams(window.location.search).get('tour') === '1') return true;
  if (navigator.webdriver) return false;
  const seen = readTours();
  return !seen[id] && !related.some(other => seen[other] === 'skipped');
}

function onScreen(el) {
  if (!el?.isConnected) return false;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return false;
  // A slide-out menu that is closed sits just off the screen's left edge.
  if (r.right <= 0 || r.left >= window.innerWidth) return false;
  return getComputedStyle(el).visibility !== 'hidden';
}

function findTarget(selector) {
  return [...document.querySelectorAll(selector)].find(onScreen) || null;
}

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Where the lit area and the card go: under the part, else above it, else beside it,
// else at the bottom of the screen. Without a part, the card is in the middle.
function place(target, card, w, h) {
  const width = Math.min(380, w - EDGE * 2);
  const ch = card ? card.height : 220;
  if (!target) {
    return { hole: null, top: Math.max(EDGE, Math.round((h - ch) / 2)), left: Math.round((w - width) / 2), width };
  }
  // The lit area keeps PAD around the part, but stays 6 px inside the screen (when the
  // part does), so its outline shows in full.
  const top = Math.max(target.top - PAD, Math.min(6, target.top));
  const left = Math.max(target.left - PAD, Math.min(6, target.left));
  const right = Math.min(target.right + PAD, Math.max(w - 6, target.right));
  const bottom = Math.min(target.bottom + PAD, Math.max(h - 6, target.bottom));
  const hole = {
    top: Math.round(top), left: Math.round(left),
    width: Math.round(right - left), height: Math.round(bottom - top),
  };
  const centred = Math.round(Math.min(Math.max(EDGE, target.left + target.width / 2 - width / 2), w - width - EDGE));
  const below = hole.top + hole.height + GAP;
  if (below + ch <= h - EDGE) return { hole, top: below, left: centred, width };
  const above = hole.top - GAP - ch;
  if (above >= EDGE) return { hole, top: above, left: centred, width };
  const side = Math.round(Math.min(Math.max(EDGE, target.top + target.height / 2 - ch / 2), h - ch - EDGE));
  if (hole.left + hole.width + GAP + width <= w - EDGE) return { hole, top: side, left: hole.left + hole.width + GAP, width };
  if (hole.left - GAP - width >= EDGE) return { hole, top: side, left: hole.left - GAP - width, width };
  const atBottom = Math.max(EDGE, h - ch - EDGE);
  const coversBottom = Math.max(0, hole.top + hole.height - atBottom);
  const coversTop = Math.max(0, EDGE + ch - hole.top);
  return { hole, top: coversTop < coversBottom ? EDGE : atBottom, left: Math.round((w - width) / 2), width };
}

// Scrolls the part into view with room for the card under it, the two centred
// together; a part too tall for that shows from its top. (The scroll margins only
// count while the browser works out where to scroll.)
function bringIntoView(el, cardHeight) {
  const behavior = prefersReducedMotion() ? 'auto' : 'smooth';
  const room = el.getBoundingClientRect().height + PAD * 2 + GAP + cardHeight + EDGE * 2;
  const before = [el.style.scrollMarginTop, el.style.scrollMarginBottom];
  el.style.scrollMarginTop = `${PAD + EDGE}px`;
  if (room <= window.innerHeight) {
    el.style.scrollMarginBottom = `${PAD + GAP + cardHeight + EDGE}px`;
    el.scrollIntoView({ block: 'center', inline: 'nearest', behavior });
  } else {
    el.scrollIntoView({ block: 'start', inline: 'nearest', behavior });
  }
  [el.style.scrollMarginTop, el.style.scrollMarginBottom] = before;
}

const COLORS = {
  light: {
    card: '#ffffff', border: '#e2e8f0', title: '#0f172a', body: '#334155', step: '#475569',
    primary: '#1d4ed8', primaryHover: '#1e3a8a', primaryText: '#ffffff', secondaryBorder: '#cbd5e1', secondaryText: '#1e293b', link: '#1d4ed8',
  },
  dark: {
    card: '#1e293b', border: '#475569', title: '#f8fafc', body: '#e2e8f0', step: '#cbd5e1',
    primary: '#2563eb', primaryHover: '#1d4ed8', primaryText: '#ffffff', secondaryBorder: '#64748b', secondaryText: '#f1f5f9', link: '#93c5fd',
  },
};

const tourCss = `
@keyframes cvxTourIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.cvx-tour-card { animation: cvxTourIn .18s ease-out both; }
@media (prefers-reduced-motion: reduce) { .cvx-tour-card { animation: none; } }
.cvx-tour-primary:hover { background: var(--cvx-tour-hover) !important; }
`;

// steps: [{ target?: 'css selector', title, body, welcome?: true }]
// labels: { dialog, stepOf(i, n), start, notNow, next, back, done, skip, close }
// onClose('done' | 'skipped' | 'empty'); markTour() keeps only the first two.
export default function Tour({ open, steps, labels, onClose, dark = false, lang, waitFor = 3000 }) {
  const [list, setList] = useState(null);
  const [index, setIndex] = useState(0);
  const [layout, setLayout] = useState(null);
  const cardRef = useRef(null);
  const returnFocusRef = useRef(null);
  const titleId = useId();
  const bodyId = useId();
  const c = dark ? COLORS.dark : COLORS.light;

  // Which steps can be shown. Parts of the page that load late (a list, a chart) get
  // a few seconds to appear.
  useEffect(() => {
    if (!open) {
      setList(null);
      setLayout(null);
      return undefined;
    }
    returnFocusRef.current = document.activeElement;
    let timer;
    const started = Date.now();
    const pick = () => {
      const allThere = steps.every(s => !s.target || document.querySelector(s.target));
      if (!allThere && Date.now() - started < waitFor) {
        timer = setTimeout(pick, 150);
        return;
      }
      setIndex(0);
      setList(steps.filter(s => !s.target || findTarget(s.target)));
    };
    timer = setTimeout(pick, 0);
    return () => clearTimeout(timer);
  }, [open, steps, waitFor]);

  const step = list?.[index] || null;
  const last = list ? index === list.length - 1 : false;

  const close = useCallback(how => {
    onClose(how);
    const back = returnFocusRef.current;
    if (back?.isConnected && typeof back.focus === 'function') back.focus({ preventScroll: true });
  }, [onClose]);

  const next = useCallback(() => {
    if (last) close('done');
    else setIndex(i => i + 1);
  }, [last, close]);
  const prev = useCallback(() => setIndex(i => Math.max(0, i - 1)), []);

  // Bring the part into view, then keep the lit area and the card on it while the
  // page scrolls, resizes or animates.
  useLayoutEffect(() => {
    if (!step) return undefined;
    let el = step.target ? findTarget(step.target) : null;
    if (el) bringIntoView(el, cardRef.current?.offsetHeight || 240);
    let frame;
    let seen = '';
    const tick = () => {
      if (el && !el.isConnected) el = findTarget(step.target);
      let r = el ? el.getBoundingClientRect() : null;
      if (r && ((r.width === 0 && r.height === 0) || r.right <= 0 || r.left >= window.innerWidth)) r = null;
      const box = cardRef.current?.getBoundingClientRect();
      const key = [r?.top, r?.left, r?.width, r?.height, box?.height, window.innerWidth, window.innerHeight].join('|');
      if (key !== seen) {
        seen = key;
        setLayout(place(r, box, window.innerWidth, window.innerHeight));
      }
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [step]);

  // Each step's card is new, so moving the focus into it has a screen reader read
  // its title and text; the focus lands on the main button.
  const placed = Boolean(layout);
  useEffect(() => {
    const card = cardRef.current;
    if (!step || !card || !placed) return;
    (card.querySelector('[data-tour-next]') || card).focus({ preventScroll: true });
  }, [step, placed]);

  // Esc ends the tour; Tab stays inside the card; the arrow keys page through it.
  useEffect(() => {
    if (!step) return undefined;
    const typing = () => /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
    const onKey = e => {
      const card = cardRef.current;
      if (!card) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close('skipped');
      } else if (e.key === 'Tab') {
        const items = [...card.querySelectorAll('button')];
        if (!items.length) return;
        const first = items[0];
        const lastItem = items[items.length - 1];
        if (!card.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && (document.activeElement === first || document.activeElement === card)) {
          e.preventDefault();
          lastItem.focus();
        } else if (!e.shiftKey && document.activeElement === lastItem) {
          e.preventDefault();
          first.focus();
        }
      } else if (e.key === 'ArrowRight' && !typing()) {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowLeft' && !typing()) {
        e.preventDefault();
        prev();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [step, next, prev, close]);

  // Nothing to show (every part missing): end quietly, without remembering it.
  useEffect(() => {
    if (open && list && list.length === 0) onClose('empty');
  }, [open, list, onClose]);

  if (!open || !step) return null;

  const hole = layout?.hole;
  const veil = 'rgba(8,15,30,0.62)';
  const btn = 'min-h-[44px] px-4 rounded-lg text-[15px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500';

  return createPortal(
    <div data-tour-open className="fixed inset-0" style={{ zIndex: 1000 }} lang={lang}>
      <style>{tourCss}</style>
      {/* Catches every press outside the card */}
      <div className="absolute inset-0" onMouseDown={e => e.preventDefault()} aria-hidden="true" />
      {hole ? (
        <div data-tour-hole aria-hidden="true" className="absolute pointer-events-none rounded-xl"
          style={{
            top: hole.top, left: hole.left, width: hole.width, height: hole.height,
            boxShadow: `0 0 0 3px #ffffff, 0 0 0 6px #2563eb, 0 0 0 9999px ${veil}`,
          }} />
      ) : (
        <div className="absolute inset-0 pointer-events-none" style={{ background: veil }} aria-hidden="true" />
      )}

      <div ref={cardRef} key={index} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={bodyId}
        tabIndex={-1} data-tour-card data-tour-step={index + 1} data-tour-steps={list.length}
        className="cvx-tour-card absolute rounded-2xl border p-5 shadow-2xl focus:outline-none"
        style={{
          top: layout?.top ?? 0, left: layout?.left ?? 0, width: layout?.width ?? 360,
          visibility: layout ? 'visible' : 'hidden',
          background: c.card, borderColor: c.border,
        }}>
        <div className="flex items-start justify-between gap-3">
          <p className="text-[13px] font-semibold uppercase tracking-wide" style={{ color: c.step }}>
            {labels.dialog} · {labels.stepOf(index + 1, list.length)}
          </p>
          <button type="button" onClick={() => close('skipped')} aria-label={labels.close} title={labels.close}
            className="-mt-1.5 -mr-1.5 w-9 h-9 flex-shrink-0 rounded-lg flex items-center justify-center transition-colors hover:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            style={{ color: c.step }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <h2 id={titleId} className="mt-1 text-lg font-bold leading-snug" style={{ color: c.title }}>{step.title}</h2>
        <p id={bodyId} className="mt-1.5 text-[15px] leading-relaxed" style={{ color: c.body }}>{step.body}</p>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          {!last && (
            <button type="button" data-tour-skip onClick={() => close('skipped')}
              className="min-h-[44px] -ml-1 px-1 rounded text-[15px] font-semibold underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              style={{ color: c.link }}>
              {step.welcome ? labels.notNow : labels.skip}
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            {index > 0 && (
              <button type="button" data-tour-back onClick={prev} className={`${btn} border`}
                style={{ borderColor: c.secondaryBorder, color: c.secondaryText, background: 'transparent' }}>
                {labels.back}
              </button>
            )}
            <button type="button" data-tour-next onClick={next} className={`${btn} cvx-tour-primary`}
              style={{ background: c.primary, color: c.primaryText, '--cvx-tour-hover': c.primaryHover }}>
              {last ? labels.done : step.welcome ? labels.start : labels.next}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
