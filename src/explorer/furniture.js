import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mulberry32 } from '../lib/random.js'

/*
 * Furniture & fixtures at real-world proportions (metres). Each builder returns a Group
 * standing on y = 0, front facing +z, so it can be placed and rotated in the plan.
 * Geometry is created per floor and disposed with it.
 */

const V = (x, y) => new THREE.Vector2(x, y)

export function mesh(parent, geo, mat, x = 0, y = 0, z = 0, { rx = 0, ry = 0, rz = 0, cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, mat)
  m.position.set(x, y, z)
  m.rotation.set(rx, ry, rz)
  m.castShadow = cast
  m.receiveShadow = receive
  parent.add(m)
  return m
}
/** Geometry detail: 0 = lean (phones), 1 = full. Soft pieces keep smooth corners; small joinery stays cheap. */
let detail = 1
export const setFurnitureDetail = (d) => (detail = d)
/** rounded box whose base sits at y (segments scale with corner radius → bounded triangle cost) */
export function rb(parent, w, h, d, mat, x, y, z, r = 0.02, opts) {
  const rr = Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3)
  let seg = rr >= 0.05 ? 3 : rr >= 0.02 ? 2 : 1
  if (!detail) seg = Math.max(1, seg - 1)
  const geo = rr > 0.004 ? new RoundedBoxGeometry(w, h, d, seg, rr) : new THREE.BoxGeometry(w, h, d)
  return mesh(parent, geo, mat, x, y + h / 2, z, opts)
}
export function cyl(parent, rt, rb_, h, mat, x, y, z, seg = 40, opts) {
  return mesh(parent, new THREE.CylinderGeometry(rt, rb_, h, seg), mat, x, y + h / 2, z, opts)
}
function lathe(parent, pts, mat, x, y, z, seg = 48, opts) {
  return mesh(parent, new THREE.LatheGeometry(pts, seg), mat, x, y, z, opts)
}
const group = (x = 0, z = 0, ry = 0) => {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  g.rotation.y = ry
  return g
}

/* ------------------------------- living ------------------------------- */
export function sofa(M, { len = 3.2, ret = 0, fabric = M.sofa, cushions = M.accent } = {}) {
  const g = group()
  const d = 1.05
  rb(g, len - 0.1, 0.12, d - 0.12, M.stoneDark, 0, 0, 0, 0.02, { cast: false }) // recessed plinth
  rb(g, len, 0.24, d, fabric, 0, 0.1, 0, 0.06)
  const seats = Math.max(2, Math.round(len / 1.05))
  const sw = (len - 0.36) / seats
  for (let i = 0; i < seats; i++) rb(g, sw - 0.02, 0.18, d - 0.3, fabric, -len / 2 + 0.18 + sw * (i + 0.5), 0.34, 0.1, 0.07)
  rb(g, len, 0.42, 0.26, fabric, 0, 0.32, -d / 2 + 0.13, 0.08) // back frame
  for (let i = 0; i < seats; i++) {
    const c = rb(g, sw - 0.04, 0.46, 0.2, fabric, -len / 2 + 0.18 + sw * (i + 0.5), 0.5, -d / 2 + 0.34, 0.09)
    c.rotation.x = -0.14
  }
  rb(g, 0.18, 0.56, d, fabric, -len / 2 + 0.09, 0.1, 0, 0.07)
  rb(g, 0.18, 0.56, d, fabric, len / 2 - 0.09, 0.1, 0, 0.07)
  // scatter cushions
  for (const [x, rz] of [[-len / 2 + 0.55, 0.12], [-len / 2 + 0.95, -0.08], [len / 2 - 0.6, -0.1]]) {
    const c = rb(g, 0.48, 0.46, 0.14, cushions, x, 0.5, -d / 2 + 0.52, 0.07)
    c.rotation.set(-0.3, 0, rz)
  }
  if (ret > 0) {
    // chaise return on the left
    const x0 = -len / 2 + d / 2
    rb(g, d - 0.12, 0.12, ret - 0.1, M.stoneDark, x0, 0, d / 2 + ret / 2 - 0.05, 0.02, { cast: false })
    rb(g, d, 0.24, ret, fabric, x0, 0.1, d / 2 + ret / 2 - 0.02, 0.06)
    rb(g, d - 0.3, 0.18, ret - 0.1, fabric, x0 + 0.1, 0.34, d / 2 + ret / 2 - 0.05, 0.07)
    rb(g, 0.18, 0.56, ret, fabric, -len / 2 + 0.09, 0.1, d / 2 + ret / 2 - 0.02, 0.07)
  }
  return g
}

