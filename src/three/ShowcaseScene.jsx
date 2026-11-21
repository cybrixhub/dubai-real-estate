import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, PerformanceMonitor } from '@react-three/drei'
import gsap from 'gsap'
import { buildTower, buildVilla, buildPenthouse, buildMarina } from './models.js'
import { skyEquirect } from './sky.js'
import { trustworthySample } from '../lib/quality.js'
import { tier, isTouch } from '../lib/device.js'

export const TOWER_FLOORS = 32
const RADIUS = 16

const VIEWS = {
  tower: { dir: [0.62, 0.18, 1], look: 0.5, k: 1.12 },
  villa: { dir: [0.85, 0.75, 1], look: 0.05, k: 0.82 },
  penthouse: { dir: [0.7, 1.15, 1], look: 0.0, k: 0.86 },
  marina: { dir: [-0.45, 0.3, 1], look: 0.45, k: 1.12 },
}

const ORDER = ['tower', 'villa', 'penthouse', 'marina']

function normalize(group) {
  const wrap = new THREE.Group()
  const box = new THREE.Box3().setFromObject(group)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const s = RADIUS / (size.length() / 2)
  group.position.set(-center.x, -box.min.y, -center.z)
  const inner = new THREE.Group()
  inner.add(group)
  inner.scale.setScalar(s)
  wrap.add(inner)
  wrap.userData.height = size.y * s
  wrap.traverse((o) => {
    if (o.isMesh && !o.material.transparent) o.castShadow = o.receiveShadow = true
  })
  wrap.visible = false
  return wrap
}

let towerRef = null
const factories = {
  tower: () => {
    towerRef = buildTower({ floors: TOWER_FLOORS })
    return towerRef.group
  },
  villa: () => buildVilla().group,
  penthouse: () => buildPenthouse().group,
  marina: () => buildMarina().group,
}

function Environment() {
  const { gl, scene } = useThree()
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const sky = skyEquirect({ warm: 1, sunU: 0.18, sunV: 0.4 })
    const rt = pmrem.fromEquirectangular(sky)
    scene.environment = rt.texture
    scene.environmentIntensity = 0.9
    return () => {
      rt.dispose()
      sky.dispose()
      pmrem.dispose()
    }
  }, [gl, scene])
  return null
}

/** Shadows are static (the camera orbits, the models don't): re-render the shadow map only while models move. */
const shadowDirty = { until: 0 }
const markShadows = (ms) => (shadowDirty.until = Math.max(shadowDirty.until, performance.now() + ms))

function ShadowScheduler() {
  const { gl } = useThree()
  useEffect(() => {
    gl.shadowMap.autoUpdate = false
    gl.shadowMap.needsUpdate = true
  }, [gl])
  useFrame(() => {
    if (performance.now() < shadowDirty.until) gl.shadowMap.needsUpdate = true
  })
  return null
}

