import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TOWER, apartments, aptById, tierOf, unitNo } from '../explorer/data.js'
import { useInView } from '../lib/hooks.js'
import { tier, isTouch } from '../lib/device.js'
import { gsap, ScrollTrigger } from '../lib/scroll.js'
import '../explorer/explorer.css'

// The explorer's 3D code (tower, apartments, furniture, tour) is its own lazy chunk.
const ExplorerScene = lazy(() => import('../explorer/ExplorerScene.jsx'))

const N = TOWER.floors
const SCROLL_VH = 950 // how much page scroll the cinematic tour spans
const P0 = 0.035 // scroll progress at which the tour takes over from free exploration
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const ROOM_ORDER = ['gallery', 'living', 'dining', 'kitchen', 'master', 'mbath', 'bedroom2', 'bath2', 'balcony']

/* ------------------------------- floor elevator ------------------------------- */
function Elevator({ floor, selected, onCommit, disabled }) {
  const ref = useRef(null)
  const [drag, setDrag] = useState(null)
  const at = (y) => {
    const r = ref.current.getBoundingClientRect()
    return clamp(Math.round((1 - clamp((y - r.top) / r.height, 0, 1)) * (N - 1)) + 1, 1, N)
  }
  const shown = drag ?? floor
  const pct = ((shown - 1) / (N - 1)) * 100
  return (
    <div className={`xp-elev glass ${disabled ? 'is-off' : ''}`}>
      <span className="eyebrow">Floor</span>
      <button className="icon-btn" aria-label="Floor up" disabled={disabled || floor >= N} onClick={() => onCommit(floor + 1)}>
        ▴
      </button>
      <div
        ref={ref}
        className="xp-elev-rail"
        role="slider"
        aria-label="Floor"
        aria-valuemin={1}
        aria-valuemax={N}
        aria-valuenow={shown}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') onCommit(clamp(floor + 1, 1, N))
          if (e.key === 'ArrowDown') onCommit(clamp(floor - 1, 1, N))
        }}
        onPointerDown={(e) => {
          if (disabled) return
          e.currentTarget.setPointerCapture(e.pointerId)
          setDrag(at(e.clientY))
        }}
        onPointerMove={(e) => drag != null && setDrag(at(e.clientY))}
        onPointerUp={(e) => {
          if (drag == null) return
          const f = at(e.clientY)
          setDrag(null)
          onCommit(f)
        }}
        onPointerCancel={() => setDrag(null)}
      >
        {Array.from({ length: N }, (_, i) => (
          <i key={i} className={(i + 1) % 5 === 0 || i === 0 ? 'major' : ''} style={{ bottom: `${(i / (N - 1)) * 100}%` }} />
        ))}
        <b className={selected ? 'on' : ''} style={{ bottom: `${pct}%` }}>
          {shown}
        </b>
      </div>
      <button className="icon-btn" aria-label="Floor down" disabled={disabled || floor <= 1} onClick={() => onCommit(floor - 1)}>
        ▾
      </button>
    </div>
  )
}

