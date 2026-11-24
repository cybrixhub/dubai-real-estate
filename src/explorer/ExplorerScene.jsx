import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, PerformanceMonitor } from '@react-three/drei'
import gsap from 'gsap'
import { TOWER, TOP_Y, floorBaseY, apartments, aptById, roomView } from './data.js'
import { buildTowerShell } from './tower.js'
import { buildPlateShell, addApartment } from './plate.js'
import { buildCity } from './city.js'
import { explorerMaterials } from './materials.js'
import { buildTour } from './tour.js'
import { disposeTree } from './merge.js'
import { setFurnitureDetail } from './furniture.js'
import { skyEquirect, sunDirection } from '../three/sky.js'
import { warmRender } from '../three/warmup.js'
import { tier } from '../lib/device.js'

const idle = (cb, t = 900) => (window.requestIdleCallback ? window.requestIdleCallback(cb, { timeout: t }) : setTimeout(cb, 16))
const slice = () => new Promise((r) => idle(r))
const SUN = sunDirection(0.85, 0.33) // golden afternoon over the Gulf (south-west)
const smooth = THREE.MathUtils.smoothstep
const clamp = THREE.MathUtils.clamp
const V = (x, y, z) => new THREE.Vector3(x, y, z)
const orbitPos = (t, az, el, r) => V(t[0] + r * Math.sin(az) * Math.cos(el), t[1] + r * Math.sin(el), t[2] + r * Math.cos(az) * Math.cos(el))
const DEFAULT = { floor: 28, apt: 'D' }

/* ------------------------------ sky, fog, environment ------------------------------ */
function Sky() {
  const { gl, scene } = useThree()
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const sky = skyEquirect({ warm: 1, sunU: 0.85, sunV: 0.37 })
    scene.background = sky
    const rt = pmrem.fromEquirectangular(sky)
    scene.environment = rt.texture
    scene.environmentIntensity = 0.7
    scene.fog = new THREE.Fog('#efe1ca', 700, 4200)
    pmrem.dispose()
    return () => {
      rt.dispose()
      sky.dispose()
      scene.background = scene.environment = scene.fog = null
    }
  }, [gl, scene])
  return null
}

