import React, { useEffect, useRef, useState } from 'react';
import {
  CANTILAN_CENTER, MAP_STYLE_LABELS, YOU_ARE_HERE_HTML, addCantilanFocus, barangayAt, cantilanBounds,
  createBaseLayers, isInCantilan, loadCantilanBarangays, loadCantilanBoundary, lockToCantilan, pinIconHtml,
} from '../../data/cantilanMap';

const round = n => Math.round(n * 1e6) / 1e6;

const LIVE_TEXT = {
  searching: 'Finding where you are...',
  outside: "You're outside Cantilan right now, so your location isn't shown on this map.",
  denied: "Location is turned off for this site, so we can't show where you are. You can still tap the map.",
  unavailable: "We can't find your location right now. You can still tap the map.",
  unsupported: "This device can't share its location. You can still tap the map.",
};

// Optional map pin for a report. The map shows only Cantilan, has street and
// satellite views, and a live blue dot where the citizen is. The red report pin
// goes where they tap, or on their location with "Use my current location".
// `value` is { lat, lng, barangay } or null; `onChange` gets the new value (the
// barangay the pin is in comes from the PSA barangay boundaries).
export default function LocationPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState('');
  const [style, setStyle] = useState('street');
  const [live, setLive] = useState({ status: 'idle' });
  const boxRef = useRef(null);
  const leaflet = useRef({ L: null, map: null, marker: null, layers: null, focus: null, boundary: null, barangays: null, me: {} });
  const watchRef = useRef(null);
  const centeredRef = useRef(false);
  const styleRef = useRef(style);
  // The latest pin, for map event handlers set up when the map was created.
  const current = useRef(value);
  current.current = value;
  // Map handlers are set up once, so they call the latest onChange through this.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const report = (lat, lng, barangays) => onChangeRef.current({ lat: round(lat), lng: round(lng), barangay: barangayAt(barangays, lat, lng) });

  function drawPin(lat, lng) {
    const { L, map } = leaflet.current;
    if (!L || !map) return;
    if (leaflet.current.marker) {
      leaflet.current.marker.setLatLng([lat, lng]);
      return;
    }
    const icon = L.divIcon({ className: '', html: pinIconHtml(), iconSize: [28, 28], iconAnchor: [14, 32] });
    const marker = L.marker([lat, lng], { draggable: true, icon, keyboard: false }).addTo(map);
    marker.on('dragend', e => {
      const p = e.target.getLatLng();
      place(p.lat, p.lng, false);
    });
    leaflet.current.marker = marker;
  }

  function place(lat, lng, pan = true) {
    if (!isInCantilan(leaflet.current.boundary, lat, lng)) {
      setMessage('That spot is outside Cantilan. Please pin a place within the municipality.');
      const last = current.current;
      if (last) leaflet.current.marker?.setLatLng([last.lat, last.lng]);
      return;
    }
    setMessage('');
    report(lat, lng, leaflet.current.barangays);
    drawPin(lat, lng);
    if (pan) leaflet.current.map?.setView([lat, lng], Math.max(17, leaflet.current.map.getZoom()));
  }

  // ── Live location (the blue dot), while the map is open ──
  function showLiveLocation(pos) {
    const { L, map, boundary } = leaflet.current;
    if (!L || !map) return;
    const { latitude: lat, longitude: lng, accuracy } = pos.coords;
    const me = leaflet.current.me;
    if (!isInCantilan(boundary, lat, lng)) {
      me.dot?.remove();
      me.ring?.remove();
      leaflet.current.me = {};
      setLive({ status: 'outside' });
      return;
    }
    if (!me.dot) {
      me.ring = L.circle([lat, lng], {
        radius: accuracy, color: '#2563eb', weight: 1, opacity: 0.35, fillColor: '#3b82f6', fillOpacity: 0.12, interactive: false,
      }).addTo(map);
      me.dot = L.marker([lat, lng], {
        icon: L.divIcon({ className: '', html: YOU_ARE_HERE_HTML, iconSize: [18, 18], iconAnchor: [9, 9] }),
        interactive: false, keyboard: false, zIndexOffset: -500,
      }).addTo(map);
    } else {
      me.dot.setLatLng([lat, lng]);
      me.ring.setLatLng([lat, lng]).setRadius(accuracy);
    }
    me.pos = { lat, lng };
    setLive({ status: 'on', accuracy: Math.round(accuracy) });
    // The first time, move the map to them (unless a report pin is already placed).
    if (!centeredRef.current) {
      centeredRef.current = true;
      if (!current.current) map.setView([lat, lng], 17);
    }
  }

  function startLiveLocation() {
    if (!navigator.geolocation) {
      setLive({ status: 'unsupported' });
      return;
    }
    centeredRef.current = false;
    setLive({ status: 'searching' });
    watchRef.current = navigator.geolocation.watchPosition(
      showLiveLocation,
      err => setLive(prev => (prev.status === 'on' && err.code !== 1 ? prev : { status: err.code === 1 ? 'denied' : 'unavailable' })),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 },
    );
  }

  function stopLiveLocation() {
    if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = null;
  }

  // The map is created when the panel opens and removed when it closes.
  useEffect(() => {
    if (!open || !boxRef.current) return undefined;
    let cancelled = false;
    Promise.all([import('leaflet'), loadCantilanBoundary(), loadCantilanBarangays()]).then(([{ default: L }, boundary, barangays]) => {
      if (cancelled || !boxRef.current) return;
      const start = current.current;
      const map = L.map(boxRef.current, {
        center: start ? [start.lat, start.lng] : CANTILAN_CENTER,
        zoom: start ? 17 : 12,
      });
      const layers = createBaseLayers(L);
      layers[styleRef.current].addTo(map);
      const focus = addCantilanFocus(L, map, boundary);
      focus.restyle(styleRef.current);
      map.on('click', e => place(e.latlng.lat, e.latlng.lng, false));
      leaflet.current = { L, map, marker: null, layers, focus, boundary, barangays, me: {} };
      if (start) drawPin(start.lat, start.lng);
      setTimeout(() => {
        if (cancelled) return;
        map.invalidateSize();
        lockToCantilan(L, map, boundary);
        // Until we know where they are, show the whole municipality.
        if (!start && !leaflet.current.me.pos) map.fitBounds(L.latLngBounds(cantilanBounds(boundary, 0)));
      }, 120);
      startLiveLocation();
    });
    return () => {
      cancelled = true;
      stopLiveLocation();
      leaflet.current.map?.remove();
      leaflet.current = { L: null, map: null, marker: null, layers: null, focus: null, boundary: null, barangays: null, me: {} };
      setLive({ status: 'idle' });
    };
  }, [open]); // Opening and closing rebuilds the map; pin changes are drawn directly.

  // Street / satellite.
  useEffect(() => {
    styleRef.current = style;
    const { map, layers, focus } = leaflet.current;
    if (!map || !layers) return;
    for (const [key, layer] of Object.entries(layers)) {
      if (key === style) { if (!map.hasLayer(layer)) layer.addTo(map); }
      else if (map.hasLayer(layer)) map.removeLayer(layer);
    }
    focus?.restyle(style);
  }, [style]);

  function showWhereIAm() {
    const { map, me } = leaflet.current;
    if (map && me.pos) map.setView([me.pos.lat, me.pos.lng], Math.max(17, map.getZoom()));
    else if (live.status === 'outside') setMessage(LIVE_TEXT.outside);
    else if (live.status === 'denied') setMessage('Turn on location for this site in your browser settings to see where you are.');
  }

  async function locateMe() {
    setMessage('');
    // The live dot already knows where they are.
    const me = leaflet.current.me;
    if (leaflet.current.map && me.pos) {
      place(me.pos.lat, me.pos.lng);
      return;
    }
    if (!navigator.geolocation) {
      setOpen(true);
      setMessage("This device can't share its location. Tap the map to place the pin instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const [boundary, barangays] = await Promise.all([loadCantilanBoundary(), loadCantilanBarangays()]);
        setLocating(false);
        const { latitude, longitude } = pos.coords;
        if (!isInCantilan(boundary, latitude, longitude)) {
          setOpen(true);
          setMessage('You seem to be outside Cantilan right now. Tap the map where the problem is instead.');
          return;
        }
        if (leaflet.current.map) place(latitude, longitude);
        else {
          report(latitude, longitude, barangays);
          setOpen(true);
        }
      },
      err => {
        setLocating(false);
        setOpen(true);
        setMessage(err.code === 1
          ? 'Location access was not allowed. Tap the map to place the pin instead.'
          : "We couldn't get your location. Tap the map to place the pin instead.");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }, // always a fresh fix, not an old one
    );
  }

  function removePin() {
    leaflet.current.marker?.remove();
    leaflet.current.marker = null;
    onChangeRef.current(null);
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Pin the location <span className="font-normal text-gray-500">(optional)</span></label>
      <p className="text-xs text-gray-500 mb-2">Helps the office find the exact spot. Use your phone's location if you're there now, or tap the map.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={locateMe} disabled={locating}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold text-white bg-primary hover:bg-blue-700 transition-colors disabled:opacity-60">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /><circle cx="12" cy="12" r="7" />
          </svg>
          {locating ? 'Finding your location...' : 'Use my current location'}
        </button>
        <button type="button" onClick={() => setOpen(o => !o)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 20l-6-3V4l6 3 6-3 6 3v13l-6-3-6 3z" /><path d="M9 7v13M15 4v13" />
          </svg>
          {open ? 'Hide map' : 'Pin on the map'}
        </button>
      </div>

      {message && <p className="mt-2 text-xs font-medium text-amber-700" role="status">{message}</p>}

      {open && (
        <>
          <div className="relative mt-3">
            {/* Height set inline: index.css gives every .leaflet-container height:100%
                (for the full-page admin map), which would flatten this box on phones. */}
            <div ref={boxRef} className="relative z-0 w-full rounded-xl border border-gray-200 overflow-hidden"
              style={{ height: '18rem' }} aria-label="Map of Cantilan. Tap to place the pin." />

            {/* Street / satellite, and "where am I" (above the map) */}
            <div className="absolute top-2 right-2 z-10 flex flex-col items-end gap-2">
              <div className="flex rounded-lg overflow-hidden shadow-md border border-gray-200 bg-white" role="group" aria-label="Map view">
                {Object.entries(MAP_STYLE_LABELS).map(([key, label]) => (
                  <button key={key} type="button" onClick={() => setStyle(key)} aria-pressed={style === key}
                    className={`px-2.5 py-1.5 text-xs font-semibold transition-colors ${style === key ? 'text-white' : 'text-gray-700 hover:bg-gray-50'}`}
                    style={style === key ? { background: '#2563eb' } : undefined}>
                    {label}
                  </button>
                ))}
              </div>
              <button type="button" onClick={showWhereIAm} disabled={live.status !== 'on'}
                aria-label="Show where I am" title="Show where I am"
                className="w-9 h-9 rounded-lg bg-white border border-gray-200 shadow-md flex items-center justify-center text-blue-600 hover:bg-blue-50 disabled:text-gray-300 disabled:hover:bg-white transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" fill="currentColor" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /><circle cx="12" cy="12" r="7" />
                </svg>
              </button>
            </div>
          </div>

          <p className="mt-1.5 text-xs text-gray-500" aria-live="polite">
            {live.status === 'on'
              ? <><span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-600 align-middle mr-1.5" aria-hidden="true" />The blue dot shows where you are (about ±{live.accuracy} m).</>
              : LIVE_TEXT[live.status] || ''}
            {!value && <> Tap the map where the problem is; you can drag the red pin to adjust it.</>}
          </p>
        </>
      )}

      {value && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="inline-flex items-center gap-1 font-semibold text-green-700">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            Location pinned{value.barangay ? ` · Barangay ${value.barangay}` : ''}
          </span>
          <span className="text-gray-500 tabular-nums">{value.lat.toFixed(5)}, {value.lng.toFixed(5)}</span>
          <button type="button" onClick={removePin} className="font-semibold text-red-600 hover:underline">Remove pin</button>
        </div>
      )}
    </div>
  );
}
