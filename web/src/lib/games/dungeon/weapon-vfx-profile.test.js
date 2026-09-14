import test from 'node:test'
import assert from 'node:assert/strict'
import { weaponVfxProfile } from './weapon-vfx-profile.js'

test('common and uncommon weapons do not run persistent particle emitters', () => {
  assert.equal(weaponVfxProfile({ rarity: 'common', vfxTheme: 'storm' }).particles, null)
  assert.equal(weaponVfxProfile({ rarity: 'uncommon', vfxTheme: 'storm' }).particles, null)
})

test('rare through legendary weapons scale particle intensity by rarity', () => {
  const rare = weaponVfxProfile({ rarity: 'rare', vfxTheme: 'storm' }).particles
  const epic = weaponVfxProfile({ rarity: 'epic', vfxTheme: 'storm' }).particles
  const legendary = weaponVfxProfile({ rarity: 'legendary', vfxTheme: 'storm' }).particles
  assert.equal(rare.source, 'lightning')
  assert.equal(rare.kind, 'lightning')
  assert.equal(rare.fallbackKinds[0], 'sparkle')
  assert.ok(epic.frequency < rare.frequency)
  assert.ok(legendary.quantity > epic.quantity)
  assert.ok(legendary.burst > epic.burst)
})

test('weapon particles use compact target pixel sizes independent from texture resolution', () => {
  assert.equal(weaponVfxProfile({ rarity: 'rare' }).particles.size, 8)
  assert.equal(weaponVfxProfile({ rarity: 'epic' }).particles.size, 10)
  assert.equal(weaponVfxProfile({ rarity: 'legendary' }).particles.size, 12)
})

test('theme selects particle material while rarity keeps the same intensity', () => {
  const ember = weaponVfxProfile({ rarity: 'epic', vfxTheme: 'ember' })
  const arcane = weaponVfxProfile({ rarity: 'epic', vfxTheme: 'arcane' })
  assert.equal(ember.particles.kind, 'flame')
  assert.equal(arcane.particles.kind, 'aura')
  assert.equal(ember.particles.frequency, arcane.particles.frequency)
  assert.notEqual(ember.tint, arcane.tint)
})

test('legacy named weapon state recovers its stable visual identity from the catalog', () => {
  const tempest = weaponVfxProfile({ type: 'weapon.tempest_bow', rarity: 'rare' })
  assert.equal(tempest.theme, 'storm')
  assert.equal(tempest.archetype, 'bow')
  assert.equal(tempest.variant, 1)
  assert.ok(tempest.particles)
})
