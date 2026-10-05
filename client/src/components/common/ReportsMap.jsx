import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Skel } from './Skeleton';
import {
  CANTILAN_CENTER, MAP_STYLE_LABELS, addCantilanFocus, cantilanBounds, createBaseLayers, loadCantilanBoundary, lockToCantilan,
} from '../../data/cantilanMap';

// The report map used by the admin Map View and the staff Office Map: Cantilan only,
// street or satellite, one 3D pin per pinned report, filters and a legend. Each page
// loads its own reports and says where a pin's "open" link leads.

// Report text comes from the public, so it is escaped before going into map HTML.
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ── Color maps ──────────────────────────────────────────────────────────────
const TYPE_COLORS = {
  COMPLAINT:  { fill: '#ef4444', border: '#b91c1c', badge: '#fee2e2', text: '#991b1b' },
  SUGGESTION: { fill: '#3b82f6', border: '#1d4ed8', badge: '#dbeafe', text: '#1e40af' },
  FEEDBACK:   { fill: '#22c55e', border: '#15803d', badge: '#dcfce7', text: '#166534' },
};

const STATUS_COLORS = {
  PENDING:     '#6B7280',
  REVIEWING:   '#1D4ED8',
  IN_PROGRESS: '#CA8A04',
  RESOLVED:    '#16A34A',
};

// 3D pin images, one color per report type (Microsoft Fluent Emoji "Round
// pushpin", MIT License, recolored).
const PIN_IMAGES = {
  COMPLAINT:  `${process.env.PUBLIC_URL}/map-pins/pin-complaint.png`,
  SUGGESTION: `${process.env.PUBLIC_URL}/map-pins/pin-suggestion.png`,
  FEEDBACK:   `${process.env.PUBLIC_URL}/map-pins/pin-feedback.png`,
};

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// The page scrolls past the map, so the map only takes gestures meant for it.
const isTouchScreen = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
const ZOOM_HINT = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '')
  ? 'Hold ⌘ and scroll to zoom the map'
  : 'Hold Ctrl and scroll to zoom the map';
const MOVE_HINT = 'Use two fingers to move the map';

// The pin's HTML (styles in index.css, .cvx-pin). Its point is at (90, 74).
function pinHtml(s, index) {
  const c = TYPE_COLORS[s.type] || TYPE_COLORS.COMPLAINT;
  const open = s.status !== 'RESOLVED';
  const urgent = open && s.priority === 'URGENT';
  const typeCap = s.type.charAt(0) + s.type.slice(1).toLowerCase();
  const vars = `--pin:${c.fill};--pin-soft:${c.fill}33;--status:${STATUS_COLORS[s.status] || '#6B7280'};--delay:${Math.min(index, 20) * 60}ms`;
  return `
    <div class="cvx-pin${urgent ? ' is-urgent' : ''}" style="${vars}">
      ${open ? '<span class="cvx-pin-pulse"></span><span class="cvx-pin-pulse is-late"></span>' : ''}
      <span class="cvx-pin-shadow"></span><span class="cvx-pin-contact"></span>
      <div class="cvx-pin-drop"><div class="cvx-pin-lift">
        <div class="cvx-pin-label"><i></i>${typeCap} · ${escapeHtml(s.trackingId)}</div>
        <img class="cvx-pin-img" src="${PIN_IMAGES[s.type] || PIN_IMAGES.COMPLAINT}" alt="" draggable="false">
        <span class="cvx-pin-status"></span>
      </div></div>
    </div>`;
}

