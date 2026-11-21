import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { MeshReflectorMaterial, PerformanceMonitor } from '@react-three/drei'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import gsap from 'gsap'
import { facadeMaterial, waterNormalTexture } from './materials.js'
import { buildTower } from './models.js'
import { mulberry32 } from '../lib/hooks.js'
import { trustworthySample } from '../lib/quality.js'
import { tier, prefersReducedMotion } from '../lib/device.js'

/* Scene scale: 1 unit = 10 metres. */

import { heroState } from './heroState.js'

const SKY = {
  top: new THREE.Color('#aebfc6'),
  horizon: new THREE.Color('#f0dfc6'),
  glow: new THREE.Color('#ffb36b'),
}
const SUN_DIR = new THREE.Vector3(-0.86, 0.16, -0.42).normalize()

/* -------------------------------- Sky dome -------------------------------- */
function makeDome() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTop: { value: SKY.top },
      uHorizon: { value: SKY.horizon },
      uGlow: { value: SKY.glow },
      uSun: { value: SUN_DIR },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main(){
        vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
        vec4 p = projectionMatrix * viewMatrix * vec4((modelMatrix * vec4(position,1.0)).xyz, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop, uHorizon, uGlow, uSun;
      varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        float h = clamp(d.y, 0.0, 1.0);
        vec3 col = mix(uHorizon, uTop, pow(h, 0.5));
        float s = max(dot(d, uSun), 0.0);
        float fade = 1.0 - smoothstep(0.0, 0.6, h);
        col += uGlow * (pow(s, 4.0) * 0.28 + pow(s, 40.0) * 0.55) * (0.35 + 0.65 * fade);
        col += vec3(1.0, 0.93, 0.8) * smoothstep(0.9990, 0.9996, s) * 3.0;
        if (d.y < 0.0) col = mix(uHorizon, uHorizon * 0.96, clamp(-d.y * 4.0, 0.0, 1.0));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), mat)
  mesh.scale.setScalar(4000)
  mesh.frustumCulled = false
  mesh.renderOrder = -1
  return mesh
}

function Atmosphere() {
  const { gl, scene } = useThree()
  const dome = useMemo(makeDome, [])
  useEffect(() => {
    scene.fog = new THREE.Fog(SKY.horizon.clone(), 160, tier === 2 ? 1150 : 800)
    const pmrem = new THREE.PMREMGenerator(gl)
    const envScene = new THREE.Scene()
    envScene.add(makeDome())
    const rt = pmrem.fromScene(envScene, 0.02, 0.1, 10000)
    scene.environment = rt.texture
    scene.environmentIntensity = 0.9
    return () => {
      rt.dispose()
      pmrem.dispose()
      scene.environment = null
      scene.fog = null
    }
  }, [gl, scene])
  return <primitive object={dome} />
}

/* ------------------------------ City generator ---------------------------- */
const PALETTE = ['#dfe2e2', '#cdd5d8', '#e6dccb', '#c5cbc8', '#d9cfbd', '#b7c1c4', '#ece6dc']
const SPIRE = new THREE.Vector3(0, 0, -78)
const SIGNATURE = new THREE.Vector3(30, 0, -2)

