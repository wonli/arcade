import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { installDungeonPresentationEvents } from './presentation-events.js'

function visual() {
  return {
    tint: null,
    setTintFill(value) { this.tint = value; return this },
    setTint(value) { this.tint = value; return this },
    clearTint() { this.tint = null },
  }
}

function fixture() {
  const calls = []
  const player = { id: 'p1', state: { x: 100, y: 120, hp: 77 }, facing: 'right', actor: visual() }
  const enemy = { id: 'e1', x: 300, y: 200, hp: 30, visual: visual() }
  const scene = {
    localPlayer: player,
    players: new Map([['p1', player]]),
    enemies: [enemy],
    add: {
      arc() { return { setAngle() { return this }, setDepth() { return this }, destroy() {} } },
      circle() { return { setStrokeStyle() { return this }, destroy() {} } },
    },
    tweens: { add(value) { calls.push(['tween', value.duration]); return value } },
    time: { delayedCall(_delay, fn) { fn() } },
    cameras: { main: { shake(...args) { calls.push(['shake', ...args]) }, flash(...args) { calls.push(['flash', ...args]) } } },
    syncPlayerAnimation(action, target) { calls.push(['animation', action, target.id]) },
    damageText(x, y, damage, critical) { calls.push(['damage', x, y, damage, critical]) },
    deathBurst(x, y, color) { calls.push(['death', x, y, color]) },
    pickupBurst(x, y, item, healed) { calls.push(['pickup', x, y, item.type, healed]) },
    flashPlayer(target) { calls.push(['flash-player', target.id]) },
    showBanner(label) { calls.push(['banner', label]) },
  }
  return { scene, player, enemy, calls }
}

test('presentation events never mutate durable hp or world membership', () => {
  const { scene, player, enemy, calls } = fixture()
  const api = installDungeonPresentationEvents(scene)
  const beforePlayers = [...scene.players.keys()]
  const beforeEnemies = scene.enemies.map((entry) => entry.id)

  assert.equal(api.present({ type: 'hit', targetId: 'p1', x: 100, y: 120, damage: 11, critical: true }), true)
  assert.equal(api.present({ type: 'death', entityId: 'e1', x: 300, y: 200 }), true)
  assert.equal(player.state.hp, 77)
  assert.equal(enemy.hp, 30)
  assert.deepEqual([...scene.players.keys()], beforePlayers)
  assert.deepEqual(scene.enemies.map((entry) => entry.id), beforeEnemies)
  assert.ok(calls.some((entry) => entry[0] === 'damage'))
  assert.ok(calls.some((entry) => entry[0] === 'death'))
})

test('emit presents and forwards exactly one semantic event', () => {
  const { scene, calls } = fixture()
  const emitted = []
  const api = installDungeonPresentationEvents(scene, { onEvent: (event) => emitted.push(event) })
  const event = { type: 'player.attack', playerId: 'p1', x: 100, y: 120, targetX: 140, targetY: 120, facing: 'right' }
  assert.equal(api.emit(event), true)
  assert.deepEqual(emitted, [event])
  assert.ok(calls.some((entry) => entry[0] === 'animation' && entry[1] === 'attack'))
})

test('scene exposes one presentation entry point for live and replay callers', () => {
  const { scene } = fixture()
  const api = installDungeonPresentationEvents(scene)
  assert.equal(scene.presentEvent, api.present)
  assert.equal(scene.emitDungeonEvent, api.emit)
  assert.equal(scene.presentEvent({ type: 'floor.clear', floor: 2 }), true)
  assert.equal(scene.presentEvent({ type: 'unknown' }), false)
})

test('default player animation selection keeps an active attack ahead of walk or idle', () => {
  const sceneSource = readFileSync(new URL('./scene.js', import.meta.url), 'utf8')
  assert.match(
    sceneSource,
    /forceAction\s*\|\|\s*\(player\.attacking\s*\?\s*['"]attack['"]\s*:\s*player\.moving\s*\?\s*['"]walk['"]\s*:\s*['"]idle['"]\)/,
  )
})
