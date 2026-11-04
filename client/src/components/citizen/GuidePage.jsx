import React, { useEffect, useState } from 'react';

// The pieces the Guidelines and Citizen's Charter pages share: the section cards,
// the "On this page" list that follows the reader, and the reading progress.

export const GUIDE_CSS = `
@keyframes gl-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
.gl-rise { animation: gl-rise .45s cubic-bezier(.2,.8,.2,1) both; }
.gl-badge { box-shadow: 0 6px 14px -6px rgba(37,99,235,.6), inset 0 1px 0 rgba(255,255,255,.3); }
.gl-ring { transition: stroke-dashoffset .5s cubic-bezier(.2,.8,.2,1), stroke .3s ease; }
.gl-faq summary::-webkit-details-marker { display: none; }
.gl-faq[open] .gl-plus { transform: rotate(45deg); }
.gl-plus { transition: transform .2s ease; }
.gl-strip::-webkit-scrollbar { display: none; }
html { scroll-behavior: smooth; }
@media (prefers-reduced-motion: reduce) {
  .gl-rise { animation: none; }
  html { scroll-behavior: auto; }
}
`;

export function Ico({ d, className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {[].concat(d).map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
}

// Highlights the section currently in the upper part of the viewport. The last
// sections can't scroll that high, so at the bottom of the page the last one wins.
export function useActiveSection(ids) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const atBottom = () => window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
    const observer = new IntersectionObserver(entries => {
      if (atBottom()) return;
      const visible = entries.filter(e => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActive(visible[0].target.id);
    }, { rootMargin: '-15% 0px -70% 0px' });
    ids.forEach(id => { const el = document.getElementById(id); if (el) observer.observe(el); });
    const onScroll = () => { if (atBottom()) setActive(ids[ids.length - 1]); };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
    };
  }, [ids]);
  return active;
}

export function useReadingProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(100, Math.round((window.scrollY / max) * 100)) : 100);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return progress;
}

// Same card + icon-heading style as the Submit page's form card.
export function Section({ id, icon, title, subtitle, children }) {
  return (
    <section id={id} className="scroll-mt-20 xl:scroll-mt-6 bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6 mb-6">
      <div className="flex items-start gap-3 mb-5">
        <div className="p-2 rounded-xl bg-blue-50 text-primary flex-shrink-0"><Ico d={icon} /></div>
        <div>
          <h2 className="font-bold text-gray-900 text-base sm:text-lg leading-tight">{title}</h2>
          {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

// The sticky row of section links for screens without the sidebar.
export function SectionStrip({ ids, names, active, label }) {
  return (
    <nav className="xl:hidden sticky top-0 z-20 -mx-4 sm:-mx-8 px-4 sm:px-8 py-2.5 mb-5 backdrop-blur-md"
      style={{ background: 'rgba(238,242,249,0.9)' }} aria-label={label}>
      <div className="gl-strip flex gap-2 overflow-x-auto">
        {ids.map(id => (
          <a key={id} href={`#${id}`}
            className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-sm font-semibold border transition-colors ${active === id ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200'}`}>
            {names[id]}
          </a>
        ))}
      </div>
    </nav>
  );
}

// The sidebar's "On this page" card, with the reading progress.
export function OnThisPage({ ids, names, active, progress, title, progressLabel, label }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{title}</p>
        <span className="text-xs font-semibold text-gray-500">{progress}%</span>
      </div>
      <div className="h-1 rounded-full bg-gray-100 overflow-hidden mb-3" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={progressLabel}>
        <div className="h-full rounded-full bg-primary transition-[width] duration-150" style={{ width: `${progress}%` }} />
      </div>
      <nav className="space-y-0.5" aria-label={label}>
        {ids.map(id => (
          <a key={id} href={`#${id}`} aria-current={active === id ? 'true' : undefined}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${active === id ? 'bg-blue-50 text-primary font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}>
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${active === id ? 'bg-primary' : 'bg-gray-300'}`} />
            {names[id]}
          </a>
        ))}
      </nav>
    </div>
  );
}
