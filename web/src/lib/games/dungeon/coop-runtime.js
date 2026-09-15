import { lootMotion } from './combat-feel.js'
import { applyPlayerContextSnapshot, normalizeDungeonInput } from './player-context.js'
import {
  applyDropSnapshot,
  applyEnemySnapshot,
  createDungeonCoopSnapshot,
  geometrySignature,
  reconcilePredictedPlayer,
  shouldIncludeGeometry,
} from './coop-state.js'

const INPUT_INTERVAL_MS = 50
const SNAPSHOT_INTERVAL_MS = 100

export function acceptRemoteInput(previous = null, packet = {}) {
  const next = normalizeDungeonInput(packet)
  const previousSeq = Number(previous?.seq) || 0
  if (next.seq <= previousSeq) return previous
  return { ...next, skill: Boolean(next.skill || previous?.skill), interact: Boolean(next.interact || previous?.interact) }
}

export function consumeRemoteInput(input = {}) {
  const current = normalizeDungeonInput(input)
  return { current, remaining: { ...current, skill: false, interact: false } }
}

export function nextGuestInput(input = {}, sequence = 0, pending = {}) {
  const normalized = normalizeDungeonInput(input)
  return normalizeDungeonInput({ ...normalized, seq: sequence + 1, skill: Boolean(normalized.skill || pending.skill), interact: Boolean(normalized.interact || pending.interact) })
}

export function simulateAuthoritativeRemotePlayer(scene, player, input, time, dt) {
  if (!scene || !player || player.dead || (player.state?.hp ?? 0) <= 0 || scene.dead || scene.runComplete) return false
  scene.updatePlayer?.(dt, player, input)
  scene.__dungeonPickupRuntime?.updatePlayer?.(player, input)
  if (input?.interact) scene.__dungeonCoopChest?.interactPlayer?.(player)
  scene.autoAttack?.(time, player)
  scene.trySkill?.(time, player, input)
  return true
}

function updateMirroredDropVisuals(scene) {
  const now = scene.time?.now ?? 0
  for (const drop of scene.drops ?? []) {
    if (!drop || drop.spawnedAt == null || !drop.visual) continue
    const motion = lootMotion(now - drop.spawnedAt, drop.groundY ?? drop.y, 72)
    drop.visual.setY?.(motion.y)
    drop.visual.setScale?.((drop.baseScaleX ?? 1) * motion.scale, (drop.baseScaleY ?? 1) * motion.scale)
    if (drop.glow && now - drop.spawnedAt < 420) drop.glow.setAlpha?.(Math.min(0.75, (now - drop.spawnedAt) / 420 * 0.65))
  }
}

function actorUsesTexture(actor) { return actor?.getData?.('usesTexture') === true }
function refreshRemoteActorVisual(scene, playerRuntime, player) {
  if (!player || actorUsesTexture(player.actor) || !actorUsesTexture(scene.player)) return false
  const next = scene.makeActor?.(player.state.x, player.state.y, 'player')?.setDepth?.(19) ?? null
  if (!next || !actorUsesTexture(next)) { next?.destroy?.(); return false }
  player.actor?.destroy?.(); player.actor = next
  if (player.dead) player.actor?.setAlpha?.(0.38)
  playerRuntime.updatePlayerVisual(player)
  playerRuntime.syncAnimation(player, player.attacking ? 'attack' : null)
  return true
}

function destroyPortalMirror(scene) {
  const portal = scene.__coopPortalMirror
  portal?.glow?.destroy?.(); portal?.ring?.destroy?.(); portal?.core?.destroy?.()
  scene.__coopPortalMirror = null
  if (scene.portal === portal) scene.portal = null
}