export function armchair(M, fabric = M.chair) {
  const g = group()
  rb(g, 0.82, 0.2, 0.8, fabric, 0, 0.16, 0, 0.08)
  rb(g, 0.66, 0.16, 0.62, fabric, 0, 0.34, 0.06, 0.07)
  const back = rb(g, 0.82, 0.5, 0.18, fabric, 0, 0.32, -0.32, 0.08)
  back.rotation.x = -0.18
  rb(g, 0.14, 0.3, 0.72, fabric, -0.36, 0.32, 0.02, 0.06)
  rb(g, 0.14, 0.3, 0.72, fabric, 0.36, 0.32, 0.02, 0.06)
  for (const [x, z] of [[-0.33, -0.3], [0.33, -0.3], [-0.33, 0.3], [0.33, 0.3]]) cyl(g, 0.016, 0.012, 0.16, M.brass, x, 0, z, 12)
  return g
}

export function coffeeTables(M) {
  const g = group()
  cyl(g, 0.62, 0.62, 0.04, M.marble, 0, 0.34, 0, 64)
  cyl(g, 0.42, 0.46, 0.34, M.stoneDark, 0, 0, 0, 48)
  cyl(g, 0.38, 0.38, 0.035, M.stone, 0.78, 0.4, 0.45, 48)
  cyl(g, 0.06, 0.06, 0.4, M.brass, 0.78, 0, 0.45, 16)
  cyl(g, 0.18, 0.2, 0.012, M.brass, 0.78, 0, 0.45, 32)
  // styling: stacked books, a bowl, a vase
  rb(g, 0.32, 0.04, 0.24, M.linen, -0.18, 0.38, -0.1, 0.004)
  rb(g, 0.28, 0.035, 0.21, M.accent, -0.17, 0.42, -0.1, 0.004)
  lathe(g, [V(0, 0), V(0.14, 0.01), V(0.18, 0.06), V(0.17, 0.07), V(0.13, 0.03), V(0, 0.025)], M.ceramic, 0.18, 0.38, 0.12)
  vase(g, M, 0.78, 0.435, 0.45, 0.5)
  return g
}

export function vase(parent, M, x, y, z, s = 1, mat = M.ceramic) {
  return lathe(
    parent,
    [V(0, 0), V(0.07, 0), V(0.1, 0.06), V(0.11, 0.14), V(0.07, 0.24), V(0.045, 0.3), V(0.05, 0.33), V(0.04, 0.33)].map((p) => p.multiplyScalar(s)),
    mat,
    x,
    y,
    z,
    40
  )
}

export function rug(M, w, d) {
  const g = group()
  rb(g, w, 0.015, d, M.rug, 0, 0, 0, 0.006, { cast: false })
  return g
}

export function arcLamp(M) {
  const g = group()
  cyl(g, 0.2, 0.2, 0.04, M.stoneDark, 0, 0, 0, 32)
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0.04, 0), new THREE.Vector3(0, 2.4, 0), new THREE.Vector3(1.5, 1.95, 0.4))
  mesh(g, new THREE.TubeGeometry(curve, 32, 0.014, 8), M.brass)
  lathe(g, [V(0, 0.2), V(0.04, 0.2), V(0.24, 0.02), V(0.26, 0)], M.lampShade, 1.5, 1.72, 0.4, 40, { cast: false })
  mesh(g, new THREE.SphereGeometry(0.05, 12, 8), M.bulbWarm, 1.5, 1.78, 0.4, { cast: false })
  return g
}