function Models({ active, floor, controls, onFirstReady }) {
  const { camera, gl, scene } = useThree()
  const root = useMemo(() => new THREE.Group(), [])
  const groups = useRef({})
  const current = useRef(null)
  const [, force] = useState(0)

  const ensure = useCallback(
    (key) => {
      if (!groups.current[key]) {
        groups.current[key] = normalize(factories[key]())
        root.add(groups.current[key])
      }
      return groups.current[key]
    },
    [root]
  )

  // First model: build now, compile async, then show. Others: prebuild in idle time.
  useEffect(() => {
    let alive = true
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 120))
    const first = ensure(active)
    gl.compileAsync(first, camera, scene)
      .catch(() => {})
      .then(() => {
        if (!alive) return
        force((n) => n + 1)
        onFirstReady?.()
        const rest = ORDER.filter((k) => !groups.current[k])
        const next = () => {
          const k = rest.shift()
          if (!k || !alive) return
          idle(
            () => {
              if (!alive) return
              const g = ensure(k)
              gl.compileAsync(g, camera, scene).catch(() => {}).then(() => setTimeout(next, 150))
            },
            { timeout: 4000 }
          )
        }
        setTimeout(next, 1200)
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // model transitions + camera re-framing
  useEffect(() => {
    const next = ensure(active)
    const prev = current.current && current.current !== next ? current.current : null
    current.current = next
    markShadows(prev ? 2600 : 600)
    if (prev) {
      gsap.to(prev.position, { y: -3, duration: 0.6, ease: 'power3.in' })
      gsap.to(prev.scale, { x: 0.94, y: 0.94, z: 0.94, duration: 0.6, ease: 'power3.in', onComplete: () => (prev.visible = false) })
    }
    next.visible = true
    if (prev) {
      gsap.fromTo(next.position, { y: -4 }, { y: 0, duration: 1.4, ease: 'expo.out', delay: 0.45 })
      gsap.fromTo(next.scale, { x: 0.92, y: 0.92, z: 0.92 }, { x: 1, y: 1, z: 1, duration: 1.4, ease: 'expo.out', delay: 0.45 })
    } else {
      next.position.y = 0
      next.scale.setScalar(1) // first model is revealed by the canvas fade-in
    }

    const v = VIEWS[active]
    const portrait = camera.aspect < 1
    // portrait screens: fit on the narrower horizontal FOV and lift the model above the UI strip
    const vfov = THREE.MathUtils.degToRad(camera.fov)
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect)
    const fitFov = Math.min(vfov, hfov * 1.35)
    const look = portrait ? Math.max(0, v.look - 0.12) : v.look
    const target = new THREE.Vector3(0, next.userData.height * look, 0)
    const dist = (RADIUS / Math.sin(fitFov / 2)) * v.k * (portrait ? 1.08 : 1)
    const pos = target.clone().addScaledVector(new THREE.Vector3(...v.dir).normalize(), dist)
    const c = controls.current
    const d = prev ? 1.8 : 0
    gsap.to(camera.position, { x: pos.x, y: pos.y, z: pos.z, duration: d, ease: 'power3.inOut', overwrite: true })
    if (c) gsap.to(c.target, { x: target.x, y: target.y, z: target.z, duration: d, ease: 'power3.inOut', overwrite: true, onUpdate: () => c.update() })
  }, [active, camera, controls, ensure])

  // highlight the selected residence floor
  useEffect(() => {
    if (!towerRef) return
    towerRef.band.visible = active === 'tower'
    gsap.to(towerRef.band.position, { y: towerRef.floorY(floor), duration: 0.7, ease: 'power3.out', overwrite: true })
  }, [floor, active])

  return <primitive object={root} />
}

function Sun() {
  const ref = useRef()
  useEffect(() => {
    const c = ref.current.shadow.camera
    c.left = c.bottom = -36
    c.right = c.top = 36
    c.near = 1
    c.far = 160
    c.updateProjectionMatrix()
  }, [])
  return (
    <directionalLight
      ref={ref}
      position={[-30, 34, 22]}
      intensity={3}
      color="#ffdcb2"
      castShadow
      shadow-mapSize={tier === 2 ? [2048, 2048] : [1024, 1024]}
      shadow-bias={-0.0004}
      shadow-normalBias={0.03}
      shadow-radius={4}
    />
  )
}

function Controls({ controlsRef }) {
  const { gl } = useThree()
  useEffect(() => {
    // Let vertical swipes scroll the page on touch devices; horizontal drags still orbit.
    gl.domElement.style.touchAction = 'pan-y'
  }, [gl])
  return (
    <OrbitControls
      ref={controlsRef}
      enableZoom={false}
      enablePan={false}
      enableDamping
      dampingFactor={0.06}
      autoRotate
      autoRotateSpeed={0.35}
      minPolarAngle={0.35}
      maxPolarAngle={1.42}
      rotateSpeed={isTouch ? 0.9 : 0.6}
    />
  )
}

const DPRS = tier === 2 ? [1, 1.5, 1.75] : [1, 1.25, 1.5]
const MIN_LEVEL = tier === 2 ? 1 : 0

export default function ShowcaseScene({ active, floor, running = true, onReady }) {
  const controls = useRef()
  const [level, setLevel] = useState(tier === 2 ? 2 : 1)
  const [shown, setShown] = useState(false)
  const handleFirst = useCallback(() => {
    setShown(true)
    onReady?.()
  }, [onReady])
  const dpr = Math.min(DPRS[level], Math.max(1, window.devicePixelRatio || 1))
  return (
    <Canvas
      frameloop={running && shown ? 'always' : 'never'}
      dpr={dpr}
      shadows
      camera={{ fov: 30, near: 0.5, far: 600, position: [40, 30, 60] }}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
      style={{ opacity: shown ? 1 : 0, transition: 'opacity 1s ease' }}
    >
      <PerformanceMonitor
        flipflops={3}
        onDecline={() => trustworthySample() && setLevel((l) => Math.max(MIN_LEVEL, l - 1))}
        onIncline={() => setLevel((l) => Math.min(DPRS.length - 1, l + 1))}
        onFallback={() => trustworthySample() && setLevel(MIN_LEVEL)}
      />
      <Environment />
      <ShadowScheduler />
      <hemisphereLight args={['#f7efe2', '#cdb894', 0.8]} />
      <Sun />
      <mesh rotation-x={-Math.PI / 2} position-y={-0.01} receiveShadow>
        <circleGeometry args={[60, 64]} />
        <shadowMaterial transparent opacity={0.16} />
      </mesh>
      <Models active={active} floor={floor} controls={controls} onFirstReady={handleFirst} />
      <Controls controlsRef={controls} />
    </Canvas>
  )
}
