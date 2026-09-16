const PLAYER_PAST_TIMES = [
  ['lastAttackAt', 'lastAttackElapsedMs'],
  ['lastContactAt', 'lastContactElapsedMs'],
]

const ENEMY_FUTURE_TIMES = [
  ['nextChargeAt', 'nextChargeRemainingMs'],
  ['nextShockwaveAt', 'nextShockwaveRemainingMs'],
  ['chargingUntil', 'chargingRemainingMs'],
  ['nextProjectileAt', 'nextProjectileRemainingMs'],
  ['nextSpecialAt', 'nextSpecialRemainingMs'],
  ['dashUntil', 'dashRemainingMs'],
  ['specialLockedUntil', 'specialLockedRemainingMs'],
]

function clone(value) {
  return structuredClone(value ?? {})
}

function clockValue(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function elapsedSince(timestamp, now) {
  return Math.max(0, clockValue(now) - clockValue(timestamp))
}

function remainingUntil(timestamp, now) {
  return Math.max(0, clockValue(timestamp) - clockValue(now))
}

function consumeElapsed(value, elapsedMs) {
  return Math.max(0, clockValue(value)) + Math.max(0, clockValue(elapsedMs))
}

function consumeRemaining(value, elapsedMs) {
  return Math.max(0, Math.max(0, clockValue(value)) - Math.max(0, clockValue(elapsedMs)))
}

function capturePlayer(player, now) {
  for (const [absoluteField, portableField] of PLAYER_PAST_TIMES) {
    if (!(absoluteField in player)) continue
    player[portableField] = elapsedSince(player[absoluteField], now)
    delete player[absoluteField]
  }

  if (player.skillCooldowns && typeof player.skillCooldowns === 'object') {
    const remaining = {}
    for (const [skillId, readyAt] of Object.entries(player.skillCooldowns)) {
      remaining[skillId] = remainingUntil(readyAt, now)
    }
    player.skillCooldownRemainingMs = remaining
    delete player.skillCooldowns
  }

  if (player.state && typeof player.state === 'object' && 'hasteUntil' in player.state) {
    player.state.hasteRemainingMs = remainingUntil(player.state.hasteUntil, now)
    delete player.state.hasteUntil
  }
}

function consumePlayer(player, elapsedMs) {
  for (const [, portableField] of PLAYER_PAST_TIMES) {
    if (portableField in player) player[portableField] = consumeElapsed(player[portableField], elapsedMs)
  }

  if (player.skillCooldownRemainingMs && typeof player.skillCooldownRemainingMs === 'object') {
    for (const skillId of Object.keys(player.skillCooldownRemainingMs)) {
      player.skillCooldownRemainingMs[skillId] = consumeRemaining(
        player.skillCooldownRemainingMs[skillId],
        elapsedMs,
      )
    }
  }

  if (player.state && typeof player.state === 'object' && 'hasteRemainingMs' in player.state) {
    player.state.hasteRemainingMs = consumeRemaining(player.state.hasteRemainingMs, elapsedMs)
  }
}

function materializePlayer(player, now) {
  const current = clockValue(now)
  for (const [absoluteField, portableField] of PLAYER_PAST_TIMES) {
    if (!(portableField in player)) continue
    player[absoluteField] = current - Math.max(0, clockValue(player[portableField]))
    delete player[portableField]
  }

  if (player.skillCooldownRemainingMs && typeof player.skillCooldownRemainingMs === 'object') {
    const cooldowns = {}
    for (const [skillId, remainingMs] of Object.entries(player.skillCooldownRemainingMs)) {
      const remaining = Math.max(0, clockValue(remainingMs))
      cooldowns[skillId] = remaining > 0 ? current + remaining : 0
    }
    player.skillCooldowns = cooldowns
    delete player.skillCooldownRemainingMs
  }

  if (player.state && typeof player.state === 'object' && 'hasteRemainingMs' in player.state) {
    const remaining = Math.max(0, clockValue(player.state.hasteRemainingMs))
    player.state.hasteUntil = remaining > 0 ? current + remaining : 0
    delete player.state.hasteRemainingMs
  }
}

function captureEnemy(enemy, now) {
  for (const [absoluteField, portableField] of ENEMY_FUTURE_TIMES) {
    if (!(absoluteField in enemy)) continue
    enemy[portableField] = remainingUntil(enemy[absoluteField], now)
    delete enemy[absoluteField]
  }
}

function consumeEnemy(enemy, elapsedMs) {
  for (const [, portableField] of ENEMY_FUTURE_TIMES) {
    if (portableField in enemy) enemy[portableField] = consumeRemaining(enemy[portableField], elapsedMs)
  }
}

function materializeEnemy(enemy, now) {
  const current = clockValue(now)
  for (const [absoluteField, portableField] of ENEMY_FUTURE_TIMES) {
    if (!(portableField in enemy)) continue
    const remaining = Math.max(0, clockValue(enemy[portableField]))
    enemy[absoluteField] = remaining > 0 ? current + remaining : 0
    delete enemy[portableField]
  }
}

function eachPlayer(state, callback) {
  for (const player of Object.values(state?.players ?? {})) {
    if (player && typeof player === 'object') callback(player)
  }
}

function eachEnemy(state, callback) {
  for (const enemy of state?.world?.enemies ?? []) {
    if (enemy && typeof enemy === 'object') callback(enemy)
  }
}

export function captureCheckpointClockState(checkpoint, now = 0) {
  const next = clone(checkpoint)
  eachPlayer(next, (player) => capturePlayer(player, now))
  eachEnemy(next, (enemy) => captureEnemy(enemy, now))
  return next
}

export function consumeCheckpointClockState(checkpoint, elapsedMs = 0) {
  const next = clone(checkpoint)
  const elapsed = Math.max(0, clockValue(elapsedMs))
  eachPlayer(next, (player) => consumePlayer(player, elapsed))
  eachEnemy(next, (enemy) => consumeEnemy(enemy, elapsed))
  return next
}

export function materializeCheckpointClockState(checkpoint, now = 0) {
  const next = clone(checkpoint)
  eachPlayer(next, (player) => materializePlayer(player, now))
  eachEnemy(next, (enemy) => materializeEnemy(enemy, now))
  return next
}
