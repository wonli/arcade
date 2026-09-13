import test from 'node:test'
import assert from 'node:assert/strict'
import { installDungeonWeaponCombat } from './weapon-combat-runtime.js'

function sceneFor(archetype) {
  const calls = []
  const scene = {
    playerState: { x: 0, y: 0, damage: 20, hp: 100, maxHp: 100, effects: {}, equippedWeapon: { archetype } },
    enemies: [], lastAttackAt: 0, events: { once() {} },
    damageEnemy(enemy, damage, critical, knockback, context) { calls.push({ damage, knockback, context }) },
    slash(target) { this.damageEnemy(target, this.playerState.damage, false, 22, { direct: true, source: 'weapon' }) },
    autoAttack() {},
  }
  return { scene, calls }
}

test('direct slash applies archetype damage and knockback then restores player state', () => {
  const dagger = sceneFor('dagger'); installDungeonWeaponCombat(dagger.scene); dagger.scene.slash({ hp: 10 })
  const katana = sceneFor('katana'); installDungeonWeaponCombat(katana.scene); katana.scene.slash({ hp: 10 })
  assert.ok(dagger.calls[0].damage < 20); assert.ok(dagger.calls[0].knockback < 22); assert.ok(katana.calls[0].damage > 20); assert.ok(katana.calls[0].knockback > 22)
  assert.equal(dagger.scene.playerState.damage, 20); assert.equal(katana.scene.playerState.damage, 20)
})

test('auto attack range follows current archetype', () => {
  const dagger = sceneFor('dagger'); dagger.scene.enemies = [{ hp: 10, x: 150, y: 0 }]; installDungeonWeaponCombat(dagger.scene); dagger.scene.autoAttack(1000); assert.equal(dagger.calls.length, 0)
  const katana = sceneFor('katana'); katana.scene.enemies = [{ hp: 10, x: 190, y: 0 }]; installDungeonWeaponCombat(katana.scene); katana.scene.autoAttack(1000); assert.equal(katana.calls.length, 1)
})

test('runtime exposes current auto attack range', () => { const { scene } = sceneFor('katana'); assert.equal(installDungeonWeaponCombat(scene).range(), 196) })
