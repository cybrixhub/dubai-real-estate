import * as THREE from 'three'
import { facadeMaterial, canvasTexture } from './materials.js'
import { mulberry32 } from '../lib/random.js'

/*
 * "The Aurelle Gold" — a slender residential tower wrapped in brushed-gold vertical
 * fins, with a glowing duplex penthouse and a lantern crown.
 * Built in metres; `s` is the world scale it will be displayed at (facade shader
 * works in world units, so its window grid is scaled to match).
 */

export const TOWER = {
  w: 26,
  d: 18,
  r: 4.5,
  floors: 24,
  floorH: 3.4,
  podiumH: 9,
  penthouseFloors: 2,
}

export function roundedRectShape(w, d, r) {
  const s = new THREE.Shape()
  const x = -w / 2
  const y = -d / 2
  s.moveTo(x + r, y)
  s.lineTo(x + w - r, y)
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false)
  s.lineTo(x + w, y + d - r)
  s.absarc(x + w - r, y + d - r, r, 0, Math.PI / 2, false)
  s.lineTo(x + r, y + d)
  s.absarc(x + r, y + d - r, r, Math.PI / 2, Math.PI, false)
  s.lineTo(x, y + r)
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false)
  return s
}

function roundedRectPath(w, d, r) {
  // same outline, reversed winding — used as a hole
  const pts = roundedRectShape(w, d, r).getPoints(8).reverse()
  return new THREE.Path(pts)
}

/** Extruded rounded-rect prism standing on y = 0. */
function prism(w, d, r, h, curveSegments = 8) {
  const g = new THREE.ExtrudeGeometry(roundedRectShape(w, d, r), { depth: h, bevelEnabled: false, curveSegments })
  g.rotateX(-Math.PI / 2)
  return g
}

/** Thin rounded-rect ring (slab edges, crown halo). */
function ring(w, d, r, edge, h) {
  const shape = roundedRectShape(w + edge * 2, d + edge * 2, r + edge)
  shape.holes.push(roundedRectPath(w - 0.3, d - 0.3, Math.max(0.5, r - 0.15)))
  const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 8 })
  g.rotateX(-Math.PI / 2)
  return g
}

/** Painted "lit duplex interior" seen through the penthouse glass: two storeys of warm rooms. */
function penthouseInteriorTexture() {
  return canvasTexture(
    1024,
    512,
    (g, w, h) => {
      const rnd = mulberry32(12)
      for (let f = 0; f < 2; f++) {
        const y0 = f * (h / 2)
        const fh = h / 2
        // room depth: bright ceiling cove fading to a warm floor
        const grad = g.createLinearGradient(0, y0, 0, y0 + fh)
        grad.addColorStop(0, '#fff1d8')
        grad.addColorStop(0.12, '#f0cf9e')
        grad.addColorStop(0.55, '#b98e62')
        grad.addColorStop(1, '#6e5440')
        g.fillStyle = grad
        g.fillRect(0, y0, w, fh)
        // pendant / lamp glows
        for (let i = 0; i < 7; i++) {
          const x = rnd() * w
          const y = y0 + fh * (0.25 + rnd() * 0.3)
          const r = 20 + rnd() * 40
          const glow = g.createRadialGradient(x, y, 0, x, y, r)
          glow.addColorStop(0, 'rgba(255,236,200,0.95)')
          glow.addColorStop(1, 'rgba(255,200,140,0)')
          g.fillStyle = glow
          g.fillRect(x - r, y - r, r * 2, r * 2)
        }
        // furniture + plant silhouettes on the floor line
        for (let i = 0; i < 14; i++) {
          const x = rnd() * w
          const bw = 30 + rnd() * 90
          const bh = 12 + rnd() * 34
          g.fillStyle = `rgba(${40 + rnd() * 30},${30 + rnd() * 20},${24 + rnd() * 16},0.85)`
          g.beginPath()
          g.roundRect(x, y0 + fh * 0.86 - bh, bw, bh, 6)
          g.fill()
        }
        for (let i = 0; i < 4; i++) {
          const x = rnd() * w
          g.fillStyle = 'rgba(52,60,40,0.8)'
          g.beginPath()
          g.ellipse(x, y0 + fh * 0.62, 14 + rnd() * 10, 34 + rnd() * 16, 0, 0, Math.PI * 2)
          g.fill()
        }
        // structure: slab line + columns
        g.fillStyle = 'rgba(40,32,26,0.9)'
        g.fillRect(0, y0 + fh - 6, w, 6)
        for (let x = 0; x < w; x += 128) g.fillRect(x, y0, 6, fh)
      }
    },
    { repeat: [1, 1] }
  )
}

