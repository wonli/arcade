export function createDungeonAmbient() {
  let context = null
  let master = null
  let timer = null
  let started = false

  function tone(frequency, when, duration, volume) {
    if (!context || !master) return
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(frequency, when)
    gain.gain.setValueAtTime(0.0001, when)
    gain.gain.exponentialRampToValueAtTime(volume, when + 0.08)
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration)
    oscillator.connect(gain)
    gain.connect(master)
    oscillator.start(when)
    oscillator.stop(when + duration + 0.05)
  }

  async function start() {
    if (started || typeof window === 'undefined') return
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return
    context = new AudioContext()
    master = context.createGain()
    master.gain.value = 0.055
    master.connect(context.destination)
    await context.resume()

    const drone = context.createOscillator()
    const droneGain = context.createGain()
    drone.type = 'sine'
    drone.frequency.value = 48
    droneGain.gain.value = 0.16
    drone.connect(droneGain)
    droneGain.connect(master)
    drone.start()

    const fifth = context.createOscillator()
    const fifthGain = context.createGain()
    fifth.type = 'triangle'
    fifth.frequency.value = 72
    fifthGain.gain.value = 0.035
    fifth.connect(fifthGain)
    fifthGain.connect(master)
    fifth.start()

    const scheduleBell = () => {
      if (!context || context.state === 'closed') return
      const now = context.currentTime + 0.05
      const base = Math.random() > 0.5 ? 144 : 128
      tone(base, now, 2.8, 0.025)
      tone(base * 1.5, now + 0.22, 2.2, 0.012)
    }
    scheduleBell()
    timer = window.setInterval(scheduleBell, 6500 + Math.random() * 2500)

    started = true
    return () => {
      drone.stop()
      fifth.stop()
    }
  }

  function stop() {
    if (timer) window.clearInterval(timer)
    timer = null
    started = false
    const current = context
    context = null
    master = null
    if (current && current.state !== 'closed') current.close().catch(() => {})
  }

  return { start, stop }
}
