import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTerrainPath } from './terrain-tiles.js';

test('height relay accepts only valid fixed-source tile coordinates', () => {
  assert.deepEqual(parseTerrainPath('/map-tiles/elevation/12/2377/1598.png'), { zoom: 12, x: 2377, y: 1598 });
  assert.deepEqual(parseTerrainPath('/map-tiles/elevation/0/0/0.png'), { zoom: 0, x: 0, y: 0 });
  for (const path of ['/map-tiles/elevation/16/1/1.png', '/map-tiles/elevation/1/2/0.png', '/map-tiles/elevation/1/0/2.png', '/map-tiles/elevation/1/-1/0.png', '/map-tiles/elevation/../../etc/passwd', '/map-tiles/elevation/12/https://example.com/1.png']) assert.equal(parseTerrainPath(path), null);
});
