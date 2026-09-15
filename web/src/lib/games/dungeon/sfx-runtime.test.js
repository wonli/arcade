import test from 'node:test'
import assert from 'node:assert/strict'

import { createPlayerEntity } from './player-entity.js'
import { installDungeonSfx, DUNGEON_SFX } from './sfx-runtime.js'

class FakeAudio {
  static instances = []
  constructor(src) {
    this.src = src
    this.loop = false
    this.volume = 1
    this.currentTime = 0
    this.playCalls = 0
    this.pauseCalls = 0
    FakeAudio.instances.push(this)
  }
  play() { this.playCalls++; return Promise.resolve() }
  pause() { this.pauseCalls++ }
}

function playerEntity({ id = 'player', hp = 50, maxHp = 100 } = {}) {
  return createPlayerEntity({ id, state: { hp, maxHp } })
}

function sceneFixture(player) {
  return {
    localPlayer: player,
    updatePlayer() {},
    slash() {},
    healPlayer(amount) { player.state.hp = Math.min(player.state.maxHp, player.state.hp + amount) },
    trySkill(fired = false) { if (fired) player.skillReadyAt += 4200 },
    events: { once() {} },
  }
}

test('maps the four authored wav files to dungeon actions', () => {
  assert.deepEqual(DUNGEON_SFX, {
    move: '/assets/dungeon/sfx/r1.wav',
    attack: '/assets/dungeon/sfx/m1.wav',
    heal: '/assets/dungeon/sfx/m2.wav',
    skill: '/assets/dungeon/sfx/m3.wav',
  })
})

test('plays movement as a loop and stops it when movement ends', () => {
  FakeAudio.instances = []
  const player = playerEntity()
  const scene = sceneFixture(player)
  installDungeonSfx(scene, { player, windowImpl: { Audio: FakeAudio } })
  player.moving = true
  scene.updatePlayer()
  const move = FakeAudio.instances.find((audio) => audio.src === DUNGEON_SFX.move)
  assert.equal(move.loop, true)
  assert.equal(move.playCalls, 1)
  scene.updatePlayer()
  assert.equal(move.playCalls, 1)
  player.moving = false
  scene.updatePlayer()
  assert.equal(move.pauseCalls, 1)
  assert.equal(move.currentTime, 0)
})

test('plays attack heal and skill only when those actions really happen', () => {
  FakeAudio.instances = []
  const player = playerEntity()
  const scene = sceneFixture(player)
  installDungeonSfx(scene, { player, windowImpl: { Audio: FakeAudio } })
  scene.slash({ hp: 10 })
  scene.healPlayer(20)
  scene.healPlayer(0)
  scene.trySkill(false)
  scene.trySkill(true)
  const bySrc = Object.fromEntries(FakeAudio.instances.map((audio) => [audio.src, audio]))
  assert.equal(bySrc[DUNGEON_SFX.attack].playCalls, 1)
  assert.equal(bySrc[DUNGEON_SFX.heal].playCalls, 1)
  assert.equal(bySrc[DUNGEON_SFX.skill].playCalls, 1)
})

test('sfx observes the provided PlayerEntity instead of scene.localPlayer', () => {
  FakeAudio.instances = []
  const local = playerEntity({ id: 'local', hp: 80 })
  const target = playerEntity({ id: 'target', hp: 40 })
  target.moving = true
  const scene = sceneFixture(target)
  scene.localPlayer = local

  installDungeonSfx(scene, { player: target, windowImpl: { Audio: FakeAudio } })
  scene.updatePlayer()
  scene.healPlayer(10)
  scene.trySkill(true)

  const bySrc = Object.fromEntries(FakeAudio.instances.map((audio) => [audio.src, audio]))
  assert.equal(bySrc[DUNGEON_SFX.move].playCalls, 1)
  assert.equal(bySrc[DUNGEON_SFX.heal].playCalls, 1)
  assert.equal(bySrc[DUNGEON_SFX.skill].playCalls, 1)
  assert.equal(target.state.hp, 50)
  assert.equal(target.skillReadyAt, 4200)
  assert.equal(local.state.hp, 80)
  assert.equal(local.skillReadyAt, 0)
})
