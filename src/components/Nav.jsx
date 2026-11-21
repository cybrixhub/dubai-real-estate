import { useEffect, useState } from 'react'
import { scrollToTarget, lockScroll } from '../lib/scroll.js'

const links = [
  ['Residences', '#residences'],
  ['Locations', '#locations'],
  ['Projects', '#projects'],
  ['Why Dubai', '#why-dubai'],
  ['About', '#about'],
]

export function Brand() {
  return (
    <span className="brand">
      <span className="brand-mark">AURELLE</span>
      <span className="brand-sub">Dubai Residences</span>
    </span>
  )
}

export default function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    lockScroll(open)
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const go = (e, href) => {
    e.preventDefault()
    setOpen(false)
    setTimeout(() => scrollToTarget(href), open ? 350 : 0)
  }

  return (
    <>
      <header className={`nav ${scrolled ? 'is-scrolled' : ''} ${open ? 'nav-open' : ''}`}>
        <a href="#top" onClick={(e) => go(e, '#top')} aria-label="Aurelle — home">
          <Brand />
        </a>
        <nav aria-label="Primary">
          <ul className="nav-links">
            {links.map(([label, href]) => (
              <li key={href}>
                <a href={href} onClick={(e) => go(e, href)}>
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <a href="#contact" className="btn nav-cta" onClick={(e) => go(e, '#contact')}>
          Private viewing
        </a>
        <button className="nav-burger" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen(!open)}>
          <span />
          <span />
        </button>
      </header>
      <div className={`mobile-menu ${open ? 'is-open' : ''}`} aria-hidden={!open}>
        {[...links, ['Contact', '#contact']].map(([label, href]) => (
          <a key={href} href={href} onClick={(e) => go(e, href)} tabIndex={open ? 0 : -1}>
            {label}
          </a>
        ))}
      </div>
    </>
  )
}
