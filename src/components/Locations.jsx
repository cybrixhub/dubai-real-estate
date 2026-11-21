import { useEffect, useRef, useState } from 'react'
import { locations } from '../data.js'
import { gsap, ScrollTrigger, scrollToY } from '../lib/scroll.js'
import { prefersReducedMotion } from '../lib/device.js'

const VB = { w: 800, h: 600 }

function DubaiMap({ active, worldRef }) {
  return (
    <svg viewBox={`0 0 ${VB.w} ${VB.h}`} preserveAspectRatio="xMidYMid slice" role="img" aria-label="Stylised map of Dubai's coastline">
      <defs>
        <pattern id="dots" width="9" height="9" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="0.8" fill="rgba(48,54,56,0.13)" />
        </pattern>
        <pattern id="waves" width="40" height="12" patternUnits="userSpaceOnUse">
          <path d="M0 6 Q10 2 20 6 T40 6" fill="none" stroke="rgba(110,135,130,0.18)" strokeWidth="0.8" />
        </pattern>
        <linearGradient id="sea" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#dfe5dc" />
          <stop offset="1" stopColor="#e9ebe1" />
        </linearGradient>
      </defs>
      <g ref={worldRef}>
        <rect x="-400" y="-400" width="1600" height="1400" fill="#ede6d9" />
        <rect x="-400" y="-400" width="1600" height="1400" fill="url(#dots)" />
        {/* sea */}
        <path
          d="M-400 560 L0 470 C120 440 200 400 300 360 S480 282 560 240 S700 168 800 120 L1200 30 L1200 -400 L-400 -400 Z"
          fill="url(#sea)"
        />
        <path
          d="M-400 560 L0 470 C120 440 200 400 300 360 S480 282 560 240 S700 168 800 120 L1200 30 L1200 -400 L-400 -400 Z"
          fill="url(#waves)"
        />
        <path d="M-400 560 L0 470 C120 440 200 400 300 360 S480 282 560 240 S700 168 800 120 L1200 30" fill="none" stroke="#b9a88d" strokeWidth="1.4" />
        {/* creek */}
        <path d="M655 196 C640 240 610 260 600 300 S590 380 620 430 S700 470 760 520" fill="none" stroke="#c9d3c8" strokeWidth="9" strokeLinecap="round" />
        {/* Sheikh Zayed Road */}
        <path d="M-60 560 C110 520 220 470 330 430 S520 360 600 330" fill="none" stroke="rgba(48,54,56,0.22)" strokeWidth="1.2" strokeDasharray="1 0" />
        <path d="M-60 566 C110 526 220 476 330 436 S520 366 600 336" fill="none" stroke="rgba(48,54,56,0.12)" strokeWidth="1" />
        {/* marina canal */}
        <path d="M150 432 C160 410 175 400 190 396" fill="none" stroke="#c9d3c8" strokeWidth="5" strokeLinecap="round" />
        {/* Palm Jumeirah */}
        <g transform="translate(288 366) rotate(-24)" fill="#e6dbc6" stroke="#b9a88d" strokeWidth="0.8">
          <rect x="-3.5" y="-78" width="7" height="78" rx="2" />
          {Array.from({ length: 8 }).map((_, i) => {
            const y = -26 - i * 6.5
            const L = 30 - i * 1.2
            return (
              <g key={i}>
                <path d={`M-2 ${y} L${-L} ${y - 16}`} strokeWidth="4.5" stroke="#e6dbc6" strokeLinecap="round" />
                <path d={`M2 ${y} L${L} ${y - 16}`} strokeWidth="4.5" stroke="#e6dbc6" strokeLinecap="round" />
              </g>
            )
          })}
          <path d="M-50 -46 A52 52 0 1 1 50 -46" fill="none" strokeWidth="5" stroke="#e6dbc6" strokeLinecap="round" />
          <path d="M-50 -46 A52 52 0 1 1 50 -46" fill="none" strokeWidth="0.8" stroke="#b9a88d" />
        </g>
        {/* skyline marks */}
        <g fill="rgba(48,54,56,0.25)">
          <rect x="508" y="290" width="4" height="22" />
          <rect x="500" y="300" width="3" height="12" />
          <rect x="517" y="298" width="3" height="14" />
          <rect x="160" y="400" width="3" height="14" />
          <rect x="167" y="396" width="3" height="18" />
          <rect x="174" y="402" width="3" height="12" />
        </g>
        {/* district labels */}
        <g fontFamily="Manrope Variable, Manrope Fallback, sans-serif" fontSize="8" letterSpacing="2.4" fill="rgba(48,54,56,0.45)">
          <text x="70" y="250">ARABIAN GULF</text>
          <text x="640" y="380">DUBAI CREEK</text>
          <text x="340" y="480">AL BARSHA</text>
          <text x="660" y="250">DEIRA</text>
        </g>
        {/* pins */}
        {locations.map((l, i) => {
          const on = i === active
          return (
            <g key={l.id} className="pin" transform={`translate(${l.pin[0]} ${l.pin[1]})`} opacity={on ? 1 : 0.55}>
              {on && <circle className="pin-ring" r="9" fill="none" stroke="#303638" strokeWidth="0.8" />}
              <circle r={on ? 5 : 3.5} fill={on ? '#303638' : '#8d7f6c'} />
              <text
                x="12"
                y="4"
                fontFamily="Cormorant Garamond, Cormorant Fallback, serif"
                fontSize={on ? 17 : 12}
                fill="#303638"
                style={{ transition: 'font-size .6s' }}
              >
                {l.name}
              </text>
            </g>
          )
        })}
      </g>
    </svg>
  )
}

