import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeTerrarium, sampleElevationData, storeElevationTile, elevationAt, clearElevationTiles } from './elevation.js';
import { geoToWorld, geoToTile, tileToGeo } from './geo.js';

test('Terrarium preserves underwater elevations, zero, fractions and summits', () => {
  const decoded = decodeTerrarium(new Uint8Array([
    127, 246, 0, 255, 128, 0, 0, 255,
    128, 6, 128, 255, 137, 219, 68, 255,
  ]), 2, 2);
  assert.deepEqual([...decoded.values], [-10, 0, 6.5, 2523.265625]);
});

test('Sampling interpolates a known planar slope without stepping at pixels', () => {
  const data = { values: new Float32Array([0, 100, 200, 300]), width: 2, height: 2 };
  assert.equal(sampleElevationData(data, .5, .5), 150);
  assert.equal(sampleElevationData(data, .25, .75), 175);
  assert.equal(sampleElevationData(data, -1, 2), 200);
});

test('Geographic elevation cache distinguishes missing data from real sea level', () => {
  clearElevationTiles();
  const tile = geoToTile(36.7245, 28.9235, 12), x = Math.floor(tile.x), y = Math.floor(tile.y);
  const center = tileToGeo(x + .5, y + .5, 12), position = geoToWorld(center.lat, center.lng);
  assert.deepEqual(elevationAt(position.x, position.z), { height: 0, ready: false });
  storeElevationTile(x, y, { values: new Float32Array([0, 0, 0, 0]), width: 2, height: 2 });
  assert.deepEqual(elevationAt(position.x, position.z), { height: 0, ready: true });
  storeElevationTile(x, y, { values: new Float32Array([40, 40, 40, 40]), width: 2, height: 2 });
  assert.equal(elevationAt(position.x, position.z).height, 40);
  clearElevationTiles();
});
