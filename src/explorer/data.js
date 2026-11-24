/*
 * THE AURELLE GOLD — residence explorer data model.
 *
 * An ILLUSTRATIVE demonstration tower (no architectural plans exist). Everything here is
 * design intent kept internally consistent: areas are computed from the same rectangles the
 * 3D geometry is built from, and every floor shares one typical plan with four apartments.
 *
 * World frame (metres): x west(-)→east(+), z north(-)→south(+, the Gulf side), y up.
 * Apartment frame (u, v): origin at the apartment's outer corner, u runs along the long
 * facade into the plan, v runs from the facade towards the shared corridor.
 */

export const TOWER = {
  w: 44,
  d: 30,
  r: 7, // same corner ratio as the hero tower (r / w ≈ 0.17)
  floors: 40,
  floorH: 3.5,
  clear: 3.2, // finished floor → ceiling
  podiumH: 9,
  corridor: 2.4,
  core: 4.2, // half-width of the central lift / stair block
  depth: 13.8, // apartment depth: facade → corridor wall
}

export const floorBaseY = (f) => TOWER.podiumH + (f - 1) * TOWER.floorH
export const TOP_Y = TOWER.podiumH + TOWER.floors * TOWER.floorH
export const LIFT = 8 * TOWER.floorH // floors above the selection rise by whole storeys
export const CORNER_CUT = 10.5 // m² lost to the curved glass corner (r = 7): r²(1 − π/4)

export const TIERS = [
  { from: 1, to: 12, name: 'Park Residences', note: 'Treetop terraces above the landscaped podium.' },
  { from: 13, to: 26, name: 'Skyline Residences', note: 'Eye-level with the surrounding towers.' },
  { from: 27, to: 40, name: 'Sky Residences', note: 'Above the city, with the Gulf on the horizon.' },
]
export const tierOf = (f) => TIERS.find((t) => f >= t.from && f <= t.to)

const area = ([u0, u1, v0, v1]) => +((u1 - u0) * (v1 - v0)).toFixed(1)

/* ------------------------------ apartment layout ------------------------------ */
export function layoutFor(W) {
  const D = TOWER.depth
  const L = 9.0 + (W - 17.8) * 0.55 // living width
  const Dw = 4.6 // dining width
  const M = 7.2 + (W - 17.8) * 0.5 // master bedroom width
  const K0 = M + 3.2 // kitchen west
  const K1 = W - 3.0 // kitchen east
  const rect = {
    living: [0, L, 0, 6.2],
    dining: [L, L + Dw, 0, 6.2],
    bedroom2: [L + Dw, W, 0, 6.2],
    master: [0, M, 6.2, 11.4],
    mbath: [M, M + 3.2, 6.2, 11.4],
    kitchen: [K0, K1, 6.2, 11.4],
    bath2: [K1, W, 6.2, 9.2],
    pantry: [K1, W, 9.2, 11.4],
    gallery: [0, W, 11.4, D],
  }
  const balU = [7.3, L + Dw - 0.5] // balcony span along the facade (straight part only)
  rect.balcony = [balU[0], balU[1], -3.2, 0]
  const E = W - 2.0 // entrance door centre
  const ov0 = Math.max(L, K0) + 0.5 // kitchen ⇄ dining opening
  const ov1 = Math.min(L + Dw, K1) - 0.5
  return { W, D, L, Dw, M, K0, K1, E, rect, balU, ov0, ov1 }
}

