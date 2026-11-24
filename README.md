# Aurelle — Dubai Private Residences

Ultra-premium real estate website with real-time 3D, built with **Vite + React 19, React Three Fiber / three.js, GSAP ScrollTrigger and Lenis**.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
npm run preview
```

## Experience
| Section | What it does |
|---|---|
| Hero | Pinned, scroll-scrubbed 3D journey: golden-hour Dubai skyline → orbit **The Aurelle Gold** (gold-fin tower, lit duplex penthouse, lantern crown, park with reflecting pond, palms and trees) → through the penthouse glass → walkthrough of a realistic penthouse interior (low sun, shadows, walnut, marble, fireplace, skyline view) with glass caption cards |
| Residences | Interactive 3D stage: Sky Residences tower with **floor selector**, beachfront villa, penthouse **dollhouse cut-away**, marina collection |
| Explore Every Corner | Interactive 3D residence explorer (after the showcase): select Ground / First / Second floor, the floor separates and highlights, open a furnished 3D cutaway, pick rooms in the model or the room bar, fly inside, orbit / zoom / pan, first-person walk (WASD or tap-to-walk, wall collision), reset, fullscreen. **Illustrative demonstration building** — areas computed from the plan in `src/explorer/data.js`. |
| Neighbourhoods | Pinned scroll story over a hand-drawn SVG map (Downtown, Palm Jumeirah, Marina, Business Bay) |
| Projects | Filterable cards + detail drawer; imagery is **rendered client-side from the 3D models** (zero image downloads) |
| Why Dubai / About / Contact | Counters, editorial storytelling, validated enquiry form (pre-filled from floor/project CTAs) |

## Performance design
- **First screen without 3D:** initial JS is React + GSAP + Lenis (~137 KB gz); fonts are self-hosted (no third-party request) with metric-matched fallbacks; an inline sky gradient paints before any file arrives; the SVG poster shows instantly.
- **Main thread protected during the intro:** the hero chunk downloads immediately but the scene mounts only after the headline reveal settles; every shader is linked with `compileAsync` (parallel compile) before the first frame; property renders start ~3 s after the hero is on screen (or on first scroll).
- **Device tiers** (`src/lib/device.js`): **2** desktop = shadows + reflective water; **1** mobile = half city, no shadows/reflector; **0** no WebGL / Save-Data = poster only.
- **Adaptive resolution:** drei `PerformanceMonitor` lowers/raises DPR from measured FPS (ignoring hidden/throttled periods, never below the desktop look).
- **Static shadows:** shadow maps render once (hero) or only during model transitions (showcase) instead of every frame.
- **Draw calls:** city = 4 instanced meshes; spire and Palm island merged into single meshes; materials/textures are created lazily on first use.
- Canvases stop rendering off-screen; the showcase prebuilds remaining models in idle time; the snapshot renderer reuses models and disposes its context.

## The hero journey
- `src/three/goldTower.js` – the tower (metres; instanced fins and slab edges, painted lit penthouse).
- `src/three/park.js` – lawn, pond, paths, instanced broadleaf trees and palms.
- `src/three/interior.js` – the penthouse interior (own scene at human scale) and its camera path.
- `src/three/HeroScene.jsx` – camera journey (`JOURNEY`, milestones `J`), city/interior render switch, staged warm-up.
- `src/three/warmup.js` – render-based shader warm-up (screen + offscreen variants) so nothing compiles on first view.
- Timing of captions / transition lives in `src/components/Hero.jsx` (pinned timeline, `end: +=340%`).

## Residence explorer ("Explore Every Corner")
A 40-floor gold-fin Dubai tower (same architecture as the hero) with three seamless zoom levels: **tower → floor (rest of the tower ghosted) → apartment interior**. Four residences (A–D) share each floor around a lift lobby, stair and service core. Illustrative plans only.
- Controls: click a floor / use the elevator; click an apartment; Ctrl/⌘ + wheel zooms the model (plain wheel scrolls the page); drag to orbit.
- **Start experience** runs an automatic cinematic walkthrough (pause / resume / replay / exit). Scrolling the section drives the same tour (ScrollTrigger, fully reversible, progress rail + room captions).
- `src/explorer/data.js` – tower, apartment plans, rooms, stops · `tour.js` – deterministic camera path · `tower.js` – instanced tower shell + floor isolation shader · `plate.js` / `apartment.js` / `furniture.js` – floor plate and furnished rooms (merged per material) · `city.js` – surroundings · `ExplorerScene.jsx` – camera, zoom levels, picking, adaptive resolution.
- Performance: lazy chunk, built progressively, static shadows, render-on-demand, adaptive DPR, off-range floors discarded when a floor is isolated.

## Integration points
- `src/components/Contact.jsx` → `submit()` simulates sending; POST to your CRM/email endpoint there.
- `src/data.js` holds all listings, locations and copy. Figures are illustrative.
- To swap in photogrammetry/GLB assets, load them with drei `useGLTF` (+ Draco/KTX2) inside `src/three/ShowcaseScene.jsx`, replacing the procedural builders in `src/three/models.js`.