/* ----------------------------------- the world ----------------------------------- */
const World = forwardRef(function World({ P }, ref) {
  const { gl, scene, camera, invalidate, size } = useThree()
  // R3F registers the default controls a moment after mount; closures created earlier must still see them
  const ctrlHook = useThree((st) => st.controls)
  const ctrlRef = useRef(null)
  ctrlRef.current = ctrlHook
  const ctrl = useMemo(
    () =>
      new Proxy(
        {},
        {
          get: (_, k) => {
            const c = ctrlRef.current
            const v = c?.[k]
            return typeof v === 'function' ? v.bind(c) : v
          },
          set: (_, k, val) => {
            if (ctrlRef.current) ctrlRef.current[k] = val
            return true
          },
        }
      ),
    []
  )
  const sunRef = useRef()
  const lampRef = useRef()
  const focusRef = useRef()
  const W = useRef({}).current // scene objects
  const S = useRef({
    mode: 'explore', // explore | tour
    level: 1, // zoom level while exploring: 1 tower · 2 floor · 3 apartment
    floor: DEFAULT.floor,
    selected: false,
    aptId: null,
    roomId: null,
    view: { isolate: 0, lift: 0 },
    tTarget: 0,
    tDisp: 0,
    direct: false,
    tour: null,
    tourKey: '',
    saved: null,
    flying: false,
    tl: null,
    shadowFrames: 3,
    lampI: 0,
    lampTarget: 0,
    hoverApt: null,
    hoverFloor: null,
    lastCaption: -1,
    plate: 'idle', // idle | building | ready
    plateWait: null,
    labelAt: 0,
    labels: '',
    wheelAcc: 0,
    ready: false,
    xoff: 0,
    yoff: 0,
  }).current
  const _eye = useRef(V(0, 0, 0)).current
  const _look = useRef(V(0, 0, 0)).current
  const _v = useRef(V(0, 0, 0)).current

  const emit = () => P.current.onState?.({ level: S.level, floor: S.floor, selected: S.selected, aptId: S.aptId, roomId: S.roomId, mode: S.mode, plate: S.plate })
  const shadow = (n = 3) => (S.shadowFrames = Math.max(S.shadowFrames, n))

  /* ------------------------------ view state → scene ------------------------------ */
  const apply = () => {
    const { isolate } = S.view
    const base = floorBaseY(S.floor)
    const camLow = camera.position.y - base < TOWER.clear - 0.25 && isolate > 0.6
    // floors rise only while the camera is above them; they settle down as it dives into the apartment
    const hf = smooth(camera.position.y, base + 2.4, base + 9.5)
    const lift = S.view.lift * hf
    const hoverFloor = S.level === 1 && S.mode === 'explore' ? S.hoverFloor : null
    const floorSel = hoverFloor ?? (S.selected || isolate > 0.02 ? S.floor : null)
    W.tower?.setView({ floor: floorSel, isolate, lift })
    if (W.plate) {
      const show = isolate > 0.02 && S.plate === 'ready'
      if (W.plate.group.visible !== show) shadow(4)
      W.plate.group.visible = show
      W.plate.group.position.y = base
      const ceil = show && camLow
      if (W.plate.ceiling.visible !== ceil) {
        W.plate.ceiling.visible = ceil
        shadow(4)
      }
    }
    // a warm "walk-light" rides with the camera inside the apartment
    S.lampTarget = camLow ? 1 : 0
    gl.toneMappingExposure = THREE.MathUtils.lerp(1.05, 0.92, S.lampI)
    camera.near = isolate > 0.5 && camera.position.y - base < 12 ? 0.05 : 1
    camera.far = 9000
  }

  const fitShadow = () => {
    const sun = sunRef.current
    if (!sun) return
    let c
    let half
    if (S.view.isolate < 0.5 && S.mode === 'explore') {
      c = V(0, 60, 40)
      half = 230
    } else {
      c = V(0, floorBaseY(S.floor) + 1, 0)
      half = 34
    }
    sun.target.position.copy(c)
    sun.position.copy(c).addScaledVector(SUN, 380)
    sun.target.updateMatrixWorld()
    const s = sun.shadow.camera
    s.left = s.bottom = -half
    s.right = s.top = half
    s.near = 40
    s.far = 900
    s.updateProjectionMatrix()
    shadow(4)
  }

  /* ----------------------------------- camera flights ----------------------------------- */
  // narrow (portrait) screens need the camera further back to keep the same framing
  const kAsp = () => clamp(1 / (camera.aspect || 1), 1, 1.85)
  const limits = (level) => {
    if (!ctrlRef.current) return
    ctrl.enablePan = false
    const wantZoom = true
    if (level === 1) {
      ctrl.enableZoom = wantZoom
      ctrl.minDistance = 95 * kAsp()
      ctrl.maxDistance = 600 * kAsp()
      ctrl.minPolarAngle = 0.25
      ctrl.maxPolarAngle = 1.5
      ctrl.rotateSpeed = 0.5
    } else if (level === 2) {
      ctrl.enableZoom = wantZoom
      ctrl.minDistance = 20 * kAsp()
      ctrl.maxDistance = 135 * kAsp()
      ctrl.minPolarAngle = 0.3
      ctrl.maxPolarAngle = 1.38
      ctrl.rotateSpeed = 0.5
    } else {
      // first-person look-around: orbit radius is tiny and drag is inverted
      ctrl.enableZoom = false
      ctrl.minDistance = ctrl.maxDistance = 0.6
      ctrl.minPolarAngle = 0.35
      ctrl.maxPolarAngle = Math.PI - 0.35
      ctrl.rotateSpeed = -0.4
    }
  }

  /** Smoothly fly the camera (and the view-state) to a pose. */
  const fly = (to, dur = 1.9, { ease = 'power3.inOut', arc = 0 } = {}) =>
    new Promise((resolve) => {
      S.tl?.kill()
      S.flying = true
      if (ctrl) ctrl.enabled = false
      const from = { pos: camera.position.clone(), look: (ctrlRef.current ? ctrl.target : V(0, 0, 0)).clone(), fov: camera.fov, iso: S.view.isolate, lift: S.view.lift }
      const p = { t: 0 }
      const upd = () => {
        const k = p.t
        camera.position.lerpVectors(from.pos, to.pos, k)
        if (arc) camera.position.y += Math.sin(Math.PI * k) * arc
        camera.lookAt(_look.lerpVectors(from.look, to.look, k))
        camera.fov = THREE.MathUtils.lerp(from.fov, to.fov, k)
        camera.updateProjectionMatrix()
        if (to.view) {
          const e = k * k * (3 - 2 * k)
          S.view.isolate = THREE.MathUtils.lerp(from.iso, to.view.isolate, e)
          S.view.lift = THREE.MathUtils.lerp(from.lift, to.view.lift, e)
        }
        apply()
        invalidate()
      }
      S.tl = gsap.to(p, {
        t: 1,
        duration: dur,
        ease,
        onUpdate: upd,
        onComplete: () => {
          upd()
          if (ctrl) {
            // hand control back to OrbitControls from exactly this pose
            ctrl.target.copy(to.ctrlTarget || to.look)
            ctrl.enabled = S.mode === 'explore'
            ctrl.update()
          }
          S.flying = false
          fitShadow()
          resolve()
        },
      })
    })

  const az = () => Math.atan2(camera.position.x - (ctrl?.target.x ?? 0), camera.position.z - (ctrl?.target.z ?? 0))

  const L1 = () => {
    const t = [0, TOP_Y * 0.5, 0]
    // the establishing shot always starts over the Gulf, never inside the city (orbiting is still free)
    const a = clamp(az(), -0.55, 0.95)
    return { pos: orbitPos(t, a, 0.16, 430 * kAsp()), look: V(...t), fov: 32, view: { isolate: 0, lift: 0 } }
  }
  const L2 = (floor) => {
    const t = [0, floorBaseY(floor) + 0.5, 2]
    const a = S.level >= 2 ? az() : 0.45
    return { pos: orbitPos(t, a, 0.98, 96 * kAsp()), look: V(...t), fov: 38, view: { isolate: 1, lift: 1 } }
  }
  const L3 = (aptId, roomId, floor) => {
    const apt = aptById(aptId)
    const base = floorBaseY(floor)
    const rv = roomView(apt, roomId)
    const [ex, ez] = apt.toWorld(rv.eye[0], rv.eye[2])
    const [lx, lz] = apt.toWorld(rv.look[0], rv.look[2])
    const eye = V(ex, base + rv.eye[1], ez)
    const look = V(lx, base + rv.look[1], lz)
    const ctrlTarget = eye.clone().addScaledVector(look.clone().sub(eye).normalize(), 0.6)
    return { pos: eye, look, ctrlTarget, fov: 64, view: { isolate: 1, lift: 1 } }
  }

  /* --------------------------------- progressive plate --------------------------------- */
  const ensurePlate = () => {
    if (S.plate === 'ready') return Promise.resolve()
    if (S.plateWait) return S.plateWait
    S.plate = 'building'
    emit()
    S.plateWait = (async () => {
      const prog = (p, l) => P.current.onProgress?.(p, l)
      prog(0.05, 'Preparing materials')
      await slice()
      for (const pal of ['oak', 'walnut', 'travertine']) {
        explorerMaterials(pal)
        await slice()
      }
      prog(0.2, 'Constructing the floor')
      const plate = buildPlateShell({ quality: tier === 2 ? 1 : 0.55, rich: tier === 2 })
      plate.group.visible = false
      plate.apts = {}
      W.plate = plate
      scene.add(plate.group)
      await slice()
      let n = 0
      for (const apt of apartments) {
        prog(0.3 + 0.12 * n++, `Furnishing Residence ${apt.id}`)
        plate.apts[apt.id] = addApartment(plate, apt, { rich: tier === 2 })
        await slice()
      }
      prog(0.82, 'Lighting')
      plate.group.visible = true
      plate.ceiling.visible = true
      try {
        await gl.compileAsync(scene, camera)
        warmRender(gl, scene, camera, { screen: true })
      } catch {
        /* compile on first use */
      }
      plate.ceiling.visible = false
      plate.group.visible = false
      S.plate = 'ready'
      prog(1, 'Ready')
      shadow(4)
      emit()
      apply()
      invalidate()
    })()
    return S.plateWait
  }

  const nearestApt = () => {
    let best = apartments[0]
    let bd = 1e9
    for (const a of apartments) {
      const d = Math.hypot(a.center[0] - ctrl.target.x, a.center[1] - ctrl.target.z)
      if (d < bd) {
        bd = d
        best = a
      }
    }
    return best.id
  }

  /* -------------------------------------- levels -------------------------------------- */
  const goL1 = async () => {
    S.mode = 'explore'
    S.level = 1
    S.roomId = null
    limits(1)
    emit()
    await fly(L1(), 2.2)
    S.aptId = null
    emit()
  }
  const goL2 = async (floor = S.floor) => {
    S.mode = 'explore'
    const changing = S.level >= 2 && floor !== S.floor
    S.selected = true
    if (changing) {
      // lower the old floor back into the tower, then rise to the new one
      S.level = 2
      limits(2)
      await fly({ pos: camera.position.clone(), look: ctrl.target.clone(), fov: camera.fov, view: { isolate: 0.03, lift: 0 } }, 0.55, { ease: 'power2.in' })
    }
    S.floor = floor
    S.level = 2
    S.roomId = null
    emit()
    await ensurePlate()
    limits(2)
    emit()
    await fly(L2(floor), changing ? 1.7 : 2.4)
    S.aptId = null
    emit()
  }
  const goL3 = async (aptId, roomId = 'living') => {
    S.mode = 'explore'
    await ensurePlate()
    S.aptId = aptId
    S.roomId = roomId
    const fromL3 = S.level === 3
    S.level = 3
    limits(3)
    emit()
    await fly(L3(aptId, roomId, S.floor), fromL3 ? 1.9 : 2.8, { arc: fromL3 ? 0 : 6 })
  }
  const selectFloor = (f) => {
    f = clamp(Math.round(f), 1, TOWER.floors)
    if (S.mode === 'tour') return
    if (S.level === 1) {
      S.floor = f
      S.selected = true
      apply()
      invalidate()
      emit()
    } else goL2(f)
  }

  /* ---------------------------------------- tour ---------------------------------------- */
  const tourFor = () => {
    const aptId = S.aptId || DEFAULT.apt
    const k = kAsp()
    const key = `${aptId}|${S.floor}|${k.toFixed(2)}`
    if (S.tourKey !== key) {
      S.tour = buildTour(aptById(aptId), S.floor, k)
      S.tourKey = key
    }
    return S.tour
  }
  const beginTour = async () => {
    if (S.mode === 'tour') return
    S.tl?.kill()
    S.flying = false
    const lookAt = ctrl.target.clone()
    S.saved = { level: S.level, aptId: S.aptId, roomId: S.roomId, selected: S.selected, floor: S.floor, pos: camera.position.clone(), target: lookAt, fov: camera.fov, view: { ...S.view } }
    const level = S.level
    if (!S.aptId) S.aptId = DEFAULT.apt
    S.selected = true
    S.mode = 'tour'
    const tour = tourFor()
    // start where the visitor already is: tower → floor → apartment
    const startPose = tour.poses[level === 1 ? 0 : level === 2 ? 2 : tour.poses.findIndex((p) => p.id === 'arrival')]
    S.tStart = startPose.a / tour.total
    S.blend = { t: 0, pos: camera.position.clone(), look: lookAt.clone(), fov: camera.fov, iso: S.view.isolate, lift: S.view.lift }
    if (ctrl) ctrl.enabled = false
    emit()
    await ensurePlate()
    return { tStart: S.tStart, total: tour.total }
  }
  const setTour = (t, { direct = false } = {}) => {
    if (S.mode !== 'tour') return
    S.direct = direct
    S.tTarget = clamp(t, 0, 1)
    invalidate()
  }
  const endTour = async ({ restore = true } = {}) => {
    if (S.mode !== 'tour') return
    S.mode = 'explore'
    S.lastCaption = -1
    P.current.onTour?.({ t: 0, stop: null, index: -1 })
    const sv = S.saved
    S.saved = null
    if (!restore || !sv) {
      emit()
      return
    }
    S.floor = sv.floor
    S.aptId = sv.aptId
    S.roomId = sv.roomId
    S.selected = sv.selected
    S.level = sv.level
    limits(sv.level)
    emit()
    await fly({ pos: sv.pos, look: sv.target, ctrlTarget: sv.target, fov: sv.fov, view: sv.view }, 1.4)
  }

  /* ------------------------------------- imperative API ------------------------------------- */
  useImperativeHandle(
    ref,
    () => ({
      goL1,
      goL2,
      goL3,
      goRoom: (id) => goL3(S.aptId || DEFAULT.apt, id),
      selectFloor,
      backOut: () => (S.level === 3 ? goL2(S.floor) : S.level === 2 ? goL1() : null),
      beginTour,
      setTour,
      endTour,
      prepare: () => ensurePlate(),
      zoom: (f) => {
        if (S.mode === 'tour' || S.flying || !ctrl) return
        if (S.level === 3) return f > 1 ? goL2(S.floor) : null
        const off = camera.position.clone().sub(ctrl.target)
        const d = off.length() * f
        const k = kAsp()
        if (S.level === 1 && d < 138 * k) return goL2(S.floor)
        if (S.level === 2 && d > 108 * k) return goL1()
        if (S.level === 2 && d < 27 * k) return goL3(S.hoverApt || nearestApt(), 'living')
        const to = ctrl.target.clone().add(off.setLength(clamp(d, ctrl.minDistance, ctrl.maxDistance)))
        gsap.to(camera.position, { x: to.x, y: to.y, z: to.z, duration: 0.5, ease: 'power2.out', onUpdate: () => (ctrl.update(), invalidate()) })
      },
      reset: () => {
        if (S.mode === 'tour') return
        if (S.level === 3) goL3(S.aptId, S.roomId || 'living')
        else if (S.level === 2) goL2(S.floor)
        else goL1()
      },
      tourInfo: () => {
        const t = tourFor()
        return { total: t.total, tStart: S.tStart || 0, stops: t.stops.filter((s) => s.i >= 2).map((s) => ({ id: s.id, title: s.title, tn: s.tn, i: s.i })) }
      },
      setApartment: (id) => {
        S.aptId = id
        emit()
      },
      state: () => S,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  /* ------------------------------------------ boot ------------------------------------------ */
  useEffect(() => {
    let alive = true
    setFurnitureDetail(tier === 2 ? 1 : 0)
    ;(async () => {
      const prog = (p, l) => P.current.onProgress?.(p, l)
      prog(0.06, 'Preparing the skyline')
      await slice()
      if (!alive) return
      while (alive && !ctrlRef.current) await new Promise((r) => setTimeout(r, 30))
      if (!alive) return
      const city = buildCity({ quality: tier === 2 ? 1 : 0.5, shadows: true })
      scene.add(city.group)
      W.city = city
      prog(0.35, 'Constructing the tower')
      await slice()
      if (!alive) return
      const tower = buildTowerShell({ quality: tier === 2 ? 1 : 0.6 })
      scene.add(tower.root)
      W.tower = tower
      prog(0.62, 'Lighting')
      await slice()
      if (!alive) return
      try {
        await gl.compileAsync(scene, camera)
        if (alive) warmRender(gl, scene, camera, { screen: true })
      } catch {
        /* first frame compiles */
      }
      if (!alive) return
      // opening shot: the whole tower in the Dubai skyline
      const f = L1()
      camera.position.copy(f.pos)
      ctrl.target.copy(f.look)
      camera.fov = f.fov
      camera.updateProjectionMatrix()
      camera.lookAt(f.look)
      ctrl.update()
      limits(1)
      gl.shadowMap.autoUpdate = false
      fitShadow()
      apply()
      S.ready = true
      prog(1, 'Ready')
      P.current.onReady?.()
      emit()
      invalidate()
    })().catch((e) => console.error('[residence explorer] boot failed', e))
    return () => {
      alive = false
      S.tl?.kill()
      gsap.killTweensOf(camera.position)
      if (W.plate) disposeTree(W.plate.group)
      if (W.tower) disposeTree(W.tower.root)
      if (W.city) disposeTree(W.city.group)
      W.plate = W.tower = W.city = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* -------------------------------- per-frame driver -------------------------------- */
  useFrame((st, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    // shadow maps are static: refresh only when something moved
    if (S.shadowFrames > 0) {
      gl.shadowMap.needsUpdate = true
      S.shadowFrames--
      invalidate()
    }
    // floor view: slide the plan left so it sits between the elevator rail and the info card
    const portrait = size.width <= 820
    const wantOff = S.level === 2 && S.mode === 'explore' && S.view.isolate > 0.5 && !portrait ? 0.07 : 0
    const wantY = portrait && S.mode === 'explore' && S.level < 3 ? 0.13 : 0
    if (Math.abs(S.xoff - wantOff) > 0.0004 || Math.abs(S.yoff - wantY) > 0.0004) {
      S.xoff += (wantOff - S.xoff) * (1 - Math.exp(-dt * 4))
      S.yoff += (wantY - S.yoff) * (1 - Math.exp(-dt * 4))
      invalidate()
    }
    if (Math.abs(S.xoff) > 0.0008 || Math.abs(S.yoff) > 0.0008) camera.setViewOffset(size.width, size.height, size.width * S.xoff, size.height * S.yoff, size.width, size.height)
    else if (camera.view && camera.view.enabled) camera.clearViewOffset()
    S.lampI += (S.lampTarget - S.lampI) * (1 - Math.exp(-dt * 5))
    const lamp = lampRef.current
    const focus = focusRef.current
    if (lamp) {
      lamp.intensity = S.lampI * 13
      lamp.position.set(camera.position.x, camera.position.y + 0.55, camera.position.z)
      if (Math.abs(S.lampI - S.lampTarget) > 0.005) invalidate()
    }
    if (S.mode === 'tour' && S.tour) {
      const tour = S.tour
      const diff = S.tTarget - S.tDisp
      if (S.direct) S.tDisp = S.tTarget
      else if (Math.abs(diff) > 2e-5) {
        S.tDisp += diff * (1 - Math.exp(-dt * 5.5))
        invalidate()
      }
      const T = S.tDisp * tour.total
      const r = tour.sample(T, _eye, _look)
      camera.position.copy(_eye)
      camera.lookAt(_look)
      if (Math.abs(camera.fov - r.fov) > 0.01) {
        camera.fov = r.fov
        camera.updateProjectionMatrix()
      }
      S.view.isolate = r.iso
      S.view.lift = r.lift
      // ease in from wherever the visitor was exploring
      const bl = S.blend
      if (bl && bl.t < 1) {
        bl.t = Math.min(1, bl.t + dt / 1.1)
        const e = bl.t * bl.t * (3 - 2 * bl.t)
        camera.position.lerpVectors(bl.pos, _eye, e)
        camera.lookAt(_v.lerpVectors(bl.look, _look, e))
        camera.fov = THREE.MathUtils.lerp(bl.fov, r.fov, e)
        camera.updateProjectionMatrix()
        S.view.isolate = THREE.MathUtils.lerp(bl.iso, r.iso, e)
        S.view.lift = THREE.MathUtils.lerp(bl.lift, r.lift, e)
        invalidate()
      }
      apply()
      if (focus) {
        focus.intensity = S.lampI * 6
        focus.position.set(_look.x, Math.max(_look.y, floorBaseY(S.floor) + 1) + 0.9, _look.z)
      }
      const cap = tour.captionAt(T)
      const idx = cap ? cap.i : -1
      if (idx !== S.lastCaption) {
        S.lastCaption = idx
        P.current.onTour?.({ t: S.tDisp, stop: cap, index: idx })
      }
      P.current.onTourT?.(S.tDisp)
    }
    // apartment labels while the floor is open
    if (S.level === 2 && S.view.isolate > 0.6 && S.mode === 'explore') {
      const now = performance.now()
      if (now - S.labelAt > 70) {
        S.labelAt = now
        const base = floorBaseY(S.floor)
        const out = apartments.map((a) => {
          _v.set(a.center[0], base + 1.4, a.center[1]).project(camera)
          return { id: a.id, x: Math.round((_v.x * 0.5 + 0.5) * size.width), y: Math.round((-_v.y * 0.5 + 0.5) * size.height), on: _v.z < 1 }
        })
        const key = JSON.stringify(out)
        if (key !== S.labels) {
          S.labels = key
          P.current.onLabels?.(out)
        }
      }
    } else if (S.labels) {
      S.labels = ''
      P.current.onLabels?.([])
    }
  })

  /* ------------------------ zoom thresholds (continuous zoom between levels) ------------------------ */
  useEffect(() => {
    const ctrlReal = ctrlHook
    if (!ctrlReal) return
    const onChange = () => {
      invalidate()
      if (S.mode !== 'explore' || S.flying || !S.ready) return
      const d = camera.position.distanceTo(ctrl.target)
      const k = kAsp()
      if (S.level === 1 && d < 138 * k && S.selected) goL2(S.floor)
      else if (S.level === 2 && d > 108 * k) goL1()
      else if (S.level === 2 && d < 25 * k) goL3(S.hoverApt || nearestApt(), 'living')
    }
    ctrlReal.addEventListener('change', onChange)
    return () => ctrlReal.removeEventListener('change', onChange)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctrlHook])

  /* --------------------------------- picking + hover --------------------------------- */
  useEffect(() => {
    const el = gl.domElement
    const ray = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    const cast = (e, objs) => {
      const r = el.getBoundingClientRect()
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(ndc, camera)
      return ray.intersectObjects(objs, false)[0]
    }
    const aptPicks = () => (W.plate ? apartments.map((a) => W.plate.apts[a.id]?.pick).filter(Boolean) : [])
    const roomPicks = () => W.plate?.apts[S.aptId]?.picks.children || []
    const floorAt = (hit) => clamp(Math.floor((hit.point.y - TOWER.podiumH) / TOWER.floorH) + 1, 1, TOWER.floors)
    let down = null
    const onDown = (e) => (down = { x: e.clientX, y: e.clientY })
    const onUp = (e) => {
      if (!down || S.mode !== 'explore' || S.flying || !S.ready) return
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y)
      down = null
      if (moved > 6) return
      if (S.level === 1) {
        const hit = cast(e, [W.tower.pickVolume])
        if (hit) selectFloor(floorAt(hit))
      } else if (S.level === 2) {
        const hit = cast(e, aptPicks())
        if (hit) goL3(hit.object.userData.aptId, 'living')
      } else if (S.level === 3) {
        const hit = cast(e, roomPicks())
        if (hit && hit.object.userData.roomId !== S.roomId) goL3(S.aptId, hit.object.userData.roomId)
      }
    }
    const onMove = (e) => {
      if (down || S.mode !== 'explore' || S.flying || !S.ready) return
      if (S.level === 1) {
        const hit = cast(e, [W.tower.pickVolume])
        const f = hit ? floorAt(hit) : null
        el.style.cursor = f ? 'pointer' : ''
        if (f !== S.hoverFloor) {
          S.hoverFloor = f
          apply()
          invalidate()
          P.current.onHoverFloor?.(f)
        }
      } else if (S.level === 2) {
        const hit = cast(e, aptPicks())
        const id = hit ? hit.object.userData.aptId : null
        el.style.cursor = id ? 'pointer' : ''
        if (id !== S.hoverApt) {
          S.hoverApt = id
          const M = explorerMaterials('oak')
          for (const a of apartments) if (W.plate?.apts[a.id]) W.plate.apts[a.id].pick.material = a.id === id ? M.pickHover : M.pick
          invalidate()
          P.current.onHoverApt?.(id)
        }
      } else if (S.level === 3) {
        const hit = cast(e, roomPicks())
        el.style.cursor = hit && hit.object.userData.roomId !== S.roomId ? 'pointer' : ''
      }
    }
    // Wheel scrolls the PAGE (that drives the scroll tour). Ctrl / ⌘ + wheel zooms the model.
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) {
        e.stopImmediatePropagation()
        return
      }
      if (S.mode !== 'explore') {
        e.stopImmediatePropagation()
        return
      }
      if (S.level === 3) {
        e.preventDefault()
        e.stopImmediatePropagation()
        if (S.flying) return
        S.wheelAcc += e.deltaY
        if (S.wheelAcc > 160) {
          S.wheelAcc = 0
          goL2(S.floor)
        } else if (S.wheelAcc < -160) S.wheelAcc = 0
      }
    }
    // vertical swipes scroll the page on touch; horizontal drags orbit; pinch zooms
    el.style.touchAction = 'pan-y'
    el.addEventListener('wheel', onWheel, { capture: true, passive: false })
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointermove', onMove)
    return () => {
      el.removeEventListener('wheel', onWheel, { capture: true })
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointermove', onMove)
      el.style.cursor = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, camera])

  useEffect(() => {
    const el = gl.domElement
    const hold = () => {
      if (el.style.touchAction !== 'pan-y') el.style.touchAction = 'pan-y'
    }
    hold()
    const id = setInterval(hold, 400)
    return () => clearInterval(id)
  }, [gl, ctrlHook])

  useEffect(() => {
    camera.aspect = size.width / Math.max(1, size.height)
    camera.updateProjectionMatrix()
    invalidate()
  }, [size.width, size.height, camera, invalidate])

  return (
    <>
      <hemisphereLight args={['#fbf2e4', '#bfa98a', 0.55]} />
      <directionalLight
        ref={sunRef}
        color="#ffe2bd"
        intensity={3.2}
        castShadow
        shadow-mapSize={tier === 2 ? [2048, 2048] : [1024, 1024]}
        shadow-bias={-0.0003}
        shadow-normalBias={0.03}
        shadow-radius={3}
      />
      <pointLight ref={lampRef} color="#ffcf9c" intensity={0} distance={11} decay={2} />
      <pointLight ref={focusRef} color="#ffd9aa" intensity={0} distance={9} decay={2} />
    </>
  )
})

/** Drops the render resolution when the frame rate dips (and restores it when there is headroom). */
function Adaptive() {
  const setDpr = useThree((st) => st.setDpr)
  const max = Math.min(window.devicePixelRatio || 1, tier === 2 ? 1.25 : 1.15)
  return <PerformanceMonitor ms={250} iterations={6} onChange={({ factor }) => setDpr(Math.max(0.65, Math.min(max, 0.65 + factor * (max - 0.65))))} />
}

const ExplorerScene = forwardRef(function ExplorerScene({ running, interactiveRef, onState, onProgress, onReady, onTour, onTourT, onLabels, onHoverApt, onHoverFloor }, ref) {
  const P = useRef({})
  P.current = { onState, onProgress, onReady, onTour, onTourT, onLabels, onHoverApt, onHoverFloor, interactiveRef }
  return (
    <Canvas
      frameloop={running ? 'demand' : 'never'}
      dpr={tier === 2 ? [1, 1.25] : [1, 1.15]}
      shadows
      camera={{ fov: 34, near: 1, far: 9000, position: [180, 90, 260] }}
      gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
    >
      <Adaptive />
      <Sky />
      <OrbitControls makeDefault enableDamping dampingFactor={0.07} zoomSpeed={0.8} />
      <World ref={ref} P={P} />
    </Canvas>
  )
})

export default ExplorerScene
