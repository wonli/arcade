import test from 'node:test'
import assert from 'node:assert/strict'

import { installCoopPortalRuntime } from './coop-portal-runtime.js'
import { installPickupInteraction } from './pickup-runtime.js'
import { attachLocalPlayerEntity } from './player-entity.js'
import { createDungeonWorldRuntime } from './world-runtime.js'

function displayObject(x = 0, y = 0, type = 'display') {
  return {
    x,
    y,
    type,
    scaleX: 1,
    scaleY: 1,
    destroyed: false,
    setAlpha() { return this },
    setDepth() { return this },
    setOrigin() { return this },
    setPosition(nextX, nextY) { this.x = nextX; this.y = nextY; return this },
    setScale(xScale, yScale = xScale) { this.scaleX = xScale; this.scaleY = yScale; return this },
    setStrokeStyle() { return this },
    setText(value) { this.text = String(value); return this },
    setTint() { return this },
    setVisible(value) { this.visible = value; return this },
    setY(nextY) { this.y = nextY; return this },
    destroy() { this.destroyed = true },
  }
}

function worldScene() {
  const scene = {
    floor: 1,
    kills: 0,
    floorKills: 0,
    floorCleared: false,
    runComplete: false,
    enemies: [],
    drops: [],
    players: new Map(),
    portal: null,
    time: { now: 1000 },
    input: { keyboard: { addKey: () => ({ on() {}, off() {} }) } },
    events: { once() {}, on() {}, off() {} },
    textures: { exists: () => true },
    tweens: { add() {}, killTweensOf() {} },
    add: {
      image(x, y, textureKey) {
        const image = displayObject(x, y, 'image')
        image.textureKey = textureKey
        image.setTexture = function setTexture(key) { this.textureKey = key; return this }
        return image
      },
      circle(x, y) { return displayObject(x, y, 'circle') },
      text(x, y, text) {
        const label = displayObject(x, y, 'text')
        label.text = String(text)
        return label
      },
    },
    emitStats() {},
    pickupBurst() {},
    updateHealthBar() {},
    syncPlayerAnimation() {},
    destroyHealthBar() {},
    createHealthBar() { return {} },
    makeActor(x, y) { return displayObject(x, y, 'actor') },
    spawnEnemy() { return null },
    damageEnemy() { return null },
    spawnDrop(x, y, item) {
      const drop = { x, y, item: structuredClone(item), visual: null, glow: null, label: null, sparkles: [] }
      this.drops.push(drop)
      return drop
    },
    destroyDrop(drop) {
      drop?.visual?.destroy?.()
      drop?.glow?.destroy?.()
      drop?.label?.destroy?.()
    },
    clearDrops() {
      for (const drop of this.drops) this.destroyDrop(drop)
      this.drops = []
    },
    updateDrops() {},
    openPortal() { this.portal = { x: 480, y: 518, unlockAt: 0 } },
    destroyPortal() {
      for (const object of [this.portal?.glow, this.portal?.ring, this.portal?.core]) object?.destroy?.()
      this.portal = null
    },
    advanceFloor() { this.floor++ },
  }
  attachLocalPlayerEntity(scene, {
    id: 'p2',
    state: { x: 100, y: 100, hp: 100, maxHp: 100, equipment: { weapon: null }, modifiers: {} },
  })
  installPickupInteraction(scene)
  return scene
}

test('replicated weapon fact rematerializes an existing semantic drop with no visual', () => {
  const scene = worldScene()
  const runtime = createDungeonWorldRuntime(scene, { runSeed: 'ABC123', isHost: false })
  runtime.start()
  const item = { type: 'weapon.dungeon_blade', archetype: 'dagger', rarity: 'rare', damage: 22, affixes: [] }
  scene.drops = [{ id: 'drop:ABC123:1:0', x: 240, y: 180, item, visual: null, glow: null, label: null, sparkles: [] }]

  runtime.applyFact({
    type: 'drop.spawn',
    runSeed: 'ABC123',
    sequence: 1,
    floor: 1,
    entityId: 'drop:ABC123:1:0',
    x: 240,
    y: 180,
    item,
  })

  assert.equal(scene.drops.length, 1)
  assert.ok(scene.drops[0].visual, 'authoritative drop state must materialize a missing weapon visual')
})

test('replicated portal fact rematerializes missing graphics for an existing semantic portal', () => {
  const scene = worldScene()
  const runtime = createDungeonWorldRuntime(scene, { runSeed: 'ABC123', isHost: false })
  runtime.start()
  scene.portal = {
    id: 'portal:ABC123:1:0',
    x: 480,
    y: 518,
    unlockAt: 0,
    glow: null,
    ring: null,
    core: null,
    countdownLabel: null,
  }

  runtime.applyFact({
    type: 'portal.open',
    runSeed: 'ABC123',
    sequence: 1,
    floor: 1,
    entityId: 'portal:ABC123:1:0',
    x: 480,
    y: 518,
  })

  assert.ok(scene.portal?.glow, 'portal glow must be rebuilt from canonical state')
  assert.ok(scene.portal?.ring, 'portal ring must be rebuilt from canonical state')
  assert.ok(scene.portal?.core, 'portal core must be rebuilt from canonical state')
})

function coopScene() {
  const p1 = { id: 'p1', dead: false, state: { x: 100, y: 100, hp: 100, maxHp: 100 } }
  const p2 = { id: 'p2', dead: false, state: { x: 104, y: 100, hp: 100, maxHp: 100 } }
  const scene = {
    players: new Map([['p1', p1], ['p2', p2]]),
    portal: { id: 'portal:ABC123:1:0', x: 100, y: 100, unlockAt: 0 },
    runComplete: false,
    add: { text(x, y, text) { const label = displayObject(x, y, 'text'); label.text = String(text); return label } },
    openPortal() {},
    updatePortal() {},
    advanceFloor() {},
    events: { once() {} },
  }
  return { scene, p1, p2 }
}

test('authority publishes portal participants and renders countdown above both player heads', () => {
  const { scene, p1, p2 } = coopScene()
  const facts = []
  installCoopPortalRuntime(scene, {
    localPlayer: p1,
    isAuthority: () => true,
    publishFact(fact) { facts.push(fact) },
  })

  scene.updatePortal(1000)

  assert.deepEqual(facts.at(-1)?.playerIds, ['p1', 'p2'])
  assert.equal(p1.portalCountdownLabel?.text, '3')
  assert.equal(p1.portalCountdownLabel?.x, p1.state.x)
  assert.equal(p1.portalCountdownLabel?.y, p1.state.y - 58)
  assert.equal(p2.portalCountdownLabel?.text, '3')
  assert.equal(p2.portalCountdownLabel?.x, p2.state.x)
  assert.equal(p2.portalCountdownLabel?.y, p2.state.y - 58)

  p2.state.x = 200
  scene.updatePortal(1100)
  assert.equal(p1.portalCountdownLabel ?? null, null)
  assert.equal(p2.portalCountdownLabel ?? null, null)
})

test('follower renders authoritative portal countdown above the named participants', () => {
  const { scene, p1, p2 } = coopScene()
  const runtime = installCoopPortalRuntime(scene, {
    localPlayer: p2,
    isAuthority: () => false,
  })

  runtime.applyFact({
    type: 'portal.dwell',
    entityId: 'portal:ABC123:1:0',
    active: true,
    seconds: 2,
    playerIds: ['p1', 'p2'],
  })

  assert.equal(p1.portalCountdownLabel?.text, '2')
  assert.equal(p2.portalCountdownLabel?.text, '2')
  assert.equal(scene.portal.countdownLabel ?? null, null)
})
