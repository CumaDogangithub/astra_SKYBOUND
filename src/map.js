import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './map.css';
import { worldToGeo, DALAMAN, distanceNm } from './geo.js';

const maps = new WeakMap();
const AIRPORT = [DALAMAN.lat, DALAMAN.lng];
const PROVIDERS = {
  street: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    credit: '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>',
    maxNativeZoom: 19,
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    credit: '<a href="https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9" target="_blank" rel="noopener noreferrer">Imagery © Esri, Maxar, Earthstar Geographics, GIS User Community</a>',
    maxNativeZoom: 18,
  },
};
const planeMarkup = '<span class="real-map-plane-rotation"><svg viewBox="0 0 28 28" aria-hidden="true"><path d="M14 1.5 16.1 10 25 15v3l-9-2.5-.4 6 3.2 2V26L14 24.6 9.2 26v-2.5l3.2-2-.4-6L3 18v-3l8.9-5Z"/></svg></span>';

/** Both maps use geographic tiles. The large map supports pan, zoom and selection. */
export function mapMarkup(id = 'nav-map') {
  const safeId = String(id).replace(/[^a-zA-Z0-9_-]/g, '-') || 'nav-map';
  const mini = safeId === 'mini-map';
  return `<div id="${safeId}" class="navigation-map real-navigation-map ${mini ? 'navigation-map--mini' : 'navigation-map--large'}" data-map-size="${mini ? 'mini' : 'large'}">
    <div class="real-map-viewport" aria-label="${mini ? 'Uçağın gerçek dünya navigasyon haritası' : 'Dünya haritası: yakınlaştır, sürükle ve uçuş noktası seç'}"></div>
    <span class="real-map-north" aria-label="Kuzey">N<span>▲</span></span>
    ${mini ? '' : '<div class="real-map-tools" aria-label="Harita araçları"><div class="real-map-layers"><button type="button" data-map-layer="street" aria-pressed="true">Harita</button><button type="button" data-map-layer="satellite" aria-pressed="false">Uydu</button></div><button type="button" class="real-map-recenter" data-map-recenter title="Uçağa dön ve takip et">⌖ <span>Uçağa dön</span></button></div>'}
    <div class="real-map-status" role="status" aria-live="polite"><span data-map-status-text>Harita yükleniyor…</span><button type="button" data-map-retry hidden>Yeniden dene</button></div>
    <div class="real-map-attribution">${PROVIDERS.street.credit}</div>
  </div>`;
}

function setStatus(record, status) {
  if (record.destroyed) return;
  const statusNode = record.container.querySelector('.real-map-status');
  const textNode = record.container.querySelector('[data-map-status-text]');
  const retry = record.container.querySelector('[data-map-retry]');
  statusNode.hidden = status === 'ready';
  statusNode.classList.toggle('is-error', status === 'error');
  retry.hidden = status !== 'error';
  textNode.textContent = status === 'error' ? 'Harita yüklenemedi.' : 'Harita yükleniyor…';
  record.container.dataset.mapStatus = status;
}

function clearLoadingTimer(record) {
  if (record.loadingTimer) clearTimeout(record.loadingTimer);
  record.loadingTimer = 0;
}

function startLoadingTimer(record) {
  clearLoadingTimer(record);
  record.loadingTimer = setTimeout(() => {
    record.loadingTimer = 0;
    setStatus(record, 'error');
  }, 15000);
}

