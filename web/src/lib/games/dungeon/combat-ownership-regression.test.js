import test from 'node:test'
import assert from 'node:assert/strict'

import { attachLegacyTestPlayer } from './test/player-fixture.js'
import { ensureDungeonCombatRuntime } from './combat-runtime.js'
import { installDungeonWeaponCombat } from './weapon-combat-runtime.js'

function weaponState(archetype = 'katana') {
  return {
    modifiers: {},
    equipment: {
      weapon: {
        type: `weapon.test_${archetype}`,
        archetype,
        rarity: 'common',
        damage: 0,
        affixes: [],
      },
    },
  }
}

function sceneFixture(archetype = 'katana') {
  const calls = []
  const scene = attachLegacyTestPlayer({
    playerState: { x: 0, y: 0, damage: 20, hp: 100, maxHp: 100, ...weaponState(archetype) },
    enemies: [],
    events: { once() {} },
    damageEnemy(enemy, damage, critical, knockback, context, player) {
      calls.push({ enemy, damage, critical, knockback, context, player })
      enemy.hp = Math.max(0, Number(enemy.hp) - Number(damage))
    },
    slash(target, player = this.localPlayer) {
      const combat = this.dungeon?.combat
      const damage = combat?.weaponDamageStat?.(player, player.state.damage) ?? player.state.damage
      combat?.beginWeaponAttack?.(target, player)
      return combat?.damageEnemy?.(
        target,
        damage,
        false,
        22,
        { direct: true, canProc: true, source: 'weapon' },
        player,
      ) ?? this.damageEnemy(target, damage, false, 22, { direct: true, canProc: true, source: 'weapon' }, player)
    },
    autoAttack() {},
    trySkill() {},
    applyWeaponProcs() {},
  })
  ensureDungeonCombatRuntime(scene)
  return { scene, calls }
}

test('weapon combat registers owners without replacing Scene combat methods', () => {
  const { scene } = sceneFixture()
  const originals = {
    slash: scene.slash,
    autoAttack: scene.autoAttack,
    damageEnemy: scene.damageEnemy,
    applyWeaponProcs: scene.applyWeaponProcs,
  }

  installDungeonWeaponCombat(scene)

  assert.equal(scene.slash, originals.slash)
  assert.equal(scene.autoAttack, originals.autoAttack)
  assert.equal(scene.damageEnemy, originals.damageEnemy)
  assert.equal(scene.applyWeaponProcs, originals.applyWeaponProcs)
})

test('combat capability attack preserves weapon damage knockback targeting and per-player VFX', () => {
  const { scene, calls } = sceneFixture('katana')
  const vfx = { attacks: 0, impacts: 0, attack() { this.attacks++ }, impact() { this.impacts++ } }
  scene.localPlayer.runtime.weaponVfx = vfx
  scene.enemies = [
    { id: 'near', hp: 100, x: 190, y: 0 },
  ]

  installDungeonWeaponCombat(scene)
  scene.dungeon.combat.attack(scene.localPlayer, 1000)

  assert.equal(calls.length, 1)
  assert.equal(calls[0].enemy.id, 'near')
  assert.ok(calls[0].damage > 20)
  assert.ok(calls[0].knockback > 22)
  assert.equal(scene.localPlayer.lastAttackAt, 1000)
  assert.equal(vfx.attacks, 1)
  assert.equal(vfx.impacts, 1)
})
