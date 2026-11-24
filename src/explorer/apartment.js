import * as THREE from 'three'
import { TOWER } from './data.js'
import { explorerMaterials } from './materials.js'
import * as F from './furniture.js'
import { mergeStatic } from './merge.js'

const CLEAR = TOWER.clear

/** Wall run along `along` at fixed `at`, from→to, with gaps (door openings + lintels). */
function run(g, mat, along, at, from, to, gaps = [], t = 0.15, h = CLEAR, y0 = 0, lintelTop = true) {
  const cuts = gaps.filter(([a, b]) => b > from && a < to).sort((p, q) => p[0] - q[0])
  let a = from
  const seg = (s, e, yy = y0, hh = h) => {
    if (e - s < 0.02 || hh < 0.02) return
    const len = e - s
    const c = (s + e) / 2
    if (along === 'u') F.rb(g, len, hh, t, mat, c, yy, at, 0)
    else F.rb(g, t, hh, len, mat, at, yy, c, 0)
  }
  for (const [s, e] of cuts) {
    seg(a, Math.max(a, s))
    if (lintelTop) seg(s, e, y0 + 2.45, h - 2.45)
    a = e
  }
  seg(a, to)
}

/** Interior door leaf + frame centred in a wall gap. */
function doorAt(g, M, along, at, c, width, ajar) {
  const d = F.door(M, width - 0.1, 2.4, ajar)
  d.position.set(along === 'u' ? c : at, 0, along === 'u' ? at : c)
  d.rotation.y = along === 'u' ? 0 : Math.PI / 2
  g.add(d)
}

const put = (g, obj, u, v, yaw = 0, y = 0) => {
  obj.position.set(u, y, v)
  obj.rotation.y = yaw
  g.add(obj)
  return obj
}

/**
 * One fully furnished apartment in its local (u, v) frame: x = u, z = v, y up.
 * All static meshes are merged per material. Returns { group, picks }.
 */