function installLayer(record, type) {
  if (record.layer) {
    record.layer.off();
    record.map.removeLayer(record.layer);
  }
  clearLoadingTimer(record);
  record.layerType = type;
  record.failedTiles.clear();
  record.loadedTiles = 0;
  record.container.querySelector('.real-map-attribution').innerHTML = PROVIDERS[type].credit;
  record.container.querySelectorAll('[data-map-layer]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.mapLayer === type));
  });
  setStatus(record, 'loading');
  const layer = L.tileLayer(PROVIDERS[type].url, {
    minZoom: 2,
    maxZoom: 19,
    maxNativeZoom: PROVIDERS[type].maxNativeZoom,
    keepBuffer: 1,
    updateWhenIdle: true,
    updateWhenZooming: false,
    detectRetina: false,
    // Normal browser image requests retain HTTP caching and the browser's Referer.
    // Only visible tiles and a one-tile buffer are requested; no offline prefetch.
  });
  layer.on('loading', () => {
    startLoadingTimer(record);
    if (!record.loadedTiles && !record.failedTiles.size) setStatus(record, 'loading');
  });
  layer.on('tileload', event => {
    record.loadedTiles += 1;
    record.failedTiles.delete(event.tile.src);
    if (!record.failedTiles.size) setStatus(record, 'ready');
  });
  layer.on('tileerror', event => {
    record.failedTiles.add(event.tile.src);
    setStatus(record, 'error');
  });
  layer.on('tileunload', event => {
    record.failedTiles.delete(event.tile.src);
  });
  layer.on('load', () => {
    clearLoadingTimer(record);
    setStatus(record, record.failedTiles.size || !record.loadedTiles ? 'error' : 'ready');
  });
  record.layer = layer;
  layer.addTo(record.map);
  startLoadingTimer(record);
}

function createMap(container, position) {
  const mini = container.dataset.mapSize === 'mini';
  const viewport = container.querySelector('.real-map-viewport');
  if (!viewport) return null;
  const map = L.map(viewport, {
    attributionControl: false,
    zoomControl: false,
    dragging: !mini,
    touchZoom: !mini,
    scrollWheelZoom: !mini,
    doubleClickZoom: !mini,
    boxZoom: !mini,
    keyboard: !mini,
    zoomAnimation: false,
    fadeAnimation: false,
    markerZoomAnimation: false,
    minZoom: 2,
    maxZoom: 19,
    worldCopyJump: true,
  });
  const record = {
    container, map, mini, position, follow: mini, layer: null, layerType: 'street',
    failedTiles: new Set(), loadedTiles: 0, loadingTimer: 0,
    lastUpdate: -Infinity, lastFollow: -Infinity, lastTrail: -Infinity,
    trailPoints: [], lastFlightTime: null, destroyed: false, selectedMarker: null,
  };
  maps.set(container, record);
  if (mini) map.setView(position, 10, { animate: false });
  else {
    map.fitBounds(L.latLngBounds([position, AIRPORT]), { padding: [55, 55], maxZoom: 12, animate: false });
    L.control.zoom({ position: 'topleft', zoomInTitle: 'Yakınlaştır', zoomOutTitle: 'Uzaklaştır' }).addTo(map);
    L.control.scale({ position: 'bottomleft', imperial: false, maxWidth: 90 }).addTo(map);
  }
  installLayer(record, container.dataset.mapLayer === 'satellite' ? 'satellite' : 'street');
  record.route = L.polyline([position, AIRPORT], {
    color: '#b77627', weight: mini ? 2 : 2.5, opacity: .95, dashArray: '6 7', interactive: false,
  }).addTo(map);
  record.trail = L.polyline([], { color: '#146f77', weight: 2.5, opacity: .9, interactive: false }).addTo(map);
  record.airport = L.marker(AIRPORT, {
    icon: L.divIcon({ className: 'real-map-airport', html: '<span>✈</span>', iconSize: [24, 24], iconAnchor: [12, 12] }),
    title: 'Dalaman Havalimanı · LTBS', keyboard: !mini,
  }).addTo(map);
  if (!mini) record.airport.bindTooltip('Dalaman · LTBS', { direction: 'right', offset: [10, 0], className: 'real-map-tooltip' });
  record.aircraft = L.marker(position, {
    icon: L.divIcon({ className: 'real-map-aircraft', html: planeMarkup, iconSize: [32, 32], iconAnchor: [16, 16] }),
    interactive: false, keyboard: false, zIndexOffset: 200,
  }).addTo(map);
  if (!mini) record.aircraft.bindTooltip('TC-SKY', { permanent: true, direction: 'right', offset: [13, 0], className: 'real-map-tooltip real-map-callsign' });
  record.rotation = record.aircraft.getElement()?.querySelector('.real-map-plane-rotation');

  const onControlClick = event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.hasAttribute('data-map-retry')) {
      record.failedTiles.clear();
      record.loadedTiles = 0;
      setStatus(record, 'loading');
      startLoadingTimer(record);
      record.layer.redraw();
    }
    if (button.dataset.mapLayer) setMapLayer(container, button.dataset.mapLayer);
    if (button.hasAttribute('data-map-recenter')) recenterMap(container);
  };
  container.addEventListener('click', onControlClick);
  record.removeControls = () => container.removeEventListener('click', onControlClick);
  if (!mini) {
    map.on('dragstart', () => { record.follow = false; });
    map.on('click', event => {
      const lat = Math.max(-85.05112878, Math.min(85.05112878, event.latlng.lat));
      const lng = ((event.latlng.lng + 180) % 360 + 360) % 360 - 180;
      const selected = [lat, lng];
      if (record.selectedMarker) record.selectedMarker.setLatLng(selected);
      else record.selectedMarker = L.circleMarker(selected, {
        radius: 7, color: '#162e24', weight: 2, fillColor: '#d5eb91', fillOpacity: .95,
      }).addTo(map);
      record.follow = false;
      container.dispatchEvent(new CustomEvent('map-location-selected', { bubbles: true, detail: { lat, lng } }));
    });
  }
  if (typeof ResizeObserver !== 'undefined') {
    record.resizeObserver = new ResizeObserver(() => {
      if (!record.destroyed) map.invalidateSize({ animate: false, pan: false });
    });
    record.resizeObserver.observe(viewport);
  }
  return record;
}

