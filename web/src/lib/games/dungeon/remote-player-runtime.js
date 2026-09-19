import { attachPlayerEntity, detachPlayerEntity } from './player-entity.js'
import { currentWeapon } from './player-loadout.js'
import { applyPlayerSnapshot } from './player-snapshot.js'
import { createWeaponVisual, weaponPose, weaponVisualProfile } from './weapon-visual-runtime.js'
import { DEFAULT_WEAPON_PRESENTATION, resolveWeaponPresentation } from './weapon-presentation.js'
import { createDefaultPlayerState } from './player-state.js'

function restorePlayerRuntime(player) {
  const restored = new Set()
  for (const runtime of Object.values(player?.runtime ?? {})) {
    if (!runtime || typeof runtime !== 'object' || restored.has(runtime)) continue
    restored.add(runtime)
    runtime.restore?.()
  }
  player.runtime = {}
}

function copyLocalPlayerVisual(scene, x, y) {
  const localPlayer = scene.localPlayer
  const local = localPlayer?.actor
  const key = local?.texture?.key
  if (!key || !scene.add?.sprite) return null
  const frame = local.frame?.name ?? 0
  const actor = scene.add.sprite(x, y, key, frame)
  actor.setScale?.(local.scaleX ?? 1, local.scaleY ?? 1)
  actor.setData?.('usesTexture', true)
  return actor
}

function createRemoteActor(scene, x, y) {
  let actor = scene.makeActor?.(x, y, 'player') ?? null
  if (actor?.getData?.('usesTexture') !== false) return actor

  const replacement = copyLocalPlayerVisual(scene, x, y)
  if (!replacement) return actor
  actor?.destroy?.()
  actor = replacement
  return actor
}

function installRemoteWeaponPresentation(scene, player) {
  player.runtime ??= {}
  let visual = null
  let currentKey = null

  const destroyVisual = () => {
    visual?.destroy?.()
    visual = null
    currentKey = null
  }

  const sync = () => {
    const item = currentWeapon(player.state)
    const profile = weaponVisualProfile(item)
    if (!profile) {
      destroyVisual()
      return null
    }

    const nextKey = `${profile.archetype}:${profile.textureKey}`
    if (!visual || currentKey !== nextKey) {
      destroyVisual()
      visual = createWeaponVisual(scene, item, player.state.x, player.state.y, {
        presentationConfig: scene.__dungeonWeaponPresentation ?? null,
      })
      currentKey = visual ? nextKey : null
    }
    if (!visual) return null

    const presentation = resolveWeaponPresentation(
      scene.__dungeonWeaponPresentation ?? DEFAULT_WEAPON_PRESENTATION,
      item,
      player.facing,
      { attacking: Boolean(player.attacking) },
    )
    const pose = weaponPose(player.state, player.facing, {
      attacking: Boolean(player.attacking),
      presentationConfig: scene.__dungeonWeaponPresentation ?? null,
      item,
    })
    visual.setOrigin?.(presentation.grip.x, presentation.grip.y)
    visual.setScale?.(profile.scale * presentation.scale)
    visual.setPosition?.(pose.x, pose.y)
    visual.setAngle?.(pose.angle)
    visual.setFlipX?.(pose.flipX)
    visual.setDepth?.(pose.depth)
    return visual
  }

  const onPresentationReady = () => sync()
  const onWeaponArtReady = () => sync()
  scene.events?.on?.('dungeon-weapon-presentation-ready', onPresentationReady)
  scene.load?.on?.('complete', onWeaponArtReady)

  let api = null
  const restore = () => {
    scene.events?.off?.('dungeon-weapon-presentation-ready', onPresentationReady)
    scene.load?.off?.('complete', onWeaponArtReady)
    destroyVisual()
    if (player.runtime?.weaponVisuals === api) delete player.runtime.weaponVisuals
  }

  api = { sync, visual: () => visual, restore }
  player.runtime.weaponVisuals = api
  sync()
  return api
}

function createPlayerLabel(scene, player) {
  if (!scene.add?.text) return null
  const slot = Number.isInteger(player.slot) ? player.slot + 1 : '?'
  return scene.add.text(player.state.x, player.state.y - 58, `P${slot}`, {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: '10px',
    fontStyle: 'bold',
    color: '#d8e5ef',
    stroke: '#08090b',
    strokeThickness: 3,
  }).setOrigin?.(0.5)?.setDepth?.(32) ?? null
}

export function syncRemotePlayerPresentation(scene, player) {
  player.actor?.setPosition?.(player.state.x, player.state.y)
  player.label?.setPosition?.(player.state.x, player.state.y - 58)
  if (player.label?.setText) {
    const slot = Number.isInteger(player.slot) ? player.slot + 1 : '?'
    player.label.setText(`P${slot}`)
  }
  scene.updateHealthBar?.(
    player.bar,
    player.state.x,
    player.state.y - 42,
    player.state.hp,
    player.state.maxHp,
  )
  player.runtime?.weaponVisuals?.sync?.()
  scene.syncPlayerAnimation?.(player.attacking ? 'attack' : null, player)
}

export function spawnRemotePlayer(scene, snapshot) {
  if (!scene || typeof scene !== 'object') throw new TypeError('Scene is required')
  if (!snapshot || typeof snapshot !== 'object') throw new TypeError('Player snapshot is required')

  const id = String(snapshot.id ?? '')
  if (!id) throw new TypeError('Remote player id is required')
  if (scene.localPlayer && id === String(scene.localPlayer.id)) {
    throw new Error(`Remote player ${id} conflicts with local player`)
  }

  const normalizedSnapshot = {
    ...snapshot,
    state: createDefaultPlayerState(snapshot.state ?? {}),
  }
  const player = attachPlayerEntity(scene, {
    id,
    state: normalizedSnapshot.state,
  })
  applyPlayerSnapshot(player, normalizedSnapshot)

  player.actor = createRemoteActor(scene, player.state.x, player.state.y)
  player.actor?.setDepth?.(20)
  player.bar = scene.createHealthBar?.(
    player.state.x,
    player.state.y - 42,
    54,
    6,
    0x55e879,
  ) ?? null
  player.label = createPlayerLabel(scene, player)
  installRemoteWeaponPresentation(scene, player)

  syncRemotePlayerPresentation(scene, player)
  return player
}

export function despawnRemotePlayer(scene, playerOrId) {
  if (!scene || !(scene.players instanceof Map)) return null
  const id = typeof playerOrId === 'object' && playerOrId != null
    ? String(playerOrId.id ?? '')
    : String(playerOrId ?? '')
  if (!id) return null

  const player = scene.players.get(id)
  if (!player || player === scene.localPlayer) return null

  restorePlayerRuntime(player)
  player.actor?.destroy?.()
  player.bar?.destroy?.()
  player.label?.destroy?.()
  player.actor = null
  player.bar = null
  player.label = null
  return detachPlayerEntity(scene, id)
}
