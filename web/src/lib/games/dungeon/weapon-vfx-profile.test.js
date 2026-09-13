import test from 'node:test'
import assert from 'node:assert/strict'
import { weaponVfxProfile } from './weapon-vfx-profile.js'

test('rarity controls weapon vfx intensity rather than theme color', () => {
  assert.equal(weaponVfxProfile({ rarity: 'common', vfxTheme: 'storm' }).idle, null)
  assert.equal(weaponVfxProfile({ rarity: 'rare', vfxTheme: 'storm' }).idle.kind, 'sparkle')
  assert.equal(weaponVfxProfile({ rarity: 'epic', vfxTheme: 'storm' }).attack.kind, 'lightning')
  assert.ok(weaponVfxProfile({ rarity: 'legendary', vfxTheme: 'storm' }).impact)
})

test('theme selects effect language while rarity controls cadence', () => {
  const ember = weaponVfxProfile({ rarity: 'epic', vfxTheme: 'ember' })
  const arcane = weaponVfxProfile({ rarity: 'epic', vfxTheme: 'arcane' })
  assert.equal(ember.idle.kind, 'flame')
  assert.equal(arcane.idle.kind, 'aura')
  assert.notEqual(ember.tint, arcane.tint)
  assert.equal(ember.idle.delay, arcane.idle.delay)
})
