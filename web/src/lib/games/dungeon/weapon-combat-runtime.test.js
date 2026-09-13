import test from 'node:test'
import assert from 'node:assert/strict'
import { installDungeonWeaponCombat } from './weapon-combat-runtime.js'

function sceneFor(archetype) {
  const calls = []
  const scene = {
    playerState: { damage: 20, equippedWeapon: { archetype } },
    events: { once() {} },
    damageEnemy(enemy, damage, critical, knockback, context) { calls.push({ damage, knockback, context }) },
    slash(target) { this.damageEnemy(target, this.playerState.damage, false, 22, { direct: true, source: 'weapon' }) },
  }
  return { scene, calls }
}

test('direct slash applies archetype damage and knockback then restores player state', () => {
  const dagger = sceneFor('dagger'); installDungeonWeaponCombat(dagger.scene); dagger.scene.slash({ hp: 10 })
  const katana = sceneFor('katana'); installDungeonWeaponCombat(katana.scene); katana.scene.slash({ hp: 10 })
  assert.ok(dagger.calls[0].damage < 20); assert.ok(dagger.calls[0].knockback < 22)
  assert.ok(katana.calls[0].damage > 20); assert.ok(katana.calls[0].knockback > 22)
  assert.equal(dagger.scene.playerState.damage, 20); assert.equal(katana.scene.playerState.damage, 20)
})

test('runtime exposes current auto attack range', () => {
  const { scene } = sceneFor('katana'); const runtime = installDungeonWeaponCombat(scene); assert.equal(runtime.range(), 196)
})
