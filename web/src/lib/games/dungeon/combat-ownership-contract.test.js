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

test('attack runtime keeps only thin Scene compatibility delegates for damage and procs', () => {
  const code = source('attack-runtime.js')

  assert.match(code, /combat\.setDamageResolver\(/)
  assert.match(code, /combat\.setProcOwner\(/)
  assert.match(code, /const damageDelegate = \(\.\.\.args\) => combat\.damageEnemy\(\.\.\.args\)/)
  assert.match(code, /const procDelegate = \(\.\.\.args\) => combat\.applyWeaponProcs\(\.\.\.args\)/)
  assert.match(code, /scene\.damageEnemy = damageDelegate/)
  assert.match(code, /scene\.applyWeaponProcs = procDelegate/)
  assert.doesNotMatch(code, /scene\.damageEnemy = function/)
  assert.doesNotMatch(code, /scene\.applyWeaponProcs = function/)
})

test('attack compatibility bridge preserves weapon damage projection without replacing damageEnemy', () => {
  const code = source('attack-runtime.js')

  assert.match(code, /attacker\.state\.damage = combat\.weaponDamageStat\(attacker, previousDamage\)/)
  assert.match(code, /combat\.beginWeaponAttack\(target, attacker\)/)
  assert.match(code, /finally \{\s*attacker\.state\.damage = previousDamage\s*\}/)
})
