function callable(value) {
  return typeof value === 'function' ? value : null
}

function restoreSlot(slots, name, owner, previous) {
  return () => {
    if (slots[name] === owner) slots[name] = previous
  }
}

export function ensureDungeonCombatRuntime(scene) {
  if (!scene || typeof scene !== 'object') throw new TypeError('Dungeon scene is required')
  if (scene.dungeon?.combat?.__dungeonCombatRuntime === true) return scene.dungeon.combat

  const core = {
    attack: callable(scene.autoAttack)?.bind(scene) ?? null,
    skill: callable(scene.trySkill)?.bind(scene) ?? null,
    damageEnemy: callable(scene.damageEnemy)?.bind(scene) ?? null,
    applyWeaponProcs: callable(scene.applyWeaponProcs)?.bind(scene) ?? null,
  }
  const slots = {
    attackOwner: null,
    skillOwner: null,
    damageResolver: null,
    procOwner: null,
    weaponPolicy: null,
    authority: null,
  }
  let damageDepth = 0
  let deferredDamageEvents = []

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

        const event = applied ? { ...hit, beforeHp, afterHp, result } : null
        if (damageDepth > 1) {
          if (event) deferredDamageEvents.push(event)
        } else {
          if (event) notifyDamageApplied(event)
          const pending = deferredDamageEvents
          deferredDamageEvents = []
          for (const nested of pending) notifyDamageApplied(nested)
        }
        return result
      } finally {
        damageDepth--
        if (damageDepth === 0 && deferredDamageEvents.length) {
          const pending = deferredDamageEvents
          deferredDamageEvents = []
          for (const nested of pending) notifyDamageApplied(nested)
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
