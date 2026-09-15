export function installPhaser4FillTintCompat(scene, Phaser = globalThis.Phaser) {
  if (!scene || scene.__phaser4FillTintCompat) return scene?.__phaser4FillTintCompat ?? null
  const fillMode = Phaser?.TintModes?.FILL
  if (fillMode == null) return null

  const patched = new Map()
  const patch = (visual) => {
    if (!visual || typeof visual.setTint !== 'function' || typeof visual.setTintMode !== 'function' || patched.has(visual)) return visual
    const own = Object.prototype.hasOwnProperty.call(visual, 'setTintFill')
    const previous = visual.setTintFill
    visual.setTintFill = function setTintFillCompat(color) {
      return this.setTint(color).setTintMode(fillMode)
    }
    patched.set(visual, { own, previous })
    return visual
  }

  patch(scene.localPlayer.actor)
  for (const enemy of scene.enemies ?? []) patch(enemy?.visual)

  const originalMakeActor = scene.makeActor
  if (typeof originalMakeActor === 'function') {
    scene.makeActor = function (...args) {
      return patch(originalMakeActor.apply(this, args))
    }
  }

  const api = {
    destroy() {
      if (scene.makeActor !== originalMakeActor && typeof originalMakeActor === 'function') scene.makeActor = originalMakeActor
      for (const [visual, state] of patched) {
        if (state.own) visual.setTintFill = state.previous
        else delete visual.setTintFill
      }
      patched.clear()
      delete scene.__phaser4FillTintCompat
    },
  }
  scene.__phaser4FillTintCompat = api
  return api
}
