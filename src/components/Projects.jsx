import { useCallback, useEffect, useRef, useState } from 'react'
import { projects, formatAED } from '../data.js'
import { useSnapshot } from '../three/snapshots.js'
import { gsap, ScrollTrigger, lockScroll, scrollToTarget } from '../lib/scroll.js'
import { tier } from '../lib/device.js'

const FILTERS = ['All', 'Apartments', 'Villas', 'Penthouses']

function Media({ shot, alt, children }) {
  const src = useSnapshot(shot)
  const [loaded, setLoaded] = useState(false)
  return (
    <div className="card-media">
      {!loaded && tier > 0 && <div className="shimmer" />}
      {src && <img src={src} alt={alt} className={loaded ? 'is-loaded' : ''} onLoad={() => setLoaded(true)} decoding="async" />}
      {children}
    </div>
  )
}

function Card({ p, onOpen }) {
  return (
    <article className="card">
      <Media shot={p.shot} alt={`${p.name} — ${p.area}`}>
        <div className="card-badges">
          <span className="badge">{p.type}</span>
          <span className={`badge ${p.status === 'Ready' ? '' : 'badge--dark'}`}>{p.status}</span>
        </div>
        <div className="card-view">
          <div>
            Beds<strong>{p.beds}</strong>
          </div>
          <div>
            Size<strong>{p.size.split(' ')[0]}+</strong>
          </div>
          <div>
            Handover<strong>{p.handover.replace('Ready to move', 'Ready')}</strong>
          </div>
        </div>
      </Media>
      <div className="card-body">
        <div>
          <h3>
            {/* stretched button: the whole card is clickable, markup stays valid */}
            <button className="card-hit" onClick={(e) => onOpen(p, e.currentTarget)} aria-haspopup="dialog">
              {p.name}
            </button>
          </h3>
          <div className="card-loc">{p.area}</div>
        </div>
        <div className="card-price">
          <small>From</small>
          <strong>{formatAED(p.price)}</strong>
        </div>
      </div>
    </article>
  )
}

function ProjectModal({ p, onClose, onEnquire }) {
  const open = !!p
  const [last, setLast] = useState(p)
  const closeRef = useRef(null)
  const panelRef = useRef(null)
  const wasOpen = useRef(false)
  useEffect(() => {
    if (p) setLast(p)
  }, [p])
  useEffect(() => {
    if (open === wasOpen.current) return
    wasOpen.current = open
    lockScroll(open)
    if (!open) return
    closeRef.current?.focus({ preventScroll: true })
    const onKey = (e) => {
      if (e.key === 'Escape') return onClose()
      if (e.key !== 'Tab') return
      // keep keyboard focus inside the dialog
      const f = panelRef.current.querySelectorAll('button, a[href], input, select, textarea')
      const first = f[0]
      const last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  const d = p || last
  const src = useSnapshot(d?.shot)
  return (
    <div className={`modal ${open ? 'is-open' : ''}`} role="dialog" aria-modal="true" aria-hidden={!open} aria-label={d?.name}>
      <button className="modal-backdrop" aria-label="Close" onClick={onClose} tabIndex={-1} />
      <div className="modal-panel" data-lenis-prevent ref={panelRef}>
        <button className="modal-close" ref={closeRef} onClick={onClose} aria-label="Close details">
          ×
        </button>
        {d && (
          <>
            <div className="modal-media">{src && <img src={src} alt={d.name} decoding="async" />}</div>
            <div className="modal-content">
              <span className="eyebrow">
                {d.area} · {d.status}
              </span>
              <h3 className="display">{d.name}</h3>
              <p className="lead">{d.copy}</p>
              <div className="spec-grid">
                <div>
                  Starting price<strong>{formatAED(d.price)}</strong>
                </div>
                <div>
                  Bedrooms<strong>{d.beds}</strong>
                </div>
                <div>
                  Interior<strong>{d.size}</strong>
                </div>
                <div>
                  Handover<strong>{d.handover}</strong>
                </div>
                <div>
                  Payment<strong>{d.plan}</strong>
                </div>
                <div>
                  Type<strong>{d.type}</strong>
                </div>
              </div>
              <ul className="feature-list">
                {d.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button
                  className="btn"
                  onClick={() => {
                    onEnquire?.(`${d.name} — ${d.area}`)
                    onClose()
                    setTimeout(() => scrollToTarget('#contact'), 450)
                  }}
                >
                  Request brochure <span className="arrow" />
                </button>
                <button className="btn btn--ghost" onClick={onClose}>
                  Back to projects
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function Projects({ onEnquire }) {
  const [filter, setFilter] = useState('All')
  const [open, setOpen] = useState(null)
  const opener = useRef(null)
  const openProject = useCallback((p, el) => {
    opener.current = el
    setOpen(p)
  }, [])
  const closeProject = useCallback(() => {
    setOpen(null)
    opener.current?.focus({ preventScroll: true }) // return focus to the card that opened the dialog
  }, [])
  const root = useRef(null)
  const list = projects.filter((p) => filter === 'All' || p.type === filter)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.projects-head > *', {
        y: 40,
        opacity: 0,
        stagger: 0.1,
        duration: 1.2,
        ease: 'power3.out',
        scrollTrigger: { trigger: '.projects-head', start: 'top 82%' },
      })
    }, root)
    return () => ctx.revert()
  }, [])

  useEffect(() => {
    const cards = root.current.querySelectorAll('.card')
    const tw = gsap.fromTo(
      cards,
      { y: 60, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 1.2,
        ease: 'power3.out',
        stagger: 0.08,
        scrollTrigger: { trigger: root.current.querySelector('.grid'), start: 'top 85%' },
      }
    )
    ScrollTrigger.refresh()
    return () => {
      tw.scrollTrigger?.kill()
      tw.kill()
    }
  }, [filter])

  return (
    <section id="projects" className="section" ref={root} aria-label="Featured projects">
      <div className="container">
        <div className="projects-head">
          <div>
            <span className="eyebrow">Featured developments</span>
            <h2 className="display h2" style={{ marginTop: 18 }}>
              Selected <em>addresses</em>
            </h2>
          </div>
          <div className="filters" role="tablist" aria-label="Filter by type">
            {FILTERS.map((f) => (
              <button key={f} role="tab" aria-selected={filter === f} className={`chip ${filter === f ? 'is-active' : ''}`} onClick={() => setFilter(f)}>
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="grid">
          {list.map((p) => (
            <Card key={p.id} p={p} onOpen={openProject} />
          ))}
        </div>
      </div>
      <ProjectModal p={open} onClose={closeProject} onEnquire={onEnquire} />
    </section>
  )
}
