const EVENTS = {
  combat: {
    id: 'combat',
    enemyMultiplier: 1,
    rewardMultiplier: 1,
    healRatio: 0,
  },
  elite: {
    id: 'elite',
    enemyMultiplier: 0.72,
    eliteCount: 1,
    rewardMultiplier: 1.45,
    healRatio: 0,
  },
  treasure: {
    id: 'treasure',
    enemyMultiplier: 0.55,
    rewardMultiplier: 1.7,
    guaranteedEquipment: true,
    healRatio: 0,
  },
  rest: {
    id: 'rest',
    enemyMultiplier: 0.5,
    rewardMultiplier: 0.8,
    healRatio: 0.24,
  },
  antechamber: {
    id: 'antechamber',
    enemyMultiplier: 0.7,
    rewardMultiplier: 1.15,
    healRatio: 0.12,
  },
  boss: {
    id: 'boss',
    enemyMultiplier: 1,
    rewardMultiplier: 2,
    healRatio: 0,
  },
}

export function roomEventProfile(id = 'combat') {
  return EVENTS[id] ?? EVENTS.combat
}

export function roomEventForFloor(floor, roll = 0.5) {
  if (floor >= 5) return EVENTS.boss
  if (floor === 4 && roll < 0.08) return EVENTS.rest
  if (roll < 0.26) return EVENTS.treasure
  if (roll < 0.48 && floor >= 2) return EVENTS.elite
  if (floor === 4 && roll < 0.62) return EVENTS.antechamber
  return EVENTS.combat
}

export function roomEventSeed(floor, runSeed = 0) {
  const value = Math.sin((floor + 1) * 9283 + (runSeed + 17) * 37) * 43758.5453
  return value - Math.floor(value)
}
