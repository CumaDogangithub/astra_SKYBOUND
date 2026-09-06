import './style.css';
import { createWorld } from './world.js';
import { createFlight } from './flight.js';
import { terrainHeight, terrainReady, RUNWAY } from './terrain.js';
import { mapMarkup, updateMap, destroyMap, recenterMap } from './map.js';
import { worldToGeo, distanceNm, formatCoordinates } from './geo.js';
import { icon } from './icons.js';

const aircraftSketch = `<svg class="aircraft-sketch" viewBox="0 0 160 90" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M80 5c-3 0-5 5-5 12l-2 24-57 17-5 7 62-8 3 23-17 5v3l21-3 21 3v-3l-17-5 3-23 62 8-5-7-57-17-2-24c0-7-2-12-5-12Z" fill="currentColor" fill-opacity=".75"/><path d="m76 20 4-4 4 4 1 13H75Z" fill="#273d37"/><path d="M47 43v25m66-25v25" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><path d="M37 42h20m46 0h20" stroke="currentColor" stroke-width="1.5"/><path d="m20 61 50-12m70 12L90 49M80 39v43" stroke="#6c7d66" stroke-width="1"/></svg>`;
const app = document.querySelector('#app');
app.innerHTML = `
  <header class="topbar">
    <a class="brand" href="/" aria-label="Skybound ana sayfa"><span class="brand-mark">${icon('aircraft')}</span><div><div class="brand-name">SKYBOUND</div><div class="brand-sub">FLIGHT SIMULATOR</div></div></a>
    <nav class="nav" aria-label="Ana menü">
      <button class="nav-button active" data-action="freeflight" aria-label="Serbest uçuş">${icon('compass')}<span>Serbest uçuş</span></button>
      <button class="nav-button" data-action="missions" aria-label="Uçuş planı">${icon('route')}<span>Uçuş planı</span></button>
      <button class="nav-button" data-action="hangar" aria-label="Uçak hangarı">${icon('aircraft')}<span>Uçak hangarı</span></button>
    </nav>
    <div class="top-right"><span class="live-tag"><i class="dot"></i> DÜNYAYI KEŞFET</span><span class="separator"></span><button class="icon-btn" data-action="settings" aria-label="Ayarlar" title="Ayarlar">${icon('settings')}</button><button class="pilot-avatar" data-action="help" aria-label="Pilot rehberi" title="Pilot rehberi">SK</button></div>
  </header>
  <main class="simulator" aria-label="Uçuş simülatörü">
    <div id="world"></div><div class="scene-vignette"></div>
    <div class="scene-topline"><button class="breadcrumb" data-action="map" aria-label="Dünya haritasını aç"><span>GERÇEK DÜNYA</span>${icon('chevron')}<span id="region-label">TÜRKİYE</span>${icon('chevron')}<span id="area-label">GÖCEK · DALAMAN</span></button>
      <button class="weather-chip" data-action="settings" aria-label="Hava durumunu değiştir"><span class="sun-icon" id="weather-icon">${icon('sunset')}</span><span class="weather-temp mono" id="temperature">24°</span><span class="weather-divider"></span><span class="weather-wind">${icon('wind')}<span class="mono">270° / 04 KT</span></span><span class="local-time mono" id="weather-time">18:42 LT</span></button>
    </div>
    <section class="flight-panel" aria-label="Uçuş bilgileri">
      <div class="panel-heading"><span class="eyebrow">BİR SONRAKİ MACERAN</span><span class="session-tag">SERBEST UÇUŞ</span></div>
      <h1 id="mission-title">Gökyüzü seni bekliyor.</h1>
      <p class="location">${icon('pin')}<span id="mission-location">Göcek, Muğla · Türkiye</span></p>
      <p class="flight-description" id="mission-description">Turkuaz koylar, yemyeşil dağlar ve sonsuz bir ufuk. Akdeniz'i bir de gökyüzünden keşfet.</p>
      <div class="aircraft-card">${aircraftSketch}<div class="aircraft-info"><strong>Skybound S62</strong><small>ÇİFT MOTOR · TC-SKY</small></div><button data-action="hangar" aria-label="Uçak detaylarını aç">${icon('chevron')}</button></div>
      <div class="flight-details"><div class="flight-detail"><span>UÇUŞ TÜRÜ</span><strong id="mission-kind">Kıyı keşfi</strong></div><div class="flight-detail"><span>BAŞLANGIÇ İRTİFASI</span><strong id="mission-altitude">2.953 <small>FT</small></strong></div><div class="flight-detail"><span>HAVA DURUMU</span><strong id="weather-description">Gün batımı</strong></div><div class="flight-detail"><span>ZORLUK</span><strong>Rahat <small>· Başlangıç</small></strong></div></div>
      <div class="panel-footer"><button class="primary-button" data-action="fly" id="fly-button">${icon('play')}<span>Uçuşa başla</span><span class="button-shortcut">ENTER</span></button><p>${icon('keyboard')} Klavye veya dokunmatik kontrollerle uç</p></div>
    </section>
    <div class="compass" aria-hidden="true"><div class="compass-degree"><span id="compass-heading">000</span><small id="compass-direction">N</small></div><div class="compass-tape" id="compass-tape"><span>300</span><span>330</span><span>NW</span><span class="north">N</span><span>NE</span><span>030</span><span>060</span></div></div>
    <div class="hud" id="hud" aria-hidden="true"><div class="hud-line"></div><div class="hud-line"></div><div class="hud-line"></div><div class="hud-wings"></div><div class="hud-center"></div><span class="hud-tick">10</span></div>
    <div class="right-controls"><div class="camera-control" role="group" aria-label="Kamera açısı"><button class="camera-button selected" data-camera="chase" aria-label="Takip kamerası" title="Takip kamerası" aria-pressed="true">${icon('aircraft')}</button><button class="camera-button" data-camera="cockpit" aria-label="Kokpit kamerası" title="Kokpit kamerası" aria-pressed="false">${icon('gauge')}</button><button class="camera-button" data-camera="orbit" aria-label="Sinematik kamera" title="Sinematik kamera" aria-pressed="false">${icon('camera')}</button></div><span class="camera-label" id="camera-label">TAKİP KAMERASI</span></div>
    <div class="location-title"><div class="eyebrow">GERÇEK COĞRAFYA · ÖZGÜR UÇUŞ</div><h2 id="scenery-title">Türk Rivierası</h2><p id="live-coordinates">36.7245° N · 28.9235° E</p></div>
    <div class="coordinate-line mono"><span id="earth-status" role="status">GERÇEK DÜNYA YÜKLENİYOR</span><button data-action="retry-earth" id="retry-earth" class="hidden">Yeniden dene</button></div>
    <div class="world-attribution"><a href="https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9" target="_blank" rel="noopener noreferrer">Uydu © Esri, Maxar, Earthstar Geographics, GIS User Community</a><span> · </span><a href="/data-sources.html" target="_blank" rel="noopener">Arazi: Mapzen, Copernicus, USGS · Tüm kaynaklar</a></div>
    <section class="nav-panel" aria-label="Navigasyon"><div class="nav-heading"><span>${icon('compass')} NAVİGASYON</span><button data-action="map" aria-label="Haritayı büyüt" title="Haritayı büyüt">${icon('expand')}</button></div><div class="nav-map-wrap">${mapMarkup('mini-map')}</div><div class="nav-bottom"><div>${icon('flag')}<span>Dalaman <strong>LTBS</strong></span></div><span class="mono" id="destination-distance">3.7 NM</span></div></section>
    <div class="view-toolbar"><button class="icon-btn" data-action="fly" id="pause-button" aria-label="Uçuşu başlat" title="Başlat / duraklat (P)">${icon('play')}</button><span class="tool-key">P</span><span class="toolbar-divider"></span><button class="icon-btn" data-action="reset" aria-label="Uçuşu yeniden başlat" title="Yeniden başlat (R)">${icon('reset')}</button><button class="icon-btn" data-action="sound" id="sound-button" aria-label="Sesi aç" aria-pressed="false" title="Motor sesi (M)">${icon('mute')}</button><span class="toolbar-divider"></span><button class="icon-btn" data-action="help" aria-label="Kontroller" title="Kontroller (H)">${icon('keyboard')}</button><button class="icon-btn" data-action="fullscreen" aria-label="Tam ekran" title="Tam ekran">${icon('expand')}</button></div>
    <div class="mobile-controls" aria-label="Dokunmatik uçuş kontrolleri"><button data-touch="pitch-up" aria-label="Burun yukarı">↑</button><button data-touch="roll-left" aria-label="Sola yatış">←</button><button data-touch="pitch-down" aria-label="Burun aşağı">↓</button><button data-touch="roll-right" aria-label="Sağa yatış">→</button></div>
    <div id="flight-alert" class="flight-alert hidden" role="status"></div><div id="paused-overlay" class="paused-overlay hidden"><div class="pause-symbol">${icon('pause')}</div><h2>Bir nefeslik mola.</h2><p>Devam etmek için P tuşuna bas.</p></div><div id="toast" class="toast" role="status"></div>
  </main>
  <footer class="instrument-deck"><div class="instruments">
    <div class="instrument"><div class="instrument-label">HAVA HIZI</div><div class="instrument-value accent"><span id="airspeed">112</span><small>KTS</small></div><div class="tiny-bar"><span id="airspeed-bar"></span></div></div>
    <div class="instrument"><div class="instrument-label">İRTİFA</div><div class="instrument-value"><span id="altitude">2.953</span><small>FT</small></div></div>
    <div class="instrument"><div class="instrument-label">PUSULA</div><div class="instrument-value"><span id="heading">000</span><small>DEG</small></div></div>
    <div class="instrument"><div class="instrument-label">DİKEY HIZ</div><div class="instrument-value"><span id="vertical-speed">0</span><small>FT/MIN</small></div></div>
    <div class="instrument"><div class="instrument-label">MOTOR DEVRİ</div><div class="instrument-value"><span id="rpm">2.300</span><small>RPM</small></div></div>
    <div class="instrument throttle-instrument"><div class="throttle-head"><label class="instrument-label" for="throttle">GAZ KOLU</label><div class="instrument-value"><span id="throttle-value">65</span><small>%</small></div></div><input class="throttle-input" type="range" min="0" max="100" value="65" id="throttle" aria-label="Gaz kolu"/><div class="throttle-ticks"><span>IDLE</span><span>50</span><span>MAX</span></div></div>
    <div class="instrument"><div class="instrument-label">YAKIT</div><div class="instrument-value"><span id="fuel">94</span><small>%</small></div><div class="fuel-bar"><span id="fuel-bar"></span></div></div>
  </div><div class="statusbar"><div class="status-left"><span class="status-item status-active"><i class="dot"></i><span id="flight-status">UÇUŞA HAZIR</span></span><span class="status-item mono" id="flight-time">00:00:00</span><span class="status-item aircraft-status">TC-SKY <span style="opacity:.4">/</span> S62</span></div><div class="status-right"><button data-action="autopilot" id="autopilot-button" aria-pressed="false">OTOPİLOT <span class="status-key">Z</span></button><button data-action="gear" id="gear-button" aria-pressed="false">İNİŞ TAKIMI <span class="status-key">G</span></button><button data-action="flaps" id="flaps-button" aria-pressed="false">FLAP <span class="status-key">F</span></button><span class="fps-label mono" id="fps">60 FPS</span></div></div></footer>
  <div id="modal-root"></div>`;

