import { portalDwellState } from './portal-dwell.js'
import { ensureDungeonPortalRuntime, installDungeonPortalSceneBridge } from './portal-runtime.js'

const PORTAL_TRIGGER_RADIUS = 38
const COUNTDOWN_OFFSET_Y = 58

const COUNTDOWN_STYLE = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: '28px',
  fontStyle: 'bold',
  color: '#70ff9f',
  stroke: '#08090b',
  strokeThickness: 6,
}

function livingPlayers(scene) {
  return [...(scene?.players?.values?.() ?? [])]
    .filter((player) => player && !player.dead && Number(player.state?.hp ?? 0) > 0)
}

function playerIds(players = []) {
  return [...new Set(players.map((player) => String(player?.id ?? '').trim()).filter(Boolean))].sort()
}

function destroyLegacyPortalCountdown(portal) {
  portal?.countdownLabel?.destroy?.()
  if (portal) portal.countdownLabel = null
}

export function installCoopPortalRuntime(scene, {
  localPlayer,
  isAuthority = () => false,
  publishFact = () => {},
  now = null,
} = {}) {
  if (!scene || !localPlayer) throw new TypeError('Dungeon scene and local player are required')
  if (scene.__dungeonCoopPortal) return scene.__dungeonCoopPortal
  if (now != null && typeof now !== 'function') throw new TypeError('Dungeon portal clock must be a function')

  installDungeonPortalSceneBridge(scene)
  const portalRuntime = ensureDungeonPortalRuntime(scene)
  let restoreUpdateOwner = null
  let dwell = { enteredAt: null, seconds: null, complete: false }
  let lastPublished = null
  let transitionCommitted = false
  let activePortalId = scene.portal?.id == null ? null : String(scene.portal.id)
  let activeCountdown = { playerIds: [], seconds: null }
  const countdownLabels = new Map()
  if (scene.portal && scene.portal.countdownLabel == null) scene.portal.countdownLabel = null

  const dwellClock = (time) => {
    const value = Number(now ? now() : time)
    return Number.isFinite(value) ? value : 0
  }

  const destroyPlayerCountdown = (id) => {
    const entry = countdownLabels.get(String(id))
    entry?.label?.destroy?.()
    if (entry?.player?.portalCountdownLabel === entry?.label) entry.player.portalCountdownLabel = null
    countdownLabels.delete(String(id))
  }

  const clearCountdownPresentation = () => {
    for (const id of [...countdownLabels.keys()]) destroyPlayerCountdown(id)
    destroyLegacyPortalCountdown(scene.portal)
  }

  const renderCountdown = (ids, seconds) => {
    const normalizedIds = [...new Set((ids ?? []).map((id) => String(id ?? '').trim()).filter(Boolean))].sort()
    const activeIds = new Set(seconds ? normalizedIds : [])

    for (const id of [...countdownLabels.keys()]) {
      if (!activeIds.has(id) || !scene.players?.has?.(id)) destroyPlayerCountdown(id)
    }

    if (!seconds) {
      destroyLegacyPortalCountdown(scene.portal)
      return
    }

    for (const id of normalizedIds) {
      const player = scene.players?.get?.(id)
      if (!player?.state) continue
      let entry = countdownLabels.get(id)
      if (!entry?.label) {
        const label = scene.add?.text?.(
          Number(player.state.x) || 0,
          (Number(player.state.y) || 0) - COUNTDOWN_OFFSET_Y,
          String(seconds),
          COUNTDOWN_STYLE,
        )?.setOrigin?.(0.5)?.setDepth?.(75) ?? null
        if (!label) continue
        entry = { player, label }
        countdownLabels.set(id, entry)
        player.portalCountdownLabel = label
      }
      entry.player = player
      player.portalCountdownLabel = entry.label
      entry.label?.setText?.(String(seconds))
      entry.label?.setPosition?.(
        Number(player.state.x) || 0,
        (Number(player.state.y) || 0) - COUNTDOWN_OFFSET_Y,
      )
    }
    destroyLegacyPortalCountdown(scene.portal)
  }

  const setActiveCountdown = (ids = [], seconds = null) => {
    activeCountdown = {
      playerIds: seconds ? [...new Set(ids.map((id) => String(id ?? '').trim()).filter(Boolean))].sort() : [],
      seconds: seconds ? Number(seconds) : null,
    }
    renderCountdown(activeCountdown.playerIds, activeCountdown.seconds)
  }

  const syncCountdownPresentation = () => {
    renderCountdown(activeCountdown.playerIds, activeCountdown.seconds)
  }

  const syncPortalIdentity = (portal) => {
    if (!portal) return
    const nextId = portal.id == null ? null : String(portal.id)
    if (nextId === activePortalId) return
    clearCountdownPresentation()
    activeCountdown = { playerIds: [], seconds: null }
    activePortalId = nextId
    dwell = { enteredAt: null, seconds: null, complete: false }
    lastPublished = null
    transitionCommitted = false
  }

  const clear = ({ publish = false } = {}) => {
    const portal = scene.portal
    const wasActive = dwell.enteredAt != null || activeCountdown.seconds != null || countdownLabels.size > 0 || Boolean(portal?.countdownLabel)
    clearCountdownPresentation()
    activeCountdown = { playerIds: [], seconds: null }
    dwell = { enteredAt: null, seconds: null, complete: false }
    transitionCommitted = false
    if (publish && wasActive) {
      lastPublished = 'inactive'
      publishFact({
        type: 'portal.dwell',
        entityId: String(portal?.id ?? ''),
        active: false,
        seconds: null,
        playerIds: [],
      })
    }
  }

  const publishDwell = (portal, next, participants = []) => {
    const ids = next.enteredAt != null && !next.complete ? playerIds(participants) : []
    const key = next.enteredAt == null ? 'inactive' : `${next.seconds}:${Boolean(next.complete)}:${ids.join(',')}`
    if (key === lastPublished) return
    lastPublished = key
    publishFact({
      type: 'portal.dwell',
      entityId: String(portal?.id ?? ''),
      active: next.enteredAt != null && !next.complete,
      seconds: next.complete ? null : next.seconds,
      complete: Boolean(next.complete),
      playerIds: ids,
    })
  }

  const updateCoopPortal = (time) => {
    const portal = scene.portal
    if (!portal || scene.runComplete || Number(time) < Number(portal.unlockAt ?? 0)) {
      if (portal) clear({ publish: isAuthority() })
      else clearCountdownPresentation()
      return null
    }
    syncPortalIdentity(portal)
    if (!isAuthority()) {
      syncCountdownPresentation()
      return null
    }

    const allPlayers = [...(scene.players?.values?.() ?? [])]
    const living = livingPlayers(scene)
    const readyParty = allPlayers.length >= 2 && living.length === allPlayers.length
    const allInside = readyParty && living.every((player) => (
      Math.hypot(portal.x - player.state.x, portal.y - player.state.y) <= PORTAL_TRIGGER_RADIUS
    ))
    const wasActive = dwell.enteredAt != null
    const next = portalDwellState(dwell, { inside: allInside, now: dwellClock(time) })
    dwell = next

    if (!allInside) {
      setActiveCountdown([], null)
      if (wasActive) publishDwell(portal, next, [])
      return null
    }

    if (next.complete) {
      setActiveCountdown([], null)
      publishDwell(portal, next, living)
      if (!transitionCommitted) {
        transitionCommitted = true
        scene.advanceFloor?.(localPlayer)
      }
      return null
    }

    const participants = playerIds(living)
    setActiveCountdown(participants, next.seconds)
    publishDwell(portal, next, living)
    return next
  }

  restoreUpdateOwner = portalRuntime.setUpdateOwner(updateCoopPortal)

  const applyFact = (fact) => {
    if (fact?.type !== 'portal.dwell') return null
    const portal = scene.portal
    if (!portal) return null
    syncPortalIdentity(portal)
    const factId = String(fact.entityId ?? '')
    const portalId = String(portal.id ?? '')
    if (factId && portalId && factId !== portalId) return null
    if (!fact.active || !fact.seconds) {
      setActiveCountdown([], null)
      return fact
    }
    setActiveCountdown(Array.isArray(fact.playerIds) ? fact.playerIds : [], Number(fact.seconds))
    return fact
  }

  let api = null
  const restore = () => {
    clear()
    restoreUpdateOwner?.()
    restoreUpdateOwner = null
    if (scene.__dungeonCoopPortal === api) scene.__dungeonCoopPortal = null
  }

  api = { applyFact, clear, restore }
  scene.__dungeonCoopPortal = api
  scene.events?.once?.('shutdown', restore)
  scene.events?.once?.('destroy', restore)
  return api
}
