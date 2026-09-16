function callable(value) {
  return typeof value === 'function' ? value : null
}

function restoreSlot(slots, name, owner, previous) {
  return () => {
    if (slots[name] === owner) slots[name] = previous
  }
}

function normalizeFloor(value) {
  return Math.max(1, Math.floor(Number(value) || 1))
}

function normalizePolicy(policy) {
  if (!policy || typeof policy !== 'object') return null
  const beforeAdvance = callable(policy.beforeAdvance)
  const afterAdvance = callable(policy.afterAdvance)
  if (!beforeAdvance && !afterAdvance) return null
  return { beforeAdvance, afterAdvance }
}

function normalizeAuthority(authority) {
  if (!authority || typeof authority !== 'object') return null
  const mayAdvance = callable(authority.mayAdvance)
  const onAdvanced = callable(authority.onAdvanced)
  if (!mayAdvance && !onAdvanced) return null
  return { mayAdvance, onAdvanced }
}

function canonicalMaterialization(context) {
  return context?.source === 'world-state' || context?.source === 'replicated-fact'
}

export function ensureDungeonFloorRuntime(scene) {
  if (!scene || typeof scene !== 'object') throw new TypeError('Dungeon scene is required')
  if (scene.dungeon?.progression?.__dungeonFloorRuntime === true) return scene.dungeon.progression

  const core = {
    advance: callable(scene.advanceFloor)?.bind(scene) ?? null,
  }
  const slots = {
    advanceOwner: null,
    transitionPolicy: null,
    authority: null,
  }

  const api = {
    __dungeonFloorRuntime: true,

    advance(player = scene.localPlayer, context = {}) {
      const normalizedContext = context && typeof context === 'object' ? context : {}
      const fromFloor = normalizeFloor(scene.floor)
      const authorityEvent = { player, context: normalizedContext, fromFloor }
      if (slots.authority?.mayAdvance && !slots.authority.mayAdvance(authorityEvent)) return null

      const before = slots.transitionPolicy?.beforeAdvance?.(authorityEvent) ?? null
      const handled = Boolean(before?.handled)
      let value
      if (handled) value = before?.value ?? null
      else if (slots.advanceOwner) value = slots.advanceOwner(player, core.advance, normalizedContext)
      else value = core.advance?.(player) ?? null

      if (!handled && normalizeFloor(scene.floor) <= fromFloor && canonicalMaterialization(normalizedContext)) {
        scene.floor = fromFloor + 1
        scene.startFloor?.(false, player)
        value = scene.floor
      }

      const toFloor = normalizeFloor(scene.floor)
      const transition = {
        player,
        context: normalizedContext,
        handled,
        value,
        fromFloor,
        toFloor,
      }
      slots.transitionPolicy?.afterAdvance?.(transition)
      if (toFloor !== fromFloor) slots.authority?.onAdvanced?.(transition)
      return value
    },

    setAdvanceOwner(owner = null) {
      const previous = slots.advanceOwner
      slots.advanceOwner = callable(owner)
      return restoreSlot(slots, 'advanceOwner', slots.advanceOwner, previous)
    },

    setTransitionPolicy(policy = null) {
      const previous = slots.transitionPolicy
      slots.transitionPolicy = normalizePolicy(policy)
      return restoreSlot(slots, 'transitionPolicy', slots.transitionPolicy, previous)
    },

    setAuthority(authority = null) {
      const previous = slots.authority
      slots.authority = normalizeAuthority(authority)
      return restoreSlot(slots, 'authority', slots.authority, previous)
    },
  }

  scene.dungeon ??= {}
  scene.dungeon.progression = api
  return api
}

export function installDungeonFloorSceneBridge(scene) {
  if (!scene || typeof scene !== 'object') throw new TypeError('Dungeon scene is required')
  if (scene.__dungeonFloorSceneBridge) return scene.__dungeonFloorSceneBridge

  const floor = ensureDungeonFloorRuntime(scene)
  const bridge = {
    floor,
    advanceFloor(player = scene.localPlayer) {
      return floor.advance(player)
    },
  }

  scene.advanceFloor = bridge.advanceFloor
  scene.__dungeonFloorSceneBridge = bridge
  return bridge
}

export function dungeonFloor(scene) {
  return scene?.dungeon?.progression?.__dungeonFloorRuntime === true
    ? scene.dungeon.progression
    : null
}
