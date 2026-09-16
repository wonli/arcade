import test from 'node:test'
import assert from 'node:assert/strict'

import { installTransientVfxRuntime } from './transient-vfx-runtime.js'

function fixture() {
  const listeners = new Map()
  const documentRef = {
    hidden: false,
    addEventListener(name, handler) { listeners.set(name, handler) },
    removeEventListener(name, handler) { if (listeners.get(name) === handler) listeners.delete(name) },
    emit(name) { listeners.get(name)?.() },
  }
  const killed = []
  const scene = {
    tweens: {
      killTweensOf(target) { killed.push(target) },
      add(config) { return { config } },
    },
  }
  return { scene, documentRef, killed, listeners }
}

function visual(id) {
  return {
    id,
    destroyed: 0,
    destroy() { this.destroyed++ },
  }
}

test('hiding the document clears every tracked transient visual exactly once', () => {
  const { scene, documentRef, killed } = fixture()
  const runtime = installTransientVfxRuntime(scene, { documentRef })
  const death = runtime.track(visual('death'))
  const heal = runtime.track(visual('heal'))

  documentRef.hidden = true
  documentRef.emit('visibilitychange')
  documentRef.emit('visibilitychange')

  assert.equal(death.destroyed, 1)
  assert.equal(heal.destroyed, 1)
  assert.deepEqual(killed, [death, heal])
  assert.equal(runtime.size(), 0)
})

test('returning visible does not replay or recreate cleared effects', () => {
  const { scene, documentRef } = fixture()
  const runtime = installTransientVfxRuntime(scene, { documentRef })
  const effect = runtime.track(visual('damage'))

  documentRef.hidden = true
  documentRef.emit('visibilitychange')
  documentRef.hidden = false
  documentRef.emit('visibilitychange')

  assert.equal(effect.destroyed, 1)
  assert.equal(runtime.size(), 0)
})

test('completed effects are released so later visibility cleanup does not destroy twice', () => {
  const { scene, documentRef } = fixture()
  const runtime = installTransientVfxRuntime(scene, { documentRef })
  const effect = runtime.track(visual('pickup'))
  let completed = 0
  const tween = runtime.tween(effect, { onComplete() { completed++; effect.destroy() } })

  tween.config.onComplete()
  documentRef.hidden = true
  documentRef.emit('visibilitychange')

  assert.equal(completed, 1)
  assert.equal(effect.destroyed, 1)
  assert.equal(runtime.size(), 0)
})

test('restore removes the visibility listener and clears outstanding effects', () => {
  const { scene, documentRef, listeners } = fixture()
  const runtime = installTransientVfxRuntime(scene, { documentRef })
  const effect = runtime.track(visual('burst'))

  runtime.restore()

  assert.equal(effect.destroyed, 1)
  assert.equal(listeners.has('visibilitychange'), false)
})

test('wrapped transient methods capture created display objects and release them on tween completion', () => {
  const { scene, documentRef } = fixture()
  const created = []
  scene.add = {
    text() {
      const object = visual(`label-${created.length}`)
      created.push(object)
      return object
    },
  }
  scene.damageText = function damageText() {
    const label = this.add.text()
    this.tweens.add({ targets: label, duration: 100, onComplete: () => label.destroy() })
    return label
  }

  const runtime = installTransientVfxRuntime(scene, { documentRef })
  runtime.wrapMethods(['damageText'])
  const label = scene.damageText()

  assert.equal(runtime.size(), 1)
  documentRef.hidden = true
  documentRef.emit('visibilitychange')
  assert.equal(label.destroyed, 1)
  assert.equal(runtime.size(), 0)
})

test('visibility cleanup resets stale camera effects and player tint without touching world state', () => {
  const { scene, documentRef } = fixture()
  let cameraResets = 0
  let tintClears = 0
  scene.cameras = { main: { resetFX() { cameraResets++ } } }
  scene.players = new Map([
    ['p1', { actor: { clearTint() { tintClears++ } } }],
    ['p2', { actor: { clearTint() { tintClears++ } } }],
  ])
  installTransientVfxRuntime(scene, { documentRef })

  documentRef.hidden = true
  documentRef.emit('visibilitychange')

  assert.equal(cameraResets, 1)
  assert.equal(tintClears, 2)
})