const flight = createFlight({ terrainHeight, runway: RUNWAY });
const state = flight.state;
const $ = id => document.getElementById(id);
let world;
try { world = createWorld($('world'), state); }
catch (error) {
  console.error('3B sahne başlatılamadı:', error);
  $('world').innerHTML = `<div class="webgl-error"><h2>Gökyüzüne bağlanamadık.</h2><p>Bu simülatör WebGL destekli bir tarayıcı gerektiriyor. Tarayıcının donanım hızlandırmasını etkinleştirip sayfayı yenile.</p></div>`;
  $('fly-button').disabled = true;
}

const preferences = { weather: 'sunset', sound: false, hud: true, livery: '#34443b' };
try { Object.assign(preferences, JSON.parse(localStorage.getItem('skybound-preferences') || '{}')); } catch { /* Defaults also work with storage disabled. */ }
if (!['clear', 'sunset', 'cloudy'].includes(preferences.weather)) preferences.weather = 'sunset';
let cameraMode = 'chase', activeLocation = 'coast', selectedLocation = 'coast', modalType = null, modalReturnFocus = null, resumeAfterModal = false;
let toastTimer, soundContext, engineOscillators = [], engineGain;
let previousTime = 0, hudAccumulator = 0, fpsElapsed = 0, frameCount = 0, lastCrashed = false, lastLanded = false;
let pendingMapSelection = null, terrainWaiting = false, terrainNeedsRefresh = true;
const keys = new Set(), touch = new Set();
const refs = Object.fromEntries(['airspeed', 'altitude', 'heading', 'vertical-speed', 'rpm', 'throttle-value', 'throttle', 'fuel', 'fuel-bar', 'airspeed-bar', 'compass-heading', 'compass-direction', 'compass-tape', 'flight-time', 'flight-status', 'flight-alert', 'destination-distance', 'mini-map'].map(id => [id, $(id)]));
const fmt = value => Math.round(value).toLocaleString('tr-TR');
const destinations = {
  coast: { title: 'Gökyüzü seni bekliyor.', location: 'Göcek, Muğla · Türkiye', description: "Turkuaz koylar, yemyeşil dağlar ve sonsuz bir ufuk. Akdeniz'i bir de gökyüzünden keşfet.", kind: 'Kıyı keşfi', scenery: 'Türk Rivierası' },
  runway: { title: 'Maceraya kanat aç.', location: 'Dalaman Havalimanı · LTBS', description: 'Gazı aç, 65 knot hıza ulaş ve burnu yukarı kaldır. İlerideki dağları aşana kadar tırmanmaya devam et.', kind: 'Pistten kalkış', scenery: 'Dalaman' },
  mountains: { title: 'Zirvelerin ötesine.', location: 'Toros Dağları · Muğla', description: 'Dağların arasında yeni bir rota çiz. İrtifanı koru, ufka odaklan ve manzaranın tadını çıkar.', kind: 'Dağ keşfi', scenery: 'Toros Dağları' },
  custom: { title: 'Dünya senin rotan.', location: 'Haritadan seçilen konum', description: 'Gerçek uydu görüntüleri üzerinde kendi rotanı çiz. Haritayı açarak dünyanın başka bir noktasına geçebilirsin.', kind: 'Dünya keşfi', scenery: 'Yeni ufuklar' },
};

