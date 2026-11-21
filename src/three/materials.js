import * as THREE from 'three'
import { makeCanvas } from './canvas.js'

/* -------------------------------------------------------------------------- */
/*  Facade material                                                            */
/*  A PBR MeshStandardMaterial patched to draw curtain-wall glazing from world */
/*  position: mullions, spandrels, reflective glass and a sparse scatter of    */
/*  warm-lit windows. No textures, works with instancing, and fades to an      */
/*  averaged tone at distance (fwidth) to avoid moiré shimmer.                 */
/* -------------------------------------------------------------------------- */
export function facadeMaterial({
  color = '#d9d6cf',
  cell = [0.32, 0.38],
  night = 0.0,
  roughness = 0.6,
  metalness = 0.15,
  glassTint = [0.55, 0.61, 0.65],
  winFill = [0.08, 0.92, 0.14, 0.9],
} = {}) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness, metalness })
  const uniforms = {
    uNight: { value: night },
    uCell: { value: new THREE.Vector2(cell[0], cell[1]) },
    uTint: { value: new THREE.Vector3(...glassTint) },
    uFill: { value: new THREE.Vector4(...winFill) },
  }
  mat.userData.uniforms = uniforms
  mat.customProgramCacheKey = () => 'facade-v2'
  mat.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, uniforms)
    s.vertexShader = s.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vFPos; varying vec3 vFNrm;`
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
{
  vec4 fp = vec4(transformed, 1.0); vec3 fn = objectNormal;
  #ifdef USE_INSTANCING
    fp = instanceMatrix * fp; fn = mat3(instanceMatrix) * fn;
  #endif
  fp = modelMatrix * fp; vFPos = fp.xyz; vFNrm = normalize(mat3(modelMatrix) * fn);
}`
      )
    s.fragmentShader = s.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uNight; uniform vec2 uCell; uniform vec3 uTint; uniform vec4 uFill;
