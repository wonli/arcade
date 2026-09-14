import { clampJoystickVector } from '../touch/joystick.js'
import { normalizeDungeonInput } from './player-context.js'
import { installDungeonPerf } from './perf-runtime.js'
import { installPhaser4FillTintCompat } from './phaser4-tint-runtime.js'

export { joystickVector } from '../touch/joystick.js'

function resetKeyboardInput(scene) {
  scene.input?.keyboard?.resetKeys?.()
  for (const name of ['A', 'D', 'W', 'S']) {
    if (scene.keys?.[name]) scene.keys[name].isDown = false
  }
  if (scene.keys?.SPACE) {
    scene.keys.SPACE.isDown = false
    scene.keys.SPACE._justDown = false
  }
}

export function installDungeonTouchInput(scene, { deadzone = 0.18 } = {}) {
  if (!scene) return null
  if (scene.__dungeonTouchInput) return scene.__dungeonTouchInput

  const state = { moveX: 0, moveY: 0, skillPending: false, interactPending: false }
  resetKeyboardInput(scene)

  const ensureAudio = () => {
    if (scene.dead || scene.runComplete) return
    scene.ambient?.start?.().catch?.(() => {})
    scene.sound?.context?.resume?.().catch?.(() => {})
  }

  const currentInput = ({ consume = false } = {}) => {
    const input = normalizeDungeonInput({
      moveX: Math.abs(state.moveX) >= deadzone ? state.moveX : 0,
      moveY: Math.abs(state.moveY) >= deadzone ? state.moveY : 0,
      skill: state.skillPending,
      interact: state.interactPending,
    })
    if (consume) {
      state.skillPending = false
      state.interactPending = false
    }
    return input
  }

  const api = {
    setMove(x = 0, y = 0) {
      if (x || y) ensureAudio()
      const vector = clampJoystickVector(x, y)
      state.moveX = vector.x
      state.moveY = vector.y
    },
    stopMove() {
      state.moveX = 0
      state.moveY = 0
    },
    reset() {
      state.moveX = 0
      state.moveY = 0
      state.skillPending = false
      state.interactPending = false
    },
    triggerSkill() {
      ensureAudio()
      state.skillPending = true
    },
    triggerInteract() {
      ensureAudio()
      state.interactPending = true
      // Existing solo E-key listeners (chests/equipment) still receive the action
      // while multiplayer consumes the same normalized interact intent.
      const key = scene.input?.keyboard?.addKey?.('E')
      key?.emit?.('down', key)
    },
    getState() { return currentInput() },
    consumeInput() { return currentInput({ consume: true }) },
  }

  scene.__dungeonTouchInput = api
  const tintCompat = installPhaser4FillTintCompat(scene)
  const perf = installDungeonPerf(scene)
  scene.events?.once?.('shutdown', () => {
    perf?.destroy?.()
    tintCompat?.destroy?.()
    api.reset()
    scene.__dungeonTouchInput = null
  })
  return api
}