export function credenza(M, len = 2.4) {
  const g = group()
  rb(g, len, 0.62, 0.46, M.joinery, 0, 0.12, 0, 0.012)
  for (let i = 1; i < 4; i++) rb(g, 0.006, 0.56, 0.005, M.stoneDark, -len / 2 + (len / 4) * i, 0.15, 0.231, 0)
  for (const x of [-len * 0.36, len * 0.36]) cyl(g, 0.02, 0.02, 0.12, M.brass, x, 0, 0, 12)
  vase(g, M, -len * 0.3, 0.74, 0, 1.3, M.stone)
  rb(g, 0.36, 0.05, 0.26, M.linen, len * 0.25, 0.74, 0, 0.005)
  return g
}

export function artwork(M, w, h, seed, tone = '#c49a6c') {
  const g = group()
  const tex = new THREE.CanvasTexture(paintArt(seed, tone))
  tex.colorSpace = THREE.SRGBColorSpace
  rb(g, w + 0.08, h + 0.08, 0.04, M.brass, 0, 0, 0, 0.004)
  const artMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92 })
  artMat.userData.ownsMaps = true
  mesh(g, new THREE.PlaneGeometry(w, h), artMat, 0, (h + 0.08) / 2, 0.022)
  return g
}
function paintArt(seed, tone) {
  const c = document.createElement('canvas')
  c.width = 384
  c.height = 480
  const g = c.getContext('2d')
  const rnd = mulberry32(seed)
  g.fillStyle = '#efe7da'
  g.fillRect(0, 0, c.width, c.height)
  const cols = [tone, '#a5b2a0', '#d9c8ae', '#303638', '#e8d5b8']
  for (let i = 0; i < 5; i++) {
    g.globalAlpha = 0.7
    g.fillStyle = cols[i]
    g.beginPath()
    g.ellipse(c.width * (0.2 + rnd() * 0.6), c.height * (0.2 + rnd() * 0.6), 30 + rnd() * 130, 20 + rnd() * 110, rnd() * 3, 0, Math.PI * 2)
    g.fill()
  }
  g.globalAlpha = 1
  g.strokeStyle = '#303638'
  g.lineWidth = 2.5
  g.beginPath()
  g.arc(c.width * 0.6, c.height * 0.42, 90, 0.5, 4.4)
  g.stroke()
  return c
}

export function plant(M, s = 1, seed = 1) {
  const g = group()
  const rnd = mulberry32(seed * 31 + 7)
  lathe(g, [V(0, 0), V(0.2, 0), V(0.26, 0.05), V(0.28, 0.5), V(0.25, 0.52), V(0, 0.5)].map((p) => p.multiplyScalar(s)), M.stone, 0, 0, 0)
  cyl(g, 0.24 * s, 0.24 * s, 0.02, M.soil, 0, 0.48 * s, 0, 24, { cast: false })
  const stemH = 1.5 * s
  mesh(g, new THREE.CylinderGeometry(0.012 * s, 0.025 * s, stemH, 5), M.leaf, 0, 0.5 * s + stemH / 2, 0)
  const leafGeo = new THREE.SphereGeometry(1, 6, 3)
  leafGeo.scale(0.11 * s, 0.2 * s, 0.012 * s)
  leafGeo.translate(0, 0.17 * s, 0)
  const n = 46
  const leaves = new THREE.InstancedMesh(leafGeo, M.leaf, n)
  const o = new THREE.Object3D()
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2
    const h = 0.7 * s + rnd() * 1.35 * s
    o.position.set(Math.cos(a) * 0.05 * s, h, Math.sin(a) * 0.05 * s)
    o.rotation.set(0.5 + rnd() * 0.9, a, (rnd() - 0.5) * 0.6)
    o.scale.setScalar(0.75 + rnd() * 0.5)
    o.updateMatrix()
    leaves.setMatrixAt(i, o.matrix)
  }
  leaves.castShadow = true
  g.add(leaves)
  return g
}

/* ------------------------------- dining ------------------------------- */
export function diningTable(M, len = 3.0) {
  const g = group()
  rb(g, len, 0.06, 1.1, M.joinery, 0, 0.7, 0, 0.012)
  for (const x of [-len * 0.3, len * 0.3]) {
    rb(g, 0.16, 0.7, 0.7, M.stoneDark, x, 0, 0, 0.03)
  }
  return g
}

