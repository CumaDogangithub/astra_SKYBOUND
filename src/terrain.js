import { elevationAt } from './elevation.js';

// Dalaman 01/19: DHMI aerodrome chart, 09 July 2026; true runway bearing.
export const RUNWAY = Object.freeze({ x: 2200, z: -5500, elevation: 6.1, length: 3000, width: 45, heading: 15.35 });

// Unknown ground is deterministic zero; physics checks readiness before advancing.
export function terrainHeight(x, z) { return elevationAt(x, z).height; }
export function terrainReady(x, z) { return elevationAt(x, z).ready; }
