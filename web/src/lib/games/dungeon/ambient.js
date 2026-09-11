import { DUNGEON_BGM } from './music.js'

export function createDungeonAmbient({ windowImpl = globalThis.window } = {}) {
  let context = null
  let master = null
  let timer = null
  let started = false
  let state = 'idle'
  const scheduled = []

  function tone(frequency, when, duration, volume, type = 'sine', attack = 0.025) {
    if (!context || !master) return
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, when)
    gain.gain.setValueAtTime(0.0001, when)
    gain.gain.exponentialRampToValueAtTime(volume, when + attack)
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration)
    oscillator.connect(gain)
    gain.connect(master)
    oscillator.start(when)
    oscillator.stop(when + duration + 0.04)
    scheduled.push(oscillator)
  }

  function scheduleLoop(startAt) {
    if (!context || context.state === 'closed') return
    const beatSeconds = 60 / DUNGEON_BGM.bpm
    const frequency = (note) => DUNGEON_BGM.notes[note]

    for (const note of DUNGEON_BGM.bass) {
      const when = startAt + note.beat * beatSeconds
      tone(frequency(note.note), when, note.duration * beatSeconds, note.volume, 'triangle', 0.08)
      tone(frequency(note.note) * 2, when, note.duration * beatSeconds * 0.82, note.volume * 0.24, 'sine', 0.12)
    }

    for (const note of DUNGEON_BGM.pulses) {
      tone(frequency(note.note), startAt + note.beat * beatSeconds, note.duration * beatSeconds, note.volume, 'square', 0.008)
    }

    for (const note of DUNGEON_BGM.melody) {
      const when = startAt + note.beat * beatSeconds
      tone(frequency(note.note), when, note.duration * beatSeconds, note.volume, 'square', 0.018)
      tone(frequency(note.note) * 0.5, when + 0.025, note.duration * beatSeconds, note.volume * 0.22, 'triangle', 0.03)
    }

    for (const note of DUNGEON_BGM.bells) {
      const when = startAt + note.beat * beatSeconds
      tone(frequency(note.note), when, note.duration * beatSeconds, note.volume, 'triangle', 0.012)
      tone(frequency(note.note) * 1.5, when + 0.04, note.duration * beatSeconds * 0.7, note.volume * 0.32, 'sine', 0.015)
    }
  }

  function queueNextLoop() {
    if (!context || context.state === 'closed') return
    const nextStart = context.currentTime + 0.08
    scheduleLoop(nextStart)
    timer = windowImpl.setTimeout?.(queueNextLoop, DUNGEON_BGM.duration * 1000) ?? null
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
    master.gain.value = 0.42
    master.connect(context.destination)

    if (context.state === 'suspended' && typeof context.resume === 'function') await context.resume()
    state = context.state || 'running'
    queueNextLoop()
    started = true
  }

  function stop() {
    if (timer) windowImpl?.clearTimeout?.(timer)
    timer = null
    started = false
    for (const oscillator of scheduled.splice(0)) {
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
