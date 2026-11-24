import * as THREE from 'three'
import { canvasTexture, woodTexture, stoneTexture } from '../three/materials.js'
import { mulberry32 } from '../lib/random.js'

/*
 * Physically based material set for the Residence Explorer.
 * All textures are painted procedurally (no downloads); everything is cached and shared
 * across floors, so switching floors never re-creates textures.
 */

/** Calacatta-style marble: soft cloudy base + branching grey/gold veins. */
function marbleTexture(seed = 3, base = '#f4f1ec', vein = 'rgba(120,112,104,') {
  return canvasTexture(
    1024,
    1024,
    (g, w, h) => {
      const rnd = mulberry32(seed)
      g.fillStyle = base
      g.fillRect(0, 0, w, h)
      for (let i = 0; i < 40; i++) {
        g.fillStyle = `rgba(${200 + rnd() * 30},${195 + rnd() * 25},${185 + rnd() * 25},${0.05 + rnd() * 0.08})`
        g.beginPath()
        g.ellipse(rnd() * w, rnd() * h, 60 + rnd() * 260, 30 + rnd() * 120, rnd() * Math.PI, 0, Math.PI * 2)
        g.fill()
      }
      const veinPath = (x, y, len, width, alpha, depth) => {
        let a = -0.6 + rnd() * 1.2
        g.strokeStyle = `${vein}${alpha})`
        g.lineWidth = width
        g.lineCap = 'round'
        g.beginPath()
        g.moveTo(x, y)
        for (let s = 0; s < len; s++) {
          a += (rnd() - 0.5) * 0.35
          x += Math.cos(a) * 9
          y += Math.sin(a) * 9 + 3
          g.lineTo(x, y)
          if (depth < 2 && rnd() < 0.025) veinPath(x, y, len * 0.4, width * 0.55, alpha * 0.8, depth + 1)
        }
        g.stroke()
      }
      for (let i = 0; i < 7; i++) veinPath(rnd() * w, -20, 140, 1.2 + rnd() * 2.2, 0.35 + rnd() * 0.3, 0)
      g.strokeStyle = 'rgba(176,146,98,0.18)'
      g.lineWidth = 5
      for (let i = 0; i < 2; i++) {
        g.beginPath()
        g.moveTo(rnd() * w, 0)
        g.bezierCurveTo(rnd() * w, h * 0.3, rnd() * w, h * 0.7, rnd() * w, h)
        g.stroke()
      }
    },
    { repeat: [1, 1] }
  )
}

/** Fine woven fabric normal map — gives upholstery a real textile response. */
function weaveNormal() {
  return canvasTexture(
    256,
    256,
    (g, w, h) => {
      const img = g.createImageData(w, h)
      const rnd = mulberry32(8)
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4
          const warp = Math.sin((x / w) * Math.PI * 2 * 48) * 0.5
          const weft = Math.sin((y / h) * Math.PI * 2 * 48) * 0.5
          const n = (rnd() - 0.5) * 0.35
          img.data[i] = 128 + (warp + n) * 40
          img.data[i + 1] = 128 + (weft + n) * 40
          img.data[i + 2] = 255
          img.data[i + 3] = 255
        }
      g.putImageData(img, 0, 0)
    },
    { repeat: [6, 6], srgb: false }
  )
}

/** Large-format honed stone tiles (bathroom floors, terraces). */
function tileTexture(base, joint, tiles = 4) {
  return canvasTexture(
    512,
    512,
    (g, w, h) => {
      g.fillStyle = base
      g.fillRect(0, 0, w, h)
      const rnd = mulberry32(5)
      for (let i = 0; i < 160; i++) {
        g.fillStyle = `rgba(150,135,115,${rnd() * 0.05})`
        g.beginPath()
        g.ellipse(rnd() * w, rnd() * h, 10 + rnd() * 50, 6 + rnd() * 25, rnd() * 3, 0, Math.PI * 2)
        g.fill()
      }
      g.strokeStyle = joint
      g.lineWidth = 2
      for (let i = 0; i <= tiles; i++) {
        g.beginPath(); g.moveTo((i * w) / tiles, 0); g.lineTo((i * w) / tiles, h); g.stroke()
        g.beginPath(); g.moveTo(0, (i * h) / tiles); g.lineTo(w, (i * h) / tiles); g.stroke()
      }
    },
    { repeat: [1, 1] }
  )
}

