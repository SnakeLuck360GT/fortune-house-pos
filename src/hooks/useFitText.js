import { useLayoutEffect, useRef } from 'react'

// Shrinks an element's font-size until its content fits within its own box
// (height and width). Children should size with `em` so they scale together.
// Re-runs when `deps` change or the element is resized.
export function useFitText(deps = [], { max = 18, min = 8, step = 0.5 } = {}) {
  const ref = useRef(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    const fit = () => {
      let size = max
      el.style.fontSize = size + 'px'
      let guard = 0
      while (
        size > min &&
        (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1) &&
        guard++ < 60
      ) {
        size -= step
        el.style.fontSize = size + 'px'
      }
    }

    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return ref
}