/** Walls (thickness 0.15–0.2) as runs with gaps; `along:'u'` runs along u at fixed v. */
export function wallsFor(Lyt) {
  const { W, D, M, K0, K1, L, Dw, E, ov0, ov1 } = Lyt
  return [
    // party wall to the core / neighbour
    { along: 'v', at: W, from: 0, to: D, gaps: [], t: 0.2 },
    // corridor wall with the entrance door
    { along: 'u', at: D, from: 0, to: W, gaps: [[E - 0.65, E + 0.65]], t: 0.2 },
    // front band | middle band
    { along: 'u', at: 6.2, from: 0, to: W, gaps: [[M - 1.5, M - 0.5], [ov0, ov1], [K1 + 0.9, K1 + 1.9]], t: 0.15 },
    // middle band | gallery
    { along: 'u', at: 11.4, from: 0, to: W, gaps: [[M - 2.1, M - 1.0], [K0 + 0.6, K1 - 0.6], [K1 + 0.8, K1 + 1.8]], t: 0.15 },
    // master | ensuite
    { along: 'v', at: M, from: 6.2, to: 11.4, gaps: [[7.0, 8.1]], t: 0.15 },
    // ensuite | kitchen
    { along: 'v', at: M + 3.2, from: 6.2, to: 11.4, gaps: [], t: 0.15 },
    // kitchen | bath 2 + pantry
    { along: 'v', at: K1, from: 6.2, to: 11.4, gaps: [], t: 0.15 },
    // bath 2 | pantry
    { along: 'u', at: 9.2, from: K1, to: W, gaps: [], t: 0.15 },
    // dining | bedroom 2
    { along: 'v', at: L + Dw, from: 0, to: 6.2, gaps: [[2.3, 3.4]], t: 0.15 },
  ]
}

const ROOM_META = {
  living: { name: 'Living Room', nav: 'Living', kind: 'living' },
  dining: { name: 'Dining', nav: 'Dining', kind: 'dining' },
  kitchen: { name: 'Kitchen', nav: 'Kitchen', kind: 'kitchen' },
  gallery: { name: 'Entrance Gallery', nav: 'Entrance', kind: 'hall' },
  master: { name: 'Master Bedroom', nav: 'Master', kind: 'bedroom' },
  mbath: { name: 'Master Bathroom', nav: 'Ensuite', kind: 'bath' },
  bedroom2: { name: 'Second Bedroom', nav: 'Bedroom 2', kind: 'bedroom' },
  bath2: { name: 'Second Bathroom', nav: 'Bath 2', kind: 'bath' },
  pantry: { name: 'Pantry & Laundry', nav: 'Pantry', kind: 'service' },
  balcony: { name: 'Balcony', nav: 'Balcony', kind: 'balcony' },
}

const TEXT = {
  living: (a) => `A double-aspect salon wrapped in curved floor-to-ceiling glass, with ${a.view.toLowerCase()} beyond the terrace.`,
  dining: () => 'A dining room for ten under a brass linear pendant, open to the salon and the balcony.',
  kitchen: (a) => `A chef’s kitchen in ${a.finish} with a waterfall marble island and fully integrated appliances.`,
  gallery: () => 'A private entrance gallery lined with art, leading to the kitchen, bedrooms and pantry.',
  master: () => 'A calm principal suite with a channel-tufted headboard, fluted wardrobes and glass to the floor.',
  mbath: () => 'Honed marble from floor to ceiling, a freestanding tub, rain shower and twin floating vanity.',
  bedroom2: () => 'A generous second bedroom with its own ensuite and an uninterrupted facade view.',
  bath2: () => 'A compact marble bathroom with a frameless walk-in shower and a stone vanity.',
  pantry: () => 'A concealed pantry and laundry room with panelled storage.',
  balcony: (a) => `A ${a.balcony} m² balcony with glass balustrades, lounge seating and ${a.view.toLowerCase()}.`,
}

/* ------------------------------ the four apartments ------------------------------ */
const APT_DEFS = [
  { id: 'A', name: 'Skyline Residence', type: '2 Bedroom', W: 17.8, origin: [-22, -15], sx: 1, sz: 1, palette: 'oak', view: 'Downtown skyline and the supertall spire', finish: 'pale oak and Calacatta stone', facing: 'north' },
  { id: 'B', name: 'Boulevard Residence', type: '2 Bedroom', W: 17.8, origin: [22, -15], sx: -1, sz: 1, palette: 'walnut', view: 'The Downtown boulevard and lake', finish: 'walnut and white marble', facing: 'north' },
  { id: 'C', name: 'Gulf Residence', type: 'Grand 2 Bedroom', W: 22, origin: [-22, 15], sx: 1, sz: -1, palette: 'travertine', view: 'The Arabian Gulf and Palm Jumeirah', finish: 'travertine and bronze', facing: 'south' },
  { id: 'D', name: 'Marina Residence', type: 'Grand 2 Bedroom', W: 22, origin: [22, 15], sx: -1, sz: -1, palette: 'oak', view: 'The Gulf horizon and marina', finish: 'oak and honed stone', facing: 'south' },
]