export function diningChair(M, fabric = M.chair) {
  const g = group()
  rb(g, 0.48, 0.09, 0.5, fabric, 0, 0.42, 0, 0.035)
  const back = rb(g, 0.48, 0.44, 0.07, fabric, 0, 0.5, -0.23, 0.03)
  back.rotation.x = -0.12
  for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) cyl(g, 0.013, 0.018, 0.42, M.joinery, x, 0, z, 10)
  return g
}

export function pendantLinear(M, len = 2.2, drop = 1.0, ceiling = 3.3) {
  const g = group()
  const y = ceiling - drop
  rb(g, len, 0.035, 0.05, M.brass, 0, y, 0, 0.01, { cast: false })
  for (const x of [-len / 2 + 0.1, len / 2 - 0.1]) cyl(g, 0.003, 0.003, drop, M.brass, x, y, 0, 4, { cast: false })
  const n = 5
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + 0.2 + (i * (len - 0.4)) / (n - 1)
    mesh(g, new THREE.SphereGeometry(0.11, 24, 16), M.lampShade, x, y - 0.12, 0, { cast: false })
  }
  return g
}

export function sideboard(M, len = 2.8) {
  const g = credenza(M, len)
  return g
}

/* ------------------------------- kitchen ------------------------------- */
/** Back run along the wall: tall columns + base units + marble worktop & splashback. */
export function kitchenRun(M, len = 6.2) {
  const g = group()
  const tall = 2.4
  let x = -len / 2
  const col = (w, kind) => {
    rb(g, w - 0.01, tall, 0.62, M.joinery, x + w / 2, 0, 0, 0.006)
    if (kind === 'oven') {
      rb(g, w - 0.08, 0.58, 0.012, M.blackGlass, x + w / 2, 0.85, 0.312, 0.004, { cast: false })
      rb(g, w - 0.08, 0.42, 0.012, M.blackGlass, x + w / 2, 1.48, 0.312, 0.004, { cast: false })
      rb(g, w - 0.16, 0.018, 0.03, M.steel, x + w / 2, 1.38, 0.33, 0.005)
      rb(g, w - 0.16, 0.018, 0.03, M.steel, x + w / 2, 1.94, 0.33, 0.005)
    } else {
      rb(g, 0.02, 0.9, 0.03, M.brass, x + w - 0.07, 0.9, 0.33, 0.006)
    }
    rb(g, 0.004, tall - 0.04, 0.005, M.stoneDark, x + w - 0.005, 0.02, 0.311, 0, { cast: false })
    x += w
  }
  col(0.9, 'fridge')
  col(0.6, 'oven')
  col(0.6, 'pantry')
  const baseLen = len / 2 + len / 2 - (x + len / 2) // remaining length
  const bx = x + baseLen / 2
  rb(g, baseLen, 0.86, 0.62, M.joinery, bx, 0.06, 0, 0.006)
  rb(g, baseLen, 0.06, 0.02, M.stoneDark, bx, 0, 0.29, 0, { cast: false }) // toe kick shadow
  const doors = Math.max(2, Math.round(baseLen / 0.6))
  for (let i = 1; i < doors; i++) rb(g, 0.004, 0.84, 0.005, M.stoneDark, bx - baseLen / 2 + (baseLen / doors) * i, 0.07, 0.311, 0, { cast: false })
  rb(g, baseLen, 0.025, 0.004, M.stoneDark, bx, 0.62, 0.311, 0, { cast: false }) // drawer line
  rb(g, baseLen + 0.02, 0.04, 0.66, M.marble, bx, 0.92, 0.01, 0.004)
  rb(g, baseLen, 0.7, 0.02, M.marble, bx, 0.96, -0.3, 0.002) // splashback
  rb(g, baseLen, 0.018, 0.04, M.cove, bx, 1.64, -0.24, 0, { cast: false }) // under-shelf light
  rb(g, baseLen, 0.04, 0.3, M.joinery, bx, 1.66, -0.16, 0.004) // floating shelf
  // sink + faucet
  rb(g, 0.62, 0.02, 0.42, M.steel, bx - baseLen * 0.2, 0.955, 0.03, 0.01, { cast: false })
  faucet(g, M, bx - baseLen * 0.2, 0.96, -0.22)
  return g
}

