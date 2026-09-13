export function initialDungeonStats() {
  return { hp: 100, maxHp: 100, damage: 10, kills: 0, healthPotions: 0, weapon: null, weaponRarity: null, weaponDamage: 0, weaponAffixes: [] }
}

export function initialDungeonProgress() {
  return { floor: 1, chapter: 1, chapterFloor: 1, chapterLength: 4, roomRole: 'combat', fortuneActive: false }
}