export const apartments = APT_DEFS.map((def) => {
  const lyt = layoutFor(def.W)
  const rooms = Object.entries(lyt.rect).map(([id, rect]) => {
    const meta = ROOM_META[id]
    let a = area(rect)
    if (id === 'living') a = +(a - CORNER_CUT).toFixed(1)
    return { id, ...meta, rect, area: a }
  })
  const balconyArea = rooms.find((r) => r.id === 'balcony').area
  const info = { view: def.view, finish: def.finish, balcony: Math.round(balconyArea) }
  rooms.forEach((r) => (r.desc = TEXT[r.id](info)))
  const interior = rooms.filter((r) => r.id !== 'balcony').reduce((s, r) => s + r.area, 0)
  // local (u, v) → world (x, z)
  const toWorld = (u, v) => [def.origin[0] + def.sx * u, def.origin[1] + def.sz * v]
  const [cx, cz] = toWorld(lyt.W / 2, lyt.D / 2)
  return { ...def, lyt, rooms, interior: Math.round(interior), balconyArea: Math.round(balconyArea), toWorld, center: [cx, cz], walls: wallsFor(lyt) }
})
export const aptById = (id) => apartments.find((a) => a.id === id)

/** Residence number, e.g. floor 28 apartment D → "2804". */
export const unitNo = (floor, id) => `${floor}0${'ABCD'.indexOf(id) + 1}`

/** Room viewpoints for free exploration (local u, eye height, v) → look target. */
export function roomView(apt, roomId) {
  const { W, L, Dw, M, K0, K1, E } = apt.lyt
  const h = 1.6
  switch (roomId) {
    case 'living': return { eye: [L - 0.9, h, 3.3], look: [1.2, 1.15, 2.3] }
    case 'dining': return { eye: [L + Dw - 0.7, h, 5.5], look: [L + 0.9, 0.95, 1.8] }
    case 'kitchen': return { eye: [K0 + 1.45, h, 10.9], look: [K0 + 2.6, 1.0, 7.4] }
    case 'gallery': return { eye: [E - 1.2, h, 12.6], look: [2.0, 1.4, 12.6] }
    case 'master': return { eye: [M - 0.8, h, 10.8], look: [1.5, 0.9, 7.2] }
    case 'mbath': return { eye: [M + 1.6, 6.6, 6.5], look: [M + 1.6, 0, 8.9], fov: 70 }
    case 'bedroom2': return { eye: [L + Dw + 0.8, h, 5.4], look: [W - 0.6, 1.0, 2.2] }
    case 'bath2': return { eye: [K1 + 1.5, 5.8, 6.6], look: [K1 + 1.5, 0, 7.8], fov: 70 }
    case 'pantry': return { eye: [K1 + 0.5, h, 11.0], look: [W - 0.4, 1.0, 9.8] }
    case 'balcony': { const c = (apt.lyt.balU[0] + apt.lyt.balU[1]) / 2; return { eye: [c + 0.6, 1.7, 3.4], look: [c + 0.1, 0.8, -2.2], fov: 66 } }
    default: return { eye: [W / 2, h, 11], look: [W / 2, 1, 5] }
  }
}

