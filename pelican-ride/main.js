import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const $ = (s) => document.querySelector(s);
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const rand = (a, b) => a + Math.random() * (b - a);
const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);
const LOOP = 240;
const wrapZ = (v) => (((v + LOOP / 2) % LOOP) + LOOP) % LOOP - LOOP / 2;

const state = {
  paused: false,
  night: 0,
  nightTarget: 0,
  speed: 1,
  camMode: 0,
  dist: 0,
  crank: 0,
  honk: 0,
  flap: 0,
};

const canvas = $('#stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xbcd7ea, 55, 215);

const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 900);
camera.position.set(5.2, 2.9, 6.6);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.4, 0.7, 0.85);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const dayPal = {
  top: new THREE.Color(0x2f7fe0),
  horizon: new THREE.Color(0xcfe9ff),
  ground: new THREE.Color(0x79c25a),
  fog: new THREE.Color(0xbcd7ea),
  grass: new THREE.Color(0x63a94f),
  road: new THREE.Color(0x4a4f57),
  amb: new THREE.Color(0xcfe3ff),
};
const nightPal = {
  top: new THREE.Color(0x030816),
  horizon: new THREE.Color(0x142845),
  ground: new THREE.Color(0x0a1424),
  fog: new THREE.Color(0x0a1526),
  grass: new THREE.Color(0x12251c),
  road: new THREE.Color(0x151a22),
  amb: new THREE.Color(0x2a4f8a),
};

const skyUniforms = {
  uTop: { value: dayPal.top.clone() },
  uHorizon: { value: dayPal.horizon.clone() },
  uSunDir: { value: new THREE.Vector3(0.45, 0.42, 0.79).normalize() },
  uMoonDir: { value: new THREE.Vector3(-0.5, 0.55, -0.4).normalize() },
  uSunColor: { value: new THREE.Color(0xfff3c4) },
  uMoonColor: { value: new THREE.Color(0xd6e4ff) },
  uNight: { value: 0 },
};