export function buildApartment(apt, { rich = true } = {}) {
  const M = explorerMaterials(apt.palette)
  const { W, D, L, Dw, M: Mw, K0, K1, E, ov0, ov1, rect, balU } = apt.lyt
  const g = new THREE.Group()
  g.name = `apt-${apt.id}`
  const R = rect
  const mid = (r) => [(r[0] + r[1]) / 2, (r[2] + r[3]) / 2]

  /* ---------------- walls, openings, doors ---------------- */
  for (const w of apt.walls) run(g, M.plaster, w.along, w.at, w.from, w.to, w.gaps, w.t)
  for (const w of apt.walls) {
    w.gaps.forEach(([a, b], i) => {
      const c = (a + b) / 2
      const entrance = w.along === 'u' && w.at === D
      const wide = b - a > 1.5 // wide openings stay open (kitchen ⇄ dining / gallery)
      if (wide) return
      doorAt(g, M, w.along, w.at, c, b - a, entrance ? -1.5 : i % 2 ? 0.7 : 1.1)
    })
  }

  /* ---------------- floor finishes ---------------- */
  const floorPatch = (r, mat, y = 0, h = 0.025) => {
    const [cx, cz] = mid(r)
    F.rb(g, r[1] - r[0] - 0.12, h, r[3] - r[2] - 0.12, mat, cx, y, cz, 0.003, { cast: false })
  }
  floorPatch(R.kitchen, M.stone)
  floorPatch(R.gallery, M.stone)
  floorPatch(R.pantry, M.stone)
  floorPatch(R.mbath, M.bathFloor, 0, 0.03)
  floorPatch(R.bath2, M.bathFloor, 0, 0.03)
  // balcony deck over the structural slab
  const bc = (balU[0] + balU[1]) / 2
  const bw = balU[1] - balU[0]
  F.rb(g, bw, 0.04, 3.1, apt.palette === 'travertine' ? M.terraceTile : M.deck, bc, 0, -1.55, 0.004, { cast: false })

  /* ---------------- marble lining in the bathrooms ---------------- */
  const lining = (r, sides) => {
    const o = 0.095
    const [u0, u1, v0, v1] = r
    for (const w of apt.walls) {
      const hit = (along, at) => w.along === along && Math.abs(w.at - at) < 1e-6
      if (sides.includes('n') && hit('u', v0)) run(g, M.marbleWall, 'u', v0 + o, Math.max(u0 + 0.1, w.from), Math.min(u1 - 0.1, w.to), w.gaps, 0.02, CLEAR - 0.05, 0.02, false)
      if (sides.includes('s') && hit('u', v1)) run(g, M.marbleWall, 'u', v1 - o, Math.max(u0 + 0.1, w.from), Math.min(u1 - 0.1, w.to), w.gaps, 0.02, CLEAR - 0.05, 0.02, false)
      if (sides.includes('w') && hit('v', u0)) run(g, M.marbleWall, 'v', u0 + o, Math.max(v0 + 0.1, w.from), Math.min(v1 - 0.1, w.to), w.gaps, 0.02, CLEAR - 0.05, 0.02, false)
      if (sides.includes('e') && hit('v', u1)) run(g, M.marbleWall, 'v', u1 - o, Math.max(v0 + 0.1, w.from), Math.min(v1 - 0.1, w.to), w.gaps, 0.02, CLEAR - 0.05, 0.02, false)
    }
  }
  lining(R.mbath, 'nswe')
  lining(R.bath2, 'nswe')

  /* ---------------- living ---------------- */
  put(g, F.rug(M, 5.4, 3.8), 4.3, 3.5)
  put(g, F.sofa(M, { len: 3.8 }), 4.3, 5.3, Math.PI)
  put(g, F.coffeeTables(M), 4.3, 3.35)
  put(g, F.armchair(M), 1.8, 2.9, Math.PI / 2)
  put(g, F.armchair(M), 6.7, 1.7, 0)
  put(g, F.arcLamp(M), 0.95, 5.35, 0)
  put(g, F.plant(M, 1.1, 2), 7.7, 0.75)
  put(g, F.artwork(M, 1.9, 1.2, 11 + apt.id.charCodeAt(0), '#c49a6c'), 4.3, 6.07, Math.PI, 1.15)
  if (L > 10) {
    put(g, F.credenza(M, 2.4), L - 3.2, 5.92, Math.PI)
    put(g, F.armchair(M, M.accent), 8.6, 1.9, -0.4)
  }
  if (rich) put(g, F.sheer(M, 1.7, CLEAR - 0.1), 7.0, 0.45, 0)

  /* ---------------- dining ---------------- */
  const dx = L + 2.3
  put(g, F.diningTable(M, 3.0), dx, 2.9, Math.PI / 2)
  for (const v of [1.9, 2.9, 3.9]) {
    put(g, F.diningChair(M), dx - 0.88, v, Math.PI / 2)
    put(g, F.diningChair(M), dx + 0.88, v, -Math.PI / 2)
  }
  put(g, F.diningChair(M), dx, 1.05, 0)
  put(g, F.diningChair(M), dx, 4.75, Math.PI)
  put(g, F.pendantLinear(M, 2.4, 1.15, CLEAR), dx, 2.9, Math.PI / 2)
  F.vase(g, M, dx, 0.76, 2.5, 1.5, M.stone)
  put(g, F.artwork(M, 1.5, 1.0, 21 + apt.id.charCodeAt(0), '#a5b2a0'), L + 0.95, 6.07, Math.PI, 1.2)
  put(g, F.plant(M, 0.95, 4), L + Dw - 0.45, 5.7)

  /* ---------------- kitchen ---------------- */
  put(g, F.kitchenRun(M, 5.0), K0 + 0.31, 8.8, Math.PI / 2)
  const island = K1 - 1.5
  put(g, F.kitchenIsland(M, 2.8, 1.2, apt.palette === 'travertine' ? M.stone : M.marble), island, 8.8, Math.PI / 2)
  for (const v of [8.0, 8.8, 9.6]) put(g, F.barStool(M), island + 0.95, v, -Math.PI / 2)
  put(g, F.pendantGlobes(M, 3, 0.85, 1.1, CLEAR), island, 8.8, Math.PI / 2)

  /* ---------------- gallery & entrance ---------------- */
  put(g, F.rug(M, 6.2, 1.3), 6.2, 12.6)
  put(g, F.credenza(M, 1.7), E - 2.5, 13.55, Math.PI)
  put(g, F.artwork(M, 0.9, 1.4, 31 + apt.id.charCodeAt(0), '#c49a6c'), E - 2.5, 13.72, Math.PI, 1.15)
  put(g, F.plant(M, 0.9, 9), E + 1.35, 13.2)
  put(g, F.bench(M, 1.6), 3.4, 13.45, Math.PI)
  put(g, F.sconce(M), 3.0, 11.47, 0, 1.45)
  put(g, F.sconce(M), 6.0, 11.47, 0, 1.45)
  put(g, F.artwork(M, 1.0, 1.3, 41 + apt.id.charCodeAt(0), '#8a6a4a'), 1.6, 11.56, 0, 1.1)

  /* ---------------- master suite ---------------- */
  const mx = Mw / 2
  put(g, F.rug(M, 4.2, 3.4), mx, 8.7)
  put(g, F.bed(M, { w: 2.0, l: 2.2 }), mx, 7.5, 0)
  put(g, F.nightstand(M), mx - 1.75, 6.58)
  put(g, F.nightstand(M), mx + 1.75, 6.58)
  put(g, F.sconce(M), mx - 1.75, 6.3, 0, 1.2)
  put(g, F.sconce(M), mx + 1.75, 6.3, 0, 1.2)
  put(g, F.bench(M, 1.7), mx, 9.15, 0)
  put(g, F.wardrobe(M, 3.0, 2.7), 2.5, 11.09, Math.PI)
  put(g, F.armchair(M, M.accent), 0.95, 9.9, Math.PI / 2)
  put(g, F.plant(M, 0.85, 12), 0.6, 6.7)
  if (rich) put(g, F.sheer(M, 1.8, CLEAR - 0.1), 0.45, 8.7, Math.PI / 2)

  /* ---------------- master bathroom ---------------- */
  put(g, F.bathtub(M), Mw + 1.6, 7.3, 0)
  put(g, F.walkInShower(M, 1.9, 2.2), Mw + 2.25, 10.2, 0)
  put(g, F.vanity(M, 1.8), Mw + 2.9, 8.2, -Math.PI / 2)
  put(g, F.wc(M), Mw + 0.5, 10.2, Math.PI / 2)
  put(g, F.towelRail(M), Mw + 0.45, 9.0, Math.PI / 2)

  /* ---------------- second bedroom ---------------- */
  const b0 = L + Dw
  put(g, F.rug(M, 3.0, 2.8), W - 3.0, 3.1)
  put(g, F.bed(M, { w: 1.8, l: 2.1, fabric: M.accent }), W - 1.5, 3.1, -Math.PI / 2)
  put(g, F.nightstand(M), W - 0.42, 1.55, -Math.PI / 2)
  put(g, F.nightstand(M), W - 0.42, 4.65, -Math.PI / 2)
  put(g, F.wardrobe(M, 1.7, 2.6), b0 + 1.2, 5.89, Math.PI)
  put(g, F.armchair(M), b0 + 0.75, 1.0, 0.5)
  put(g, F.plant(M, 0.8, 13), b0 + 0.45, 3.6)
  if (rich) put(g, F.sheer(M, 1.6, CLEAR - 0.1), b0 + 2.6, 0.25, 0)

  /* ---------------- second bathroom ---------------- */
  put(g, F.walkInShower(M, 1.5, 1.7), W - 0.85, 8.3, 0)
  put(g, F.vanity(M, 1.4), K1 + 0.3, 7.3, Math.PI / 2)
  put(g, F.wc(M), K1 + 0.45, 8.75, Math.PI / 2)

  /* ---------------- pantry & laundry ---------------- */
  F.rb(g, 0.5, 2.4, 1.9, M.joinery, W - 0.35, 0, 10.3, 0.006)
  F.rb(g, 0.6, 0.85, 0.6, M.steel, K1 + 0.5, 0, 10.9, 0.03)
  F.rb(g, 0.6, 0.85, 0.6, M.steel, K1 + 0.5, 0.9, 10.9, 0.03)
  F.rb(g, 1.4, 0.9, 0.6, M.joinery, K1 + 1.6, 0, 11.05, 0.006)
  F.rb(g, 1.45, 0.04, 0.64, M.marble, K1 + 1.6, 0.9, 11.05, 0.004)

  /* ---------------- balcony ---------------- */
  put(g, F.outdoorSofa(M, 2.6), bc - 1.4, -0.95, Math.PI)
  const table = new THREE.Group()
  F.cyl(table, 0.42, 0.42, 0.04, M.stone, 0, 0.38, 0, 40)
  F.cyl(table, 0.05, 0.05, 0.4, M.brass, 0, 0, 0, 12)
  F.cyl(table, 0.22, 0.24, 0.02, M.brass, 0, 0, 0, 24)
  put(g, table, bc - 1.4, -2.15)
  put(g, F.lounger(M), bc + 1.1, -1.7, Math.PI)
  put(g, F.lounger(M), bc + 2.2, -1.7, Math.PI)
  put(g, F.planterOlive(M, 0.75, apt.id.charCodeAt(0)), balU[0] + 0.4, -2.75)
  put(g, F.planterOlive(M, 0.7, apt.id.charCodeAt(0) + 3), balU[1] - 0.4, -2.75)

  /* ---------------- bake static geometry ---------------- */
  mergeStatic(g)

  /* ---------------- pick surfaces (not merged) ---------------- */
  const picks = new THREE.Group()
  picks.name = 'picks'
  const pickMat = M.pick
  for (const room of apt.rooms) {
    const [u0, u1, v0, v1] = room.rect
    const p = new THREE.Mesh(new THREE.PlaneGeometry(u1 - u0 - 0.1, v1 - v0 - 0.1), pickMat)
    p.rotation.x = -Math.PI / 2
    p.position.set((u0 + u1) / 2, 0.06, (v0 + v1) / 2)
    p.userData = { keep: true, pick: 'room', roomId: room.id, aptId: apt.id }
    p.renderOrder = 6
    picks.add(p)
  }
  g.add(picks)
  return { group: g, picks }
}