export default function Locations() {
  const root = useRef(null)
  const pinRef = useRef(null)
  const world = useRef(null)
  const [active, setActive] = useState(0)
  const activeRef = useRef(0)
  const triggerRef = useRef(null)
  const cam = useRef({ x: 400, y: 330, s: 1 })

  // Map camera: glide towards the active pin.
  useEffect(() => {
    const [px, py] = locations[active].pin
    const apply = () => {
      const { x, y, s } = cam.current
      world.current?.setAttribute('transform', `translate(${VB.w / 2 - x * s} ${VB.h / 2 - y * s}) scale(${s})`)
    }
    const tw = gsap.to(cam.current, {
      // phones get a closer crop so labels stay legible in the shorter map band
      x: px + (window.innerWidth < 820 ? 30 : 50),
      y: py - (window.innerWidth < 820 ? 5 : 20),
      s: window.innerWidth < 820 ? 1.75 : 1.12,
      duration: prefersReducedMotion ? 0 : 1.8,
      ease: 'power3.inOut',
      onUpdate: apply,
    })
    apply()
    return () => tw.kill()
  }, [active])

  useEffect(() => {
    const ctx = gsap.context(() => {
      const steps = locations.length
      triggerRef.current = ScrollTrigger.create({
        trigger: pinRef.current,
        start: 'top top',
        end: () => `+=${window.innerHeight * (steps - 0.4)}`,
        pin: true,
        anticipatePin: 1,
        onUpdate: (self) => {
          const i = Math.min(steps - 1, Math.floor(self.progress * steps * 0.999))
          if (i !== activeRef.current) {
            activeRef.current = i
            setActive(i)
          }
        },
      })
    }, root)
    return () => ctx.revert()
  }, [])

  useEffect(() => {
    if (prefersReducedMotion) return
    const el = root.current?.querySelector(`.loc-step[data-i="${active}"]`)
    if (!el) return
    const tw = gsap.fromTo(
      el.querySelectorAll('.anim'),
      { y: 36, opacity: 0 },
      { y: 0, opacity: 1, duration: 1.1, ease: 'power3.out', stagger: 0.07 }
    )
    return () => tw.kill()
  }, [active])

  const jump = (i) => {
    const t = triggerRef.current
    if (!t) return setActive(i)
    const y = t.start + ((t.end - t.start) * (i + 0.5)) / locations.length
    scrollToY(y)
  }

  return (
    <section id="locations" className="section locations" ref={root} aria-label="Dubai locations">
      <div className="loc-pin" ref={pinRef}>
        <div className="loc-text">
          <span className="eyebrow">Neighbourhoods</span>
          <div className="loc-steps">
            {locations.map((l, i) => (
              <article key={l.id} data-i={i} className={`loc-step ${i === active ? 'is-active' : ''}`} aria-hidden={i !== active}>
                <div className="count anim">
                  {String(i + 1).padStart(2, '0')} / {String(locations.length).padStart(2, '0')}
                </div>
                <h3 className="display anim">{l.name}</h3>
                <p className="tag anim">{l.tagline}</p>
                <p className="anim">{l.copy}</p>
                <div className="loc-stats anim">
                  {l.stats.map(([v, k]) => (
                    <div key={k}>
                      <strong>{v}</strong>
                      <span>{k}</span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
          <div className="loc-progress" role="tablist" aria-label="Choose neighbourhood">
            {locations.map((l, i) => (
              <button key={l.id} role="tab" aria-selected={i === active} aria-label={l.name} className={i <= active ? 'is-active' : ''} onClick={() => jump(i)} />
            ))}
          </div>
        </div>
        <div className="loc-map">
          <DubaiMap active={active} worldRef={world} />
        </div>
      </div>
    </section>
  )
}
