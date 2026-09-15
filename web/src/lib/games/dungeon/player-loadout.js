function cloneWeapon(weapon) {
  if (!weapon) return null
  return { ...weapon, affixes: [...(weapon.affixes ?? [])] }
}

export function currentWeapon(state = {}) {
  return state.equipment?.weapon ?? null
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
  return composeModifiers(state.modifiers ?? {})
}

export function setModifierLayer(current = {}, layer, values = {}) {
  if (!layer || typeof layer !== 'string') throw new TypeError('Modifier layer is required')
  const modifiers = {
    ...(current.modifiers ?? {}),
    [layer]: { ...values },
  }
  return { ...current, modifiers }
}

export function clearModifierLayer(current = {}, layer) {
  if (!layer || typeof layer !== 'string') throw new TypeError('Modifier layer is required')
  const modifiers = { ...(current.modifiers ?? {}) }
  delete modifiers[layer]
  return { ...current, modifiers }
}

export function applyEquipmentState(current = {}, weapon = null, equipmentEffects = {}) {
  const canonicalWeapon = cloneWeapon(weapon)
  const withModifiers = setModifierLayer(current, 'equipment', equipmentEffects)
  const equipment = {
    ...(withModifiers.equipment ?? {}),
    weapon: canonicalWeapon,
  }

  const next = { ...withModifiers, equipment }
  for (const key of ['equippedWeapon', 'weapon', 'weaponRarity', 'weaponDamage', 'weaponAffixes', 'effects']) {
    delete next[key]
  }
  return next
}
