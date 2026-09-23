import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Skel } from '../../components/common/Skeleton';
import api from '../../utils/api';

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

// ── Map config ───────────────────────────────────────────────────────────────
const DEFAULT_CENTER = [9.332, 125.978];
const DEFAULT_ZOOM   = 16;
const MIN_ZOOM       = 15;
const MAX_BOUNDS     = [[9.322, 125.960], [9.340, 125.990]];

// ── Base map styles ────────────────────────────────────────────────────────
const MAP_STYLES = {
  satellite: {
    label: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics',
    maxZoom: 19,
  },
  street: {
    label: 'Street',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  },
};

// ── Sample demo submissions (shown when no real geotagged data exists) ───────
const DEMO_SUBMISSIONS = [
  { id: 'd1', trackingId: 'DEMO-001', type: 'COMPLAINT',  department: 'Municipal Engineering Office', status: 'PENDING',     description: 'Broken streetlight on Ortiz Street near the plaza. Has been out for two weeks.', user: { fullName: 'Juan dela Cruz' },   location: { latitude: 9.332, longitude: 125.975 } },
  { id: 'd2', trackingId: 'DEMO-002', type: 'FEEDBACK',   department: 'Municipal Health Office',      status: 'RESOLVED',    description: 'The health center staff were very helpful during my check-up. Great service!',   user: { fullName: 'Maria Clara' },      location: { latitude: 9.335, longitude: 125.980 } },
  { id: 'd3', trackingId: 'DEMO-003', type: 'SUGGESTION', department: 'Municipal Engineering Office', status: 'REVIEWING',   description: 'Suggest adding more pedestrian crossings along the Coastal Road near Pag-Antayan.', user: { fullName: 'Crisostomo Ibarra' }, location: { latitude: 9.327, longitude: 125.974 } },
  { id: 'd4', trackingId: 'DEMO-004', type: 'COMPLAINT',  department: 'Municipal Health Office',      status: 'IN_PROGRESS', description: 'Stagnant water near the elementary school poses a dengue risk. Needs drainage.', user: { fullName: 'Sisa Reyes' },        location: { latitude: 9.336, longitude: 125.977 } },
  { id: 'd5', trackingId: 'DEMO-005', type: 'SUGGESTION', department: "Mayor's Office – CRMO",        status: 'PENDING',     description: 'Add more benches and shade around the town plaza for elderly residents.',         user: { fullName: 'Tasyo Santos' },     location: { latitude: 9.333, longitude: 125.982 } },
  { id: 'd6', trackingId: 'DEMO-006', type: 'FEEDBACK',   department: 'Traffic',                      status: 'RESOLVED',    description: 'Traffic enforcers are doing a great job near the market area every morning.',     user: { fullName: 'Elias Florendo' },   location: { latitude: 9.329, longitude: 125.979 } },
];

// ── Helper: build the DivIcon with colored pin + label ───────────────────────
function createDivIcon(L, type, submitterName) {
  const c = TYPE_COLORS[type] || TYPE_COLORS.COMPLAINT;
  const label = `${type.charAt(0) + type.slice(1).toLowerCase()} — ${submitterName}`;

  const html = `
    <div style="display:flex;flex-direction:column;align-items:center;pointer-events:none">
      <div style="
        background:white;
        border:1px solid #e2e8f0;
        border-radius:5px;
        padding:3px 7px;
        font-size:11px;
        font-weight:600;
        color:#1e293b;
        white-space:nowrap;
        box-shadow:0 2px 6px rgba(0,0,0,0.12);
        margin-bottom:4px;
        font-family:system-ui,sans-serif;
        line-height:1.4;
      ">
        <span style="
          display:inline-block;
          width:7px;height:7px;
          border-radius:50%;
          background:${c.fill};
          margin-right:5px;
          vertical-align:middle;
        "></span>${label}
      </div>
      <div style="
        width:14px;height:14px;
        border-radius:50%;
        background:${c.fill};
        border:2.5px solid white;
        box-shadow:0 2px 8px rgba(0,0,0,0.30);
      "></div>
      <div style="
        width:2px;height:6px;
        background:${c.fill};
        opacity:.7;
      "></div>
    </div>
  `;

  return L.default.divIcon({
    className: '',
    html,
    iconSize:   [160, 46],
    iconAnchor: [80, 46],
    popupAnchor:[0, -48],
  });
}

