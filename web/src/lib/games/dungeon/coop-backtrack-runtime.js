import { portalDwellState } from './portal-dwell.js'

const BACK_PORTAL_TRIGGER_RADIUS = 34
const COUNTDOWN_OFFSET_Y = 58
const COUNTDOWN_STYLE = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: '28px',
  fontStyle: 'bold',
  color: '#67a8ff',
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

export function installCoopBacktrackRuntime(scene, {
  isAuthority = () => false,
  publishFact = () => {},
  onTransition = () => {},
  now = null,
} = {}) {
  const backtrack = scene?.__dungeonBacktracking
  if (!scene || !backtrack?.setUpdateOwner) return null
  if (scene.__dungeonCoopBacktrack) return scene.__dungeonCoopBacktrack
  if (now != null && typeof now !== 'function') throw new TypeError('Dungeon backtrack clock must be a function')

  let dwell = { enteredAt: null, seconds: null, complete: false }
  let activePortalId = null
  let lastPublished = null
  let transitionCommitted = false
  let activeCountdown = { playerIds: [], seconds: null }
  const countdownLabels = new Map()

  const dwellClock = () => {
    const value = Number(now ? now() : scene.time?.now)
    return Number.isFinite(value) ? value : 0
  }

  const destroyPlayerCountdown = (id) => {
    const entry = countdownLabels.get(String(id))
    entry?.label?.destroy?.()
    if (entry?.player?.backtrackCountdownLabel === entry?.label) entry.player.backtrackCountdownLabel = null
    countdownLabels.delete(String(id))
  }

  const clearCountdownPresentation = () => {
    for (const id of [...countdownLabels.keys()]) destroyPlayerCountdown(id)
  }

  const renderCountdown = (ids, seconds) => {
    const normalizedIds = [...new Set((ids ?? []).map((id) => String(id ?? '').trim()).filter(Boolean))].sort()
    const activeIds = new Set(seconds ? normalizedIds : [])
    for (const id of [...countdownLabels.keys()]) {
      if (!activeIds.has(id) || !scene.players?.has?.(id)) destroyPlayerCountdown(id)
    }
    if (!seconds) return

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
        player.backtrackCountdownLabel = label
      }
      entry.player = player
      player.backtrackCountdownLabel = entry.label
      entry.label?.setText?.(String(seconds))
      entry.label?.setPosition?.(
        Number(player.state.x) || 0,
        (Number(player.state.y) || 0) - COUNTDOWN_OFFSET_Y,
      )
    }
  }

  const setActiveCountdown = (ids = [], seconds = null) => {
    activeCountdown = {
      playerIds: seconds ? playerIds(ids.map((id) => ({ id }))) : [],
      seconds: seconds ? Number(seconds) : null,
    }
    renderCountdown(activeCountdown.playerIds, activeCountdown.seconds)
  }

  const syncPortalIdentity = (portal) => {
    const nextId = portal?.id == null ? null : String(portal.id)
    if (nextId === activePortalId) return
    clearCountdownPresentation()
    activeCountdown = { playerIds: [], seconds: null }
    activePortalId = nextId
    dwell = { enteredAt: null, seconds: null, complete: false }
    lastPublished = null
    transitionCommitted = false
  }

  const publishDwell = (portal, next, participants = []) => {
    const ids = next.enteredAt != null && !next.complete ? playerIds(participants) : []
    const key = next.enteredAt == null ? 'inactive' : `${next.seconds}:${Boolean(next.complete)}:${ids.join(',')}`
    if (key === lastPublished) return
    lastPublished = key
    publishFact({
      type: 'backtrack.dwell',
      entityId: String(portal?.id ?? ''),
      active: next.enteredAt != null && !next.complete,
      seconds: next.complete ? null : next.seconds,
      complete: Boolean(next.complete),
      playerIds: ids,
    })
  }

  const clear = ({ publish = false, portal = backtrack.getPortal?.() } = {}) => {
    const wasActive = dwell.enteredAt != null || activeCountdown.seconds != null || countdownLabels.size > 0
    clearCountdownPresentation()
    activeCountdown = { playerIds: [], seconds: null }
    dwell = { enteredAt: null, seconds: null, complete: false }
    transitionCommitted = false
    if (publish && wasActive) {
      lastPublished = 'inactive'
      publishFact({
        type: 'backtrack.dwell',
        entityId: String(portal?.id ?? activePortalId ?? ''),
        active: false,
        seconds: null,
        playerIds: [],
      })
    }
  }

  const update = ({ portal, available, unlocked, retreat }) => {
    if (!portal) {
      clearCountdownPresentation()
      return null
    }
    syncPortalIdentity(portal)

    if (!isAuthority()) {
      renderCountdown(activeCountdown.playerIds, activeCountdown.seconds)
      return null
    }

    const allPlayers = [...(scene.players?.values?.() ?? [])]
    const living = livingPlayers(scene)
    const readyParty = available && unlocked && allPlayers.length >= 2 && living.length === allPlayers.length
    const allInside = readyParty && living.every((player) => (
      Math.hypot(portal.x - player.state.x, portal.y - player.state.y) <= BACK_PORTAL_TRIGGER_RADIUS
    ))
    const wasActive = dwell.enteredAt != null
    const next = portalDwellState(dwell, { inside: allInside, now: dwellClock() })
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
        const changed = retreat?.() === true
        if (changed) {
          const navigation = backtrack.snapshot?.() ?? null
          publishFact({
            type: 'backtrack.transition',
            entityId: String(portal.id ?? ''),
            navigation,
          })
          onTransition(navigation)
        } else transitionCommitted = false
      }
      return null
    }

    setActiveCountdown(playerIds(living), next.seconds)
    publishDwell(portal, next, living)
    return next
  }

  const restoreUpdateOwner = backtrack.setUpdateOwner(update)

  const applyFact = (fact) => {
    if (!fact || typeof fact !== 'object') return null
    if (fact.type === 'backtrack.transition') {
      clear()
      if (!fact.navigation) return null
      backtrack.applyState?.(fact.navigation, { materialize: true })
      return fact.navigation
    }
    if (fact.type !== 'backtrack.dwell') return null
    const portal = backtrack.getPortal?.()
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
    if (scene.__dungeonCoopBacktrack === api) scene.__dungeonCoopBacktrack = null
  }

  api = { applyFact, clear, restore }
  scene.__dungeonCoopBacktrack = api
  scene.events?.once?.('shutdown', restore)
  scene.events?.once?.('destroy', restore)
  return api
}
