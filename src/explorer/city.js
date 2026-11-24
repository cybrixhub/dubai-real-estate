import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { facadeMaterial, waterNormalTexture } from '../three/materials.js'
import { prism } from '../three/goldTower.js'
import { buildPark } from '../three/park.js'
import { mulberry32 } from '../lib/random.js'
import { TOWER } from './data.js'

/*
 * The Dubai setting around The Aurelle Gold (1 unit = 1 m): landscaped podium park (shared with
 * the hero), downtown towers on the hero's facade shader, a landmark spire, low-rise fabric and
 * the Arabian Gulf. Towers and fabric are four instanced draw calls.
 */

const PALETTE = ['#dfe2e2', '#cdd5d8', '#e6dccb', '#c5cbc8', '#d9cfbd', '#b7c1c4', '#ece6dc']

export function buildCity({ quality = 1, shadows = true } = {}) {
  const g = new THREE.Group()
  g.name = 'city'
  const rnd = mulberry32(2027)

  /* ------------------------------- ground + Gulf ------------------------------- */
  const land = new THREE.Mesh(
    new THREE.PlaneGeometry(7000, 3400).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: '#e6d8bf', roughness: 1 })
  )
  land.position.set(0, -0.05, -1470)
  land.receiveShadow = true
  g.add(land)
  const wn = waterNormalTexture([260, 260])
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(9000, 3400).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: '#6a9ea4', metalness: 0.55, roughness: 0.1, normalMap: wn, normalScale: new THREE.Vector2(0.16, 0.16), envMapIntensity: 1.2 })
  )
  sea.position.set(0, -0.3, 230 + 1700)
  sea.userData.ownsMaps = true
  g.add(sea)
  // a pale surf line
  const surf = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#f3ecdd', transparent: true, opacity: 0.55 }))
  surf.position.set(0, -0.2, 228)
  g.add(surf)

  /* ----------------------------------- plaza + park ----------------------------------- */
  const plaza = new THREE.Mesh(prism(80, 62, 10, 0.35), new THREE.MeshStandardMaterial({ color: '#ece4d5', roughness: 0.85 }))
  plaza.receiveShadow = true
  g.add(plaza)
  const park = buildPark({ shadows, quality: quality > 0.7 ? 1 : 0.5 })
  g.add(park.group)

  /* -------------------------------- instanced skyline -------------------------------- */
  const boxGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)
  const cylGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 16, 1).translate(0, 0.5, 0)
  const towerMat = facadeMaterial({ color: '#ffffff', cell: [3.2, 3.6], night: 0.22 })
  const lowMat = facadeMaterial({ color: '#f1e9dc', cell: [3.2, 3.4], roughness: 0.85, metalness: 0.05, winFill: [0.25, 0.75, 0.3, 0.75] })
  const taken = new Set()
  const key = (x, z) => `${Math.round(x / 36)}|${Math.round(z / 36)}`
  const keepClear = (x, z) => Math.abs(x) < 125 && z > -85 && z < 190
  const tall = []
  const placeTower = (x, z, h, w, d, shape) => {
    if (keepClear(x, z) || z > 215) return
    const k = key(x, z)
    if (taken.has(k)) return
    taken.add(k)
    tall.push({ x, z, h, w, d, shape, color: PALETTE[Math.floor(rnd() * PALETTE.length)], rot: rnd() < 0.7 ? 0 : (rnd() - 0.5) * 0.7 })
  }
  const nT = Math.round(260 * quality)
  for (let i = 0; i < nT; i++) {
    // dense belts east and west of the site, a deep downtown behind it
    const side = rnd() < 0.5 ? -1 : 1
    const behind = rnd() < 0.55
    const x = behind ? (rnd() - 0.5) * 1100 : side * (140 + rnd() * 520)
    const z = behind ? -110 - rnd() * 780 : -40 + rnd() * 250
    const dist = Math.hypot(x, z)
    const h = (36 + rnd() * rnd() * 150) * (0.65 + Math.min(1, dist / 700) * 0.9)
    placeTower(x, z, h, 20 + rnd() * 22, 20 + rnd() * 22, rnd() < 0.3 ? 1 : 0)
  }
  const instanced = (geo, mat, items, crown = false) => {
    const mesh = new THREE.InstancedMesh(geo, mat, items.length)
    const o = new THREE.Object3D()
    const c = new THREE.Color()
    items.forEach((b, i) => {
      o.position.set(b.x, crown ? b.h : 0, b.z)
      o.rotation.set(0, b.rot || 0, 0)
      o.scale.set(b.w * (crown ? 0.62 : 1), crown ? b.h * 0.1 : b.h, b.d * (crown ? 0.62 : 1))
      o.updateMatrix()
      mesh.setMatrixAt(i, o.matrix)
      mesh.setColorAt(i, c.set(b.color || '#ece4d6'))
    })
    mesh.castShadow = false
    mesh.receiveShadow = false
    return mesh
  }
  g.add(instanced(boxGeo, towerMat, tall.filter((b) => b.shape === 0)))
  g.add(instanced(cylGeo, towerMat, tall.filter((b) => b.shape === 1)))
  g.add(instanced(boxGeo, towerMat, tall.filter((b) => b.shape === 0 && b.h > 80), true))
  const low = []
  const nL = Math.round(1700 * quality)
  for (let i = 0; i < nL; i++) {
    const x = (rnd() - 0.5) * 2000
    const z = -900 + rnd() * 1110
    if (keepClear(x, z) || taken.has(key(x, z))) continue
    low.push({ x, z, h: 8 + rnd() * rnd() * 34, w: 14 + rnd() * 26, d: 14 + rnd() * 26, rot: rnd() < 0.8 ? 0 : 0.35 })
  }
  g.add(instanced(boxGeo, lowMat, low))

  /* ------------------------------------ landmark spire ------------------------------------ */
  const spireMat = facadeMaterial({ color: '#e4e8ea', cell: [2.4, 4.2], roughness: 0.35, metalness: 0.45, night: 0.15 })
  const parts = []
  const o = new THREE.Object3D()
  const N = 16
  const H = 270
  const segH = H / N
  for (let k = 0; k < N; k++) {
    for (let i = 0; i < 3; i++) {
      const prog = (k * 3 + i) / (N * 3)
      const L = 38 * Math.pow(1 - prog, 0.95)
      if (L < 5) continue
      const wdt = 14.4 * (1 - prog * 0.45)
      const a = (i / 3) * Math.PI * 2 + Math.PI / 2
      o.scale.set(L, segH, wdt)
      o.rotation.set(0, -a, 0)
      o.position.set(Math.cos(a) * L * 0.5, k * segH, Math.sin(a) * L * 0.5)
      o.updateMatrix()
      parts.push(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0).applyMatrix4(o.matrix).toNonIndexed())
    }
  }
  parts.push(new THREE.CylinderGeometry(5.6, 10.4, H + 30, 18).translate(0, (H + 30) / 2, 0).toNonIndexed())
  parts.push(new THREE.CylinderGeometry(0.3, 4.8, 80, 12).translate(0, H + 30 + 40, 0).toNonIndexed())
  const spire = new THREE.Mesh(mergeGeometries(parts.map((p) => (p.deleteAttribute('uv'), p))), spireMat)
  parts.forEach((p) => p.dispose())
  spire.position.set(-260, 0, -470)
  g.add(spire)

  return { group: g }
}
