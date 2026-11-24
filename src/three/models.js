import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { materials, facadeMaterial, canvasTexture } from './materials.js'
import { mulberry32 } from '../lib/random.js'

/* All builders here are plain three.js (1 unit = 1 metre) so the same models  */
/* power the interactive showcase *and* the offscreen "photography" renders.   */

const geoCache = new Map()
function rbox(w, h, d, r = 0) {
  const key = `${w}|${h}|${d}|${r}`
  if (!geoCache.has(key)) {
    geoCache.set(key, r > 0 ? new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2)) : new THREE.BoxGeometry(w, h, d))
  }
  return geoCache.get(key)
}

/** Adds a box whose *base* sits at y. */
function block(parent, w, h, d, mat, x, y, z, r = 0, { ry = 0, cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(rbox(w, h, d, r), mat)
  m.position.set(x, y + h / 2, z)
  m.rotation.y = ry
  m.castShadow = cast
  m.receiveShadow = receive
  parent.add(m)
  return m
}

/* -------------------------------------------------------------------------- */
/*  Palm tree — tube trunk + alpha-tested leaflet fronds                       */
/* -------------------------------------------------------------------------- */
let frondMat = null
export function getFrondMaterial() {
  if (frondMat) return frondMat
  const tex = canvasTexture(
    256,
    128,
    (g, w, h) => {
      g.clearRect(0, 0, w, h)
      g.strokeStyle = '#4a5d36'
      g.lineCap = 'round'
      g.lineWidth = 3
      g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke()
      for (let x = 6; x < w - 4; x += 5) {
        const t = x / w
        const len = Math.sin(Math.PI * Math.min(1, t * 1.1)) * (h / 2 - 4)
        const shade = 60 + Math.random() * 40
        g.strokeStyle = `rgb(${shade},${shade + 30},${shade - 20})`
        g.lineWidth = 2.2
        for (const s of [-1, 1]) {
          g.beginPath()
          g.moveTo(x, h / 2)
          g.quadraticCurveTo(x + 8, h / 2 + s * len * 0.5, x + 14, h / 2 + s * len)
          g.stroke()
        }
      }
    },
    { repeat: [1, 1] }
  )
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  frondMat = new THREE.MeshStandardMaterial({
    map: tex,
    alphaTest: 0.45,
    side: THREE.DoubleSide,
    roughness: 0.75,
    color: '#ffffff',
  })
  return frondMat
}

let frondGeo = null
export function getFrondGeometry() {
  if (frondGeo) return frondGeo
  const L = 3.4
  const geo = new THREE.PlaneGeometry(L, 1.4, 14, 4)
  geo.translate(L / 2, 0, 0)
  geo.rotateX(-Math.PI / 2)
  const p = geo.attributes.position
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const z = p.getZ(i)
    const t = x / L
    p.setY(i, Math.sin(t * Math.PI * 0.55) * 0.9 - t * t * 2.2 - Math.abs(z) * 0.35)
  }
  geo.computeVertexNormals()
  frondGeo = geo
  return geo
}

export function buildPalm({ height = 8, seed = 1, lean = 0.6 } = {}) {
  const rnd = mulberry32(seed * 97 + 13)
  const M = materials()
  const g = new THREE.Group()
  const dir = rnd() * Math.PI * 2
  const pts = []
  for (let i = 0; i <= 5; i++) {
    const t = i / 5
    const off = Math.sin(t * 1.4) * lean * (0.6 + rnd() * 0.6)
    pts.push(new THREE.Vector3(Math.cos(dir) * off, t * height, Math.sin(dir) * off))
  }
  const curve = new THREE.CatmullRomCurve3(pts)
  const trunk = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.19, 8, false), M.trunk)
  trunk.castShadow = true
  g.add(trunk)
  const top = pts[pts.length - 1]
  const crown = new THREE.Group()
  crown.position.copy(top)
  const n = 12
  for (let i = 0; i < n; i++) {
    const f = new THREE.Mesh(getFrondGeometry(), getFrondMaterial())
    f.rotation.y = (i / n) * Math.PI * 2 + rnd() * 0.3
    f.rotation.z = (rnd() - 0.4) * 0.5
    const s = 0.85 + rnd() * 0.35
    f.scale.set(s, s, s)
    f.castShadow = true
    crown.add(f)
  }
  const nut = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), M.trunk)
  crown.add(nut)
  g.add(crown)
  return g
}

