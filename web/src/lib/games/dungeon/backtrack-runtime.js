import { ensureDungeonFloorRuntime, installDungeonFloorSceneBridge } from './floor-runtime.js'
import { canRetreatFromFloor, restoreChestState, restoreDropState, snapshotFloorState } from './floor-history.js'
import { portalDwellState } from './portal-dwell.js'
import { ensureDungeonPortalRuntime, installDungeonPortalSceneBridge } from './portal-runtime.js'
import { roomAnchor } from './room-anchors.js'
import { circleHitsSolid } from './spatial.js'

const PLAYER_RADIUS = 18
const PORTAL_CLEARANCE = 44
const PORTAL_TRIGGER_RADIUS = 34
const FORWARD_PORTAL_TRIGGER_RADIUS = 38

function cloneData(value) {
  if (value == null) return value
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value))
}

function destroyCountdown(portal) {
  portal?.countdownLabel?.destroy?.()
  if (portal) {
    portal.countdownLabel = null
    portal.dwell = { enteredAt: null, seconds: null, complete: false }
  }
}

function updateCountdown(scene, portal, dwell, player, color = '#f4f0e8') {
  if (!portal || !player) return
  if (!dwell?.seconds) {
    portal.countdownLabel?.destroy?.()
    portal.countdownLabel = null
    return
  }
  if (!portal.countdownLabel) {
    portal.countdownLabel = scene.add?.text?.(player.state.x, player.state.y - 58, String(dwell.seconds), {
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: '28px',
      fontStyle: 'bold',
      color,
      stroke: '#08090b',
      strokeThickness: 6,
    })?.setOrigin?.(0.5)?.setDepth?.(75) ?? null
  }
  portal.countdownLabel?.setText?.(String(dwell.seconds))
  portal.countdownLabel?.setPosition?.(player.state.x, player.state.y - 58)
}

function destroyBackPortal(portal) {
  if (!portal) return
  for (const tween of portal.tweens ?? []) {
    tween?.stop?.()
    tween?.remove?.()
  }
  portal.tweens = []
  destroyCountdown(portal)
  for (const object of portal.objects ?? []) object?.destroy?.()
}

function setBackPortalVisible(portal, visible) {
  for (const object of portal?.objects ?? []) object?.setVisible?.(visible)
  portal?.countdownLabel?.setVisible?.(visible)
  if (portal) portal.visible = visible
}

function createBackPortal(scene, id = '') {
  const spawn = roomAnchor(scene.__roomGeometry, 'spawn')
  const x = spawn.x
  const y = Math.min((scene.__roomGeometry?.height ?? 600) - 72, spawn.y + 74)
  const objects = []
  const tweens = []
  if (scene.add) {
    const glow = scene.add.circle?.(x, y, 34, 0x67a8ff, 0.07)?.setDepth?.(8)
    const ring = scene.add.circle?.(x, y, 23, 0x17365f, 0.34)?.setStrokeStyle?.(4, 0x67a8ff, 0.9)?.setDepth?.(9)
    const text = scene.add.text?.(x, y, '↩', { fontSize: '19px', fontStyle: 'bold', color: '#b8d5ff', stroke: '#08090b', strokeThickness: 4 })?.setOrigin?.(0.5)?.setDepth?.(10)
    for (const object of [glow, ring, text]) if (object) objects.push(object)
    if (glow) {
      const tween = scene.tweens?.add?.({ targets: glow, scale: 1.25, alpha: 0.16, duration: 760, yoyo: true, repeat: -1 })
      if (tween) tweens.push(tween)
    }
  }
  return {
    id: String(id || `backtrack:${Math.max(1, Number(scene.floor) || 1)}`),
    x,
    y,
    unlockAt: (scene.time?.now ?? 0) + 650,
    objects,
    tweens,
    visible: true,
    dwell: { enteredAt: null, seconds: null, complete: false },
    countdownLabel: null,
  }
}

function containingRoom(geometry, point) {
  return (geometry?.rooms ?? []).find((room) => point.x >= room.x && point.x <= room.x + room.width && point.y >= room.y && point.y <= room.y + room.height) ?? null
}

function validRestorePoint(point, geometry, portal) {
  const margin = PLAYER_RADIUS + 4
  const width = geometry?.width ?? 960
  const height = geometry?.height ?? 600
  if (point.x < margin || point.x > width - margin || point.y < margin || point.y > height - margin) return false
  if (portal && Math.hypot(point.x - portal.x, point.y - portal.y) < PORTAL_CLEARANCE) return false
  return !circleHitsSolid(point, PLAYER_RADIUS, geometry)
}

