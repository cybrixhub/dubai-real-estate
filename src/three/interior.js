import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { materials, canvasTexture } from './materials.js'
import { mulberry32 } from '../lib/random.js'

/*
 * The duplex penthouse of The Aurelle Gold, at human scale (metres).
 * Room: x -9..9, z -6..6, ceiling 3.8 m. Full-height glazing on the sea side (z = +6,
 * where the camera enters) and the skyline side (x = +9).
 */

const W = 18
const D = 12
const H = 3.8

function box(parent, w, h, d, mat, x, y, z, r = 0, { ry = 0, cast = true, receive = true } = {}) {
  const geo = r > 0 ? new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2)) : new THREE.BoxGeometry(w, h, d)
  const m = new THREE.Mesh(geo, mat)
  m.position.set(x, y + h / 2, z)
  m.rotation.y = ry
  m.castShadow = cast
  m.receiveShadow = receive
  parent.add(m)
  return m
}

function cyl(parent, rt, rb, h, mat, x, y, z, seg = 32) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat)
  m.position.set(x, y + h / 2, z)
  m.castShadow = m.receiveShadow = true
  parent.add(m)
  return m
}

/** Golden-hour city panorama seen through the glass (we are ~90 m up). */
function skylineTexture() {
  return canvasTexture(
    4096,
    1024,
    (g, w, h) => {
      const hz = h * 0.52 // horizon (eye level)
      const rnd = mulberry32(9)
      const sky = g.createLinearGradient(0, 0, 0, hz)
      sky.addColorStop(0, '#a9bcc4')
      sky.addColorStop(0.6, '#e6d6c0')
      sky.addColorStop(1, '#f6dfbf')
      g.fillStyle = sky
      g.fillRect(0, 0, w, hz)
      const sun = g.createRadialGradient(w * 0.62, hz - h * 0.04, 0, w * 0.62, hz - h * 0.04, h * 0.7)
      sun.addColorStop(0, 'rgba(255,232,190,0.95)')
      sun.addColorStop(0.08, 'rgba(255,208,150,0.5)')
      sun.addColorStop(1, 'rgba(255,208,150,0)')
      g.fillStyle = sun
      g.fillRect(0, 0, w, hz + h * 0.1)
      // land below eye level, seen from ~90 m: soft warm haze
      const ground = g.createLinearGradient(0, hz, 0, h)
      ground.addColorStop(0, '#e3d2b8')
      ground.addColorStop(1, '#9d8c76')
      g.fillStyle = ground
      g.fillRect(0, hz, w, h - hz)
      // the Gulf on the sea side
      const sea = g.createLinearGradient(0, hz, 0, hz + h * 0.14)
      sea.addColorStop(0, 'rgba(176,196,192,0.95)')
      sea.addColorStop(1, 'rgba(120,150,150,0.0)')
      g.fillStyle = sea
      g.fillRect(0, hz, w * 0.36, h * 0.14)
      // three depth layers of towers, far → near (each hazier the further away)
      for (const layer of [
        { n: 150, s: 0.45, haze: 0.62, y: 0 },
        { n: 110, s: 0.75, haze: 0.38, y: h * 0.012 },
        { n: 60, s: 1.15, haze: 0.16, y: h * 0.03 },
      ]) {
        for (let i = 0; i < layer.n; i++) {
          let x = w * 0.3 + rnd() * w * 0.7
          if (rnd() < 0.25) x = rnd() * w
          const cluster = x > w * 0.5 && x < w * 0.78 ? 1.7 : 1
          const bw = (10 + rnd() * 34) * layer.s
          const bh = (40 + rnd() * 150) * layer.s * cluster
          const base = hz + layer.y
          const tone = 120 + rnd() * 50
          const shade = g.createLinearGradient(x, 0, x + bw, 0)
          shade.addColorStop(0, `rgb(${tone + 26},${tone + 22},${tone + 16})`)
          shade.addColorStop(1, `rgb(${tone - 12},${tone - 12},${tone - 10})`)
          g.fillStyle = shade
          g.fillRect(x, base - bh, bw, bh)
          if (layer.s > 0.6)
            for (let yy = base - bh + 4; yy < base - 3; yy += 5 * layer.s)
              for (let xx = x + 2; xx < x + bw - 2; xx += 4 * layer.s)
                if (rnd() < 0.12) {
                  g.fillStyle = `rgba(255,${205 + rnd() * 35},${150 + rnd() * 40},0.75)`
                  g.fillRect(xx, yy, 1.6 * layer.s, 1.6 * layer.s)
                }
          // atmospheric haze over this tower
          g.fillStyle = `rgba(240,224,200,${layer.haze})`
          g.fillRect(x, base - bh, bw, bh)
        }
      }
      // the supertall spire, hazy in the distance
      g.fillStyle = 'rgba(176,172,166,0.92)'
      g.beginPath()
      g.moveTo(w * 0.598, hz)
      g.lineTo(w * 0.603, h * 0.06)
      g.lineTo(w * 0.608, hz)
      g.fill()
      g.fillRect(w * 0.592, hz - h * 0.2, w * 0.022, h * 0.2)
      // low city fabric below the horizon
      for (let i = 0; i < 3000; i++) {
        const t = Math.pow(rnd(), 1.4)
        const y = hz + h * 0.01 + t * (h - hz)
        const x = rnd() * w
        const sz = 1.5 + t * 14
        g.fillStyle = `rgba(${205 + rnd() * 35},${190 + rnd() * 30},${165 + rnd() * 30},${0.25 + t * 0.35})`
        g.fillRect(x, y, sz * (1 + rnd()), sz * 0.55)
      }
      // horizon haze band
      const band = g.createLinearGradient(0, hz - h * 0.08, 0, hz + h * 0.06)
      band.addColorStop(0, 'rgba(246,226,198,0)')
      band.addColorStop(0.55, 'rgba(246,226,198,0.55)')
      band.addColorStop(1, 'rgba(246,226,198,0)')
      g.fillStyle = band
      g.fillRect(0, hz - h * 0.08, w, h * 0.14)
    },
    { repeat: [1, 1] }
  )
}

