import test from 'node:test'
import assert from 'node:assert/strict'
import { installPickupInteraction, prepareDropItem, resolveDropPosition, weaponDamageForFloor } from './pickup-runtime.js'
import { hasRoute } from './pathfinding.js'

const sequence = (values) => { let i = 0; return () => values[i++ % values.length] }

function runtimeScene(playerState = { x: 0, y: 0, hp: 100, maxHp: 100, healthPotions: 0 }) {
  const listeners = new Map()
  return {
    floor: 6,
    playerState,
    drops: [],
    time: { now: 0 },
    input: { keyboard: { addKey: () => ({ on() {}, off() {} }) } },
    events: {
      once() {},
      on(event, fn) { listeners.set(event, fn) },
      off(event, fn) { if (listeners.get(event) === fn) listeners.delete(event) },
    },
    emitStats() {},
    updateHealthBar() {},
    pickupBurst() {},
    destroyDrop(drop) { this.drops = this.drops.filter((entry) => entry !== drop) },
    spawnDrop(x, y, item) {
      this.drops.push({
        x, y, item,
        visual: { scaleX: 1, scaleY: 1, setY() {}, setScale() {}, destroy() { this.destroyed = true } },
        glow: { setAlpha() {} },
      })
    },
    updateDrops() {},
    clearDrops() { this.drops = [] },
    __listeners: listeners,
  }
}

test('weapon damage grows with floor while floor one can still jackpot', () => {
  const low = weaponDamageForFloor('rare', 1, sequence([0.5, 0.9, 0.5]))
  const deep = weaponDamageForFloor('rare', 20, sequence([0.5, 0.9, 0.5]))
  const jackpot = weaponDamageForFloor('rare', 1, sequence([0.9, 0.01, 0.99]))
  assert.ok(deep > low + 30)
  assert.ok(jackpot >= low * 1.5)
})

test('opened chest can turn its weapon reward into a percentage potion', () => {
  const scene = { floor: 8, __dungeonSpatial: { getChests: () => [{ x: 100, y: 100, opened: true }] } }
  const item = { type: 'weapon.dungeon_blade', rarity: 'rare', damage: 8, affixes: [] }
  assert.deepEqual(prepareDropItem(scene, 110, 110, item, sequence([0.05])), { type: 'consumable.health_potion', rarity: 'common', healRatio: 0.30 })
})

test('weapon rewards are floor-scaled even outside chests', () => {
  const scene = { floor: 18, __dungeonSpatial: { getChests: () => [] } }
  const item = { type: 'weapon.dungeon_blade', rarity: 'uncommon', damage: 5, affixes: [] }
  const next = prepareDropItem(scene, 0, 0, item, sequence([0.5, 0.9, 0.5]))
  assert.ok(next.damage > 30)
})

test('drops are moved off blocked terrain to a reachable nearby point', () => {
  const geometry = {
    width: 240,
    height: 180,
    bounds: { x: 0, y: 0, width: 240, height: 180 },
    solids: [{ x: 92, y: 62, width: 56, height: 56, kind: 'prop' }],
    water: [],
    bridges: [],
  }
  const scene = { playerState: { x: 48, y: 90 }, __dungeonSpatial: { getGeometry: () => geometry } }
  const safe = resolveDropPosition(scene, 120, 90)
  assert.notDeepEqual(safe, { x: 120, y: 90 })
  assert.ok(safe.x < 92 || safe.x > 148 || safe.y < 62 || safe.y > 118)
  assert.ok(Math.hypot(safe.x - 120, safe.y - 90) <= 80)
})

test('collision-safe loot on a disconnected island is relocated to the player reachable component', () => {
  const geometry = {
    width: 320,
    height: 192,
    bounds: { x: 0, y: 0, width: 320, height: 192 },
    solids: [{ x: 144, y: 0, width: 32, height: 192, kind: 'wall' }],
    water: [],
    bridges: [],
  }
  const player = { x: 64, y: 96 }
  const scene = { playerState: player, __dungeonSpatial: { getGeometry: () => geometry } }
  const requested = { x: 240, y: 96 }
  assert.equal(hasRoute(geometry, player, requested, { cellSize: 16, actorRadius: 18 }), false)
  const safe = resolveDropPosition(scene, requested.x, requested.y)
  assert.notDeepEqual(safe, requested)
  assert.equal(hasRoute(geometry, player, safe, { cellSize: 16, actorRadius: 18 }), true)
  assert.ok(safe.x < 144)
})

test('auto potion consumes one stored potion at thirty percent health', () => {
  const scene = runtimeScene({ x: 0, y: 0, hp: 30, maxHp: 100, healthPotions: 2 })
  const runtime = installPickupInteraction(scene)
  assert.equal(runtime.autoUseHealthPotion(), true)
  assert.equal(scene.playerState.hp, 60)
  assert.equal(scene.playerState.healthPotions, 1)
  assert.equal(runtime.autoUseHealthPotion(), false)
})

