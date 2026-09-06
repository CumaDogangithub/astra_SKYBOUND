import * as THREE from 'three';
import { terrainHeight } from './terrain.js';
import { createEarth } from './earth.js';

const radians = THREE.MathUtils.degToRad;
const clamp = THREE.MathUtils.clamp;
function seededRandom(seed = 19) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
}

function makeSky() {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, toneMapped: false,
    uniforms: {
      topColor: { value: new THREE.Color('#5485ac') },
      horizonColor: { value: new THREE.Color('#efd2ba') },
      sunColor: { value: new THREE.Color('#ffe6b9') },
      sunDirection: { value: new THREE.Vector3(-.58, .19, -.79).normalize() },
    },
    vertexShader: `varying vec3 vDirection; void main(){ vDirection=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vDirection; uniform vec3 topColor; uniform vec3 horizonColor; uniform vec3 sunColor; uniform vec3 sunDirection;
    void main(){ vec3 d=normalize(vDirection); float h=pow(max(d.y,0.0),0.35); vec3 col=mix(horizonColor,topColor,clamp(h*1.4,0.0,1.0));
      float s=max(dot(d,sunDirection),0.0); col+=sunColor*pow(s,18.0)*0.13; col=mix(col,sunColor,pow(s,450.0)*0.55); col+=sunColor*pow(s,19000.0)*0.45;
      gl_FragColor=vec4(col,1.0);
      #include <colorspace_fragment>
    }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(90000, 32, 16), material);
  sky.renderOrder = -10;
  return sky;
}

function makeCloudTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  gradient.addColorStop(0, 'rgba(255,255,255,.85)'); gradient.addColorStop(.35, 'rgba(255,255,255,.6)');
  gradient.addColorStop(.72, 'rgba(255,255,255,.18)'); gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

function buildClouds(scene) {
  const texture = makeCloudTexture(), random = seededRandom(107), group = new THREE.Group();
  for (let i = 0; i < 22; i++) {
    const clusterX = -16000 + random() * 43000, clusterZ = -5000 - random() * 42000, clusterY = 2700 + random() * 2400;
    const parts = 4 + Math.floor(random() * 5);
    for (let j = 0; j < parts; j++) {
      const material = new THREE.SpriteMaterial({ map: texture, color: '#fff0df', transparent: true, opacity: .14 + random() * .13, depthWrite: false, fog: true });
      const sprite = new THREE.Sprite(material);
      sprite.position.set(clusterX + (j - parts / 2) * 430, clusterY + random() * 130, clusterZ + random() * 250);
      sprite.scale.set(1500 + random() * 1300, 460 + random() * 500, 1);
      group.add(sprite);
    }
  }
  scene.add(group); return group;
}

function bodyGeometry(stations, sides = 28) {
  const positions = [], indices = [];
  for (const [z, rx, ry, y] of stations) for (let j = 0; j <= sides; j++) {
    const t = j / sides * Math.PI * 2;
    positions.push(Math.cos(t) * rx, y + Math.sin(t) * ry, z);
  }
  for (let i = 0; i < stations.length - 1; i++) for (let j = 0; j < sides; j++) {
    const a = i * (sides + 1) + j, b = a + sides + 1;
    indices.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

function wingGeometry(sign, sections, y = 0) {
  const positions = [], indices = [], samples = 12;
  for (const [span, leading, chord, thickness] of sections) {
    for (let j = 0; j <= samples * 2; j++) {
      const t = j <= samples ? j / samples : (samples * 2 - j) / samples;
      const upper = j <= samples;
      const airfoil = (Math.sqrt(t) * (1 - t)) * thickness * (upper ? 1 : -.45);
      positions.push(sign * span, y + airfoil + span * .026, leading + t * chord);
    }
  }
  const stride = samples * 2 + 1;
  for (let i = 0; i < sections.length - 1; i++) for (let j = 0; j < stride - 1; j++) {
    const a = i * stride + j, b = a + stride;
    indices.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

function lineBetween(group, start, end, radius, material) {
  const direction = new THREE.Vector3(...end).sub(new THREE.Vector3(...start));
  const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), 7), material);
  cylinder.position.copy(new THREE.Vector3(...start).addScaledVector(direction, .5));
  cylinder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()); group.add(cylinder); return cylinder;
}

function makeAircraft() {
  const plane = new THREE.Group(), propellers = [], gear = new THREE.Group();
  const ivory = new THREE.MeshStandardMaterial({ color: '#efeee2', metalness: .23, roughness: .34, side: THREE.DoubleSide });
  const olive = new THREE.MeshStandardMaterial({ color: '#465348', metalness: .28, roughness: .32, side: THREE.DoubleSide });
  const lime = new THREE.MeshStandardMaterial({ color: '#d4e778', metalness: .18, roughness: .34, side: THREE.DoubleSide });
  const glass = new THREE.MeshStandardMaterial({ color: '#223d48', metalness: .55, roughness: .15 });
  const dark = new THREE.MeshStandardMaterial({ color: '#263032', roughness: .5, metalness: .45 });
  const body = new THREE.Mesh(bodyGeometry([
    [-7.8, .04, .06, .02], [-7.3, .53, .58, .02], [-6.1, .93, .92, .08], [-4.2, 1.2, 1.09, .13],
    [-1.9, 1.19, 1.2, .15], [.9, 1.02, 1.02, .16], [3.3, .72, .72, .25], [5.8, .35, .37, .4], [7.4, .06, .12, .55],
  ]), ivory);
  plane.add(body);
  const belly = new THREE.Mesh(bodyGeometry([
    [-6.9, .43, .18, -.54], [-5, .9, .33, -.63], [-2, 1.13, .4, -.66], [1.7, .88, .31, -.53], [4.7, .38, .12, -.05], [6.6, .04, .02, .33],
  ]), olive); plane.add(belly);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18, 0, Math.PI * 2, 0, Math.PI / 2), glass);
  canopy.scale.set(1.14, 1.22, 2.56); canopy.position.set(0, .75, -2.84); plane.add(canopy);
  // Curved structural arches give the glazed cockpit a proper aircraft silhouette.
  for (const zz of [-3.5, -1.7]) {
    const points = [];
    for (let j = 0; j <= 16; j++) {
      const theta = j / 16 * Math.PI;
      points.push(new THREE.Vector3(Math.cos(theta) * 1.08, .8 + Math.sin(theta) * 1.11, zz));
    }
    plane.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 22, .04, 5, false), ivory));
  }
  lineBetween(plane, [0, 1.1, -5.0], [0, 1.91, -3.5], .045, ivory);
  for (const sign of [-1, 1]) {
    plane.add(new THREE.Mesh(wingGeometry(sign, [[.6, -1.65, 4.2, .65], [4.2, -1.65, 3.65, .56], [9.5, -.8, 2.65, .39], [12, .0, 1.55, .22], [12.5, .4, .7, .07]], -.3), ivory));
    plane.add(new THREE.Mesh(wingGeometry(sign, [[9.3, -.82, 2.69, .4], [10.3, -.55, 2.32, .35]], -.27), olive));
    plane.add(new THREE.Mesh(wingGeometry(sign, [[11.3, -.21, 1.91, .28], [12, .0, 1.55, .23], [12.5, .4, .7, .08]], -.26), lime));
    // Hinges and aileron seams remain visible from the chase camera.
    lineBetween(plane, [sign * 5.3, -.08, 1.65], [sign * 11.3, .07, 1.47], .022, olive);
    lineBetween(plane, [sign * 9.4, .02, -.65], [sign * 9.4, .02, 1.61], .018, olive);
    const engine = new THREE.Mesh(bodyGeometry([[-5.08, .02, .02, 0], [-4.72, .43, .48, 0], [-4.2, .66, .67, 0], [-2.4, .65, .62, .02], [-.2, .4, .4, .03], [1, .025, .03, .06]]), ivory);
    engine.position.set(sign * 4.2, .06, 0); plane.add(engine);
    const cowling = new THREE.Mesh(bodyGeometry([[-4.5, .59, .6, 0], [-3.85, .67, .68, 0]]), olive);
    cowling.position.x = sign * 4.2; cowling.position.y = .06; plane.add(cowling);
    const spinner = new THREE.Mesh(new THREE.ConeGeometry(.33, .64, 22), dark);
    spinner.rotation.x = -Math.PI / 2; spinner.position.set(sign * 4.2, .06, -5.07); plane.add(spinner);
    const prop = new THREE.Group(); prop.position.set(sign * 4.2, .06, -4.94);
    const bladeMaterial = new THREE.MeshStandardMaterial({ color: '#38443d', transparent: true, opacity: .45, roughness: .6 });
    for (let i = 0; i < 3; i++) {
      const blade = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), bladeMaterial);
      blade.scale.set(.14, 1.52, .04); blade.position.y = .8;
      const pivot = new THREE.Group(); pivot.rotation.z = i * Math.PI * 2 / 3; pivot.add(blade); prop.add(pivot);
    }
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.97, 48), new THREE.MeshBasicMaterial({ color: '#b4b9aa', transparent: true, opacity: .10, side: THREE.DoubleSide, depthWrite: false }));
    prop.add(disc); propellers.push(prop); plane.add(prop);
    plane.add(new THREE.Mesh(wingGeometry(sign, [[.1, 4.9, 2.05, .35], [2.6, 5.35, 1.55, .22], [3.75, 5.94, .73, .06]], .71), ivory));
    plane.add(new THREE.Mesh(wingGeometry(sign, [[3.15, 5.66, 1.16, .17], [3.75, 5.94, .73, .07]], .74), lime));
    const navigationLight = new THREE.Mesh(new THREE.SphereGeometry(.09, 8, 5), new THREE.MeshBasicMaterial({ color: sign < 0 ? '#ff604c' : '#b5e6a0' }));
    navigationLight.position.set(sign * 12.38, .17, .7); plane.add(navigationLight);
    // Fine accent line follows the taper of the rear fuselage.
    lineBetween(plane, [sign * 1.14, .2, -.3], [sign * .35, .52, 5.6], .045, lime);
  }
  const finShape = new THREE.Shape(); finShape.moveTo(3.7, .49); finShape.lineTo(5.72, 4.0); finShape.quadraticCurveTo(5.95, 4.23, 6.28, 4.08); finShape.lineTo(7.3, 1.0); finShape.lineTo(7.18, .54); finShape.closePath();
  const finGeometry = new THREE.ExtrudeGeometry(finShape, { depth: .18, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: .06, bevelThickness: .045 });
  // Shape's horizontal axis is longitudinal on the finished aircraft.
  finGeometry.rotateY(-Math.PI / 2); finGeometry.translate(.09, 0, 0);
  plane.add(new THREE.Mesh(finGeometry, olive));
  const accentShape = new THREE.Shape(); accentShape.moveTo(5.4, 3.4); accentShape.lineTo(5.73, 4.01); accentShape.lineTo(6.21, 4.03); accentShape.lineTo(6.46, 3.4); accentShape.closePath();
  const accentGeometry = new THREE.ExtrudeGeometry(accentShape, { depth: .21, bevelEnabled: false }); accentGeometry.rotateY(-Math.PI / 2); accentGeometry.translate(.105, 0, 0);
  plane.add(new THREE.Mesh(accentGeometry, lime));
  lineBetween(plane, [0, 1.4, .6], [0, 2.14, 1.1], .025, dark);
  lineBetween(plane, [0, -.8, -3.2], [0, -1.2, -3.5], .03, dark);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(.1, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff7a4c' })); beacon.position.set(0, 4.14, 5.99); plane.add(beacon);
  for (const [x, z, radius] of [[-2.9, .6, .48], [2.9, .6, .48], [0, -5.5, .39]]) {
    lineBetween(gear, [x, -.4, z + .22], [x, -1.88, z], .09, ivory);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, .32, 16), dark);
    wheel.rotation.z = Math.PI / 2; wheel.position.set(x, -1.9, z); gear.add(wheel);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * .43, radius * .43, .335, 12), ivory);
    hub.rotation.z = Math.PI / 2; hub.position.copy(wheel.position); gear.add(hub);
  }
  plane.add(gear);
  return { plane, propellers, beacon, gear, liveryMaterial: olive };
}

export function createWorld(container, initialState) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2('#bac5cb', .000030);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
  renderer.domElement.setAttribute('aria-label', 'Akdeniz üzerinde üç boyutlu uçuş simülasyonu');
  container.appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(49, 1, .3, 110000);
  const sky = makeSky(); scene.add(sky);
  const ambient = new THREE.HemisphereLight('#dbe9ee', '#8b8768', 1.7); scene.add(ambient);
  const sun = new THREE.DirectionalLight('#ffe1b3', 2.1); sun.position.set(-9000, 8500, -14000); scene.add(sun);
  const fill = new THREE.DirectionalLight('#bdd5e9', .6); fill.position.set(8000, 4000, 8000); scene.add(fill);
  const earth = createEarth(scene, initialState.position);
  const clouds = buildClouds(scene);
  const { plane, propellers, beacon, gear, liveryMaterial } = makeAircraft(); scene.add(plane);
  const cameraPosition = new THREE.Vector3(), cameraLook = new THREE.Vector3(), desiredPosition = new THREE.Vector3(), desiredLook = new THREE.Vector3();
  const yaw = new THREE.Quaternion(), planeEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  let mode = 'chase', elapsed = 0, firstUpdate = true, weather = 'sunset', disposed = false;

  function resize() {
    if (disposed) return;
    const width = container.clientWidth || window.innerWidth, height = container.clientHeight || window.innerHeight;
    renderer.setSize(width, height, false); camera.aspect = width / Math.max(height, 1); camera.updateProjectionMatrix();
  }
  function setWeather(value) {
    weather = value;
    const cloudy = value === 'cloudy', clear = value === 'clear';
    sky.material.uniforms.topColor.value.set(cloudy ? '#7993aa' : clear ? '#4e92be' : '#5485ac');
    sky.material.uniforms.horizonColor.value.set(cloudy ? '#c9d3d3' : clear ? '#d1e0e4' : '#efd2ba');
    const fogColor = cloudy ? '#bfcbd0' : clear ? '#bdd0dc' : '#bac5cb';
    scene.fog.color.set(fogColor); scene.fog.density = cloudy ? .000052 : .000030;
    sun.intensity = cloudy ? 1.25 : clear ? 2.4 : 2.1;
    sun.color.set(clear ? '#fff2d7' : '#ffe1b3');
    clouds.children.forEach((cloud, i) => { cloud.material.opacity = (cloudy ? .35 : .12) + (i % 5) * .024; });
  }
  function setCamera(value) { mode = value; firstUpdate = true; plane.visible = mode !== 'cockpit'; }
  function setLivery(color) { liveryMaterial.color.set(color); }
  function update(state, dt = 0) {
    if (disposed || !state?.position) return;
    elapsed += Math.min(dt, .1);
    const position = state.position;
    earth.update(position);
    plane.position.set(position.x, position.y, position.z);
    planeEuler.set(radians(state.pitch || 0), -radians(state.heading || 0), -radians(state.roll || 0), 'YXZ');
    plane.quaternion.setFromEuler(planeEuler);
    yaw.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -radians(state.heading || 0));
    if (mode === 'cockpit') {
      desiredPosition.set(0, 1.9, -3.5).applyQuaternion(plane.quaternion).add(plane.position);
      desiredLook.set(0, 2.2, -180).applyQuaternion(plane.quaternion).add(plane.position);
      camera.up.set(0, 1, 0).applyQuaternion(plane.quaternion);
    } else if (mode === 'orbit') {
      const orbit = elapsed * .13 + .75;
      desiredPosition.set(Math.sin(orbit) * 42, 12 + Math.sin(orbit * .5) * 6, Math.cos(orbit) * 42).applyQuaternion(yaw).add(plane.position);
      desiredLook.copy(plane.position).add(new THREE.Vector3(0, 2.0, 0));
      camera.up.set(0, 1, 0);
    } else {
      desiredPosition.set(-6, 16, 45).applyQuaternion(yaw).add(plane.position);
      desiredLook.set(0, -3, -90).applyQuaternion(yaw).add(plane.position);
      camera.up.set(0, 1, 0);
    }
    desiredPosition.y = Math.max(desiredPosition.y, terrainHeight(desiredPosition.x, desiredPosition.z) + 4, 3);
    const blend = firstUpdate ? 1 : 1 - Math.exp(-dt * 5);
    cameraPosition.lerp(desiredPosition, blend); cameraLook.lerp(desiredLook, blend);
    camera.position.copy(cameraPosition); camera.lookAt(cameraLook); sky.position.copy(camera.position);
    propellers.forEach((prop, i) => { prop.rotation.z += dt * (state.crashed ? 0 : 38 + (state.throttle ?? 60) * .5) * (i ? 1 : -1); });
    gear.visible = Boolean(state.gear);
    beacon.visible = Math.sin(elapsed * 4) > .35;
    if (weather === 'cloudy') clouds.position.x = Math.sin(elapsed * .012) * 350;
    renderer.render(scene, camera); firstUpdate = false;
  }
  function dispose() {
    disposed = true;
    earth.dispose();
    scene.traverse(object => {
      object.geometry?.dispose();
      if (object.material) for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        material.map?.dispose(); material.dispose();
      }
    });
    renderer.dispose(); renderer.domElement.remove(); window.removeEventListener('resize', resize);
  }
  resize(); window.addEventListener('resize', resize); update(initialState, 0);
  return { update, resize, setCamera, setWeather, setLivery, dispose, ready: earth.ready, getMapStatus: earth.getMapStatus, retryMap: earth.retryMap };
}