function artTexture(seed) {
  return canvasTexture(
    512,
    640,
    (g, w, h) => {
      const rnd = mulberry32(seed)
      g.fillStyle = '#efe6d8'
      g.fillRect(0, 0, w, h)
      const cols = ['#c49a6c', '#a5b2a0', '#303638', '#d9c8ae', '#8a6a4a']
      for (let i = 0; i < 6; i++) {
        g.fillStyle = cols[i % cols.length]
        g.globalAlpha = 0.75
        g.beginPath()
        g.ellipse(w * (0.2 + rnd() * 0.6), h * (0.2 + rnd() * 0.6), 40 + rnd() * 160, 30 + rnd() * 120, rnd() * 3, 0, Math.PI * 2)
        g.fill()
      }
      g.globalAlpha = 1
      g.strokeStyle = '#303638'
      g.lineWidth = 3
      g.beginPath()
      g.arc(w * 0.62, h * 0.4, 110, 0.4, 4.2)
      g.stroke()
    },
    { repeat: [1, 1] }
  )
}

function plant(parent, x, z, scale, seed, M) {
  const rnd = mulberry32(seed)
  cyl(parent, 0.42 * scale, 0.32 * scale, 0.75 * scale, M.travertine, x, 0, z)
  const leafMat = new THREE.MeshStandardMaterial({ color: '#4f6338', roughness: 0.75, side: THREE.DoubleSide })
  const leafGeo = new THREE.SphereGeometry(1, 10, 6)
  leafGeo.scale(0.09, 0.42, 0.02)
  leafGeo.translate(0, 0.42, 0)
  const n = 70
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, n)
  const o = new THREE.Object3D()
  const trunkTop = 0.75 * scale
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2
    const r = rnd() * 0.5 * scale
    o.position.set(x + Math.cos(a) * r * 0.4, trunkTop + rnd() * 1.6 * scale, z + Math.sin(a) * r * 0.4)
    o.rotation.set((rnd() - 0.5) * 2.2, a, (rnd() - 0.5) * 2.2)
    o.scale.setScalar(scale * (0.7 + rnd() * 0.6))
    o.updateMatrix()
    leaves.setMatrixAt(i, o.matrix)
  }
  leaves.castShadow = true
  parent.add(leaves)
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.035, 1.6 * scale, 6), M.trunk)
  stem.position.set(x, trunkTop + 0.8 * scale, z)
  parent.add(stem)
}

