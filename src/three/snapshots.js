import { useSyncExternalStore } from 'react'
import { tier } from '../lib/device.js'

/*
 * Property imagery is rendered from the 3D models (zero image downloads).
 * The work happens in a Web Worker with OffscreenCanvas, so scrolling and the
 * hero animation never stutter; browsers without OffscreenCanvas WebGL fall
 * back to idle-time rendering on the main thread.
 */

const store = new Map()
const listeners = new Set()
const emit = () => listeners.forEach((l) => l())
const subscribe = (l) => (listeners.add(l), () => listeners.delete(l))

export function useSnapshot(id) {
  return useSyncExternalStore(subscribe, () => store.get(id) || null, () => null)
}

let started = false

export function startSnapshots() {
  if (started || tier === 0) return
  started = true
  const got = new Set()
  const put = (id, blob) => {
    got.add(id)
    store.set(id, URL.createObjectURL(blob))
    emit()
  }

  let fellBack = false
  const mainThread = async () => {
    if (fellBack) return
    fellBack = true
    const idle = () => new Promise((r) => (window.requestIdleCallback ? window.requestIdleCallback(r, { timeout: 600 }) : setTimeout(r, 50)))
    const { renderShots } = await import('./snapshotCore.js')
    await renderShots({ tier, onShot: put, skip: got, idle }).catch(() => {})
  }

  if (typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined') {
    try {
      const worker = new Worker(new URL('./snapshot.worker.js', import.meta.url), { type: 'module' })
      worker.onmessage = ({ data }) => {
        if (data.id) put(data.id, data.blob)
        else if (data.done) worker.terminate()
        else if (data.error) {
          worker.terminate()
          mainThread()
        }
      }
      worker.onerror = () => {
        worker.terminate()
        mainThread()
      }
      worker.postMessage({ tier })
      return
    } catch {
      /* fall through */
    }
  }
  mainThread()
}
