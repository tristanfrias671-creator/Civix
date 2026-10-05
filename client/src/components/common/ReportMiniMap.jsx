import React, { useEffect, useRef, useState } from 'react';

// A small, still street map of the spot a citizen pinned, with the same 3D pin
// as the admin Map View. The OpenStreetMap tiles are painted into one canvas at
// whole pixels, so no seams show between them, and a swipe over it scrolls the
// page instead of dragging a map. Tapping it opens the spot in Google Maps.

const TILE = 256;
const ZOOM = 17;
const PIN_FILES = { COMPLAINT: 'pin-complaint', SUGGESTION: 'pin-suggestion', FEEDBACK: 'pin-feedback' };
const pinUrl = type => `${process.env.PUBLIC_URL}/map-pins/${PIN_FILES[type] || PIN_FILES.COMPLAINT}.png`;

// Where a spot falls on the world map at a zoom level, in tile pixels (Web Mercator).
function project(lat, lng, zoom) {
  const size = TILE * 2 ** zoom;
  const sin = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * size,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size,
  };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export default function ReportMiniMap({ latitude, longitude, type, height = '12rem' }) {
  const boxRef = useRef(null);
  const canvasRef = useRef(null);
  const [state, setState] = useState('loading'); // 'loading' | 'ready' | 'failed'

  useEffect(() => {
    const box = boxRef.current;
    const canvas = canvasRef.current;
    if (!box || !canvas) return undefined;
    let latest = 0;
    let timer = null;

    async function draw() {
      const run = ++latest;
      const width = box.clientWidth;
      const tall = box.clientHeight;
      if (!width || !tall) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      // Tiles at their normal size on screen, so street names stay easy to read.
      const zoom = ZOOM;
      const scale = dpr; // canvas pixels per tile pixel
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(tall * dpr);
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.fillStyle = '#e5e7eb';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centre = project(latitude, longitude, zoom);
      const viewW = canvas.width / scale;
      const viewH = canvas.height / scale;
      const left = centre.x - viewW / 2;
      const top = centre.y - viewH / 2;
      const tiles = [];
      for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + viewW) / TILE); tx++) {
        for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + viewH) / TILE); ty++) tiles.push({ tx, ty });
      }
      const loaded = await Promise.allSettled(tiles.map(t =>
        loadImage(`https://tile.openstreetmap.org/${zoom}/${t.tx}/${t.ty}.png`).then(img => ({ ...t, img }))));
      if (run !== latest) return;
      let drawn = 0;
      for (const result of loaded) {
        if (result.status !== 'fulfilled') continue;
        const { tx, ty, img } = result.value;
        // Every edge on a whole canvas pixel, so neighbouring tiles meet exactly.
        const x0 = Math.round((tx * TILE - left) * scale);
        const y0 = Math.round((ty * TILE - top) * scale);
        const x1 = Math.round(((tx + 1) * TILE - left) * scale);
        const y1 = Math.round(((ty + 1) * TILE - top) * scale);
        ctx.drawImage(img, x0, y0, x1 - x0, y1 - y0);
        drawn += 1;
      }
      if (!drawn) { setState('failed'); return; }

      // The pin's point (50% across, 93% down the image) sits on the spot.
      const pin = await loadImage(pinUrl(type)).catch(() => null);
      if (run !== latest) return;
      if (pin) {
        const size = Math.round(44 * dpr);
        ctx.drawImage(pin, Math.round(canvas.width / 2 - size * 0.5), Math.round(canvas.height / 2 - size * 0.933), size, size);
      }
      setState('ready');
    }

    // Draws now, and again if the box changes width (e.g. a phone turned sideways).
    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(draw, 120);
    });
    observer.observe(box);
    return () => {
      latest += 1;
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [latitude, longitude, type]);

  const googleMaps = `https://www.google.com/maps?q=${latitude},${longitude}`;
  return (
    <div ref={boxRef} data-map-state={state}
      className="relative w-full rounded-xl overflow-hidden border border-gray-200" style={{ height, background: '#e5e7eb' }}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" aria-hidden="true" />
      <a href={googleMaps} target="_blank" rel="noopener noreferrer" className="absolute inset-0"
        aria-label="Map of the spot the citizen pinned. Open it in Google Maps." />
      {state === 'failed' && (
        <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm pointer-events-none" style={{ color: '#374151' }}>
          The map could not load. Use the Google Maps button below.
        </p>
      )}
      <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer"
        className="absolute bottom-0 right-0 px-1.5 py-0.5 text-[11px] rounded-tl-md hover:underline"
        style={{ background: 'rgba(255,255,255,0.88)', color: '#334155' }}>
        © OpenStreetMap contributors
      </a>
    </div>
  );
}
