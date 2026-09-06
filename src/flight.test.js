import test from 'node:test';
import assert from 'node:assert/strict';
import { createFlight } from './flight.js';
import { GEO_LOCATIONS, geoToWorld, worldToGeo } from './geo.js';

// Deterministic land/water fixtures keep physics tests independent of streamed DEM.
const RUNWAY = { x: 2200, z: -5500, elevation: 6.1, length: 3000, width: 45, heading: 15.35 };
const runwayAngle = RUNWAY.heading * Math.PI / 180;
function runwayPoint(offset = 0) {
  return { x: RUNWAY.x - Math.sin(runwayAngle) * offset, z: RUNWAY.z + Math.cos(runwayAngle) * offset };
}
function terrainHeight(x, z) {
  const dx = x - RUNWAY.x, dz = z - RUNWAY.z;
  const across = dx * Math.cos(runwayAngle) + dz * Math.sin(runwayAngle);
  const along = dx * Math.sin(runwayAngle) - dz * Math.cos(runwayAngle);
  if (Math.abs(across) <= 350 && Math.abs(along) <= RUNWAY.length / 2 + 350) return RUNWAY.elevation;
  if (x > 19000 && z < -15000) return 1650;
  return -15;
}

function advance(flight, seconds, input = {}) {
  for (let elapsed = 0; elapsed < seconds; elapsed += 1 / 60) flight.update(1 / 60, input);
}

function flying(location = 'coast') {
  const flight = createFlight({ terrainHeight, runway: RUNWAY });
  flight.reset(location);
  flight.state.status = 'flying';
  if (location !== 'runway') flight.state.heading = 0;
  return flight;
}

test('ready and paused flights do not advance, cruise maintains altitude and travels north', () => {
  const flight = createFlight({ terrainHeight });
  advance(flight, 1, { pitch: 1 });
  assert.equal(flight.state.flightTime, 0);
  const start = { ...flight.state.position };
  flight.state.heading = 0;
  flight.state.status = 'flying';
  advance(flight, 10);
  assert.ok(flight.state.position.z < start.z - 550);
  assert.equal(flight.state.position.x, start.x);
  assert.ok(Math.abs(flight.state.position.y - 900) < 1);
  const snapshot = JSON.stringify(flight.state);
  flight.state.status = 'paused';
  const paused = JSON.stringify(flight.state);
  advance(flight, 2, { throttle: 1 });
  assert.equal(JSON.stringify(flight.state), paused);
  assert.notEqual(snapshot, paused);
});

test('bank right turns east and pitch up climbs; release stabilizes wings', () => {
  const flight = flying();
  const startX = flight.state.position.x;
  advance(flight, 4, { roll: 0.6, pitch: 0.5 });
  assert.ok(flight.state.heading > 10 && flight.state.heading < 90);
  assert.ok(flight.state.position.x > startX + 10);
  assert.ok(flight.state.position.y > 925);
  advance(flight, 4);
  assert.ok(Math.abs(flight.state.roll) < 0.1);
  assert.ok(Math.abs(flight.state.pitch) < 0.1);
});

test('runway start can accelerate and take off with gear extended', () => {
  const flight = flying('runway');
  assert.equal(flight.state.speed, 0);
  assert.equal(flight.state.gear, true);
  assert.equal(flight.state.heading, RUNWAY.heading);
  assert.ok(Math.abs(flight.state.position.y - RUNWAY.elevation - 2.4) < 1e-8);
  flight.toggleGear();
  assert.equal(flight.state.gear, true);
  advance(flight, 1, { pitch: -1 });
  assert.equal(flight.state.pitch, 0, 'the landing gear keeps the nose above the runway');
  flight.setThrottle(100);
  advance(flight, 13, { pitch: 0.6 });
  assert.equal(flight.state.crashed, false);
  assert.equal(flight.state.onGround, false);
  assert.ok(flight.state.position.y > RUNWAY.elevation + 35);
  assert.ok(flight.state.speed > 70);
});

test('a gentle runway approach lands and brakes to a stop', () => {
  const flight = flying();
  Object.assign(flight.state, {
    position: { ...runwayPoint(500), y: RUNWAY.elevation + 3 },
    heading: RUNWAY.heading, speed: 65, throttle: 0, pitch: -2, verticalSpeed: -260, gear: true,
  });
  advance(flight, 2, { pitch: -0.1 });
  assert.equal(flight.state.crashed, false);
  assert.equal(flight.state.landed, true);
  assert.equal(flight.state.onGround, true);
  advance(flight, 4, { brake: true });
  assert.equal(flight.state.speed, 0);
});

test('water impact and gear-up runway impact crash and stop simulation', () => {
  for (const runway of [false, true]) {
    const flight = flying();
    Object.assign(flight.state, {
      position: runway
        ? { x: RUNWAY.x, y: RUNWAY.elevation + 2.5, z: RUNWAY.z }
        : { x: -500, y: 2.5, z: 0 },
      speed: 65, throttle: 0, pitch: -5, verticalSpeed: -500, gear: false,
    });
    advance(flight, 1, { pitch: -0.25 });
    assert.equal(flight.state.crashed, true);
    assert.equal(flight.state.status, 'crashed');
    assert.equal(flight.state.crashReason, runway ? 'landing' : 'water');
    const snapshot = JSON.stringify(flight.state);
    advance(flight, 1);
    assert.equal(JSON.stringify(flight.state), snapshot);
  }
});

