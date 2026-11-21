import { useEffect, useRef } from 'react'
import { reasons } from '../data.js'
import { gsap } from '../lib/scroll.js'
import { prefersReducedMotion } from '../lib/device.js'

function SkylineLine() {
  return (
    <svg className="why-skyline" viewBox="0 0 600 120" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true">
      <path d="M0 119h600" />
      <path d="M20 119V80h18v39M44 119V60h14v59M64 119V88h22v31M92 119V70h12v49M110 119V52h16v67M134 119V84h20v35" />
      <path d="M170 119V64l8-8 8 8v55M196 119V76h14v43M216 119V90h26v29" />
      <path d="M262 119V40l6-6V8l2-8 2 8v26l6 6v79M254 119V70h8M278 70h8v49" />
      <path d="M306 119V58h20v61M332 119V78h12v41M350 119V46c10 0 18 8 18 18v55M376 119V86h24v33" />
      <path d="M410 119V66h14v53M430 119V54l10-10 10 10v65M458 119V82h20v37M484 119V72h12v47" />
      <path d="M504 119V60h16v59M526 119V90h22v29M556 119V74h14v45M576 119V94h18v25" />
    </svg>
  )
}

export default function WhyDubai() {
  const root = useRef(null)
  useEffect(() => {
    const ctx = gsap.context(() => {
      root.current.querySelectorAll('[data-count]').forEach((el) => {
        const end = +el.dataset.count
        const obj = { v: prefersReducedMotion ? end : 0 }
        el.textContent = String(obj.v)
        gsap.to(obj, {
          v: end,
          duration: 2,
          ease: 'power2.out',
          scrollTrigger: { trigger: el, start: 'top 88%' },
          onUpdate: () => (el.textContent = Math.round(obj.v)),
        })
      })
      gsap.from('.reason', {
        y: 40,
        opacity: 0,
        duration: 1.1,
        ease: 'power3.out',
        stagger: 0.1,
        scrollTrigger: { trigger: '.reasons', start: 'top 82%' },
      })
      gsap.from('.why-skyline path', {
        strokeDasharray: 800,
        strokeDashoffset: 800,
        duration: 3,
        ease: 'power2.inOut',
        stagger: 0.05,
        scrollTrigger: { trigger: '.why-skyline', start: 'top 92%' },
      })
    }, root)
    return () => ctx.revert()
  }, [])

  return (
    <section id="why-dubai" className="section why" ref={root} aria-label="Why invest in Dubai">
      <div className="container why-grid">
        <div className="why-sticky">
          <span className="eyebrow">Why Dubai</span>
          <h2 className="display h2" style={{ margin: '18px 0 26px' }}>
            A city built <em>for the long view</em>
          </h2>
          <p className="lead">
            Political stability, a currency pegged to the US dollar, world-class infrastructure and one of the most transparent property
            registries in the region — Dubai has become the safe harbour for global private wealth.
          </p>
          <SkylineLine />
        </div>
        <div>
          <div className="reasons">
            {reasons.map((r) => (
              <div className="reason" key={r.label}>
                <div className="reason-value">
                  {r.prefix && <small>{r.prefix}</small>}
                  <span data-count={r.value}>{r.value}</span>
                  <small>{r.suffix}</small>
                </div>
                <h4>{r.label}</h4>
                <p>{r.note}</p>
              </div>
            ))}
          </div>
          <p className="why-note">
            Indicative figures for guidance only. Yields vary by community and property; visa and ownership rules are set by the relevant UAE
            authorities and may change. Speak with an advisor for current criteria.
          </p>
        </div>
      </div>
    </section>
  )
}