/* -------------------------------------------------------------------------- */
/*  Signature tower — stacked balcony slabs, inspired by Dubai waterfront      */
/*  sky-residences. Returns setFloor() to highlight a residence level.         */
/* -------------------------------------------------------------------------- */
export function buildTower({
  floors = 32,
  w = 16,
  d = 11,
  floorH = 3.4,
  over = 1.9,
  night = 0,
  landscape = true,
} = {}) {
  const M = materials()
  const g = new THREE.Group()
  const lobbyH = floorH * 2.2
  const plinthH = 0.6
  const baseY = plinthH + lobbyH
  const H = floors * floorH
  const SW = w + over * 2
  const SD = d + over * 2

  if (landscape) {
    block(g, SW + 14, plinthH, SD + 14, M.stoneFloor, 0, 0, 0, 0.1, { cast: false })
    // planters + palms around the base
    for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      const px = x * (SW / 2 + 4.5)
      const pz = z * (SD / 2 + 4.5)
      block(g, 3.2, 0.7, 3.2, M.travertine, px, plinthH, pz, 0.15)
      block(g, 2.8, 0.2, 2.8, M.hedge, px, plinthH + 0.6, pz, 0.1)
      const palm = buildPalm({ height: 7 + (x + z + 3) * 0.6, seed: x * 3 + z * 7 + 20 })
      palm.position.set(px, plinthH + 0.7, pz)
      g.add(palm)
    }
  }

  // double-height lobby
  block(g, w - 1.2, lobbyH, d - 1.2, M.tintedGlass, 0, plinthH, 0)
  block(g, SW + 1.2, 0.45, SD + 1.2, M.plaster, 0, baseY - 0.45, 0, 0.15)

  // glazed core
  const core = facadeMaterial({
    color: '#efe9df',
    cell: [1.6, floorH],
    winFill: [0.04, 0.96, 0.0, 0.9],
    glassTint: [0.26, 0.31, 0.34],
    night,
    roughness: 0.5,
  })
  const coreMesh = block(g, w, H, d, core, 0, baseY, 0)
  coreMesh.castShadow = true

  // floor slabs (instanced)
  const slabGeo = new RoundedBoxGeometry(SW, 0.34, SD, 2, 0.14)
  const slabs = new THREE.InstancedMesh(slabGeo, M.plaster, floors + 1)
  const glassF = new THREE.InstancedMesh(new THREE.BoxGeometry(SW - 0.3, 1.05, 0.03), M.glass, floors * 2)
  const glassS = new THREE.InstancedMesh(new THREE.BoxGeometry(0.03, 1.05, SD - 0.3), M.glass, floors * 2)
  const dummy = new THREE.Object3D()
  for (let i = 0; i <= floors; i++) {
    const y = baseY + i * floorH
    const ext = i % 2 === 1 && i < floors ? 0.9 : 0
    dummy.position.set(0, y, ext / 2)
    dummy.scale.set(1, 1, (SD + ext) / SD)
    dummy.updateMatrix()
    slabs.setMatrixAt(i, dummy.matrix)
    if (i < floors) {
      const by = y + 0.17 + 0.525
      dummy.scale.set(1, 1, 1)
      dummy.position.set(0, by, SD / 2 - 0.15 + ext)
      dummy.updateMatrix()
      glassF.setMatrixAt(i * 2, dummy.matrix)
      dummy.position.z = -SD / 2 + 0.15
      dummy.updateMatrix()
      glassF.setMatrixAt(i * 2 + 1, dummy.matrix)
      dummy.position.set(SW / 2 - 0.15, by, ext / 2)
      dummy.scale.set(1, 1, (SD + ext) / SD)
      dummy.updateMatrix()
      glassS.setMatrixAt(i * 2, dummy.matrix)
      dummy.position.x = -SW / 2 + 0.15
      dummy.updateMatrix()
      glassS.setMatrixAt(i * 2 + 1, dummy.matrix)
    }
  }
  slabs.castShadow = slabs.receiveShadow = true
  g.add(slabs, glassF, glassS)

  // bronze corner fins
  for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    block(g, 0.28, H + 0.4, 0.28, M.bronze, x * (w / 2 + 0.15), baseY, z * (d / 2 + 0.15))
  }

  // crown halo
  const top = baseY + H + 0.34
  const ch = floorH * 1.6
  block(g, SW, 0.3, 0.3, M.bronze, 0, top + ch, SD / 2 - 0.15)
  block(g, SW, 0.3, 0.3, M.bronze, 0, top + ch, -SD / 2 + 0.15)
  block(g, 0.3, 0.3, SD, M.bronze, SW / 2 - 0.15, top + ch, 0)
  block(g, 0.3, 0.3, SD, M.bronze, -SW / 2 + 0.15, top + ch, 0)
  for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    block(g, 0.3, ch, 0.3, M.bronze, x * (SW / 2 - 0.15), top, z * (SD / 2 - 0.15))
  }
  block(g, w * 0.55, floorH * 0.9, d * 0.5, M.plaster, 0, top, -d * 0.1, 0.2)
  // rooftop pool
  block(g, w * 0.7, 0.12, 2.6, M.water, 0, top, d * 0.35)

  // residence highlight band
  const band = new THREE.Mesh(new THREE.BoxGeometry(SW + 0.5, floorH - 0.5, SD + 1.5), M.champagne)
  band.visible = false
  band.renderOrder = 2
  g.add(band)

  const floorY = (n) => baseY + (n - 1) * floorH + floorH / 2 + 0.17
  return {
    group: g,
    floors,
    floorY,
    band,
    core,
    height: top + ch,
  }
}

