import { advanceCoopLifecycle, createCoopLifecycle, downPlayer } from './coop-lifecycle.js'
import { safeEnemySpawn } from './room-anchors.js'

function normalizeId(player) {
  return String(player?.id ?? '').trim()
}

function livingTeammate(scene, playerId) {
  for (const player of scene.players?.values?.() ?? []) {
    if (normalizeId(player) === playerId) continue
    if (player?.dead || Number(player?.state?.hp ?? 0) <= 0) continue
    return player
  }
  return null
}

function respawnPoint(scene, playerId) {
  const teammate = livingTeammate(scene, playerId)
  if (!teammate) return null
  const desired = {
    x: Number(teammate.state?.x) + 34,
    y: Number(teammate.state?.y),
  }
  return safeEnemySpawn(scene.__roomGeometry, desired, 18)
}

function syncPlayerPresentation(scene, player) {
  player.actor?.setPosition?.(player.state.x, player.state.y)
  scene.updateHealthBar?.(player.bar, player.state.x, player.state.y - 42, player.state.hp, player.state.maxHp)
  scene.syncPlayerAnimation?.(null, player)
  if (player === scene.localPlayer) scene.emitStats?.()
}

export function installCoopLifecycleRuntime(scene, {
  isAuthority = () => false,
  onChange = () => {},
} = {}) {
  if (!scene || typeof scene !== 'object') throw new TypeError('Dungeon scene is required')
  if (scene.__dungeonCoopLifecycle) return scene.__dungeonCoopLifecycle

  const originalGameOver = typeof scene.gameOver === 'function' ? scene.gameOver : null
  const originalHitPlayer = typeof scene.hitPlayer === 'function' ? scene.hitPlayer : null
  let lifecycle = createCoopLifecycle([...(scene.players?.keys?.() ?? [])])
  let partyWiped = false
  let wipePresented = false

  const ensureRoster = () => {
    for (const id of scene.players?.keys?.() ?? []) {
      if (lifecycle[id]) continue
      lifecycle[id] = { status: 'alive', respawnRemainingMs: 0, invulnerabilityRemainingMs: 0 }
    }
  }

  const notify = (extra = {}) => {
    try {
      onChange({
        lifecycle: structuredClone(lifecycle),
        status: partyWiped ? 'wiped' : 'playing',
        partyWiped,
        ...extra,
      })
    } catch {}
  }

  const applyPlayerLifecycle = () => {
    ensureRoster()
    for (const [id, entry] of Object.entries(lifecycle)) {
      const player = scene.players?.get?.(id)
      if (!player) continue
      player.dead = entry.status === 'downed'
      if (player.dead) player.state.hp = Math.max(0, Number(player.state.hp) || 0)
      syncPlayerPresentation(scene, player)
    }
  }

  const presentWipe = (player = scene.localPlayer) => {
    if (wipePresented) return
    wipePresented = true
    originalGameOver?.call(scene, player)
  }

  const down = (player) => {
    const id = normalizeId(player)
    if (!id || !scene.players?.has?.(id)) return null
    ensureRoster()
    if (lifecycle[id]?.status === 'downed') return { lifecycle: structuredClone(lifecycle), partyWiped }

    const result = downPlayer(lifecycle, id)
    lifecycle = result.lifecycle
    partyWiped = result.partyWiped
    player.dead = true
    player.state.hp = 0
    syncPlayerPresentation(scene, player)
    notify({ downed: [id] })

    if (partyWiped) presentWipe(scene.localPlayer ?? player)
    return { lifecycle: structuredClone(lifecycle), partyWiped }
  }

  const coopGameOver = function coopGameOver(player = scene.localPlayer) {
    if (!isAuthority()) return null
    return down(player)
  }
  scene.gameOver = coopGameOver

  const coopHitPlayer = function coopHitPlayer(damage, player = scene.localPlayer) {
    const id = normalizeId(player)
    ensureRoster()
    if (id && Number(lifecycle[id]?.invulnerabilityRemainingMs) > 0) return null
    if (!isAuthority()) return null
    return originalHitPlayer?.call(scene, damage, player)
  }
  if (originalHitPlayer) scene.hitPlayer = coopHitPlayer

  const api = {
    snapshot() {
      ensureRoster()
      return structuredClone(lifecycle)
    },
    status() { return partyWiped ? 'wiped' : 'playing' },
    down,
    apply(nextLifecycle = {}, { status = 'playing' } = {}) {
      lifecycle = structuredClone(nextLifecycle ?? {})
      ensureRoster()
      partyWiped = status === 'wiped'
      applyPlayerLifecycle()
      if (partyWiped) presentWipe(scene.localPlayer)
      else wipePresented = false
      return api.snapshot()
    },
    tick(elapsedMs = 0) {
      ensureRoster()
      if (!isAuthority() || partyWiped) return { lifecycle: api.snapshot(), revived: [] }
      const advanced = advanceCoopLifecycle(lifecycle, elapsedMs)
      lifecycle = advanced.lifecycle
      for (const id of advanced.revived) {
        const player = scene.players?.get?.(id)
        if (!player) continue
        player.dead = false
        player.state.hp = Math.max(1, Math.ceil((Number(player.state.maxHp) || 1) * 0.5))
        const point = respawnPoint(scene, id)
        if (point) {
          player.state.x = point.x
          player.state.y = point.y
        }
        syncPlayerPresentation(scene, player)
      }
      if (advanced.revived.length || elapsedMs > 0) notify({ revived: [...advanced.revived] })
      return { lifecycle: api.snapshot(), revived: [...advanced.revived] }
    },
    isInvulnerable(playerOrId) {
      const id = typeof playerOrId === 'object' ? normalizeId(playerOrId) : String(playerOrId ?? '')
      return Number(lifecycle[id]?.invulnerabilityRemainingMs) > 0
    },
    restore() {
      if (scene.gameOver === coopGameOver && originalGameOver) scene.gameOver = originalGameOver
      if (scene.hitPlayer === coopHitPlayer && originalHitPlayer) scene.hitPlayer = originalHitPlayer
      if (scene.__dungeonCoopLifecycle === api) scene.__dungeonCoopLifecycle = null
    },
  }

  scene.__dungeonCoopLifecycle = api
  return api
}