function faucet(parent, M, x, y, z, s = 1) {
  cyl(parent, 0.022 * s, 0.026 * s, 0.05 * s, M.chrome, x, y, z, 16)
  const c = new THREE.CatmullRomCurve3([
    new THREE.Vector3(x, y + 0.05 * s, z),
    new THREE.Vector3(x, y + 0.34 * s, z),
    new THREE.Vector3(x, y + 0.4 * s, z + 0.08 * s),
    new THREE.Vector3(x, y + 0.34 * s, z + 0.2 * s),
  ])
  mesh(parent, new THREE.TubeGeometry(c, 24, 0.012 * s, 10), M.chrome)
}

export function kitchenIsland(M, len = 3.4, depth = 1.2, top = M.marble) {
  const g = group()
  rb(g, len - 0.14, 0.86, depth - 0.16, M.joinery, 0, 0.06, -0.05, 0.006)
  rb(g, len, 0.05, depth, top, 0, 0.9, 0, 0.006) // worktop
  rb(g, 0.05, 0.9, depth, top, -len / 2 + 0.025, 0, 0, 0.004) // waterfall ends
  rb(g, 0.05, 0.9, depth, top, len / 2 - 0.025, 0, 0, 0.004)
  // induction hob
  rb(g, 0.78, 0.008, 0.52, M.blackGlass, len * 0.18, 0.95, -0.12, 0.004, { cast: false })
  for (const [hx, hz, r] of [[-0.2, -0.1, 0.1], [0.2, -0.1, 0.08], [-0.2, 0.12, 0.08], [0.2, 0.12, 0.1]])
    mesh(g, new THREE.TorusGeometry(r, 0.003, 4, 40), M.steel, len * 0.18 + hx, 0.96, -0.12 + hz, { rx: -Math.PI / 2, cast: false })
  return g
}

export function barStool(M, fabric = M.leather) {
  const g = group()
  cyl(g, 0.2, 0.2, 0.07, fabric, 0, 0.68, 0, 32)
  cyl(g, 0.02, 0.025, 0.66, M.brass, 0, 0.02, 0, 12)
  cyl(g, 0.17, 0.19, 0.02, M.brass, 0, 0, 0, 32)
  mesh(g, new THREE.TorusGeometry(0.15, 0.008, 6, 32), M.brass, 0, 0.28, 0, { rx: Math.PI / 2 })
  return g
}

export function pendantGlobes(M, n = 3, spacing = 0.9, drop = 1.15, ceiling = 3.3) {
  const g = group()
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * spacing
    cyl(g, 0.003, 0.003, drop, M.brass, x, ceiling - drop, 0, 4, { cast: false })
    lathe(g, [V(0, -0.2), V(0.12, -0.17), V(0.17, -0.08), V(0.15, 0), V(0.04, 0.02), V(0, 0.02)], M.lampShade, x, ceiling - drop, 0, 40, { cast: false })
  }
  return g
}

/* ------------------------------- bedroom ------------------------------- */
export function bed(M, { w = 2.0, l = 2.2, fabric = M.bed } = {}) {
  const g = group()
  rb(g, w + 0.1, 0.3, l + 0.05, fabric, 0, 0.06, 0, 0.05) // upholstered base
  rb(g, w - 0.2, 0.06, l - 0.2, M.stoneDark, 0, 0, 0, 0.01, { cast: false })
  rb(g, w - 0.04, 0.24, l - 0.06, M.linen, 0, 0.36, 0.02, 0.06) // mattress
  rb(g, w + 0.06, 0.1, l * 0.62, M.duvet, 0, 0.56, l * 0.18, 0.05) // duvet
  rb(g, w + 0.08, 0.11, 0.42, M.accent, 0, 0.57, l * 0.32, 0.05) // throw band
  for (const x of [-w / 4, w / 4]) {
    const p = rb(g, w / 2 - 0.12, 0.2, 0.42, M.linen, x, 0.6, -l / 2 + 0.36, 0.08)
    p.rotation.x = -0.35
    const q = rb(g, w / 2 - 0.22, 0.18, 0.36, M.duvet, x, 0.62, -l / 2 + 0.58, 0.08)
    q.rotation.x = -0.25
  }
  // channel-tufted headboard
  const hbW = w + 0.9
  rb(g, hbW, 1.25, 0.08, fabric, 0, 0.06, -l / 2 - 0.06, 0.01)
  const n = 9
  for (let i = 0; i < n; i++) rb(g, hbW / n - 0.015, 1.15, 0.1, fabric, -hbW / 2 + (hbW / n) * (i + 0.5), 0.11, -l / 2 - 0.02, 0.05)
  return g
}

