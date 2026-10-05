// Map settings and helpers shared by the citizen pin picker and the admin map.
// Leaflet is passed in (as `L`) so it is only downloaded when a map opens.

// Poblacion (Barangay Magosilom), used before the outline has loaded.
export const CANTILAN_CENTER = [9.332, 125.978];

// The municipal outline and barangay boundaries (PSA, 2023) are loaded only when
// a map opens.
let boundaryPromise = null;
export function loadCantilanBoundary() {
  if (!boundaryPromise) boundaryPromise = import('./cantilanBoundary.json').then(m => m.default || m);
  return boundaryPromise;
}

let barangaysPromise = null;
export function loadCantilanBarangays() {
  if (!barangaysPromise) barangaysPromise = import('./cantilanBarangays.json').then(m => (m.default || m).barangays);
  return barangaysPromise;
}

// Southwest and northeast corners of the outline, padded so its edge isn't flush
// with the map edge.
export function cantilanBounds(boundary, pad = 0.02) {
  const [w, s, e, n] = boundary.bbox;
  return [[s - pad, w - pad], [n + pad, e + pad]];
}

// ── Inside Cantilan? ──
// Inside the outline, or within 500 m of it so piers and the shoreline count.
// server/src/utils/cantilanArea.js has the same check for saved reports.
const EDGE_TOLERANCE_M = 500;

function inRing(ring, lat, lng) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// `coordinates` are a GeoJSON MultiPolygon's.
function insideShape(coordinates, lat, lng) {
  return coordinates.some(part => inRing(part[0], lat, lng) && !part.slice(1).some(r => inRing(r, lat, lng)));
}

function metersToEdge(coordinates, lat, lng) {
  const kx = 111320 * Math.cos((lat * Math.PI) / 180);
  const ky = 110540;
  let best = Infinity;
  for (const part of coordinates) {
    for (const ring of part) {
      for (let i = 1; i < ring.length; i++) {
        const ax = (ring[i - 1][0] - lng) * kx;
        const ay = (ring[i - 1][1] - lat) * ky;
        const dx = (ring[i][0] - lng) * kx - ax;
        const dy = (ring[i][1] - lat) * ky - ay;
        const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
        best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
      }
    }
  }
  return best;
}

export function isInCantilan(boundary, lat, lng) {
  if (!boundary || !Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  const [w, s, e, n] = boundary.bbox;
  if (lat < s - 0.01 || lat > n + 0.01 || lng < w - 0.01 || lng > e + 0.01) return false;
  return insideShape(boundary.coordinates, lat, lng) || metersToEdge(boundary.coordinates, lat, lng) <= EDGE_TOLERANCE_M;
}

// The barangay a spot is in (its name as in cantilanLocations.js), the nearest one
// within 500 m for spots just off the shore, or null.
export function barangayAt(barangays, lat, lng) {
  if (!barangays || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const inside = barangays.find(b => insideShape(b.coordinates, lat, lng));
  if (inside) return inside.name;
  let nearest = null;
  let nearestMeters = EDGE_TOLERANCE_M;
  for (const b of barangays) {
    const meters = metersToEdge(b.coordinates, lat, lng);
    if (meters <= nearestMeters) {
      nearest = b.name;
      nearestMeters = meters;
    }
  }
  return nearest;
}

// ── Base maps ──
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';
const ESRI_ATTRIBUTION = 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community';

export const MAP_STYLE_LABELS = { street: 'Street', satellite: 'Satellite' };

// { street, satellite }: the satellite view also gets road and place-name labels.
export function createBaseLayers(L) {
  return {
    street: L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors', maxZoom: 19,
    }),
    satellite: L.layerGroup([
      L.tileLayer(`${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`, { attribution: ESRI_ATTRIBUTION, maxZoom: 19, maxNativeZoom: 18 }),
      L.tileLayer(`${ESRI}/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 19, maxNativeZoom: 18 }),
      L.tileLayer(`${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 19, maxNativeZoom: 18 }),
    ]),
  };
}

// Dims everything outside Cantilan and draws its border. Call restyle(style)
// after switching base maps so the border stays easy to see.
export function addCantilanFocus(L, map, boundary) {
  const [w, s, e, n] = boundary.bbox;
  const world = [[s - 3, w - 3], [s - 3, e + 3], [n + 3, e + 3], [n + 3, w - 3]];
  const holes = boundary.coordinates.map(part => part[0].map(([lng, lat]) => [lat, lng]));
  const mask = L.polygon([world, ...holes], {
    stroke: false, fillColor: '#0f172a', fillOpacity: 0.38, interactive: false,
  }).addTo(map);
  const border = L.geoJSON({ type: 'MultiPolygon', coordinates: boundary.coordinates }, {
    style: { color: '#2563eb', weight: 2.5, opacity: 0.9, fill: false }, interactive: false,
  }).addTo(map);
  const restyle = style => {
    mask.setStyle({ fillOpacity: style === 'satellite' ? 0.5 : 0.38 });
    border.setStyle({ color: style === 'satellite' ? '#facc15' : '#2563eb' });
  };
  return { mask, border, restyle };
}

// Map bounds limited to Cantilan; the minimum zoom shows the whole municipality.
export function lockToCantilan(L, map, boundary) {
  const bounds = L.latLngBounds(cantilanBounds(boundary));
  map.setMaxBounds(bounds);
  map.options.maxBoundsViscosity = 1;
  map.setMinZoom(map.getBoundsZoom(L.latLngBounds(cantilanBounds(boundary, 0))));
  return bounds;
}

// A teardrop pin drawn in CSS (Leaflet's image pins need extra files).
export function pinIconHtml(color = '#dc2626') {
  return `<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:3px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.35)"></div>`;
}

// "You are here": a blue dot with a soft pulse (animation in index.css).
export const YOU_ARE_HERE_HTML = '<div class="civix-you-are-here"><span></span></div>';
