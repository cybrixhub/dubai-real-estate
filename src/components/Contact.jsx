import { useEffect, useRef, useState } from 'react'
import { gsap } from '../lib/scroll.js'

const BUDGETS = ['< AED 3M', 'AED 3–10M', 'AED 10–25M', 'AED 25M +']
const INTERESTS = ['Buying a home', 'Investment portfolio', 'Off-plan release', 'Golden Visa property', 'Selling with Aurelle']

const empty = { name: '', email: '', phone: '', interest: INTERESTS[0], message: '', budget: BUDGETS[1] }

function validate(v) {
  const e = {}
  if (v.name.trim().length < 2) e.name = 'Please enter your name'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email)) e.email = 'Please enter a valid email'
  if (v.phone && !/^[+\d][\d\s()-]{6,}$/.test(v.phone)) e.phone = 'Please check this number'
  return e
}

export default function Contact({ enquiry }) {
  const [v, setV] = useState(empty)
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState('idle') // idle | sending | sent
  const root = useRef(null)

  useEffect(() => {
    if (enquiry) setV((s) => ({ ...s, message: `I'd like to know more about ${enquiry}.` }))
  }, [enquiry])

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.contact-info > *, .form', {
        y: 40,
        opacity: 0,
        stagger: 0.1,
        duration: 1.1,
        ease: 'power3.out',
        scrollTrigger: { trigger: root.current, start: 'top 75%' },
      })
    }, root)
    return () => ctx.revert()
  }, [])

  const set = (k) => (e) => {
    setV({ ...v, [k]: e.target.value })
    if (errors[k]) setErrors({ ...errors, [k]: undefined })
  }

  const submit = async (e) => {
    e.preventDefault()
    const errs = validate(v)
    setErrors(errs)
    if (Object.keys(errs).length) {
      document.getElementById(`f-${Object.keys(errs)[0]}`)?.focus({ preventScroll: true })
      return
    }
    setStatus('sending')
    // Integration point: POST `v` to your CRM / email endpoint here.
    await new Promise((r) => setTimeout(r, 1100))
    setStatus('sent')
  }

  return (
    <section id="contact" className="section contact" ref={root} aria-label="Contact">
      <div className="container contact-grid">
        <div className="contact-info">
          <span className="eyebrow">Private consultation</span>
          <h2 className="display h2">
            Let’s find <em>your address</em>
          </h2>
          <p className="lead">
            Tell us how you’d like to live. An advisor will reply within one business day with a private shortlist — and arrange viewings in
            person or by live video.
          </p>
          <div className="contact-list">
            <div>
              <span>Gallery</span>
              <p>Gate Avenue, DIFC · Dubai, UAE</p>
            </div>
            <div>
              <span>Call</span>
              <a href="tel:+97140000000">+971 4 000 0000</a>
            </div>
            <div>
              <span>Write</span>
              <a href="mailto:advisory@aurelle.example">advisory@aurelle.example</a>
            </div>
          </div>
        </div>

        <form className="form" onSubmit={submit} noValidate>
          {status === 'sent' ? (
            <div className="form-success" role="status">
              <div className="tick">✓</div>
              <h3>Thank you, {v.name.split(' ')[0]}.</h3>
              <p style={{ color: 'var(--ink-70)' }}>Your advisor will be in touch within one business day.</p>
              <button
                type="button"
                className="link"
                onClick={() => {
                  setV(empty)
                  setStatus('idle')
                }}
              >
                Send another enquiry
              </button>
            </div>
          ) : (
            <>
              <h3>Book a private viewing</h3>
              <p>All conversations are confidential.</p>
              <div className="form-row">
                <div className={`field ${errors.name ? 'has-error' : ''}`}>
                  <label htmlFor="f-name">Full name</label>
                  <input id="f-name" autoComplete="name" value={v.name} onChange={set('name')} aria-invalid={!!errors.name} />
                  {errors.name && <span className="err">{errors.name}</span>}
                </div>
                <div className={`field ${errors.email ? 'has-error' : ''}`}>
                  <label htmlFor="f-email">Email</label>
                  <input id="f-email" type="email" autoComplete="email" value={v.email} onChange={set('email')} aria-invalid={!!errors.email} />
                  {errors.email && <span className="err">{errors.email}</span>}
                </div>
              </div>
              <div className="form-row">
                <div className={`field ${errors.phone ? 'has-error' : ''}`}>
                  <label htmlFor="f-phone">Phone (optional)</label>
                  <input id="f-phone" type="tel" autoComplete="tel" value={v.phone} onChange={set('phone')} aria-invalid={!!errors.phone} />
                  {errors.phone && <span className="err">{errors.phone}</span>}
                </div>
                <div className="field">
                  <label htmlFor="f-interest">I’m interested in</label>
                  <select id="f-interest" value={v.interest} onChange={set('interest')}>
                    {INTERESTS.map((i) => (
                      <option key={i}>{i}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field" style={{ marginBottom: 6 }}>
                <span className="field-label" id="budget-label">Budget</span>
              </div>
              <div className="budget" role="radiogroup" aria-labelledby="budget-label">
                {BUDGETS.map((b) => (
                  <button
                    type="button"
                    key={b}
                    role="radio"
                    aria-checked={v.budget === b}
                    className={`chip ${v.budget === b ? 'is-active' : ''}`}
                    onClick={() => setV({ ...v, budget: b })}
                  >
                    {b}
                  </button>
                ))}
              </div>
              <div className="field">
                <label htmlFor="f-msg">Message</label>
                <textarea id="f-msg" rows="3" value={v.message} onChange={set('message')} placeholder="Community, timing, must-haves…" />
              </div>
              <div className="form-foot">
                <small>By submitting you agree to be contacted about your enquiry. We never share your details.</small>
                <button className="btn" type="submit" disabled={status === 'sending'}>
                  {status === 'sending' ? 'Sending…' : 'Send enquiry'} <span className="arrow" />
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </section>
  )
}