// ── Helper: build popup HTML ──────────────────────────────────────────────────
function buildPopup(s, typeColor, statusColor, hasGPS = true) {
  const typeCap = s.type.charAt(0) + s.type.slice(1).toLowerCase();
  const statusLabel = s.status.replace(/_/g, ' ');
  const isDemo = s.id.toString().startsWith('d');

  return `
    <div style="font-family:system-ui,sans-serif;min-width:240px;max-width:280px;line-height:1.5">
      ${isDemo ? `<div style="background:#fef9c3;border:1px solid #fde047;border-radius:4px;padding:3px 8px;font-size:10px;font-weight:600;color:#854d0e;margin-bottom:8px">Demo Data</div>` : ''}
      ${!hasGPS && !isDemo ? `<div style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:4px;padding:3px 8px;font-size:10px;color:#64748b;margin-bottom:8px">📍 No GPS — shown at approximate location</div>` : ''}
      <p style="font-family:monospace;font-size:10px;color:#94a3b8;margin:0 0 4px">${s.trackingId}</p>
      <p style="font-size:14px;font-weight:700;color:#0f172a;margin:0 0 2px">${s.department || s.citizenDepartment}</p>
      <p style="font-size:12px;color:#64748b;margin:0 0 8px">
        <span style="font-weight:600;color:#374151">${s.user?.fullName || 'Citizen'}</span>
      </p>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
        <span style="background:${typeColor.badge};color:${typeColor.text};padding:2px 9px;border-radius:999px;font-size:11px;font-weight:600">${typeCap}</span>
        <span style="background:${statusColor}1a;color:${statusColor};padding:2px 9px;border-radius:999px;font-size:11px;font-weight:600;border:1px solid ${statusColor}44">${statusLabel}</span>
      </div>
      <p style="font-size:12px;color:#475569;margin:0 0 8px;border-top:1px solid #f1f5f9;padding-top:8px">
        ${s.description.slice(0, 120)}${s.description.length > 120 ? '…' : ''}
      </p>
      ${!isDemo ? `<a href="/admin/submissions/${s.id}" style="display:inline-block;font-size:12px;color:#1D4ED8;font-weight:600;text-decoration:none">View details →</a>` : ''}
    </div>
  `;
}

// ════════════════════════════════════════════════════════════════════════════
export default function MapView() {
  const mapRef          = useRef(null);
  const mapInstanceRef  = useRef(null);
  const markersLayerRef = useRef(null);
  const baseLayerRef    = useRef(null);

  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter,   setTypeFilter]   = useState('ALL');
  const [mapStyle, setMapStyle] = useState('street');

  useEffect(() => {
    api.get('/submissions?limit=500')
      .then(r => {
        // Keep ALL submissions — those without GPS get a default center position
        setSubmissions(r.data.submissions);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Use real data if available, otherwise fall back to demo submissions
  const sourceData = submissions.length > 0 ? submissions : DEMO_SUBMISSIONS;
  const isDemo     = submissions.length === 0;

  const filtered = useMemo(() => sourceData.filter(s => {
    if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
    if (typeFilter   !== 'ALL' && s.type   !== typeFilter)   return false;
    return true;
  }), [sourceData, statusFilter, typeFilter, isDemo]);

  // ── Init map ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (loading || !mapRef.current) return;
    let cancelled = false;

    async function initMap() {
      const L = await import('leaflet');
      if (cancelled || !mapRef.current) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersLayerRef.current = null;
        baseLayerRef.current = null;
      }
      if (mapRef.current._leaflet_id) mapRef.current._leaflet_id = null;

      const map = L.default.map(mapRef.current, {
        center: DEFAULT_CENTER,
        zoom:   DEFAULT_ZOOM,
        minZoom: MIN_ZOOM,
        maxBounds: L.default.latLngBounds(MAX_BOUNDS),
        maxBoundsViscosity: 1.0,
      });

      mapInstanceRef.current  = map;
      markersLayerRef.current = L.default.layerGroup().addTo(map);
      setTimeout(() => map.invalidateSize(), 100);
    }

    initMap();
    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersLayerRef.current = null;
        baseLayerRef.current = null;
      }
    };
  }, [loading]);

  // ── Swap base tiles when the style toggle changes ──────────────────────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    import('leaflet').then(L => {
      if (baseLayerRef.current) map.removeLayer(baseLayerRef.current);
      const style = MAP_STYLES[mapStyle];
      const tiles = L.default.tileLayer(style.url, { attribution: style.attribution, maxZoom: style.maxZoom }).addTo(map);
      baseLayerRef.current = tiles;
    });
  }, [mapStyle, loading]);

  // ── Render markers whenever filter or data changes ────────────────────────
  useEffect(() => {
    const map   = mapInstanceRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    import('leaflet').then(L => {
      layer.clearLayers();

      filtered.forEach((s, idx) => {
        const hasGPS = !!s.location;

        // For submissions without GPS, scatter them near the town center so they're visible
        const lat = hasGPS
          ? s.location.latitude
          : DEFAULT_CENTER[0] + (Math.sin(idx * 2.4) * 0.0018);
        const lng = hasGPS
          ? s.location.longitude
          : DEFAULT_CENTER[1] + (Math.cos(idx * 2.4) * 0.0018);

        const typeColor   = TYPE_COLORS[s.type]   || TYPE_COLORS.COMPLAINT;
        const statusColor = STATUS_COLORS[s.status] || '#6B7280';

        // Dashed border style for no-GPS markers
        const borderStyle = hasGPS
          ? `border:2.5px solid white`
          : `border:2.5px dashed white;opacity:0.75`;

        const html = `
          <div style="display:flex;flex-direction:column;align-items:center;pointer-events:none">
            <div style="
              background:white;border:1px solid #e2e8f0;border-radius:5px;
              padding:3px 7px;font-size:11px;font-weight:600;color:#1e293b;
              white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.12);
              margin-bottom:4px;font-family:system-ui,sans-serif;line-height:1.4;
              ${!hasGPS ? 'border-style:dashed;opacity:0.85;' : ''}
            ">
              <span style="display:inline-block;width:7px;height:7px;border-radius:50%;
                background:${typeColor.fill};margin-right:5px;vertical-align:middle"></span>
              ${s.type.charAt(0) + s.type.slice(1).toLowerCase()} — ${s.user?.fullName || 'Citizen'}
              ${!hasGPS ? ' <span style="color:#94a3b8;font-size:9px">(no GPS)</span>' : ''}
            </div>
            <div style="width:14px;height:14px;border-radius:50%;
              background:${typeColor.fill};${borderStyle};
              box-shadow:0 2px 8px rgba(0,0,0,0.25)"></div>
            <div style="width:2px;height:6px;background:${typeColor.fill};opacity:.6"></div>
          </div>`;

        const icon = L.default.divIcon({
          className: '', html,
          iconSize: [180, 46], iconAnchor: [90, 46], popupAnchor: [0, -48],
        });

        const popup = buildPopup(s, typeColor, statusColor, hasGPS);

        L.default.marker([lat, lng], { icon })
          .bindPopup(popup, { maxWidth: 300 })
          .addTo(layer);
      });

      const gpsOnly = filtered.filter(s => s.location);
      if (gpsOnly.length > 0) {
        const bounds = L.default.latLngBounds(
          gpsOnly.map(s => [s.location.latitude, s.location.longitude])
        );
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 17, minZoom: MIN_ZOOM });
      } else {
        map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      }

      map.invalidateSize();
    });
  }, [filtered]);

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full min-h-0">

      {/* ── Header bar ── */}
      <div className="px-6 py-4 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 flex-shrink-0">
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">

          <div>
            <h1 className="text-xl font-bold text-gray-800 dark:text-slate-100">Submission Map</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
              {filtered.length} submission{filtered.length !== 1 ? 's' : ''} shown
              {isDemo && <span className="ml-2 px-2 py-0.5 bg-yellow-100 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-400 text-xs font-semibold rounded-full">Demo data</span>}
              {!isDemo && filtered.filter(s => !s.location).length > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 text-xs rounded-full">
                  {filtered.filter(s => !s.location).length} without GPS
                </span>
              )}
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            {/* Map style toggle */}
            <div className="flex rounded-lg border border-gray-200 dark:border-slate-600 overflow-hidden">
              {Object.entries(MAP_STYLES).map(([key, s]) => (
                <button key={key} type="button" onClick={() => setMapStyle(key)}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    mapStyle === key ? 'text-white' : 'text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700'
                  }`}
                  style={mapStyle === key ? { background: '#2563eb' } : undefined}>
                  {s.label}
                </button>
              ))}
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="ALL">All statuses</option>
              {Object.keys(STATUS_COLORS).map(s => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
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
                <span className="text-gray-600 dark:text-slate-300 font-medium">{type.charAt(0) + type.slice(1).toLowerCase()}</span>
              </div>
            ))}
            <div className="w-px bg-gray-200 dark:bg-slate-600 mx-1" />
            {Object.entries(STATUS_COLORS).map(([status, color]) => (
              <div key={status} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                <span className="text-gray-500 dark:text-slate-400">{status.replace(/_/g, ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Map or loading ── */}
      {loading ? (
        <div className="flex-1 p-4">
          <Skel className="w-full min-h-[calc(100vh-12rem)] rounded-xl" />
        </div>
      ) : (
        <div ref={mapRef} className="flex-1 w-full min-h-[calc(100vh-12rem)] z-0" />
      )}
    </div>
  );
}
