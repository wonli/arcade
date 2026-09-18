import test from 'node:test'
import assert from 'node:assert/strict'
import { installDungeonReplayEventCapture } from './replay-event-capture-runtime.js'

test('capture runtime observes real projectile, pickup and portal behavior without replacing their results', () => {
  const events = []
  let projectileSeq = 0
  const scene = {
    floor: 2,
    kills: 3,
    portal: null,
    enemyProjectiles: [],
    localPlayer: { id: 'p1', dead: false, state: { x: 50, y: 60, hp: 100 } },
    captureDungeonEvent(event) { events.push(event) },
    fireEnemyProjectile(enemy, player) {
      const projectile = { id: `p:${++projectileSeq}`, kind: 'enemy', ownerId: enemy.id, x: enemy.x, y: enemy.y, vx: 10, vy: 20 }
      this.enemyProjectiles.push(projectile)
      return projectile
    },
    hitPlayer(damage, player) { player.state.hp -= damage; return player.state.hp },
    bossCharge() { return 'charge' },
    bossShockwave() { return 'shockwave' },
    updateBoss(enemy) { if (enemy.hp < 50) enemy.phase = 2 },
    spawnDrop(x, y, item) { return { x, y, item } },
    pickupBurst() { return 'pickup' },
    openPortal() { this.portal = { x: 700, y: 300 }; return this.portal },
    advanceFloor() { this.floor += 1 },
    completeRun() { this.runComplete = true },
    gameOver(player) { player.dead = true },
    events: { once() {} },
  }
  installDungeonReplayEventCapture(scene)

  const projectile = scene.fireEnemyProjectile({ id: 'e1', x: 10, y: 20 }, scene.localPlayer)
  assert.equal(projectile.id, 'p:1')
  scene.pickupBurst(30, 40, { type: 'consumable.health_potion' }, 18)
  scene.openPortal()
  scene.advanceFloor(scene.localPlayer)

  assert.deepEqual(events.map((event) => event.type), [
    'projectile.spawn', 'pickup', 'portal.open', 'portal.enter',
  ])
})

test('capture runtime records player damage, death and boss phase transitions after real simulation', () => {
  const events = []
  const player = { id: 'p1', dead: false, state: { x: 50, y: 60, hp: 10 } }
  const scene = {
    floor: 1, kills: 0, portal: null, enemyProjectiles: [], localPlayer: player,
    captureDungeonEvent(event) { events.push(event) },
    fireEnemyProjectile() {},
    hitPlayer(damage, target) { target.state.hp = Math.max(0, target.state.hp - damage); if (target.state.hp <= 0) target.dead = true },
    bossCharge() {}, bossShockwave() {},
    updateBoss(enemy) { if (enemy.hp <= 40) enemy.phase = 2 },
    spawnDrop() {}, pickupBurst() {}, openPortal() {}, advanceFloor() {}, completeRun() {}, gameOver() {},
    events: { once() {} },
  }
  installDungeonReplayEventCapture(scene)

  scene.hitPlayer(12, player)
  const boss = { id: 'boss', x: 300, y: 200, hp: 30, phase: 1 }
  scene.updateBoss(boss, 0, 0, player)

  assert.deepEqual(events.map((event) => event.type), ['hit', 'death', 'enemy.phase'])
  assert.equal(events[0].beforeHp, 10)
  assert.equal(events[0].afterHp, 0)
  assert.equal(events[2].phase, 2)
})