test('ground weapon uses the same rarity and archetype texture as equipped weapon', () => {
  const scene = runtimeScene()
  let oldVisual = null
  const killed = []
  scene.tweens = { killTweensOf(target) { killed.push(target) } }
  scene.spawnDrop = function spawnDrop(x, y, item) {
    oldVisual = { scaleX: 1, scaleY: 1, setY() {}, setScale() {}, destroy() { this.destroyed = true } }
    this.drops.push({ x, y, item, visual: oldVisual, glow: { setAlpha() {} } })
  }
  scene.textures = { exists: (key) => key === 'dungeon-held-weapon-dagger-rare' }
  scene.add = { image(x, y, textureKey) { return { x, y, textureKey, scaleX: 1, scaleY: 1, setDepth() { return this }, setScale(value) { this.scaleX = value; this.scaleY = value; return this }, setY(value) { this.y = value } } } }
  installPickupInteraction(scene)
  scene.spawnDrop(10, 20, { type: 'weapon.dungeon_blade', archetype: 'dagger', rarity: 'rare', damage: 22, affixes: [] })
  assert.equal(scene.drops[0].visual.textureKey, 'dungeon-held-weapon-dagger-rare')
  assert.equal(oldVisual.destroyed, true)
  assert.ok(killed.includes(oldVisual), 'replaced placeholder tween must be killed')
})

test('destroying a drop kills permanent tweens for all of its visuals', () => {
  const scene = runtimeScene()
  const killed = []
  scene.tweens = { killTweensOf(target) { killed.push(target) } }
  installPickupInteraction(scene)
  const visual = {}
  const glow = {}
  const label = {}
  const sparkleA = {}
  const sparkleB = {}
  const drop = { visual, glow, label, sparkles: [sparkleA, sparkleB] }
  scene.destroyDrop(drop)
  assert.deepEqual(killed, [visual, glow, label, sparkleA, sparkleB])
})

test('equipping a selected named weapon never changes texture after its visual is destroyed', () => {
  let onDown = null
  const candidate = { type: 'weapon.iron_fang', archetype: 'dagger', rarity: 'rare', damage: 40, affixes: [] }
  const scene = {
    floor: 6,
    playerState: { x: 0, y: 0, hp: 100, maxHp: 100, baseStats: { damage: 10, critChance: 0.18, speed: 190, maxHp: 100 } },
    drops: [],
    time: { now: 0 },
    input: { keyboard: { addKey: () => ({ on(_event, fn) { onDown = fn }, off() {} }) } },
    events: { once() {}, on() {}, off() {} },
    emitStats() {}, updateHealthBar() {}, pickupBurst() {},
    textures: { exists: () => true },
    add: {
      image(x, y, textureKey) {
        return {
          x, y, textureKey, scaleX: 1, scaleY: 1, destroyed: false,
          setOrigin() { return this }, setDepth() { return this }, setScale(v) { this.scaleX = v; this.scaleY = v; return this }, setY(v) { this.y = v; return this },
          setTexture(key) { if (this.destroyed) throw new TypeError("Cannot read properties of undefined (reading 'sys')"); this.textureKey = key; return this },
          destroy() { this.destroyed = true },
        }
      },
    },
    spawnDrop(x, y, item) {
      this.drops.push({ x, y, item, visual: this.add.image(x, y, 'placeholder'), glow: { setAlpha() {} }, sparkles: [] })
    },
    destroyDrop(drop) { drop.visual?.destroy?.() },
    updateDrops() {
      const drop = this.drops[0]
      if (!drop) return
      this.playerState.weapon = drop.item.type
      this.playerState.weaponRarity = drop.item.rarity
      this.playerState.weaponDamage = drop.item.damage
      this.playerState.weaponAffixes = drop.item.affixes ?? []
      this.playerState.equippedWeapon = drop.item
      this.destroyDrop(drop)
      this.drops.splice(0, 1)
    },
    clearDrops() { this.drops = [] },
  }
  installPickupInteraction(scene)
  scene.spawnDrop(0, 0, candidate)
  scene.updateDrops()
  assert.doesNotThrow(() => onDown())
  assert.equal(scene.playerState.weapon, candidate.type)
})

test('equipping with E leaves the previous weapon on the ground', () => {
  let onDown = null
  const oldWeapon = { type: 'weapon.dungeon_blade', rarity: 'rare', damage: 22, affixes: [{ id: 'power', tier: 1, value: 0.1 }] }
  const candidate = { type: 'weapon.dungeon_blade', rarity: 'epic', damage: 40, affixes: [] }
  const scene = {
    floor: 6,
    playerState: { x: 0, y: 0, weapon: oldWeapon.type, weaponRarity: oldWeapon.rarity, weaponDamage: oldWeapon.damage, weaponAffixes: oldWeapon.affixes, equippedWeapon: oldWeapon },
    drops: [], time: { now: 0 },
    input: { keyboard: { addKey: () => ({ on(_event, fn) { onDown = fn }, off() {} }) } },
    events: { once() {}, on() {}, off() {} }, emitStats() {},
    spawnDrop(x, y, item) { this.drops.push({ x, y, item, visual: { scaleX: 1, scaleY: 1, setY() {}, setScale() {} }, glow: { setAlpha() {} } }) },
    updateDrops() {
      const drop = this.drops[0]
      if (!drop) return
      this.playerState.weapon = drop.item.type
      this.playerState.weaponRarity = drop.item.rarity
      this.playerState.weaponDamage = drop.item.damage
      this.playerState.weaponAffixes = drop.item.affixes ?? []
      this.playerState.equippedWeapon = drop.item
      this.drops.splice(0, 1)
    },
    clearDrops() { this.drops = [] },
  }
  installPickupInteraction(scene, { random: sequence([0.5, 0.9, 0.5]) })
  scene.spawnDrop(0, 0, candidate)
  scene.updateDrops()
  onDown()
  assert.equal(scene.playerState.weaponRarity, 'epic')
  assert.equal(scene.drops.length, 1)
  assert.equal(scene.drops[0].item.rarity, 'rare')
  assert.equal(scene.drops[0].item.damage, 22)
})