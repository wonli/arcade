export function mountCanvas(node, options = {}) {
  const ResizeObserverClass = options.ResizeObserverClass ?? globalThis.ResizeObserver
  const devicePixelRatio = options.devicePixelRatio ?? globalThis.devicePixelRatio ?? 1
  const context = node.getContext('2d')

  function resize() {
    const rect = node.getBoundingClientRect()
    const dpr = Math.max(1, devicePixelRatio)
    const width = Math.max(1, Math.round(rect.width * dpr))
    const height = Math.max(1, Math.round(rect.height * dpr))
    if (node.width !== width) node.width = width
    if (node.height !== height) node.height = height
    options.onReady?.(node, context)
  }

  const observer = new ResizeObserverClass(resize)
  observer.observe(node)
  resize()

  return {
    destroy() {
      observer.disconnect()
    },
  }
}