/* -------------------------------------------------------------------------- */
/*  Contemporary beachfront villa                                              */
/* -------------------------------------------------------------------------- */
export function buildVilla() {
  const M = materials()
  const g = new THREE.Group()

  // plot
  block(g, 40, 0.3, 30, M.grass, 0, -0.3, 0, 0, { cast: false })
  block(g, 40, 0.3, 6, M.sand, 0, -0.32, 18, 0, { cast: false }) // beach edge
  // terrace paving
  block(g, 26, 0.25, 12, M.stoneFloor, 0, 0, 3.5, 0, { cast: false })
  // pool + coping
  block(g, 13.4, 0.32, 5.4, M.travertine, 3.5, 0, 10.6, 0.05)
  block(g, 12.6, 0.1, 4.6, M.water, 3.5, 0.24, 10.6)
  // pool deck + loungers
  block(g, 6, 0.18, 5.4, M.teakDeck, -6.8, 0, 10.6, 0.03)
  for (const x of [-8.3, -5.6]) {
    block(g, 0.8, 0.32, 2.1, M.teak, x, 0.18, 10.9, 0.05)
    block(g, 0.72, 0.12, 1.5, M.linen, x, 0.5, 11.2, 0.05)
    const back = block(g, 0.72, 0.1, 0.8, M.linen, x, 0.7, 9.95, 0.04)
    back.rotation.x = -0.6
  }
  block(g, 1.6, 0.06, 1.6, M.linen, -7, 1.0, 12.8, 0.02) // parasol canopy hint
  block(g, 0.08, 2.4, 0.08, M.bronze, -7, 0.18, 12.8)

  // ground floor — glass pavilion + travertine wing
  const gfY = 0.25
  block(g, 15, 3.4, 8.5, M.tintedGlass, 1, gfY, -1)
  for (let i = 0; i <= 6; i++) block(g, 0.12, 3.4, 0.12, M.bronze, -6.5 + i * 2.5, gfY, 3.27)
  block(g, 7, 3.4, 9.5, M.travertine, -10, gfY, -1.5, 0.05)
  block(g, 1.6, 2.6, 0.1, M.walnut, -10, gfY, 3.3) // entry door
  // first floor terrace slab
  block(g, 24, 0.4, 11.5, M.plaster, -2, gfY + 3.4, -1.2, 0.1)
  // upper floor — cantilevered white volume
  const ufY = gfY + 3.8
  block(g, 17, 3.3, 8.5, M.plaster, -3.5, ufY, -3)
  block(g, 13.5, 1.9, 0.12, M.tintedGlass, -3.5, ufY + 0.8, 1.3)
  block(g, 0.15, 3.3, 7.6, M.tintedGlass, 5.05, ufY, -3)
  // glass balustrade on terrace
  block(g, 23.6, 1.05, 0.04, M.glass, -2, ufY, 4.5, 0, { cast: false })
  // roof
  block(g, 19.5, 0.35, 11, M.plaster, -3.5, ufY + 3.3, -2.6, 0.1)
  // pergola over side terrace
  for (let i = 0; i < 12; i++) block(g, 0.14, 0.32, 7, M.teak, 9.8 + i * 0.55, gfY + 3.1, 2.3)
  block(g, 0.2, 3.1, 0.2, M.bronze, 9.8, gfY, 5.6)
  block(g, 0.2, 3.1, 0.2, M.bronze, 15.9, gfY, 5.6)
  block(g, 0.2, 3.1, 0.2, M.bronze, 15.9, gfY, -1)
  // outdoor dining
  block(g, 2.6, 0.08, 1.1, M.walnut, 12.8, gfY + 0.72, 2.2)
  block(g, 0.12, 0.72, 0.6, M.darkMetal, 11.8, gfY, 2.2)
  block(g, 0.12, 0.72, 0.6, M.darkMetal, 13.8, gfY, 2.2)
  // boundary + hedges
  block(g, 40, 1.4, 0.5, M.travertine, 0, 0, -14.75, 0.05)
  block(g, 0.5, 1.4, 29.5, M.travertine, -19.75, 0, 0, 0.05)
  block(g, 0.5, 1.4, 29.5, M.travertine, 19.75, 0, 0, 0.05)
  block(g, 38, 1.6, 1.2, M.hedge, 0, 0, -13.6, 0.5)
  // driveway
  block(g, 6, 0.06, 6, M.stoneFloor, -13, 0, -8, 0, { cast: false })
  // palms
  ;[[-16, 12, 9], [-14, 14.5, 10.5], [16, 11, 8.5], [17.5, -10, 9.5], [-17, -9, 8]].forEach(([x, z, h], i) => {
    const p = buildPalm({ height: h, seed: i + 3 })
    p.position.set(x, 0, z)
    g.add(p)
  })
  return { group: g }
}