function applyPortalSnapshot(scene, snapshot) {
  if (!snapshot) { destroyPortalMirror(scene); return }
  let portal = scene.__coopPortalMirror
  if (!portal) {
    const glow = scene.add?.circle?.(snapshot.x, snapshot.y, 40, 0x70ff9f, 0.08)?.setDepth?.(8) ?? null
    const ring = scene.add?.circle?.(snapshot.x, snapshot.y, 27, 0x1f5132, 0.28)?.setStrokeStyle?.(4, 0x70ff9f, 0.9)?.setDepth?.(9) ?? null
    const core = scene.add?.circle?.(snapshot.x, snapshot.y, 16, 0x70ff9f, 0.42)?.setDepth?.(10) ?? null
    portal = { x: snapshot.x, y: snapshot.y, unlockAt: snapshot.unlockAt ?? 0, glow, ring, core }
    scene.__coopPortalMirror = portal; scene.portal = portal
  }
  portal.x = snapshot.x; portal.y = snapshot.y; portal.unlockAt = snapshot.unlockAt ?? 0
  portal.glow?.setPosition?.(portal.x, portal.y); portal.ring?.setPosition?.(portal.x, portal.y); portal.core?.setPosition?.(portal.x, portal.y)
}

function syncPlayerSnapshotPresentation(playerRuntime, player, snapshot, previousAttackAt = 0) {
  if (!player || !snapshot) return
  playerRuntime.updatePlayerVisual(player)
  const attackAdvanced = Number(snapshot.lastAttackAt) > Number(previousAttackAt || 0)
  playerRuntime.syncAnimation(player, snapshot.attacking || attackAdvanced ? 'attack' : null)
}