export function nightstand(M) {
  const g = group()
  rb(g, 0.56, 0.46, 0.42, M.joinery, 0, 0.12, 0, 0.012)
  rb(g, 0.004, 0.02, 0.005, M.stoneDark, 0, 0.36, 0.211, 0, { cast: false })
  cyl(g, 0.02, 0.02, 0.12, M.brass, 0, 0, 0, 10)
  // ceramic table lamp
  lathe(g, [V(0, 0), V(0.08, 0), V(0.11, 0.08), V(0.1, 0.2), V(0.04, 0.3), V(0.012, 0.32), V(0, 0.32)], M.ceramic, -0.08, 0.58, -0.04)
  lathe(g, [V(0.09, 0.22), V(0.16, 0)], M.lampShade, -0.08, 0.84, -0.04, 40, { cast: false })
  return g
}

export function wardrobe(M, len = 3.6, h = 2.7) {
  const g = group()
  rb(g, len, h, 0.62, M.joinery, 0, 0, 0, 0.006)
  const flutes = Math.round(len / 0.045)
  const geo = new THREE.CylinderGeometry(0.02, 0.02, h - 0.12, 8, 1, false, 0, Math.PI)
  const inst = new THREE.InstancedMesh(geo, M.joinery, flutes)
  const o = new THREE.Object3D()
  for (let i = 0; i < flutes; i++) {
    o.position.set(-len / 2 + 0.0225 + i * 0.045, h / 2, 0.31)
    o.rotation.set(0, -Math.PI / 2, 0)
    o.updateMatrix()
    inst.setMatrixAt(i, o.matrix)
  }
  inst.castShadow = inst.receiveShadow = true
  g.add(inst)
  const doors = Math.max(2, Math.round(len / 0.9))
  for (let i = 1; i < doors; i++) rb(g, 0.006, h - 0.06, 0.04, M.stoneDark, -len / 2 + (len / doors) * i, 0.03, 0.32, 0, { cast: false })
  for (let i = 0; i < doors; i++) rb(g, 0.018, 0.5, 0.03, M.brass, -len / 2 + (len / doors) * (i + 0.5) + 0.18, 1.0, 0.36, 0.005)
  return g
}

export function bench(M, len = 1.6, fabric = M.accent) {
  const g = group()
  rb(g, len, 0.1, 0.46, fabric, 0, 0.36, 0, 0.04)
  for (const x of [-len / 2 + 0.08, len / 2 - 0.08]) rb(g, 0.04, 0.36, 0.42, M.brass, x, 0, 0, 0.01)
  return g
}

/* ------------------------------- bathroom ------------------------------- */
export function bathtub(M) {
  const g = group()
  const tub = lathe(
    g,
    [V(0, 0.02), V(0.52, 0.02), V(0.6, 0.12), V(0.64, 0.4), V(0.66, 0.56), V(0.62, 0.58), V(0.58, 0.5), V(0.52, 0.14), V(0, 0.12)],
    M.ceramic,
    0,
    0,
    0,
    64
  )
  tub.scale.set(1.45, 1, 0.78)
  // water surface
  mesh(g, new THREE.CircleGeometry(0.56, 48), M.glass, 0, 0.46, 0, { rx: -Math.PI / 2, cast: false })
  g.children[g.children.length - 1].scale.set(1.45, 0.78, 1)
  // floor-standing mixer
  const c = new THREE.CatmullRomCurve3([new THREE.Vector3(1.05, 0, 0), new THREE.Vector3(1.05, 0.85, 0), new THREE.Vector3(1.0, 0.95, 0), new THREE.Vector3(0.86, 0.9, 0)])
  mesh(g, new THREE.TubeGeometry(c, 24, 0.018, 10), M.chrome)
  return g
}

