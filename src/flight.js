// Accessible flight dynamics: world coordinates are meters; instruments use
// knots, feet, and feet per minute. North is -Z and right bank is positive.
import { GEO_LOCATIONS, MAX_LATITUDE, geoToWorld } from './geo.js';

const DEG = Math.PI / 180;
const FEET = 3.28084;
const KNOT = 0.514444;
const WHEEL_HEIGHT = 2.4;
const DEFAULT_RUNWAY = { x: 2200, z: -5500, elevation: 6.1, length: 3000, width: 45, heading: 15.35 };
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const damp = (value, target, rate, dt) => value + (target - value) * (1 - Math.exp(-rate * dt));
const signedAngle = angle => ((angle + 540) % 360) - 180;

export function createFlight(options = {}) {
  const terrainHeight = options.terrainHeight || (() => 0);
  const runway = { ...DEFAULT_RUNWAY, ...options.runway };
  const state = {};
  let holdAltitude = 900;
  let holdHeading = 0;
  let customCoordinates = null;

  function surfaceAt(x, z) {
    const height = terrainHeight(x, z);
    return Number.isFinite(height) ? Math.max(0, height) : 0;
  }

  function isOnRunway(position) {
    const dx = position.x - runway.x, dz = position.z - runway.z;
    const angle = runway.heading * DEG;
    const across = dx * Math.cos(angle) + dz * Math.sin(angle);
    const along = dx * Math.sin(angle) - dz * Math.cos(angle);
    return Math.abs(across) <= runway.width / 2 && Math.abs(along) <= runway.length / 2;
  }

  function reset(location = 'coast') {
    if (!GEO_LOCATIONS[location] && !(location === 'custom' && customCoordinates)) location = 'coast';
    const onGround = location === 'runway';
    const coordinates = location === 'custom' ? customCoordinates : GEO_LOCATIONS[location];
    const point = geoToWorld(coordinates.lat, coordinates.lng);
    if (onGround) {
      const thresholdOffset = Math.max(0, runway.length / 2 - 200);
      point.x = runway.x - Math.sin(runway.heading * DEG) * thresholdOffset;
      point.z = runway.z + Math.cos(runway.heading * DEG) * thresholdOffset;
    }
    const surface = surfaceAt(point.x, point.z);
    const position = {
      ...point,
      y: onGround ? surface + WHEEL_HEIGHT : Math.max(location === 'mountains' ? 2450 : 900, surface + 700),
    };
    Object.assign(state, {
      position,
      heading: onGround ? runway.heading : location === 'custom' ? 0 : coordinates.heading,
      pitch: 0,
      roll: 0,
      speed: onGround ? 0 : 112,
      throttle: onGround ? 0 : 65,
      verticalSpeed: 0,
      altitude: position.y * FEET,
      terrainAltitude: surfaceAt(position.x, position.z) * FEET,
      rpm: onGround ? 700 : 2300,
      fuel: 94,
      gear: onGround,
      flaps: false,
      autopilot: false,
      status: 'ready',
      flightTime: 0,
      distance: 0,
      crashed: false,
      landed: false,
      onGround,
      stall: false,
      crashReason: '',
      location,
    });
    holdAltitude = position.y;
    holdHeading = state.heading;
    return state;
  }

  function teleport(lat, lng) {
    lat = Number(lat); lng = Number(lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > MAX_LATITUDE || Math.abs(lng) > 180) return false;
    customCoordinates = { lat, lng };
    return reset('custom');
  }

  function refreshTerrain() {
    const height = surfaceAt(state.position.x, state.position.z);
    const previousAltitude = state.position.y;
    if (state.status === 'ready') {
      state.position.y = state.onGround ? height + WHEEL_HEIGHT : Math.max(state.position.y, height + 500);
      holdAltitude = state.position.y;
    }
    state.terrainAltitude = height * FEET;
    state.altitude = state.position.y * FEET;
    return { height, adjusted: state.position.y !== previousAltitude, position: { ...state.position } };
  }

  function setThrottle(value) {
    if (Number.isFinite(Number(value))) state.throttle = clamp(Number(value), 0, 100);
    return state.throttle;
  }

  function toggleGear() {
    // Prevent retracting the wheels while the aircraft rests on them.
    if (!state.onGround && !state.crashed) state.gear = !state.gear;
    return state.gear;
  }

  function toggleFlaps() {
    if (!state.crashed) state.flaps = !state.flaps;
    return state.flaps;
  }

  function toggleAutopilot() {
    if (state.onGround || state.crashed) return false;
    state.autopilot = !state.autopilot;
    holdAltitude = state.position.y;
    holdHeading = state.heading;
    return state.autopilot;
  }

  function crash(reason) {
    state.crashed = true;
    state.crashReason = reason;
    state.status = 'crashed';
    state.autopilot = false;
    state.stall = false;
    state.speed = 0;
    state.throttle = 0;
    state.verticalSpeed = 0;
    state.rpm = 0;
  }

  function step(dt, input) {
    const pitchInput = clamp(Number(input.pitch) || 0, -1, 1);
    const rollInput = clamp(Number(input.roll) || 0, -1, 1);
    const yawInput = clamp(Number(input.yaw) || 0, -1, 1);
    const throttleInput = clamp(Number(input.throttle) || 0, -1, 1);
    if (state.autopilot && Math.max(Math.abs(pitchInput), Math.abs(rollInput), Math.abs(yawInput)) > 0.15) {
      state.autopilot = false;
    }
    setThrottle(state.throttle + throttleInput * 22 * dt);
    if (state.fuel <= 0) state.throttle = 0;

    const targetPitch = state.autopilot
      ? clamp((holdAltitude - state.position.y) * 0.075 - state.verticalSpeed * 0.001, -12, 12)
      : state.onGround ? Math.max(0, pitchInput) * 14 : pitchInput * 20;
    const targetRoll = state.onGround ? 0 : state.autopilot
      ? clamp(signedAngle(holdHeading - state.heading) * 1.5, -28, 28)
      : rollInput * 52;
    state.pitch = damp(state.pitch, targetPitch, 1.7, dt);
    state.roll = damp(state.roll, targetRoll, 2.4, dt);

    const stallSpeed = state.flaps ? 43 : 51;
    const targetSpeed = state.onGround
      ? state.throttle * 1.55
      : 40 + state.throttle * 1.12 - (state.flaps ? 14 : 0) - (state.gear ? 7 : 0)
        - Math.sin(state.pitch * DEG) * 35 - Math.abs(state.roll) * 0.04;
    state.speed = damp(state.speed, targetSpeed, state.onGround ? 0.105 : 0.09, dt);
    if (state.onGround) {
      state.speed = Math.max(0, state.speed - (input.brake ? 24 : 0.35) * dt);
      if (state.speed < 0.12 && state.throttle < 1) state.speed = 0;
    }

    const speedMS = state.speed * KNOT;
    if (state.onGround) {
      state.heading += (yawInput * 25 + rollInput * 12) * Math.min(1, state.speed / 18) * dt;
    } else {
      state.heading += (9.81 * Math.tan(state.roll * DEG) / Math.max(22, speedMS) / DEG + yawInput * 7) * dt;
    }
    state.heading = ((state.heading % 360) + 360) % 360;
    state.position.x += Math.sin(state.heading * DEG) * speedMS * dt;
    state.position.z -= Math.cos(state.heading * DEG) * speedMS * dt;
    state.distance += speedMS * dt / 1852;
    state.flightTime += dt;
    state.fuel = Math.max(0, state.fuel - (0.0004 + state.throttle * 0.000045) * dt);
    state.rpm = damp(state.rpm, state.fuel > 0 ? 700 + state.throttle * 23.8 : 0, 2, dt);

    const surface = surfaceAt(state.position.x, state.position.z);
    state.terrainAltitude = surface * FEET;
    if (state.onGround) {
      const terrainRise = surface + WHEEL_HEIGHT - state.position.y;
      if (terrainHeight(state.position.x, state.position.z) < 0 || (terrainRise > 1.6 && state.speed > 25)) {
        crash('terrain');
      }
      state.position.y = surface + WHEEL_HEIGHT;
      state.verticalSpeed = 0;
      state.stall = false;
      if (!state.crashed && state.speed > stallSpeed + 5 && state.pitch > 3) {
        state.onGround = false;
        state.landed = false;
        state.position.y += 0.15;
        state.verticalSpeed = Math.max(160, Math.sin(state.pitch * DEG) * speedMS * FEET * 60);
      }
    } else {
      state.stall = state.speed < stallSpeed;
      const stallSeverity = clamp((stallSpeed - state.speed) / 16, 0, 1);
      const bankSink = (1 - Math.cos(state.roll * DEG)) * 2.5;
      const desiredClimb = Math.sin(state.pitch * DEG) * speedMS * (1 - stallSeverity * 0.8)
        - bankSink - stallSeverity * 14;
      let verticalMS = state.verticalSpeed / (FEET * 60);
      verticalMS = damp(verticalMS, desiredClimb, 1.8, dt);
      state.position.y += verticalMS * dt;
      state.verticalSpeed = verticalMS * FEET * 60;

      if (state.position.y <= surface + WHEEL_HEIGHT) {
        const headingError = Math.min(Math.abs(signedAngle(state.heading - runway.heading)), Math.abs(signedAngle(state.heading - runway.heading - 180)));
        const safeLanding = isOnRunway(state.position) && state.gear && state.speed <= 92
          && verticalMS >= -3.5 && Math.abs(state.roll) < 12
          && state.pitch >= -6 && state.pitch <= 14 && headingError < 18;
        state.position.y = surface + WHEEL_HEIGHT;
        if (safeLanding) {
          state.onGround = true;
          state.landed = true;
          state.autopilot = false;
          state.stall = false;
          state.verticalSpeed = 0;
          state.pitch = 0;
          state.roll = 0;
        } else {
          crash(surface === 0 ? 'water' : isOnRunway(state.position) ? 'landing' : 'terrain');
        }
      }
    }
    state.altitude = state.position.y * FEET;
  }

  function update(dt, input = {}) {
    if (state.status !== 'flying' || state.crashed || !Number.isFinite(dt) || dt <= 0) return state;
    // Ignore long background-tab gaps and substep normal frames for stable contact.
    let remaining = Math.min(dt, 0.25);
    while (remaining > 0.000001 && !state.crashed) {
      const delta = Math.min(remaining, 1 / 60);
      step(delta, input);
      remaining -= delta;
    }
    return state;
  }

  reset();
  return { state, update, reset, teleport, refreshTerrain, setThrottle, toggleGear, toggleFlaps, toggleAutopilot };
}
