import test from 'node:test'
import assert from 'node:assert/strict'
import { installDungeonWeaponVfx, weaponParticleCandidates } from './weapon-vfx-runtime.js'

function sceneFor(item) {
  const calls = []
  const particles = []
  const catalog = {
    sparkle: [
      { source: 'foozle', frames: 1, width: 512, height: 512 },
      { source: 'kenney-particles', frames: 1, width: 512, height: 512 },
    ],
    flame: [{ source: 'kenney-particles', frames: 1, width: 512, height: 512 }],
    aura: [{ source: 'kenney-particles', frames: 1, width: 512, height: 512 }],
    smoke: [{ source: 'kenney-particles', frames: 1, width: 512, height: 512 }],
  }
  const vfx = new Proxy(
    { catalog },
    { get: (target, kind) => kind in target ? target[kind] : (...args) => calls.push([kind, ...args]) },
  )
  const scene = {
    playerState: {
      x: 20,
      y: 30,
      weapon: item.type,
      weaponRarity: item.rarity,
      equippedWeapon: item,
    },
    __dungeonVfx: vfx,
    textures: { exists: () => true },
    add: {
      particles(x, y, key, config) {
        const emitter = {
          x,
          y,
          key,
          config,
          frequency: config.frequency,
          quantity: config.quantity,
          emitting: config.emitting,
          destroyed: false,
          bursts: [],
          flows: [],
          setDepth() { return this },
          setPosition(nx, ny) { this.x = nx; this.y = ny; return this },
          emitParticleAt(ex, ey, count) { this.bursts.push([count, ex, ey]) },
          flow(frequency, quantity) {
            this.frequency = frequency
            this.quantity = quantity
            this.emitting = true
            this.flows.push([frequency, quantity])
          },
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

test('same-theme weapon variants choose different stable particle candidates', () => {
  const catalog = {
    sparkle: [
      { source: 'kenney-particles', frames: 1 },
      { source: 'spell-effects', frames: 1 },
    ],
    aura: [{ source: 'foozle', frames: 1 }],
  }
  const base = { kind: 'sparkle', sources: ['kenney-particles', 'spell-effects'], fallbackKinds: ['aura'] }
  const first = weaponParticleCandidates(catalog, { ...base, variant: 0 })[0]
  const second = weaponParticleCandidates(catalog, { ...base, variant: 1 })[0]
  assert.notDeepEqual([first.kind, first.index], [second.kind, second.index])
})

test('particle selection falls back to a static loaded candidate', () => {
  const catalog = {
    flame: [{ source: 'foozle', frames: 8 }],
    sparkle: [{ source: 'kenney-particles', frames: 1 }],
  }
  const candidates = weaponParticleCandidates(catalog, {
    kind: 'flame',
    sources: ['foozle'],
    fallbackKinds: ['sparkle'],
    variant: 0,
  })
  assert.deepEqual([candidates[0].kind, candidates[0].index], ['sparkle', 0])
})

test('rare storm weapon normalizes a 512px source texture to an 8px particle', () => {
  const { scene, particles } = sceneFor({ type: 'weapon.test', rarity: 'rare', vfxTheme: 'storm' })
  const runtime = installDungeonWeaponVfx(scene, { anchor: () => ({ x: 8, y: 9 }) })
  assert.equal(particles.length, 1)
  assert.equal(particles[0].key, 'dungeon-vfx-sparkle-1')
  assert.equal(particles[0].config.scale.start, 8 / 512)
  assert.equal(particles[0].config.blendMode, 'ADD')
  assert.equal(particles[0].config.emitting, true)
  runtime.restore()
  assert.equal(particles[0].destroyed, true)
})

test('legendary weapon normalizes a 512px source texture to a 16px particle', () => {
  const { scene, particles } = sceneFor({ type: 'weapon.crimson_verdict', rarity: 'legendary' })
  installDungeonWeaponVfx(scene, { anchor: () => ({ x: 8, y: 9 }) })
  assert.equal(particles.length, 1)
  assert.equal(particles[0].config.scale.start, 16 / 512)
})

test('legendary attack bursts particles without stopping the persistent flow', () => {
  const { scene, calls, particles } = sceneFor({ type: 'weapon.test', rarity: 'legendary', vfxTheme: 'storm' })
  const runtime = installDungeonWeaponVfx(scene, { anchor: () => ({ x: 10, y: 11 }) })
  const frequency = particles[0].frequency
  runtime.attack({ x: 40, y: 50 })
  assert.deepEqual(particles[0].bursts[0], [12, 10, 11])
  assert.equal(particles[0].frequency, frequency)
  assert.equal(particles[0].emitting, true)
  assert.equal(calls.at(-1)[0], 'lightning')
})

test('sync restarts a particle flow that was stopped during a floor transition', () => {
  const { scene, particles } = sceneFor({ type: 'weapon.test', rarity: 'epic', vfxTheme: 'storm' })
  const runtime = installDungeonWeaponVfx(scene)
  particles[0].frequency = -1
  particles[0].emitting = false
  runtime.sync()
  assert.deepEqual(particles[0].flows[0], [78, 1])
  assert.equal(particles[0].frequency, 78)
  assert.equal(particles[0].emitting, true)
})

test('common weapon creates no particle emitter', () => {
  const { scene, particles } = sceneFor({ type: 'weapon.test', rarity: 'common', vfxTheme: 'storm' })
  const runtime = installDungeonWeaponVfx(scene)
  runtime.attack({ x: 40, y: 50 })
  assert.equal(particles.length, 0)
})

test('bow volley uses a dedicated release aura and sparkle from existing vfx assets', () => {
  const { scene, calls } = sceneFor({ type: 'weapon.tempest_bow', archetype: 'bow', rarity: 'rare', vfxTheme: 'storm' })
  const runtime = installDungeonWeaponVfx(scene, { anchor: () => ({ x: 10, y: 11 }) })
  runtime.volley([{ x: 40, y: 50 }, { x: 60, y: 45 }])

  assert.ok(calls.some(([kind, x, y]) => kind === 'aura' && x === 10 && y === 11))
  assert.ok(calls.some(([kind, x, y]) => kind === 'sparkle' && x === 10 && y === 11))
})

test('staff arcane nova layers aura, explosion and sparkle at the impact point', () => {
  const { scene, calls } = sceneFor({ type: 'weapon.arcane_spire', archetype: 'staff', rarity: 'rare', vfxTheme: 'arcane' })
  const runtime = installDungeonWeaponVfx(scene)
  runtime.nova(70, 80, { radius: 130 })

  assert.ok(calls.some(([kind, x, y]) => kind === 'aura' && x === 70 && y === 80))
  assert.ok(calls.some(([kind, x, y, options]) => kind === 'impact' && x === 70 && y === 80 && options.explosion === true))
  assert.ok(calls.some(([kind, x, y]) => kind === 'sparkle' && x === 70 && y === 80))
})
