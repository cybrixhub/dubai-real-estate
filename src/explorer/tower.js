import * as THREE from 'three'
import { TOWER, TOP_Y, LIFT, floorBaseY, apartments } from './data.js'
import { facadeMaterial } from '../three/materials.js'
import { roundedRectShape, prism, ring } from '../three/goldTower.js'
import { outlinePoints } from './plate.js'

/*
 * THE AURELLE GOLD — large sibling of the hero tower: same rounded-rectangle plan, brushed-gold
 * fins, brass slab edges, curtain-wall glazing and lantern crown, scaled to 40 floors with
 * balconies. Each floor is an instance, so one uniform set drives floor isolation:
 *   uSel   selected floor (or -1)
 *   uLift  metres the floors above the selection rise (a whole number of storeys)
 *   uGhost opacity of everything except the selection (above / below)
 *   uHide  fades the selected floor's glass so the detailed floor plate shows through
 *   uHi    champagne highlight on the selected floor (full-tower view)
 * Everything is a handful of draw calls regardless of floor count.
 */

const { w: PW, d: PD, r: PR, floors: N, floorH: FH, podiumH } = TOWER

export const U = {
  uSel: { value: -1 },
  uLift: { value: 0 },
  uGhostUp: { value: 1 },
  uGhostDown: { value: 1 },
  uHide: { value: 0 },
  uHi: { value: 0 },
  uRange: { value: 100 },
}

