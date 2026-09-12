import test from 'node:test'
import assert from 'node:assert/strict'

import { adoptLocalPlayerEntity, bindLocalPlayerAliases, createPlayerEntity, createPlayerState, syncPlayerEntityVisual } from './player-entity.js'

function actor(id) {
  return {
    id,
    x: 0,
    y: 0,
    depth: 0,
    flipX: false,
    played: null,
    anims: { currentAnim: null },
    setDepth(value) { this.depth = value; return this },
    setPosition(x, y) { this.x = x; this.y = y; return this },
    setFlipX(value) { this.flipX = value; return this },
    play(key) { this.played = key; this.anims.currentAnim = { key }; return this },
    on() { return this },
    destroy() { this.destroyed = true },
  }
}

function fakeScene() {
  let actorIndex = 0
  return {
    players: new Map(),
    makeActor(x, y, kind) {
      assert.equal(kind, 'player')
      const visual = actor(`actor-${++actorIndex}`)
      visual.setPosition(x, y)
      return visual
    },
    createHealthBar(x, y, width, height, color) { return { x, y, width, height, color } },
    updateHealthBar(bar, x, y, hp, maxHp) { Object.assign(bar, { x, y, hp, maxHp }) },
    anims: { exists: () => true },
  }
}

test('player states own independent mutable equipment and effects', () => {
  const first = createPlayerState({ weaponAffixes: [{ id: 'power', value: 1 }], effects: { attackSpeed: 0.2 } })
  const second = createPlayerState(first)
  second.weaponAffixes[0].value = 9
  second.effects.attackSpeed = 0.8

  assert.equal(first.weaponAffixes[0].value, 1)
  assert.equal(first.effects.attackSpeed, 0.2)
})

test('local compatibility aliases read and write the local entity only', () => {
  const scene = fakeScene()
  const local = createPlayerEntity(scene, { id: 'p1', state: createPlayerState({ x: 100, y: 120 }), local: true })
  const remote = createPlayerEntity(scene, { id: 'p2', state: createPlayerState({ x: 200, y: 220 }) })
  bindLocalPlayerAliases(scene, local)

  scene.playerFacing = 'left'
  scene.playerMoving = true
  scene.playerState = { ...scene.playerState, hp: 77 }

  assert.equal(local.facing, 'left')
  assert.equal(local.moving, true)
  assert.equal(local.state.hp, 77)
  assert.equal(remote.facing, 'down')
  assert.notEqual(remote.state.hp, 77)
  assert.equal(scene.player, local.visual)
  assert.equal(scene.playerBar, local.bar)
})

test('local and remote players use the same actor creation and animation path', () => {
  const scene = fakeScene()
  const local = createPlayerEntity(scene, { id: 'p1', state: createPlayerState({ x: 100, y: 120 }), local: true })
  const remote = createPlayerEntity(scene, { id: 'p2', state: createPlayerState({ x: 200, y: 220 }) })

  remote.facing = 'right'
  remote.moving = true
  syncPlayerEntityVisual(scene, remote)

  assert.equal(scene.players.size, 2)
  assert.match(local.visual.id, /^actor-/)
  assert.match(remote.visual.id, /^actor-/)
  assert.equal(remote.visual.played, 'dungeon-player-side-walk')
  assert.equal(remote.visual.x, 200)
  assert.equal(remote.visual.y, 220)
})

test('co-op adoption rekeys the scene local entity instead of duplicating its actor', () => {
  const scene = fakeScene()
  const original = createPlayerEntity(scene, { id: '__local__', state: createPlayerState({ x: 140, y: 150 }), local: true })
  bindLocalPlayerAliases(scene, original)
  const visual = original.visual

  const adopted = adoptLocalPlayerEntity(scene, 'session-123')

  assert.equal(adopted, original)
  assert.equal(adopted.id, 'session-123')
  assert.equal(adopted.visual, visual)
  assert.equal(scene.players.size, 1)
  assert.equal(scene.players.has('__local__'), false)
  assert.equal(scene.players.get('session-123'), original)
})