export function safeRestorePosition(geometry, direction = 'back') {
  const anchor = roomAnchor(geometry, direction === 'back' ? 'exit' : 'spawn')
  if (direction !== 'back') return anchor

  const room = containingRoom(geometry, anchor)
  const target = room?.center ?? (room ? { x: room.x + room.width / 2, y: room.y + room.height / 2 } : roomAnchor(geometry, 'spawn'))
  const vx = target.x - anchor.x
  const vy = target.y - anchor.y
  const length = Math.hypot(vx, vy) || 1
  const ux = vx / length
  const uy = vy / length
  const angles = [0, Math.PI / 6, -Math.PI / 6, Math.PI / 3, -Math.PI / 3, Math.PI / 2, -Math.PI / 2, Math.PI]
  const distances = [52, 68, 84, 104, 128, 152]

  for (const distance of distances) {
    for (const angle of angles) {
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)
      const dx = ux * cos - uy * sin
      const dy = ux * sin + uy * cos
      const candidate = { x: anchor.x + dx * distance, y: anchor.y + dy * distance }
      if (validRestorePoint(candidate, geometry, anchor)) return candidate
    }
  }

  const fallbacks = [...(geometry?.spawnPoints ?? []), roomAnchor(geometry, 'spawn')]
    .filter(Boolean)
    .sort((a, b) => Math.hypot(a.x - anchor.x, a.y - anchor.y) - Math.hypot(b.x - anchor.x, b.y - anchor.y))
  return fallbacks.find((point) => validRestorePoint(point, geometry, anchor)) ?? anchor
}

function placeAfterRestore(scene, direction, player) {
  const position = safeRestorePosition(scene.__roomGeometry, direction)
  player.state.x = position.x
  player.state.y = position.y
  player.actor?.setPosition?.(position.x, position.y)
  scene.updateHealthBar?.(player.bar, position.x, position.y - 42, player.state.hp, player.state.maxHp)
}