function savePreferences() { try { localStorage.setItem('skybound-preferences', JSON.stringify(preferences)); } catch { /* Storage is optional. */ } }
function notify(message) {
  clearTimeout(toastTimer); $('toast').innerHTML = `${icon('info')}<span>${message}</span>`;
  $('toast').classList.add('visible'); toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 3200);
}
function initializeSound() {
  if (!soundContext) {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) { notify('Bu tarayıcı motor sesini desteklemiyor.'); preferences.sound = false; return; }
    soundContext = new Audio(); engineGain = soundContext.createGain(); engineGain.gain.value = 0; engineGain.connect(soundContext.destination);
    const filter = soundContext.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 240; filter.connect(engineGain);
    [1, 1.008, 2].forEach((ratio, i) => { const oscillator = soundContext.createOscillator(); oscillator.type = i === 2 ? 'sine' : 'sawtooth'; oscillator.frequency.value = 65 * ratio; oscillator.connect(filter); oscillator.start(); engineOscillators.push({ oscillator, ratio }); });
  }
  soundContext.resume().catch(() => {});
}
function updateSound() {
  if (!soundContext) return;
  const audible = preferences.sound && state.status === 'flying';
  engineGain.gain.setTargetAtTime(audible ? .014 + state.throttle * .00018 : 0, soundContext.currentTime, .15);
  engineOscillators.forEach(({ oscillator, ratio }) => oscillator.frequency.setTargetAtTime((35 + state.rpm / 42) * ratio, soundContext.currentTime, .15));
}
function toggleSound() {
  preferences.sound = !preferences.sound;
  if (preferences.sound) initializeSound();
  applySoundUI(); savePreferences(); updateSound(); notify(preferences.sound ? 'Motor sesi açıldı.' : 'Motor sesi kapatıldı.');
}
function applySoundUI() {
  $('sound-button').innerHTML = icon(preferences.sound ? 'volume' : 'mute');
  $('sound-button').setAttribute('aria-label', preferences.sound ? 'Sesi kapat' : 'Sesi aç');
  $('sound-button').setAttribute('aria-pressed', String(preferences.sound));
}
function applyWeather() {
  world?.setWeather(preferences.weather);
  const weather = { clear: ['sun', 'Açık gökyüzü', '27°', '13:20 LT'], sunset: ['sunset', 'Gün batımı', '24°', '18:42 LT'], cloudy: ['cloud', 'Bulutlu', '19°', '15:10 LT'] }[preferences.weather];
  $('weather-icon').innerHTML = icon(weather[0]); $('weather-description').textContent = weather[1]; $('temperature').textContent = weather[2]; $('weather-time').textContent = weather[3];
  $('hud').classList.toggle('hidden', !preferences.hud); world?.setLivery?.(preferences.livery); savePreferences();
}
function setCamera(mode) {
  cameraMode = mode; world?.setCamera(mode);
  document.querySelectorAll('[data-camera]').forEach(button => { const active = button.dataset.camera === mode; button.classList.toggle('selected', active); button.setAttribute('aria-pressed', String(active)); });
  $('camera-label').textContent = { chase: 'TAKİP KAMERASI', cockpit: 'KOKPİT KAMERASI', orbit: 'SİNEMATİK KAMERA' }[mode];
}
function updateFlightButtons() {
  const flying = state.status === 'flying', ready = state.status === 'ready', crashed = state.crashed;
  $('fly-button').disabled = !world || terrainWaiting;
  $('pause-button').disabled = !world || terrainWaiting;
  $('fly-button').innerHTML = `${icon(terrainWaiting ? 'cloud' : flying ? 'pause' : crashed ? 'reset' : 'play')}<span>${terrainWaiting ? 'Arazi hazırlanıyor' : flying ? 'Uçuşu duraklat' : ready ? 'Uçuşa başla' : crashed ? 'Yeniden uç' : 'Uçuşa devam et'}</span><span class="button-shortcut">${ready ? 'ENTER' : 'P'}</span>`;
  $('pause-button').innerHTML = icon(flying ? 'pause' : 'play');
  $('pause-button').setAttribute('aria-label', flying ? 'Uçuşu duraklat' : 'Uçuşu başlat');
  document.querySelector('.flight-panel').classList.toggle('in-flight', !ready);
  $('paused-overlay').classList.toggle('hidden', state.status !== 'paused' || !!modalType || terrainWaiting);
  updateInstruments(); updateSound();
}
function toggleFlight() {
  if (!world || modalType) return;
  if (terrainWaiting) { notify('Bu konumun gerçek arazi verisi hazırlanıyor.'); return; }
  if (state.crashed) resetFlight(true);
  else {
    const starting = state.status === 'ready';
    state.status = state.status === 'flying' ? 'paused' : 'flying';
    if (preferences.sound && state.status === 'flying') initializeSound();
    if (starting) notify(state.onGround ? 'Gazı %100 aç. 65 KTS hızda ↑ ile havalan.' : 'Ok tuşlarıyla yön ver. W / S ile gazı ayarla.');
  }
  keys.clear(); updateFlightButtons();
}
function resetFlight(start = false) {
  flight.reset(activeLocation); lastCrashed = false; lastLanded = false; keys.clear(); touch.clear();
  terrainNeedsRefresh = true;
  clearTimeout(toastTimer); $('toast').classList.remove('visible');
  world?.setCamera(cameraMode); world?.update(state, 0); syncEarthStatus();
  if (start && !terrainWaiting) state.status = 'flying';
  refs['flight-alert'].classList.add('hidden'); updateFlightButtons();
  const mission = destinations[activeLocation];
  $('mission-title').textContent = mission.title; $('mission-location').textContent = mission.location; $('mission-description').textContent = mission.description;
  $('mission-kind').textContent = mission.kind; $('mission-altitude').innerHTML = `${fmt(state.altitude)} <small>FT</small>`; $('scenery-title').textContent = mission.scenery;
  $('region-label').textContent = activeLocation === 'custom' ? 'DÜNYA' : 'TÜRKİYE';
  $('area-label').textContent = activeLocation === 'custom' ? 'SEÇİLEN KONUM' : 'GÖCEK · DALAMAN';
  recenterMap(refs['mini-map']);
}

