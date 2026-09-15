import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('./+page.svelte', import.meta.url), 'utf8')

test('co-op route uses input plus semantic event and correction channels', () => {
  assert.match(source, /dungeon\.input/)
  assert.match(source, /dungeon\.event/)
  assert.match(source, /dungeon\.sync/)
  assert.doesNotMatch(source, /dungeon\.state/)
})

test('host and guest install the same gameplay runtimes with authority flags', () => {
  assert.match(source, /installPickupInteraction\(scene, \{[\s\S]*?authority: role === 'host'/)
  assert.match(source, /installInfiniteDungeon\(scene, \{[\s\S]*?authority: role === 'host'/)
  assert.match(source, /rngFor\(runSeed, 1, 'progression', 'run'\)/)
  assert.doesNotMatch(source, /if \(role === 'host'\) \{\s*scene\.__infiniteDungeon = installInfiniteDungeon/)
})

test('multiplayer keeps the solo runtime order before installing the network adapter', () => {
  const pickup = source.indexOf('\n        pickupRuntime = installPickupInteraction(scene')
  const infinite = source.indexOf('\n        scene.__infiniteDungeon = installInfiniteDungeon(scene')
  const spatial = source.indexOf('\n        installSpatialForRole(scene)')
  const attack = source.indexOf('\n        installDungeonAttackRuntime(scene)')
  const coop = source.indexOf('\n        coopRuntime = installDungeonCoop(scene')
  assert.ok(pickup >= 0 && pickup < infinite)
  assert.ok(infinite < spatial)
  assert.ok(spatial < attack)
  assert.ok(attack < coop)
})

test('guest chest authority is removed without deleting the shared E key', () => {
  assert.doesNotMatch(source, /removeAllListeners\(['"]down['"]\)/)
  assert.match(source, /interactionKey\.off\?\.\('down', listener\)/)
})

test('host survives guest disconnect without destroying the dungeon', () => {
  assert.match(source, /peerDisconnected\?\.\(\)/)
  assert.match(source, /continuing solo/)
})
