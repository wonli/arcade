import test from 'node:test'
import assert from 'node:assert/strict'
import { createDungeonGame } from './scene.js'
import { installInfiniteDungeon } from './infinite-runtime.js'
import { installDungeonSpatial } from './spatial-runtime.js'
import { circleHitsSolid } from './spatial.js'

function object(x = 0, y = 0) {
  const value = { x, y, scaleX: 1, scaleY: 1, setPosition(x, y) { this.x = x; this.y = y; return this } }
  return new Proxy(value, { get(target, key) { return key in target ? target[key] : () => value.proxy }, })
}
function display(x, y) { const item = object(x, y); item.proxy = item; return item }
function sceneFixture() {
  const Phaser = { Scene: class {}, Game: class { constructor(config) { return new config.scene() } }, Scale: {}, Math: { Clamp: (v, min, max) => Math.max(min, Math.min(max, v)) } }
  const scene = createDungeonGame({ Phaser })
  scene.add = new Proxy({}, { get: () => display })
  scene.player = display()
  scene.time = { now: 0, delayedCall() {} }
  scene.tweens = { add() {} }
  scene.updateHandlers = []
  scene.events = { on(name, callback) { if (name === 'update') scene.updateHandlers.push(callback) }, off() {}, once() {} }
  scene.input = { keyboard: { addKey: () => display() } }
  scene.textures = { exists: () => false }
  scene.makeActor = display
  scene.createHealthBar = () => ({ back: display(), fill: display() })
  scene.updateHealthBar = () => {}
  scene.showBanner = () => {}
  return scene
}

test('spatial installation places initial player and visual at generated spawn without teleporting on texture refresh', () => {
  const scene = sceneFixture()
  const api = installDungeonSpatial(scene, { random: () => 0.31 })
  assert.equal(scene.playerState.x, api.getGeometry().spawn.x)
  assert.equal(scene.playerState.y, api.getGeometry().spawn.y)
  assert.equal(scene.player.x, scene.playerState.x)
  scene.playerState.x += 7
  scene.player.setPosition(scene.playerState.x, scene.playerState.y)
  const before = { x: scene.playerState.x, y: scene.playerState.y }
  api.refreshRoom({ geometry: api.getGeometry() })
  assert.deepEqual({ x: scene.playerState.x, y: scene.playerState.y }, before)
})

test('base and infinite portals use generated exit and subsequent floors use generated spawn', () => {
  const scene = sceneFixture()
  scene.__roomGeometry = { exit: { x: 700, y: 190 } }
  scene.openPortal()
  assert.deepEqual({ x: scene.portal.x, y: scene.portal.y }, scene.__roomGeometry.exit)
  scene.destroyPortal()
  const infinite = installInfiniteDungeon(scene, { random: () => 0.31 })
  const spatial = installDungeonSpatial(scene, { getProgress: infinite.getProgress, random: () => 0.31 })
  scene.openPortal()
  assert.deepEqual({ x: scene.portal.x, y: scene.portal.y }, spatial.getGeometry().exit)
  scene.advanceFloor()
  assert.equal(scene.playerState.x, spatial.getGeometry().spawn.x)
  assert.equal(scene.playerState.y, spatial.getGeometry().spawn.y)
})

test('enemy jitter cannot put an enemy into room solids', () => {
  const scene = sceneFixture()
  scene.__roomGeometry = { width: 960, height: 600, solids: [{ x: 110, y: 50, width: 80, height: 150 }], water: [], spawnPoints: [{ x: 90, y: 100 }] }
  scene.spawnPoints = [[90, 100]]
  const originalRandom = Math.random
  Math.random = () => 0.99
  try {
    const enemy = scene.spawnEnemy(0)
    assert.equal(circleHitsSolid(enemy, 15, scene.__roomGeometry), false)
  } finally { Math.random = originalRandom }
})


test('rest choices become available at the generated reachable rest anchor', () => {
  const scene = sceneFixture()
  const infinite = installInfiniteDungeon(scene, { random: () => 0.31 })
  installDungeonSpatial(scene, { getProgress: infinite.getProgress, random: () => 0.31 })
  const texts = []
  // Replace the generic drawing proxy so text calls can be observed.
  scene.add = { circle: display, text: (x, y, text) => { texts.push({ x, y, text }); return display(x, y) } }
  scene.drawArena = () => { scene.__roomGeometry = { spawn: { x: 180, y: 410 }, exit: { x: 760, y: 170 } } }
  for (let i = 0; i < 10 && infinite.getProgress().roomRole !== 'rest'; i++) scene.advanceFloor()
  assert.equal(infinite.getProgress().roomRole, 'rest')
  for (const callback of scene.updateHandlers.slice(1)) callback()
  assert.ok(texts.some((entry) => entry.text === '1. rest.recover' && entry.x === 180))
})
