const PHASER_SRC = 'https://cdn.jsdelivr.net/npm/phaser@4.2.1/dist/phaser.min.js'

let loading = null

export function loadPhaser() {
  if (globalThis.Phaser) return Promise.resolve(globalThis.Phaser)
  if (loading) return loading

  loading = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = PHASER_SRC
    script.async = true
    script.onload = () => globalThis.Phaser ? resolve(globalThis.Phaser) : reject(new Error('Phaser did not initialize'))
    script.onerror = () => reject(new Error('Failed to load Phaser'))
    document.head.appendChild(script)
  })

  return loading
}