function genCity(q) {
  const rnd = mulberry32(2026)
  const occupied = new Set()
  const key = (x, z) => `${Math.round(x / 4.5)}|${Math.round(z / 4.5)}`
  const tall = []
  const low = []
  const tryAdd = (x, z, h, w, d, shape) => {
    if (Math.hypot(x - SPIRE.x, z - SPIRE.z) < 11) return
    if (Math.hypot(x - SIGNATURE.x, z - SIGNATURE.z) < 7) return
    if (z > 1) return
    const k = key(x, z)
    if (occupied.has(k)) return
    occupied.add(k)
    tall.push({ x, z, h, w, d, shape, color: PALETTE[Math.floor(rnd() * PALETTE.length)], rot: rnd() < 0.7 ? 0 : rnd() * 0.6 })
  }
  // Downtown
  for (let i = 0; i < 160 * q; i++) {
    const a = rnd() * Math.PI * 2
    const r = 10 + Math.pow(rnd(), 0.75) * 52
    const h = Math.max(7, (36 - r * 0.42) * (0.55 + rnd() * 0.65))
    tryAdd(SPIRE.x + Math.cos(a) * r, SPIRE.z + Math.sin(a) * r * 0.75, h, 2.6 + rnd() * 2.6, 2.6 + rnd() * 2.6, rnd() < 0.3 ? 1 : 0)
  }
  // Business Bay
  for (let i = 0; i < 70 * q; i++) {
    const a = rnd() * Math.PI * 2
    const r = Math.pow(rnd(), 0.7) * 30
    tryAdd(52 + Math.cos(a) * r, -108 + Math.sin(a) * r * 0.7, 9 + rnd() * 17, 2.6 + rnd() * 2.4, 2.6 + rnd() * 2.4, rnd() < 0.35 ? 1 : 0)
  }
  // Marina strip
  for (let i = 0; i < 90 * q; i++) {
    tryAdd(-185 + rnd() * 75, -34 + rnd() * 34, 16 + rnd() * 22, 2.3 + rnd() * 1.6, 2.3 + rnd() * 1.6, rnd() < 0.45 ? 1 : 0)
  }
  // Sheikh Zayed Road corridor
  for (let i = 0; i < 70 * q; i++) {
    const t = rnd()
    const side = rnd() < 0.5 ? -1 : 1
    const x = THREE.MathUtils.lerp(-112, -28, t) + side * 3
    const z = THREE.MathUtils.lerp(-34, -66, t) + side * 7.5
    tryAdd(x, z, 10 + rnd() * 20, 2.4 + rnd() * 1.8, 2.4 + rnd() * 1.8, rnd() < 0.25 ? 1 : 0)
  }
  // Low-rise fabric
  for (let i = 0; i < 3200 * q; i++) {
    const x = -320 + rnd() * 640
    const z = -380 + Math.pow(rnd(), 0.8) * 380
    if (z > -2) continue
    if (occupied.has(key(x, z))) continue
    const dist = Math.hypot(x - SPIRE.x, z - SPIRE.z)
    const h = dist < 70 ? 2 + rnd() * 3 : 0.5 + rnd() * rnd() * 3
    low.push({ x, z, h, w: 1.6 + rnd() * 3.4, d: 1.6 + rnd() * 3.4, rot: rnd() < 0.8 ? 0 : 0.35 })
  }
  return { tall, low }
}

function instanced(geo, mat, items, { crown = false } = {}) {
  const mesh = new THREE.InstancedMesh(geo, mat, items.length)
  const o = new THREE.Object3D()
  const c = new THREE.Color()
  items.forEach((b, i) => {
    o.position.set(b.x, crown ? b.h : 0, b.z)
    o.rotation.y = b.rot || 0
    o.scale.set(b.w * (crown ? 0.62 : 1), crown ? b.h * 0.12 : b.h, b.d * (crown ? 0.62 : 1))
    o.updateMatrix()
    mesh.setMatrixAt(i, o.matrix)
    mesh.setColorAt(i, c.set(b.color || '#ece4d6'))
  })
  mesh.castShadow = tier === 2
  mesh.receiveShadow = tier === 2
  mesh.instanceMatrix.needsUpdate = true
  return mesh
}

function City() {
  const group = useMemo(() => {
    const q = tier === 2 ? 1 : 0.5
    const { tall, low } = genCity(q)
    const g = new THREE.Group()
    const boxGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)
    const cylGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 14, 1).translate(0, 0.5, 0)
    const towerMat = facadeMaterial({ color: '#ffffff', cell: [0.3, 0.38], night: 0.08 })
    const lowMat = facadeMaterial({ color: '#f1e9dc', cell: [0.45, 0.36], roughness: 0.85, metalness: 0.05, winFill: [0.3, 0.7, 0.3, 0.75] })
    g.add(instanced(boxGeo, towerMat, tall.filter((b) => b.shape === 0)))
    g.add(instanced(cylGeo, towerMat, tall.filter((b) => b.shape === 1)))
    g.add(instanced(boxGeo, towerMat, tall.filter((b) => b.shape === 0 && b.h > 18), { crown: true }))
    g.add(instanced(boxGeo, lowMat, low))
    return g
  }, [])
  return <primitive object={group} />
}