/* ----------------------------------- the section ----------------------------------- */
export default function Explorer() {
  const root = useRef(null)
  const track = useRef(null)
  const stage = useRef(null)
  const scene = useRef(null)
  const railFill = useRef(null)
  const railPct = useRef(null)
  const [nearRef, near] = useInView('120% 0px', true)
  const [visRef, visible] = useInView('0px')
  const [preload, setPreload] = useState(false)
  const [ready, setReady] = useState(false)
  const [progress, setProgress] = useState({ p: 0, label: 'Preparing the skyline' })
  const [ui, setUi] = useState({ level: 1, floor: 28, selected: false, aptId: null, roomId: null, mode: 'explore', plate: 'idle' })
  const [xp, setXp] = useState('explore') // explore | scroll | auto
  const xpRef = useRef('explore')
  const [caption, setCaption] = useState(null)
  const [stops, setStops] = useState([])
  const [labels, setLabels] = useState([])
  const [hoverApt, setHoverApt] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [autoDone, setAutoDone] = useState(false)
  const [full, setFull] = useState(false)
  const tourInfo = useRef({ total: 100, tStart: 0 })
  const auto = useRef({ t: 0, playing: false, raf: 0, last: 0 })
  const scrolled = useRef(0)
  const busy = useRef(0)

  const apt = ui.aptId ? aptById(ui.aptId) : null
  const tierInfo = tierOf(ui.floor)
  const room = apt && ui.roomId ? apt.rooms.find((r) => r.id === ui.roomId) : null
  const rooms = apt ? ROOM_ORDER.map((id) => apt.rooms.find((r) => r.id === id)) : []

  const setStageRef = useCallback(
    (el) => {
      stage.current = el
      nearRef.current = el
      visRef.current = el
    },
    [nearRef, visRef]
  )
  const setMode = (m) => {
    xpRef.current = m
    setXp(m)
  }

  // warm the explorer while the visitor idles at the top (after the hero + showcase), never mid-scroll
  useEffect(() => {
    if (tier === 0) return
    let t
    const idleCb = window.requestIdleCallback || ((cb) => setTimeout(cb, 1))
    const check = () => (window.scrollY < 40 ? idleCb(() => setPreload(true), { timeout: 2000 }) : (t = setTimeout(check, 4000)))
    const onReady = () => (t = setTimeout(check, 22000))
    window.addEventListener('aurelle:hero-ready', onReady)
    return () => {
      clearTimeout(t)
      window.removeEventListener('aurelle:hero-ready', onReady)
    }
  }, [])

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.xp-head > *', { y: 40, opacity: 0, duration: 1.2, ease: 'power3.out', stagger: 0.12, scrollTrigger: { trigger: '.xp-head', start: 'top 82%' } })
    }, root)
    return () => ctx.revert()
  }, [])

  /* ------------------------------- scroll-driven tour ------------------------------- */
  const tourT = useCallback((v) => {
    if (railFill.current) railFill.current.style.transform = `scaleY(${v.toFixed(4)})`
    if (railPct.current) railPct.current.textContent = `${Math.round(v * 100)}%`
  }, [])

  const tourReady = useRef(false)
  const enterScrollTour = useCallback(async () => {
    const api = scene.current
    if (!api) return
    tourReady.current = false
    setMode('scroll')
    const info = await api.beginTour()
    if (!info || xpRef.current !== 'scroll') return
    tourInfo.current = info
    tourReady.current = true
    setStops(api.tourInfo().stops)
    setAutoDone(false)
    // catch up with wherever the page is now
    const p = scrolled.current
    api.setTour(info.tStart + (1 - info.tStart) * clamp((p - P0) / (1 - P0), 0, 1), { direct: true })
  }, [])

  useEffect(() => {
    if (!ready) return
    const st = ScrollTrigger.create({
      trigger: track.current,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => {
        scrolled.current = self.progress
        if (xpRef.current === 'auto') return
        const p = self.progress
        const api = scene.current
        if (!api) return
        if (p > P0) {
          if (xpRef.current !== 'scroll') enterScrollTour()
          else if (tourReady.current) {
            const { tStart } = tourInfo.current
            api.setTour(tStart + (1 - tStart) * clamp((p - P0) / (1 - P0), 0, 1))
          }
        } else if (xpRef.current === 'scroll') {
          tourReady.current = false
          setMode('explore')
          setCaption(null)
          api.endTour()
          tourT(0)
        }
      },
    })
    return () => st.kill()
  }, [ready, enterScrollTour, tourT])

  /* ------------------------------------ auto tour ------------------------------------ */
  const stopLoop = () => {
    cancelAnimationFrame(auto.current.raf)
    auto.current.playing = false
  }
  const loop = useCallback((now) => {
    const a = auto.current
    if (!a.playing) return
    const dt = Math.min(0.05, (now - a.last) / 1000)
    a.last = now
    if (visibleRef.current) {
      a.t = Math.min(1, a.t + dt / tourInfo.current.total)
      scene.current?.setTour(a.t, { direct: true })
      tourT(a.t)
    }
    if (a.t >= 1) {
      a.playing = false
      setPlaying(false)
      setAutoDone(true)
      return
    }
    a.raf = requestAnimationFrame(loop)
  }, [tourT])
  const visibleRef = useRef(true)
  visibleRef.current = visible

  const startAuto = useCallback(
    async (fromStart = true) => {
      const api = scene.current
      if (!api) return
      stopLoop()
      setMode('auto')
      setAutoDone(false)
      if (fromStart || ui.mode !== 'tour') {
        const info = await api.beginTour()
        if (info) tourInfo.current = info
        setStops(api.tourInfo().stops)
        auto.current.t = tourInfo.current.tStart || 0
      }
      api.setTour(auto.current.t, { direct: true })
      auto.current.playing = true
      auto.current.last = performance.now()
      setPlaying(true)
      auto.current.raf = requestAnimationFrame(loop)
    },
    [loop, ui.mode]
  )
  const togglePlay = () => {
    const a = auto.current
    if (autoDone) return startAuto(true)
    if (a.playing) {
      stopLoop()
      setPlaying(false)
    } else {
      a.playing = true
      a.last = performance.now()
      setPlaying(true)
      a.raf = requestAnimationFrame(loop)
    }
  }
  const exitTour = useCallback(() => {
    stopLoop()
    setPlaying(false)
    setAutoDone(false)
    setCaption(null)
    tourT(0)
    const api = scene.current
    if (xpRef.current === 'auto' && scrolled.current > P0) {
      // scrolled into the track: resume the scroll-driven tour from the page position
      setMode('scroll')
      const { tStart } = tourInfo.current
      api?.setTour(tStart + (1 - tStart) * clamp((scrolled.current - P0) / (1 - P0), 0, 1), { direct: true })
    } else {
      setMode('explore')
      api?.endTour()
    }
  }, [tourT])
  useEffect(() => () => cancelAnimationFrame(auto.current.raf), [])

  /* -------------------------------- exploring actions -------------------------------- */
  const commitFloor = useCallback((f) => {
    const now = performance.now()
    if (now - busy.current < 350) return
    busy.current = now
    scene.current?.selectFloor(f)
  }, [])
  const goLevel = (l) => {
    const api = scene.current
    if (!api || xp !== 'explore') return
    if (l === 1) api.goL1()
    else if (l === 2) api.goL2(ui.floor)
    else api.goL3(ui.aptId || hoverApt || 'D', ui.roomId || 'living')
  }
  const stepRoom = (d) => {
    const i = rooms.findIndex((r) => r.id === ui.roomId)
    scene.current?.goRoom(rooms[(i + d + rooms.length) % rooms.length].id)
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape' || document.fullscreenElement || !visible) return
      if (xpRef.current === 'auto') exitTour()
      else if (xpRef.current === 'explore') scene.current?.backOut()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visible, exitTour])

  const toggleFull = () => {
    if (!document.fullscreenElement) stage.current?.requestFullscreen?.().catch(() => {})
    else document.exitFullscreen?.()
  }
  useEffect(() => {
    const on = () => setFull(document.fullscreenElement === stage.current)
    document.addEventListener('fullscreenchange', on)
    return () => document.removeEventListener('fullscreenchange', on)
  }, [])

  const onReady = useCallback(() => {
    setReady(true)
    setTimeout(() => ScrollTrigger.refresh(), 50)
  }, [])
  const onTour = useCallback(({ stop }) => setCaption(stop), [])
  const dive = ui.mode === 'tour'
  const loading = tier > 0 && (!ready || (ui.plate === 'building' && progress.p < 1))
  const levelLabel = ['', 'Tower', 'Floor', 'Residence'][ui.level]
  const hint = dive
    ? isTouch ? 'Scroll to move through the residence' : 'Scroll to move through the residence'
    : isTouch ? 'Drag to orbit · pinch to zoom' : 'Drag to orbit · Ctrl + scroll to zoom · scroll to begin the tour'
  const capRoom = caption?.room && apt ? apt.rooms.find((r) => r.id === caption.room) : null

  return (
    <section id="explore" className="xp" ref={root} aria-label="Interactive 3D residence explorer">
      <div className="xp-head">
        <span className="eyebrow">Residence explorer · in 3D</span>
        <h2 className="display h2">
          Explore Every <em>Corner</em>
        </h2>
        <p className="lead">Step inside a new dimension of luxury living.</p>
        <p className="xp-note">
          The Aurelle Gold is an illustrative demonstration tower: forty floors, four residences on each. Layouts and areas show design intent and are
          not architectural plans.
        </p>
      </div>

      <div className="xp-track" ref={track} style={{ height: `${100 + SCROLL_VH}vh` }}>
        <div className={`xp-stage ${full ? 'is-full' : ''} ${dive ? 'is-tour' : ''}`} ref={setStageRef}>
          {tier > 0 && (near || preload) && (
            <Suspense fallback={null}>
              <ExplorerScene
                ref={scene}
                running={visible || full}
                onState={setUi}
                onProgress={(p, label) => setProgress({ p, label })}
                onReady={onReady}
                onTour={onTour}
                onTourT={tourT}
                onLabels={setLabels}
                onHoverApt={setHoverApt}
              />
            </Suspense>
          )}

          {tier === 0 && (
            <div className="xp-fallback">
              <p>Interactive 3D needs a WebGL-capable browser. The Aurelle Gold has forty floors with four residences on each:</p>
              {apartments.map((a) => (
                <div key={a.id}>
                  <h4>
                    Residence {a.id} — {a.name}
                  </h4>
                  <p>
                    {a.type} · {a.interior} m² interior · {a.balconyArea} m² balcony · {a.view}
                  </p>
                </div>
              ))}
            </div>
          )}

          {loading && (
            <div className="xp-loading" role="status" aria-live="polite">
              <span>{progress.label}…</span>
              <i>
                <b style={{ transform: `scaleX(${Math.max(0.04, progress.p)})` }} />
              </i>
            </div>
          )}

          {ready && (
            <>
              {/* ---------------------------- exploring UI ---------------------------- */}
              <div className={`xp-ui ${xp === 'explore' ? '' : 'is-hidden'}`}>
                <Elevator floor={ui.floor} selected={ui.selected} onCommit={commitFloor} disabled={xp !== 'explore'} />

                <div className="xp-levels glass" role="tablist" aria-label="Zoom level">
                  {[1, 2, 3].map((l) => (
                    <button key={l} role="tab" aria-selected={ui.level === l} className={ui.level === l ? 'is-active' : ''} onClick={() => goLevel(l)}>
                      <i>{l}</i>
                      {['Tower', 'Floor', 'Residence'][l - 1]}
                    </button>
                  ))}
                </div>

                <button className="btn xp-start" onClick={() => startAuto(true)}>
                  Start experience <span className="arrow" />
                </button>

                {/* context card */}
                {ui.level === 1 && (
                  <div className="xp-card glass" key="c1">
                    <span className="eyebrow">The Aurelle Gold</span>
                    <h3>{ui.selected ? `Level ${ui.floor}` : 'Forty floors'}</h3>
                    <p>
                      {ui.selected
                        ? `${tierInfo.name} — ${tierInfo.note}`
                        : 'Four residences on every floor, wrapped in brushed-gold fins above Downtown Dubai. Choose a floor on the rail or click the tower.'}
                    </p>
                    <div className="xp-facts">
                      <div>
                        <strong>{TOWER.floors}</strong>
                        <span>Floors</span>
                      </div>
                      <div>
                        <strong>158 m</strong>
                        <span>Height</span>
                      </div>
                      <div>
                        <strong>{TOWER.floors * 4}</strong>
                        <span>Residences</span>
                      </div>
                    </div>
                    <button className="btn" disabled={!ui.selected} onClick={() => scene.current?.goL2(ui.floor)}>
                      {ui.selected ? `Open level ${ui.floor}` : 'Select a floor'} <span className="arrow" />
                    </button>
                  </div>
                )}
                {ui.level === 2 && (
                  <div className="xp-card glass" key="c2">
                    <span className="eyebrow">
                      Level {ui.floor} · {tierInfo.name}
                    </span>
                    <h3>Four residences</h3>
                    <div className="xp-apts">
                      {apartments.map((a) => (
                        <button
                          key={a.id}
                          className={hoverApt === a.id ? 'is-hover' : ''}
                          onPointerEnter={() => setHoverApt(a.id)}
                          onPointerLeave={() => setHoverApt(null)}
                          onClick={() => scene.current?.goL3(a.id, 'living')}
                        >
                          <b>{a.id}</b>
                          <span>
                            {a.name}
                            <small>
                              {unitNo(ui.floor, a.id)} · {a.type} · {a.interior} m²
                            </small>
                          </span>
                        </button>
                      ))}
                    </div>
                    <p className="xp-small">Select a residence to step inside — or press Start experience.</p>
                  </div>
                )}
                {ui.level === 3 && apt && room && (
                  <div className="xp-card xp-room glass" key={`r-${apt.id}-${room.id}`}>
                    <span className="eyebrow">
                      Residence {unitNo(ui.floor, apt.id)} · {apt.name}
                    </span>
                    <h3>{room.name}</h3>
                    <div className="xp-area">{room.area} m²</div>
                    <p>{room.desc}</p>
                    <div className="xp-room-nav">
                      <button className="icon-btn" onClick={() => stepRoom(-1)} aria-label="Previous room">
                        ‹
                      </button>
                      <button className="link" onClick={() => scene.current?.backOut()}>
                        Back to floor
                      </button>
                      <button className="icon-btn" onClick={() => stepRoom(1)} aria-label="Next room">
                        ›
                      </button>
                    </div>
                  </div>
                )}

                {/* room navigation */}
                {ui.level === 3 && apt && (
                  <nav className="xp-rooms glass" aria-label="Rooms">
                    {rooms.map((r) => (
                      <button key={r.id} className={ui.roomId === r.id ? 'is-active' : ''} aria-pressed={ui.roomId === r.id} onClick={() => scene.current?.goRoom(r.id)}>
                        {r.nav}
                      </button>
                    ))}
                  </nav>
                )}

                {/* apartment labels floating over the plan */}
                {ui.level === 2 &&
                  labels.map((l) => {
                    const a = aptById(l.id)
                    return (
                      l.on && (
                        <button
                          key={l.id}
                          className={`xp-label ${hoverApt === l.id ? 'is-hover' : ''}`}
                          style={{ transform: `translate(${l.x}px, ${l.y}px) translate(-50%, -50%)` }}
                          onPointerEnter={() => setHoverApt(l.id)}
                          onPointerLeave={() => setHoverApt(null)}
                          onClick={() => scene.current?.goL3(l.id, 'living')}
                        >
                          <b>{l.id}</b>
                          <span>
                            {a.interior} m²<small>{a.type}</small>
                          </span>
                        </button>
                      )
                    )
                  })}

                <div className="xp-tools glass" role="toolbar" aria-label="View controls">
                  <button onClick={() => scene.current?.zoom(0.78)} aria-label="Zoom in" title="Zoom in">
                    +
                  </button>
                  <button onClick={() => scene.current?.zoom(1.28)} aria-label="Zoom out" title="Zoom out">
                    −
                  </button>
                  <button onClick={() => scene.current?.reset()} title="Reset camera">
                    Reset
                  </button>
                  <button onClick={toggleFull} aria-pressed={full} title="Fullscreen">
                    {full ? 'Exit' : 'Full screen'}
                  </button>
                </div>
                <div className="xp-hint">{hint}</div>
              </div>

              {/* --------------------------------- tour UI --------------------------------- */}
              <div className={`xp-tour ${xp === 'explore' ? 'is-hidden' : ''}`}>
                {/* progress rail */}
                <div className="xp-rail" aria-hidden="true">
                  <div className="xp-rail-line">
                    <span ref={railFill} />
                    {stops.map((s) => (
                      <i key={s.id} className={caption?.id === s.id ? 'on' : ''} style={{ top: `${(s.tn * 100).toFixed(2)}%` }}>
                        <em>{s.title}</em>
                      </i>
                    ))}
                  </div>
                  <b ref={railPct}>0%</b>
                </div>

                {caption && (
                  <div className="xp-caption glass" key={caption.id}>
                    <span className="eyebrow">{capRoom ? `Residence ${unitNo(ui.floor, apt.id)}` : 'The Aurelle Gold'}</span>
                    <h3>{caption.title}</h3>
                    {capRoom && <div className="xp-area">{capRoom.area} m²</div>}
                    <p>{caption.desc}</p>
                  </div>
                )}

                <div className="xp-controls glass" role="toolbar" aria-label="Tour controls">
                  {xp === 'auto' ? (
                    <button onClick={togglePlay}>{autoDone ? 'Replay' : playing ? 'Pause' : 'Resume'}</button>
                  ) : (
                    <button onClick={() => startAuto(false)}>Play automatically</button>
                  )}
                  {xp === 'auto' && (
                    <button onClick={() => startAuto(true)} title="Restart the tour">
                      Restart
                    </button>
                  )}
                  <button onClick={exitTour}>{xp === 'auto' ? 'Exit tour' : 'Back to explore'}</button>
                </div>
                {xp === 'scroll' && <div className="xp-scrollhint">Scroll · the camera follows</div>}
              </div>

              {xp === 'explore' && ui.level === 1 && !ui.selected && <div className="xp-cue">Scroll to begin the tour</div>}
            </>
          )}
        </div>
      </div>
    </section>
  )
}
