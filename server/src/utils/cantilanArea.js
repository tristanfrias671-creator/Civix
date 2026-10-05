// Is a map pin inside Cantilan? Uses the municipal outline (PSA, 2023) in
// ../data/cantilanBoundary.json. A pin counts if it is inside the outline or
// within 500 m of it, so piers and the shoreline are accepted.
// client/src/data/cantilanMap.js does the same check in the browser.
const boundary = require('../data/cantilanBoundary.json');

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

function metersToEdge(lat, lng) {
  const kx = 111320 * Math.cos((lat * Math.PI) / 180);
  const ky = 110540;
  let best = Infinity;
  for (const part of boundary.coordinates) {
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

function isInCantilan(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  const [w, s, e, n] = boundary.bbox;
  if (lat < s - 0.01 || lat > n + 0.01 || lng < w - 0.01 || lng > e + 0.01) return false;
  const inside = boundary.coordinates.some(part => inRing(part[0], lat, lng) && !part.slice(1).some(r => inRing(r, lat, lng)));
  return inside || metersToEdge(lat, lng) <= EDGE_TOLERANCE_M;
}

module.exports = { isInCantilan };
