import { Brand } from './Nav.jsx'
import { scrollToTarget } from '../lib/scroll.js'

const go = (href) => (e) => {
  e.preventDefault()
  scrollToTarget(href)
}

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-top">
          <div>
            <Brand />
            <p style={{ maxWidth: '22em', marginTop: 20, fontSize: '0.9rem' }}>
              Private real estate advisory for Dubai’s most exceptional residences.
            </p>
          </div>
          <div>
            <h5>Explore</h5>
            <ul>
              <li><a href="#residences" onClick={go('#residences')}>Residences</a></li>
              <li><a href="#locations" onClick={go('#locations')}>Locations</a></li>
              <li><a href="#projects" onClick={go('#projects')}>Projects</a></li>
            </ul>
          </div>
          <div>
            <h5>Company</h5>
            <ul>
              <li><a href="#about" onClick={go('#about')}>About</a></li>
              <li><a href="#why-dubai" onClick={go('#why-dubai')}>Why Dubai</a></li>
              <li><a href="#contact" onClick={go('#contact')}>Contact</a></li>
            </ul>
          </div>
          <div>
            <h5>Visit</h5>
            <ul>
              <li>Gate Avenue, DIFC</li>
              <li>Sun – Thu · 9:00 – 19:00</li>
              <li><a href="tel:+97140000000">+971 4 000 0000</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Aurelle Real Estate. All rights reserved.</span>
          <span>Imagery rendered in real time from architectural models.</span>
        </div>
        <div className="footer-word" aria-hidden="true">AURELLE</div>
      </div>
    </footer>
  )
}
