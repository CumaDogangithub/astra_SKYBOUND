import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DALAMAN, EARTH_RADIUS, MAX_LATITUDE, GEO_LOCATIONS,
  geoToWorld, worldToGeo, geoToTile, tileToGeo, tileWorldBounds, distanceNm,
} from './geo.js';

const close = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} ≈ ${expected}`);

test('Dalaman geographic anchor maps to the airport world coordinates', () => {
  const world = geoToWorld(DALAMAN.lat, DALAMAN.lng);
  close(world.x, 2200);
  close(world.z, -5500);
  const coordinate = worldToGeo(2200, -5500);
  close(coordinate.lat, 36.7131);
  close(coordinate.lng, 28.7925);
});

test('world coordinates round-trip for local routes and distant hemispheres', () => {
  for (const coordinate of [GEO_LOCATIONS.coast, GEO_LOCATIONS.mountains, { lat: 0, lng: 0 }, { lat: -33.8688, lng: 151.2093 }, { lat: 51.5074, lng: -0.1278 }, { lat: 84.9, lng: -179.9 }]) {
    const point = geoToWorld(coordinate.lat, coordinate.lng);
    const result = worldToGeo(point.x, point.z);
    close(result.lat, coordinate.lat);
    close(result.lng, coordinate.lng);
  }
});

test('east is positive X, north is negative Z, and local distances are meters', () => {
  const east = geoToWorld(DALAMAN.lat, DALAMAN.lng + 0.001);
  const north = geoToWorld(DALAMAN.lat + 0.001, DALAMAN.lng);
  const expectedEast = EARTH_RADIUS * Math.PI / 180 * 0.001 * Math.cos(DALAMAN.lat * Math.PI / 180);
  const expectedNorth = EARTH_RADIUS * Math.PI / 180 * 0.001;
  close(east.x - DALAMAN.x, expectedEast, 0.001);
  close(east.z, DALAMAN.z);
  close(north.x, DALAMAN.x);
  close(DALAMAN.z - north.z, expectedNorth, 0.01);
});

test('nautical distances are symmetric with correct equatorial scale', () => {
  close(distanceNm(DALAMAN, DALAMAN), 0);
  close(distanceNm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 }), EARTH_RADIUS * Math.PI / 180 / 1852);
  close(distanceNm(GEO_LOCATIONS.coast, DALAMAN), distanceNm(DALAMAN, GEO_LOCATIONS.coast));
  assert.ok(distanceNm(GEO_LOCATIONS.coast) > 6 && distanceNm(GEO_LOCATIONS.coast) < 6.5);
});

test('slippy-map tiles round-trip and neighboring world bounds meet exactly', () => {
  const zoom = 13;
  const tile = geoToTile(DALAMAN.lat, DALAMAN.lng, zoom);
  const coordinate = tileToGeo(tile.x, tile.y, zoom);
  close(coordinate.lat, DALAMAN.lat);
  close(coordinate.lng, DALAMAN.lng);
  const x = Math.floor(tile.x), y = Math.floor(tile.y);
  const bounds = tileWorldBounds(x, y, zoom);
  const right = tileWorldBounds(x + 1, y, zoom);
  const below = tileWorldBounds(x, y + 1, zoom);
  assert.ok(bounds.minX < DALAMAN.x && bounds.maxX > DALAMAN.x);
  assert.ok(bounds.minZ < DALAMAN.z && bounds.maxZ > DALAMAN.z);
  close(bounds.maxX, right.minX);
  close(bounds.maxZ, below.minZ);
});

test('Mercator world limits remain finite at poles and antimeridian tile edges', () => {
  const zoom = 6, size = 2 ** zoom;
  const northwest = geoToTile(MAX_LATITUDE, -180, zoom);
  const southeast = geoToTile(-MAX_LATITUDE, 180, zoom);
  close(northwest.x, 0);
  close(northwest.y, 0, 1e-7);
  close(southeast.x, size);
  close(southeast.y, size, 1e-7);
  const corner = tileToGeo(0, 0, zoom);
  close(corner.lat, MAX_LATITUDE, 1e-7);
  close(corner.lng, -180);
  for (const latitude of [-90, 90]) {
    const world = geoToWorld(latitude, 0);
    assert.ok(Number.isFinite(world.x) && Number.isFinite(world.z));
    close(Math.abs(worldToGeo(world.x, world.z).lat), MAX_LATITUDE, 1e-7);
  }
});
