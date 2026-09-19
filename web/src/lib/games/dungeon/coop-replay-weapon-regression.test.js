import test from 'node:test'
import assert from 'node:assert/strict'

import { attachLocalPlayerEntity } from './player-entity.js'
import { spawnRemotePlayer } from './remote-player-runtime.js'

function emitter() {
  const listeners = new Map()
  return {
    on(event, handler) {
      const handlers = listeners.get(event) ?? new Set()
      handlers.add(handler)
      listeners.set(event, handlers)
      return this
    },
    off(event, handler) {
      listeners.get(event)?.delete(handler)
      return this
    },
    emit(event, ...args) {
      for (const handler of listeners.get(event) ?? []) handler(...args)
      return this
    },
  }
}

function weapon() {
  return { type: 'weapon.sword', rarity: 'common', damage: 18, affixes: [] }
}

function remoteSnapshot() {
  return {
    id: 'guest',
    slot: 1,
    state: {
      x: 320,
      y: 240,
      hp: 100,
      maxHp: 100,
      equipment: { weapon: weapon() },
      modifiers: {},
    },
    facing: 'right',
    moving: false,
    attacking: false,
    dead: false,
  }
}

function sceneFixture() {
  let texturesReady = false
  const weaponVisuals = []
  const scene = {
    textures: { exists() { return texturesReady } },
    events: emitter(),
    load: emitter(),
    add: {
      image(x, y, key) {
        const visual = {
          x, y, key,
          setOrigin() { return this },
          setScale() { return this },
          setPosition(nextX, nextY) { this.x = nextX; this.y = nextY; return this },
          setAngle() { return this },
          setFlipX() { return this },
          setDepth() { return this },
          setVisible() { return this },
          destroy() {},
        }
        weaponVisuals.push(visual)
        return visual
      },
    },
    makeActor(x, y) {
      return {
        x, y,
        setDepth() { return this },
        setPosition(nextX, nextY) { this.x = nextX; this.y = nextY; return this },
        destroy() {},
      }
    },
    createHealthBar() { return { destroy() {} } },
    updateHealthBar() {},
    syncPlayerAnimation() {},
  }
  attachLocalPlayerEntity(scene, {
    id: 'host',
    slot: 0,
    state: { x: 100, y: 100, hp: 100, maxHp: 100 },
  })
  return {
    scene,
    weaponVisuals,
    markTexturesReady() { texturesReady = true },
  }
}

test('co-op replay remote weapon retries after shared weapon textures finish loading', () => {
  const { scene, weaponVisuals, markTexturesReady } = sceneFixture()
  const remote = spawnRemotePlayer(scene, remoteSnapshot())

  assert.equal(remote.runtime.weaponVisuals?.visual?.(), null)
  assert.equal(weaponVisuals.length, 0)

  markTexturesReady()
  scene.load.emit('complete')

  assert.equal(weaponVisuals.length, 1)
  assert.equal(remote.runtime.weaponVisuals?.visual?.(), weaponVisuals[0])
})