function upcomingTerrainReady() {
  const angle = state.heading * Math.PI / 180;
  const lookAhead = Math.max(8, state.speed * .514444 * 2);
  return terrainReady(state.position.x, state.position.z)
    && terrainReady(state.position.x + Math.sin(angle) * lookAhead, state.position.z - Math.cos(angle) * lookAhead);
}
function syncEarthStatus() {
  const status = world?.getMapStatus?.();
  if (!status) return;
  const wasWaiting = terrainWaiting;
  terrainWaiting = !status.elevationReady || !upcomingTerrainReady();
  if (terrainWaiting && state.status === 'flying') {
    state.status = 'paused'; keys.clear(); touch.clear();
    notify('Yeni bölgenin arazisi yüklenirken uçuş duraklatıldı.');
  }
  if (!terrainWaiting && terrainNeedsRefresh) {
    flight.refreshTerrain(); terrainNeedsRefresh = false;
    $('mission-altitude').innerHTML = `${fmt(state.altitude)} <small>FT</small>`;
  }
  $('earth-status').textContent = terrainWaiting
    ? status.loading ? 'GERÇEK ARAZİ YÜKLENİYOR…' : 'ARAZİ VERİSİ YÜKLENEMEDİ'
    : status.loading ? `UYDU GÖRÜNTÜLERİ · ${status.loaded} PARÇA` : status.failed ? 'BAZI HARİTA PARÇALARI YÜKLENEMEDİ' : 'GERÇEK DÜNYA · UYDU + YÜKSEKLİK';
  $('earth-status').dataset.error = status.error || '';
  $('retry-earth').classList.toggle('hidden', !status.failed && !(!status.loading && terrainWaiting));
  if (wasWaiting !== terrainWaiting) updateFlightButtons();
}
function toggleSystem(type) {
  if (type === 'gear') { flight.toggleGear(); notify(state.onGround ? 'İniş takımı yerdeyken açık kalır.' : `İniş takımı ${state.gear ? 'açıldı' : 'toplandı'}.`); }
  if (type === 'flaps') { flight.toggleFlaps(); notify(`Flaplar ${state.flaps ? 'açıldı · iniş hızı azaltıldı' : 'toplandı'}.`); }
  if (type === 'autopilot') { flight.toggleAutopilot(); notify(state.onGround ? 'Otopilot havalandıktan sonra kullanılabilir.' : `Otopilot ${state.autopilot ? 'açıldı · yön ve irtifa korunuyor' : 'kapatıldı'}.`); }
  updateInstruments();
}