/* -------------------------------------------------------------------------- */
/*  Penthouse "dollhouse" — a roofless cut-away floor plan                     */
/* -------------------------------------------------------------------------- */
export function buildPenthouse() {
  const M = materials()
  const g = new THREE.Group()
  const WH = 2.9 // wall height
  const T = 0.18

  // structure slab
  block(g, 23, 0.5, 19, M.plaster, 0, -0.5, 2, 0.1, { cast: false })
  // floors
  block(g, 22, 0.06, 14, M.oakFloor, 0, 0, 0, 0, { cast: false })
  block(g, 5, 0.07, 6, M.stoneFloor, -0.5, 0, -4, 0, { cast: false })
  block(g, 22, 0.06, 4.2, M.teakDeck, 0, 0, 9.1, 0, { cast: false })

  // exterior walls (back + left)
  block(g, 22, WH, T, M.plaster, 0, 0, -7)
  block(g, T, WH, 14, M.plaster, -11, 0, 0)
  // right side — full height glass
  block(g, 0.05, WH, 14, M.glass, 11, 0, 0, 0, { cast: false })
  // front facade — sliding glass with bronze mullions
  block(g, 22, WH, 0.05, M.glass, 0, 0, 7, 0, { cast: false })
  for (let x = -11; x <= 11.01; x += 2.75) block(g, 0.08, WH, 0.1, M.bronze, x, 0, 7)
  block(g, 22, 0.1, 0.12, M.bronze, 0, WH - 0.1, 7)

  // interior partitions (z = -1 row with door gaps; x = -3 and x = 2)
  const pz = -1
  block(g, 6.5, WH, T, M.plaster, -7.75, 0, pz) // -11 .. -4.5
  block(g, 3.5, WH, T, M.plaster, -1.75, 0, pz) // -3.5 .. 0
  block(g, 1.5, WH, T, M.plaster, 1.25, 0, pz) // 0.5 .. 2 (gap 0..0.5 + door)
  block(g, 7.5, WH, T, M.plaster, 7.25, 0, pz) // 3.5 .. 11
  block(g, T, WH, 6, M.plaster, -3, 0, -4)
  block(g, T, WH, 6, M.plaster, 2, 0, -4)

  // — Living —
  block(g, 6.2, 0.02, 4.2, M.rug, -6.5, 0.06, 3.2, 0, { cast: false })
  block(g, 4.2, 0.45, 1.0, M.fabricSand, -6.5, 0.06, 1.4, 0.18) // sofa seat
  block(g, 4.2, 0.45, 0.25, M.fabricSand, -6.5, 0.5, 1.0, 0.12) // back
  block(g, 1.0, 0.45, 2.6, M.fabricSand, -9.1, 0.06, 2.2, 0.18) // chaise
  block(g, 0.25, 0.42, 2.6, M.fabricSand, -9.65, 0.5, 2.2, 0.12)
  for (const x of [-7.8, -6.5, -5.2]) block(g, 0.9, 0.28, 0.18, M.fabricSage, x, 0.55, 1.2, 0.08)
  block(g, 1.6, 0.36, 1.0, M.marble, -6.3, 0.06, 3.4, 0.08) // coffee table
  block(g, 0.9, 0.7, 0.9, M.fabricCharcoal, -4.2, 0.06, 4.6, 0.25) // armchair
  block(g, 0.9, 0.35, 0.22, M.fabricCharcoal, -4.2, 0.7, 5.0, 0.1)
  block(g, 3.6, 0.5, 0.45, M.walnut, -6.5, 0.06, 6.4, 0.04) // low credenza by glass
  block(g, 0.4, 1.4, 0.4, M.bronze, -10.3, 0.06, 6.2, 0.05) // floor lamp
  // plant
  block(g, 0.6, 0.6, 0.6, M.travertine, -10.3, 0.06, -0.3, 0.12)
  const plant = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 1), M.hedge)
  plant.position.set(-10.3, 1.2, -0.3)
  plant.castShadow = true
  g.add(plant)

  // — Kitchen —
  block(g, 7.2, 0.92, 0.65, M.walnut, 7.4, 0, -0.6, 0.02)
  block(g, 7.2, 0.04, 0.68, M.marble, 7.4, 0.92, -0.6)
  block(g, 3.2, 0.92, 1.1, M.walnut, 7.6, 0, 1.6, 0.03) // island
  block(g, 3.4, 0.05, 1.2, M.marble, 7.6, 0.92, 1.6, 0.02)
  for (const x of [6.6, 7.6, 8.6]) block(g, 0.42, 0.75, 0.42, M.darkMetal, x, 0, 2.5, 0.1)

  // — Dining —
  block(g, 2.8, 0.06, 1.1, M.oak, 7.2, 0.74, 4.8, 0.02)
  block(g, 0.12, 0.74, 0.8, M.darkMetal, 6.0, 0, 4.8)
  block(g, 0.12, 0.74, 0.8, M.darkMetal, 8.4, 0, 4.8)
  for (const x of [6.2, 7.2, 8.2])
    for (const s of [-1, 1]) {
      block(g, 0.5, 0.46, 0.5, M.fabricSage, x, 0, 4.8 + s * 0.85, 0.08)
      block(g, 0.5, 0.45, 0.08, M.fabricSage, x, 0.46, 4.8 + s * 1.07, 0.04)
    }
  // pendant
  block(g, 1.8, 0.05, 0.15, M.bronze, 7.2, 2.0, 4.8)

  // — Master bedroom —
  block(g, 4.4, 0.02, 3.4, M.rug, -7, 0.06, -4.3, 0, { cast: false })
  block(g, 2.1, 0.45, 2.2, M.oak, -7, 0.06, -5.6, 0.06)
  block(g, 2.0, 0.22, 2.1, M.linen, -7, 0.5, -5.6, 0.1)
  block(g, 2.3, 1.1, 0.14, M.fabricSand, -7, 0.06, -6.85, 0.06) // headboard
  block(g, 0.65, 0.18, 0.4, M.linen, -7.5, 0.72, -6.4, 0.08)
  block(g, 0.65, 0.18, 0.4, M.linen, -6.5, 0.72, -6.4, 0.08)
  block(g, 2.0, 0.08, 0.7, M.fabricSage, -7, 0.72, -4.9, 0.03) // throw
  for (const x of [-8.5, -5.5]) block(g, 0.55, 0.5, 0.45, M.walnut, x, 0.06, -6.5, 0.04)
  block(g, 0.18, 2.3, 4.5, M.walnut, -10.8, 0.06, -3.9, 0.02) // wardrobe

  // — Bathroom —
  block(g, 1.8, 0.58, 0.85, M.marble, -0.6, 0.07, -5.9, 0.35) // tub
  block(g, 1.6, 0.08, 0.65, M.water, -0.6, 0.6, -5.9, 0.05)
  block(g, 1.8, 0.85, 0.55, M.walnut, 1.3, 0.07, -3.6, 0.02, { ry: Math.PI / 2 })
  block(g, 0.05, 1.0, 1.5, M.glass, -2.9, 1.0, -3.6, 0, { cast: false })

  // — Bedroom 2 —
  block(g, 1.7, 0.42, 2.1, M.oak, 6.5, 0.06, -5.7, 0.06)
  block(g, 1.6, 0.2, 2.0, M.linen, 6.5, 0.46, -5.7, 0.1)
  block(g, 1.9, 1.0, 0.12, M.fabricSage, 6.5, 0.06, -6.85, 0.05)
  block(g, 1.6, 0.75, 0.6, M.oak, 9.8, 0.06, -2.0, 0.03) // desk
  block(g, 0.5, 0.8, 0.5, M.fabricCharcoal, 9.8, 0.06, -2.7, 0.1)

  // — Terrace —
  block(g, 8.6, 0.1, 2.6, M.water, 6.3, 0.06, 9.2, 0.04)
  block(g, 9.0, 0.12, 0.2, M.travertine, 6.3, 0.06, 7.8)
  block(g, 9.0, 0.12, 0.2, M.travertine, 6.3, 0.06, 10.6)
  for (const x of [-3.2, -1.6]) {
    block(g, 0.75, 0.3, 2.0, M.teak, x, 0.06, 9.2, 0.05)
    block(g, 0.68, 0.1, 1.4, M.linen, x, 0.36, 9.5, 0.04)
  }
  block(g, 1.0, 0.42, 1.0, M.travertine, -6.5, 0.06, 9.2, 0.3)
  for (const x of [-8.2, -4.8]) block(g, 0.8, 0.42, 0.8, M.fabricSand, x, 0.06, 9.2, 0.25)
  // balustrade
  block(g, 22, 1.1, 0.04, M.glass, 0, 0.06, 11.15, 0, { cast: false })
  block(g, 0.04, 1.1, 4.2, M.glass, 11, 0.06, 9.1, 0, { cast: false })
  block(g, 0.04, 1.1, 4.2, M.glass, -11, 0.06, 9.1, 0, { cast: false })
  // planters with palms
  for (const [x, z, s] of [[-10.2, 10.3, 31], [10.3, 7.8, 32]]) {
    block(g, 1.2, 0.8, 1.2, M.travertine, x, 0.06, z, 0.15)
    const p = buildPalm({ height: 3.4, seed: s, lean: 0.25 })
    p.scale.setScalar(0.6)
    p.position.set(x, 0.85, z)
    g.add(p)
  }
  return { group: g }
}