varying vec3 vFPos; varying vec3 vFNrm;
float fHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
vec3 fN = normalize(vFNrm);
float fSide = 1.0 - smoothstep(0.35, 0.65, abs(fN.y));
float fU = abs(fN.x) > abs(fN.z) ? vFPos.z : vFPos.x;
vec2 fC = vec2(fU / uCell.x, vFPos.y / uCell.y);
vec2 fF = fract(fC); vec2 fId = floor(fC);
float fW = step(uFill.x, fF.x) * step(fF.x, uFill.y) * step(uFill.z, fF.y) * step(fF.y, uFill.w);
float fAA = clamp(1.5 - max(fwidth(fC.x), fwidth(fC.y)) * 2.6, 0.0, 1.0);
float fWin = mix(0.62, fW, fAA) * fSide;
float fRnd = fHash(fId + floor(vFPos.xz * 0.37) * 7.0);
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * uTint, fWin * 0.85);`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.12, fWin);`
      )
      .replace(
        '#include <metalnessmap_fragment>',
        `#include <metalnessmap_fragment>
metalnessFactor = mix(metalnessFactor, 0.75, fWin);`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
totalEmissiveRadiance += vec3(1.0, 0.7, 0.4) * fW * fSide * fAA * step(0.8, fRnd) * uNight * (0.5 + 0.8 * fRnd);`
      )
  }
  return mat
}

/* -------------------------------------------------------------------------- */
/*  Procedural canvas textures (zero network weight)                           */
/* -------------------------------------------------------------------------- */
export function canvasTexture(w, h, draw, { repeat = [1, 1], srgb = true, aniso = 8 } = {}) {
  const c = makeCanvas(w, h)
  draw(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(repeat[0], repeat[1])
  t.anisotropy = aniso
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  return t
}

function noise(g, w, h, amount) {
  const img = g.getImageData(0, 0, w, h)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amount
    d[i] += n
    d[i + 1] += n
    d[i + 2] += n
  }
  g.putImageData(img, 0, 0)
}

export function woodTexture(base = '#b88c63', repeat = [4, 4]) {
  return canvasTexture(
    512,
    512,
    (g, w, h) => {
      g.fillStyle = base
      g.fillRect(0, 0, w, h)
      const planks = 6
      const pw = w / planks
      for (let i = 0; i < planks; i++) {
        let y = -Math.random() * 300
        while (y < h) {
          const len = 220 + Math.random() * 200
          const l = (Math.random() - 0.5) * 26
          g.fillStyle = `rgba(${l > 0 ? 255 : 0},${l > 0 ? 240 : 0},${l > 0 ? 220 : 0},${Math.abs(l) / 255 + 0.03})`
          g.fillRect(i * pw, y, pw, len)
          // grain
          g.strokeStyle = 'rgba(70,40,20,0.10)'
          g.lineWidth = 1
          for (let k = 0; k < 9; k++) {
            g.beginPath()
            const x = i * pw + Math.random() * pw
            g.moveTo(x, y)
            g.bezierCurveTo(x + 4, y + len * 0.3, x - 4, y + len * 0.7, x + Math.random() * 3, y + len)
            g.stroke()
          }
          g.fillStyle = 'rgba(40,25,15,0.35)'
          g.fillRect(i * pw, y + len - 1, pw, 1.5)
          y += len
        }
        g.fillStyle = 'rgba(40,25,15,0.4)'
        g.fillRect(i * pw, 0, 1.5, h)
      }
      noise(g, w, h, 14)
    },
    { repeat }
  )
}

export function stoneTexture(base = '#e7dfd1', repeat = [2, 2], tile = 0) {
  return canvasTexture(
    512,
    512,
    (g, w, h) => {
      g.fillStyle = base
      g.fillRect(0, 0, w, h)
      for (let i = 0; i < 260; i++) {
        g.fillStyle = `rgba(${150 + Math.random() * 60},${130 + Math.random() * 50},${100 + Math.random() * 40},${Math.random() * 0.06})`
        const r = 6 + Math.random() * 40
        g.beginPath()
        g.ellipse(Math.random() * w, Math.random() * h, r * 2.4, r, Math.random() * 0.3, 0, Math.PI * 2)
        g.fill()
      }
      if (tile) {
        g.strokeStyle = 'rgba(120,105,85,0.25)'
        g.lineWidth = 2
        for (let i = 0; i <= tile; i++) {
          g.beginPath(); g.moveTo((i * w) / tile, 0); g.lineTo((i * w) / tile, h); g.stroke()
          g.beginPath(); g.moveTo(0, (i * h) / tile); g.lineTo(w, (i * h) / tile); g.stroke()
        }
      }
      noise(g, w, h, 10)
    },
    { repeat }
  )
}

export function grassTexture(repeat = [6, 6]) {
  return canvasTexture(
    256,
    256,
    (g, w, h) => {
      g.fillStyle = '#7d8f62'
      g.fillRect(0, 0, w, h)
      for (let i = 0; i < 3000; i++) {
        g.fillStyle = `rgba(${60 + Math.random() * 60},${90 + Math.random() * 50},${40 + Math.random() * 30},0.35)`
        g.fillRect(Math.random() * w, Math.random() * h, 1, 2 + Math.random() * 3)
      }
    },
    { repeat }
  )
}

/** Tileable ripple normal map for water surfaces. */
/** Tileable ripple normal map for water surfaces (analytic gradients, cached source). */
let waterCanvas = null
function waterSource() {
  if (waterCanvas) return waterCanvas
  const S = 256
  const c = makeCanvas(S, S)
  const g = c.getContext('2d')
  const img = g.createImageData(S, S)
  const d = img.data
  const waves = [
    [3, 1, 0.5], [1, 4, 0.4], [5, -2, 0.25], [-3, 6, 0.2], [7, 5, 0.12], [9, -7, 0.08],
  ]
  const k = (Math.PI * 2) / S
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      let dx = 0
      let dy = 0
      for (let w = 0; w < waves.length; w++) {
        const [a, b, amp] = waves[w]
        const c0 = Math.cos((a * x + b * y) * k) * amp * k
        dx += c0 * a
        dy += c0 * b
      }
      let nx = -dx * 6
      let ny = -dy * 6
      const inv = 1 / Math.sqrt(nx * nx + ny * ny + 1)
      const i = (y * S + x) * 4
      d[i] = (nx * inv * 0.5 + 0.5) * 255
      d[i + 1] = (ny * inv * 0.5 + 0.5) * 255
      d[i + 2] = (inv * 0.5 + 0.5) * 255
      d[i + 3] = 255
    }
  g.putImageData(img, 0, 0)
  waterCanvas = c
  return c
}

export function waterNormalTexture(repeat = [40, 40]) {
  const t = new THREE.CanvasTexture(waterSource())
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(repeat[0], repeat[1])
  t.anisotropy = 8
  return t
}

/* -------------------------------------------------------------------------- */
/*  Shared material library for architectural models (1 unit = 1 metre).       */
/*  Each material (and its procedural texture) is created on first access, so  */
/*  the hero only pays for the handful it uses.                                */
/* -------------------------------------------------------------------------- */
const factories = {
  plaster: () => new THREE.MeshStandardMaterial({ color: '#f4f0e8', roughness: 0.85 }),
  travertine: () => new THREE.MeshStandardMaterial({ color: '#e4d6c0', roughness: 0.7, map: stoneTexture('#e6d8c2', [1, 1]) }),
  stoneFloor: () => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.45, map: stoneTexture('#ebe4d8', [3, 3], 4) }),
  oak: () => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.55, map: woodTexture('#c49b72', [1, 1]) }),
  teak: () => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.7, map: woodTexture('#9a6f4b', [1, 1]) }),
  oakFloor: () => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5, map: woodTexture('#c9a37c', [7, 4]) }),
  teakDeck: () => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.75, map: woodTexture('#9a6f4b', [7, 1.4]) }),
  walnut: () => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5, map: woodTexture('#6b4a33', [1, 1]) }),
  bronze: () => new THREE.MeshStandardMaterial({ color: '#8c6b4a', roughness: 0.32, metalness: 0.85 }),
  darkMetal: () => new THREE.MeshStandardMaterial({ color: '#3a3d3e', roughness: 0.4, metalness: 0.7 }),
  glass: () =>
    new THREE.MeshPhysicalMaterial({
      color: '#c9dcdf',
      roughness: 0.03,
      metalness: 0.1,
      transparent: true,
      opacity: 0.28,
      envMapIntensity: 1.5,
      depthWrite: false,
    }),
  tintedGlass: () => new THREE.MeshStandardMaterial({ color: '#6f8288', roughness: 0.05, metalness: 0.9 }),
  fabricSand: () => new THREE.MeshStandardMaterial({ color: '#d9c8ae', roughness: 0.95 }),
  fabricSage: () => new THREE.MeshStandardMaterial({ color: '#a5b2a0', roughness: 0.95 }),
  fabricCharcoal: () => new THREE.MeshStandardMaterial({ color: '#4a4f50', roughness: 0.95 }),
  linen: () => new THREE.MeshStandardMaterial({ color: '#f8f6f1', roughness: 0.9 }),
  rug: () => new THREE.MeshStandardMaterial({ color: '#cdbb9f', roughness: 1 }),
  marble: () => new THREE.MeshStandardMaterial({ color: '#f3efe9', roughness: 0.2, map: stoneTexture('#f1ece4', [1, 1]) }),
  hedge: () => new THREE.MeshStandardMaterial({ color: '#647552', roughness: 1 }),
  trunk: () => new THREE.MeshStandardMaterial({ color: '#8a7559', roughness: 1 }),
  grass: () => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, map: grassTexture([8, 8]) }),
  sand: () => new THREE.MeshStandardMaterial({ color: '#e3d3b6', roughness: 1 }),
  water: () =>
    new THREE.MeshPhysicalMaterial({
      color: '#5e9ea3',
      roughness: 0.04,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      normalMap: waterNormalTexture([3, 3]),
      normalScale: new THREE.Vector2(0.25, 0.25),
      envMapIntensity: 1.2,
    }),
  champagne: () =>
    new THREE.MeshStandardMaterial({
      color: '#d8c3a5',
      emissive: '#d8b380',
      emissiveIntensity: 0.9,
      roughness: 0.3,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    }),
}

const lib = {}
for (const key of Object.keys(factories)) {
  let value = null
  Object.defineProperty(lib, key, { enumerable: true, get: () => value || (value = factories[key]()) })
}

export function materials() {
  return lib
}
