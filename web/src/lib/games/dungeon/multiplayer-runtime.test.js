import test from 'node:test'
import assert from 'node:assert/strict'

import { coopPlayerSpawn, installDungeonMultiplayer } from './multiplayer-runtime.js'

function actor(id, x, y) {
  return {
    id,
    x,
    y,
    visible: true,
    anims: { currentAnim: null },
    setDepth() { return this },
    setPosition(nextX, nextY) { this.x = nextX; this.y = nextY; return this },
    setFlipX() { return this },
    play(key) { this.anims.currentAnim = { key }; return this },
    on() { return this },
    destroy() { this.destroyed = true },
  }
}

function fakeScene() {
  const listeners = new Map()
  const localVisual = actor('local', 100, 100)
  const localBar = { id: 'local-bar' }
  return {
    __roomGeometry: { spawn: { x: 100, y: 100 }, width: 960, height: 600 },
    playerState: { x: 100, y: 100, hp: 100, maxHp: 100, speed: 190, weaponAffixes: [], effects: {}, baseStats: { damage: 10, critChance: 0.18, speed: 190, maxHp: 100 } },
    player: localVisual,
    playerBar: localBar,
    playerFacing: 'down',
    playerMoving: false,
    playerAttacking: false,
    makeActor(x, y, kind) { assert.equal(kind, 'player'); return actor('remote', x, y) },
    createHealthBar() { return { id: 'remote-bar' } },
    updateHealthBar() {},
    destroyHealthBar(bar) { bar.destroyed = true },
    anims: { exists: () => true },
    events: {
      on(name, handler) { listeners.set(name, handler) },
      off(name) { listeners.delete(name) },
      once() {},
    },
    listeners,
  }
}

test('coop player spawn is deterministic and gives player two a nearby distinct position', () => {
  const geometry = { spawn: { x: 320, y: 240 } }
  assert.deepEqual(coopPlayerSpawn(geometry, 0), { x: 320, y: 240 })
  assert.deepEqual(coopPlayerSpawn(geometry, 1), { x: 356, y: 240 })
})

test('runtime adopts local actor, creates a real remote actor, and only relays player state', () => {
  const scene = fakeScene()
  const sent = []
  const runtime = installDungeonMultiplayer(scene, {
    localPlayerId: 'p1',
    remotePlayerId: 'p2',
    localIndex: 0,
    sendPlayerState(state) { sent.push(state) },
  })

  assert.equal(scene.players.size, 2)
  assert.equal(scene.players.get('p1').visual, scene.player)
  assert.equal(scene.players.get('p2').visual.id, 'remote')
  assert.equal(scene.players.get('p1').state.x, 100)
  assert.equal(scene.players.get('p2').state.x, 136)

  runtime.receivePlayerState({ id: 'p2', x: 236, y: 160, hp: 90, maxHp: 100, facing: 'right', moving: true, attacking: false })
  runtime.update(50, 16)

  assert.ok(scene.players.get('p2').state.x > 136)
  assert.ok(scene.players.get('p2').state.x < 236)
  assert.equal(scene.players.get('p1').state.x, 100)
  assert.equal(sent.length, 1)
  assert.equal('geometry' in sent[0], false)
  assert.equal('enemies' in sent[0], false)

  runtime.destroy()
  assert.equal(scene.players.has('p2'), false)
})