/* --------------------------- Supertall Y-plan spire ------------------------ */
function Spire() {
  const group = useMemo(() => {
    const g = new THREE.Group()
    const mat = facadeMaterial({ color: '#e4e8ea', cell: [0.22, 0.4], roughness: 0.35, metalness: 0.45, night: 0.15 })
    const N = 16
    const H = 64
    const segH = H / N
    // Y-plan wings + core merged into a single draw call
    const parts = []
    const o = new THREE.Object3D()
    for (let k = 0; k < N; k++) {
      for (let i = 0; i < 3; i++) {
        const prog = (k * 3 + i) / (N * 3)
        const L = 9.5 * Math.pow(1 - prog, 0.95)
        if (L < 1.2) continue
        const wdt = 3.6 * (1 - prog * 0.45)
        const a = (i / 3) * Math.PI * 2 + Math.PI / 2
        o.scale.set(L, segH, wdt)
        o.rotation.set(0, -a, 0)
        o.position.set(Math.cos(a) * L * 0.5, k * segH, Math.sin(a) * L * 0.5)
        o.updateMatrix()
        parts.push(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0).applyMatrix4(o.matrix))
      }
    }
    parts.push(new THREE.CylinderGeometry(1.4, 2.6, H + 8, 18).translate(0, (H + 8) / 2, 0))
    const body = new THREE.Mesh(mergeGeometries(parts.map((p) => p.toNonIndexed())), mat)
    parts.forEach((p) => p.dispose())
    body.castShadow = body.receiveShadow = tier === 2
    g.add(body)
    const needle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 1.2, 20, 12).translate(0, H + 8 + 10, 0),
      new THREE.MeshStandardMaterial({ color: '#d9dcdc', metalness: 0.9, roughness: 0.25 })
    )
    g.add(needle)
    // podium + lake
    const lake = new THREE.Mesh(
      new THREE.CircleGeometry(14, 48).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: '#7fa0a2', roughness: 0.08, metalness: 0.6 })
    )
    lake.position.set(10, 0.16, 12)
    lake.scale.set(1.4, 1, 0.6)
    g.add(lake)
    g.position.copy(SPIRE)
    return g
  }, [])
  return <primitive object={group} />
}

/* -------------------------------- Palm island ------------------------------ */
function PalmIsland() {
  const group = useMemo(() => {
    const g = new THREE.Group()
    const sand = new THREE.MeshStandardMaterial({ color: '#e7d6b6', roughness: 1 })
    const green = new THREE.MeshStandardMaterial({ color: '#9aa88a', roughness: 1 })
    const cx = -62
    const box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)
    // all sand pieces are merged into one mesh at the end
    const sandParts = []
    const greenParts = []
    const o = new THREE.Object3D()
    const add = (w, d, x, z, ry, mat = sand, h = 0.18) => {
      o.scale.set(w, h, d)
      o.position.set(x, 0, z)
      o.rotation.set(0, ry, 0)
      o.updateMatrix()
      ;(mat === sand ? sandParts : greenParts).push(box.clone().applyMatrix4(o.matrix))
    }
    add(3.2, 54, cx, 32, 0) // trunk
    add(2.2, 40, cx, 30, 0, green, 0.22)
    const houses = []
    for (let j = 0; j < 8; j++) {
      const z = 20 + j * 4.6
      const L = 22 - j * 0.9
      for (const s of [-1, 1]) {
        const phi = 0.42
        const ux = s * Math.cos(phi) // frond direction (outward + seaward)
        const uz = Math.sin(phi)
        add(L, 1.5, cx + (ux * L) / 2, z + (uz * L) / 2, -s * phi)
        for (let k = 0; k < 9; k++) {
          const t = 0.12 + (k / 9) * 0.85
          for (const off of [-0.5, 0.5]) houses.push([cx + ux * L * t - uz * off, z + uz * L * t + ux * off])
        }
      }
    }
    sandParts.push(
      new THREE.RingGeometry(43, 45.5, 96, 1, Math.PI + 0.18, Math.PI - 0.36)
        .rotateX(-Math.PI / 2)
        .translate(cx, 0.18, 46)
        .toNonIndexed()
        .deleteAttribute('uv')
    )
    const strip = (arr) => arr.map((p) => (p.index ? p.toNonIndexed() : p).deleteAttribute('uv'))
    const sandMesh = new THREE.Mesh(mergeGeometries(strip(sandParts)), sand)
    const greenMesh = new THREE.Mesh(mergeGeometries(strip(greenParts)), green)
    sandMesh.receiveShadow = greenMesh.receiveShadow = true
    g.add(sandMesh, greenMesh)
    const hm = new THREE.InstancedMesh(box, new THREE.MeshStandardMaterial({ color: '#f6f1e8', roughness: 0.8 }), houses.length)
    // reuse the transform helper for the instanced villas
    houses.forEach(([x, z], i) => {
      o.position.set(x, 0.18, z)
      o.scale.set(0.6, 0.28, 0.6)
      o.updateMatrix()
      hm.setMatrixAt(i, o.matrix)
    })
    g.add(hm)
    return g
  }, [])
  return <primitive object={group} />
}

