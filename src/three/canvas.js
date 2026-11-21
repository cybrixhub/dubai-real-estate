/** A 2D/WebGL canvas that works on the main thread and inside a Web Worker. */
export function makeCanvas(w, h) {
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    return c
  }
  return new OffscreenCanvas(w, h)
}
