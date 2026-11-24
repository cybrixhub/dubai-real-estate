import * as THREE from 'three'
import { TOWER, TOP_Y, floorBaseY, interiorStops, tierOf, unitNo } from './data.js'

/*
 * One deterministic cinematic path: full tower → the chosen floor lifts clear → the apartment
 * → down the corridor → every room → the balcony.
 * `sample(T)` is a pure function of time, so the scroll-driven tour (scrub) and the automatic
 * tour (play) share it, and scrolling back up reverses it exactly.
 */

const orbit = (target, az, el, r) => [target[0] + r * Math.sin(az) * Math.cos(el), target[1] + r * Math.sin(el), target[2] + r * Math.cos(az) * Math.cos(el)]
const smooth = (s) => s * s * (3 - 2 * s)
const smoother = (s) => s * s * s * (s * (s * 6 - 15) + 10)
const easeIn = (s) => 2 * s * s - s * s * s // ends at unit speed (a pass-through, no stop)
const easeOut = (s) => 1 - easeIn(1 - s)
function ease(s, fromStop, toStop) {
  if (fromStop && toStop) return smoother(s)
  if (fromStop) return easeIn(s)
  if (toStop) return easeOut(s)
  return s
}

export function buildTour(apt, floor, k = 1) {
  const base = floorBaseY(floor)
  const tier = tierOf(floor)
  const toW = (u, h, v) => {
    const [x, z] = apt.toWorld(u, v)
    return [x, base + h, z]
  }
  const doorW = apt.toWorld(apt.lyt.E, apt.lyt.D)
  const dir = Math.sign(doorW[0]) || 1

  const approach = [
    {
      id: 'tower', title: 'The Aurelle Gold', desc: `${TOWER.floors} floors of gold-fin architecture above Downtown Dubai — four residences on every level.`,
      dur: 0, dwell: 2.4, fov: 32, iso: 0, lift: 0, ...pair(orbit([0, TOP_Y * 0.5, 0], 0.62, 0.16, 430 * k), [0, TOP_Y * 0.5, 0]),
    },
    {
      id: 'tower-close', title: `Level ${floor}`, desc: `${tier.name} — ${tier.note}`,
      dur: 4.6, dwell: 0.8, fov: 36, iso: 0, lift: 0, ...pair(orbit([0, base + 1, 0], 0.55, 0.12, 128 * k), [0, base + 1, 0]),
    },
    {
      id: 'floor', title: 'The Floor', desc: 'Four residences share each floor around a central lift lobby, stair and service core.',
      dur: 5.2, dwell: 1.8, fov: 38, iso: 1, lift: 1, ...pair(orbit([0, base, 3], 0.42, 0.98, 96 * k), [0, base, 3]),
    },
    {
      id: 'apartment', title: `Residence ${unitNo(floor, apt.id)}`, desc: `${apt.name} · ${apt.type} · ${apt.interior} m² interior`,
      dur: 3.6, dwell: 1.3, fov: 40, iso: 1, lift: 1, ...pair(orbit([apt.center[0], base, apt.center[1]], 0.3, 1.0, 38 * Math.min(k, 1.5)), [apt.center[0], base, apt.center[1]]),
    },
    {
      id: 'dive', dur: 3.6, dwell: 0, fov: 50, iso: 1, lift: 1,
      eye: [doorW[0] - dir * 7.5, base + 9.5, 0], look: [doorW[0], base + 1.4, 0],
    },
  ]
  const interior = interiorStops(apt).map((s) => ({
    ...s,
    iso: 1,
    lift: 1,
    eye: toW(...[s.eye[0], s.eye[1], s.eye[2]]),
    look: toW(...[s.look[0], s.look[1], s.look[2]]),
  }))
  const poses = [...approach, ...interior].map((p) => ({ ...p, eye: new THREE.Vector3(...p.eye), look: new THREE.Vector3(...p.look) }))

  // timeline
  let t = 0
  poses.forEach((p, i) => {
    p.dur = i === 0 ? 0 : p.dur
    p.a = t + p.dur
    p.l = p.a + (p.dwell || 0)
    t = p.l
  })
  const total = t
  const eyeCurve = new THREE.CatmullRomCurve3(poses.map((p) => p.eye), false, 'centripetal')
  const lookCurve = new THREE.CatmullRomCurve3(poses.map((p) => p.look), false, 'centripetal')
  const n = poses.length
  const DRIFT = 0.04 // slow push-in while a stop is held

  const stops = poses
    .map((p, i) => ({ ...p, i }))
    .filter((p) => p.title)
    .map((p) => ({ i: p.i, id: p.id, title: p.title, desc: p.desc, room: p.room || null, a: p.a, l: p.l, tn: (p.a + p.l) / 2 / total }))

  function locate(T) {
    // → continuous curve index u and the index of the pose we are nearest to
    T = THREE.MathUtils.clamp(T, 0, total)
    for (let k = 0; k < n; k++) {
      const p = poses[k]
      if (T <= p.l) {
        if (T >= p.a) {
          const s = p.l > p.a ? (T - p.a) / (p.l - p.a) : 0
          return Math.min(n - 1, k + DRIFT * smooth(s) * (k < n - 1 ? 1 : 0))
        }
        const prev = poses[k - 1]
        const s = (T - prev.l) / p.dur
        const startU = k - 1 + (prev.dwell > 0 ? DRIFT : 0)
        const e = ease(s, prev.dwell > 0, p.dwell > 0)
        return startU + e * (k - startU)
      }
    }
    return n - 1
  }

  const tmp = new THREE.Vector3()
  function sample(T, eye, look) {
    const u = locate(T)
    const c = u / (n - 1)
    eyeCurve.getPoint(c, eye)
    lookCurve.getPoint(c, look)
    const k = Math.min(n - 2, Math.floor(u))
    const f = u - k
    const fov = THREE.MathUtils.lerp(poses[k].fov, poses[k + 1].fov, f)
    const iso = THREE.MathUtils.lerp(poses[k].iso, poses[k + 1].iso, smooth(f))
    const lift = THREE.MathUtils.lerp(poses[k].lift, poses[k + 1].lift, smooth(f))
    return { fov, iso, lift, u }
  }

  /** The stop whose caption should be on screen at time T (or null). */
  function captionAt(T) {
    for (const s of stops) if (T >= s.a - 0.6 && T <= s.l + 0.5) return s
    return null
  }

  return { poses, stops, total, sample, captionAt, base, t0: tmp }
}

function pair(eye, look) {
  return { eye, look }
}