/** Material-library entries the penthouse uses (touched one per idle slice before building). */
export const INTERIOR_MATERIALS = ['oakFloor', 'walnut', 'marble', 'travertine', 'linen', 'rug', 'fabricSand', 'fabricSage', 'fabricCharcoal', 'bronze', 'plaster', 'trunk']

export function buildInterior({ quality = 1 } = {}) {
  const M = materials()
  const g = new THREE.Group()
  g.name = 'penthouse-interior'

  const glow = (color, intensity = 1.2) =>
    new THREE.MeshStandardMaterial({ color: '#000000', emissive: color, emissiveIntensity: intensity, toneMapped: true })
  const warmGlow = glow('#ffcf96', 2.2)
  const flame = glow('#ff9a4a', 2.6)
  const goldMat = new THREE.MeshStandardMaterial({ color: '#c9a36a', metalness: 1, roughness: 0.28 })
  const stoneDark = new THREE.MeshStandardMaterial({ color: '#3a3532', roughness: 0.45 })
  const ceilingMat = new THREE.MeshStandardMaterial({ color: '#f3eee6', roughness: 0.95 })
  const sheer = new THREE.MeshStandardMaterial({ color: '#f6f1e8', roughness: 1, transparent: true, opacity: 0.82, side: THREE.DoubleSide })
  const clearGlass = new THREE.MeshPhysicalMaterial({
    color: '#dfe8ea',
    roughness: 0.02,
    metalness: 0,
    transparent: true,
    opacity: 0.1,
    depthWrite: false,
    envMapIntensity: 1.2,
  })

  /* ------------------------------ shell ------------------------------ */
  // own copy of the oak material: the shared one is tiled for the showcase model
  const oak = M.oakFloor.clone()
  oak.map = M.oakFloor.map.clone()
  oak.map.repeat.set(9, 6)
  oak.map.needsUpdate = true
  box(g, W, 0.1, D, oak, 0, -0.1, 0, 0, { cast: false })
  box(g, W, 0.12, D, ceilingMat, 0, H, 0, 0, { cast: false })
  // cove: dropped perimeter soffit + concealed warm strip
  box(g, W, 0.25, 0.9, ceilingMat, 0, H - 0.25, -D / 2 + 0.45, 0, { cast: false })
  box(g, 0.9, 0.25, D, ceilingMat, -W / 2 + 0.45, H - 0.25, 0, 0, { cast: false })
  box(g, W - 1.8, 0.03, 0.06, warmGlow, 0.45, H - 0.28, -D / 2 + 0.92, 0, { cast: false })
  box(g, 0.06, 0.03, D - 1.8, warmGlow, -W / 2 + 0.92, H - 0.28, 0.45, 0, { cast: false })
  // downlights
  const dl = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 16), warmGlow, 12)
  const o = new THREE.Object3D()
  let k = 0
  for (const x of [-4.5, -1.5, 1.5, 4.5]) for (const z of [-2.5, 0.5, 3.5]) {
    o.position.set(x, H - 0.01, z)
    o.updateMatrix()
    dl.setMatrixAt(k++, o.matrix)
  }
  g.add(dl)

  // back wall (z = -6): stone base, walnut slat feature wall, linear fireplace
  box(g, W, H, 0.2, M.plaster, 0, 0, -D / 2 - 0.1)
  const slats = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, H - 0.3, 0.08), M.walnut, 64)
  for (let i = 0; i < 64; i++) {
    o.position.set(-0.8 + i * 0.15, (H - 0.3) / 2, -D / 2 + 0.06)
    o.updateMatrix()
    slats.setMatrixAt(i, o.matrix)
  }
  slats.castShadow = slats.receiveShadow = true
  g.add(slats)
  box(g, 4.6, 0.9, 0.7, stoneDark, 4.3, 0, -D / 2 + 0.45, 0.02)
  box(g, 3.6, 0.12, 0.05, flame, 4.3, 0.45, -D / 2 + 0.82, 0, { cast: false })
  box(g, 4.8, 0.06, 0.8, M.marble, 4.3, 0.9, -D / 2 + 0.45, 0.01)

  // left wall (x = -9): backlit walnut shelving
  box(g, 0.2, H, D, M.plaster, -W / 2 - 0.1, 0, 0)
  box(g, 0.45, 2.9, 6.4, M.walnut, -W / 2 + 0.23, 0, -1.6, 0.01)
  for (let i = 0; i < 5; i++) {
    box(g, 0.4, 0.04, 6.2, M.walnut, -W / 2 + 0.45, 0.35 + i * 0.6, -1.6, 0, { cast: false })
    box(g, 0.02, 0.02, 6.0, warmGlow, -W / 2 + 0.6, 0.33 + i * 0.6, -1.6, 0, { cast: false })
  }
  const decoMats = [M.marble, M.bronze, M.fabricSage, M.travertine, goldMat]
  const rnd = mulberry32(3)
  for (let i = 0; i < 18; i++) {
    const shelf = i % 4
    const z = -4.4 + (i / 18) * 5.8
    const mat = decoMats[i % decoMats.length]
    if (i % 3 === 0) box(g, 0.22, 0.28, 0.5, M.linen, -W / 2 + 0.4, 0.39 + shelf * 0.6, z, 0.01)
    else {
      const vase = new THREE.Mesh(new THREE.SphereGeometry(0.12 + rnd() * 0.06, 20, 14), mat)
      vase.scale.y = 1.2 + rnd()
      vase.position.set(-W / 2 + 0.42, 0.52 + shelf * 0.6, z)
      vase.castShadow = true
      g.add(vase)
    }
  }

  // glazing: sea side (z = +6) and skyline side (x = +9) with gold mullions + exterior fins
  box(g, W, H, 0.03, clearGlass, 0, 0, D / 2, 0, { cast: false, receive: false })
  box(g, 0.03, H, D, clearGlass, W / 2, 0, 0, 0, { cast: false, receive: false })
  const mull = new THREE.InstancedMesh(new THREE.BoxGeometry(0.07, H, 0.12), goldMat, 26)
  k = 0
  for (let x = -9; x <= 9.01; x += 1.5) {
    o.position.set(x, H / 2, D / 2)
    o.rotation.set(0, 0, 0)
    o.updateMatrix()
    mull.setMatrixAt(k++, o.matrix)
  }
  for (let z = -6; z < 6; z += 1.5) {
    o.position.set(W / 2, H / 2, z)
    o.rotation.set(0, Math.PI / 2, 0)
    o.updateMatrix()
    mull.setMatrixAt(k++, o.matrix)
  }
  mull.count = k
  g.add(mull)
  const fins = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, H + 1.2, 0.78), goldMat, 24)
  k = 0
  for (let x = -8.25; x <= 8.3; x += 1.5) {
    o.position.set(x, H / 2, D / 2 + 0.75)
    o.rotation.set(0, 0, 0)
    o.updateMatrix()
    fins.setMatrixAt(k++, o.matrix)
  }
  for (let z = -5.25; z < 6; z += 1.5) {
    o.position.set(W / 2 + 0.75, H / 2, z)
    o.rotation.set(0, Math.PI / 2, 0)
    o.updateMatrix()
    fins.setMatrixAt(k++, o.matrix)
  }
  fins.count = k
  fins.castShadow = true
  g.add(fins)
  // exterior terrace slab + glass balustrade beyond the sea-side glazing
  box(g, W + 2, 0.25, 3.2, M.travertine, 0, -0.25, D / 2 + 1.6, 0, { cast: false })

  // sheer curtains gathered at the glazing edges
  const curtainGeo = new THREE.PlaneGeometry(1.4, H - 0.15, 24, 1)
  const cp = curtainGeo.attributes.position
  for (let i = 0; i < cp.count; i++) cp.setZ(i, Math.sin(cp.getX(i) * 14) * 0.06)
  curtainGeo.computeVertexNormals()
  for (const [x, z, ry] of [[-8.2, D / 2 - 0.25, 0], [8.7, -5.2, Math.PI / 2], [8.7, 5.2, Math.PI / 2]]) {
    const c = new THREE.Mesh(curtainGeo, sheer)
    c.position.set(x, (H - 0.15) / 2, z)
    c.rotation.y = ry
    g.add(c)
  }

  /* ------------------------------ living ------------------------------ */
  box(g, 7.2, 0.02, 5.2, M.rug, -1.4, 0, 1.6, 0.01, { cast: false })
  // L-shaped sofa facing the sea view
  box(g, 4.6, 0.42, 1.05, M.fabricSand, -1.6, 0.0, -0.2, 0.16)
  box(g, 4.6, 0.5, 0.28, M.fabricSand, -1.6, 0.38, -0.66, 0.12)
  box(g, 1.05, 0.42, 2.4, M.fabricSand, -4.4, 0.0, 0.85, 0.16)
  box(g, 0.28, 0.5, 2.4, M.fabricSand, -4.86, 0.38, 0.85, 0.12)
  for (const [x, z, m] of [[-3.0, -0.48, M.fabricSage], [-1.9, -0.48, M.linen], [-0.6, -0.48, M.fabricSage], [-4.62, 0.6, M.linen]]) {
    const c = box(g, 0.75, 0.42, 0.18, m, x, 0.42, z, 0.08)
    c.rotation.x = -0.18
  }
  // round marble coffee table + bronze tray
  cyl(g, 0.8, 0.8, 0.06, M.marble, -1.6, 0.34, 1.35, 48)
  cyl(g, 0.55, 0.62, 0.34, stoneDark, -1.6, 0, 1.35, 48)
  cyl(g, 0.22, 0.22, 0.03, goldMat, -1.4, 0.4, 1.25)
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.travertine)
  bowl.rotation.x = Math.PI
  bowl.position.set(-1.85, 0.56, 1.5)
  g.add(bowl)
  // lounge chairs
  for (const [x, z, ry] of [[0.9, 2.5, -2.4], [-3.6, 3.3, 2.6]]) {
    const chair = new THREE.Group()
    box(chair, 0.95, 0.38, 0.9, M.fabricCharcoal, 0, 0.0, 0, 0.18)
    box(chair, 0.95, 0.55, 0.22, M.fabricCharcoal, 0, 0.3, -0.38, 0.1)
    box(chair, 0.18, 0.3, 0.9, M.fabricCharcoal, -0.44, 0.3, 0, 0.08)
    box(chair, 0.18, 0.3, 0.9, M.fabricCharcoal, 0.44, 0.3, 0, 0.08)
    chair.position.set(x, 0.12, z)
    chair.rotation.y = ry
    box(chair, 0.9, 0.12, 0.85, goldMat, 0, -0.12, 0)
    g.add(chair)
  }
  // arc floor lamp
  const arcCurve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-5.3, 0, -1.2), new THREE.Vector3(-5.3, 2.6, -1.2), new THREE.Vector3(-3.4, 2.1, -0.4))
  const arc = new THREE.Mesh(new THREE.TubeGeometry(arcCurve, 24, 0.025, 8), goldMat)
  arc.castShadow = true
  g.add(arc)
  cyl(g, 0.2, 0.2, 0.05, stoneDark, -5.3, 0, -1.2)
  const shade = new THREE.Mesh(new THREE.SphereGeometry(0.28, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.linen)
  shade.position.set(-3.4, 1.86, -0.4)
  g.add(shade)
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), warmGlow)
  bulb.position.set(-3.4, 1.88, -0.4)
  g.add(bulb)
  // console + art on the back wall
  box(g, 2.8, 0.75, 0.45, M.walnut, -3.6, 0, -D / 2 + 0.32, 0.02)
  const art = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.9), new THREE.MeshStandardMaterial({ map: artTexture(4), roughness: 0.9 }))
  art.position.set(-3.6, 1.9, -D / 2 + 0.03)
  g.add(art)
  box(g, 1.6, 2.0, 0.04, goldMat, -3.6, 0.9, -D / 2 + 0.01, 0, { cast: false })
  art.position.z = -D / 2 + 0.05

  /* ------------------------------ dining ------------------------------ */
  box(g, 3.4, 0.07, 1.2, M.walnut, 4.6, 0.72, -2.6, 0.02)
  box(g, 0.5, 0.72, 0.5, stoneDark, 3.6, 0, -2.6, 0.04)
  box(g, 0.5, 0.72, 0.5, stoneDark, 5.6, 0, -2.6, 0.04)
  for (const x of [3.4, 4.6, 5.8])
    for (const s of [-1, 1]) {
      const ch = new THREE.Group()
      box(ch, 0.52, 0.08, 0.5, M.fabricSand, 0, 0.44, 0, 0.04)
      box(ch, 0.52, 0.5, 0.07, M.fabricSand, 0, 0.5, -0.22, 0.03)
      for (const [lx, lz] of [[-0.22, -0.2], [0.22, -0.2], [-0.22, 0.2], [0.22, 0.2]]) box(ch, 0.04, 0.44, 0.04, goldMat, lx, 0, lz)
      ch.position.set(x, 0, -2.6 + s * 0.95)
      ch.rotation.y = s > 0 ? Math.PI : 0
      g.add(ch)
    }
  // pendant globes
  for (const x of [3.8, 4.6, 5.4]) {
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 1.6, 4), goldMat)
    line.position.set(x, H - 0.8, -2.6)
    g.add(line)
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.17, 24, 16), warmGlow)
    globe.position.set(x, H - 1.65, -2.6)
    g.add(globe)
  }

  /* ------------------------------ kitchen ------------------------------ */
  box(g, 6.6, 2.4, 0.65, M.walnut, -5.2, 0, -D / 2 + 0.33, 0.01)
  box(g, 6.6, 0.02, 0.04, warmGlow, -5.2, 1.45, -D / 2 + 0.67, 0, { cast: false })
  box(g, 6.6, 0.55, 0.62, M.marble, -5.2, 0.9, -D / 2 + 0.33, 0.01)
  box(g, 3.4, 0.9, 1.1, M.walnut, -5.0, 0, -3.4, 0.02)
  box(g, 3.6, 0.06, 1.2, M.marble, -5.0, 0.9, -3.4, 0.02)
  for (const x of [-6.1, -5.0, -3.9]) {
    cyl(g, 0.2, 0.2, 0.06, M.fabricCharcoal, x, 0.72, -2.55)
    cyl(g, 0.025, 0.025, 0.72, goldMat, x, 0, -2.55, 8)
  }

  /* ------------------------------ plants ------------------------------ */
  plant(g, 7.9, 4.9, 1.25, 21, M)
  plant(g, -7.6, 4.6, 1.05, 22, M)
  if (quality > 0.6) plant(g, 7.8, -4.8, 0.9, 23, M)

  /* --------------------------- outside the glass --------------------------- */
  const pano = new THREE.Mesh(
    new THREE.CylinderGeometry(70, 70, 70, 64, 1, true),
    new THREE.MeshBasicMaterial({ map: skylineTexture(), side: THREE.BackSide, fog: false })
  )
  pano.position.y = 1.6
  pano.rotation.y = -0.9
  g.add(pano)

  /* ------------------------------ lighting ------------------------------ */
  const lights = new THREE.Group()
  lights.add(new THREE.HemisphereLight('#ffe8cf', '#6d5848', 0.55))
  const sun = new THREE.DirectionalLight('#ffc78e', 2.6)
  sun.position.set(26, 9, 18) // low golden-hour sun pouring through both glass walls
  sun.target.position.set(-2, 0, -1)
  sun.castShadow = true
  sun.shadow.mapSize.set(quality > 0.6 ? 2048 : 1024, quality > 0.6 ? 2048 : 1024)
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.02
  sun.shadow.radius = 4
  const sc = sun.shadow.camera
  sc.left = -13
  sc.right = 13
  sc.top = 10
  sc.bottom = -10
  sc.near = 5
  sc.far = 60
  lights.add(sun, sun.target)
  for (const [x, y, z, i] of [[4.6, 2.0, -2.6, 2.2], [-3.4, 1.8, -0.4, 1.4], [-5, 2.4, -4.5, 1.0]]) {
    const pl = new THREE.PointLight('#ffc98f', i, 9, 2)
    pl.position.set(x, y, z)
    lights.add(pl)
  }
  g.add(lights)

  /* ------------------------------ camera path ------------------------------ */
  const path = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(0.6, 1.7, 9.2),
      new THREE.Vector3(0.4, 1.62, 5.2),
      new THREE.Vector3(1.6, 1.58, 2.2),
      new THREE.Vector3(3.6, 1.6, 0.6),
      new THREE.Vector3(4.4, 1.62, 0.9),
    ],
    false,
    'centripetal'
  )
  const look = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(-0.6, 1.3, 0),
      new THREE.Vector3(-1.4, 1.1, -0.8),
      new THREE.Vector3(3.2, 1.2, -2.8),
      new THREE.Vector3(8.8, 1.4, -1.8),
      new THREE.Vector3(14, 1.45, 2.4),
    ],
    false,
    'centripetal'
  )

  return { group: g, path, look }
}
