import { useEffect, useRef, useState } from 'react'

/** Tracks whether an element is in (or near) the viewport. */
export function useInView(rootMargin = '200px', once = false) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        setInView(e.isIntersecting)
        if (e.isIntersecting && once) io.disconnect()
      },
      { rootMargin }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [rootMargin, once])
  return [ref, inView]
}

export { mulberry32 } from './random.js'
