import * as THREE from 'three'
import { makeCanvas } from './canvas.js'

/**
 * Procedural equirectangular sky — used as a reflection environment (via PMREM)
 * and as a background. `sunU` is the horizontal sun position (0..1 around).
 */
export function skyEquirect({ warm = 1, sunU = 0.3, sunV = 0.44 } = {}) {
  const W = 1024
  const H = 512
  const c = makeCanvas(W, H)
  const g = c.getContext('2d')
  const top = warm > 0.5 ? '#a8b9c0' : '#9fb6c4'
  const mid = warm > 0.5 ? '#e6dac8' : '#dfe3e0'
  const hor = warm > 0.5 ? '#f4e1c6' : '#eee9de'
  const grad = g.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, top)
  grad.addColorStop(0.32, mid)
  grad.addColorStop(0.5, hor)
  grad.addColorStop(0.52, '#dccdb3')
  grad.addColorStop(1, '#bfae92')
  g.fillStyle = grad
  g.fillRect(0, 0, W, H)
  const draw = (x) => {
    const glow = g.createRadialGradient(x, sunV * H, 0, x, sunV * H, H * 0.45)
    glow.addColorStop(0, warm > 0.5 ? 'rgba(255,236,210,0.9)' : 'rgba(255,250,238,0.9)')
    glow.addColorStop(0.012, warm > 0.5 ? 'rgba(255,222,186,0.55)' : 'rgba(255,246,228,0.55)')
    glow.addColorStop(0.15, warm > 0.5 ? 'rgba(250,208,160,0.22)' : 'rgba(255,245,225,0.22)')
    glow.addColorStop(1, 'rgba(250,208,160,0)')
    g.fillStyle = glow
    g.fillRect(0, 0, W, H)
    g.fillStyle = 'rgba(255,250,240,0.9)'
    g.beginPath()
    g.arc(x, sunV * H, 1.6, 0, Math.PI * 2)
    g.fill()
  }
  draw(sunU * W)
  // soft cloud streaks
  g.globalAlpha = 0.18
  for (let i = 0; i < 14; i++) {
    g.fillStyle = '#ffffff'
    g.beginPath()
    g.ellipse(Math.random() * W, H * (0.18 + Math.random() * 0.22), 80 + Math.random() * 160, 4 + Math.random() * 6, 0, 0, Math.PI * 2)
    g.fill()
  }
  g.globalAlpha = 1
  const tex = new THREE.CanvasTexture(c)
  tex.mapping = THREE.EquirectangularReflectionMapping
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** Direction vector (pointing *towards* the sun) matching skyEquirect's sunU/sunV. */
export function sunDirection(sunU, sunV) {
  // three.js equirect lookup: u = atan(dir.z, dir.x) / 2π + 0.5, v = asin(dir.y) / π + 0.5
  const theta = (sunU - 0.5) * Math.PI * 2
  const elev = (0.5 - sunV) * Math.PI
  return new THREE.Vector3(Math.cos(theta) * Math.cos(elev), Math.sin(elev), Math.sin(theta) * Math.cos(elev)).normalize()
}