export function vanity(M, len = 2.4) {
  const g = group()
  rb(g, len, 0.42, 0.55, M.joinery, 0, 0.42, 0, 0.01)
  rb(g, len + 0.02, 0.05, 0.58, M.marble, 0, 0.84, 0.01, 0.006)
  for (const x of [-len / 4, len / 4]) {
    lathe(g, [V(0, 0), V(0.18, 0.01), V(0.22, 0.12), V(0.2, 0.13), V(0.16, 0.03), V(0, 0.02)], M.ceramic, x, 0.89, 0.04, 48)
    faucet(g, M, x, 0.89, -0.2, 0.8)
  }
  rb(g, len, 0.02, 0.04, M.cove, 0, 0.4, 0.22, 0, { cast: false }) // under-vanity glow
  // mirror with brass frame + wall lights
  rb(g, len + 0.06, 1.06, 0.03, M.brass, 0, 1.12, -0.28, 0.006)
  rb(g, len, 1.0, 0.02, M.mirror, 0, 1.15, -0.26, 0.002, { cast: false })
  return g
}

export function walkInShower(M, w = 2.0, d = 2.2, h = 2.4) {
  const g = group()
  rb(g, w, 0.04, d, M.bathFloor, 0, 0, 0, 0.004, { cast: false })
  rb(g, 0.012, h, d * 0.62, M.showerGlass, -w / 2, 0.04, -d * 0.19, 0, { cast: false }) // frameless glass panel
  rb(g, 0.03, 0.03, d * 0.62, M.chrome, -w / 2, h + 0.02, -d * 0.19, 0.01)
  rb(g, 0.04, 0.04, 0.6, M.chrome, -w / 2, h + 0.02, -d / 2 + 0.3, 0.01) // ceiling bracket
  cyl(g, 0.012, 0.012, 0.45, M.chrome, 0, h - 0.4, -d / 2 + 0.3, 12)
  cyl(g, 0.16, 0.16, 0.015, M.chrome, 0, h - 0.42, -d / 2 + 0.3, 40) // rain head
  rb(g, 0.12, 0.2, 0.03, M.chrome, w / 2 - 0.4, 1.0, -d / 2 + 0.03, 0.01)
  rb(g, 0.9, 0.02, 0.06, M.brass, 0, 0.02, d / 2 - 0.15, 0.004, { cast: false }) // linear drain
  return g
}

export function wc(M) {
  const g = group()
  const bowl = lathe(g, [V(0, 0.38), V(0.17, 0.4), V(0.2, 0.32), V(0.15, 0.06), V(0.1, 0.02), V(0, 0.02)], M.ceramic, 0, 0, 0.12, 40)
  bowl.scale.set(1, 1, 1.35)
  bowl.position.y = 0.0
  rb(g, 0.36, 0.06, 0.48, M.ceramic, 0, 0.4, 0.12, 0.03)
  rb(g, 0.5, 1.1, 0.16, M.marbleWall, 0, 0, -0.18, 0.006)
  rb(g, 0.2, 0.12, 0.012, M.chrome, 0, 0.9, -0.095, 0.004)
  return g
}

export function towelRail(M) {
  const g = group()
  for (const y of [0.9, 1.15, 1.4]) rb(g, 0.6, 0.02, 0.02, M.brass, 0, y, 0, 0.01)
  rb(g, 0.5, 0.5, 0.05, M.towel, 0, 0.92, 0.03, 0.03)
  return g
}

/* ------------------------------- outdoor ------------------------------- */
export function outdoorSofa(M, len = 2.6) {
  const g = group()
  rb(g, len, 0.3, 0.95, M.deck, 0, 0.06, 0, 0.02)
  rb(g, len - 0.2, 0.16, 0.75, M.linen, 0, 0.36, 0.08, 0.07)
  rb(g, len, 0.4, 0.14, M.deck, 0, 0.36, -0.4, 0.02)
  rb(g, len - 0.2, 0.42, 0.16, M.linen, 0, 0.5, -0.28, 0.08)
  for (const x of [-len / 2 + 0.07, len / 2 - 0.07]) rb(g, 0.14, 0.62, 0.95, M.deck, x, 0.06, 0, 0.02)
  return g
}

