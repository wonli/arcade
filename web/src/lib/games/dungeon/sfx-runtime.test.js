import { attachLegacyTestPlayer } from './test/player-fixture.js'
import test from 'node:test'
import assert from 'node:assert/strict'
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

function sceneFixture() {
  return {
    playerMoving: false,
    playerState: { hp: 50, maxHp: 100 },
    skillReadyAt: 0,
    updatePlayer() {},
    slash() {},
    healPlayer(amount) { this.localPlayer.state.hp = Math.min(this.localPlayer.state.maxHp, this.localPlayer.state.hp + amount) },
    trySkill(fired = false) { if (fired) this.localPlayer.skillReadyAt += 4200 },
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
  const scene = sceneFixture()
  installDungeonSfx(attachLegacyTestPlayer(scene), { windowImpl: { Audio: FakeAudio } })
  scene.localPlayer.moving = true
  scene.updatePlayer()
  const move = FakeAudio.instances.find((audio) => audio.src === DUNGEON_SFX.move)
  assert.equal(move.loop, true)
  assert.equal(move.playCalls, 1)
  scene.updatePlayer()
  assert.equal(move.playCalls, 1)
  scene.localPlayer.moving = false
  scene.updatePlayer()
  assert.equal(move.pauseCalls, 1)
  assert.equal(move.currentTime, 0)
})

test('plays attack heal and skill only when those actions really happen', () => {
  FakeAudio.instances = []
  const scene = sceneFixture()
  installDungeonSfx(attachLegacyTestPlayer(scene), { windowImpl: { Audio: FakeAudio } })
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