test('low airspeed produces a stall and descent; reset clears the flight', () => {
  const flight = flying();
  flight.state.speed = 35;
  flight.setThrottle(0);
  advance(flight, 2);
  assert.equal(flight.state.stall, true);
  assert.ok(flight.state.verticalSpeed < -1000);
  const stateReference = flight.state;
  flight.reset('mountains');
  assert.equal(flight.state, stateReference);
  assert.equal(flight.state.stall, false);
  assert.equal(flight.state.status, 'ready');
  assert.equal(flight.state.distance, 0);
  assert.ok(flight.state.position.y > terrainHeight(flight.state.position.x, flight.state.position.z) + 600);
});

test('autopilot holds heading and altitude and yields to manual input', () => {
  const flight = flying();
  flight.toggleAutopilot();
  flight.state.position.y -= 20;
  flight.state.heading = 355;
  advance(flight, 30);
  assert.equal(flight.state.autopilot, true);
  assert.ok(Math.abs(flight.state.position.y - 900) < 3);
  assert.ok(Math.min(flight.state.heading, 360 - flight.state.heading) < 2);
  flight.update(1 / 60, { roll: 1 });
  assert.equal(flight.state.autopilot, false);
});

test('real-world routes use shared Göcek and Toros coordinates and headings', () => {
  const flight = createFlight({ terrainHeight, runway: RUNWAY });
  for (const location of ['coast', 'mountains']) {
    flight.reset(location);
    const expected = geoToWorld(GEO_LOCATIONS[location].lat, GEO_LOCATIONS[location].lng);
    assert.equal(flight.state.position.x, expected.x);
    assert.equal(flight.state.position.z, expected.z);
    assert.equal(flight.state.heading, GEO_LOCATIONS[location].heading);
    assert.equal(flight.state.location, location);
  }
});

test('teleport selects a safe custom airspawn and reset remembers the map selection', () => {
  const flight = createFlight({ terrainHeight: () => 1800 });
  const stateReference = flight.state;
  assert.equal(flight.teleport(40.7128, -74.006), stateReference);
  const coordinates = worldToGeo(flight.state.position.x, flight.state.position.z);
  assert.ok(Math.abs(coordinates.lat - 40.7128) < 1e-8);
  assert.ok(Math.abs(coordinates.lng + 74.006) < 1e-8);
  assert.equal(flight.state.position.y, 2500);
  assert.equal(flight.state.location, 'custom');
  assert.equal(flight.state.heading, 0);
  assert.equal(flight.state.status, 'ready');
  assert.equal(flight.state.onGround, false);
  flight.state.status = 'flying';
  advance(flight, 2);
  flight.reset('custom');
  assert.equal(flight.state.flightTime, 0);
  const resetCoordinates = worldToGeo(flight.state.position.x, flight.state.position.z);
  assert.ok(Math.abs(resetCoordinates.lat - 40.7128) < 1e-8);
  const snapshot = JSON.stringify(flight.state);
  for (const coordinates of [[NaN, 2], [90, 2], [40, Infinity], [40, 200]]) {
    assert.equal(flight.teleport(...coordinates), false);
    assert.equal(JSON.stringify(flight.state), snapshot);
  }
});

test('loaded terrain adjusts ready spawn clearance without moving an active flight', () => {
  let height = 0;
  const flight = createFlight({ terrainHeight: () => height });
  flight.teleport(36.86, 29.02);
  assert.equal(flight.state.position.y, 900);
  height = 1700;
  const refreshed = flight.refreshTerrain();
  assert.equal(refreshed.adjusted, true);
  assert.equal(refreshed.height, 1700);
  assert.equal(flight.state.position.y, 2200);
  assert.equal(flight.state.altitude, 2200 * 3.28084);
  flight.state.status = 'flying';
  height = 2400;
  assert.equal(flight.refreshTerrain().adjusted, false);
  assert.equal(flight.state.position.y, 2200, 'active aircraft must not jump when a DEM tile arrives');
  assert.equal(flight.state.terrainAltitude, 2400 * 3.28084);
  height = 0;
  flight.reset('runway');
  height = 6.1;
  flight.refreshTerrain();
  assert.equal(flight.state.position.y, 8.5);
});

test('rotated runway rejects a touchdown outside its actual width', () => {
  const flight = flying();
  const point = runwayPoint(500);
  Object.assign(flight.state, {
    position: { x: point.x + Math.cos(runwayAngle) * 30, y: RUNWAY.elevation + 2.5, z: point.z + Math.sin(runwayAngle) * 30 },
    heading: RUNWAY.heading, speed: 65, throttle: 0, pitch: -2, verticalSpeed: -260, gear: true,
  });
  advance(flight, 1, { pitch: -0.1 });
  assert.equal(flight.state.crashed, true);
  assert.equal(flight.state.crashReason, 'terrain');
});
