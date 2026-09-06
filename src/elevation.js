import { worldToGeo, geoToTile } from './geo.js';

export const ELEVATION_ZOOM = 12;
const tiles = new Map();
const MAX_TILES = 80;
export const elevationKey = (x, y, zoom = ELEVATION_ZOOM) => `${zoom}/${x}/${y}`;

export function decodeTerrarium(rgba, width = 256, height = 256) {
  if (rgba.length !== width * height * 4) throw new Error('Geçersiz Terrarium görüntüsü');
  const values = new Float32Array(width * height);
  for (let i = 0; i < values.length; i++) values[i] = rgba[i * 4] * 256 + rgba[i * 4 + 1] + rgba[i * 4 + 2] / 256 - 32768;
  return { values, width, height };
}
export function storeElevationTile(x, y, data, zoom = ELEVATION_ZOOM) {
  const key = elevationKey(x, y, zoom); tiles.delete(key); tiles.set(key, data);
  while (tiles.size > MAX_TILES) tiles.delete(tiles.keys().next().value);
  return data;
}
export function getElevationTile(x, y, zoom = ELEVATION_ZOOM) { return tiles.get(elevationKey(x, y, zoom)); }
export function removeElevationTile(x, y, zoom = ELEVATION_ZOOM) { tiles.delete(elevationKey(x, y, zoom)); }
export function clearElevationTiles() { tiles.clear(); }
export function sampleElevationData(data, u, v) {
  const px = Math.max(0, Math.min(data.width - 1, u * (data.width - 1)));
  const py = Math.max(0, Math.min(data.height - 1, v * (data.height - 1)));
  const x0 = Math.floor(px), y0 = Math.floor(py), x1 = Math.min(x0 + 1, data.width - 1), y1 = Math.min(y0 + 1, data.height - 1);
  const fx = px - x0, fy = py - y0, values = data.values, width = data.width;
  return (values[y0 * width + x0] * (1 - fx) + values[y0 * width + x1] * fx) * (1 - fy)
    + (values[y1 * width + x0] * (1 - fx) + values[y1 * width + x1] * fx) * fy;
}
export function elevationAt(x, z) {
  const { lat, lng } = worldToGeo(x, z), tile = geoToTile(lat, lng, ELEVATION_ZOOM);
  const tx = Math.floor(tile.x), ty = Math.floor(tile.y), data = getElevationTile(tx, ty);
  if (!data) return { height: 0, ready: false };
  return { height: sampleElevationData(data, tile.x - tx, tile.y - ty), ready: true };
}
