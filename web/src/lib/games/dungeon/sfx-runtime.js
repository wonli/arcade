export const DUNGEON_SFX = Object.freeze({
  move: '/assets/dungeon/sfx/r1.wav',
  attack: '/assets/dungeon/sfx/m1.wav',
  heal: '/assets/dungeon/sfx/m2.wav',
  skill: '/assets/dungeon/sfx/m3.wav',
})

const DEFAULT_VOLUMES = Object.freeze({ move: 0.2, attack: 0.34, heal: 0.36, skill: 0.42 })

function createAudio(windowImpl, src, { loop = false, volume = 1 } = {}) {
  const AudioCtor = windowImpl?.Audio
  if (!AudioCtor) return null
  const audio = new AudioCtor(src)
  audio.loop = loop
  audio.volume = volume
  return audio
}

export function createDungeonSfx(windowImpl = globalThis.window) {
  const clips = {
    move: createAudio(windowImpl, DUNGEON_SFX.move, { loop: true, volume: DEFAULT_VOLUMES.move }),
    attack: createAudio(windowImpl, DUNGEON_SFX.attack, { volume: DEFAULT_VOLUMES.attack }),
    heal: createAudio(windowImpl, DUNGEON_SFX.heal, { volume: DEFAULT_VOLUMES.heal }),
    skill: createAudio(windowImpl, DUNGEON_SFX.skill, { volume: DEFAULT_VOLUMES.skill }),
  }
  let moving = false

  const play = (name) => {
    const clip = clips[name]
    if (!clip) return
    if (name !== 'move') clip.currentTime = 0
    clip.play?.().catch?.(() => {})
  }

  const setMoving = (next) => {
    const active = Boolean(next)
    if (active === moving) return
    moving = active
    const clip = clips.move
    if (!clip) return
    if (moving) {
      clip.play?.().catch?.(() => {})
      return
    }
    clip.pause?.()
    clip.currentTime = 0
  }

  const stop = () => {
    moving = false
    for (const clip of Object.values(clips)) {
      if (!clip) continue
      clip.pause?.()
      clip.currentTime = 0
    }
  }

  return { play, setMoving, stop }
}

export function installDungeonSfx(scene, { windowImpl = globalThis.window } = {}) {
  if (!scene || scene.__dungeonSfxInstalled) return scene?.__dungeonSfx ?? null
  scene.__dungeonSfxInstalled = true

  const sfx = createDungeonSfx(windowImpl)
  const originalUpdatePlayer = scene.updatePlayer.bind(scene)
  const originalSlash = scene.slash.bind(scene)
  const originalHealPlayer = scene.healPlayer.bind(scene)
  const originalTrySkill = scene.trySkill.bind(scene)

  scene.updatePlayer = function updatePlayerWithSfx(...args) {
    const result = originalUpdatePlayer(...args)
    sfx.setMoving(scene.localPlayer.moving)
    return result
  }

  scene.slash = function slashWithSfx(...args) {
    sfx.play('attack')
    return originalSlash(...args)
  }

  scene.healPlayer = function healPlayerWithSfx(...args) {
    const before = scene.localPlayer.state?.hp ?? 0
    const result = originalHealPlayer(...args)
    if ((scene.localPlayer.state?.hp ?? 0) > before) sfx.play('heal')
    return result
  }

  scene.trySkill = function trySkillWithSfx(...args) {
    const before = scene.localPlayer.skillReadyAt ?? 0
    const result = originalTrySkill(...args)
    if ((scene.localPlayer.skillReadyAt ?? 0) > before) sfx.play('skill')
    return result
  }

  scene.events?.once?.('shutdown', () => sfx.stop())
  scene.events?.once?.('destroy', () => sfx.stop())

  const api = { stop: () => sfx.stop() }
  scene.__dungeonSfx = api
  return api
}
