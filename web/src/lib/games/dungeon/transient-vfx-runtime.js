function asTargets(value) {
  if (Array.isArray(value)) return value.filter(Boolean)
  return value ? [value] : []
}

function safeDestroy(scene, effect) {
  if (!effect) return
  scene?.tweens?.killTweensOf?.(effect)
  try { effect.destroy?.() } catch {}
}

export function installTransientVfxRuntime(scene, { documentRef = globalThis.document } = {}) {
  if (!scene || typeof scene !== 'object') throw new TypeError('Dungeon scene is required')
  if (scene.__dungeonTransientVfx) return scene.__dungeonTransientVfx

  const effects = new Set()
  const wrappedMethods = new Map()
  let captureDepth = 0

  const release = (effect) => {
    effects.delete(effect)
    return effect
  }

  const track = (effect) => {
    if (effect) effects.add(effect)
    return effect
  }

  const clear = () => {
    const current = [...effects]
    effects.clear()
    for (const effect of current) safeDestroy(scene, effect)
    scene.cameras?.main?.resetFX?.()
    for (const player of scene.players?.values?.() ?? []) player?.actor?.clearTint?.()
    return current.length
  }

  const onVisibilityChange = () => {
    if (documentRef?.hidden === true) clear()
  }

  const capture = (callback) => {
    if (captureDepth > 0) return callback()
    captureDepth++
    const add = scene.add ?? {}
    const tweenManager = scene.tweens
    const originalFactories = new Map()
    const factoryNames = ['text', 'rectangle', 'circle', 'arc', 'image', 'container', 'sprite']
    const originalTweenAdd = typeof tweenManager?.add === 'function' ? tweenManager.add : null

    for (const name of factoryNames) {
      if (typeof add[name] !== 'function') continue
      const original = add[name]
      originalFactories.set(name, original)
      add[name] = function trackedFactory(...args) {
        return track(original.apply(this, args))
      }
    }

    if (originalTweenAdd) {
      tweenManager.add = function trackedTween(config = {}) {
        const targets = asTargets(config.targets)
        for (const target of targets) track(target)
        const originalComplete = config.onComplete
        return originalTweenAdd.call(this, {
          ...config,
          onComplete(...args) {
            for (const target of targets) release(target)
            originalComplete?.(...args)
          },
        })
      }
    }

    try {
      return callback()
    } finally {
      for (const [name, original] of originalFactories) add[name] = original
      if (originalTweenAdd) tweenManager.add = originalTweenAdd
      captureDepth--
    }
  }

  const api = {
    track,
    release,
    tween(effect, config = {}) {
      if (!effect) return scene.tweens?.add?.(config)
      track(effect)
      const originalComplete = config.onComplete
      return scene.tweens?.add?.({
        ...config,
        targets: config.targets ?? effect,
        onComplete(...args) {
          release(effect)
          originalComplete?.(...args)
        },
      })
    },
    wrapMethods(names = []) {
      for (const rawName of names) {
        const name = String(rawName ?? '').trim()
        if (!name || wrappedMethods.has(name) || typeof scene[name] !== 'function') continue
        const original = scene[name]
        const wrapped = function wrappedTransientVfxMethod(...args) {
          return capture(() => original.apply(this, args))
        }
        wrappedMethods.set(name, original)
        scene[name] = wrapped
      }
      return api
    },
    clear,
    size: () => effects.size,
    restore() {
      documentRef?.removeEventListener?.('visibilitychange', onVisibilityChange)
      for (const [name, original] of wrappedMethods) scene[name] = original
      wrappedMethods.clear()
      clear()
      if (scene.__dungeonTransientVfx === api) scene.__dungeonTransientVfx = null
    },
  }

  documentRef?.addEventListener?.('visibilitychange', onVisibilityChange)
  scene.events?.once?.('shutdown', () => api.restore())
  scene.events?.once?.('destroy', () => api.restore())
  scene.__dungeonTransientVfx = api
  return api
}