let shared = null
function sharedSet() {
  if (shared) return shared
  const weave = weaveNormal()
  const fabric = (color, sheen = '#ffffff') =>
    new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.92,
      sheen: 0.7,
      sheenRoughness: 0.6,
      sheenColor: new THREE.Color(sheen),
      normalMap: weave,
      normalScale: new THREE.Vector2(0.35, 0.35),
    })
  const marbleMap = marbleTexture(3)
  const marbleBath = marbleMap.clone()
  marbleBath.repeat.set(0.85, 0.85)
  marbleBath.needsUpdate = true
  shared = {
    fabric,
    plaster: new THREE.MeshStandardMaterial({ color: '#f3eee6', roughness: 0.92 }),
    ceiling: new THREE.MeshStandardMaterial({ color: '#f7f3ec', roughness: 0.95 }),
    marble: new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: marbleMap, roughness: 0.18, clearcoat: 0.6, clearcoatRoughness: 0.15 }),
    marbleWall: new THREE.MeshStandardMaterial({ color: '#f1ebe2', map: marbleBath, roughness: 0.22 }),
    bathFloor: new THREE.MeshStandardMaterial({ color: '#ffffff', map: tileTexture('#e3ddd2', 'rgba(140,128,112,0.35)', 3), roughness: 0.4 }),
    terraceTile: new THREE.MeshStandardMaterial({ color: '#ffffff', map: tileTexture('#e6dccb', 'rgba(120,108,92,0.4)', 4), roughness: 0.75 }),
    chrome: new THREE.MeshStandardMaterial({ color: '#f2f2f2', metalness: 1, roughness: 0.08 }),
    brass: new THREE.MeshStandardMaterial({ color: '#c3a170', metalness: 1, roughness: 0.25 }),
    bronze: new THREE.MeshStandardMaterial({ color: '#7a5c3e', metalness: 0.9, roughness: 0.35 }),
    steel: new THREE.MeshStandardMaterial({ color: '#c9cbcc', metalness: 0.9, roughness: 0.35 }),
    blackGlass: new THREE.MeshStandardMaterial({ color: '#141516', metalness: 0.4, roughness: 0.06 }),
    mirror: new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 1, roughness: 0.02 }),
    ceramic: new THREE.MeshPhysicalMaterial({ color: '#f8f6f1', roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: '#e9f0f0',
      roughness: 0.02,
      metalness: 0,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      envMapIntensity: 1.3,
      side: THREE.DoubleSide,
    }),
    showerGlass: new THREE.MeshPhysicalMaterial({
      color: '#eef4f4',
      roughness: 0.04,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      envMapIntensity: 1.5,
      side: THREE.DoubleSide,
    }),
    leather: new THREE.MeshPhysicalMaterial({ color: '#8a5a3b', roughness: 0.5, clearcoat: 0.25, clearcoatRoughness: 0.5 }),
    linen: fabric('#f6f2ea'),
    duvet: fabric('#f3eee4'),
    towel: fabric('#efe8dc'),
    rug: new THREE.MeshStandardMaterial({ color: '#d8ccb8', roughness: 1, normalMap: weave, normalScale: new THREE.Vector2(0.6, 0.6) }),
    leaf: new THREE.MeshStandardMaterial({ color: '#4d6236', roughness: 0.72, side: THREE.DoubleSide }),
    soil: new THREE.MeshStandardMaterial({ color: '#4a3b2d', roughness: 1 }),
    stoneDark: new THREE.MeshStandardMaterial({ color: '#3b3734', roughness: 0.42 }),
    lampShade: new THREE.MeshStandardMaterial({ color: '#f6efe2', emissive: '#ffd9a8', emissiveIntensity: 0.55, roughness: 0.9, side: THREE.DoubleSide }),
    bulbWarm: new THREE.MeshStandardMaterial({ color: '#fff3dd', emissive: '#ffcf96', emissiveIntensity: 1.6 }),
    cove: new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#ffd6a3', emissiveIntensity: 1.25 }),
    doorPanel: null, // set per palette
    pick: new THREE.MeshBasicMaterial({ color: '#d8c3a5', transparent: true, opacity: 0, depthWrite: false }),
    pickHover: new THREE.MeshBasicMaterial({ color: '#d8c3a5', transparent: true, opacity: 0.22, depthWrite: false }),
    pickActive: new THREE.MeshBasicMaterial({ color: '#c49a6c', transparent: true, opacity: 0.3, depthWrite: false }),
    outline: new THREE.LineBasicMaterial({ color: '#b8915f', transparent: true, opacity: 0.95 }),
  }
  return shared
}

const PALETTES = {
  oak: { floor: '#cba57d', joinery: '#c49b72', sofa: '#d9ccb6', accent: '#a5b2a0', chair: '#e3d8c6', bed: '#d8c8b0', stone: '#e8dcc8' },
  walnut: { floor: '#b88e66', joinery: '#6b4a33', sofa: '#a9b4a0', accent: '#d9c8ae', chair: '#d9c8ae', bed: '#b9c2b0', stone: '#e2d4bd' },
  travertine: { floor: '#d4c2a6', joinery: '#5b4636', sofa: '#e5ddd0', accent: '#4a4f50', chair: '#3f4446', bed: '#cfc3b2', stone: '#e4d6c0' },
}

const paletteCache = {}
export function explorerMaterials(palette = 'oak') {
  if (paletteCache[palette]) return paletteCache[palette]
  const s = sharedSet()
  const p = PALETTES[palette]
  const floorWood = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.48, map: woodTexture(p.floor, [10, 6]) })
  const joinery = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5, map: woodTexture(p.joinery, [1, 1]) })
  const set = {
    ...s,
    floorWood,
    joinery,
    stone: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.62, map: stoneTexture(p.stone, [1, 1]) }),
    sofa: s.fabric(p.sofa),
    accent: s.fabric(p.accent),
    chair: s.fabric(p.chair),
    bed: s.fabric(p.bed),
    deck: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.75, map: woodTexture('#9a6f4b', [8, 2]) }),
    doorPanel: joinery,
  }
  paletteCache[palette] = set
  return set
}

/** Materials created by the explorer that must never be disposed with a floor. */
export function isSharedMaterial(m) {
  if (!shared) return false
  if (Object.values(shared).includes(m)) return true
  return Object.values(paletteCache).some((set) => Object.values(set).includes(m))
}
