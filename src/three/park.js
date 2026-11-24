import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { materials } from './materials.js'
import { getFrondGeometry, getFrondMaterial } from './models.js'
import { mulberry32 } from '../lib/random.js'
import { roundedRectShape } from './goldTower.js'

/*
 * Landscaped park around the tower (metres): lawn, organic reflecting pond with
 * a stone rim, promenade paths, instanced broadleaf trees and date palms.
 * Every species is a single instanced draw call.
 */

function blobShape(rx, rz, seed, n = 48) {
  const rnd = mulberry32(seed)
  const k = [rnd() * 6, rnd() * 6, rnd() * 6]
  const pts = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const f = 1 + 0.08 * Math.sin(a * 2 + k[0]) + 0.05 * Math.sin(a * 3 + k[1]) + 0.03 * Math.sin(a * 5 + k[2])
    pts.push(new THREE.Vector2(Math.cos(a) * rx * f, Math.sin(a) * rz * f))
  }
  return new THREE.Shape(pts)
}

/** Broadleaf tree: tapered trunk + clustered, jittered canopy lobes, vertex-coloured. */
export function treeGeometry(seed) {
  const rnd = mulberry32(seed)
  const parts = []
  const trunk = new THREE.CylinderGeometry(0.16, 0.3, 3.2, 7).translate(0, 1.6, 0)
  paint(trunk, [0.33, 0.26, 0.2], 0.04, rnd)
  parts.push(trunk.toNonIndexed())
  const lobes = 5
  for (let i = 0; i < lobes; i++) {
    const r = 1.4 + rnd() * 0.9
    const lobe = new THREE.IcosahedronGeometry(r, 2)
    const p = lobe.attributes.position
    for (let v = 0; v < p.count; v++) {
      const x = p.getX(v)
      const y = p.getY(v)
      const z = p.getZ(v)
      const n = 1 + (Math.sin(x * 2.1 + seed) * Math.cos(z * 1.7 + i) + Math.sin(y * 2.9)) * 0.09
      p.setXYZ(v, x * n, y * n * 0.85, z * n)
    }
    const a = (i / lobes) * Math.PI * 2 + rnd()
    const off = i === 0 ? 0 : 1.1 + rnd() * 0.5
    lobe.translate(Math.cos(a) * off, 3.6 + rnd() * 1.4 + (i === 0 ? 1 : 0), Math.sin(a) * off)
    const shade = 0.75 + rnd() * 0.3
    paint(lobe, [0.29 * shade, 0.38 * shade, 0.2 * shade], 0.06, rnd)
    parts.push(lobe)
  }
  const geo = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p).deleteAttribute('uv')))
  geo.computeVertexNormals()
  return geo
}

function paint(geo, rgb, jitter, rnd) {
  const n = geo.attributes.position.count
  const c = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const j = (rnd() - 0.5) * jitter
    c[i * 3] = rgb[0] + j
    c[i * 3 + 1] = rgb[1] + j
    c[i * 3 + 2] = rgb[2] + j
  }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3))
}

function palmGeometries() {
  const pts = []
  for (let i = 0; i <= 5; i++) {
    const t = i / 5
    pts.push(new THREE.Vector3(Math.sin(t * 1.3) * 0.5, t * 9, 0))
  }
  const trunk = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.2, 7, false)
  const top = pts[pts.length - 1]
  const fronds = []
  for (let i = 0; i < 12; i++) {
    const f = getFrondGeometry().clone()
    f.rotateZ((i % 2 ? -0.15 : 0.12))
    f.rotateY((i / 12) * Math.PI * 2)
    f.translate(top.x, top.y, top.z)
    fronds.push(f)
  }
  return { trunk, crown: mergeGeometries(fronds) }
}