export function buildGoldTower({ s = 1, night = 0.45, shadows = true } = {}) {
  const { w, d, r, floors, floorH, podiumH, penthouseFloors } = TOWER
  const g = new THREE.Group()
  g.name = 'gold-tower'
  const shaftFloors = floors - penthouseFloors
  const shaftH = shaftFloors * floorH
  const phH = penthouseFloors * floorH
  const topY = podiumH + floors * floorH

  /* ----------------------------- materials ----------------------------- */
  const gold = new THREE.MeshStandardMaterial({ color: '#c7a676', metalness: 0.72, roughness: 0.3, envMapIntensity: 1.1 })
  const goldSatin = new THREE.MeshStandardMaterial({ color: '#9c7b4e', metalness: 0.95, roughness: 0.34 })
  const stone = new THREE.MeshStandardMaterial({ color: '#e7dac4', roughness: 0.72 })
  const paving = new THREE.MeshStandardMaterial({ color: '#ece4d5', roughness: 0.85 })
  const darkGlass = new THREE.MeshStandardMaterial({ color: '#4d5c61', metalness: 0.92, roughness: 0.07 })
  const glazing = facadeMaterial({
    color: '#c3ccd0',
    cell: [1.5 * s, floorH * s],
    winFill: [0.05, 0.95, 0.1, 0.93],
    glassTint: [0.3, 0.35, 0.39],
    night,
    roughness: 0.32,
    metalness: 0.45,
  })
  // penthouse: clear glass in front of a warm, lit duplex interior
  const phGlass = new THREE.MeshStandardMaterial({
    color: '#9fb2b6',
    metalness: 0.95,
    roughness: 0.04,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
  })
  const phTex = penthouseInteriorTexture()
  phTex.repeat.set(1 / 13, 1 / (penthouseFloors * floorH)) // side-wall UVs are in metres
  const phGlow = new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#ffffff', emissiveMap: phTex, emissiveIntensity: 0.95, roughness: 0.9 })
  const phDark = new THREE.MeshStandardMaterial({ color: '#3b3330', roughness: 0.9 })
  const pool = new THREE.MeshStandardMaterial({ color: '#79b9bd', emissive: '#2f777c', emissiveIntensity: 0.45, metalness: 0.3, roughness: 0.05 })

  const add = (geo, mat, y = 0, { cast = shadows, receive = shadows } = {}) => {
    const m = new THREE.Mesh(geo, mat)
    m.position.y = y
    m.castShadow = cast
    m.receiveShadow = receive
    g.add(m)
    return m
  }

  /* ------------------------------ plaza + podium ------------------------------ */
  add(prism(w + 46, d + 40, r + 14, 0.35), paving, 0, { cast: false })
  add(prism(w + 8, d + 8, r + 3, podiumH), stone)
  // recessed double-height lobby glazing on the sea side
  const lobby = new THREE.Mesh(new THREE.BoxGeometry(w * 0.72, podiumH - 1.6, 0.4), darkGlass)
  lobby.position.set(0, (podiumH - 1.6) / 2 + 0.35, (d + 8) / 2 + 0.05)
  g.add(lobby)
  for (let i = 0; i <= 6; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.18, podiumH - 1.6, 0.25), gold)
    m.position.set(-w * 0.36 + (i * w * 0.72) / 6, (podiumH - 1.6) / 2 + 0.35, (d + 8) / 2 + 0.3)
    g.add(m)
  }
  // cantilevered entrance canopy with a gold fascia
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(17, 0.45, 8), stone)
  canopy.position.set(0, 6.2, (d + 8) / 2 + 4)
  canopy.castShadow = shadows
  g.add(canopy)
  const fascia = new THREE.Mesh(new THREE.BoxGeometry(17.2, 0.5, 0.25), gold)
  fascia.position.set(0, 6.2, (d + 8) / 2 + 8)
  g.add(fascia)
  // podium roof terrace edge
  add(ring(w + 8, d + 8, r + 3, 0.15, 0.5), goldSatin, podiumH)

  /* --------------------------------- shaft --------------------------------- */
  add(prism(w, d, r, shaftH), glazing, podiumH)

  // slab edges every floor (instanced rings)
  const slabGeo = ring(w, d, r, 0.32, 0.32)
  const slabs = new THREE.InstancedMesh(slabGeo, goldSatin, floors + 1)
  const o = new THREE.Object3D()
  for (let i = 0; i <= floors; i++) {
    o.position.set(0, podiumH + i * floorH - 0.16, 0)
    o.updateMatrix()
    slabs.setMatrixAt(i, o.matrix)
  }
  slabs.castShadow = shadows
  g.add(slabs)

  /* ---------------------------- duplex penthouse ---------------------------- */
  const phY = podiumH + shaftH
  add(prism(w - 3, d - 3, Math.max(1, r - 1.5), phH), phGlow, phY, { cast: false })
  // mezzanine slab + furniture silhouettes read through the glass
  add(prism(w - 2.2, d - 2.2, Math.max(1, r - 1.1), 0.3), phDark, phY + floorH - 0.15, { cast: false })
  const phShell = add(prism(w, d, r, phH), phGlass, phY, { cast: false, receive: false })
  phShell.renderOrder = 2

  /* --------------------------- gold vertical fins --------------------------- */
  const outline = roundedRectShape(w, d, r)
  const nFins = Math.round(outline.getLength() / 1.5)
  const pts = outline.getSpacedPoints(nFins)
  const finH = shaftH + phH + 8.5 // fins rise past the roof to form the lantern crown
  const finGeo = new THREE.BoxGeometry(0.14, finH, 0.78).translate(0, finH / 2, 0)
  const fins = new THREE.InstancedMesh(finGeo, gold, nFins)
  for (let i = 0; i < nFins; i++) {
    const p = pts[i]
    const q = pts[(i + 1) % nFins]
    const tx = q.x - p.x
    const ty = q.y - p.y
    const len = Math.hypot(tx, ty) || 1
    // outward normal in shape space (CCW) -> world after rotateX(-90°): (x, -y)
    const nx = ty / len
    const nz = tx / len
    o.position.set(p.x + nx * 0.72, podiumH, -p.y + nz * 0.72)
    o.rotation.set(0, Math.atan2(nx, nz), 0)
    o.updateMatrix()
    fins.setMatrixAt(i, o.matrix)
  }
  fins.castShadow = shadows
  g.add(fins)

  /* --------------------------------- crown --------------------------------- */
  add(prism(w - 1, d - 1, r - 0.5, 0.6), stone, topY)
  add(ring(w, d, r, 0.95, 0.7), gold, topY + 7.8)
  add(ring(w, d, r, 0.95, 0.4), gold, topY + 3.6)
  // rooftop pavilion + infinity pool
  const pav = new THREE.Mesh(new THREE.BoxGeometry(9, 3.4, 6), darkGlass)
  pav.position.set(-5, topY + 0.6 + 1.7, -2.5)
  g.add(pav)
  const poolMesh = new THREE.Mesh(new THREE.BoxGeometry(12, 0.25, 4.2), pool)
  poolMesh.position.set(4, topY + 0.72, 3.2)
  g.add(poolMesh)

  /* ------------------------ penthouse window anchor ------------------------ */
  // centre of the sea-facing penthouse glass (local space) + outward normal
  const anchor = {
    position: new THREE.Vector3(0, phY + floorH * 0.55, d / 2),
    normal: new THREE.Vector3(0, 0, 1),
  }

  return { group: g, anchor, height: topY + 8.5, podiumH }
}
