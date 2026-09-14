import test from 'node:test'
import assert from 'node:assert/strict'
import { generateDungeonGeometry } from './map-generator.js'

test('ordinary generated rooms never place Statue_fire as a map obstacle', () => {
  for (let seed = 1; seed <= 40; seed++) {
    for (let floor = 1; floor <= 3; floor++) {
      const g = generateDungeonGeometry({ runSeed: seed, floor })
      const statues = g.decorations.filter((entry) => entry.kind === 'statue')
      assert.equal(statues.length, 0, `seed ${seed}/${floor}: Statue_fire leaked into an ordinary room`)
    }
  }
})