// ── Helper: build popup HTML ──────────────────────────────────────────────────
function buildPopup(s, { title, href, openLabel }) {
  const typeColor = TYPE_COLORS[s.type] || TYPE_COLORS.COMPLAINT;
  const statusColor = STATUS_COLORS[s.status] || '#6B7280';
  const typeCap = s.type.charAt(0) + s.type.slice(1).toLowerCase();
  const statusLabel = s.status.replace(/_/g, ' ');
  const description = s.description.length > 120 ? `${s.description.slice(0, 120)}…` : s.description;
  const { latitude, longitude } = s.location;

  return `
    <div style="font-family:system-ui,sans-serif;min-width:240px;max-width:280px;line-height:1.5">
      <p style="font-family:monospace;font-size:11px;color:#475569;margin:0 0 4px">${escapeHtml(s.trackingId)}</p>
      <p style="font-size:14px;font-weight:700;color:#0f172a;margin:0 0 2px">${escapeHtml(title)}</p>
      <p style="font-size:12px;color:#475569;margin:0 0 8px">
        <span style="font-weight:600;color:#374151">${escapeHtml(s.user?.fullName || 'Citizen')}</span>
        ${s.address ? `<br>${escapeHtml(s.address)}` : ''}
      </p>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
        <span style="background:${typeColor.badge};color:${typeColor.text};padding:2px 9px;border-radius:999px;font-size:11px;font-weight:600">${typeCap}</span>
        <span style="background:${statusColor}1a;color:${statusColor};padding:2px 9px;border-radius:999px;font-size:11px;font-weight:600;border:1px solid ${statusColor}44">${statusLabel}</span>
      </div>
      <p style="font-size:12px;color:#475569;margin:0 0 8px;border-top:1px solid #f1f5f9;padding-top:8px">
        ${escapeHtml(description)}
      </p>
      <a href="${escapeHtml(href)}" data-open-report="${escapeHtml(s.id)}" style="display:inline-block;font-size:12px;color:#1D4ED8;font-weight:600;text-decoration:none">${escapeHtml(openLabel)} →</a>
      <a href="https://www.google.com/maps?q=${latitude},${longitude}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-left:12px;font-size:12px;color:#475569;font-weight:600;text-decoration:none">Google Maps ↗</a>
    </div>
  `;
}