/* ------------------------------ Signature tower ---------------------------- */
function SignatureTower() {
  const group = useMemo(() => {
    const t = buildTower({ floors: 44, w: 18, d: 12, night: 0.2, landscape: false })
    t.core.userData.uniforms.uCell.value.set(0.16, 0.34)
    t.group.scale.setScalar(0.1)
    t.group.position.copy(SIGNATURE)
    t.group.rotation.y = -0.35
    // At aerial distance, textured / physical materials are indistinguishable from plain PBR —
    // remapping them avoids 4 extra shader programs (x2 for the reflection pass) on first load.
    const remap = new Map()
    const simple = (m) => {
      if (!remap.has(m))
        remap.set(
          m,
          new THREE.MeshStandardMaterial({
            color: m.map ? '#e6dccb' : m.color,
            roughness: m.roughness,
            metalness: m.metalness,
            transparent: m.transparent,
            opacity: m.opacity,
            depthWrite: m.depthWrite,
          })
        )
      return remap.get(m)
    }
    t.group.traverse((o) => {
      if (!o.isMesh) return
      if (o.material.isMeshPhysicalMaterial || o.material.map) o.material = simple(o.material)
      o.castShadow = tier === 2
      o.receiveShadow = tier === 2
    })
    return t.group
  }, [])
  return <primitive object={group} />
}

/* ---------------------------------- Ground --------------------------------- */
function Ground({ reflect }) {
  const normal = useMemo(() => waterNormalTexture([60, 60]), [])
  useFrame((_, dt) => {
    normal.offset.x += dt * 0.004
    normal.offset.y += dt * 0.002
  })
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.06, -310]} receiveShadow>
        <planeGeometry args={[1400, 620]} />
        <meshStandardMaterial color="#e6d8bf" roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.08, 3]} receiveShadow>
        <planeGeometry args={[1400, 8]} />
        <meshStandardMaterial color="#efe3cc" roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]}>
        <planeGeometry args={[4000, 4000]} />
        {reflect ? (
          <MeshReflectorMaterial
            resolution={512}
            blur={[400, 120]}
            mixBlur={0.8}
            mixStrength={1.1}
            mirror={0.55}
            depthScale={0}
            color="#a9bdbc"
            metalness={0.35}
            roughness={0.55}
            normalMap={normal}
            normalScale={[0.15, 0.15]}
          />
        ) : (
          <meshStandardMaterial color="#9fb6b6" metalness={0.6} roughness={0.18} normalMap={normal} normalScale={[0.2, 0.2]} />
        )}
      </mesh>
    </group>
  )
}

/* ------------------------------- Camera rig -------------------------------- */
function CameraRig({ started }) {
  const { camera } = useThree()
  const intro = useRef({ v: prefersReducedMotion ? 1 : 0 })
  const target = useMemo(() => new THREE.Vector3(), [])
  const desired = useMemo(() => new THREE.Vector3(), [])
  const look = useMemo(() => new THREE.Vector3(-14, 16, -48), [])
  const smoothMouse = useRef({ x: 0, y: 0 })
  const first = useRef(true)

  // The aerial descent starts with the first visible frame, not when the chunk loads.
  useEffect(() => {
    if (prefersReducedMotion || !started) return
    const tw = gsap.to(intro.current, { v: 1, duration: 5.5, ease: 'power3.out', delay: 0.1 })
    return () => tw.kill()
  }, [started])

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20) // no camera jumps after tab switches / hitches
    const t = state.clock.elapsedTime
    const p = heroState.progress
    const iv = intro.current.v
    const m = smoothMouse.current
    m.x += (heroState.mouseX - m.x) * Math.min(1, dt * 2)
    m.y += (heroState.mouseY - m.y) * Math.min(1, dt * 2)

    const theta = 0.5 + Math.sin(t * 0.045) * 0.1 + m.x * 0.05 - p * 0.18 + (1 - iv) * 0.35
    const R = THREE.MathUtils.lerp(300, 170, p) * THREE.MathUtils.lerp(1.9, 1, iv)
    const Y = THREE.MathUtils.lerp(62, 34, p) * THREE.MathUtils.lerp(2.6, 1, iv) - m.y * 5
    target.set(THREE.MathUtils.lerp(-14, 0, p), THREE.MathUtils.lerp(24, 30, p), THREE.MathUtils.lerp(-48, -70, p))
    desired.set(target.x + Math.sin(theta) * R, Y, target.z + Math.cos(theta) * R)
    if (first.current) {
      // start exactly on the intro pose — no swoop from the default camera position
      camera.position.copy(desired)
      look.copy(target)
      first.current = false
    }
    camera.position.lerp(desired, Math.min(1, dt * 3))
    look.lerp(target, Math.min(1, dt * 3))
    camera.lookAt(look)
  })
  return null
}

