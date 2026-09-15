import test from 'node:test'
import assert from 'node:assert/strict'

import { attachLocalPlayerEntity } from './player-entity.js'
import { despawnRemotePlayer, spawnRemotePlayer } from './remote-player-runtime.js'

function snapshot(id = 'remote') {
  return {
    id,
    state: { x: 320, y: 240, hp: 80, maxHp: 100, equipment: { weapon: null }, modifiers: {} },
    facing: 'left',
    moving: true,
    attacking: false,
    dead: false,
    lastAttackAt: 500,
    lastContactAt: 300,
    skillCooldowns: { primary: 2000 },
  }
}

function sceneFixture() {
  const actors = []
  const bars = []
  const syncs = []
  const scene = {
    makeActor(x, y, kind) {
      const actor = {
        x,
        y,
        kind,
        depth: 0,
        destroyed: false,
        setDepth(depth) { this.depth = depth; return this },
        setPosition(nextX, nextY) { this.x = nextX; this.y = nextY; return this },
        destroy() { this.destroyed = true },
      }
      actors.push(actor)
      return actor
    },
    createHealthBar(x, y) {
      const bar = { x, y, destroyed: false, destroy() { this.destroyed = true } }
      bars.push(bar)
      return bar
    },
    updateHealthBar(bar, x, y, hp, maxHp) {
      Object.assign(bar, { x, y, hp, maxHp })
    },
    syncPlayerAnimation(action, player) {
      syncs.push({ action, player })
    },
  }
  const local = attachLocalPlayerEntity(scene, {
    id: 'local',
    state: { x: 100, y: 100, hp: 100, maxHp: 100 },
  })
  return { scene, local, actors, bars, syncs }
}

test('spawning a remote player registers an independent entity and presentation', () => {
  const { scene, local, actors, bars, syncs } = sceneFixture()

  const remote = spawnRemotePlayer(scene, snapshot())

  assert.equal(scene.players.get('remote'), remote)
  assert.equal(scene.localPlayer, local)
  assert.equal(remote.state.x, 320)
  assert.equal(remote.facing, 'left')
  assert.equal(remote.actor, actors[0])
  assert.equal(remote.actor.depth, 20)
  assert.equal(remote.bar, bars[0])
  assert.equal(remote.bar.hp, 80)
  assert.equal(remote.bar.maxHp, 100)
  assert.equal(syncs.at(-1).player, remote)
})

test('remote player replaces the fallback light ball with the loaded local sprite visual', () => {
  const { scene, local } = sceneFixture()
  let fallback = null
  let copied = null

  local.actor = {
    texture: { key: 'dungeon-player-down-idle' },
    frame: { name: 3 },
    scaleX: 1.5,
    scaleY: 1.5,
  }
  scene.makeActor = (x, y) => {
    fallback = {
      x,
      y,
      destroyed: false,
      getData(key) { return key === 'usesTexture' ? false : undefined },
      setDepth() { return this },
      destroy() { this.destroyed = true },
    }
    return fallback
  }
  scene.add = {
    sprite(x, y, key, frame) {
      copied = {
        x,
        y,
        key,
        frame,
        depth: 0,
        scaleX: 1,
        scaleY: 1,
        data: {},
        setScale(scaleX, scaleY) { this.scaleX = scaleX; this.scaleY = scaleY; return this },
        setData(keyName, value) { this.data[keyName] = value; return this },
        getData(keyName) { return this.data[keyName] },
        setDepth(depth) { this.depth = depth; return this },
        setPosition(nextX, nextY) { this.x = nextX; this.y = nextY; return this },
        destroy() { this.destroyed = true },
      }
      return copied
    },
  }

  const remote = spawnRemotePlayer(scene, snapshot())

  assert.equal(fallback.destroyed, true)
  assert.equal(remote.actor, copied)
  assert.equal(remote.actor.key, 'dungeon-player-down-idle')
  assert.equal(remote.actor.frame, 3)
  assert.equal(remote.actor.scaleX, 1.5)
  assert.equal(remote.actor.scaleY, 1.5)
  assert.equal(remote.actor.getData('usesTexture'), true)
})

test('spawning rejects the local player id and duplicate remote ids', () => {
  const { scene } = sceneFixture()

  assert.throws(() => spawnRemotePlayer(scene, snapshot('local')), /local player/i)
  spawnRemotePlayer(scene, snapshot('remote'))
  assert.throws(() => spawnRemotePlayer(scene, snapshot('remote')), /already attached/i)
})

test('despawning a remote restores player runtimes and destroys presentation', () => {
  const { scene } = sceneFixture()
  const remote = spawnRemotePlayer(scene, snapshot())
  let restored = 0
  const sharedRuntime = { restore() { restored++ } }
  remote.runtime.weaponVisuals = sharedRuntime
  remote.runtime.weaponProjectiles = sharedRuntime
  remote.runtime.inventory = { restore() { restored++ } }
  const actor = remote.actor
  const bar = remote.bar

  const removed = despawnRemotePlayer(scene, 'remote')

  assert.equal(removed, remote)
  assert.equal(scene.players.has('remote'), false)
  assert.equal(restored, 2)
  assert.equal(actor.destroyed, true)
  assert.equal(bar.destroyed, true)
  assert.equal(remote.actor, null)
  assert.equal(remote.bar, null)
  assert.deepEqual(remote.runtime, {})
})

test('despawning never removes the local player', () => {
  const { scene, local } = sceneFixture()

  assert.equal(despawnRemotePlayer(scene, local), null)
  assert.equal(scene.localPlayer, local)
  assert.equal(scene.players.get('local'), local)
})