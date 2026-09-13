const PROFILES = {
  skeleton: {
    mode: 'pressure',
    closeRange: 76,
    strafeMultiplier: 0.48,
  },
  fast: {
    mode: 'dash',
    triggerRange: 190,
    dashSpeedMultiplier: 2.35,
    dashMs: 280,
    cooldownMs: 1450,
  },
  brute: {
    mode: 'windup',
    triggerRange: 108,
    slamRadius: 82,
    windupMs: 420,
    cooldownMs: 2200,
  },
  ranged: {
    mode: 'kite',
    strafeMultiplier: 0.34,
  },
}

const INTENTS = {
  skeleton: { leadMs: 0, scaleX: 1, scaleY: 1 },
  fast: { leadMs: 180, scaleX: 1.12, scaleY: 0.82 },
  brute: { leadMs: 420, scaleX: 0.92, scaleY: 1.12 },
  ranged: { leadMs: 160, scaleX: 1.05, scaleY: 0.95, flash: true },
}

export function enemyBehaviorProfile(archetype = 'skeleton') {
  return PROFILES[archetype] ?? PROFILES.skeleton
}

export function enemyIntentProfile(archetype = 'skeleton') {
  return INTENTS[archetype] ?? INTENTS.skeleton
}

export function enemyBehaviorStep(enemy, { distance = Infinity, time = 0 } = {}) {
  const profile = enemyBehaviorProfile(enemy?.archetype)

  if (
    enemy?.archetype === 'fast' &&
    time >= (enemy.nextSpecialAt ?? Infinity) &&
    distance <= profile.triggerRange
  ) {
    return {
      action: 'dash',
      durationMs: profile.dashMs,
      speedMultiplier: profile.dashSpeedMultiplier,
      cooldownMs: profile.cooldownMs,
    }
  }

  if (
    enemy?.archetype === 'brute' &&
    time >= (enemy.nextSpecialAt ?? Infinity) &&
    distance <= profile.triggerRange
  ) {
    return {
      action: 'slam-windup',
      durationMs: profile.windupMs,
      radius: profile.slamRadius,
      cooldownMs: profile.cooldownMs,
    }
  }

  if (enemy?.archetype === 'skeleton' && distance <= profile.closeRange) {
    return {
      action: 'sidestep',
      speedMultiplier: profile.strafeMultiplier,
      sign: enemy?.strafeSign ?? 1,
    }
  }

  return { action: 'approach' }
}
