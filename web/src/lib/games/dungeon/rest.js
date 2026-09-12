import { deriveEquipment } from './affixes.js'

const BASIC = new Set(['power', 'attack_speed', 'critical', 'movement_speed', 'vitality', 'life_steal'])

export function restChoices() {
  return ['recover', 'temper', 'fortune']
}

function cloneWeapon(weapon) {
  if (!weapon) return null
  return { ...weapon, affixes: [...(weapon.affixes ?? [])].map((entry) => ({ ...entry })) }
}

function temperWeapon(playerState, random = Math.random) {
  const weapon = cloneWeapon(playerState?.equippedWeapon)
  if (!weapon) return playerState

  const eligible = weapon.affixes
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => BASIC.has(entry.id))

  if (eligible.length) {
    const pick = eligible[Math.min(eligible.length - 1, Math.floor(random() * eligible.length))]
    const amount = pick.entry.id === 'vitality' ? Math.max(2, Math.round((pick.entry.value ?? 0) * 0.18)) : Math.max(0.01, Number(((pick.entry.value ?? 0) * 0.18).toFixed(3)))
    weapon.affixes[pick.index] = { ...pick.entry, value: (pick.entry.value ?? 0) + amount }
  } else {
    weapon.damage = (weapon.damage ?? 0) + 1
  }

  return deriveEquipment(playerState.baseStats ?? { damage: 10, critChance: 0.18, speed: 190, maxHp: 100 }, weapon, playerState)
}

export function applyRestChoice(playerState, choice, random = Math.random) {
  if (choice === 'recover') {
    const maxHp = playerState?.maxHp ?? 100
    return {
      playerState: { ...playerState, hp: Math.min(maxHp, (playerState?.hp ?? maxHp) + maxHp * 0.5) },
      fortunePending: false,
    }
  }

  if (choice === 'temper') {
    return { playerState: temperWeapon(playerState, random), fortunePending: false }
  }

  if (choice === 'fortune') {
    return { playerState: { ...playerState }, fortunePending: true }
  }

  return { playerState: { ...playerState }, fortunePending: false }
}

export function consumeFortune(fortunePending, roomRole) {
  const combatCapable = roomRole === 'combat' || roomRole === 'elite' || roomRole === 'boss'
  if (!fortunePending || !combatCapable) return { active: false, remaining: Boolean(fortunePending) }
  return { active: true, remaining: false }
}
