import test from 'node:test'
import assert from 'node:assert/strict'
import { createPerfMonitor, installDungeonPerf, perfEnabledFromSearch } from './perf-runtime.js'

test('perfEnabledFromSearch only enables perf=1', () => {
  assert.equal(perfEnabledFromSearch('?perf=1'), true)
  assert.equal(perfEnabledFromSearch('?foo=1&perf=1'), true)
  assert.equal(perfEnabledFromSearch('?perf=0'), false)
  assert.equal(perfEnabledFromSearch(''), false)
})

test('perf monitor aggregates frames, sections and long frames', () => {
  let now = 0
  const logs = []
  const monitor = createPerfMonitor({
    now: () => now,
    intervalMs: 100,
    log: (line) => logs.push(line),
  })

  monitor.frame(20)
  monitor.section('enemies', 7)
  monitor.section('enemies', 9)
  monitor.counts({ enemies: 6, projectiles: 2, drops: 1, arena: 80 })
  now = 101
  monitor.frame(40)

  assert.equal(logs.length, 1)
  assert.match(logs[0], /fps=/)
  assert.match(logs[0], /frame p95=/)
  assert.match(logs[0], /enemies=6/)
  assert.match(logs[0], /updateEnemies=8\.00ms/)
  assert.match(logs[0], /long>33=1/)
})

test('installDungeonPerf wraps hot paths and can restore them', () => {
  let clock = 0
  const logs = []
  const scene = {
    enemies: [{ hp: 10 }, { hp: 0 }], enemyProjectiles: [], drops: [], arenaObjects: [1, 2],
    updatePlayer() { clock += 2 },
    updateEnemies() { clock += 5 },
    updateEnemyProjectiles() { clock += 1 },
    updateDrops() { clock += 1 },
    updatePortal() { clock += 1 },
    autoAttack() { clock += 1 },
    trySkill() { clock += 1 },
    drawArena() { clock += 3 },
    startFloor() { clock += 4 },
    update(time, delta) {
      this.updatePlayer()
      this.updateEnemies()
      this.updateEnemyProjectiles()
      this.updateDrops()
      this.updatePortal()
      this.autoAttack()
      this.trySkill()
    },
  }
  const originalUpdate = scene.update
  const api = installDungeonPerf(scene, { enabled: true, now: () => clock, log: (line) => logs.push(line) })
  scene.update(0, 40)
  scene.drawArena()
  api.flush()
  assert.ok(logs.some((line) => /updateEnemies=5\.00ms/.test(line)))
  assert.ok(logs.some((line) => /drawArena=3\.00ms/.test(line)))
  api.destroy()
  assert.equal(scene.update, originalUpdate)
})