function modalContent(type) {
  if (type === 'help') return { eyebrow: 'PİLOT REHBERİ', title: 'Kontrol sende.', body: `<p class="modal-intro">Uçuşa başla, ufka odaklan ve küçük hareketlerle yön ver. Kontrolleri bıraktığında uçak yavaşça dengelenir.</p><div class="control-list">${[
    ['Tırman / alçal', '↑', '↓'], ['Sola / sağa yatış', '←', '→'], ['Gaz artır / azalt', 'W', 'S'], ['Dümen', 'Q', 'E'], ['Duraklat / devam', 'P'], ['Kamera değiştir', 'C'], ['İniş takımı', 'G'], ['Flaplar', 'F'], ['Otopilot', 'Z'], ['Fren (pistte)', 'B'], ['Yeniden başlat', 'R'], ['Motor sesi', 'M'],
  ].map(([label, ...keyList]) => `<div class="control-row"><span>${label}</span><span class="key-group">${keyList.map(key => `<kbd>${key}</kbd>`).join('')}</span></div>`).join('')}</div><div class="tip">${icon('info')}<span><strong>İlk inişin için:</strong> Dalaman pistine hizalan, iniş takımını ve flapları aç. Gazı azalt, 55–85 KTS hızla ve yumuşak bir alçalışla piste yaklaş. Yerde B ile fren yap.</span></div>` };
  if (type === 'missions') return { eyebrow: 'YENİ BİR ROTA', title: 'Bugün nereye uçalım?', body: `<p class="modal-intro">Başlangıç noktanı seç. Her rota, keşfetmen için farklı bir manzara sunar.</p><div class="mission-options">${[
    ['coast', 'sunset', 'Akdeniz kıyıları', 'Göcek koyları üzerinde, 2.953 FT irtifada serbest uçuş.'],
    ['runway', 'route', 'İlk kalkış', 'Dalaman pistinden havalan. Gazı aç, gökyüzüne yüksel.'],
    ['mountains', 'mountain', 'Zirvelerin arasında', 'Torosların üzerinde, yüksek irtifada bir keşif uçuşu.'],
  ].map(([id, ico, title, description]) => `<button class="mission-option ${selectedLocation === id ? 'selected' : ''}" data-mission="${id}" aria-pressed="${selectedLocation === id}">${icon(ico)}<span><strong>${title}</strong><small>${description}</small></span><span class="option-indicator"></span></button>`).join('')}</div><button class="primary-button modal-action" data-action="apply-mission">${icon('check')}<span>Uçuş planını uygula</span></button>` };
  if (type === 'settings') return { eyebrow: 'SANA GÖRE BİR UÇUŞ', title: 'Uçuş ayarları', body: `<div class="setting-row"><div><strong>Gökyüzü & ışık</strong><small>Manzaranın atmosferini değiştir.</small></div><select id="weather-select" aria-label="Gökyüzü ve ışık"><option value="sunset" ${preferences.weather === 'sunset' ? 'selected' : ''}>Gün batımı</option><option value="clear" ${preferences.weather === 'clear' ? 'selected' : ''}>Açık gökyüzü</option><option value="cloudy" ${preferences.weather === 'cloudy' ? 'selected' : ''}>Bulutlu</option></select></div><div class="setting-row"><div><strong>Motor sesi</strong><small>Hıza tepki veren pervane sesi.</small></div><button class="toggle ${preferences.sound ? 'on' : ''}" data-setting="sound" role="switch" aria-checked="${preferences.sound}" aria-label="Motor sesi"></button></div><div class="setting-row"><div><strong>Uçuş kılavuzu</strong><small>Ekranın ortasındaki nişangâh çizgileri.</small></div><button class="toggle ${preferences.hud ? 'on' : ''}" data-setting="hud" role="switch" aria-checked="${preferences.hud}" aria-label="Uçuş kılavuzu"></button></div><p class="settings-note">Tercihlerin bu tarayıcıya kaydedilir. Uçuş planından başlangıç noktanı, kamera düğmelerinden görüş açını değiştirebilirsin.</p>` };
  if (type === 'map') return { eyebrow: 'GERÇEK DÜNYA HARİTASI', title: 'Bir nokta seç. Oradan uç.', body: `<div class="large-map">${mapMarkup('large-map')}</div><div class="map-info"><span>Hedef: <strong>Dalaman · LTBS</strong></span><span id="large-map-distance">${destinationDistance().toFixed(1)} NM</span></div><div class="map-departure"><div><strong id="selected-map-label">Başlangıç noktanı haritaya tıklayarak seç.</strong><small id="selected-map-coordinates">Yakınlaştır, sürükle ve dünyayı keşfet.</small></div><button class="primary-button" data-action="fly-from-map" id="fly-from-map" disabled>${icon('aircraft')}<span>Buradan uç</span></button></div><p class="map-source-note">Yol haritası OpenStreetMap, uydu görünümü Esri. Konumun, uçuş rotan ve gerçek arazi aynı koordinat sistemini kullanır.</p>` };
  return { eyebrow: 'UÇAK HANGARI', title: 'Skybound S62', body: `<div class="hangar-art">${aircraftSketch}</div><p class="modal-intro">Zarif kanatlar, iki pervane ve keşfetme özgürlüğü. S62, dengeli kontrolleriyle ilk uçuşundan itibaren yanında.</p><div class="aircraft-specs"><div><small>SEYİR HIZI</small><strong>112 KTS</strong></div><div><small>MOTOR</small><strong>Çift pervane</strong></div><div><small>TESCİL</small><strong>TC-SKY</strong></div></div><div class="setting-row"><div><strong>Gövde rengi</strong><small>Uçağı kendi tarzınla uçur.</small></div><div class="livery-options">${[['#34443b', 'Orman yeşili'], ['#38546b', 'Okyanus mavisi'], ['#733f3a', 'Gün batımı kızılı']].map(([color, label]) => `<button class="livery-option ${preferences.livery === color ? 'selected' : ''}" style="background:${color}" data-livery="${color}" aria-label="${label}" aria-pressed="${preferences.livery === color}" title="${label}"></button>`).join('')}</div></div><button class="primary-button modal-action" data-action="close-modal">${icon('aircraft')}<span>Uçuşa dön</span></button>` };
}
function openModal(type) {
  if ($('large-map')) destroyMap($('large-map'));
  if (!modalType) { resumeAfterModal = state.status === 'flying'; modalReturnFocus = document.activeElement; }
  if (state.status === 'flying') state.status = 'paused';
  keys.clear(); touch.clear(); modalType = type; selectedLocation = activeLocation; pendingMapSelection = null;
  const content = modalContent(type);
  $('modal-root').innerHTML = `<div class="modal-backdrop"><section class="modal ${type === 'map' ? 'world-map-modal' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header class="modal-header"><div><div class="eyebrow">${content.eyebrow}</div><h2 id="modal-title">${content.title}</h2></div><button class="icon-btn modal-close" data-action="close-modal" aria-label="Pencereyi kapat">${icon('close')}</button></header><div class="modal-body">${content.body}</div></section></div>`;
  updateFlightButtons(); if ($('large-map')) updateMap($('large-map'), state);
  $('modal-root').querySelector('.modal-close').focus();
}
function closeModal() {
  if (!modalType) return;
  if ($('large-map')) destroyMap($('large-map'));
  modalType = null; $('modal-root').innerHTML = '';
  if (resumeAfterModal && !state.crashed && !terrainWaiting) state.status = 'flying';
  resumeAfterModal = false; updateFlightButtons(); modalReturnFocus?.focus();
}
function destinationDistance() { return distanceNm(worldToGeo(state.position.x, state.position.z)); }
function updateInstruments() {
  refs.airspeed.textContent = Math.round(state.speed); refs.altitude.textContent = fmt(state.altitude);
  const heading = Math.round(state.heading) % 360, headingText = String(heading).padStart(3, '0');
  refs.heading.textContent = headingText; refs['compass-heading'].textContent = headingText;
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  refs['compass-direction'].textContent = directions[Math.round(heading / 45) % 8];
  const center = Math.round(heading / 30) * 30;
  refs['compass-tape'].innerHTML = [-90, -60, -30, 0, 30, 60, 90].map((offset, i) => { const value = (center + offset + 360) % 360; return `<span${i === 3 ? ' class="north"' : ''}>${value % 90 === 0 ? directions[value / 45] : String(value).padStart(3, '0')}</span>`; }).join('');
  const vertical = Math.round(state.verticalSpeed / 10) * 10 || 0; refs['vertical-speed'].textContent = `${vertical > 0 ? '+' : ''}${fmt(vertical)}`;
  refs.rpm.textContent = fmt(state.rpm); refs['throttle-value'].textContent = Math.round(state.throttle);
  if (document.activeElement !== refs.throttle) refs.throttle.value = state.throttle;
  refs.throttle.style.setProperty('--throttle', `${state.throttle}%`);
  refs.fuel.textContent = Math.round(state.fuel); refs['fuel-bar'].style.width = `${state.fuel}%`; refs['airspeed-bar'].style.width = `${Math.min(100, state.speed / 1.6)}%`;
  const seconds = Math.floor(state.flightTime); refs['flight-time'].textContent = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(n => String(n).padStart(2, '0')).join(':');
  refs['flight-status'].textContent = state.crashed ? 'UÇUŞ SONA ERDİ' : state.status === 'ready' ? 'UÇUŞA HAZIR' : state.status === 'paused' ? 'DURAKLATILDI' : state.onGround ? 'PİST ÜZERİNDE' : 'UÇUŞ DEVAM EDİYOR';
  refs['destination-distance'].textContent = `${destinationDistance().toFixed(1)} NM`;
  $('live-coordinates').textContent = formatCoordinates(state.position);
  if ($('large-map-distance')) $('large-map-distance').textContent = `${destinationDistance().toFixed(1)} NM`;
  for (const [buttonId, active] of [['gear-button', state.gear], ['flaps-button', state.flaps], ['autopilot-button', state.autopilot]]) { $(buttonId).classList.toggle('status-active', active); $(buttonId).setAttribute('aria-pressed', String(active)); }
  updateMap(refs['mini-map'], state);
  if ($('large-map')) updateMap($('large-map'), state);
  const alert = refs['flight-alert'];
  if (state.crashed) { alert.textContent = state.crashReason === 'water' ? 'SUYA TEMAS · R İLE YENİDEN BAŞLA' : 'SERT TEMAS · R İLE YENİDEN BAŞLA'; alert.classList.remove('hidden', 'landing'); }
  else if (state.stall && state.status === 'flying') { alert.textContent = 'DÜŞÜK HIZ · GAZI ARTIR, BURNU İNDİR'; alert.classList.remove('hidden', 'landing'); }
  else if (state.landed && state.onGround) { alert.textContent = 'BAŞARILI İNİŞ · B İLE FREN YAP'; alert.classList.remove('hidden'); alert.classList.add('landing'); }
  else alert.classList.add('hidden');
}

