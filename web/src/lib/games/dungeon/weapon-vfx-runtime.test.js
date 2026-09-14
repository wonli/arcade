import test from 'node:test'
import assert from 'node:assert/strict'
import { installDungeonWeaponVfx } from './weapon-vfx-runtime.js'

function sceneFor(item) {
  const calls = []
  const particles = []
  const catalog = {
    sparkle: [{ source: 'foozle', frames: 1 }, { source: 'kenney-particles', frames: 1 }],
    flame: [{ source: 'kenney-particles', frames: 1 }],
    aura: [{ source: 'kenney-particles', frames: 1 }],
    smoke: [{ source: 'kenney-particles', frames: 1 }],
  }
  const vfx = new Proxy({ catalog }, { get: (target, kind) => kind in target ? target[kind] : (...args) => calls.push([kind, ...args]) })
  const scene = {
    playerState: { x: 20, y: 30, weapon: item.type, weaponRarity: item.rarity, equippedWeapon: item },
    __dungeonVfx: vfx,
    textures: { exists: () => true },
    add: {
      particles(x, y, key, config) {
        const emitter = {
          x, y, key, config, destroyed: false, bursts: [],
          setDepth() { return this },
          setPosition(nx, ny) { this.x = nx; this.y = ny; return this },
          explode(count, ex, ey) { this.bursts.push([count, ex, ey]) },
          destroy() { this.destroyed = true },
        }
        particles.push(emitter)
        return emitter
      },
    },
    events: { on() {}, off() {}, once() {} },
  }
  return { scene, calls, particles }
}

test('rare weapon uses a Kenney texture in a real particle emitter', () => {
  const { scene, particles } = sceneFor({ type: 'weapon.test', rarity: 'rare', vfxTheme: 'storm' })
  const runtime = installDungeonWeaponVfx(scene, { anchor: () => ({ x: 8, y: 9 }) })
  assert.equal(particles.length, 1)
  assert.equal(particles[0].key, 'dungeon-vfx-sparkle-1')
  assert.equal(particles[0].config.blendMode, 'ADD')
  assert.equal(particles[0].config.emitting, true)
  runtime.restore()
  assert.equal(particles[0].destroyed, true)
})

test('legendary attack bursts particles from the weapon tip and keeps attack VFX', () => {
  const { scene, calls, particles } = sceneFor({ type: 'weapon.test', rarity: 'legendary', vfxTheme: 'storm' })
  const runtime = installDungeonWeaponVfx(scene, { anchor: () => ({ x: 10, y: 11 }) })
  runtime.attack({ x: 40, y: 50 })
  assert.deepEqual(particles[0].bursts[0], [8, 10, 11])
  assert.equal(calls.at(-1)[0], 'lightning')
})

test('common weapon creates no particle emitter', () => {
  const { scene, particles } = sceneFor({ type: 'weapon.test', rarity: 'common', vfxTheme: 'storm' })
  const runtime = installDungeonWeaponVfx(scene)
  runtime.attack({ x: 40, y: 50 })
  assert.equal(particles.length, 0)
})
