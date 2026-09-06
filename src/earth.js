import * as THREE from 'three';
import { worldToGeo, geoToTile, tileWorldBounds } from './geo.js';
import { ELEVATION_ZOOM, decodeTerrarium, storeElevationTile, getElevationTile, removeElevationTile, sampleElevationData } from './elevation.js';
import { terrainHeight, terrainReady } from './terrain.js';

const BASE_ZOOM = ELEVATION_ZOOM;
const DETAIL_ZOOM = 14;
const GROUND_DETAIL_ZOOM = 16;
const MAX_REQUESTS = 6;
const MAX_RECORDS = 80;
const BASE_SEGMENTS = 128;
const IMAGERY = 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile';
const keyFor = (zoom, x, y) => `${zoom}/${x}/${y}`;
const pending = status => status === 'queued' || status === 'loading';

export function createEarth(scene, initialPosition) {
  const group = new THREE.Group(); group.name = 'real-world-satellite-terrain'; scene.add(group);
  const records = new Map(), desired = new Set(), queue = [];
  let requests = 0, disposed = false, sequence = 0, currentPosition = { ...initialPosition }, regionKey = '';
  let resolveReady, initialKey;
  const ready = new Promise(resolve => { resolveReady = resolve; });

  function createMaterial(detail) {
    const material = new THREE.MeshBasicMaterial({ color: '#78868a', fog: true, toneMapped: false });
    if (detail) { material.polygonOffset = true; material.polygonOffsetFactor = -2; material.polygonOffsetUnits = -2; }
    return material;
  }

  function makeRecord(zoom, x, y) {
    const key = keyFor(zoom, x, y), existing = records.get(key);
    if (existing) { existing.used = ++sequence; existing.mesh.visible = true; return existing; }
    const detail = zoom > BASE_ZOOM, bounds = tileWorldBounds(x, y, zoom);
    const segments = BASE_SEGMENTS / 2 ** (zoom - BASE_ZOOM);
    const geometry = new THREE.PlaneGeometry(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ, segments, segments);
    geometry.rotateX(-Math.PI / 2);
    geometry.translate((bounds.minX + bounds.maxX) / 2, 0, (bounds.minZ + bounds.maxZ) / 2);
    const mesh = new THREE.Mesh(geometry, createMaterial(detail)); mesh.frustumCulled = true;
    mesh.name = `satellite-${key}`; mesh.visible = !detail; group.add(mesh);
    const record = { key, zoom, x, y, bounds, segments, mesh, used: ++sequence, imagery: 'queued', elevation: detail ? 'shared' : 'queued', controllers: new Set(), disposed: false };
    records.set(key, record);
    updateHeights(record);
    return record;
  }

  function updateHeights(record) {
    if (record.disposed) return;
    const factor = 2 ** (record.zoom - BASE_ZOOM), parentX = Math.floor(record.x / factor), parentY = Math.floor(record.y / factor);
    const data = getElevationTile(parentX, parentY);
    if (!data) return;
    const offsetU = (record.x % factor) / factor, offsetV = (record.y % factor) / factor;
    const positions = record.mesh.geometry.attributes.position, n = record.segments;
    for (let row = 0; row <= n; row++) for (let col = 0; col <= n; col++) {
      const height = sampleElevationData(data, offsetU + col / n / factor, offsetV + row / n / factor);
      positions.setY(row * (n + 1) + col, Math.max(0, height));
    }
    positions.needsUpdate = true; record.mesh.geometry.computeVertexNormals(); record.mesh.geometry.computeBoundingSphere();
  }

  async function fetchBitmap(url, record, imagery = false) {
    const controller = new AbortController(); record.controllers.add(controller);
    const timeout = setTimeout(() => controller.abort(), 14000);
    try {
      const response = await fetch(url, { signal: controller.signal, mode: 'cors', credentials: 'omit', cache: 'default' });
      if (!response.ok) throw new Error(`Harita sağlayıcısı HTTP ${response.status}`);
      const blob = await response.blob();
      if (blob.size < 30) throw new Error('Harita döşemesi boş');
      return await createImageBitmap(blob, { imageOrientation: imagery ? 'flipY' : 'none', premultiplyAlpha: 'none', colorSpaceConversion: imagery ? 'default' : 'none' });
    } finally { clearTimeout(timeout); record.controllers.delete(controller); }
  }

  async function runJob(job) {
    const { record, kind } = job;
    if (record.disposed || disposed) return;
    record[kind] = 'loading';
    try {
      if (kind === 'imagery') {
        const bitmap = await fetchBitmap(`${IMAGERY}/${record.zoom}/${record.y}/${record.x}`, record, true);
        if (record.disposed || disposed) { bitmap.close(); return; }
        const texture = new THREE.Texture(bitmap); texture.colorSpace = THREE.SRGBColorSpace;
        texture.flipY = false; texture.anisotropy = 8; texture.needsUpdate = true;
        record.mesh.material.map = texture; record.mesh.material.color.set('#ffffff'); record.mesh.material.needsUpdate = true;
        record.mesh.visible = desired.has(record.key);
      } else {
        // This narrow same-origin route streams the public Mapzen AWS source;
        // the source itself does not send browser CORS headers. No API key.
        const bitmap = await fetchBitmap(`/map-tiles/elevation/${record.zoom}/${record.x}/${record.y}.png`, record);
        if (record.disposed || disposed) { bitmap.close(); return; }
        const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
        const context = canvas.getContext('2d', { willReadFrequently: true }); context.drawImage(bitmap, 0, 0); bitmap.close();
        const data = decodeTerrarium(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
        storeElevationTile(record.x, record.y, data, record.zoom);
        updateHeights(record);
        for (const child of records.values()) {
          const factor = 2 ** (child.zoom - BASE_ZOOM);
          if (child.zoom > BASE_ZOOM && Math.floor(child.x / factor) === record.x && Math.floor(child.y / factor) === record.y) updateHeights(child);
        }
      }
      record[kind] = 'loaded';
    } catch (error) {
      if (!record.disposed && !disposed) {
        record[kind] = error.name === 'AbortError' && !desired.has(record.key) ? 'queued' : 'failed';
        if (record[kind] === 'failed') record.error = error.message;
      }
    } finally { settleReady(); }
  }

  function pump() {
    if (disposed) return;
    queue.sort((a, b) => a.priority - b.priority);
    while (requests < MAX_REQUESTS && queue.length) {
      const job = queue.shift();
      if (job.record.disposed || !desired.has(job.record.key) || job.record[job.kind] !== 'queued') continue;
      requests++;
      runJob(job).finally(() => { requests--; evict(); pump(); });
    }
  }

  function queueRecord(record, priority, retry = false) {
    for (const kind of record.zoom === BASE_ZOOM ? ['elevation', 'imagery'] : ['imagery']) {
      if (retry && record[kind] === 'failed') record[kind] = 'queued';
      if (record[kind] !== 'queued' || queue.some(job => job.record === record && job.kind === kind)) continue;
      queue.push({ record, kind, priority: priority + (kind === 'elevation' ? -.2 : 0) });
    }
  }

  function discard(record) {
    record.disposed = true; record.controllers.forEach(controller => controller.abort());
    group.remove(record.mesh); record.mesh.geometry.dispose();
    record.mesh.material.map?.image?.close?.(); record.mesh.material.map?.dispose(); record.mesh.material.dispose();
    if (record.zoom === BASE_ZOOM) removeElevationTile(record.x, record.y);
    records.delete(record.key);
  }
  function evict() {
    if (records.size <= MAX_RECORDS) return;
    const candidates = [...records.values()].filter(record => !desired.has(record.key)).sort((a, b) => a.used - b.used);
    while (records.size > MAX_RECORDS && candidates.length) discard(candidates.shift());
  }

  function update(position) {
    if (disposed || !position) return;
    currentPosition = { ...position };
    const agl = position.y - Math.max(0, terrainHeight(position.x, position.z));
    const detailZoom = agl < 180 ? GROUND_DETAIL_ZOOM : DETAIL_ZOOM;
    const { lat, lng } = worldToGeo(position.x, position.z), base = geoToTile(lat, lng, BASE_ZOOM), detail = geoToTile(lat, lng, detailZoom);
    const bx = Math.floor(base.x), by = Math.floor(base.y), dx = Math.floor(detail.x), dy = Math.floor(detail.y);
    const nextKey = `${bx}/${by}/${detailZoom}/${dx}/${dy}`;
    if (nextKey === regionKey) return;
    regionKey = nextKey; desired.clear();
    const wanted = [];
    for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) wanted.push({ zoom: BASE_ZOOM, x: bx + x, y: by + y, priority: x * x + y * y });
    for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) wanted.push({ zoom: detailZoom, x: dx + x, y: dy + y, priority: .8 + (x * x + y * y) * .3 });
    wanted.sort((a, b) => a.priority - b.priority);
    for (const tile of wanted) {
      if (tile.y < 0 || tile.y >= 2 ** tile.zoom || tile.x < 0 || tile.x >= 2 ** tile.zoom) continue;
      desired.add(keyFor(tile.zoom, tile.x, tile.y));
      const record = makeRecord(tile.zoom, tile.x, tile.y); queueRecord(record, tile.priority);
    }
    for (const record of records.values()) {
      record.mesh.visible = desired.has(record.key) && (record.zoom === BASE_ZOOM || record.imagery === 'loaded');
      if (!desired.has(record.key)) record.controllers.forEach(controller => controller.abort());
    }
    for (let i = queue.length - 1; i >= 0; i--) if (!desired.has(queue[i].record.key)) queue.splice(i, 1);
    evict(); pump();
  }

  function getMapStatus() {
    const active = [...records.values()].filter(record => desired.has(record.key));
    const { lat, lng } = worldToGeo(currentPosition.x, currentPosition.z), tile = geoToTile(lat, lng, BASE_ZOOM);
    const central = records.get(keyFor(BASE_ZOOM, Math.floor(tile.x), Math.floor(tile.y)));
    return {
      mode: 'real', loading: active.filter(record => pending(record.imagery) || pending(record.elevation)).length,
      loaded: active.filter(record => record.imagery === 'loaded').length,
      failed: active.filter(record => record.imagery === 'failed' || record.elevation === 'failed').length,
      total: active.length, cached: records.size, requests,
      elevationReady: terrainReady(currentPosition.x, currentPosition.z), imageryReady: central?.imagery === 'loaded',
      elevationFailed: central?.elevation === 'failed', terrainHeight: terrainHeight(currentPosition.x, currentPosition.z),
      error: active.find(record => record.error)?.error || '',
    };
  }
  function settleReady() {
    const initial = records.get(initialKey);
    if (resolveReady && initial && !pending(initial.imagery) && !pending(initial.elevation)) { resolveReady(getMapStatus()); resolveReady = null; }
  }
  function retryMap() {
    for (const record of records.values()) if (desired.has(record.key)) queueRecord(record, 0, true);
    pump();
  }
  function dispose() {
    disposed = true; queue.length = 0;
    for (const record of [...records.values()]) discard(record);
    scene.remove(group); resolveReady?.(getMapStatus()); resolveReady = null;
  }

  const initialGeo = worldToGeo(initialPosition.x, initialPosition.z), initialTile = geoToTile(initialGeo.lat, initialGeo.lng, BASE_ZOOM);
  initialKey = keyFor(BASE_ZOOM, Math.floor(initialTile.x), Math.floor(initialTile.y));
  update(initialPosition);
  return { ready, update, getMapStatus, retryMap, dispose };
}
