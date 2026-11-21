import * as THREE from 'three'
import { buildTower, buildVilla, buildPenthouse, buildMarina } from './models.js'
import { skyEquirect, sunDirection } from './sky.js'
import { makeCanvas } from './canvas.js'

/*
 * "Architectural photography" rendered from the same 3D models as the showcase.
 * DOM-free: runs inside a Web Worker (OffscreenCanvas) so it costs the page's
 * main thread nothing; can also run on the main thread as a fallback.
 */

export const SHOTS = [
  // id, model, camera direction (x,y,z), distance factor, look-at height fraction, fov, sky
  { id: 'tower-gold', model: 'tower', dir: [0.55, 0.05, 1], dist: 0.95, look: 0.55, fov: 34, sky: { warm: 1, sunU: 0.12, sunV: 0.43 } },
  { id: 'villa-aerial', model: 'villa', dir: [0.9, 0.85, 1], dist: 1.05, look: 0.0, fov: 30, sky: { warm: 1, sunU: 0.12, sunV: 0.4 } },
  { id: 'penthouse', model: 'penthouse', dir: [0.75, 1.25, 1], dist: 1.0, look: 0.0, fov: 30, sky: { warm: 1, sunU: 0.2, sunV: 0.36 } },
  { id: 'marina', model: 'marina', dir: [-0.5, 0.42, 1], dist: 1.0, look: 0.32, fov: 34, sky: { warm: 1, sunU: 0.9, sunV: 0.42 } },
  { id: 'villa-eye', model: 'villa', dir: [-0.8, 0.38, 1], dist: 0.92, look: 0.12, fov: 36, sky: { warm: 0, sunU: 0.85, sunV: 0.34 } },
  { id: 'tower-day', model: 'tower', dir: [-0.8, 0.2, 0.7], dist: 0.95, look: 0.5, fov: 32, sky: { warm: 0, sunU: 0.95, sunV: 0.3 } },
  { id: 'tower-crown', model: 'tower', dir: [0.9, -0.05, 1], dist: 0.55, look: 0.8, fov: 30, sky: { warm: 1, sunU: 0.15, sunV: 0.45 } },
]

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

export async function renderShots({ tier, onShot, skip = new Set(), idle = () => wait(0) }) {
  const W = tier === 2 ? 1000 : 720
  const H = Math.round(W * 1.25)
  const canvas = makeCanvas(W, H)
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'low-power' })
  renderer.setPixelRatio(1)
  renderer.setSize(W, H, false)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  const pmrem = new THREE.PMREMGenerator(renderer)

  const factories = {
    tower: () => buildTower({ floors: 36 }).group,
    villa: () => buildVilla().group,
    penthouse: () => buildPenthouse().group,
    marina: () => buildMarina().group,
  }
  // each model is built once and re-used by every shot that frames it
  const cache = {}
  const builders = Object.fromEntries(Object.keys(factories).map((k) => [k, () => (cache[k] ||= factories[k]())]))

  for (const shot of SHOTS) {
    if (skip.has(shot.id)) continue
    await idle()
    const scene = new THREE.Scene()
    const sky = skyEquirect(shot.sky)
    const env = pmrem.fromEquirectangular(sky)
    scene.environment = env.texture
    scene.background = sky
    scene.environmentIntensity = 0.85

    const model = builders[shot.model]()
    scene.add(model)
    const box = new THREE.Box3().setFromObject(model)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const radius = size.length() / 2

    const horizon = new THREE.Color(shot.sky.warm ? '#efdcc2' : '#e8e4da')
    scene.fog = new THREE.Fog(horizon, radius * 3, radius * 9)
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(radius * 12, 64).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: '#e2d3b8', roughness: 1 })
    )
    ground.position.y = box.min.y - 0.02
    ground.receiveShadow = true
    scene.add(ground)

    scene.add(new THREE.HemisphereLight('#f6efe4', '#c8b494', 0.9))
    const sun = new THREE.DirectionalLight(shot.sky.warm ? '#ffd5a3' : '#fff4e2', shot.sky.warm ? 3.4 : 3.0)
    const sd = sunDirection(shot.sky.sunU, shot.sky.sunV)
    sd.y = Math.max(sd.y, 0.22)
    sun.position.copy(center).addScaledVector(sd.normalize(), radius * 3)
    sun.target.position.copy(center)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.bias = -0.0003
    sun.shadow.normalBias = 0.04
    sun.shadow.radius = 4
    const sc = sun.shadow.camera
    sc.left = sc.bottom = -radius * 1.3
    sc.right = sc.top = radius * 1.3
    sc.near = radius * 0.5
    sc.far = radius * 6
    scene.add(sun, sun.target)
    model.traverse((o) => {
      if (o.isMesh && !o.material.transparent) o.castShadow = o.receiveShadow = true
    })

    const camera = new THREE.PerspectiveCamera(shot.fov, W / H, 0.5, radius * 40)
    const target = new THREE.Vector3(center.x, box.min.y + size.y * shot.look, center.z)
    const fit = (radius / Math.sin(THREE.MathUtils.degToRad(shot.fov) / 2)) * shot.dist
    camera.position.copy(target).addScaledVector(new THREE.Vector3(...shot.dir).normalize(), fit)
    camera.lookAt(target)

    // link shader programs off the main thread, then render in its own idle slot
    try {
      await renderer.compileAsync(scene, camera)
    } catch {
      /* compile on render instead */
    }
    await idle()
    renderer.render(scene, camera)
    const blob = canvas.convertToBlob
      ? await canvas.convertToBlob({ type: 'image/webp', quality: 0.86 })
      : await new Promise((r) => canvas.toBlob(r, 'image/webp', 0.86))
    if (blob) onShot(shot.id, blob)
    env.dispose()
    sky.dispose()
    ground.geometry.dispose()
    scene.remove(model)
    await wait(60)
  }
  pmrem.dispose()
  renderer.dispose()
  renderer.forceContextLoss()
}
