export function hitSoundProfile({ damage = 0, critical = false, killed = false, elite = false } = {}) {
  const weight = Math.max(0, Math.min(1, Number(damage || 0) / 80))
  const eliteBoost = elite ? 0.035 : 0
  return {
    gain: Math.min(0.4, 0.14 + weight * 0.08 + (critical ? 0.07 : 0) + (killed ? 0.03 : 0) + eliteBoost),
    duration: killed ? (elite ? 0.17 : 0.13) : critical ? 0.09 : 0.065,
    highFrequency: critical ? 176 + weight * 34 : 138 + weight * 24,
    lowFrequency: elite && killed ? 54 : killed ? 62 : critical ? 82 : 96,
  }
}

export function elitePresentation({ boss = false } = {}) {
  if (boss) {
    return {
      scale: 1,
      auraRadius: 42,
      pulseMs: 760,
      tint: 0xffb55c,
      auraColor: 0xff7a45,
      hpMultiplier: 1,
      damageMultiplier: 1,
    }
  }
  return {
    scale: 1.16,
    auraRadius: 29,
    pulseMs: 680,
    tint: 0xffd86b,
    auraColor: 0xc984ff,
    hpMultiplier: 1,
    damageMultiplier: 1,
  }
}

export function roomClearFeedback({ roomRole = 'combat' } = {}) {
  const elite = roomRole === 'elite'
  const boss = roomRole === 'boss'
  return {
    hitStopMs: boss ? 105 : elite ? 86 : 64,
    shake: boss ? 0.011 : elite ? 0.0085 : 0.006,
    durationMs: boss ? 180 : elite ? 150 : 120,
    ringRadius: boss ? 118 : elite ? 96 : 76,
    soundGain: boss ? 0.34 : elite ? 0.29 : 0.23,
    color: boss ? 0xffb55c : elite ? 0xc984ff : 0xc1ff56,
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
