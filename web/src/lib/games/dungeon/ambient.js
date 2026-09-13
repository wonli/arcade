export const DUNGEON_MUSIC_PATH = '/assets/dungeon/m1.m4a'

export function createDungeonAmbient({ windowImpl = globalThis.window } = {}) {
  let audio = null
  let state = 'idle'

  async function start() {
    if (state === 'running' || state === 'closed') return
    if (!windowImpl?.Audio) {
      state = 'unsupported'
      return
    }
    if (!audio) {
      audio = new windowImpl.Audio(DUNGEON_MUSIC_PATH)
      audio.loop = true
      audio.preload = 'auto'
      audio.volume = 0.58
    }
    try {
      await audio.play()
      if (state !== 'closed') state = 'running'
      else audio.pause()
    } catch {
      if (state !== 'closed') state = 'suspended'
    }
  }

  function stop() {
    state = 'closed'
    if (audio) {
      audio.pause()
      try { audio.currentTime = 0 } catch {}
    }
  }

  function getState() { return state }
  return { start, stop, getState }
}
