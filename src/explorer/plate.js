import * as THREE from 'three'
import { TOWER, apartments } from './data.js'
import { explorerMaterials } from './materials.js'
import { buildApartment } from './apartment.js'
import { mergeStatic } from './merge.js'
import { roundedRectShape } from '../three/goldTower.js'
import * as F from './furniture.js'

const { w: PW, d: PD, r: PR, clear: CLEAR, corridor: CORR, core: CORE, depth: DEPTH } = TOWER
const Z_CORR = CORR / 2 // corridor spans z ∈ [-1.2, +1.2]

/** Outline of the typical floor in world (x, z), counter-clockwise seen from above. */
export function outlinePoints(inset = 0.06, spacing = 1.5) {
  const shape = roundedRectShape(PW - inset * 2, PD - inset * 2, PR - inset)
  const n = Math.max(8, Math.round(shape.getLength() / spacing))
  return shape.getSpacedPoints(n).slice(0, n).map((p) => new THREE.Vector2(p.x, -p.y))
}

/** Sutherland–Hodgman clip of a convex polygon against an axis-aligned rectangle. */
function clipToRect(poly, [x0, x1, z0, z1]) {
  const edges = [
    (p) => p.x >= x0, (p) => p.x <= x1, (p) => p.y >= z0, (p) => p.y <= z1,
  ]
  const cut = [
    (a, b) => new THREE.Vector2(x0, a.y + ((b.y - a.y) * (x0 - a.x)) / (b.x - a.x)),
    (a, b) => new THREE.Vector2(x1, a.y + ((b.y - a.y) * (x1 - a.x)) / (b.x - a.x)),
    (a, b) => new THREE.Vector2(a.x + ((b.x - a.x) * (z0 - a.y)) / (b.y - a.y), z0),
    (a, b) => new THREE.Vector2(a.x + ((b.x - a.x) * (z1 - a.y)) / (b.y - a.y), z1),
  ]
  let out = poly
  for (let e = 0; e < 4; e++) {
    const inp = out
    out = []
    for (let i = 0; i < inp.length; i++) {
      const a = inp[i]
      const b = inp[(i + 1) % inp.length]
      const ia = edges[e](a)
      const ib = edges[e](b)
      if (ia && ib) out.push(b)
      else if (ia && !ib) out.push(cut[e](a, b))
      else if (!ia && ib) out.push(cut[e](a, b), b)
    }
    if (!out.length) break
  }
  return out
}

/** Flat slab (top at y = top + depth) following `poly`, UVs in metres. */
function slabFrom(poly, depth, y) {
  const shape = new THREE.Shape(poly.map((p) => new THREE.Vector2(p.x, -p.y)))
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false })
  g.rotateX(-Math.PI / 2)
  g.translate(0, y, 0)
  return g
}

function woodFor(M) {
  const mat = M.floorWood.clone()
  mat.map = M.floorWood.map.clone()
  mat.map.repeat.set(0.42, 0.42) // ≈ 2.4 m per texture tile → natural plank width on metre-scaled UVs
  mat.map.needsUpdate = true
  mat.userData.ownsMaps = true
  return mat
}

const inst = (geo, mat, matrices, cast = false) => {
  const m = new THREE.InstancedMesh(geo, mat, matrices.length)
  matrices.forEach((mx, i) => m.setMatrixAt(i, mx))
  m.castShadow = cast
  m.receiveShadow = true
  m.userData.keep = true
  return m
}

