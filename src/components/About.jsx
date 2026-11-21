import { useEffect, useRef, useState } from 'react'
import { useSnapshot } from '../three/snapshots.js'
import { gsap } from '../lib/scroll.js'
import { prefersReducedMotion } from '../lib/device.js'

export default function About() {
  const root = useRef(null)
  const src = useSnapshot('tower-crown')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (prefersReducedMotion) return
    const ctx = gsap.context(() => {
      gsap.fromTo('.about-parallax', { yPercent: -10 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: '.about-media', scrub: true } })
      gsap.from('.about-copy > *', {
        y: 36,
        opacity: 0,
        duration: 1.1,
        stagger: 0.1,
        ease: 'power3.out',
        scrollTrigger: { trigger: '.about-copy', start: 'top 80%' },
      })
      gsap.from('.about-media', {
        clipPath: 'inset(12% 12% 12% 12%)',
        duration: 1.8,
        ease: 'expo.out',
        scrollTrigger: { trigger: '.about-media', start: 'top 85%' },
      })
    }, root)
    return () => ctx.revert()
  }, [])

  return (
    <section id="about" className="section" ref={root} aria-label="About Aurelle">
      <div className="container about-grid">
        <div className="about-media">
          {/* parallax wrapper always exists, so the scroll tween has a target before the render arrives */}
          <div className="about-parallax">
            {src && (
              <img
                src={src}
                alt="Crown of The Aurelle Sky Residences at golden hour"
                decoding="async"
                onLoad={() => setLoaded(true)}
                style={{ opacity: loaded ? 1 : 0, transition: 'opacity 1.2s' }}
              />
            )}
          </div>
          <span className="caption">The Aurelle · Downtown</span>
        </div>
        <div className="about-copy">
          <span className="eyebrow">About Aurelle</span>
          <h2 className="display h2" style={{ marginTop: 18 }}>
            Quietly <em>exceptional</em>
          </h2>
          <p className="lead" style={{ marginTop: 26 }}>
            Founded in 2009 by a small team of architects and private bankers, Aurelle advises families, founders and family offices on
            Dubai’s finest residential real estate. We work with a handful of developers whose craft we know first-hand — and we tell our
            clients when the right answer is to wait.
          </p>
          <p className="quote">“The best home is rarely the most visible one. Our work is to find it before anyone else does.”</p>
          <div className="quote-by">Layla Haddad — Founding Partner</div>
          <div className="pillars">
            <div>
              <strong>32</strong>
              <span>Nationalities represented</span>
            </div>
            <div>
              <strong>4.9</strong>
              <span>Average client rating</span>
            </div>
            <div>
              <strong>68%</strong>
              <span>Clients who return</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
