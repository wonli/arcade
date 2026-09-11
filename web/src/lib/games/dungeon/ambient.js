export function createDungeonAmbient({ windowImpl = globalThis.window, random = Math.random } = {}) {
  let context = null
  let master = null
  let timer = null
  let started = false
  let state = 'idle'
  const persistent = []

  function tone(frequency, when, duration, volume, type = 'sine') {
    if (!context || !master) return
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, when)
    gain.gain.setValueAtTime(0.0001, when)
    gain.gain.exponentialRampToValueAtTime(volume, when + 0.08)
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration)
    oscillator.connect(gain)
    gain.connect(master)
    oscillator.start(when)
    oscillator.stop(when + duration + 0.05)
  }

  function persistentTone(frequency, type, volume) {
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = type
    oscillator.frequency.value = frequency
    gain.gain.value = volume
    oscillator.connect(gain)
    gain.connect(master)
    oscillator.start()
    persistent.push(oscillator)
  }

  async function start() {
    if (started) return
    if (!windowImpl) {
      state = 'unsupported'
      return
    }
    const AudioContext = windowImpl.AudioContext || windowImpl.webkitAudioContext
    if (!AudioContext) {
      state = 'unsupported'
      return
    }

    context = new AudioContext()
    state = context.state || 'suspended'
    master = context.createGain()
    master.gain.value = 0.16
    master.connect(context.destination)

    if (context.state === 'suspended' && typeof context.resume === 'function') await context.resume()
    state = context.state || 'running'

    // Keep the persistent bed above the sub-bass range so laptop and monitor
    // speakers can reproduce it. Individual node gains stay modest because
    // they sum into the master bus.
    persistentTone(96, 'sine', 0.22)
    persistentTone(144, 'triangle', 0.07)
    persistentTone(192, 'sine', 0.025)

    const scheduleBell = () => {
      if (!context || context.state === 'closed') return
      const now = context.currentTime + 0.05
      const base = random() > 0.5 ? 440 : 330
      tone(base, now, 2.5, 0.075, 'triangle')
      tone(base * 1.5, now + 0.18, 1.9, 0.038, 'sine')
      tone(110, now + 0.7, 1.3, 0.045, 'sine')
    }
    scheduleBell()
    timer = windowImpl.setInterval?.(scheduleBell, 5200 + random() * 1800) ?? null

    started = true
    state = context.state || 'running'
  }

  function stop() {
    if (timer) windowImpl?.clearInterval?.(timer)
    timer = null
    started = false
    for (const oscillator of persistent.splice(0)) {
      try { oscillator.stop() } catch {}
    }
    const current = context
    context = null
    master = null
    state = 'closed'
    if (current && current.state !== 'closed') current.close().catch(() => {})
  }

  function getState() {
    if (context?.state) return context.state
    return state
  }

  return { start, stop, getState }
}