export function buildPlateShell({ quality = 1, rich = true } = {}) {
  const M = explorerMaterials('oak')
  const root = new THREE.Group()
  root.name = 'plate'
  const arch = new THREE.Group() // everything static & architectural → merged
  root.add(arch)
  const outline = outlinePoints()
  const o = new THREE.Object3D()
  const mat4 = () => (o.updateMatrix(), o.matrix.clone())

  /* ------------------------------ floors ------------------------------ */
  // stone base over the whole plate (corridor, core, lobby)
  // own material: UVs here are in metres (tile 4 m → ≈ 1.3 m stone slabs), the shared one is for 0..1 UVs
  const baseMat = M.bathFloor.clone()
  baseMat.map = M.bathFloor.map.clone()
  baseMat.map.repeat.set(0.25, 0.25)
  baseMat.map.needsUpdate = true
  baseMat.userData.ownsMaps = true
  const base = new THREE.Mesh(slabFrom(outline, 0.02, -0.02), baseMat)
  base.receiveShadow = true
  base.name = 'base'
  arch.add(base)

  // per-apartment wood, clipped to the curved outline
  const woods = {}
  for (const apt of apartments) {
    const Mp = explorerMaterials(apt.palette)
    woods[apt.palette] ||= woodFor(Mp)
    const [x0, z0] = apt.toWorld(0, 0)
    const [x1, z1] = apt.toWorld(apt.lyt.W, apt.lyt.D)
    const rectW = [Math.min(x0, x1), Math.max(x0, x1), Math.min(z0, z1), Math.max(z0, z1)]
    const poly = clipToRect(outline, rectW)
    if (poly.length < 3) continue
    const wood = new THREE.Mesh(slabFrom(poly, 0.02, 0), woods[apt.palette])
    wood.receiveShadow = true
    arch.add(wood)
  }

  /* --------------------------- corridor & core --------------------------- */
  const ceilingH = CLEAR
  // corridor walls through the core block (apartment corridor walls cover the rest)
  const plaster = M.plaster
  // lift wall (z = -1.2) with two lift openings
  const liftW = 1.4
  const liftX = [-2.1, 2.1]
  const wallRun = (along, at, from, to, gaps = [], t = 0.2) => {
    let a = from
    const seg = (s, e, y0 = 0, h = CLEAR) => {
      if (e - s < 0.02) return
      const c = (s + e) / 2
      if (along === 'x') F.rb(arch, e - s, h, t, plaster, c, y0, at, 0)
      else F.rb(arch, t, h, e - s, plaster, at, y0, c, 0)
    }
    for (const [s, e] of [...gaps].sort((p, q) => p[0] - q[0])) {
      seg(a, s)
      seg(s, e, 2.45, CLEAR - 2.45)
      a = e
    }
    seg(a, to)
  }
  wallRun('x', -Z_CORR, -CORE, CORE, liftX.map((x) => [x - liftW / 2 - 0.05, x + liftW / 2 + 0.05]))
  // lift cars: bronze doors in frames + dark shafts behind
  for (const x of liftX) {
    F.rb(arch, liftW + 0.2, 2.5, 0.06, M.brass, x, 0, -Z_CORR + 0.02, 0.008)
    F.rb(arch, liftW / 2 - 0.02, 2.4, 0.04, M.bronze, x - liftW / 4, 0, -Z_CORR + 0.07, 0.006)
    F.rb(arch, liftW / 2 - 0.02, 2.4, 0.04, M.bronze, x + liftW / 4, 0, -Z_CORR + 0.07, 0.006)
    F.rb(arch, 0.1, 0.18, 0.03, M.brass, x + liftW / 2 + 0.3, 1.1, -Z_CORR + 0.06, 0.01)
    F.rb(arch, 2.5, CLEAR, 4.5, M.stone, x, 0, -Z_CORR - 2.5, 0.01)
  }
  // stair | service partition
  wallRun('x', -6.0, -CORE, CORE, [[-2.6, -1.4]])
  wallRun('z', 0, -PD / 2, -6.0, [[-9.9, -8.9]], 0.18)
  // stair (two flights + landing)
  const steps = []
  const stairGeo = new THREE.BoxGeometry(1.15, 0.17, 0.3)
  for (let i = 0; i < 10; i++) {
    o.position.set(-3.1, 0.085 + i * 0.175, -6.4 - i * 0.3)
    o.rotation.set(0, 0, 0)
    steps.push(mat4())
    o.position.set(-1.3, 1.835 + i * 0.175, -9.4 + i * 0.3)
    steps.push(mat4())
  }
  const stair = inst(stairGeo, M.stone, steps, true)
  root.add(stair)
  F.rb(arch, 3.9, 1.75, 2.4, M.stone, -2.2, 0, -11.2, 0.01) // half landing block
  F.rb(arch, 0.05, 1.0, 5.6, M.chrome, -3.75, 0.9, -9.0, 0.01)
  F.rb(arch, 0.05, 1.0, 5.6, M.chrome, -0.65, 1.8, -9.0, 0.01)
  // service & utility (risers, meters, sink)
  F.rb(arch, 0.7, 2.6, 6.5, M.joinery, CORE - 0.4, 0, -10.8, 0.006)
  F.rb(arch, 1.4, 0.9, 0.6, M.joinery, 1.6, 0, -14.6, 0.006)
  F.rb(arch, 1.45, 0.04, 0.64, M.marble, 1.6, 0.9, -14.6, 0.004)
  F.rb(arch, 0.6, 1.0, 0.6, M.steel, 3.1, 0, -7.0, 0.02)
  F.rb(arch, 1.0, 0.5, 0.5, M.bronze, 1.3, 0, -7.4, 0.02)

  /* ------------------------------ lobby decor ------------------------------ */
  F.rb(arch, 5.6, 0.02, CORR - 0.1, M.terraceTile, 0, 0, 0, 0.002, { cast: false })
  const bench = F.bench(M, 2.0, M.accent)
  bench.position.set(-3.4, 0, 0.75)
  arch.add(bench)
  const bench2 = F.bench(M, 2.0, M.accent)
  bench2.position.set(3.4, 0, 0.75)
  arch.add(bench2)
  for (const x of [-5.4, 5.4]) {
    const p = F.plant(M, 1.1, Math.abs(x))
    p.position.set(x, 0, 0.8)
    arch.add(p)
  }
  const art = F.artwork(M, 2.2, 1.3, 77, '#c49a6c')
  art.position.set(0, 1.0, -Z_CORR + 0.0)
  art.rotation.y = 0
  arch.add(art)
  for (const x of [-9.5, 9.5, 14.5, -14.5]) {
    const s = F.sconce(M)
    s.position.set(x, 1.5, -Z_CORR + 0.12)
    arch.add(s)
  }

  /* ----------------------------- curved facade glazing ----------------------------- */
  const spans = apartments.map((a) => {
    const [xa] = a.toWorld(a.lyt.balU[0], 0)
    const [xb] = a.toWorld(a.lyt.balU[1], 0)
    return { x0: Math.min(xa, xb), x1: Math.max(xa, xb), side: Math.sign(a.origin[1]) }
  })
  const inOpening = (mid) => spans.some((s) => mid.x > s.x0 - 0.02 && mid.x < s.x1 + 0.02 && Math.sign(mid.y) === s.side && Math.abs(mid.y) > PD / 2 - 1.0)
  const paneM = []
  const mullM = []
  const barM = []
  const n = outline.length
  for (let i = 0; i < n; i++) {
    const p = outline[i]
    const q = outline[(i + 1) % n]
    const dx = q.x - p.x
    const dz = q.y - p.y
    const len = Math.hypot(dx, dz)
    const mid = new THREE.Vector2((p.x + q.x) / 2, (p.y + q.y) / 2)
    const ang = Math.atan2(-dz, dx)
    if (!inOpening(mid)) {
      o.position.set(mid.x, CLEAR / 2, mid.y)
      o.rotation.set(0, ang, 0)
      o.scale.set(len, 1, 1)
      paneM.push(mat4())
      for (const yy of [0.03, CLEAR - 0.03]) {
        o.position.set(mid.x, yy, mid.y)
        o.scale.set(len, 1, 1)
        barM.push(mat4())
      }
      o.scale.set(1, 1, 1)
    }
    if (!inOpening(p)) {
      o.position.set(p.x, CLEAR / 2, p.y)
      o.rotation.set(0, ang, 0)
      o.scale.set(1, 1, 1)
      mullM.push(mat4())
    }
  }
  root.add(inst(new THREE.BoxGeometry(1, CLEAR, 0.02), M.glass, paneM))
  root.add(inst(new THREE.BoxGeometry(1, 0.06, 0.12), M.brass, barM, true))
  root.add(inst(new THREE.BoxGeometry(0.07, CLEAR, 0.12), M.brass, mullM, true))
  // sliding-door jambs at the balcony openings
  for (const s of spans) for (const x of [s.x0, s.x1]) F.rb(arch, 0.12, CLEAR, 0.16, M.brass, x, 0, s.side * (PD / 2 - 0.06), 0.01)

  mergeStatic(arch)
  root.updateMatrixWorld(true)

  /* ------------------------------ ceiling (hidden in cutaway) ------------------------------ */
  const ceiling = new THREE.Group()
  ceiling.name = 'ceiling'
  const cShape = new THREE.Shape(outline.map((p) => new THREE.Vector2(p.x, -p.y)))
  const cGeo = new THREE.ExtrudeGeometry(cShape, { depth: 0.1, bevelEnabled: false })
  cGeo.rotateX(-Math.PI / 2)
  const ceilMesh = new THREE.Mesh(cGeo, M.ceiling)
  ceilMesh.position.y = CLEAR
  ceilMesh.castShadow = true
  ceilMesh.receiveShadow = true
  ceiling.add(ceilMesh)
  const lights = []
  for (let x = -19.8; x <= 19.9; x += 3.6)
    for (let z = -12.6; z <= 12.7; z += 3.6) {
      if (Math.abs(z) < 0.2 && Math.abs(x) > 9) continue
      // keep downlights inside the curved outline
      const rx = Math.max(0, Math.abs(x) - (PW / 2 - PR))
      const rz = Math.max(0, Math.abs(z) - (PD / 2 - PR))
      if (Math.hypot(rx, rz) > PR - 0.8) continue
      o.position.set(x, CLEAR - 0.01, z)
      o.rotation.set(0, 0, 0)
      o.scale.set(1, 1, 1)
      lights.push(mat4())
    }
  ceiling.add(inst(new THREE.CylinderGeometry(0.07, 0.07, 0.012, 20), M.bulbWarm, lights))
  // warm cove along the corridor ceiling
  F.rb(ceiling, PW - 8, 0.03, 0.05, M.cove, 0, CLEAR - 0.02, 0.0, 0.004, { cast: false })
  root.add(ceiling)

  root.userData.woods = woods
  return { group: root, ceiling, arch, M }
}

/** Adds one apartment (merged geometry, mirrored by a holder group) to a plate built by buildPlateShell. */
export function addApartment(plate, apt, { rich = true } = {}) {
  const M = plate.M
  const built = buildApartment(apt, { rich })
  const holder = new THREE.Group() // carries the mirror so geometry stays untouched
  holder.name = `holder-${apt.id}`
  holder.position.set(apt.origin[0], 0, apt.origin[1])
  holder.scale.set(apt.sx, 1, apt.sz)
  holder.add(built.group)
  plate.group.add(holder)
  // whole-apartment pick surface for the floor view
  const L = apt.lyt
  const pick = new THREE.Mesh(new THREE.PlaneGeometry(L.W - 0.1, L.D - 0.1), M.pick)
  pick.rotation.x = -Math.PI / 2
  pick.position.set(L.W / 2, 0.08, L.D / 2)
  pick.userData = { keep: true, pick: 'apt', aptId: apt.id }
  pick.renderOrder = 6
  holder.add(pick)
  return { holder, group: built.group, picks: built.picks, pick }
}
