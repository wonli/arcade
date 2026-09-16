import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function source(name) {
  return readFileSync(new URL(`./${name}`, import.meta.url), 'utf8')
}

test('weapon combat registers capability owners instead of replacing Scene combat methods', () => {
  const code = source('weapon-combat-runtime.js')

  assert.doesNotMatch(code, /scene\.(?:slash|autoAttack|damageEnemy|applyWeaponProcs)\s*=/)
  assert.match(code, /combat\.setAttackOwner\(/)
  assert.match(code, /combat\.setWeaponPolicy\(/)
})

test('world runtime installs combat authority without wrapping Scene damageEnemy', () => {
  const code = source('world-runtime.js')

  assert.doesNotMatch(code, /scene\.damageEnemy\s*=/)
  assert.match(code, /combat\.setAuthority\(/)
  assert.match(code, /onDamageApplied:\s*publishDamageFact/)
})

test('attack runtime registers combat owners while stable Scene delegates live in CombatRuntime', () => {
  const code = source('attack-runtime.js')

  assert.match(code, /installDungeonCombatSceneBridge\(scene\)/)
  assert.match(code, /combat\.setDamageResolver\(/)
  assert.match(code, /combat\.setProcOwner\(/)
  assert.doesNotMatch(code, /scene\.autoAttack\s*=/)
  assert.doesNotMatch(code, /scene\.damageEnemy\s*=/)
  assert.doesNotMatch(code, /scene\.applyWeaponProcs\s*=/)
})

test('attack compatibility bridge preserves weapon damage projection without replacing damageEnemy', () => {
  const code = source('attack-runtime.js')

  assert.match(code, /attacker\.state\.damage = combat\.weaponDamageStat\(attacker, previousDamage\)/)
  assert.match(code, /combat\.beginWeaponAttack\(target, attacker\)/)
  assert.match(code, /finally \{\s*attacker\.state\.damage = previousDamage\s*\}/)
  assert.doesNotMatch(code, /scene\.damageEnemy\s*=/)
})
