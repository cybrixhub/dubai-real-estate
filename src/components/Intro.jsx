import { useEffect, useRef } from 'react'
import { gsap } from '../lib/scroll.js'
import { prefersReducedMotion } from '../lib/device.js'

const TEXT =
  'We believe a home in Dubai should be chosen the way great architecture is made — slowly, with intent, and with an eye on the next generation. Every residence we represent is visited, measured and lived in by our team before it reaches you.'

export default function Intro() {
  const root = useRef(null)
  useEffect(() => {
    const ctx = gsap.context(() => {
      if (prefersReducedMotion) {
        gsap.set('.w', { opacity: 1 })
        return
      }
      gsap.to('.w', {
        opacity: 1,
        stagger: 0.04,
        ease: 'none',
        scrollTrigger: { trigger: '.intro-statement', start: 'top 82%', end: 'bottom 45%', scrub: 0.6 },
      })
      gsap.from('.intro-meta > div', {
        y: 30,
        opacity: 0,
        stagger: 0.12,
        duration: 1.1,
        ease: 'power3.out',
        scrollTrigger: { trigger: '.intro-meta', start: 'top 88%' },
      })
    }, root)
    return () => ctx.revert()
  }, [])

  return (
    <section className="section intro" ref={root} aria-label="Our approach">
      <div className="container intro-grid">
        <span className="eyebrow">Our approach</span>
        <div>
          <p className="intro-statement">
            {TEXT.split(' ').map((w, i) => (
              <span key={i} className="w">
                {w}{' '}
              </span>
            ))}
          </p>
          <div className="intro-meta">
            <div>
              <strong style={{ display: 'block', color: 'var(--charcoal)', marginBottom: 6 }}>Curated, not listed</strong>
              Fewer than one in twelve developments we review earns a place in our portfolio.
            </div>
            <div>
              <strong style={{ display: 'block', color: 'var(--charcoal)', marginBottom: 6 }}>One advisor, end to end</strong>
              From first viewing to title deed, Golden Visa and handover — a single point of contact.
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
