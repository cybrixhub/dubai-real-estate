import { renderShots } from './snapshotCore.js'

self.onmessage = async (e) => {
  try {
    const probe = new OffscreenCanvas(1, 1).getContext('webgl2')
    if (!probe) throw new Error('OffscreenCanvas WebGL2 unavailable')
    probe.getExtension('WEBGL_lose_context')?.loseContext()
    await renderShots({
      tier: e.data.tier,
      onShot: (id, blob) => self.postMessage({ id, blob }),
    })
    self.postMessage({ done: true })
  } catch (err) {
    self.postMessage({ error: String(err && err.message ? err.message : err) })
  }
}