/* ------------------------------ guided tour (local poses) ------------------------------ */
/** Poses inside one apartment. `dwell` seconds = a stop; dwell 0 = a pass-through waypoint. */
export function interiorStops(apt) {
  const { W, L, Dw, M, K0, K1, E, ov0, ov1 } = apt.lyt
  const ky = K0 + 1.45 // kitchen aisle between worktop and island
  const dm = (ov0 + ov1) / 2
  const R = (id) => apt.rooms.find((r) => r.id === id)
  return [
    { id: 'arrival', title: 'Arrival', desc: 'A private lift lobby and a single front door — one residence per entrance.', dur: 6.5, dwell: 1.6, eye: [E, 1.62, 15.9], look: [E, 1.35, 11.5], fov: 56 },
    { id: 'door', dur: 2.6, dwell: 0, eye: [E - 0.1, 1.62, 13.0], look: [E - 2.6, 1.3, 9.2], fov: 64 },
    { id: 'entrance', room: 'gallery', title: 'Entrance Gallery', desc: R('gallery').desc, dur: 2.2, dwell: 2.0, eye: [E - 1.5, 1.62, 12.5], look: [ky + 0.3, 1.3, 7.2], fov: 64 },
    { id: 'pass-k', dur: 2.6, dwell: 0, eye: [ky, 1.62, 10.9], look: [ky, 1.3, 6.0], fov: 64 },
    { id: 'pass-d', dur: 2.6, dwell: 0, eye: [dm, 1.62, 6.8], look: [dm - 3, 1.3, 3.2], fov: 64 },
    { id: 'living', room: 'living', title: 'Living Room', desc: R('living').desc, dur: 3.6, dwell: 3.0, eye: [L - 0.6, 1.62, 3.5], look: [1.0, 1.25, 1.7], fov: 66 },
    { id: 'dining', room: 'dining', title: 'Dining', desc: R('dining').desc, dur: 2.8, dwell: 2.6, eye: [L + Dw - 0.8, 1.6, 5.35], look: [L + 0.8, 0.95, 1.6], fov: 64 },
    { id: 'kitchen', room: 'kitchen', title: 'Kitchen', desc: R('kitchen').desc, dur: 3.4, dwell: 2.8, eye: [ky, 1.58, 10.7], look: [K0 + 2.8, 1.0, 7.0], fov: 64 },
    { id: 'gallery-w', room: 'gallery', title: 'Corridor', desc: 'A gallery corridor leads to the private wing — bedrooms are kept quiet and apart from the entertaining spaces.', dur: 2.8, dwell: 1.4, eye: [M + 1.5, 1.62, 12.6], look: [1.5, 1.4, 12.6], fov: 64 },
    { id: 'master-door', dur: 2.2, dwell: 0, eye: [M - 1.55, 1.62, 11.9], look: [M - 3, 1.2, 9.2], fov: 64 },
    { id: 'master', room: 'master', title: 'Master Bedroom', desc: R('master').desc, dur: 2.2, dwell: 2.8, eye: [M - 0.9, 1.6, 10.5], look: [1.4, 0.95, 7.0], fov: 66 },
    { id: 'mbath', room: 'mbath', title: 'Master Bathroom', desc: R('mbath').desc, dur: 3.0, dwell: 2.8, eye: [M + 1.6, 6.6, 6.5], look: [M + 1.6, 0, 8.9], fov: 70 },
    { id: 'back-master', dur: 2.4, dwell: 0, eye: [M - 0.9, 1.62, 8.2], look: [M - 2.5, 1.2, 6.0], fov: 64 },
    { id: 'back-living', dur: 2.6, dwell: 0, eye: [M - 1.0, 1.62, 5.4], look: [M + 1.5, 1.2, 4.5], fov: 64 },
    { id: 'pass-d2', dur: 2.6, dwell: 0, eye: [L + 0.6, 1.62, 5.4], look: [L + Dw, 1.2, 3.0], fov: 64 },
    { id: 'bed2-door', dur: 2.0, dwell: 0, eye: [L + Dw - 0.7, 1.62, 3.0], look: [L + Dw + 2.2, 1.2, 2.8], fov: 64 },
    { id: 'bedroom2', room: 'bedroom2', title: 'Second Bedroom', desc: R('bedroom2').desc, dur: 2.0, dwell: 2.6, eye: [L + Dw + 0.9, 1.6, 4.9], look: [W - 0.5, 0.95, 2.4], fov: 66 },
    { id: 'bath2', room: 'bath2', title: 'Second Bathroom', desc: R('bath2').desc, dur: 2.8, dwell: 2.2, eye: [K1 + 1.5, 5.8, 6.6], look: [K1 + 1.5, 0, 7.8], fov: 70 },
    { id: 'back-bed2', dur: 2.6, dwell: 0, eye: [L + Dw + 1.2, 1.62, 3.6], look: [L + Dw - 1.5, 1.3, 3.0], fov: 64 },
    { id: 'back-dining', dur: 2.4, dwell: 0, eye: [L + 1.8, 1.62, 3.0], look: [dm - 1, 1.5, -0.5], fov: 64 },
    { id: 'balcony', room: 'balcony', title: 'Balcony', desc: R('balcony').desc, dur: 3.4, dwell: 5.0, eye: [(apt.lyt.balU[0] + apt.lyt.balU[1]) / 2 + 0.3, 1.62, -1.9], look: [(apt.lyt.balU[0] + apt.lyt.balU[1]) / 2 - 4, 1.75, -24], fov: 62 },
  ]
}
