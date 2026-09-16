function callable(value) {
  return typeof value === 'function' ? value : null
}

function bound(owner, name) {
  const value = callable(owner?.[name])
  return value ? value.bind(owner) : null
}

function restoreSlot(slots, name, owner, previous) {
  return () => {
    if (slots[name] === owner) slots[name] = previous
  }
}

export function ensureDungeonCombatRuntime(scene) {
  if (!scene || typeof scene !== 'object') throw new TypeError('Dungeon scene is required')
  if (scene.dungeon?.combat?.__dungeonCombatRuntime === true) return scene.dungeon.combat

  const existing = scene.dungeon?.combat && typeof scene.dungeon.combat === 'object'
    ? scene.dungeon.combat
    : null
  const existingDamageOwner = bound(existing, 'damageEnemy')
  const core = {
    attack: callable(scene.autoAttack)?.bind(scene) ?? null,
    skill: callable(scene.trySkill)?.bind(scene) ?? null,
    damageEnemy: callable(scene.damageEnemy)?.bind(scene) ?? null,
    applyWeaponProcs: callable(scene.applyWeaponProcs)?.bind(scene) ?? null,
  }
  const slots = {
    attackOwner: bound(existing, 'attack'),
    skillOwner: bound(existing, 'skill'),
    damageResolver: existingDamageOwner
      ? (hit) => existingDamageOwner(
          hit.enemy,
          hit.damage,
          hit.critical,
          hit.knockback,
          hit.context,
          hit.player,
        )
      : null,
    procOwner: bound(existing, 'applyWeaponProcs'),
    weaponPolicy: existing?.weaponPolicy && typeof existing.weaponPolicy === 'object'
      ? existing.weaponPolicy
      : null,
    authority: existing?.authority && typeof existing.authority === 'object'
      ? existing.authority
      : null,
  }
  let damageDepth = 0
  let deferredDamageEvents = []
  let afterDamageCallbacks = []

  const coreDamage = (hit) => core.damageEnemy?.(
    hit.enemy,
    hit.damage,
    hit.critical,
    hit.knockback,
    hit.context,
    hit.player,
  ) ?? null

  const notifyDamageApplied = (event) => {
    try { slots.authority?.onDamageApplied?.(event) } catch {}
  }

  const flushDeferredDamageEvents = () => {
    const pending = deferredDamageEvents
    deferredDamageEvents = []
    for (const nested of pending) notifyDamageApplied(nested)
  }

  const flushAfterDamage = () => {
    const callbacks = afterDamageCallbacks
    afterDamageCallbacks = []
    for (const callback of callbacks) {
      try { callback() } catch {}
    }
  }

  const api = {
    __dungeonCombatRuntime: true,

    attack(player = scene.localPlayer, time = scene.time?.now ?? 0) {
      if (slots.attackOwner) return slots.attackOwner(player, time)
      return core.attack?.(time, player) ?? null
    },

    skill(player = scene.localPlayer, skillId = 'primary', time = scene.time?.now ?? 0) {
      if (slots.skillOwner) return slots.skillOwner(player, skillId, time)
      if (skillId !== 'primary') return null
      return core.skill?.(time, player) ?? null
    },

    weaponDamageStat(player, value) {
      const base = Number(value) || 0
      return slots.weaponPolicy?.damageStat?.(player, base) ?? base
    },

    beginWeaponAttack(target, player = scene.localPlayer) {
      return slots.weaponPolicy?.onAttack?.(target, player) ?? null
    },

    afterDamage(callback) {
      if (typeof callback !== 'function') return false
      if (damageDepth > 0) afterDamageCallbacks.push(callback)
      else callback()
      return true
    },

    inDamageTransaction() {
      return damageDepth > 0
    },

    damageEnemy(
      enemy,
      damage,
      critical,
      knockback,
      context = { direct: false, canProc: false, source: 'effect' },
      player = scene.localPlayer,
    ) {
      if (!enemy || !player) return null

      let hit = {
        enemy,
        damage,
        critical: Boolean(critical),
        knockback,
        context: context ?? { direct: false, canProc: false, source: 'effect' },
        player,
      }
      if (slots.authority?.mayDamage && slots.authority.mayDamage(hit) === false) return null

      if (hit.context?.source === 'weapon' && slots.weaponPolicy?.prepareHit) {
        hit = slots.weaponPolicy.prepareHit(hit) ?? hit
      }

      const beforeHp = Number(enemy.hp) || 0
      const outermost = damageDepth === 0
      let event = null
      let completed = false
      damageDepth++
      try {
        const result = slots.damageResolver
          ? slots.damageResolver(hit, coreDamage)
          : coreDamage(hit)
        const afterHp = Number(enemy.hp) || 0
        const applied = afterHp < beforeHp

        if (applied && hit.context?.source === 'weapon') {
          try { slots.weaponPolicy?.onImpact?.({ ...hit, beforeHp, afterHp }) } catch {}
        }

        event = applied ? { ...hit, beforeHp, afterHp, result } : null
        if (!outermost && event) deferredDamageEvents.push(event)
        completed = true
        return result
      } finally {
        damageDepth--
        if (!completed) {
          if (outermost) {
            deferredDamageEvents = []
            afterDamageCallbacks = []
          }
        } else if (outermost) {
          if (event) notifyDamageApplied(event)
          flushDeferredDamageEvents()
          flushAfterDamage()
        }
      }
    },

    applyWeaponProcs(primary, damage, critical, player = scene.localPlayer) {
      return (slots.procOwner ?? core.applyWeaponProcs)?.(primary, damage, critical, player) ?? null
    },

    setAttackOwner(owner = null) {
      const previous = slots.attackOwner
      slots.attackOwner = callable(owner)
      return restoreSlot(slots, 'attackOwner', slots.attackOwner, previous)
    },

    setSkillOwner(owner = null) {
      const previous = slots.skillOwner
      slots.skillOwner = callable(owner)
      return restoreSlot(slots, 'skillOwner', slots.skillOwner, previous)
    },

    setDamageResolver(owner = null) {
      const previous = slots.damageResolver
      slots.damageResolver = callable(owner)
      return restoreSlot(slots, 'damageResolver', slots.damageResolver, previous)
    },

    setProcOwner(owner = null) {
      const previous = slots.procOwner
      slots.procOwner = callable(owner)
      return restoreSlot(slots, 'procOwner', slots.procOwner, previous)
    },

    setWeaponPolicy(owner = null) {
      const previous = slots.weaponPolicy
      slots.weaponPolicy = owner && typeof owner === 'object' ? owner : null
      return restoreSlot(slots, 'weaponPolicy', slots.weaponPolicy, previous)
    },

    setAuthority(owner = null) {
      const previous = slots.authority
      slots.authority = owner && typeof owner === 'object' ? owner : null
      return restoreSlot(slots, 'authority', slots.authority, previous)
    },
  }

  scene.dungeon ??= {}
  scene.dungeon.combat = api
  return api
}

export function installDungeonCombatSceneBridge(scene) {
  if (!scene || typeof scene !== 'object') throw new TypeError('Dungeon scene is required')
  if (scene.__dungeonCombatSceneBridge) return scene.__dungeonCombatSceneBridge

  const combat = ensureDungeonCombatRuntime(scene)
  const bridge = {
    combat,
    autoAttack(time, player = scene.localPlayer) {
      return combat.attack(player, time)
    },
    damageEnemy(...args) {
      return combat.damageEnemy(...args)
    },
    applyWeaponProcs(...args) {
      return combat.applyWeaponProcs(...args)
    },
  }

  scene.autoAttack = bridge.autoAttack
  scene.damageEnemy = bridge.damageEnemy
  scene.applyWeaponProcs = bridge.applyWeaponProcs
  scene.__dungeonCombatSceneBridge = bridge
  return bridge
}

export function dungeonCombat(scene) {
  return scene?.dungeon?.combat?.__dungeonCombatRuntime === true
    ? scene.dungeon.combat
    : null
}

export function damageDungeonEnemy(scene, ...args) {
  const combat = dungeonCombat(scene)
  if (combat) return combat.damageEnemy(...args)
  return scene?.damageEnemy?.(...args) ?? null
}