/* -------------------------------------------------------------------------- */
/*  Marina collection — three waterfront towers on a landscaped podium         */
/* -------------------------------------------------------------------------- */
export function buildMarina() {
  const M = materials()
  const g = new THREE.Group()
  block(g, 110, 0.5, 70, M.stoneFloor, 0, -0.5, 0, 0, { cast: false })
  block(g, 110, 0.3, 26, M.water, 0, -0.7, 47, 0, { cast: false })
  // promenade palms
  for (let i = 0; i < 9; i++) {
    const p = buildPalm({ height: 8 + (i % 3), seed: 40 + i })
    p.position.set(-48 + i * 12, 0, 31)
    g.add(p)
  }
  // podium lawn
  block(g, 70, 0.3, 26, M.grass, 0, 0, -6, 0, { cast: false })
  const towers = [
    { x: -26, z: -6, floors: 26, w: 13, d: 10 },
    { x: 3, z: -10, floors: 40, w: 15, d: 11 },
    { x: 31, z: -3, floors: 20, w: 12, d: 9 },
  ]
  towers.forEach((t) => {
    const tw = buildTower({ floors: t.floors, w: t.w, d: t.d, landscape: false })
    tw.group.position.set(t.x, 0, t.z)
    g.add(tw.group)
  })
  return { group: g }
}