export function lounger(M) {
  const g = group()
  rb(g, 0.7, 0.28, 2.0, M.deck, 0, 0.04, 0, 0.02)
  rb(g, 0.62, 0.08, 1.35, M.linen, 0, 0.32, 0.3, 0.04)
  const back = rb(g, 0.62, 0.08, 0.7, M.linen, 0, 0.42, -0.6, 0.04)
  back.rotation.x = -0.5
  return g
}

export function planterOlive(M, s = 1, seed = 4) {
  const g = group()
  rb(g, 0.9 * s, 0.8 * s, 0.9 * s, M.stone, 0, 0, 0, 0.04)
  rb(g, 0.82 * s, 0.02, 0.82 * s, M.soil, 0, 0.8 * s, 0, 0.004, { cast: false })
  const rnd = mulberry32(seed)
  const pts = [new THREE.Vector3(0, 0.8 * s, 0), new THREE.Vector3(0.08, 1.4 * s, 0.05), new THREE.Vector3(-0.05, 2.0 * s, 0), new THREE.Vector3(0.04, 2.3 * s, -0.04)]
  mesh(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.05 * s, 7), M.joinery)
  const leafGeo = new THREE.SphereGeometry(1, 5, 3)
  leafGeo.scale(0.03 * s, 0.09 * s, 0.01 * s)
  const n = 150
  const leaves = new THREE.InstancedMesh(leafGeo, M.leaf, n)
  const o = new THREE.Object3D()
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2
    const r = Math.pow(rnd(), 0.6) * 0.75 * s
    o.position.set(Math.cos(a) * r, 2.1 * s + (rnd() - 0.4) * 0.7 * s, Math.sin(a) * r)
    o.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3)
    o.updateMatrix()
    leaves.setMatrixAt(i, o.matrix)
  }
  leaves.castShadow = true
  g.add(leaves)
  return g
}

/* ----------------------------- architecture ----------------------------- */
/** Door leaf (closed or ajar) in a slim frame, with lever handle. Centred on the opening. */
export function door(M, w = 1.0, h = 2.4, ajar = 0) {
  const g = group()
  rb(g, 0.05, h + 0.05, 0.16, M.joinery, -w / 2 - 0.025, 0, 0, 0.004)
  rb(g, 0.05, h + 0.05, 0.16, M.joinery, w / 2 + 0.025, 0, 0, 0.004)
  rb(g, w + 0.1, 0.05, 0.16, M.joinery, 0, h, 0, 0.004)
  const pivot = new THREE.Group()
  pivot.position.set(-w / 2, 0, 0)
  pivot.rotation.y = -ajar
  g.add(pivot)
  rb(pivot, w - 0.01, h - 0.01, 0.045, M.doorPanel, w / 2, 0, 0, 0.006)
  rb(pivot, 0.14, 0.02, 0.02, M.brass, w - 0.12, 1.05, 0.04, 0.008)
  rb(pivot, 0.14, 0.02, 0.02, M.brass, w - 0.12, 1.05, -0.04, 0.008)
  return g
}

export function sconce(M) {
  const g = group()
  rb(g, 0.08, 0.26, 0.04, M.brass, 0, 0, 0, 0.01, { cast: false })
  lathe(g, [V(0, 0), V(0.07, 0), V(0.08, 0.14), V(0, 0.14)], M.lampShade, 0, 0.06, 0.09, 32, { cast: false })
  return g
}

export function sheer(M, w = 1.6, h = 3.2) {
  const g = group()
  const geo = new THREE.PlaneGeometry(w, h, 32, 1)
  const p = geo.attributes.position
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 16) * 0.05)
  geo.computeVertexNormals()
  const mat = M.linen.clone()
  mat.transparent = true
  mat.opacity = 0.78
  mat.side = THREE.DoubleSide
  mat.userData.disposable = true
  mesh(g, geo, mat, 0, h / 2, 0, { cast: false })
  return g
}