export function buildPark({ shadows = true, quality = 1 } = {}) {
  const M = materials()
  const g = new THREE.Group()
  g.name = 'park'
  const rnd = mulberry32(77)

  /* ------------------------------ ground ------------------------------ */
  const lawnMat = new THREE.MeshStandardMaterial({ color: '#8d9e72', roughness: 1 })
  const lawn = new THREE.Mesh(new THREE.ShapeGeometry(roundedRectShape(190, 130, 30), 6).rotateX(-Math.PI / 2), lawnMat)
  lawn.position.y = 0.12
  lawn.receiveShadow = shadows
  g.add(lawn)

  const pathMat = new THREE.MeshStandardMaterial({ color: '#e3d8c3', roughness: 0.9 })
  // elliptical promenade loop + straight boulevard to the beach
  const loop = new THREE.RingGeometry(46, 50, 96, 1).rotateX(-Math.PI / 2)
  loop.scale(1.35, 1, 1)
  const loopMesh = new THREE.Mesh(loop, pathMat)
  loopMesh.position.y = 0.2
  loopMesh.receiveShadow = shadows
  g.add(loopMesh)
  const boulevard = new THREE.Mesh(new THREE.PlaneGeometry(8, 52).rotateX(-Math.PI / 2), pathMat)
  boulevard.position.set(0, 0.2, 40)
  boulevard.receiveShadow = shadows
  g.add(boulevard)

  /* ------------------------------- pond ------------------------------- */
  const pondShape = blobShape(22, 12, 5)
  const water = new THREE.MeshStandardMaterial({ color: '#557f86', metalness: 0.88, roughness: 0.05 })
  const pond = new THREE.Mesh(new THREE.ShapeGeometry(pondShape, 4).rotateX(-Math.PI / 2), water)
  pond.position.set(-48, 0.24, 18)
  g.add(pond)
  const rimShape = blobShape(23.4, 13.4, 5)
  rimShape.holes.push(new THREE.Path(pondShape.getPoints().reverse()))
  const rim = new THREE.Mesh(new THREE.ExtrudeGeometry(rimShape, { depth: 0.55, bevelEnabled: false }).rotateX(-Math.PI / 2), pathMat)
  rim.position.set(-48, 0.12, 18)
  rim.receiveShadow = shadows
  g.add(rim)

  /* ------------------------------ planting ------------------------------ */
  const blocked = (x, z) => {
    if (Math.abs(x) < 40 && Math.abs(z) < 34) return true // tower plaza
    if (Math.abs(x) < 7 && z > 30) return true // boulevard
    const dx = (x + 48) / 26
    const dz = (z - 18) / 16
    if (dx * dx + dz * dz < 1) return true // pond
    const e = Math.hypot(x / 1.35, z) // promenade loop
    if (e > 45 && e < 51) return true
    return Math.abs(x) > 90 || Math.abs(z) > 60
  }

  const treeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 })
  const treeGeo = treeGeometry(11)
  const nTrees = Math.round(70 * quality)
  const trees = new THREE.InstancedMesh(treeGeo, treeMat, nTrees)
  const o = new THREE.Object3D()
  const tint = new THREE.Color()
  let placed = 0
  for (let tries = 0; placed < nTrees && tries < 4000; tries++) {
    const x = (rnd() - 0.5) * 180
    const z = (rnd() - 0.5) * 120
    if (blocked(x, z)) continue
    const sc = 0.85 + rnd() * 0.6
    o.position.set(x, 0.12, z)
    o.rotation.set(0, rnd() * Math.PI * 2, 0)
    o.scale.set(sc, sc * (0.9 + rnd() * 0.25), sc)
    o.updateMatrix()
    trees.setMatrixAt(placed, o.matrix)
    trees.setColorAt(placed, tint.setHSL(0.22 + rnd() * 0.06, 0.25, 0.85 + rnd() * 0.25))
    placed++
  }
  trees.count = placed
  trees.castShadow = shadows
  trees.receiveShadow = shadows
  g.add(trees)

  // date palms: boulevard avenue + pond edge
  const palmSpots = []
  for (let i = 0; i < 6; i++) for (const s of [-1, 1]) palmSpots.push([s * 6.5, 22 + i * 7.5])
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2
    palmSpots.push([-48 + Math.cos(a) * 26, 18 + Math.sin(a) * 15.5])
  }
  const { trunk, crown } = palmGeometries()
  const palmTrunks = new THREE.InstancedMesh(trunk, M.trunk, palmSpots.length)
  const palmCrowns = new THREE.InstancedMesh(crown, getFrondMaterial(), palmSpots.length)
  palmSpots.forEach(([x, z], i) => {
    const sc = 0.9 + rnd() * 0.3
    o.position.set(x, 0.12, z)
    o.rotation.set(0, rnd() * Math.PI * 2, 0)
    o.scale.setScalar(sc)
    o.updateMatrix()
    palmTrunks.setMatrixAt(i, o.matrix)
    palmCrowns.setMatrixAt(i, o.matrix)
  })
  palmTrunks.castShadow = palmCrowns.castShadow = shadows
  g.add(palmTrunks, palmCrowns)

  // clipped hedges framing the plaza
  const hedgeGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)
  const hedgeSpots = [
    [0, -37, 74, 1.4], [-41, 0, 1.4, 60], [41, 0, 1.4, 60], [-24, 36, 30, 1.4], [24, 36, 30, 1.4],
  ]
  const hedges = new THREE.InstancedMesh(hedgeGeo, M.hedge, hedgeSpots.length)
  hedgeSpots.forEach(([x, z, sx, sz], i) => {
    o.position.set(x, 0.12, z)
    o.rotation.set(0, 0, 0)
    o.scale.set(sx, 1.3, sz)
    o.updateMatrix()
    hedges.setMatrixAt(i, o.matrix)
  })
  hedges.castShadow = hedges.receiveShadow = shadows
  g.add(hedges)

  return { group: g }
}
