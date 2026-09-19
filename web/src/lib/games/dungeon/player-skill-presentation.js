export function presentDungeonPlayerSkill(scene, {
  x = 0,
  y = 0,
  radius = 120,
} = {}) {
  if (!scene) return false
  const px = Number(x) || 0
  const py = Number(y) || 0
  const targetRadius = Math.max(20, Number(radius) || 120)
  const ring = scene.add?.circle?.(px, py, 20, 0xc1ff56, 0.1)
  ring?.setStrokeStyle?.(4, 0xc1ff56, 0.9)
  if (ring) {
    scene.tweens?.add?.({
      targets: ring,
      radius: targetRadius,
      alpha: 0,
      duration: 320,
      onComplete: () => ring.destroy?.(),
    })
  }
  scene.cameras?.main?.shake?.(100, 0.006)
  return true
}
