import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { gsap, ScrollTrigger, scrollToTarget } from '../lib/scroll.js'
import { tier, prefersReducedMotion } from '../lib/device.js'
import { useInView } from '../lib/hooks.js'
import { heroState } from '../three/heroState.js'

// The 3D scene is code-split: the page renders instantly with the poster art,
// and the WebGL chunk streams in after first paint.
// The cinematic journey needs the 3D scene and normal motion preferences.
const JOURNEY = tier > 0 && !prefersReducedMotion

let heroChunk = null
const loadHeroScene = () => (heroChunk ||= import('../three/HeroScene.jsx'))
const HeroScene = lazy(loadHeroScene)

function PosterSkyline() {
  // Lightweight SVG skyline — shown instantly, and as the fallback on devices without WebGL.
  return (
    <svg viewBox="0 0 1600 400" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <linearGradient id="haze" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c9c5bb" />
          <stop offset="1" stopColor="#ddd3c2" />
        </linearGradient>
      </defs>
      <g fill="url(#haze)" opacity="0.85">
        <path d="M0 400V330h40v-30h22v50h30v-90h26v90h20v-60h34v60h18V250h30v100h24v-70h28v70h40v-40h30v40h26V230h24v120h30v-80h22v80h36v-50h28v50h32V200h20v150h40v-100h26v100h30v-60h22v60h40V320h30v30h24v-50h28v50h44v-80h26v80h30v-40h22v40h40v-120h26v120h34v-60h30v60h24v-90h22v90h40v-40h30v40h26v-70h20v70h40V300h30v50h36v-60h30v60h40v-30h30v30h40V400z" />
      </g>
      <g fill="#bdb8ad">
        <path d="M612 400V140l6-10v-40l4-20 2-60 2 60 4 20v40l6 10v260z" />
        <path d="M590 400V250h22v150zM634 400V220h20v180z" />
        <path d="M920 400V230h40v170z" />
        <path d="M1240 400V210h18v-8h22v8h18v190z" />
      </g>
    </svg>
  )
}

