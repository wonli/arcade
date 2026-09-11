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

function burstPixels(scene, x, y, color, count = 10, distance = 46, duration = 260) {
  for (let i = 0; i < count; i++) {
    const pixel = scene.add.rectangle(x, y, i % 3 === 0 ? 6 : 4, i % 3 === 0 ? 6 : 4, color, 0.95).setDepth(36)
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.18
    const length = distance * (0.65 + Math.random() * 0.5)
    scene.tweens.add({
      targets: pixel,
      x: x + Math.cos(angle) * length,
      y: y + Math.sin(angle) * length,
      alpha: 0,
      angle: 90 + Math.random() * 180,
      duration: duration + Math.random() * 80,
      onComplete: () => pixel.destroy(),
    })
  }
}

function lightning(scene, from, to) {
  const cue = combatVisualCue('thunder')
  const graphics = scene.add.graphics().setDepth(38)
  const points = [{ x: from.x, y: from.y }]
  const segments = 6
  for (let i = 1; i < segments; i++) {
    const t = i / segments
    const x = from.x + (to.x - from.x) * t
    const y = from.y + (to.y - from.y) * t
    const dx = to.x - from.x
    const dy = to.y - from.y
    const length = Math.hypot(dx, dy) || 1
    const jitter = (i % 2 === 0 ? -1 : 1) * (5 + Math.random() * 6)
    points.push({ x: x + (-dy / length) * jitter, y: y + (dx / length) * jitter })
  }
  points.push({ x: to.x, y: to.y })
  graphics.lineStyle(cue.width + 4, 0x2d7fff, 0.18).strokePoints(points, false, false)
  graphics.lineStyle(cue.width, cue.color, 0.95).strokePoints(points, false, false)
  graphics.lineStyle(1, 0xffffff, 0.95).strokePoints(points, false, false)
  scene.tweens.add({ targets: graphics, alpha: 0, duration: cue.duration, onComplete: () => graphics.destroy() })
}

function pierceTrail(scene, from, to) {
  const cue = combatVisualCue('piercing')
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy) || 1
  const end = { x: to.x + (dx / length) * cue.length, y: to.y + (dy / length) * cue.length }
  const line = scene.add.line(0, 0, from.x, from.y, end.x, end.y, cue.color, 0.88).setOrigin(0).setLineWidth(3).setDepth(35)
  const core = scene.add.line(0, 0, to.x, to.y, end.x, end.y, 0xffffff, 0.8).setOrigin(0).setLineWidth(1).setDepth(36)
  scene.tweens.add({ targets: [line, core], alpha: 0, duration: cue.duration, onComplete: () => { line.destroy(); core.destroy() } })
}

function whirlwindAccent(scene, x, y) {
  const cue = combatVisualCue('whirlwind')
  for (let i = 0; i < 3; i++) {
    const arc = scene.add.arc(x, y, 42 + i * 17, 20 + i * 78, 125 + i * 78, false, cue.color, 0).setStrokeStyle(5 - i, cue.color, 0.9 - i * 0.18).setDepth(37)
    scene.tweens.add({ targets: arc, angle: 145 + i * 55, scale: cue.radius / (42 + i * 17), alpha: 0, duration: cue.duration, onComplete: () => arc.destroy() })
  }
}

function corpseAccent(scene, x, y) {
  const cue = combatVisualCue('corpse_burst')
  const ring = scene.add.circle(x, y, 16, cue.color, 0.16).setStrokeStyle(4, 0xffc0a6, 0.9).setDepth(35)
  scene.tweens.add({ targets: ring, radius: cue.radius, alpha: 0, duration: cue.duration, onComplete: () => ring.destroy() })
  burstPixels(scene, x, y, cue.color, 12, cue.radius * 0.7, cue.duration)
}

export function installAffixVisuals(scene) {
  if (!scene || scene.__affixVisualsInstalled) return scene
  scene.__affixVisualsInstalled = true

  const originalEffectLine = scene.effectLine?.bind(scene)
  if (originalEffectLine) {
    scene.effectLine = (from, to, color, width = 3) => {
      if (color === 0x9ae9ff) lightning(scene, from, to)
      else if (color === 0xe7f2ff) pierceTrail(scene, from, to)
      else originalEffectLine(from, to, color, width)
    }
  }

  const originalHealPlayer = scene.healPlayer?.bind(scene)
  if (originalHealPlayer) {
    scene.healPlayer = (amount) => {
      const before = scene.playerState?.hp ?? 0
      originalHealPlayer(amount)
      const healed = Math.max(0, (scene.playerState?.hp ?? 0) - before)
      if (healed > 0) {
        const cue = combatVisualCue('heal')
        floatingText(scene, scene.playerState.x, scene.playerState.y - 44, `+${healed} HP`, cue.color, cue.duration, 13)
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

  const originalAddCircle = scene.add.circle.bind(scene.add)
  scene.add.circle = (...args) => {
    const circle = originalAddCircle(...args)
    const [x, y, , color] = args
    if (color === 0xfff0a8) whirlwindAccent(scene, x, y)
    if (color === 0xff8f68) corpseAccent(scene, x, y)
    return circle
  }

  return scene
}
