// Guards for drei's PerformanceMonitor: frame-rate samples taken while the page is
// hidden, occluded or just resumed (rAF throttled to ~1 fps) say nothing about the GPU.
let resumedAt = 0
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') resumedAt = performance.now()
  })
}

export function trustworthySample() {
  return document.visibilityState === 'visible' && performance.now() - resumedAt > 2500
}
