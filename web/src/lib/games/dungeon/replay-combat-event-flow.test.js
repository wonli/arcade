import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const attack = readFileSync(fileURLToPath(new URL('./attack-runtime.js', import.meta.url)), 'utf8')
const skill = readFileSync(fileURLToPath(new URL('./player-skill-runtime.js', import.meta.url)), 'utf8')
const presentation = readFileSync(fileURLToPath(new URL('./presentation-events.js', import.meta.url)), 'utf8')
const surface = readFileSync(fileURLToPath(new URL('./DungeonReplaySurface.svelte', import.meta.url)), 'utf8')

test('live combat captures semantic attacks hits deaths and skills at their real gameplay sources', () => {
  assert.match(attack, /captureDungeonEvent\?\.\(\{[\s\S]*?type:\s*['"]player\.attack['"]/)
  assert.match(attack, /captureDungeonEvent\?\.\(\{[\s\S]*?type:\s*['"]hit['"]/)
  assert.match(attack, /captureDungeonEvent\?\.\(\{[\s\S]*?type:\s*['"]death['"]/)
  assert.match(skill, /captureDungeonEvent\?\.\(\{[\s\S]*?type:\s*['"]player\.skill['"]/)
})

test('real Dungeon scene presentation owns combat event playback', () => {
  for (const type of ['player.attack', 'player.skill', 'hit', 'death']) {
    assert.match(presentation, new RegExp(`type === ['"]${type.replace('.', '\\.') }['"]`))
  }
  assert.match(presentation, /__dungeonVfx\?\.slash/)
  assert.match(presentation, /__dungeonVfx\?\.impact/)
  assert.match(presentation, /feedback\(\)\?\.death/)
})

test('ReplaySurface contains no combat or VFX implementation', () => {
  assert.doesNotMatch(surface, /slash|damageText|deathBurst|critical|hitFeedback|weaponVisuals/)
})