function ghostPatch(mat, { hide = false } = {}) {
  const prev = mat.onBeforeCompile
  const prevKey = mat.customProgramCacheKey ? mat.customProgramCacheKey() : ''
  mat.transparent = true
  mat.customProgramCacheKey = () => `${prevKey}|ghost${hide ? 'H' : ''}`
  mat.onBeforeCompile = (shader, renderer) => {
    prev?.call(mat, shader, renderer)
    Object.assign(shader.uniforms, U)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aFloor;\nuniform float uSel;\nuniform float uLift;\nvarying float vFlr;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFlr = aFloor;\ntransformed.y += step(uSel + 0.5, aFloor) * step(0.0, uSel) * uLift;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uSel;\nuniform float uGhostUp;\nuniform float uGhostDown;\nuniform float uHide;\nuniform float uHi;\nuniform float uRange;\nvarying float vFlr;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        if (uSel > 0.0 && abs(vFlr - uSel) > uRange) discard;
        float gSel = step(abs(vFlr - uSel), 0.5) * step(0.0, uSel);
        float gAbove = step(uSel + 0.5, vFlr) * step(0.0, uSel);
        float gGhost = mix(uGhostDown, uGhostUp, gAbove);
        diffuseColor.a *= mix(gGhost, ${hide ? '1.0 - uHide' : '1.0'}, gSel);
        totalEmissiveRadiance += gSel * uHi * vec3(0.34, 0.2, 0.07);
        if (diffuseColor.a < 0.01) discard;`
      )
  }
  return mat
}

const tag = (geo, floor) => {
  geo.setAttribute('aFloor', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count).fill(floor), 1))
  return geo
}
/** Instanced mesh whose instances carry their floor number (static). */
function floorInstances(geo, mat, floorList, place, { cast = true } = {}) {
  const mesh = new THREE.InstancedMesh(geo, mat, floorList.length)
  const fl = new Float32Array(floorList.length)
  const o = new THREE.Object3D()
  let k = 0
  floorList.forEach((f, i) => {
    o.position.set(0, 0, 0)
    o.rotation.set(0, 0, 0)
    o.scale.set(1, 1, 1)
    place(o, f, i)
    o.updateMatrix()
    mesh.setMatrixAt(k, o.matrix)
    fl[k++] = f
  })
  geo.setAttribute('aFloor', new THREE.InstancedBufferAttribute(fl, 1))
  mesh.castShadow = cast
  mesh.receiveShadow = true
  return mesh
}

export function buildTowerShell({ quality = 1 } = {}) {
  const root = new THREE.Group()
  root.name = 'tower'
  const shadowCasters = []
  const mats = []
  const reg = (m) => (mats.push(m), m)

  /* ------------------------------ materials (match the hero) ------------------------------ */
  const gold = reg(ghostPatch(new THREE.MeshStandardMaterial({ color: '#c7a676', metalness: 0.72, roughness: 0.3, envMapIntensity: 1.1 })))
  const goldSatin = reg(ghostPatch(new THREE.MeshStandardMaterial({ color: '#9c7b4e', metalness: 0.95, roughness: 0.34 })))
  const stone = reg(ghostPatch(new THREE.MeshStandardMaterial({ color: '#e7dac4', roughness: 0.72 })))
  const darkGlass = reg(ghostPatch(new THREE.MeshStandardMaterial({ color: '#4d5c61', metalness: 0.92, roughness: 0.07 })))
  const railGlass = reg(
    ghostPatch(new THREE.MeshPhysicalMaterial({ color: '#dfe9ea', roughness: 0.03, metalness: 0, opacity: 0.28, envMapIntensity: 1.3, depthWrite: false }))
  )
  const glazing = reg(
    ghostPatch(
      facadeMaterial({ color: '#c3ccd0', cell: [1.5, FH], winFill: [0.05, 0.95, 0.1, 0.93], glassTint: [0.3, 0.35, 0.39], night: 0.35, roughness: 0.32, metalness: 0.45 }),
      { hide: true }
    )
  )
  const pool = new THREE.MeshStandardMaterial({ color: '#79b9bd', emissive: '#2f777c', emissiveIntensity: 0.45, metalness: 0.3, roughness: 0.05 })

  const floorsAll = Array.from({ length: N }, (_, i) => i + 1)
  const slabsAll = Array.from({ length: N + 1 }, (_, i) => i + 1) // slab i is the underside of floor i; N+1 = roof

  /* --------------------------------- glass shells --------------------------------- */
  const glassGeo = prism(PW, PD, PR, FH - 0.32)
  const glass = floorInstances(glassGeo, glazing, floorsAll, (o, f) => o.position.set(0, floorBaseY(f), 0), { cast: false })
  glass.renderOrder = 1
  glass.name = 'glass'
  root.add(glass)

  /* ---------------------------------- slab edges ---------------------------------- */
  const slabs = floorInstances(ring(PW, PD, PR, 0.32, 0.32), goldSatin, slabsAll, (o, f) => o.position.set(0, floorBaseY(f) - 0.32, 0))
  slabs.renderOrder = 2
  root.add(slabs)
  shadowCasters.push(slabs)

  /* ------------------------------------ gold fins ------------------------------------ */
  const outline = roundedRectShape(PW, PD, PR)
  const nFins = Math.round(outline.getLength() / 1.5)
  const pts = outline.getSpacedPoints(nFins)
  const spans = apartments.map((a) => {
    const [xa] = a.toWorld(a.lyt.balU[0], 0)
    const [xb] = a.toWorld(a.lyt.balU[1], 0)
    return { x0: Math.min(xa, xb) - 0.3, x1: Math.max(xa, xb) + 0.3, side: Math.sign(a.origin[1]), a }
  })
  const finPos = []
  for (let i = 0; i < nFins; i++) {
    const p = pts[i]
    const q = pts[(i + 1) % nFins]
    const tx = q.x - p.x
    const ty = q.y - p.y
    const len = Math.hypot(tx, ty) || 1
    const nx = ty / len
    const nz = tx / len
    const x = p.x + nx * 0.72
    const z = -p.y + nz * 0.72
    // fins stop where the balconies project
    if (spans.some((s) => x > s.x0 && x < s.x1 && Math.sign(z) === s.side && Math.abs(z) > PD / 2 - 1)) continue
    finPos.push({ x, z, ry: Math.atan2(nx, nz) })
  }
  const finGeo = new THREE.BoxGeometry(0.14, FH + 0.02, 0.78).translate(0, (FH + 0.02) / 2, 0)
  const finFloors = []
  for (let f = 1; f <= N; f++) for (let i = 0; i < finPos.length; i++) finFloors.push(f)
  const fins = floorInstances(finGeo, gold, finFloors, (o, f, k) => {
    const p = finPos[k % finPos.length]
    o.position.set(p.x, floorBaseY(f) - 0.01, p.z)
    o.rotation.y = p.ry
  })
  fins.renderOrder = 3
  root.add(fins)
  shadowCasters.push(fins)
  // lantern crown: fins keep rising past the roof
  const crownFinGeo = new THREE.BoxGeometry(0.14, 8.5, 0.78).translate(0, 4.25, 0)
  const crownFins = floorInstances(crownFinGeo, gold, finPos.map(() => N + 1), (o, f, k) => {
    const p = finPos[k]
    o.position.set(p.x, TOP_Y + 0.34, p.z)
    o.rotation.y = p.ry
  })
  crownFins.renderOrder = 3
  root.add(crownFins)
  shadowCasters.push(crownFins)

  /* ------------------------------------ balconies ------------------------------------ */
  const slabB = []
  const railB = []
  const brassB = []
  for (let f = 1; f <= N; f++) {
    const y = floorBaseY(f)
    for (const a of apartments) {
      const [xa] = a.toWorld(a.lyt.balU[0], 0)
      const [xb] = a.toWorld(a.lyt.balU[1], 0)
      const x0 = Math.min(xa, xb)
      const x1 = Math.max(xa, xb)
      const side = Math.sign(a.origin[1])
      const cx = (x0 + x1) / 2
      const bw = x1 - x0
      const dep = 3.2
      const zc = side * (PD / 2 + dep / 2 - 0.1)
      const zf = side * (PD / 2 + dep - 0.1)
      slabB.push({ f, x: cx, y: y - 0.15, z: zc, sx: bw, sy: 0.3, sz: dep })
      railB.push({ f, x: cx, y: y + 0.58, z: zf, sx: bw, sy: 1.1, sz: 0.03 })
      railB.push({ f, x: x0, y: y + 0.58, z: zc, sx: 0.03, sy: 1.1, sz: dep })
      railB.push({ f, x: x1, y: y + 0.58, z: zc, sx: 0.03, sy: 1.1, sz: dep })
      brassB.push({ f, x: cx, y: y + 1.14, z: zf, sx: bw + 0.04, sy: 0.04, sz: 0.07 })
      brassB.push({ f, x: x0, y: y + 1.14, z: zc, sx: 0.07, sy: 0.04, sz: dep })
      brassB.push({ f, x: x1, y: y + 1.14, z: zc, sx: 0.07, sy: 0.04, sz: dep })
    }
  }
  const unit = () => new THREE.BoxGeometry(1, 1, 1)
  const place = (list) => (o, f, k) => {
    const b = list[k]
    o.position.set(b.x, b.y, b.z)
    o.scale.set(b.sx, b.sy, b.sz)
  }
  const bSlab = floorInstances(unit(), stone, slabB.map((b) => b.f), place(slabB))
  const bRail = floorInstances(unit(), railGlass, railB.map((b) => b.f), place(railB), { cast: false })
  bRail.renderOrder = 5
  const bBrass = floorInstances(unit(), goldSatin, brassB.map((b) => b.f), place(brassB), { cast: false })
  bBrass.renderOrder = 4
  root.add(bSlab, bRail, bBrass)
  shadowCasters.push(bSlab)

  /* ---------------------------- podium, lobby, crown ---------------------------- */
  const podium = new THREE.Mesh(tag(prism(PW + 8, PD + 8, PR + 3, podiumH), 0), stone)
  podium.castShadow = podium.receiveShadow = true
  root.add(podium)
  shadowCasters.push(podium)
  const lobby = new THREE.Mesh(tag(new THREE.BoxGeometry(PW * 0.72, podiumH - 1.6, 0.4), 0), darkGlass)
  lobby.position.set(0, (podiumH - 1.6) / 2 + 0.35, (PD + 8) / 2 + 0.05)
  root.add(lobby)
  const mull = floorInstances(new THREE.BoxGeometry(0.18, podiumH - 1.6, 0.25), gold, Array(9).fill(0), (o, f, k) =>
    o.position.set(-PW * 0.36 + (k * PW * 0.72) / 8, (podiumH - 1.6) / 2 + 0.35, (PD + 8) / 2 + 0.3)
  )
  root.add(mull)
  const canopy = new THREE.Mesh(tag(new THREE.BoxGeometry(24, 0.5, 9), 0), stone)
  canopy.position.set(0, 6.4, (PD + 8) / 2 + 4.5)
  canopy.castShadow = true
  root.add(canopy)
  const fascia = new THREE.Mesh(tag(new THREE.BoxGeometry(24.2, 0.55, 0.28), 0), gold)
  fascia.position.set(0, 6.4, (PD + 8) / 2 + 9)
  root.add(fascia)
  const podRing = new THREE.Mesh(tag(ring(PW + 8, PD + 8, PR + 3, 0.15, 0.5), 0), goldSatin)
  podRing.position.y = podiumH
  root.add(podRing)

  const crown = new THREE.Group()
  const crownTop = new THREE.Mesh(tag(prism(PW - 1, PD - 1, PR - 0.5, 0.6), N + 1), stone)
  crownTop.position.y = TOP_Y
  const halo1 = new THREE.Mesh(tag(ring(PW, PD, PR, 0.95, 0.7), N + 1), gold)
  halo1.position.y = TOP_Y + 7.8
  const halo2 = new THREE.Mesh(tag(ring(PW, PD, PR, 0.95, 0.4), N + 1), gold)
  halo2.position.y = TOP_Y + 3.6
  const pav = new THREE.Mesh(tag(new THREE.BoxGeometry(12, 3.4, 8), N + 1), darkGlass)
  pav.position.set(-7, TOP_Y + 2.3, -3)
  const poolMesh = new THREE.Mesh(tag(new THREE.BoxGeometry(16, 0.25, 5), N + 1), darkGlass)
  poolMesh.material = pool
  poolMesh.position.set(5, TOP_Y + 0.72, 4)
  poolMesh.geometry.setAttribute('aFloor', new THREE.BufferAttribute(new Float32Array(poolMesh.geometry.attributes.position.count).fill(N + 1), 1))
  // pool uses its own plain material → must not read aFloor, nothing to patch
  for (const m of [crownTop, halo1, halo2, pav]) {
    m.castShadow = true
    crown.add(m)
  }
  crown.add(poolMesh)
  root.add(crown)
  shadowCasters.push(crownTop, halo1, halo2, pav)

  /* --------------------------------- invisible picking --------------------------------- */
  const pickVolume = new THREE.Mesh(new THREE.BoxGeometry(PW + 2, N * FH, PD + 2), new THREE.MeshBasicMaterial())
  pickVolume.position.y = podiumH + (N * FH) / 2
  pickVolume.visible = false
  root.add(pickVolume)

  /* ------------------------------- view-state control ------------------------------- */
  const _tmp = { iso: -1 }
  function setView({ floor, isolate = 0, lift = 0 }) {
    U.uSel.value = floor ?? -1
    U.uHide.value = isolate
    U.uGhostUp.value = THREE.MathUtils.lerp(1, 0.11, isolate)
    U.uGhostDown.value = THREE.MathUtils.lerp(1, 0.26, isolate)
    U.uLift.value = LIFT * lift
    U.uHi.value = floor != null ? 1 - isolate : 0
    U.uRange.value = isolate > 0.98 ? 8 : 100
    const opaque = isolate < 0.02
    for (const m of mats) m.depthWrite = opaque && m !== railGlass
    if (opaque !== (_tmp.iso === 0)) {
      // shadows from the whole tower only while it is whole; ghosted floors must not shade the cutaway
      for (const m of shadowCasters) m.castShadow = opaque
      _tmp.iso = opaque ? 0 : 1
    }
  }
  setView({ floor: null })

  return { root, setView, pickVolume, mats }
}
