import { combatVisualCue } from './presentation.js'

function floatingText(scene, x, y, text, color, duration, size = 14) {
  const label = scene.add.text(x, y, text, {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: `${size}px`,
    fontStyle: 'bold',
    color,
    stroke: '#08090b',
    strokeThickness: 4,
  }).setOrigin(0.5).setDepth(55)
  scene.tweens.add({ targets: label, y: y - 30, alpha: 0, duration, ease: 'Quad.Out', onComplete: () => label.destroy() })
}

export function installAffixVisuals(scene) {
  if (!scene || scene.__affixVisualsInstalled) return scene
  scene.__affixVisualsInstalled = true

  const originalHealPlayer = scene.healPlayer?.bind(scene)
  if (originalHealPlayer) {
    scene.healPlayer = (amount) => {
      const before = scene.localPlayer.state?.hp ?? 0
      originalHealPlayer(amount)
      const healed = Math.max(0, (scene.localPlayer.state?.hp ?? 0) - before)
      if (healed > 0) {
        const cue = combatVisualCue('heal')
        floatingText(scene, scene.localPlayer.state.x, scene.localPlayer.state.y - 44, `+${healed} HP`, cue.color, cue.duration, 13)
      }
    }
  }

  const originalDamageText = scene.damageText?.bind(scene)
  if (originalDamageText) {
    scene.damageText = (x, y, damage, critical) => {
      originalDamageText(x, y, damage, critical)
      if (!critical) return
      const cue = combatVisualCue('critical')
      const flash = scene.add.circle(x, y + 12, 12, 0xffdc68, 0.22).setStrokeStyle(3, 0xffffff, 0.8).setDepth(39)
      scene.tweens.add({ targets: flash, radius: 34, alpha: 0, duration: cue.duration, onComplete: () => flash.destroy() })
      scene.cameras.main.shake(cue.duration, cue.shake)
    }
  }

  return scene
}
