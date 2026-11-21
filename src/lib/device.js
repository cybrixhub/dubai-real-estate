// Capability detection — decides how much 3D each device gets.
const mq = (q) => typeof window !== 'undefined' && window.matchMedia(q).matches

export const prefersReducedMotion = mq('(prefers-reduced-motion: reduce)')
export const isTouch = mq('(pointer: coarse)')
export const isSmallScreen = mq('(max-width: 820px)')

function detectWebGL() {
  try {
    const c = document.createElement('canvas')
    return !!c.getContext('webgl2')
  } catch {
    return false
  }
}

export const hasWebGL = typeof window !== 'undefined' && detectWebGL()

const saveData = typeof navigator !== 'undefined' && navigator.connection && navigator.connection.saveData
const lowCores = typeof navigator !== 'undefined' && (navigator.hardwareConcurrency || 8) <= 4

/**
 * 0 = no WebGL / data saver → static poster art only
 * 1 = mobile / low power   → reduced geometry, no shadows or reflections, dpr 1
 * 2 = desktop              → full cinematic quality
 */
export const tier = !hasWebGL || saveData ? 0 : isSmallScreen || isTouch || lowCores ? 1 : 2
