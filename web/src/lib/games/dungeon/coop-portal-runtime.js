import { portalDwellState } from './portal-dwell.js'

const PORTAL_TRIGGER_RADIUS = 38

function livingPlayers(scene) {
  return [...(scene?.players?.values?.() ?? [])]
    .filter((player) => player && !player.dead && Number(player.state?.hp ?? 0) > 0)
}

function destroyCountdown(portal) {
  portal?.countdownLabel?.destroy?.()
  if (portal) portal.countdownLabel = null
}

function renderCountdown(scene, portal, seconds) {
  if (!portal || !seconds) {
    destroyCountdown(portal)
    return
  }
  if (!portal.countdownLabel) {
    portal.countdownLabel = scene.add?.text?.(portal.x, portal.y - 58, String(seconds), {
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: '28px',
      fontStyle: 'bold',
      color: '#70ff9f',
      stroke: '#08090b',
      strokeThickness: 6,
    })?.setOrigin?.(0.5)?.setDepth?.(75) ?? null
  }
  portal.countdownLabel?.setText?.(String(seconds))
  portal.countdownLabel?.setPosition?.(portal.x, portal.y - 58)
}

export function installCoopPortalRuntime(scene, {
  localPlayer,
  isAuthority = () => false,
  publishFact = () => {},
} = {}) {
  if (!scene || !localPlayer) throw new TypeError('Dungeon scene and local player are required')
  if (scene.__dungeonCoopPortal) return scene.__dungeonCoopPortal

  const originalUpdatePortal = typeof scene.updatePortal === 'function' ? scene.updatePortal : null
  let dwell = { enteredAt: null, seconds: null, complete: false }
  let lastPublished = null
  let transitionCommitted = false
  if (scene.portal && scene.portal.countdownLabel == null) scene.portal.countdownLabel = null

  const clear = ({ publish = false } = {}) => {
    const portal = scene.portal
    const wasActive = dwell.enteredAt != null || Boolean(portal?.countdownLabel)
    destroyCountdown(portal)
    dwell = { enteredAt: null, seconds: null, complete: false }
    transitionCommitted = false
    if (publish && wasActive) {
      lastPublished = 'inactive'
      publishFact({
        type: 'portal.dwell',
        entityId: String(portal?.id ?? ''),
        active: false,
        seconds: null,
      })
    }
  }

  const publishDwell = (portal, next) => {
    const key = next.enteredAt == null ? 'inactive' : `${next.seconds}:${Boolean(next.complete)}`
    if (key === lastPublished) return
    lastPublished = key
    publishFact({
      type: 'portal.dwell',
      entityId: String(portal?.id ?? ''),
      active: next.enteredAt != null && !next.complete,
      seconds: next.complete ? null : next.seconds,
      complete: Boolean(next.complete),
    })
  }

  scene.updatePortal = function updateCoopPortal(time) {
    const portal = scene.portal
    if (!portal || scene.runComplete || time < Number(portal.unlockAt ?? 0)) {
      if (portal) clear({ publish: isAuthority() })
      return
    }
    if (!isAuthority()) return

    const allPlayers = [...(scene.players?.values?.() ?? [])]
    const living = livingPlayers(scene)
    const readyParty = allPlayers.length >= 2 && living.length === allPlayers.length
    const allInside = readyParty && living.every((player) => (
      Math.hypot(portal.x - player.state.x, portal.y - player.state.y) <= PORTAL_TRIGGER_RADIUS
    ))
    const wasActive = dwell.enteredAt != null
    const next = portalDwellState(dwell, { inside: allInside, now: Number(time) || 0 })
    dwell = next

    if (!allInside) {
      destroyCountdown(portal)
      if (wasActive) publishDwell(portal, next)
      return
    }

    if (next.complete) {
      destroyCountdown(portal)
      publishDwell(portal, next)
      if (!transitionCommitted) {
        transitionCommitted = true
        scene.advanceFloor?.(localPlayer)
      }
      return
    }

    renderCountdown(scene, portal, next.seconds)
    publishDwell(portal, next)
  }

  const applyFact = (fact) => {
    if (fact?.type !== 'portal.dwell') return null
    const portal = scene.portal
    if (!portal) return null
    const factId = String(fact.entityId ?? '')
    const portalId = String(portal.id ?? '')
    if (factId && portalId && factId !== portalId) return null
    if (!fact.active || !fact.seconds) {
      destroyCountdown(portal)
      return fact
    }
    renderCountdown(scene, portal, Number(fact.seconds))
    return fact
  }

  let api = null
  const restore = () => {
    clear()
    if (scene.updatePortal !== originalUpdatePortal && originalUpdatePortal) scene.updatePortal = originalUpdatePortal
    if (scene.__dungeonCoopPortal === api) scene.__dungeonCoopPortal = null
  }

  api = { applyFact, clear, restore }
  scene.__dungeonCoopPortal = api
  scene.events?.once?.('shutdown', restore)
  scene.events?.once?.('destroy', restore)
  return api
}