export default function Hero() {
  const root = useRef(null)
  const [stageRef, inView] = useInView('0px')
  const [mount3D, setMount3D] = useState(false)
  const [ready, setReady] = useState(false)

  // WebGL never competes with first paint or the headline reveal:
  // the chunk downloads/parses immediately, the scene mounts once the reveal has settled.
  useEffect(() => {
    if (tier === 0) return
    loadHeroScene()
    let idleId
    const t = setTimeout(() => {
      const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1))
      idleId = idle(() => setMount3D(true), { timeout: 700 })
    }, prefersReducedMotion ? 0 : 1400)
    return () => {
      clearTimeout(t)
      window.cancelIdleCallback?.(idleId)
    }
  }, [])

  const handleReady = () => {
    setReady(true)
    window.dispatchEvent(new Event('aurelle:hero-ready'))
  }

  // Layout effect: initial "from" states are applied before the browser paints, so the
  // headline never flashes visible-then-hidden.
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      if (!prefersReducedMotion) {
        gsap.from('.hero-title .line-mask > span', { yPercent: 110, duration: 1.5, ease: 'expo.out', stagger: 0.12, delay: 0.15 })
        gsap.from('.hero-anim', { y: 24, opacity: 0, duration: 1.3, ease: 'power3.out', stagger: 0.08, delay: 0.55 })
      }
      if (JOURNEY) {
        // Pinned, scroll-scrubbed journey: aerial city → orbit The Aurelle Gold →
        // through the penthouse glass → interior walkthrough. Progress drives the 3D camera.
        const tl = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            trigger: root.current,
            start: 'top top',
            end: '+=340%',
            pin: true,
            scrub: 0.6,
            anticipatePin: 1,
            onUpdate: (self) => (heroState.progress = self.progress),
          },
        })
        tl.to('.hero-content', { opacity: 0, y: -50, duration: 0.09, ease: 'power1.in' }, 0)
          .to('.hero-veil', { opacity: 0, duration: 0.16 }, 0.03)
          .fromTo('.tour-intro', { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.05 }, 0.2)
          .to('.tour-intro', { autoAlpha: 0, y: -24, duration: 0.05 }, 0.44)
          .fromTo('.hero-flash', { opacity: 0 }, { opacity: 1, duration: 0.04, ease: 'power2.in' }, 0.546)
          .to('.hero-flash', { opacity: 0, duration: 0.07, ease: 'power2.out' }, 0.59)
        gsap.utils.toArray('.tour-card').forEach((el, i) => {
          const at = 0.645 + i * 0.112
          tl.fromTo(el, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.035 }, at)
          if (i < 2) tl.to(el, { autoAlpha: 0, y: -24, duration: 0.035 }, at + 0.085)
        })
        tl.to('.scroll-cue', { opacity: 0, duration: 0.05 }, 0)
        tl.set({}, {}, 1)
      } else {
        ScrollTrigger.create({
          trigger: root.current,
          start: 'top top',
          end: 'bottom top',
          onUpdate: (self) => (heroState.progress = self.progress * 0.15),
        })
      }
    }, root)
    return () => ctx.revert()
  }, [])

  useEffect(() => {
    if (tier === 0) return
    const onMove = (e) => {
      heroState.mouseX = (e.clientX / window.innerWidth) * 2 - 1
      heroState.mouseY = (e.clientY / window.innerHeight) * 2 - 1
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  return (
    <section id="top" ref={root} className={`hero ${ready ? 'is-ready' : ''}`} aria-label="Introduction">
      <div className="hero-stage" ref={stageRef}>
        <div className="hero-poster">
          <PosterSkyline />
        </div>
        {mount3D && (
          <Suspense fallback={null}>
            <HeroScene active={inView} onReady={handleReady} />
          </Suspense>
        )}
      </div>
      <div className="hero-veil" />
      <div className="hero-flash" aria-hidden="true" />
      {JOURNEY && (
        <div className="tour">
          <div className="tour-intro glass">
            <span className="eyebrow">Now releasing</span>
            <h3>The Aurelle Gold</h3>
            <p>24 floors wrapped in brushed-gold fins, set in a private 4-acre park with a reflecting pond.</p>
            <div className="tour-facts">
              <div><strong>96 m</strong><span>Height</span></div>
              <div><strong>124</strong><span>Residences</span></div>
              <div><strong>Q4 2028</strong><span>Handover</span></div>
            </div>
          </div>
          <div className="tour-card glass">
            <span className="eyebrow">Duplex penthouse · Level 23</span>
            <h3>The Salon</h3>
            <p>64 m² of living beneath 3.8 m ceilings, framed by full-height glass on two sides.</p>
          </div>
          <div className="tour-card glass">
            <span className="eyebrow">Entertaining</span>
            <h3>Dining &amp; kitchen</h3>
            <p>A walnut table for ten, a marble island and a linear fireplace in one long, light-filled room.</p>
          </div>
          <div className="tour-card glass">
            <span className="eyebrow">The view</span>
            <h3>270° over the Gulf</h3>
            <p>From the supertall spire to the open sea — golden hour, every evening.</p>
            <a className="btn tour-cta" href="#contact" onClick={(e) => (e.preventDefault(), scrollToTarget('#contact'))}>
              Request a private viewing <span className="arrow" />
            </a>
          </div>
        </div>
      )}
      <div className="hero-content">
        <div className="hero-copy">
          <span className="eyebrow hero-anim">Private residences · Dubai</span>
          <h1 className="display hero-title">
            <span className="line-mask">
              <span>Live above</span>
            </span>
            <span className="line-mask">
              <span>
                <em>the horizon.</em>
              </span>
            </span>
          </h1>
          <p className="hero-sub hero-anim">
            Aurelle curates Dubai’s most exceptional addresses — sky residences, beachfront villas and full-floor penthouses, selected
            for architecture that will still matter in fifty years.
          </p>
          <div className="hero-actions hero-anim">
            <a href="#residences" className="btn" onClick={(e) => (e.preventDefault(), scrollToTarget('#residences'))}>
              Explore residences <span className="arrow" />
            </a>
            <a href="#contact" className="btn btn--ghost" onClick={(e) => (e.preventDefault(), scrollToTarget('#contact'))}>
              Private consultation
            </a>
          </div>
        </div>

        <aside className="hero-card hero-anim" aria-label="Featured release">
          <span className="eyebrow">Now releasing</span>
          <h3>The Aurelle Gold</h3>
          <p>Waterfront Downtown · 24 floors · gold-fin façade</p>
          <div className="row">
            <div>
              <div className="small">Floors available</div>
              <div className="big">9</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="small">From</div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: '1.4rem' }}>AED 6.2M</div>
            </div>
          </div>
        </aside>

        <div className="hero-bottom hero-anim">
          <div className="hero-stats">
            <div>
              <strong>AED 9.4B</strong>
              <span>Transacted</span>
            </div>
            <div>
              <strong>1,280</strong>
              <span>Homes placed</span>
            </div>
            <div>
              <strong>17 yrs</strong>
              <span>In Dubai</span>
            </div>
          </div>
          <div className="scroll-cue">
            <i /> {JOURNEY ? 'Scroll to enter the residence' : 'Scroll to discover'}
          </div>
        </div>
      </div>
    </section>
  )
}