document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) { if (event.target.classList.contains('modal-backdrop')) closeModal(); return; }
  if (button.dataset.camera) { setCamera(button.dataset.camera); return; }
  if (button.dataset.mission) { selectedLocation = button.dataset.mission; document.querySelectorAll('[data-mission]').forEach(option => { const selected = option.dataset.mission === selectedLocation; option.classList.toggle('selected', selected); option.setAttribute('aria-pressed', String(selected)); }); return; }
  if (button.dataset.livery) { preferences.livery = button.dataset.livery; world?.setLivery?.(preferences.livery); savePreferences(); document.querySelectorAll('[data-livery]').forEach(option => { const selected = option.dataset.livery === preferences.livery; option.classList.toggle('selected', selected); option.setAttribute('aria-pressed', String(selected)); }); notify('Uçağın yeni rengi hazır.'); return; }
  if (button.dataset.setting) {
    const setting = button.dataset.setting;
    if (setting === 'sound') toggleSound(); else { preferences.hud = !preferences.hud; applyWeather(); }
    button.classList.toggle('on', preferences[setting]); button.setAttribute('aria-checked', String(preferences[setting])); return;
  }
  const action = button.dataset.action;
  if (['help', 'missions', 'hangar', 'settings', 'map'].includes(action)) openModal(action);
  if (action === 'close-modal') closeModal();
  if (action === 'freeflight') { closeModal(); notify('Serbest uçuş · rotanı sen belirle.'); }
  if (action === 'fly') toggleFlight();
  if (action === 'reset') { resetFlight(); notify('Uçuş başlangıç noktasına alındı.'); }
  if (action === 'sound') toggleSound();
  if (action === 'retry-earth') { world?.retryMap?.(); syncEarthStatus(); }
  if (action === 'fly-from-map' && pendingMapSelection) {
    const { lat, lng } = pendingMapSelection;
    resumeAfterModal = false; closeModal();
    if (flight.teleport(lat, lng)) {
      activeLocation = 'custom'; resetFlight();
      notify('Başlangıç noktası seçildi. Arazi hazır olduğunda uçuşa başlayabilirsin.');
    }
  }
  if (['gear', 'flaps', 'autopilot'].includes(action)) toggleSystem(action);
  if (action === 'apply-mission') { activeLocation = selectedLocation; resumeAfterModal = false; closeModal(); resetFlight(); notify('Uçuş planı hazır. Gökyüzü seni bekliyor.'); }
  if (action === 'fullscreen') {
    const promise = document.fullscreenElement ? document.exitFullscreen?.() : document.documentElement.requestFullscreen?.();
    if (promise?.catch) promise.catch(() => notify('Tam ekran bu görünümde kullanılamıyor. Tarayıcıda F11 tuşunu deneyebilirsin.'));
    else notify('Tam ekran için tarayıcıda F11 tuşunu kullanabilirsin.');
  }
});
document.addEventListener('map-location-selected', event => {
  if (modalType !== 'map') return;
  const { lat, lng } = event.detail || {};
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  pendingMapSelection = { lat, lng };
  $('selected-map-label').textContent = 'Yeni başlangıç noktan hazır.';
  $('selected-map-coordinates').textContent = `${lat.toFixed(5)}°, ${lng.toFixed(5)}°`;
  $('fly-from-map').disabled = false;
});
document.addEventListener('change', event => { if (event.target.id === 'weather-select') { preferences.weather = event.target.value; applyWeather(); } });
refs.throttle.addEventListener('input', event => { flight.setThrottle(Number(event.target.value)); updateInstruments(); });
refs.throttle.addEventListener('pointerup', () => refs.throttle.blur());
document.querySelectorAll('[data-touch]').forEach(button => {
  button.addEventListener('pointerdown', event => { event.preventDefault(); button.setPointerCapture(event.pointerId); touch.add(button.dataset.touch); button.classList.add('held'); });
  const release = () => { touch.delete(button.dataset.touch); button.classList.remove('held'); };
  button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release);
});
document.addEventListener('keydown', event => {
  if (modalType) {
    if (event.code === 'Escape') { event.preventDefault(); closeModal(); }
    if (event.code === 'Tab') {
      const focusables = [...$('modal-root').querySelectorAll('button, select, input, [tabindex="0"]')].filter(element => !element.disabled);
      const first = focusables[0], last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    return;
  }
  if (['SELECT', 'TEXTAREA'].includes(event.target.tagName)) return;
  if (event.target.tagName === 'INPUT' && (event.target.type !== 'range' || ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.code))) return;
  const flightKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyQ', 'KeyE', 'KeyB', 'Equal', 'Minus'];
  if (flightKeys.includes(event.code)) { event.preventDefault(); keys.add(event.code); }
  if (event.repeat) return;
  if (event.code === 'KeyP' || (event.code === 'Enter' && !event.target.closest('button, a'))) { event.preventDefault(); toggleFlight(); }
  if (event.code === 'Escape' && state.status === 'flying') toggleFlight();
  if (event.code === 'KeyR') { resetFlight(); notify('Yeni bir uçuşa hazırsın.'); }
  if (event.code === 'KeyC') setCamera(['chase', 'cockpit', 'orbit'][(['chase', 'cockpit', 'orbit'].indexOf(cameraMode) + 1) % 3]);
  if (event.code === 'KeyH') openModal('help');
  if (event.code === 'KeyM') toggleSound();
  if (event.code === 'KeyG') toggleSystem('gear');
  if (event.code === 'KeyF') toggleSystem('flaps');
  if (event.code === 'KeyZ') toggleSystem('autopilot');
});
document.addEventListener('keyup', event => keys.delete(event.code));
window.addEventListener('blur', () => { keys.clear(); touch.clear(); if (state.status === 'flying') { state.status = 'paused'; updateFlightButtons(); } });
document.addEventListener('visibilitychange', () => { if (document.hidden && state.status === 'flying') { state.status = 'paused'; keys.clear(); touch.clear(); updateFlightButtons(); } });
const down = (...codes) => codes.some(code => keys.has(code));
function frame(time) {
  const dt = Math.min((time - (previousTime || time)) / 1000, .06); previousTime = time;
  if (world?.getMapStatus && state.status === 'flying' && !upcomingTerrainReady()) syncEarthStatus();
  flight.update(dt, {
    pitch: Number(down('ArrowUp') || touch.has('pitch-up')) - Number(down('ArrowDown') || touch.has('pitch-down')),
    roll: Number(down('ArrowRight', 'KeyD') || touch.has('roll-right')) - Number(down('ArrowLeft', 'KeyA') || touch.has('roll-left')),
    yaw: Number(down('KeyE')) - Number(down('KeyQ')),
    throttle: Number(down('KeyW', 'Equal')) - Number(down('KeyS', 'Minus')),
    brake: down('KeyB'),
  });
  world?.update(state, dt);
  if (state.crashed && !lastCrashed) { lastCrashed = true; updateFlightButtons(); notify('Uçuş sona erdi. R tuşuyla yeniden deneyebilirsin.'); }
  if (state.landed && !lastLanded) { lastLanded = true; notify('Yumuşak bir iniş! Gazı kapat, B ile fren yap.'); }
  hudAccumulator += dt; fpsElapsed += dt; frameCount++;
  if (hudAccumulator >= .1) { hudAccumulator = 0; syncEarthStatus(); updateInstruments(); updateSound(); }
  if (fpsElapsed >= 1) { $('fps').textContent = `${Math.min(144, Math.round(frameCount / fpsElapsed))} FPS`; frameCount = 0; fpsElapsed = 0; }
  requestAnimationFrame(frame);
}
applyWeather(); applySoundUI(); syncEarthStatus(); updateFlightButtons(); requestAnimationFrame(frame);
