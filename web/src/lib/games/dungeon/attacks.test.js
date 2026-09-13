import test from 'node:test'
import assert from 'node:assert/strict'

import { cleaveAttack, facingVector, piercingAttack, targetsInArc, targetsInBeam, targetsInCircle, thunderChain, thrustAttack, whirlwindAttack } from './attacks.js'

const geometry = {
  solids: [{ x: 250, y: 60, width: 40, height: 100 }],
  water: [],
}

test('facing vectors map player direction into world-space attack direction', () => {
  assert.deepEqual(facingVector('right'), { x: 1, y: 0 })
  assert.deepEqual(facingVector('left'), { x: -1, y: 0 })
  assert.deepEqual(facingVector('up'), { x: 0, y: -1 })
  assert.deepEqual(facingVector('down'), { x: 0, y: 1 })
})

test('piercing starts at the player and clips against a wall', () => {
  const player = { x: 100, y: 100 }
  const attack = piercingAttack(player, 'right', 320, 28, geometry)
  assert.deepEqual(attack.start, { x: 100, y: 100 })
  assert.ok(attack.end.x > 225 && attack.end.x < 240)
  assert.equal(attack.end.y, 100)
  assert.equal(attack.blocked, true)
})

test('thrust follows the actual target direction and can hit enemies behind the primary', () => {
  const attack = thrustAttack({ x: 100, y: 100 }, { x: 160, y: 130 }, 220, 26)
  const enemies = [
    { id: 'primary', x: 160, y: 130, hp: 10 },
    { id: 'behind', x: 205, y: 152, hp: 10 },
    { id: 'off', x: 180, y: 190, hp: 10 },
  ]
  assert.ok(attack.direction.x > 0.8)
  assert.ok(attack.direction.y > 0.35)
  assert.deepEqual(targetsInBeam(attack, enemies).map((enemy) => enemy.id), ['primary', 'behind'])
})

test('cleave selects a broad forward arc but not enemies behind the player', () => {
  const attack = cleaveAttack({ x: 100, y: 100 }, { x: 180, y: 100 }, 190, 118)
  const enemies = [
    { id: 'front', x: 170, y: 100, hp: 10 },
    { id: 'upper', x: 155, y: 55, hp: 10 },
    { id: 'lower', x: 155, y: 145, hp: 10 },
    { id: 'behind', x: 40, y: 100, hp: 10 },
  ]
  assert.deepEqual(targetsInArc(attack, enemies).map((enemy) => enemy.id), ['front', 'upper', 'lower'])
})

test('beam selects every living enemy intersecting the player-origin segment', () => {
  const attack = { start: { x: 100, y: 100 }, end: { x: 320, y: 100 }, width: 30 }
  const enemies = [
    { id: 'a', x: 150, y: 106, hp: 10 },
    { id: 'b', x: 250, y: 92, hp: 10 },
    { id: 'off', x: 180, y: 140, hp: 10 },
    { id: 'dead', x: 220, y: 100, hp: 0 },
  ]
  assert.deepEqual(targetsInBeam(attack, enemies).map((enemy) => enemy.id), ['a', 'b'])
})

test('whirlwind is centered on player and resolves a circular target set', () => {
  const attack = whirlwindAttack({ x: 200, y: 220 }, 105)
  assert.deepEqual(attack.center, { x: 200, y: 220 })
  assert.deepEqual(targetsInCircle(attack, [
    { id: 'near', x: 250, y: 220, hp: 10 },
    { id: 'far', x: 330, y: 220, hp: 10 },
  ]).map((enemy) => enemy.id), ['near'])
})

test('thunder chain begins at the player before chaining between enemies', () => {
  const player = { x: 40, y: 40 }
  const primary = { id: 'a', x: 100, y: 40, hp: 10 }
  const enemies = [primary, { id: 'b', x: 150, y: 45, hp: 10 }, { id: 'c', x: 205, y: 45, hp: 10 }]
  const chain = thunderChain(player, primary, enemies, 3, 80)
  assert.equal(chain.length, 3)
  assert.deepEqual(chain[0].from, player)
  assert.equal(chain[0].to.id, 'a')
  assert.equal(chain[1].from.id, 'a')
  assert.equal(chain[1].to.id, 'b')
})