/** Fires onReady after the first frames are on screen (used to cross-fade the poster). */
function ReadySignal({ onReady }) {
  const n = useRef(0)
  useFrame(() => {
    n.current++
    if (n.current === 3) onReady?.()
  })
  return null
}

/**
 * Compiles every shader asynchronously (KHR_parallel_shader_compile) before the
 * first frame, so WebGL program linking never blocks the main thread / intro.
 */
function Warmup({ onDone }) {
  const { gl, scene, camera } = useThree()
  useEffect(() => {
    let alive = true
    const id = requestAnimationFrame(async () => {
      try {
        // 1) link all on-screen programs off the main thread
        await gl.compileAsync(scene, camera)
        if (!alive) return
        // 2) one real render into a tiny offscreen target: builds the (static) shadow map and the
        //    render-target shader variants used by the water reflection, in its own task
        const rt = new THREE.WebGLRenderTarget(8, 8)
        gl.setRenderTarget(rt)
        gl.shadowMap.needsUpdate = true
        gl.render(scene, camera)
        gl.setRenderTarget(null)
        rt.dispose()
        // 3) yield, so the first visible frame starts in a fresh task
        await new Promise((r) => setTimeout(r, 0))
      } catch {
        /* older drivers: fall back to compiling on first render */
      }
      if (alive) onDone()
    })
    return () => {
      alive = false
      cancelAnimationFrame(id)
    }
  }, [gl, scene, camera, onDone])
  return null
}

function Lights() {
  const ref = useRef()
  const { gl } = useThree()
  useEffect(() => {
    const l = ref.current
    if (!l) return
    l.position.copy(SUN_DIR).multiplyScalar(420)
    l.target.position.set(-20, 0, -60)
    l.target.updateMatrixWorld()
    const c = l.shadow.camera
    c.left = -260
    c.right = 260
    c.top = 260
    c.bottom = -260
    c.near = 50
    c.far = 1100
    c.updateProjectionMatrix()
    // The sun and the city are static: render the shadow map once, not every frame.
    gl.shadowMap.autoUpdate = false
    gl.shadowMap.needsUpdate = true
  }, [gl])
  return (
    <>
      <hemisphereLight args={['#f7efe2', '#cbb592', 0.75]} />
      <directionalLight
        ref={ref}
        color="#ffd6a6"
        intensity={3.8}
        castShadow={tier === 2}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.06}
        shadow-radius={3}
      />
    </>
  )
}

// Quality ladder driven by measured frame rate (never below the initial look on capable GPUs).
const LEVELS = tier === 2 ? [{ dpr: 1, reflect: false }, { dpr: 1.25, reflect: true }, { dpr: 1.5, reflect: true }] : [{ dpr: 1, reflect: false }, { dpr: 1.25, reflect: false }, { dpr: 1.5, reflect: false }]

// Desktop never drops below the reflective-water look; only resolution adapts.
const MIN_LEVEL = tier === 2 ? 1 : 0

export default function HeroScene({ active = true, onReady }) {
  const [compiled, setCompiled] = useState(false)
  const [level, setLevel] = useState(tier === 2 ? 2 : 1)
  const onCompiled = useCallback(() => setCompiled(true), [])
  const q = LEVELS[level]
  const dpr = Math.min(q.dpr, window.devicePixelRatio || 1)
  return (
    <Canvas
      className="hero-canvas"
      frameloop={active && compiled ? 'always' : 'never'}
      dpr={dpr}
      shadows={tier === 2}
      camera={{ fov: 32, near: 1, far: 9000, position: [300, 160, 400] }}
      gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
    >
      <PerformanceMonitor
        flipflops={3}
        onDecline={() => trustworthySample() && setLevel((l) => Math.max(MIN_LEVEL, l - 1))}
        onIncline={() => setLevel((l) => Math.min(LEVELS.length - 1, l + 1))}
        onFallback={() => trustworthySample() && setLevel(MIN_LEVEL)}
      />
      <Atmosphere />
      <Lights />
      <City />
      <Spire />
      <SignatureTower />
      <PalmIsland />
      <Ground reflect={q.reflect} />
      <CameraRig started={compiled} />
      {!compiled && <Warmup onDone={onCompiled} />}
      {compiled && <ReadySignal onReady={onReady} />}
    </Canvas>
  )
}
