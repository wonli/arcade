function cloneWeapon(weapon) {
  if (!weapon) return null
  return { ...weapon, affixes: [...(weapon.affixes ?? [])] }
}

function legacyWeapon(state = {}) {
  if (!state.weapon) return null
  return {
    type: state.weapon,
    archetype: state.weaponArchetype,
    rarity: state.weaponRarity ?? null,
    damage: state.weaponDamage ?? 0,
    affixes: [...(state.weaponAffixes ?? [])],
  }
}

export function currentWeapon(state = {}) {
  return state.equipment?.weapon ?? state.equippedWeapon ?? legacyWeapon(state)
}

export function composeModifiers(modifiers = {}) {
  const result = {}
  for (const layer of Object.values(modifiers)) {
    if (!layer || typeof layer !== 'object') continue
    for (const [key, value] of Object.entries(layer)) {
      if (typeof value === 'number') result[key] = (result[key] ?? 0) + value
      else if (value != null) result[key] = value
    }
  }
  return result
}

export function currentEffects(state = {}) {
  if (state.modifiers && typeof state.modifiers === 'object') return composeModifiers(state.modifiers)
  return { ...(state.effects ?? {}) }
}

export function setModifierLayer(current = {}, layer, values = {}) {
  if (!layer || typeof layer !== 'string') throw new TypeError('Modifier layer is required')
  const modifiers = {
    ...(current.modifiers ?? {}),
    [layer]: { ...values },
  }
  return {
    ...current,
    modifiers,
    effects: composeModifiers(modifiers),
  }
}

export function clearModifierLayer(current = {}, layer) {
  if (!layer || typeof layer !== 'string') throw new TypeError('Modifier layer is required')
  const modifiers = { ...(current.modifiers ?? {}) }
  delete modifiers[layer]
  return {
    ...current,
    modifiers,
    effects: composeModifiers(modifiers),
  }
}

export function applyEquipmentState(current = {}, weapon = null, equipmentEffects = {}) {
  const canonicalWeapon = cloneWeapon(weapon)
  const withModifiers = setModifierLayer(current, 'equipment', equipmentEffects)
  const equipment = {
    ...(withModifiers.equipment ?? {}),
    weapon: canonicalWeapon,
  }

  return {
    ...withModifiers,
    equipment,
    equippedWeapon: cloneWeapon(canonicalWeapon),
    weapon: canonicalWeapon?.type ?? null,
    weaponRarity: canonicalWeapon?.rarity ?? null,
    weaponDamage: canonicalWeapon?.damage ?? 0,
    weaponAffixes: canonicalWeapon ? [...(canonicalWeapon.affixes ?? [])] : [],
  }
}
