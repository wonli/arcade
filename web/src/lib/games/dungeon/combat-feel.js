export function hitSoundProfile({ damage = 0, critical = false, killed = false } = {}) {
  const weight = Math.max(0, Math.min(1, Number(damage || 0) / 80))
  return {
    gain: Math.min(0.34, 0.14 + weight * 0.08 + (critical ? 0.07 : 0) + (killed ? 0.03 : 0)),
    duration: killed ? 0.13 : critical ? 0.09 : 0.065,
    highFrequency: critical ? 176 + weight * 34 : 138 + weight * 24,
    lowFrequency: killed ? 62 : critical ? 82 : 96,
  }
}

export function lootMotion(ageMs = 0, groundY = 0, dropHeight = 72) {
  const age = Math.max(0, Number(ageMs || 0))
  if (age < 420) {
    const t = age / 420
    const bounce = Math.sin(t * Math.PI) * (1 - t) * 18
    return {
      y: groundY - dropHeight * (1 - t) - bounce,
      scale: 0.82 + t * 0.22 + Math.sin(t * Math.PI) * 0.08,
    }
  }
  const hover = Math.sin((age - 420) / 260) * 3
  return { y: groundY - 3 + hover, scale: 1 + Math.sin((age - 420) / 310) * 0.018 }
}
