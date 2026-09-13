import { clampJoystickVector } from '../touch/joystick.js'
import { installDungeonPerf } from './perf-runtime.js'
import { installPhaser4FillTintCompat } from './phaser4-tint-runtime.js'

export { joystickVector } from '../touch/joystick.js'

function resetInputState(scene, state) {
  scene.input?.keyboard?.resetKeys?.()
  for (const name of ['A', 'D', 'W', 'S']) {
    if (scene.keys?.[name]) scene.keys[name].isDown = false
  }
  if (scene.keys?.SPACE) scene.keys.SPACE._justDown = false
  state.x = 0
  state.y = 0
  state.skillPending = false
  scene.playerMoving = false
  scene.playerAttacking = false
}

export function installDungeonTouchInput(scene, { deadzone = 0.18 } = {}) {
  if (!scene) return null
  if (scene.__dungeonTouchInput) return scene.__dungeonTouchInput
  const state = { x: 0, y: 0, skillPending: false }
  resetInputState(scene, state)

  const ensureAudio = () => {
    if (scene.dead || scene.runComplete) return
    scene.ambient?.start?.().catch?.(() => {})
    scene.sound?.context?.resume?.().catch?.(() => {})
  }
  const originalUpdatePlayer = scene.updatePlayer
  const originalTrySkill = scene.trySkill

  const updatePlayerWithTouch = function updatePlayerWithTouch(dt) {
    const keys = scene.keys ?? {}
    const saved = {}
    const pressed = {
      A: state.x < -deadzone,
      D: state.x > deadzone,
      W: state.y < -deadzone,
      S: state.y > deadzone,
    }
    for (const name of ['A', 'D', 'W', 'S']) {
      if (!keys[name]) continue
      saved[name] = keys[name].isDown
      if (pressed[name]) keys[name].isDown = true
    }
    try { return originalUpdatePlayer.call(scene, dt) }
    finally {
      for (const [name, value] of Object.entries(saved)) keys[name].isDown = value
    }
  }
  scene.updatePlayer = updatePlayerWithTouch

  const trySkillWithTouch = function trySkillWithTouch(time) {
    if (state.skillPending && scene.keys?.SPACE) {
      scene.keys.SPACE._justDown = true
      state.skillPending = false
    }
    return originalTrySkill.call(scene, time)
  }
  scene.trySkill = trySkillWithTouch

  const api = {
    setMove(x = 0, y = 0) {
      if (x || y) ensureAudio()
      const vector = clampJoystickVector(x, y)
      state.x = vector.x
      state.y = vector.y
    },
    stopMove() { state.x = 0; state.y = 0 },
    reset() { resetInputState(scene, state) },
    triggerSkill() { ensureAudio(); state.skillPending = true },
    triggerInteract() {
      ensureAudio()
      const key = scene.input?.keyboard?.addKey?.('E')
      key?.emit?.('down', key)
    },
    getState() { return { x: state.x, y: state.y, skillPending: state.skillPending } },
  }

  scene.__dungeonTouchInput = api
  const tintCompat = installPhaser4FillTintCompat(scene)
  const perf = installDungeonPerf(scene)
  scene.events?.once?.('shutdown', () => {
    perf?.destroy?.()
    tintCompat?.destroy?.()
    api.reset()
    if (scene.updatePlayer === updatePlayerWithTouch) scene.updatePlayer = originalUpdatePlayer
    if (scene.trySkill === trySkillWithTouch) scene.trySkill = originalTrySkill
    scene.__dungeonTouchInput = null
  })
  return api
}
