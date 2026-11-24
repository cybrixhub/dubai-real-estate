import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * Bakes every plain Mesh under `root` into one mesh per (material, shadow flags) bucket.
 * Hundreds of furniture parts become a few dozen draw calls. InstancedMesh, lines and any
 * object flagged `userData.keep` are left alone (pick surfaces, outlines, …).
 */
export function mergeStatic(root) {
  root.updateMatrixWorld(true)
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert()
  const buckets = new Map()
  const doomed = []
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.userData.keep || Array.isArray(o.material)) return
    const key = `${o.material.uuid}|${o.castShadow ? 1 : 0}${o.receiveShadow ? 1 : 0}|${o.renderOrder}`
    let b = buckets.get(key)
    if (!b) buckets.set(key, (b = { material: o.material, cast: o.castShadow, receive: o.receiveShadow, order: o.renderOrder, geos: [] }))
    const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld))
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name)
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2))
    b.geos.push(g)
    doomed.push(o)
  })
  for (const o of doomed) {
    o.geometry.dispose()
    o.removeFromParent()
  }
  for (const b of buckets.values()) {
    const geo = mergeGeometries(b.geos, false)
    b.geos.forEach((g) => g.dispose())
    if (!geo) continue
    const m = new THREE.Mesh(geo, b.material)
    m.castShadow = b.cast
    m.receiveShadow = b.receive
    m.renderOrder = b.order
    root.add(m)
  }
  return root
}

/** Dispose geometries and any material flagged `userData.disposable` / `ownsMaps` under root. */
export function disposeTree(root) {
  root.traverse((o) => {
    o.geometry?.dispose?.()
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []
    for (const m of mats) {
      if (m.userData?.ownsMaps) for (const k of ['map', 'normalMap', 'emissiveMap']) m[k]?.dispose?.()
      if (m.userData?.disposable || m.userData?.ownsMaps) m.dispose()
    }
  })
  root.removeFromParent()
}