export function installDungeonCoop(scene, { role, localPlayerId, remotePlayerId, sendInput = () => {}, sendState = () => {}, getProgress = () => ({}), onProgress = () => {}, onGameOver = () => {} } = {}) {
  if (!scene || scene.__dungeonCoop) return scene?.__dungeonCoop ?? null
  const playerRuntime = scene.__dungeonPlayerRuntime
  if (!playerRuntime) throw new Error('Dungeon co-op requires installDungeonAttackRuntime before installDungeonCoop')
  if (role !== 'host' && role !== 'guest') throw new Error(`invalid Dungeon co-op role: ${role}`)

  playerRuntime.setLocalPlayerId(localPlayerId)
  const localPlayer = playerRuntime.localPlayer
  const remotePlayer = playerRuntime.addPlayer({ id: remotePlayerId })
  let remoteInput = normalizeDungeonInput(), inputSequence = 0, snapshotSequence = 0
  let lastInputSentAt = -Infinity, lastSnapshotSentAt = -Infinity, lastSnapshotSequence = 0
  let lastGeometryVersion = geometrySignature(scene.__roomGeometry)
  let pendingSkill = false, pendingInteract = false, destroyed = false

  const originals = role === 'guest' ? { updateEnemies: scene.updateEnemies?.bind(scene), updateEnemyProjectiles: scene.updateEnemyProjectiles?.bind(scene), updateDrops: scene.updateDrops?.bind(scene), updatePortal: scene.updatePortal?.bind(scene), autoAttack: scene.autoAttack?.bind(scene), trySkill: scene.trySkill?.bind(scene) } : null
  if (role === 'guest') {
    scene.__dungeonMirrorMode = true
    scene.clearEnemies?.(); scene.clearEnemyProjectiles?.(); scene.clearDrops?.(); scene.destroyPortal?.()
    scene.updateEnemies = () => {}; scene.updateEnemyProjectiles = () => {}; scene.updateDrops = () => updateMirroredDropVisuals(scene); scene.updatePortal = () => {}; scene.autoAttack = () => {}; scene.trySkill = () => {}
  }

  const hostUpdate = (time, delta) => {
    if (destroyed || role !== 'host' || scene.dead || scene.runComplete) return
    refreshRemoteActorVisual(scene, playerRuntime, remotePlayer)
    const dt = Math.min(Number(delta) || 0, 40) / 1000
    const consumed = consumeRemoteInput(remoteInput); remoteInput = consumed.remaining
    simulateAuthoritativeRemotePlayer(scene, remotePlayer, consumed.current, time, dt)
    if (time - lastSnapshotSentAt < SNAPSHOT_INTERVAL_MS) return
    lastSnapshotSentAt = time; snapshotSequence++
    const version = geometrySignature(scene.__roomGeometry)
    if (lastGeometryVersion && version && version !== lastGeometryVersion) playerRuntime.repositionRemotePlayers?.()
    const includeGeometry = shouldIncludeGeometry(snapshotSequence, version, lastGeometryVersion)
    const snapshot = createDungeonCoopSnapshot(scene, getProgress(), { sequence: snapshotSequence, includeGeometry })
    if (includeGeometry) lastGeometryVersion = version
    sendState(snapshot)
  }

  const guestUpdate = (time) => {
    if (destroyed || role !== 'guest') return
    refreshRemoteActorVisual(scene, playerRuntime, remotePlayer)
    const input = localPlayer.input ?? normalizeDungeonInput()
    pendingSkill ||= Boolean(input.skill); pendingInteract ||= Boolean(input.interact)
    if (time - lastInputSentAt < INPUT_INTERVAL_MS) return
    lastInputSentAt = time
    const packet = nextGuestInput(input, inputSequence, { skill: pendingSkill, interact: pendingInteract })
    inputSequence = packet.seq; pendingSkill = false; pendingInteract = false; sendInput(packet)
  }
  const update = (time, delta) => role === 'host' ? hostUpdate(time, delta) : guestUpdate(time)
  scene.events?.on?.('update', update)

  const receiveInput = (packet) => {
    if (role !== 'host') return false
    const accepted = acceptRemoteInput(remoteInput, packet)
    if (!accepted || accepted === remoteInput) return false
    remoteInput = accepted; return true
  }

  const receiveState = (snapshot) => {
    if (role !== 'guest' || !snapshot || Number(snapshot.sequence) <= lastSnapshotSequence) return false
    lastSnapshotSequence = Number(snapshot.sequence) || lastSnapshotSequence
    const geometryChanged = Boolean(snapshot.geometry)
    if (snapshot.geometry) scene.__dungeonSpatial?.refreshRoom?.({ geometry: snapshot.geometry })
    if (snapshot.progress) onProgress(snapshot.progress)
    if (Number.isFinite(Number(snapshot.floor))) scene.floor = Number(snapshot.floor)
    scene.floorCleared = Boolean(snapshot.floorCleared); scene.runComplete = Boolean(snapshot.runComplete)

    const players = Array.isArray(snapshot.players) ? snapshot.players : []
    const localSnapshot = players.find((player) => player?.id === localPlayerId)
    const remoteSnapshot = players.find((player) => player?.id === remotePlayerId)
    if (localSnapshot) {
      const previousAttackAt = localPlayer.lastAttackAt
      if (geometryChanged) applyPlayerContextSnapshot(localPlayer, localSnapshot); else reconcilePredictedPlayer(localPlayer, localSnapshot)
      syncPlayerSnapshotPresentation(playerRuntime, localPlayer, localSnapshot, previousAttackAt); scene.emitStats?.()
    }
    if (remoteSnapshot && remotePlayer) {
      const previousAttackAt = remotePlayer.lastAttackAt
      applyPlayerContextSnapshot(remotePlayer, remoteSnapshot); refreshRemoteActorVisual(scene, playerRuntime, remotePlayer); syncPlayerSnapshotPresentation(playerRuntime, remotePlayer, remoteSnapshot, previousAttackAt)
    }

    applyEnemySnapshot(scene, snapshot.enemies ?? []); applyDropSnapshot(scene, snapshot.drops ?? []); scene.__dungeonCoopChest?.applySnapshot?.(snapshot.chests ?? []); applyPortalSnapshot(scene, snapshot.portal ?? null)
    if (snapshot.dead) { scene.dead = true; onGameOver(snapshot) }
    return true
  }

  const destroy = () => {
    if (destroyed) return
    destroyed = true; scene.events?.off?.('update', update); destroyPortalMirror(scene); playerRuntime.removePlayer(remotePlayerId)
    if (role === 'guest' && originals) {
      scene.updateEnemies = originals.updateEnemies; scene.updateEnemyProjectiles = originals.updateEnemyProjectiles; scene.updateDrops = originals.updateDrops; scene.updatePortal = originals.updatePortal; scene.autoAttack = originals.autoAttack; scene.trySkill = originals.trySkill; scene.__dungeonMirrorMode = false
    }
    scene.__dungeonCoop = null
  }
  scene.events?.once?.('shutdown', destroy); scene.events?.once?.('destroy', destroy)
  const api = { role, localPlayer, remotePlayer, receiveInput, receiveState, destroy, getRemoteInput: () => ({ ...remoteInput }) }
  scene.__dungeonCoop = api
  return api
}
