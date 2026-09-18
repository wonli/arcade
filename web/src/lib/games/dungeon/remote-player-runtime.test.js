import test from 'node:test'
import assert from 'node:assert/strict'

import { attachLocalPlayerEntity } from './player-entity.js'
import { despawnRemotePlayer, spawnRemotePlayer, syncRemotePlayerPresentation } from './remote-player-runtime.js'
import { applyPlayerSnapshot } from './player-snapshot.js'

function weapon(type = 'weapon.sword', rarity = 'common') {
  return { type, rarity, damage: 18, affixes: [] }
}

function snapshot(id = 'remote', equippedWeapon = null) {
  return {
    id,
    state: { x: 320, y: 240, hp: 80, maxHp: 100, equipment: { weapon: equippedWeapon }, modifiers: {} },
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
  const weaponVisuals = []
  const listeners = new Map()
  const scene = {
    textures: { exists() { return true } },
    events: {
      on(event, handler) {
        const handlers = listeners.get(event) ?? new Set()
        handlers.add(handler)
        listeners.set(event, handlers)
      },
      off(event, handler) {
        listeners.get(event)?.delete(handler)
      },
      emit(event, ...args) {
        for (const handler of listeners.get(event) ?? []) handler(...args)
      },
    },
    add: {
      image(x, y, key) {
        const visual = {
          x, y, key,
          originX: 0.5,
          originY: 0.5,
          scaleX: 1,
          scaleY: 1,
          destroyed: false,
          visible: true,
          setOrigin(originX, originY) { this.originX = originX; this.originY = originY; return this },
          setScale(scaleX, scaleY = scaleX) { this.scaleX = scaleX; this.scaleY = scaleY; return this },
          setPosition(nextX, nextY) { this.x = nextX; this.y = nextY; return this },
          setAngle(angle) { this.angle = angle; return this },
          setFlipX(value) { this.flipX = value; return this },
          setDepth(depth) { this.depth = depth; return this },
          setVisible(value) { this.visible = value; return this },
          destroy() { this.destroyed = true },
        }
        weaponVisuals.push(visual)
        return visual
      },
    },
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
  return { scene, local, actors, bars, syncs, weaponVisuals }
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
  scene.add.sprite = (x, y, key, frame) => {
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

test('remote equipped weapon creates and follows a weapon presentation', () => {
  const { scene, weaponVisuals } = sceneFixture()

  const remote = spawnRemotePlayer(scene, snapshot('remote', weapon()))

  assert.equal(weaponVisuals.length, 1)
  assert.equal(remote.runtime.weaponVisuals?.visual?.(), weaponVisuals[0])
  assert.equal(weaponVisuals[0].destroyed, false)
  assert.notEqual(weaponVisuals[0].x, 320)
})

test('remote weapon reapplies presentation when the scene config arrives after spawn', () => {
  const { scene, weaponVisuals } = sceneFixture()
  const remote = spawnRemotePlayer(scene, snapshot('remote', weapon('weapon.sword', 'common')))
  const visual = weaponVisuals[0]

  scene.__dungeonWeaponPresentation = {
    version: 1,
    defaults: {
      scale: 1,
      grip: { x: 0.5, y: 0.78 },
      poses: {
        idle: {
          left: { x: 73, y: -19, angle: 37 },
        },
      },
    },
    weapons: {
      'weapon.sword': {
        scale: 1.75,
        grip: { x: 0.2, y: 0.35 },
        poses: {
          idle: {
            left: { x: 91, y: -27, angle: 211 },
          },
        },
      },
    },
  }
  scene.events.emit('dungeon-weapon-presentation-ready')

  assert.equal(remote.runtime.weaponVisuals.visual(), visual)
  assert.equal(visual.x, 320 + 91)
  assert.equal(visual.y, 240 - 27)
  assert.equal(visual.angle, 211)
  assert.equal(visual.originX, 0.2)
  assert.equal(visual.originY, 0.35)
  assert.equal(visual.scaleX, 1.75)
  assert.equal(visual.scaleY, 1.75)
})

test('remote weapon change replaces the previous visual using the shared weapon art profile', () => {
  const { scene, weaponVisuals } = sceneFixture()
  const remote = spawnRemotePlayer(scene, snapshot('remote', weapon('weapon.sword', 'common')))
  const first = weaponVisuals[0]

  applyPlayerSnapshot(remote, snapshot('remote', weapon('weapon.sword', 'epic')))
  syncRemotePlayerPresentation(scene, remote)

  assert.equal(first.destroyed, true)
  assert.equal(weaponVisuals.length, 2)
  assert.equal(remote.runtime.weaponVisuals.visual(), weaponVisuals[1])
})

test('remote unequip removes its weapon presentation', () => {
  const { scene, weaponVisuals } = sceneFixture()
  const remote = spawnRemotePlayer(scene, snapshot('remote', weapon()))
  const first = weaponVisuals[0]

  applyPlayerSnapshot(remote, snapshot('remote', null))
  syncRemotePlayerPresentation(scene, remote)

  assert.equal(first.destroyed, true)
  assert.equal(remote.runtime.weaponVisuals.visual(), null)
})

test('spawning rejects the local player id and duplicate remote ids', () => {
  const { scene } = sceneFixture()

  assert.throws(() => spawnRemotePlayer(scene, snapshot('local')), /local player/i)
  spawnRemotePlayer(scene, snapshot('remote'))
  assert.throws(() => spawnRemotePlayer(scene, snapshot('remote')), /already attached/i)
})

test('despawning a remote restores player runtimes and destroys presentation', () => {
  const { scene } = sceneFixture()
  const remote = spawnRemotePlayer(scene, snapshot('remote', weapon()))
  const weaponVisual = remote.runtime.weaponVisuals?.visual?.() ?? null
  let restored = 0
  remote.runtime.inventory = { restore() { restored++ } }
  const actor = remote.actor
  const bar = remote.bar

  const removed = despawnRemotePlayer(scene, 'remote')

  assert.equal(removed, remote)
  assert.equal(scene.players.has('remote'), false)
  assert.equal(restored, 1)
  assert.equal(actor.destroyed, true)
  assert.equal(bar.destroyed, true)
  assert.equal(weaponVisual?.destroyed, true)
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
