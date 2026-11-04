import React, { useEffect, useId, useRef, useState } from 'react';
import { LANGUAGES, useLang } from '../../i18n/LanguageContext';

const NAME = 'Language / Wika / Pinulongan';

// The language choice for the dark blue headers of the citizen pages: one small
// button showing the current language; it opens the list of languages below it.
export default function LanguageSwitcher({ className = '' }) {
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const buttonRef = useRef(null);
  const itemRefs = useRef([]);
  const menuId = useId();
  const currentIndex = Math.max(0, LANGUAGES.findIndex(l => l.code === lang));

  // A tap or click anywhere else closes the list; so does Escape (back to the button).
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = e => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    const onKey = e => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // When the list opens, the chosen language has the focus, so the arrow keys work at once.
  useEffect(() => {
    if (open) itemRefs.current[currentIndex]?.focus();
  }, [open, currentIndex]);

  function choose(code) {
    setLang(code);
    setOpen(false);
    buttonRef.current?.focus();
  }

  function onListKey(e) {
    const last = LANGUAGES.length - 1;
    const at = itemRefs.current.indexOf(document.activeElement);
    const go = i => { e.preventDefault(); itemRefs.current[i]?.focus(); };
    if (e.key === 'ArrowDown') go(at >= last ? 0 : at + 1);
    else if (e.key === 'ArrowUp') go(at <= 0 ? last : at - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(last);
    else if (e.key === 'Tab') setOpen(false);
  }

  // The outer box takes the page's placement (e.g. absolute, top right); the inner
  // one anchors the list under the button.
  return (
    <div ref={wrapRef} className={className} data-tour="language">
      <div className="relative">
        <button ref={buttonRef} type="button" onClick={() => setOpen(o => !o)}
          onKeyDown={e => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setOpen(true); } }}
          aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined}
          aria-label={`${NAME}: ${LANGUAGES[currentIndex].label}`}
          className="flex items-center gap-1.5 pl-2.5 pr-2 py-1.5 rounded-lg text-sm font-semibold text-white whitespace-nowrap transition-colors hover:bg-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          style={{ background: open ? 'rgba(255,255,255,0.24)' : 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.3)' }}>
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" />
          </svg>
          {LANGUAGES[currentIndex].label}
          <svg className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {open && (
          <div id={menuId} role="menu" aria-label={NAME} onKeyDown={onListKey}
            className="lang-menu absolute right-0 top-full mt-2 w-48 rounded-xl bg-white border border-gray-200 shadow-xl py-1.5 z-50">
            <p className="px-4 pt-1.5 pb-1 text-[11px] font-bold uppercase tracking-wide text-gray-500" aria-hidden="true">
              Language · Wika · Pinulongan
            </p>
            {LANGUAGES.map((l, i) => {
              const active = i === currentIndex;
              return (
                <button key={l.code} ref={el => { itemRefs.current[i] = el; }} type="button"
                  role="menuitemradio" aria-checked={active} onClick={() => choose(l.code)}
                  className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-[15px] text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${
                    active ? 'bg-blue-50 text-blue-800 font-bold' : 'text-gray-800 font-medium hover:bg-gray-100'
                  }`}>
                  {l.label}
                  {active && (
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