// `reportHref(report)` is the "open" link's address; `onOpenReport(report)` handles a
// normal click on it (in-app navigation). `popupTitle(report)` is the popup heading.
export default function ReportsMap({
  reports, loading, title, subtitle, emptyHint,
  reportHref, onOpenReport, popupTitle = s => s.department || s.citizenDepartment, openLabel = 'View details',
}) {
  const mapRef          = useRef(null);
  const mapInstanceRef  = useRef(null);
  const markersLayerRef = useRef(null);
  const baseLayerRef    = useRef(null);   // { street, satellite } base maps
  const focusRef        = useRef(null);   // Cantilan border + dimmed outside
  const boundaryRef     = useRef(null);
  const reportsRef      = useRef([]);
  const openRef         = useRef(onOpenReport);
  openRef.current = onOpenReport;

  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter,   setTypeFilter]   = useState('ALL');
  const [mapStyle, setMapStyle] = useState('street');
  // Leaflet loads after the first render; tiles and pins wait for it.
  const [mapReady, setMapReady] = useState(false);
  // A short note on how to zoom or move the map, shown when a gesture scrolls the page.
  const [hint, setHint] = useState(null);
  const hintTimer = useRef(null);
  const showHint = useRef(null);
  showHint.current = text => {
    setHint(text);
    clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHint(null), 1600);
  };
  useEffect(() => () => clearTimeout(hintTimer.current), []);

  const matching = useMemo(() => reports.filter(s => {
    if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
    if (typeFilter   !== 'ALL' && s.type   !== typeFilter)   return false;
    return true;
  }), [reports, statusFilter, typeFilter]);
  // Only reports the citizen pinned are placed on the map; the rest are counted.
  const filtered = useMemo(() => matching.filter(s => s.location), [matching]);
  const unpinned = matching.length - filtered.length;
  reportsRef.current = filtered;

  // ── Init map ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (loading || !mapRef.current) return;
    let cancelled = false;

    async function initMap() {
      const [L, boundary] = await Promise.all([import('leaflet'), loadCantilanBoundary()]);
      if (cancelled || !mapRef.current) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersLayerRef.current = null;
        baseLayerRef.current = null;
      }
      if (mapRef.current._leaflet_id) mapRef.current._leaflet_id = null;

      const touch = isTouchScreen();
      // On touch screens one finger scrolls the page; two fingers move and zoom the map.
      // Phones don't use the arrow keys, so the map doesn't take keyboard focus there.
      const map = L.default.map(mapRef.current, { center: CANTILAN_CENTER, zoom: 12, dragging: !touch, keyboard: !touch });
      baseLayerRef.current = createBaseLayers(L.default);
      focusRef.current = addCantilanFocus(L.default, map, boundary);
      boundaryRef.current = boundary;

      mapInstanceRef.current  = map;
      markersLayerRef.current = L.default.layerGroup().addTo(map);

      // The popup's "open" link stays in the app instead of reloading the page
      // (new-tab clicks still use the link's address).
      map.on('popupopen', e => {
        const link = e.popup.getElement()?.querySelector('[data-open-report]');
        if (!link) return;
        link.addEventListener('click', ev => {
          if (ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey || !openRef.current) return;
          const report = reportsRef.current.find(r => r.id === link.getAttribute('data-open-report'));
          if (!report) return;
          ev.preventDefault();
          openRef.current(report);
        });
      });

      // The mouse wheel scrolls the page; with Ctrl (⌘ on a Mac) held it zooms the map.
      // Runs before Leaflet's own wheel handler and stops it unless the key is held.
      const box = map.getContainer();
      box.addEventListener('wheel', e => {
        if (e.ctrlKey || e.metaKey) return;
        e.stopImmediatePropagation();
        showHint.current(ZOOM_HINT);
      }, { capture: true });
      if (touch) {
        box.addEventListener('touchmove', e => {
          if (e.touches.length === 1) showHint.current(MOVE_HINT);
        }, { passive: true });
      }

      // Leaflet focuses the map on mousedown (for the arrow keys). Focus without
      // scrolling, or the page would jump to show the whole map and the click or tap
      // would land on something else.
      box.focus = options => HTMLElement.prototype.focus.call(box, { ...options, preventScroll: true });

      // The map's size is known once it's on screen: keep it to Cantilan from then on.
      setTimeout(() => {
        if (cancelled) return;
        map.invalidateSize();
        lockToCantilan(L.default, map, boundary);
        setMapReady(true);
      }, 100);
    }

    initMap();
    return () => {
      cancelled = true;
      setMapReady(false);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersLayerRef.current = null;
        baseLayerRef.current = null;
        focusRef.current = null;
      }
    };
  }, [loading]);

  // ── Street / satellite ─────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layers = baseLayerRef.current;
    if (!map || !layers) return;
    for (const [key, layer] of Object.entries(layers)) {
      if (key === mapStyle) { if (!map.hasLayer(layer)) layer.addTo(map); }
      else if (map.hasLayer(layer)) map.removeLayer(layer);
    }
    focusRef.current?.restyle(mapStyle);
  }, [mapStyle, mapReady]);

  // ── Render markers whenever filter or data changes ────────────────────────
  useEffect(() => {
    const map   = mapInstanceRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    import('leaflet').then(L => {
      layer.clearLayers();

      filtered.forEach((s, index) => {
        const latlng = L.default.latLng(s.location.latitude, s.location.longitude);

        const icon = L.default.divIcon({
          className: 'cvx-pin-icon', html: pinHtml(s, index),
          iconSize: [180, 80], iconAnchor: [90, 74],
        });
        const popup = L.default.popup({ maxWidth: 300, offset: [0, -72] })
          .setContent(buildPopup(s, { title: popupTitle(s), href: reportHref(s), openLabel }));
        const marker = L.default.marker(latlng, {
          icon, riseOnHover: true, title: `${s.type.charAt(0) + s.type.slice(1).toLowerCase()} ${s.trackingId}`,
        });

        // Glide to the pin, then show its details.
        marker.on('click', () => {
          const zoom = Math.max(map.getZoom(), 17);
          const show = () => popup.setLatLng(latlng).openOn(map);
          const there = map.getZoom() >= zoom && map.getCenter().distanceTo(latlng) < 40;
          if (reducedMotion() || there) {
            if (!there) map.setView(latlng, zoom, { animate: false });
            show();
            return;
          }
          map.once('moveend', show);
          map.flyTo(latlng, zoom, { duration: 0.9 });
        });
        marker.addTo(layer);
      });

      if (filtered.length > 0) {
        const bounds = L.default.latLngBounds(filtered.map(s => [s.location.latitude, s.location.longitude]));
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 17 });
      } else if (boundaryRef.current) {
        map.fitBounds(L.default.latLngBounds(cantilanBounds(boundaryRef.current, 0)));
      }

      map.invalidateSize();
    });
    // popupTitle/reportHref/openLabel are fixed per page.
  }, [filtered, mapReady]);

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    // At least the screen's height (the map takes what the header leaves), taller
    // only when the screen is too short for the map's minimum.
    <div className="flex flex-col grow shrink-0">

      {/* ── Header bar ── */}
      <div className="px-4 sm:px-6 py-4 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 flex-shrink-0">
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">

          <div className="lg:w-80 flex-shrink-0">
            <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">{title}</h1>
            {subtitle && <p className="text-sm text-gray-600 dark:text-slate-300 mt-0.5">{subtitle}</p>}
            <p className="text-sm text-gray-600 dark:text-slate-300 mt-0.5">
              {filtered.length} pinned report{filtered.length !== 1 ? 's' : ''} shown
              {unpinned > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 text-xs rounded-full"
                  title="The citizen did not pin these on the map, so they can't be placed.">
                  {unpinned} without a pin, not shown
                </span>
              )}
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            {/* Map style toggle */}
            <div className="flex rounded-lg border border-gray-200 dark:border-slate-600 overflow-hidden">
              {Object.entries(MAP_STYLE_LABELS).map(([key, label]) => (
                <button key={key} type="button" onClick={() => setMapStyle(key)} aria-pressed={mapStyle === key}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    mapStyle === key ? 'text-white' : 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700'
                  }`}
                  style={mapStyle === key ? { background: '#2563eb' } : undefined}>
                  {label}
                </button>
              ))}
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label="Status"
              className="px-3 py-1.5 border border-gray-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="ALL">All statuses</option>
              {Object.keys(STATUS_COLORS).map(s => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} aria-label="Type of report"
              className="px-3 py-1.5 border border-gray-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="ALL">All types</option>
              <option value="COMPLAINT">Complaint</option>
              <option value="SUGGESTION">Suggestion</option>
              <option value="FEEDBACK">Feedback</option>
            </select>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 text-xs">
            {Object.entries(TYPE_COLORS).map(([type, c]) => (
              <div key={type} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full border-2 border-white dark:border-slate-800 shadow-sm" style={{ background: c.fill }} />
                <span className="text-gray-700 dark:text-slate-300 font-medium">{type.charAt(0) + type.slice(1).toLowerCase()}</span>
              </div>
            ))}
            <div className="w-px bg-gray-200 dark:bg-slate-600 mx-1" />
            {Object.entries(STATUS_COLORS).map(([status, color]) => (
              <div key={status} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                <span className="text-gray-600 dark:text-slate-300">{status.replace(/_/g, ' ')}</span>
              </div>
            ))}
            <span className="w-full text-gray-600 dark:text-slate-300">
              Small dot on a pin = its status. Pulsing pins are still open; red pulse = urgent.
            </span>
          </div>
        </div>
      </div>

      {/* ── Map or loading ── */}
      {loading ? (
        <div className="p-4 h-[calc(100vh-4rem)] supports-[height:100dvh]:h-[calc(100dvh-4rem)] min-h-[360px]">
          <Skel className="w-full h-full rounded-xl" />
        </div>
      ) : (
        <div className="relative w-full h-[calc(100vh-4rem)] supports-[height:100dvh]:h-[calc(100dvh-4rem)] min-h-[360px]">
          <div ref={mapRef} className="absolute inset-0 z-0" />
          {hint && (
            <div className="absolute inset-0 z-[900] flex items-center justify-center px-4 pointer-events-none" role="status">
              <div className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white text-center shadow-lg" style={{ background: 'rgba(15,23,42,0.82)' }}>
                {hint}
              </div>
            </div>
          )}
          {filtered.length === 0 && (
            <div className="absolute inset-x-0 top-6 z-10 flex justify-center px-4 pointer-events-none">
              <div className="max-w-md rounded-xl bg-white/95 dark:bg-slate-800/95 border border-gray-200 dark:border-slate-600 shadow-lg px-5 py-4 text-center">
                <p className="text-sm font-semibold text-gray-800 dark:text-slate-100">
                  {matching.length ? 'None of these reports has a map pin' : 'No pinned reports yet'}
                </p>
                <p className="text-xs text-gray-600 dark:text-slate-300 mt-1">{emptyHint}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
