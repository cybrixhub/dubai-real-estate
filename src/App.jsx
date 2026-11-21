import { useEffect, useState } from 'react'
import { initSmoothScroll, ScrollTrigger } from './lib/scroll.js'
import Nav from './components/Nav.jsx'
import Hero from './components/Hero.jsx'
import Intro from './components/Intro.jsx'
import Showcase from './components/Showcase.jsx'
import Locations from './components/Locations.jsx'
import Projects from './components/Projects.jsx'
import WhyDubai from './components/WhyDubai.jsx'
import About from './components/About.jsx'
import Contact from './components/Contact.jsx'
import Footer from './components/Footer.jsx'
import { startSnapshots } from './three/snapshots.js'
import { tier } from './lib/device.js'

export default function App() {
  const [enquiry, setEnquiry] = useState('')

  useEffect(() => {
    const stop = initSmoothScroll()
    // Render property "photography" from the 3D models — but never during the hero
    // intro: start a moment after the hero is on screen, as soon as the visitor
    // scrolls, or after a fallback delay (immediately when there is no 3D hero).
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1))
    let id
    let fired = false
    const kick = (delay = 0) => {
      if (fired) return
      fired = true
      setTimeout(() => (id = idle(() => startSnapshots(), { timeout: 2000 })), delay)
    }
    const onHeroReady = () => kick(3200)
    const onScroll = () => window.scrollY > window.innerHeight * 0.35 && kick(0)
    window.addEventListener('aurelle:hero-ready', onHeroReady)
    window.addEventListener('scroll', onScroll, { passive: true })
    const fallback = setTimeout(() => kick(0), tier === 0 ? 0 : 9000)
    const onLoad = () => ScrollTrigger.refresh()
    window.addEventListener('load', onLoad)
    document.fonts?.ready.then(onLoad)
    return () => {
      stop()
      window.cancelIdleCallback?.(id)
      clearTimeout(fallback)
      window.removeEventListener('aurelle:hero-ready', onHeroReady)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('load', onLoad)
    }
  }, [])

  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Intro />
        <Showcase onEnquire={setEnquiry} />
        <Locations />
        <Projects onEnquire={setEnquiry} />
        <WhyDubai />
        <About />
        <Contact enquiry={enquiry} />
      </main>
      <Footer />
    </>
  )
}
