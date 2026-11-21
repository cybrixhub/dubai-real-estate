import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { prefersReducedMotion } from './device.js'

gsap.registerPlugin(ScrollTrigger)
// Mobile URL-bar show/hide must not re-layout pinned sections mid-scroll.
ScrollTrigger.config({ ignoreMobileResize: true })

let lenis = null

export function initSmoothScroll() {
  if (lenis || prefersReducedMotion) return () => {}
  lenis = new Lenis({ duration: 1.15, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true })
  lenis.on('scroll', ScrollTrigger.update)
  if (import.meta.env.DEV) window.__lenis = lenis
  const raf = (time) => lenis.raf(time * 1000)
  gsap.ticker.add(raf)
  gsap.ticker.lagSmoothing(0)
  // Always open on the hero (the intro is designed for it), unless a deep link asks otherwise.
  lenis.scrollTo(0, { immediate: true, force: true })
  if (location.hash.length > 1) {
    const hash = location.hash
    setTimeout(() => scrollToTarget(hash), 600)
  }
  return () => {
    gsap.ticker.remove(raf)
    lenis.destroy()
    lenis = null
  }
}

/** Scroll to an absolute Y position (works with or without Lenis). */
export function scrollToY(y) {
  if (lenis) lenis.scrollTo(y, { duration: 1.4 })
  else window.scrollTo({ top: y, behavior: prefersReducedMotion ? 'auto' : 'smooth' })
}

export function scrollToTarget(target) {
  const el = typeof target === 'string' ? document.getElementById(decodeURIComponent(target.replace(/^#/, ''))) : target
  if (!el) return
  if (lenis)
    lenis.scrollTo(el, {
      offset: 0,
      duration: 1.6,
      // if layout changed mid-flight (lazy content, pin refresh), finish the last stretch precisely
      onComplete: () => {
        if (Math.abs(el.getBoundingClientRect().top) > 4) lenis?.scrollTo(el, { duration: 0.6 })
      },
    })
  else el.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' })
}

export function lockScroll(lock) {
  if (lenis) lock ? lenis.stop() : lenis.start()
  document.documentElement.style.overflow = lock ? 'hidden' : ''
}

export { gsap, ScrollTrigger }
