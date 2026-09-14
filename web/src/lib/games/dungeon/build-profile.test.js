import test from 'node:test'
import assert from 'node:assert/strict'

import { buildHint, classifyBuild } from './build-profile.js'

test('bow volley and staff nova keep distinct build identities in comparison cards', () => {
  const bow = { archetype: 'bow', affixes: [{ id: 'volley', value: 0.26 }, { id: 'piercing', value: 0.4 }] }
  const staff = { archetype: 'staff', affixes: [{ id: 'arcane_nova', value: 0.26 }, { id: 'skill_radius', value: 0.2 }] }

  assert.equal(classifyBuild(bow).id, 'barrage')
  assert.equal(classifyBuild(staff).id, 'arcane-burst')
  assert.equal(buildHint(bow), 'Barrage 2/3')
  assert.equal(buildHint(staff), 'Arcane Burst 2/3')
})
