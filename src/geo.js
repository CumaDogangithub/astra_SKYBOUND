// Local metre coordinates anchored to Dalaman, projected through Web Mercator.
// X is east, -Z is north. The same transform drives maps, imagery and elevation.
export const EARTH_RADIUS = 6378137;
export const MAX_LATITUDE = 85.05112878;
export const DALAMAN = Object.freeze({ lat: 36.7131, lng: 28.7925, x: 2200, z: -5500 });
export const GEO_LOCATIONS = Object.freeze({
  coast: { lat: 36.7245, lng: 28.9235, heading: 290 },
  mountains: { lat: 36.86, lng: 29.02, heading: 220 },
  runway: { lat: DALAMAN.lat, lng: DALAMAN.lng, heading: 15.35 },
});
const DEG = Math.PI / 180;
const SCALE = Math.cos(DALAMAN.lat * DEG);
const anchorX = EARTH_RADIUS * DALAMAN.lng * DEG;
const anchorY = EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + DALAMAN.lat * DEG / 2));
export function geoToWorld(lat, lng) {
  lat = Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, Number(lat)));
  const mx = EARTH_RADIUS * Number(lng) * DEG;
  const my = EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + lat * DEG / 2));
  return { x: (mx - anchorX) * SCALE + DALAMAN.x, z: -(my - anchorY) * SCALE + DALAMAN.z };
}
export function worldToGeo(x, z) {
  const mx = (x - DALAMAN.x) / SCALE + anchorX;
  const my = -(z - DALAMAN.z) / SCALE + anchorY;
  return { lat: (2 * Math.atan(Math.exp(my / EARTH_RADIUS)) - Math.PI / 2) / DEG, lng: mx / EARTH_RADIUS / DEG };
}
export function geoToTile(lat, lng, zoom) {
  const size = 2 ** zoom;
  lat = Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, lat));
  return { x: (lng + 180) / 360 * size, y: (1 - Math.asinh(Math.tan(lat * DEG)) / Math.PI) / 2 * size };
}
export function tileToGeo(x, y, zoom) {
  const size = 2 ** zoom;
  return { lat: Math.atan(Math.sinh(Math.PI * (1 - 2 * y / size))) / DEG, lng: x / size * 360 - 180 };
}
export function tileWorldBounds(x, y, zoom) {
  const nw = tileToGeo(x, y, zoom), se = tileToGeo(x + 1, y + 1, zoom);
  const a = geoToWorld(nw.lat, nw.lng), b = geoToWorld(se.lat, se.lng);
  return { minX: a.x, maxX: b.x, minZ: a.z, maxZ: b.z };
}
export function distanceNm(a, b = DALAMAN) {
  const dLat = (b.lat - a.lat) * DEG, dLng = (b.lng - a.lng) * DEG;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * DEG) * Math.cos(b.lat * DEG) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h))) / 1852;
}
export function formatCoordinates(position) {
  const { lat, lng } = worldToGeo(position.x, position.z);
  return `${Math.abs(lat).toFixed(4)}° ${lat < 0 ? 'S' : 'N'} · ${Math.abs(lng).toFixed(4)}° ${lng < 0 ? 'W' : 'E'}`;
}
