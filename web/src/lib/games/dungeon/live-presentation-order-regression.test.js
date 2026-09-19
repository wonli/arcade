import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

function source(relative) {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')
}

const stack = source('./presentation-stack.js')
const solo = source('../../../routes/dungeon/+page.svelte')
const coop = source('../../../routes/room/[code]/dungeon/+page.svelte')

test('live Dungeon does not preinstall weapon or ground-drop presentation before gameplay runtimes', () => {
  assert.match(stack, /scene\.mode\s*!==\s*['"]replay['"]/) 

  const liveGuard = stack.indexOf("scene.mode !== 'replay'")
  const weapons = stack.indexOf('installDungeonWeaponVisuals(scene')
  const drops = stack.indexOf('installGroundDropPresentationRuntime(scene')
  assert.ok(liveGuard >= 0, 'presentation stack needs an explicit live/replay boundary')
  assert.ok(weapons > liveGuard, 'held-weapon presentation install call must stay behind the replay-only boundary')
  assert.ok(drops > liveGuard, 'ground-drop presentation install call must stay behind the replay-only boundary')
})

test('solo and coop routes keep gameplay runtime order after the replay refactor', () => {
  for (const [name, route] of [['solo', solo], ['coop', coop]]) {
    const pickup = route.indexOf('installPickupInteraction(scene')
    const spatial = route.indexOf('installDungeonSpatial(scene')
    const attack = route.indexOf('installDungeonAttackRuntime(scene')
    assert.ok(pickup >= 0, `${name}: pickup runtime must be installed`)
    assert.ok(spatial > pickup, `${name}: spatial runtime must install after pickup`)
    assert.ok(attack > spatial, `${name}: attack/held-weapon runtime must install after spatial`)
  }
})
