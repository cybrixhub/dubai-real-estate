import * as THREE from 'three'

/*
 * Shader warm-up by *rendering* (ground truth), into tiny offscreen targets:
 *  - `screen`: a target flagged like an XR/screen target with sRGB output, so three.js picks
 *    exactly the program variants used on the canvas (tone mapping + sRGB) — compileAsync
 *    alone does not always produce those, which showed up as stalls on first view.
 *  - `offscreen`: a plain linear target — the variants used by render-to-texture passes
 *    (e.g. the water reflection).
 * Also renders the (static) shadow maps once.
 */
export function warmRender(gl, scene, camera, { screen = true, offscreen = false } = {}) {
  const prev = gl.getRenderTarget()
  const run = (rt) => {
    gl.setRenderTarget(rt)
    gl.shadowMap.needsUpdate = true
    gl.render(scene, camera)
    rt.dispose()
  }
  try {
    if (offscreen) run(new THREE.WebGLRenderTarget(8, 8))
    if (screen) {
      const rt = new THREE.WebGLRenderTarget(8, 8)
      rt.texture.colorSpace = THREE.SRGBColorSpace
      rt.isXRRenderTarget = true // three.js: treat like the screen (keep tone mapping, sRGB output)
      run(rt)
    }
  } finally {
    gl.setRenderTarget(prev)
  }
}