export function installDungeonBacktracking(scene, { onProgress = () => {}, player = scene?.localPlayer } = {}) {
  if (!scene || !player || scene.__dungeonBacktrackingInstalled || !scene.__infiniteDungeon || !scene.__dungeonSpatial) return scene?.__dungeonBacktracking ?? null
  scene.__dungeonBacktrackingInstalled = true

  installDungeonFloorSceneBridge(scene)
  const floorRuntime = ensureDungeonFloorRuntime(scene)
  installDungeonPortalSceneBridge(scene)
  const portalRuntime = ensureDungeonPortalRuntime(scene)
  const originalStartFloor = scene.startFloor.bind(scene)
  const originalGetProgress = scene.__infiniteDungeon.getProgress.bind(scene.__infiniteDungeon)
  let previousState = null
  let currentState = null
  let backtracked = false
  let backPortal = null
  let updateOwner = null
  let restoringState = false
  let restorePortalUpdatePolicy = null

  const visibleProgress = () => backtracked && previousState ? previousState.progress : originalGetProgress()
  scene.__infiniteDungeon.getProgress = visibleProgress

  const capture = () => snapshotFloorState(scene, visibleProgress(), scene.__dungeonSpatial, { fortuneActive: Boolean(visibleProgress()?.fortuneActive) })

  const removeBackPortal = () => {
    destroyBackPortal(backPortal)
    backPortal = null
  }

  const refreshBackPortal = () => {
    removeBackPortal()
    if (!previousState || backtracked) return
    const fromFloor = Math.max(1, Number(scene.floor) || 1)
    const toFloor = Math.max(1, Number(previousState?.progress?.floor) || fromFloor - 1)
    backPortal = createBackPortal(scene, `backtrack:${fromFloor}:${toFloor}`)
  }

  const restoreState = (state, direction) => {
    if (!state) return null
    restoringState = true
    try {
      removeBackPortal()
      scene.destroyPortal?.()
      scene.clearEnemies?.()
      scene.clearEnemyProjectiles?.()
      scene.clearDrops?.()
      scene.floor = state.progress.floor
      scene.floorCleared = state.cleared
      scene.floorKills = state.floorKills ?? 0

      if (!state.cleared) {
        originalStartFloor(false)
        if (state.geometry) scene.__dungeonSpatial.refreshRoom?.({ geometry: state.geometry })
      } else if (state.geometry) {
        scene.__dungeonSpatial.refreshRoom?.({ geometry: state.geometry })
      } else scene.drawArena?.()

      restoreChestState(scene, state.chests)
      if (state.cleared) restoreDropState(scene, state.drops)
      if (state.cleared) scene.openPortal?.(player)
      placeAfterRestore(scene, direction, player)
      scene.showBanner?.(`${direction === 'back' ? '↩ ' : ''}${state.progress.floor}`, direction === 'back' ? '#67a8ff' : '#f4f0e8', 30)
      return state
    } finally {
      restoringState = false
    }
  }

  const retreat = () => {
    if (!previousState || backtracked || !canRetreatFromFloor(scene)) return false
    currentState = capture()
    backtracked = true
    restoreState(previousState, 'back')
    onProgress(visibleProgress())
    return true
  }

  const navigationSnapshot = () => ({
    version: 1,
    backtracked: Boolean(backtracked),
    progress: cloneData(originalGetProgress()),
    previousState: cloneData(previousState),
    currentState: cloneData(currentState),
  })

  const applyNavigationState = (value, { materialize = true } = {}) => {
    if (!value || typeof value !== 'object') return false
    const nextPrevious = cloneData(value.previousState ?? null)
    const nextCurrent = cloneData(value.currentState ?? null)
    const nextBacktracked = Boolean(value.backtracked && nextPrevious)
    scene.__infiniteDungeon.restoreProgress?.(cloneData(value.progress ?? null))
    previousState = nextPrevious
    currentState = nextCurrent
    backtracked = nextBacktracked

    if (materialize && backtracked && previousState) restoreState(previousState, 'back')
    else refreshBackPortal()
    onProgress(visibleProgress())
    return true
  }

  const setUpdateOwner = (owner = null) => {
    const previous = updateOwner
    updateOwner = typeof owner === 'function' ? owner : null
    if (updateOwner) destroyCountdown(backPortal)
    return () => {
      if (updateOwner === owner) updateOwner = previous
    }
  }

  const restoreFloorTransitionPolicy = floorRuntime.setTransitionPolicy({
    beforeAdvance() {
      if (backtracked) {
        previousState = capture()
        backtracked = false
        restoreState(currentState, 'forward')
        currentState = null
        refreshBackPortal()
        onProgress(visibleProgress())
        return { handled: true, value: scene.floor }
      }

      previousState = capture()
      return { handled: false }
    },
    afterAdvance({ handled }) {
      if (handled) return
      currentState = null
      refreshBackPortal()
    },
  })

  restorePortalUpdatePolicy = portalRuntime.setUpdatePolicy({
    beforeUpdate({ time, player: target, portal, hasUpdateOwner }) {
      if (hasUpdateOwner) return { handled: false }
      if (!portal || !target || time < portal.unlockAt) return { handled: true, value: null }
      const inside = Math.hypot(portal.x - target.state.x, portal.y - target.state.y) <= FORWARD_PORTAL_TRIGGER_RADIUS
      portal.dwell = portalDwellState(portal.dwell, { inside, now: time })
      updateCountdown(scene, portal, portal.dwell, target, '#70ff9f')
      if (!portal.dwell.complete) return { handled: true, value: portal.dwell }
      destroyCountdown(portal)
      scene.advanceFloor(target)
      return { handled: true, value: null }
    },
  })

  const updateBackPortal = () => {
    if (!backPortal || backtracked) return
    const available = canRetreatFromFloor(scene)
    if (backPortal.visible !== available) setBackPortalVisible(backPortal, available)
    const localTime = scene.time?.now ?? 0

    if (updateOwner) {
      destroyCountdown(backPortal)
      updateOwner({
        portal: backPortal,
        player,
        time: localTime,
        available,
        unlocked: available && localTime >= backPortal.unlockAt,
        retreat,
      })
      return
    }

    if (!available || localTime < backPortal.unlockAt) {
      if (!available) destroyCountdown(backPortal)
      return
    }

    const inside = Math.hypot(player.state.x - backPortal.x, player.state.y - backPortal.y) <= PORTAL_TRIGGER_RADIUS
    backPortal.dwell = portalDwellState(backPortal.dwell, { inside, now: localTime })
    updateCountdown(scene, backPortal, backPortal.dwell, player, '#67a8ff')
    if (!backPortal.dwell.complete) return
    destroyCountdown(backPortal)
    retreat()
  }
  scene.events?.on?.('update', updateBackPortal)

  scene.events?.once?.('shutdown', () => {
    removeBackPortal()
    destroyCountdown(scene.portal)
    scene.events?.off?.('update', updateBackPortal)
    updateOwner = null
    restorePortalUpdatePolicy?.()
    restorePortalUpdatePolicy = null
    restoreFloorTransitionPolicy()
    scene.__infiniteDungeon.getProgress = originalGetProgress
  })

  const api = {
    retreat,
    getVisibleProgress: visibleProgress,
    getPortal: () => backPortal,
    isBacktracked: () => backtracked,
    isRestoring: () => restoringState,
    snapshot: navigationSnapshot,
    applyState: applyNavigationState,
    setUpdateOwner,
  }
  scene.__dungeonBacktracking = api
  return api
}
