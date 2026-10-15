import React, { useEffect } from 'react';
import { mediaUrl } from '../../utils/mediaUrl';

const css = `
@keyframes pvIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes pvPhoto { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }
.pv-overlay { animation: pvIn .2s ease both; }
.pv-photo { animation: pvPhoto .25s cubic-bezier(.22,1,.36,1) both; }
@media (prefers-reduced-motion: reduce) { .pv-overlay, .pv-photo { animation: none; } }
`;

const arrow = d => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;

// Full-screen photo viewer: Escape or a click outside closes it, the arrows (and
// the arrow keys) move between photos. `photos` are { id, filePath } items.
export default function PhotoViewer({ photos, index, onIndex, onClose, caption, alt = 'Photo' }) {
  const many = photos.length > 1;
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      if (many && e.key === 'ArrowRight') onIndex((index + 1) % photos.length);
      if (many && e.key === 'ArrowLeft') onIndex((index - 1 + photos.length) % photos.length);
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [index, many, photos.length, onIndex, onClose]);

  const photo = photos[index];
  if (!photo) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label={alt}
      className="pv-overlay fixed inset-0 z-[70] flex items-center justify-center p-6"
      style={{ background: 'rgba(15,23,42,0.88)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
      onClick={e => { e.stopPropagation(); onClose(); }}>
      <style>{css}</style>
      <button type="button" onClick={onClose} aria-label="Close"
        className="absolute top-4 right-4 w-11 h-11 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors">
        {arrow('M6 18L18 6M6 6l12 12')}
      </button>
      {many && (
        <>
          <button type="button" aria-label="Previous photo" onClick={e => { e.stopPropagation(); onIndex((index - 1 + photos.length) % photos.length); }}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors">
            {arrow('M15 19l-7-7 7-7')}
          </button>
          <button type="button" aria-label="Next photo" onClick={e => { e.stopPropagation(); onIndex((index + 1) % photos.length); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors">
            {arrow('M9 5l7 7-7 7')}
          </button>
        </>
      )}
      <figure className="flex flex-col items-center max-w-full" onClick={e => e.stopPropagation()}>
        <img key={photo.id} src={mediaUrl(photo.filePath)} alt={alt}
          className="pv-photo max-w-full max-h-[78vh] rounded-xl shadow-2xl object-contain bg-white" />
        {(caption || many) && (
          <figcaption className="mt-3 px-3 py-1 rounded-full text-xs font-semibold text-white text-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
            {caption}{caption && many ? ' · ' : ''}{many ? `${index + 1} / ${photos.length}` : ''}
          </figcaption>
        )}
      </figure>
    </div>
  );
}