const skyMat = new THREE.ShaderMaterial({
  uniforms: skyUniforms,
  side: THREE.BackSide,
  depthWrite: false,
  fog: false,
  vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    varying vec3 vDir;
    uniform vec3 uTop, uHorizon, uSunDir, uMoonDir, uSunColor, uMoonColor;
    uniform float uNight;
    void main(){
      vec3 d = normalize(vDir);
      float h = clamp(d.y, 0.0, 1.0);
      vec3 col = mix(uHorizon, uTop, pow(h, 0.55));
      float below = clamp(-d.y * 6.0, 0.0, 1.0);
      col = mix(col, uHorizon * 0.82, below);
      float s = max(dot(d, normalize(uSunDir)), 0.0);
      col += uSunColor * (pow(s, 260.0) * 3.0 + pow(s, 9.0) * 0.30) * (1.0 - uNight);
      float m = max(dot(d, normalize(uMoonDir)), 0.0);
      col += uMoonColor * (pow(m, 900.0) * 2.2 + pow(m, 40.0) * 0.16) * uNight;
      gl_FragColor = vec4(col, 1.0);
    }`,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(520, 48, 32), skyMat);
sky.frustumCulled = false;
scene.add(sky);

function buildStars() {
  const n = 900;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const u = Math.random() * TAU;
    const v = Math.acos(rand(-0.08, 1));
    const r = 470;
    pos[i * 3] = r * Math.sin(v) * Math.cos(u);
    pos[i * 3 + 1] = r * Math.cos(v);
    pos[i * 3 + 2] = r * Math.sin(v) * Math.sin(u);
    c.setHSL(rand(0.55, 0.68), rand(0, 0.5), rand(0.6, 1));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.PointsMaterial({
    size: 2.2, sizeAttenuation: false, vertexColors: true,
    transparent: true, opacity: 0, depthWrite: false, fog: false,
  });
  const p = new THREE.Points(g, m);
  p.frustumCulled = false;
  scene.add(p);
  return p;
}
const stars = buildStars();

const sunMesh = new THREE.Mesh(
  new THREE.CircleGeometry(26, 48),
  new THREE.MeshBasicMaterial({ color: 0xfff7d0, transparent: true, opacity: 1, fog: false, depthWrite: false })
);
scene.add(sunMesh);
const moonMesh = new THREE.Mesh(
  new THREE.CircleGeometry(15, 40),
  new THREE.MeshBasicMaterial({ color: 0xe8f0ff, transparent: true, opacity: 0, fog: false, depthWrite: false })
);
scene.add(moonMesh);

const hemi = new THREE.HemisphereLight(0xd8ecff, 0x4b7a3a, 0.78);
scene.add(hemi);
const amb = new THREE.AmbientLight(0xcfe3ff, 0.18);
scene.add(amb);

const sun = new THREE.DirectionalLight(0xfff2d4, 3.0);
sun.position.set(11, 16, 15);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.camera.left = -16;
sun.shadow.camera.right = 16;
sun.shadow.camera.top = 16;
sun.shadow.camera.bottom = -16;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 70;
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.02;
sun.shadow.camera.updateProjectionMatrix();
scene.add(sun);
scene.add(sun.target);

const moon = new THREE.DirectionalLight(0x9fc0ff, 0);
moon.position.set(-12, 14, -9);
scene.add(moon);
scene.add(moon.target);

const rim = new THREE.DirectionalLight(0xffd9b0, 0.5);
rim.position.set(-8, 5, -12);
scene.add(rim);

const mats = {
  grass: new THREE.MeshStandardMaterial({ color: dayPal.grass.clone(), roughness: 1 }),
  road: new THREE.MeshStandardMaterial({ color: dayPal.road.clone(), roughness: 0.92 }),
  line: new THREE.MeshStandardMaterial({ color: 0xf3f3e6, roughness: 0.8 }),
  trunk: new THREE.MeshStandardMaterial({ color: 0x7a5231, roughness: 0.95 }),
  leafA: new THREE.MeshStandardMaterial({ color: 0x3f8f3c, roughness: 0.9 }),
  leafB: new THREE.MeshStandardMaterial({ color: 0x2f7a46, roughness: 0.9 }),
  leafC: new THREE.MeshStandardMaterial({ color: 0x87b84a, roughness: 0.9 }),
  rock: new THREE.MeshStandardMaterial({ color: 0x8b929b, roughness: 1, flatShading: true }),
  metal: new THREE.MeshStandardMaterial({ color: 0xc9ced6, metalness: 0.95, roughness: 0.28 }),
  frame: new THREE.MeshStandardMaterial({ color: 0xe23b3b, metalness: 0.6, roughness: 0.3 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x1c1f26, roughness: 0.75 }),
  tire: new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.92 }),
  saddle: new THREE.MeshStandardMaterial({ color: 0x3b2a20, roughness: 0.7 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xf0c04a, metalness: 0.9, roughness: 0.25 }),
  white: new THREE.MeshStandardMaterial({ color: 0xf7f9fb, roughness: 0.62 }),
  grey: new THREE.MeshStandardMaterial({ color: 0xd3d9df, roughness: 0.7 }),
  beak: new THREE.MeshStandardMaterial({ color: 0xf5a63c, roughness: 0.5 }),
  pouch: new THREE.MeshStandardMaterial({ color: 0xef7f2a, roughness: 0.55, side: THREE.DoubleSide }),
  leg: new THREE.MeshStandardMaterial({ color: 0xf08a3a, roughness: 0.6 }),
  eye: new THREE.MeshStandardMaterial({ color: 0x10131a, roughness: 0.25 }),
  glow: new THREE.MeshStandardMaterial({ color: 0xfff0c0, emissive: 0xffcf6a, emissiveIntensity: 0, roughness: 0.4 }),
};

const world = new THREE.Group();
scene.add(world);
const riders = new THREE.Group();
scene.add(riders);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600, 1, 1), mats.grass);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.01;
ground.receiveShadow = true;
world.add(ground);

const road = new THREE.Mesh(new THREE.PlaneGeometry(6.4, LOOP), mats.road);
road.rotation.x = -Math.PI / 2;
road.position.y = 0.002;
road.receiveShadow = true;
world.add(road);

for (const x of [-2.95, 2.95]) {
  const edge = new THREE.Mesh(new THREE.PlaneGeometry(0.14, LOOP), mats.line);
  edge.rotation.x = -Math.PI / 2;
  edge.position.set(x, 0.004, 0);
  world.add(edge);
}

const scrollItems = [];
function registerScroll(obj, baseZ) {
  obj.userData.baseZ = baseZ;
  scrollItems.push(obj);
  world.add(obj);
}

for (let i = 0; i < LOOP / 8; i++) {
  const d = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 2.4), mats.line);
  d.rotation.x = -Math.PI / 2;
  d.position.y = 0.006;
  registerScroll(d, -LOOP / 2 + i * 8 + 4);
}

function makeTree(kind) {
  const g = new THREE.Group();
  const h = rand(1.6, 3.4);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.17, h, 7), mats.trunk);
  trunk.position.y = h / 2;
  trunk.castShadow = true;
  g.add(trunk);
  if (kind === 0) {
    for (let i = 0; i < 3; i++) {
      const r = 1.15 - i * 0.3;
      const c = new THREE.Mesh(new THREE.ConeGeometry(r, 1.5, 8), i % 2 ? mats.leafB : mats.leafA);
      c.position.y = h * 0.75 + i * 0.75;
      c.castShadow = true;
      g.add(c);
    }
  } else if (kind === 1) {
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(0.5, 0.78), 0), i % 2 ? mats.leafC : mats.leafA);
      b.position.set(rand(-0.5, 0.5), h + rand(-0.2, 0.6), rand(-0.5, 0.5));
      b.castShadow = true;
      g.add(b);
    }
  } else {
    const b = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 9), mats.leafB);
    b.position.y = h + 0.5;
    b.scale.set(1, 1.15, 1);
    b.castShadow = true;
    g.add(b);
  }
  g.scale.setScalar(rand(0.75, 1.35));
  return g;
}

function makeLamp() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 3.6, 8), mats.metal);
  pole.position.y = 1.8;
  pole.castShadow = true;
  g.add(pole);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 7), mats.metal);
  arm.rotation.z = Math.PI / 2;
  arm.position.set(-0.45, 3.55, 0);
  g.add(arm);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10), mats.glow);
  head.position.set(-0.9, 3.45, 0);
  g.add(head);
  g.userData.bulb = head;
  return g;
}

function makeCloud() {
  const g = new THREE.Group();
  const n = Math.floor(rand(3, 6));
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.92, fog: false });
  for (let i = 0; i < n; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(rand(1.4, 2.6), 10, 8), m);
    s.position.set(i * rand(1.2, 2) - n, rand(-0.3, 0.4), rand(-0.8, 0.8));
    s.scale.y = rand(0.5, 0.8);
    g.add(s);
  }
  g.position.set(rand(-60, 60), rand(16, 27), rand(-90, 90));
  g.userData.drift = rand(0.25, 0.7);
  return g;
}

const clouds = [];
for (let i = 0; i < 14; i++) {
  const c = makeCloud();
  clouds.push(c);
  world.add(c);
}

const mountains = new THREE.Group();
for (let i = 0; i < 26; i++) {
  const h = rand(14, 34);
  const m = new THREE.Mesh(
    new THREE.ConeGeometry(rand(14, 26), h, 5),
    new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.58, 0.18, rand(0.3, 0.45)), roughness: 1, flatShading: true })
  );
  const a = (i / 26) * TAU;
  const r = rand(150, 210);
  m.position.set(Math.cos(a) * r, h / 2 - 2, Math.sin(a) * r);
  mountains.add(m);
}
world.add(mountains);

for (let i = 0; i < 46; i++) {
  const t = makeTree(Math.floor(rand(0, 3)));
  const side = Math.random() < 0.5 ? -1 : 1;
  t.position.set(side * rand(5.2, 30), 0, rand(-LOOP / 2, LOOP / 2));
  t.rotation.y = rand(0, TAU);
  registerScroll(t, t.position.z);
}

for (let i = 0; i < 34; i++) {
  const r = new THREE.Mesh(new THREE.DodecahedronGeometry(rand(0.18, 0.55), 0), mats.rock);
  const side = Math.random() < 0.5 ? -1 : 1;
  r.position.set(side * rand(4.4, 26), rand(0, 0.12), rand(-LOOP / 2, LOOP / 2));
  r.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
  r.castShadow = true;
  registerScroll(r, r.position.z);
}

const flowerMats = [0xff5f7e, 0xffd93d, 0xffffff, 0xa678ff, 0xff9f45].map(
  (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 })
);
for (let i = 0; i < 90; i++) {
  const f = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(0.05, 0.1), 0), flowerMats[i % flowerMats.length]);
  const side = Math.random() < 0.5 ? -1 : 1;
  f.position.set(side * rand(3.6, 14), rand(0.05, 0.14), rand(-LOOP / 2, LOOP / 2));
  registerScroll(f, f.position.z);
}

const lamps = [];
for (let i = 0; i < LOOP / 30; i++) {
  const l = makeLamp();
  const side = i % 2 === 0 ? 1 : -1;
  l.position.set(side * 3.9, 0, -LOOP / 2 + i * 30 + 15);
  l.rotation.y = side > 0 ? Math.PI : 0;
  lamps.push(l);
  registerScroll(l, l.position.z);
}

for (let i = 0; i < LOOP / 6; i++) {
  const post = new THREE.Group();
  const p = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.85, 0.1), mats.trunk);
  p.position.y = 0.42;
  post.add(p);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 6), mats.trunk);
  rail.position.set(0, 0.62, 3);
  post.add(rail);
  const side = i % 2 === 0 ? 1 : -1;
  post.position.set(side * 4.3, 0, -LOOP / 2 + i * 6);
  registerScroll(post, post.position.z);
}

function tube(a, b, r, mat, radial = 10) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, radial), mat);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.scale.y = len;
  m.quaternion.setFromUnitVectors(UP, dir.normalize());
  m.castShadow = true;
  return m;
}

function ball(r, mat, w = 14, h = 11) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, w, h), mat);
  m.castShadow = true;
  return m;
}

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const R = 0.56;
const BB = V(0, 0.35, -0.15);
const rearAxle = V(0, R, -0.78);
const frontAxle = V(0, R, 0.76);
const seatTop = V(0, 1.06, -0.56);
const headTop = V(0, 1.14, 0.6);
const headBottom = V(0, 0.86, 0.7);

function makeWheel() {
  const g = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 10, 40), mats.tire);
  tire.rotation.y = Math.PI / 2;
  tire.castShadow = true;
  g.add(tire);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.022, 8, 36), mats.metal);
  rim.rotation.y = Math.PI / 2;
  g.add(rim);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.13, 10), mats.metal);
  hub.rotation.z = Math.PI / 2;
  g.add(hub);
  const spokeGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.86, 5);
  for (let i = 0; i < 12; i++) {
    const s = new THREE.Mesh(spokeGeo, mats.metal);
    s.rotation.x = (i / 12) * Math.PI;
    s.position.x = i % 2 ? 0.025 : -0.025;
    g.add(s);
  }
  return g;
}

const bike = new THREE.Group();
riders.add(bike);

const wheelBack = makeWheel();
wheelBack.position.copy(rearAxle);
bike.add(wheelBack);
const wheelFront = makeWheel();
wheelFront.position.copy(frontAxle);
bike.add(wheelFront);

bike.add(tube(BB, seatTop, 0.036, mats.frame));
bike.add(tube(BB, headBottom, 0.04, mats.frame));
bike.add(tube(seatTop, headTop, 0.034, mats.frame));
bike.add(tube(headTop, headBottom, 0.052, mats.frame));
for (const s of [-1, 1]) {
  bike.add(tube(V(s * 0.07, BB.y, BB.z), V(s * 0.07, rearAxle.y, rearAxle.z), 0.024, mats.frame));
  bike.add(tube(V(s * 0.05, seatTop.y, seatTop.z), V(s * 0.06, rearAxle.y, rearAxle.z), 0.02, mats.frame));
  bike.add(tube(V(s * 0.05, headBottom.y, headBottom.z), V(s * 0.05, frontAxle.y, frontAxle.z), 0.026, mats.frame));
}
const stem = tube(V(0, headTop.y, headTop.z), V(0, 1.24, 0.68), 0.03, mats.metal);
bike.add(stem);
const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.56, 8), mats.metal);
bar.rotation.z = Math.PI / 2;
bar.position.set(0, 1.25, 0.69);
bar.castShadow = true;
bike.add(bar);
for (const s of [-1, 1]) {
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.13, 8), mats.dark);
  grip.rotation.z = Math.PI / 2;
  grip.position.set(s * 0.24, 1.25, 0.69);
  bike.add(grip);
}
const bell = ball(0.055, mats.brass);
bell.position.set(-0.15, 1.3, 0.69);
bell.name = 'bell';
bike.add(bell);

const seatPost = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.14, 8), mats.metal);
seatPost.position.set(0, 1.02, -0.55);
bike.add(seatPost);
const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.07, 0.4), mats.saddle);
saddle.position.set(0, 1.1, -0.57);
saddle.rotation.x = -0.06;
saddle.castShadow = true;
bike.add(saddle);

const chainring = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.016, 8, 28), mats.metal);
chainring.position.copy(BB);
chainring.rotation.y = Math.PI / 2;
bike.add(chainring);
const cog = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.014, 8, 20), mats.metal);
cog.position.copy(rearAxle);
cog.rotation.y = Math.PI / 2;
bike.add(cog);
bike.add(tube(V(0.075, BB.y + 0.13, BB.z), V(0.075, rearAxle.y + 0.055, rearAxle.z), 0.013, mats.dark, 6));
bike.add(tube(V(0.075, BB.y - 0.13, BB.z), V(0.075, rearAxle.y - 0.055, rearAxle.z), 0.013, mats.dark, 6));

const crank = new THREE.Group();
crank.position.copy(BB);
bike.add(crank);
const crankArmR = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.18, 0.05), mats.metal);
crankArmR.position.set(0.1, 0.09, 0);
crank.add(crankArmR);
const crankArmL = crankArmR.clone();
crankArmL.position.set(-0.1, -0.09, 0);
crank.add(crankArmL);
const pedalGeo = new THREE.BoxGeometry(0.13, 0.03, 0.19);
const pedalR = new THREE.Mesh(pedalGeo, mats.dark);
pedalR.position.set(0.15, 0.18, 0);
crank.add(pedalR);
const pedalRL = new THREE.Mesh(pedalGeo, mats.dark);
pedalRL.position.set(-0.15, -0.18, 0);
crank.add(pedalRL);

const headlightBody = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.12, 12), mats.metal);
headlightBody.rotation.x = Math.PI / 2;
headlightBody.position.set(0, 1.0, 0.78);
bike.add(headlightBody);
const headlightLens = new THREE.Mesh(new THREE.CircleGeometry(0.07, 16), mats.glow);
headlightLens.position.set(0, 1.0, 0.85);
bike.add(headlightLens);
const headBeam = new THREE.Mesh(
  new THREE.ConeGeometry(1.3, 7, 20, 1, true),
  new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false })
);
headBeam.rotation.x = -Math.PI / 2;
headBeam.position.set(0, 0.75, 4.4);
bike.add(headBeam);
const headSpot = new THREE.SpotLight(0xfff0cc, 0, 26, 0.44, 0.6, 1.2);
headSpot.position.set(0, 1.0, 0.85);
headSpot.target.position.set(0, 0.1, 9);
bike.add(headSpot, headSpot.target);

const pelican = new THREE.Group();
riders.add(pelican);

const body = ball(1, mats.white);
body.scale.set(0.4, 0.38, 0.54);
body.position.set(0, 1.42, -0.3);
body.rotation.x = -0.28;
pelican.add(body);

const belly = ball(1, mats.grey);
belly.scale.set(0.33, 0.3, 0.42);
belly.position.set(0, 1.3, -0.26);
belly.rotation.x = -0.28;
pelican.add(belly);

const tail = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 8), mats.grey);
tail.rotation.x = Math.PI / 2 + 0.35;
tail.position.set(0, 1.4, -0.92);
tail.castShadow = true;
pelican.add(tail);

const neckMeshes = [];
const NECK_N = 11;
const neckGeo = new THREE.CylinderGeometry(1, 1, 1, 12);
const jointGeo = new THREE.SphereGeometry(1, 12, 10);
for (let i = 0; i < NECK_N; i++) {
  const m = new THREE.Mesh(neckGeo, mats.white);
  m.castShadow = true;
  pelican.add(m);
  neckMeshes.push(m);
}
const neckJoints = [];
for (let i = 0; i < NECK_N; i++) {
  const m = new THREE.Mesh(jointGeo, mats.white);
  m.castShadow = true;
  pelican.add(m);
  neckJoints.push(m);
}

const headGroup = new THREE.Group();
pelican.add(headGroup);
const skull = ball(0.2, mats.white);
skull.scale.set(1, 0.95, 1.12);
headGroup.add(skull);

const upperBill = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.1, 0.62, 8), mats.beak);
upperBill.rotation.x = Math.PI / 2;
upperBill.scale.set(1, 1, 0.55);
upperBill.position.set(0, -0.02, 0.34);
upperBill.castShadow = true;
headGroup.add(upperBill);

const billTip = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.14, 8), mats.beak);
billTip.rotation.x = Math.PI / 2;
billTip.scale.set(1, 1, 0.6);
billTip.position.set(0, -0.02, 0.7);
headGroup.add(billTip);

const pouch = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12, 0, TAU, Math.PI * 0.5, Math.PI * 0.5), mats.pouch);
pouch.scale.set(0.8, 1.55, 2.4);
pouch.position.set(0, -0.09, 0.3);
pouch.rotation.x = 0.14;
headGroup.add(pouch);

const lowerBill = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.09, 0.64, 8), mats.beak);
lowerBill.rotation.x = Math.PI / 2;
lowerBill.scale.set(1, 1, 0.35);
lowerBill.position.set(0, -0.075, 0.34);
headGroup.add(lowerBill);

const eyes = [];
for (const s of [-1, 1]) {
  const e = ball(0.045, mats.eye);
  e.position.set(s * 0.13, 0.07, 0.15);
  headGroup.add(e);
  const g = ball(0.016, new THREE.MeshBasicMaterial({ color: 0xffffff }));
  g.position.set(s * 0.15, 0.09, 0.18);
  headGroup.add(g);
  eyes.push(e);
  const crest = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.16, 6), mats.grey);
  crest.position.set(s * 0.06, 0.17, -0.1);
  crest.rotation.x = -0.7;
  headGroup.add(crest);
}

function makeWing(side) {
  const g = new THREE.Group();
  g.position.set(side * 0.24, 1.55, -0.3);
  const outer = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), mats.white);
  outer.scale.set(0.46, 0.075, 0.26);
  outer.position.x = side * 0.4;
  outer.castShadow = true;
  g.add(outer);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), mats.grey);
  tip.scale.set(0.3, 0.055, 0.17);
  tip.position.x = side * 0.84;
  tip.castShadow = true;
  g.add(tip);
  pelican.add(g);
  return g;
}
const wingR = makeWing(1);
const wingL = makeWing(-1);

const hips = [V(-0.15, 1.12, -0.5), V(0.15, 1.12, -0.5)];
const THIGH = 0.55;
const SHIN = 0.52;
const targets = [pedalR, pedalRL];
const legParts = hips.map((hip, i) => {
  const side = i === 0 ? -1 : 1;
  const upper = new THREE.Mesh(neckGeo, mats.leg);
  upper.castShadow = true;
  const lower = new THREE.Mesh(neckGeo, mats.leg);
  lower.castShadow = true;
  const knee = ball(0.07, mats.leg);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.05, 0.26), mats.leg);
  foot.castShadow = true;
  pelican.add(upper, lower, knee, foot);
  return { hip, upper, lower, knee, foot, side };
});

function setSeg(mesh, a, b, r) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.scale.set(r, Math.max(len, 0.001), r);
  mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
}

function solveIK(hip, target, l1, l2, pole, out) {
  const d = new THREE.Vector3().subVectors(target, hip);
  let len = d.length();
  const maxLen = (l1 + l2) * 0.999;
  const minLen = Math.abs(l1 - l2) + 0.001;
  len = clamp(len, minLen, maxLen);
  d.normalize();
  const cosA = clamp((l1 * l1 + len * len - l2 * l2) / (2 * l1 * len), -1, 1);
  const a = Math.acos(cosA);
  const axis = new THREE.Vector3().crossVectors(d, pole);
  if (axis.lengthSq() < 1e-6) axis.set(1, 0, 0);
  axis.normalize();
  const dirKnee = d.clone().applyAxisAngle(axis, -a);
  out.knee.copy(hip).addScaledVector(dirKnee, l1);
  out.foot.copy(hip).addScaledVector(d, len);
}
const ikOut = { knee: new THREE.Vector3(), foot: new THREE.Vector3() };
const pole = new THREE.Vector3(0, 0.2, 1).normalize();
const tmpV = new THREE.Vector3();
const ONE = new THREE.Vector3(1, 1, 1);

const shadowTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grd.addColorStop(0, 'rgba(0,0,0,0.55)');
  grd.addColorStop(0.45, 'rgba(0,0,0,0.28)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();
const contact = new THREE.Mesh(
  new THREE.PlaneGeometry(3.4, 4.2),
  new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.55, fog: false })
);
contact.rotation.x = -Math.PI / 2;
contact.rotation.z = -0.5;
contact.position.set(-0.35, 0.012, -0.15);
contact.renderOrder = 1;
riders.add(contact);

const dustCount = 140;
const dustPos = new Float32Array(dustCount * 3);
const dustLife = new Float32Array(dustCount);
const dustGeo = new THREE.BufferGeometry();
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
const dustMat = new THREE.PointsMaterial({
  color: 0xd9cdb4, size: 0.07, transparent: true, opacity: 0.36,
  depthWrite: false, sizeAttenuation: true,
});
const dust = new THREE.Points(dustGeo, dustMat);
scene.add(dust);
for (let i = 0; i < dustCount; i++) dustLife[i] = Math.random();

const audio = {
  ctx: null, master: null, windGain: null, on: false,
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.6;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 520;
    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.1;
    src.connect(lp).connect(this.windGain).connect(this.master);
    src.start();
    const src2 = this.ctx.createBufferSource();
    src2.buffer = buf;
    src2.loop = true;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2600;
    bp.Q.value = 0.7;
    const g2 = this.ctx.createGain();
    g2.gain.value = 0.035;
    src2.connect(bp).connect(g2).connect(this.master);
    src2.start();
  },
  toggle() {
    this.init();
    if (!this.ctx) return false;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.on = !this.on;
    this.master.gain.setTargetAtTime(this.on ? 0.55 : 0, this.ctx.currentTime, 0.25);
    return this.on;
  },
  ping(freq, when = 0, dur = 0.9, type = 'sine', vol = 0.28) {
    if (!this.ctx || !this.on) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  },
  bell() {
    this.ping(1760, 0, 0.7, 'sine', 0.3);
    this.ping(2640, 0.02, 0.5, 'sine', 0.16);
    this.ping(3520, 0.26, 0.5, 'sine', 0.14);
  },
  honk() {
    if (!this.ctx || !this.on) return;
    const t0 = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const t = t0 + i * 0.16;
      const o = this.ctx.createOscillator();
      const o2 = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 900;
      f.Q.value = 2.5;
      o.type = 'sawtooth';
      o2.type = 'square';
      o.frequency.setValueAtTime(340, t);
      o.frequency.exponentialRampToValueAtTime(180, t + 0.14);
      o2.frequency.setValueAtTime(170, t);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.22, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
      o.connect(f); o2.connect(f); f.connect(g).connect(this.master);
      o.start(t); o2.start(t);
      o.stop(t + 0.2); o2.stop(t + 0.2);
    }
  },
};

const orbit = { theta: 0.7, phi: 1.22, radius: 6.8 };
const lookTarget = new THREE.Vector3(0, 1.45, 0);
const camPos = camera.position.clone();
const desiredPos = new THREE.Vector3();
const desiredLook = new THREE.Vector3();
const camPresets = [
  null,
  { radius: 6.8, height: 3.0, speed: 0.16 },
  { pos: V(3.4, 2.3, -3.6), look: V(0, 1.5, 0.5) },
  { pos: V(1.5, 2.3, 2.4), look: V(0, 2.05, 0.4) },
];

let dragging = false;
let lastX = 0, lastY = 0, pinchDist = 0;
let autoTheta = 0;

function userCamera() {
  if (state.camMode !== 0) setCamMode(0);
}

canvas.addEventListener('pointerdown', (e) => {
  dragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  if (Math.abs(dx) + Math.abs(dy) > 2) userCamera();
  lastX = e.clientX;
  lastY = e.clientY;
  orbit.theta -= dx * 0.006;
  orbit.phi = clamp(orbit.phi - dy * 0.005, 0.25, 1.52);
});
canvas.addEventListener('pointerup', (e) => {
  dragging = false;
  canvas.releasePointerCapture(e.pointerId);
  handlePick(e);
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  userCamera();
  orbit.radius = clamp(orbit.radius * (1 + Math.sign(e.deltaY) * 0.08), 3, 26);
}, { passive: false });
canvas.addEventListener('touchstart', (e) => {
  if (e.touches.length === 2) pinchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
}, { passive: true });
canvas.addEventListener('touchmove', (e) => {
  if (e.touches.length === 2) {
    const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    if (pinchDist) {
      userCamera();
      orbit.radius = clamp(orbit.radius * (pinchDist / d), 3, 26);
    }
    pinchDist = d;
  }
}, { passive: true });

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let downAt = { x: 0, y: 0 };
canvas.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY }; });

function handlePick(e) {
  if (!e || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6) return;
  pointer.x = (e.clientX / innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects([pelican, bike], true);
  if (!hits.length) return;
  let o = hits[0].object;
  while (o && o !== pelican && o !== bike) o = o.parent;
  if (o === bike || hits[0].object.name === 'bell') ringBell();
  else honk();
}

function honk() {
  state.honk = 1;
  state.flap = 1;
  audio.honk();
}
function ringBell() {
  audio.bell();
  bell.scale.setScalar(1.4);
}

function setCamMode(m) {
  state.camMode = m;
  document.querySelectorAll('.cam').forEach((b) => b.classList.toggle('active', +b.dataset.cam === m));
}
document.querySelectorAll('.cam').forEach((b) => b.addEventListener('click', () => setCamMode(+b.dataset.cam)));

$('#btn-play').addEventListener('click', () => {
  state.paused = !state.paused;
  $('#btn-play').innerHTML = state.paused ? '▶ <span>继续</span>' : '⏸ <span>暂停</span>';
});
$('#btn-night').addEventListener('click', () => {
  state.nightTarget = state.nightTarget > 0.5 ? 0 : 1;
  $('#btn-night').innerHTML = state.nightTarget > 0.5 ? '☀ <span>白天</span>' : '🌓 <span>夜晚</span>';
});
$('#btn-audio').addEventListener('click', () => {
  const on = audio.toggle();
  $('#btn-audio').innerHTML = on ? '🔊 <span>有声</span>' : '🔇 <span>静音</span>';
});
$('#btn-bell').addEventListener('click', () => ringBell());
$('#spd').addEventListener('input', (e) => {
  state.speed = +e.target.value;
  $('#spd-val').textContent = state.speed.toFixed(2) + 'x';
});
addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    $('#btn-play').click();
  } else if (e.key === 'n' || e.key === 'N') {
    $('#btn-night').click();
  } else if (e.key === 'b' || e.key === 'B') {
    ringBell();
  } else if (e.key >= '1' && e.key <= '4') {
    setCamMode(+e.key - 1);
  }
});

function applyPalette(n) {
  skyUniforms.uTop.value.lerpColors(dayPal.top, nightPal.top, n);
  skyUniforms.uHorizon.value.lerpColors(dayPal.horizon, nightPal.horizon, n);
  skyUniforms.uNight.value = n;
  scene.fog.color.lerpColors(dayPal.fog, nightPal.fog, n);
  mats.grass.color.lerpColors(dayPal.grass, nightPal.grass, n);
  mats.road.color.lerpColors(dayPal.road, nightPal.road, n);
  hemi.color.lerpColors(dayPal.amb, nightPal.amb, n);
  hemi.intensity = lerp(0.78, 0.3, n);
  hemi.groundColor.setHSL(0.28, 0.35, lerp(0.3, 0.07, n));
  amb.intensity = lerp(0.18, 0.14, n);
  amb.color.lerpColors(dayPal.amb, nightPal.amb, n);
  sun.intensity = lerp(3.0, 0.0, n);
  moon.intensity = lerp(0, 0.45, n);
  rim.intensity = lerp(0.45, 0.1, n);
  stars.material.opacity = n * 0.95;
  sunMesh.material.opacity = 1 - n;
  moonMesh.material.opacity = n;
  bloom.strength = lerp(0.4, 1.0, n);
  bloom.threshold = lerp(0.85, 0.5, n);
  mats.glow.emissiveIntensity = n * 3.2;
  headSpot.intensity = n * 60;
  headBeam.material.opacity = n * 0.075;
  dustMat.opacity = lerp(0.36, 0.16, n);
}

function updateWorld(dt) {
  const travel = state.speed * dt * 5.5;
  state.dist += travel;
  for (const o of scrollItems) {
    o.position.z = wrapZ(o.userData.baseZ - state.dist);
  }
  for (const c of clouds) {
    c.position.z = wrapZ(c.position.z - (travel * 0.25 + c.userData.drift * dt));
    c.position.x += Math.sin(state.dist * 0.01 + c.position.y) * dt * 0.2;
  }
  sunMesh.position.copy(skyUniforms.uSunDir.value).multiplyScalar(430);
  sunMesh.lookAt(camera.position);
  moonMesh.position.copy(skyUniforms.uMoonDir.value).multiplyScalar(430);
  moonMesh.lookAt(camera.position);
}

function updateRider(t, dt) {
  const wheelSpin = state.dist / R;
  wheelBack.rotation.x = wheelSpin;
  wheelFront.rotation.x = wheelSpin;
  state.crank = state.dist / (R * 2.5);
  crank.rotation.x = state.crank;
  pedalR.rotation.x = -state.crank;
  pedalRL.rotation.x = -state.crank;
  chainring.rotation.x = -state.crank;
  cog.rotation.x = -state.crank;

  scene.updateMatrixWorld();
  legParts.forEach((L, i) => {
    const target = targets[i].getWorldPosition(tmpV);
    solveIK(L.hip, target, THIGH, SHIN, pole, ikOut);
    setSeg(L.upper, L.hip, ikOut.knee, 0.085);
    setSeg(L.lower, ikOut.knee, target, 0.07);
    L.knee.position.copy(ikOut.knee);
    L.knee.scale.setScalar(1);
    L.foot.position.copy(target);
    L.foot.position.y -= 0.035;
  });

  const bob = Math.sin(state.crank * 2) * 0.012 * Math.min(state.speed, 1);
  body.position.y = 1.42 + bob;
  belly.position.y = 1.3 + bob;
  pelican.position.y = bob * 0.4;

  const curve = new THREE.CatmullRomCurve3([
    V(0, 1.6 + bob, -0.22),
    V(0, 1.8 + bob, -0.14),
    V(0, 1.99 + bob * 0.5, -0.02),
    V(0, 2.14, 0.13),
  ]);
  const pts = curve.getSpacedPoints(NECK_N - 1);
  const wob = Math.sin(t * 2.4) * 0.02 + state.honk * Math.sin(t * 16) * 0.05;
  for (let i = 0; i < NECK_N; i++) {
    const p = pts[i];
    p.x += wob * (i / NECK_N);
    const r = lerp(0.165, 0.11, i / (NECK_N - 1));
    neckJoints[i].position.copy(p);
    neckJoints[i].scale.setScalar(r * 0.93);
    if (i < NECK_N - 1) setSeg(neckMeshes[i], p, pts[i + 1], r);
    else neckMeshes[i].scale.setScalar(0.0001);
  }
  const last = pts[NECK_N - 1];
  const dir = new THREE.Vector3().subVectors(last, pts[NECK_N - 2]).normalize();
  headGroup.position.copy(last).addScaledVector(dir, 0.09);
  const sway = Math.sin(t * 1.7) * 0.05;
  headGroup.rotation.set(-0.1 + Math.sin(t * 2.2) * 0.04, sway, Math.sin(t * 1.3) * 0.06);
  pouch.scale.y = 1.5 + state.honk * 0.7 + Math.sin(t * 3) * 0.05;
  pouch.scale.z = 2.3 + state.honk * 0.5;

  state.flap = Math.max(0, state.flap - dt * 1.4);
  const glide = Math.sin(t * 2.6) * 0.05;
  const flapAmt = glide + state.flap * Math.sin(t * 22) * 0.6;
  for (const [w, s] of [[wingR, 1], [wingL, -1]]) {
    w.rotation.set(
      0.3 - flapAmt * 0.55,
      -s * (Math.PI / 2 - 0.16) + Math.sin(t * 1.4) * 0.04,
      Math.sin(t * 1.1) * 0.05
    );
  }
  state.honk = Math.max(0, state.honk - dt * 1.6);
}

function updateDust(dt) {
  const pos = dustGeo.attributes.position.array;
  const rate = state.speed * 30;
  for (let i = 0; i < dustCount; i++) {
    dustLife[i] -= dt * (0.5 + state.speed * 0.5);
    if (dustLife[i] <= 0) {
      dustLife[i] = rand(0.5, 1.1);
      pos[i * 3] = rand(-0.5, 0.5);
      pos[i * 3 + 1] = 0.04;
      pos[i * 3 + 2] = -0.78 + rand(-0.1, 0.1);
    } else {
      pos[i * 3 + 1] += dt * 0.7;
      pos[i * 3 + 2] -= dt * rate * 0.12;
      pos[i * 3] += Math.sin(i + state.dist) * dt * 0.15;
    }
  }
  dustGeo.attributes.position.needsUpdate = true;
}

function updateCamera(dt) {
  const m = state.camMode;
  if (m === 0) {
    desiredPos.set(
      orbit.radius * Math.sin(orbit.phi) * Math.sin(orbit.theta),
      orbit.radius * Math.cos(orbit.phi) + 1.1,
      orbit.radius * Math.sin(orbit.phi) * Math.cos(orbit.theta)
    );
    desiredLook.set(0, 1.45, 0);
  } else if (m === 1) {
    autoTheta += dt * camPresets[1].speed;
    const p = camPresets[1];
    desiredPos.set(
      p.radius * Math.sin(autoTheta),
      p.height + Math.sin(autoTheta * 0.7) * 0.8,
      p.radius * Math.cos(autoTheta)
    );
    desiredLook.set(0, 1.45, 0);
  } else if (m === 2) {
    const sw = Math.sin(performance.now() * 0.0004);
    desiredPos.set(3.4 + sw * 1.6, 2.1 + Math.sin(performance.now() * 0.0003) * 0.4, -3.6 + sw * 0.6);
    desiredLook.copy(camPresets[2].look);
  } else {
    desiredPos.copy(camPresets[3].pos);
    desiredLook.copy(camPresets[3].look);
  }
  const k = 1 - Math.exp(-dt * (m === 0 ? 9 : 2.4));
  camPos.lerp(desiredPos, k);
  lookTarget.lerp(desiredLook, k);
  camera.position.copy(camPos);
  camera.lookAt(lookTarget);
}

let last = performance.now();
let fpsAcc = 0;
let fpsCount = 0;
let fpsTime = 0;

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  const t = now / 1000;

  if (!state.paused) {
    state.night += (state.nightTarget - state.night) * (1 - Math.exp(-dt * 2.4));
    applyPalette(state.night);
    updateWorld(dt);
    updateRider(t, dt);
    updateDust(dt);
    $('#rpm').textContent = Math.round(state.speed * 37.5);
    $('#dist').textContent = Math.round(state.dist);
  }
  updateCamera(dt);
  bell.scale.lerp(ONE, 1 - Math.exp(-dt * 8));

  composer.render();

  fpsAcc += 1 / Math.max(dt, 0.0001);
  fpsCount++;
  fpsTime += dt;
  if (fpsTime > 0.5) {
    $('#fps').textContent = Math.round(fpsAcc / fpsCount);
    fpsAcc = 0; fpsCount = 0; fpsTime = 0;
  }
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
});

window.__app = { renderer, scene, camera, sun, bloom, state, audio };
applyPalette(0);
renderer.compile(scene, camera);
renderer.setAnimationLoop(frame);
requestAnimationFrame(() => setTimeout(() => $('#loader').classList.add('done'), 500));
