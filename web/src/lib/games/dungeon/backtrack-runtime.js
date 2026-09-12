import { roomAnchor } from './room-anchors.js'
import { circleHitsSolid } from './spatial.js'
import { canRetreatFromFloor, restoreChestState, restoreDropState, snapshotFloorState } from './floor-history.js'
import { createRetreatRequest } from './retreat-flow.js'

const PLAYER_RADIUS = 18
const PORTAL_CLEARANCE = 44
const PORTAL_TRIGGER_RADIUS = 34
const PORTAL_REARM_RADIUS = 48

function destroyBackPortal(portal) {
  if (!portal) return
  for (const object of portal.objects ?? []) object?.destroy?.()
}

function setBackPortalVisible(portal, visible) {
  for (const object of portal?.objects ?? []) object?.setVisible?.(visible)
  if (portal) portal.visible = visible
}

function createBackPortal(scene) {
  const spawn = roomAnchor(scene.__roomGeometry, 'spawn')
  const x = spawn.x
  const y = Math.min((scene.__roomGeometry?.height ?? 600) - 72, spawn.y + 74)
  const objects = []
  if (scene.add) {
    const glow = scene.add.circle?.(x, y, 34, 0x67a8ff, 0.07)?.setDepth?.(8)
    const ring = scene.add.circle?.(x, y, 23, 0x17365f, 0.34)?.setStrokeStyle?.(4, 0x67a8ff, 0.9)?.setDepth?.(9)
    const text = scene.add.text?.(x, y, '↩', { fontSize: '19px', fontStyle: 'bold', color: '#b8d5ff', stroke: '#08090b', strokeThickness: 4 })?.setOrigin?.(0.5)?.setDepth?.(10)
    for (const object of [glow, ring, text]) if (object) objects.push(object)
    if (glow) scene.tweens?.add?.({ targets: glow, scale: 1.25, alpha: 0.16, duration: 760, yoyo: true, repeat: -1 })
  }
  return { x, y, unlockAt: (scene.time?.now ?? 0) + 650, objects, visible: true }
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

function placeAfterRestore(scene, direction) {
  const position = safeRestorePosition(scene.__roomGeometry, direction)
  scene.playerState.x = position.x
  scene.playerState.y = position.y
  scene.player?.setPosition?.(position.x, position.y)
  scene.updateHealthBar?.(scene.playerBar, position.x, position.y - 42, scene.playerState.hp, scene.playerState.maxHp)
}

function defaultRetreatPrompt({ confirm, cancel }) {
  if (typeof document === 'undefined') {
    cancel()
    return
  }

  const root = document.createElement('div')
  root.setAttribute('role', 'dialog')
  root.setAttribute('aria-modal', 'true')
  root.setAttribute('aria-label', '返回上一层')
  root.style.cssText = 'position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:20px;background:rgba(4,5,6,.72);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);touch-action:none;'

  const panel = document.createElement('div')
  panel.style.cssText = 'width:min(360px,calc(100vw - 32px));box-sizing:border-box;padding:22px;border:1px solid #39414b;background:#101319;box-shadow:10px 10px 0 rgba(0,0,0,.45);color:#f4f0e8;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;'
  panel.innerHTML = '<div style="font-size:11px;font-weight:900;letter-spacing:.16em;color:#67a8ff;margin-bottom:10px">BACKTRACK</div><strong style="display:block;font-size:20px;line-height:1.2;margin-bottom:8px">返回上一层？</strong><p style="margin:0 0 20px;color:#8c96a1;font:12px/1.6 Inter,system-ui,sans-serif">当前楼层进度会保留，你可以之后再次回来。</p>'

  const actions = document.createElement('div')
  actions.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:10px;'
  const stay = document.createElement('button')
  stay.type = 'button'
  stay.textContent = '继续探索'
  stay.style.cssText = 'min-height:52px;border:1px solid #39414b;background:#171b21;color:#d9dee4;font:800 12px ui-monospace,SFMono-Regular,Menlo,monospace;cursor:pointer;touch-action:manipulation;'
  const back = document.createElement('button')
  back.type = 'button'
  back.textContent = '返回上一层'
  back.style.cssText = 'min-height:52px;border:1px solid #c1ff56;background:#c1ff56;color:#080a0d;font:900 12px ui-monospace,SFMono-Regular,Menlo,monospace;cursor:pointer;touch-action:manipulation;'
  actions.append(stay, back)
  panel.append(actions)
  root.append(panel)
  document.body.append(root)

  const close = (action) => {
    root.remove()
    action()
  }
  stay.addEventListener('click', () => close(cancel), { once: true })
  back.addEventListener('click', () => close(confirm), { once: true })
  root.addEventListener('pointerdown', (event) => event.stopPropagation())
  stay.focus({ preventScroll: true })
}

export function installDungeonBacktracking(scene, { onProgress = () => {}, onRetreatRequest = defaultRetreatPrompt, confirmRetreat } = {}) {
  if (!scene || scene.__dungeonBacktrackingInstalled || !scene.__infiniteDungeon || !scene.__dungeonSpatial) return scene?.__dungeonBacktracking ?? null
  scene.__dungeonBacktrackingInstalled = true

  const originalAdvanceFloor = scene.advanceFloor.bind(scene)
  const originalStartFloor = scene.startFloor.bind(scene)
  const originalGetProgress = scene.__infiniteDungeon.getProgress.bind(scene.__infiniteDungeon)
  let previousState = null
  let currentState = null
  let backtracked = false
  let backPortal = null
  let retreatPromptOpen = false
  let retreatPromptDismissed = false

  const visibleProgress = () => backtracked && previousState ? previousState.progress : originalGetProgress()
  scene.__infiniteDungeon.getProgress = visibleProgress

  const capture = () => snapshotFloorState(scene, visibleProgress(), scene.__dungeonSpatial, { fortuneActive: Boolean(visibleProgress()?.fortuneActive) })

  const removeBackPortal = () => {
    destroyBackPortal(backPortal)
    backPortal = null
    retreatPromptOpen = false
    retreatPromptDismissed = false
  }

  const refreshBackPortal = () => {
    removeBackPortal()
    if (!previousState || backtracked) return
    backPortal = createBackPortal(scene)
  }

  const restoreState = (state, direction) => {
    if (!state) return
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
    if (state.cleared) scene.openPortal?.()
    placeAfterRestore(scene, direction)
    scene.showBanner?.(`${direction === 'back' ? '↩ ' : ''}${state.progress.floor}`, direction === 'back' ? '#67a8ff' : '#f4f0e8', 30)
  }

  const retreat = () => {
    if (!previousState || backtracked || !canRetreatFromFloor(scene)) return false
    currentState = capture()
    backtracked = true
    restoreState(previousState, 'back')
    onProgress(visibleProgress())
    return true
  }

  scene.advanceFloor = function advanceFloorWithHistory() {
    if (backtracked) {
      previousState = capture()
      backtracked = false
      restoreState(currentState, 'forward')
      currentState = null
      refreshBackPortal()
      onProgress(visibleProgress())
      return
    }

    previousState = capture()
    originalAdvanceFloor()
    currentState = null
    refreshBackPortal()
  }

  const requestRetreat = createRetreatRequest({
    onRequest(actions) {
      if (typeof confirmRetreat === 'function') {
        if (confirmRetreat()) actions.confirm()
        else actions.cancel()
        return
      }
      scene.scene?.pause?.()
      onRetreatRequest?.({
        confirm() {
          actions.confirm()
          scene.scene?.resume?.()
        },
        cancel() {
          actions.cancel()
          scene.scene?.resume?.()
        },
      })
    },
    onConfirm() {
      retreatPromptOpen = false
      retreat()
    },
    onCancel() {
      retreatPromptOpen = false
      retreatPromptDismissed = true
    },
  })

  const updateBackPortal = () => {
    if (!backPortal || backtracked) return
    const available = canRetreatFromFloor(scene)
    if (backPortal.visible !== available) setBackPortalVisible(backPortal, available)
    if (!available || (scene.time?.now ?? 0) < backPortal.unlockAt) return

    const distance = Math.hypot(scene.playerState.x - backPortal.x, scene.playerState.y - backPortal.y)
    if (distance > PORTAL_REARM_RADIUS) retreatPromptDismissed = false
    if (distance > PORTAL_TRIGGER_RADIUS || retreatPromptOpen || retreatPromptDismissed) return

    retreatPromptOpen = true
    requestRetreat()
  }
  scene.events?.on?.('update', updateBackPortal)

  scene.events?.once?.('shutdown', () => {
    removeBackPortal()
    scene.events?.off?.('update', updateBackPortal)
    scene.advanceFloor = originalAdvanceFloor
    scene.__infiniteDungeon.getProgress = originalGetProgress
  })

  const api = { retreat, getVisibleProgress: visibleProgress }
  scene.__dungeonBacktracking = api
  return api
}
