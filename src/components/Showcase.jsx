import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { typologies } from '../data.js'
import { useInView } from '../lib/hooks.js'
import { tier } from '../lib/device.js'
import { gsap, scrollToTarget } from '../lib/scroll.js'

const ShowcaseScene = lazy(() => import('../three/ShowcaseScene.jsx'))
const FLOORS = 32

function residenceFor(floor) {
  const beds = floor >= 30 ? 'Sky villa · 5' : floor >= 21 ? '4' : floor >= 11 ? '3' : '2'
  const size = Math.round(1180 + floor * 62 + (floor >= 30 ? 1600 : 0))
  const price = 3.85 * (size / 1240) * (1 + (floor - 1) * 0.012) * (floor >= 30 ? 1.25 : 1)
  const view = floor >= 21 ? 'Gulf & skyline' : floor >= 11 ? 'Fountain & lake' : 'Boulevard & garden'
  return { beds, size: size.toLocaleString('en-US'), price: `AED ${price.toFixed(2)}M`, view, unit: `${floor}${String.fromCharCode(65 + (floor % 3))}` }
}


export default function Showcase({ onEnquire }) {
  const [active, setActive] = useState('tower')
  const [floor, setFloor] = useState(24)
  const [stageRef, near] = useInView('100% 0px', true)
  const [visRef, visible] = useInView('0px')
  const [sceneReady, setSceneReady] = useState(false)
  // visitor intent (hover / focus / touch near the list or stage) → prebuild the other models
  const [prefetch, setPrefetch] = useState(false)
  const intent = useCallback(() => setPrefetch(true), [])
  const onSceneReady = useCallback(() => setSceneReady(true), [])
  // Warm the 3D stage while the visitor idles on the opening shot (after the hero and its
  // penthouse are prepared), so it never builds mid-scroll. Falls back to "near viewport".
  const [preload, setPreload] = useState(false)
  useEffect(() => {
    if (tier === 0) return
    let t
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1))
    const check = () => (window.scrollY < 40 ? idle(() => setPreload(true), { timeout: 1500 }) : (t = setTimeout(check, 3000)))
    const onReady = () => (t = setTimeout(check, 11000))
    window.addEventListener('aurelle:hero-ready', onReady)
    return () => {
      clearTimeout(t)
      window.removeEventListener('aurelle:hero-ready', onReady)
    }
  }, [])
  const head = useRef(null)
  const r = residenceFor(floor)
  const current = typologies.find((t) => t.id === active)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.showcase-head > *', {
        y: 40,
        opacity: 0,
        duration: 1.2,
        ease: 'power3.out',
        stagger: 0.12,
        scrollTrigger: { trigger: head.current, start: 'top 80%' },
      })
    }, head)
    return () => ctx.revert()
  }, [])

  const setStage = useCallback(
    (el) => {
      stageRef.current = el
      visRef.current = el
    },
    [stageRef, visRef]
  )

  return (
    <section id="residences" className="section showcase" aria-label="Residence showcase">
      <div className="showcase-head" ref={head}>
        <div>
          <span className="eyebrow">Residences in 3D</span>
          <h2 className="display h2" style={{ marginTop: 18 }}>
            Four ways to live <em>in Dubai</em>
          </h2>
        </div>
        <p className="lead" style={{ margin: 0 }}>
          Walk around every residence before you visit. Choose a typology, drag to orbit, and select a floor in the tower to see the
          residence, its view and its price.
        </p>
      </div>

      <div className="showcase-body">
        <div className="typo-col" onPointerEnter={intent} onFocus={intent} onTouchStart={intent}>
          <ul className="typo-list" role="tablist" aria-label="Residence typologies">
            {typologies.map((t) => (
              <li key={t.id} className={`typo-item ${active === t.id ? 'is-active' : ''}`}>
                <button className="typo-btn" role="tab" onClick={() => setActive(t.id)} aria-selected={active === t.id}>
                  <span className="typo-num">{t.index}</span>
                  <span className="typo-name">{t.name}</span>
                  <span className="typo-kicker">{t.kicker}</span>
                </button>
              </li>
            ))}
          </ul>
          {/* one fixed detail slot — switching typology never shifts the page */}
          <div className="typo-info" key={current.id} role="tabpanel">
            <p>{current.copy}</p>
            <dl className="typo-facts">
              {current.facts.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className="stage" ref={setStage} onPointerEnter={intent} onTouchStart={intent}>
          {tier > 0 && !sceneReady && <div className="stage-loading">Preparing residence…</div>}
          {tier > 0 && (near || preload) && (
            <Suspense fallback={null}>
              <ShowcaseScene active={active} floor={floor} running={visible} onReady={onSceneReady} prefetch={prefetch} />
            </Suspense>
          )}
          {tier === 0 && <div className="stage-loading">Interactive 3D needs a WebGL-capable browser</div>}

          <div className="stage-label">
            <span className="eyebrow">{current.kicker}</span>
            <div className="display" style={{ marginTop: 10 }}>
              {current.name}
            </div>
          </div>
          {tier > 0 && <div className="stage-hint">Drag to explore</div>}

          <div className={`floor-panel ${active === 'tower' ? '' : 'is-hidden'}`} aria-hidden={active !== 'tower'}>
            <h4>Choose your floor</h4>
            <p>Select a level to reveal the residence and its outlook.</p>
            <div className="floor-select">
              <button aria-label="Lower floor" onClick={() => setFloor((f) => Math.max(1, f - 1))}>
                −
              </button>
              <div className="floor-num" aria-live="polite">
                {String(floor).padStart(2, '0')}
                <small>of {FLOORS}</small>
              </div>
              <button aria-label="Higher floor" onClick={() => setFloor((f) => Math.min(FLOORS, f + 1))}>
                +
              </button>
            </div>
            <input
              className="floor-range"
              type="range"
              min="1"
              max={FLOORS}
              value={floor}
              onChange={(e) => setFloor(+e.target.value)}
              aria-label="Floor"
            />
            <div className="floor-specs">
              <div>
                Residence<strong>{r.unit}</strong>
              </div>
              <div>
                Bedrooms<strong>{r.beds}</strong>
              </div>
              <div>
                Interior<strong>{r.size} sq ft</strong>
              </div>
              <div>
                From<strong>{r.price}</strong>
              </div>
            </div>
            <button
              className="btn"
              onClick={() => {
                onEnquire?.(`Sky Residences — residence ${r.unit} (floor ${floor})`)
                scrollToTarget('#contact')
              }}
            >
              Reserve viewing
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