/** Update aircraft heading in degrees and position using the shared world projection. */
export function updateMap(container, state) {
  if (!container?.isConnected || !state) return;
  const world = state.position || state;
  if (!Number.isFinite(world.x) || !Number.isFinite(world.z)) return;
  const geo = worldToGeo(world.x, world.z);
  if (!Number.isFinite(geo.lat) || !Number.isFinite(geo.lng)) return;
  const position = [geo.lat, geo.lng];
  const record = maps.get(container) || createMap(container, position);
  if (!record) return;
  const now = performance.now();
  if (now - record.lastUpdate < 100) return;
  record.lastUpdate = now;
  const jump = distanceNm({ lat: record.position[0], lng: record.position[1] }, geo) > 2;
  const restarted = Number.isFinite(state.flightTime) && record.lastFlightTime !== null && state.flightTime < record.lastFlightTime;
  if (jump || restarted) {
    record.trailPoints.length = 0;
    record.trail.setLatLngs([]);
    record.lastTrail = -Infinity;
  }
  record.position = position;
  record.lastFlightTime = Number.isFinite(state.flightTime) ? state.flightTime : null;
  record.aircraft.setLatLng(position);
  record.route.setLatLngs([position, AIRPORT]);
  const heading = Number(state.heading ?? world.heading ?? 0);
  if (record.rotation && Number.isFinite(heading)) record.rotation.style.transform = `rotate(${heading}deg)`;
  if (now - record.lastTrail >= 1000) {
    record.lastTrail = now;
    const previous = record.trailPoints.at(-1);
    if (!previous || distanceNm({ lat: previous[0], lng: previous[1] }, geo) > .003) {
      record.trailPoints.push(position);
      if (record.trailPoints.length > 500) record.trailPoints.shift();
      record.trail.setLatLngs(record.trailPoints);
    }
  }
  if (record.follow && now - record.lastFollow >= 1000) {
    record.lastFollow = now;
    record.map.panTo(position, { animate: false });
  }
}

/** Resume tracking after panning the large map. */
export function recenterMap(container) {
  const record = maps.get(container);
  if (!record) return;
  record.follow = true;
  record.lastFollow = performance.now();
  record.map.setView(record.position, Math.max(record.map.getZoom(), record.mini ? 10 : 11), { animate: false });
}

/** Tile sources require no account or API key. Failed requests remain visibly reported. */
export function setMapLayer(container, type) {
  if (!container || !Object.hasOwn(PROVIDERS, type)) return;
  container.dataset.mapLayer = type;
  const record = maps.get(container);
  if (record && record.layerType !== type) installLayer(record, type);
}

/** Call before removing a modal map from the DOM. */
export function destroyMap(container) {
  const record = maps.get(container);
  if (!record) return;
  record.destroyed = true;
  clearLoadingTimer(record);
  record.resizeObserver?.disconnect();
  record.removeControls();
  record.layer?.off();
  record.map.remove();
  maps.delete(container);
}
