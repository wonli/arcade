function killTween(scene, object) {
  if (object) scene?.tweens?.killTweensOf?.(object)
}

function syncPortal(portal) {
  if (!portal) return null
  portal.glow?.setPosition?.(portal.x, portal.y)
  portal.ring?.setPosition?.(portal.x, portal.y)
  portal.core?.setPosition?.(portal.x, portal.y)
  portal.countdownLabel?.setPosition?.(portal.x, portal.y - 58)
  return portal
}

function hasCompleteVisuals(portal) {
  return Boolean(portal?.glow && portal?.ring && portal?.core)
}

export function installPortalPresentationRuntime(scene) {
  if (!scene || typeof scene !== 'object') return null
  if (scene.__dungeonPortalPresentation) return scene.__dungeonPortalPresentation

  const originalOpenPortalMethod = scene.openPortal
  const originalOpenPortal = typeof originalOpenPortalMethod === 'function'
    ? originalOpenPortalMethod.bind(scene)
    : null
  const originalDestroyPortalMethod = scene.destroyPortal
  const originalDestroyPortal = typeof originalDestroyPortalMethod === 'function'
    ? originalDestroyPortalMethod.bind(scene)
    : null

  const remove = () => {
    const portal = scene.portal
    if (!portal) return null
    for (const object of [portal.glow, portal.ring, portal.core, portal.countdownLabel]) killTween(scene, object)
    portal.countdownLabel?.destroy?.()
    portal.countdownLabel = null

    if (originalDestroyPortal) originalDestroyPortal()
    else {
      for (const object of [portal.glow, portal.ring, portal.core]) object?.destroy?.()
      scene.portal = null
    }

    scene.portal = null
    return portal
  }

  const create = ({ id = null, x = 0, y = 0, unlockAt = scene.time?.now ?? 0 } = {}) => {
    if (!scene.add?.circle) {
      originalOpenPortal?.()
      const portal = scene.portal
      if (!portal) return null
      portal.id = id ? String(id) : null
      portal.x = Number(x) || 0
      portal.y = Number(y) || 0
      portal.unlockAt = Number.isFinite(Number(unlockAt)) ? Number(unlockAt) : (scene.time?.now ?? 0)
      portal.countdownLabel ??= null
      return syncPortal(portal)
    }

    const glow = scene.add.circle(x, y, 40, 0x70ff9f, 0.08).setDepth?.(8)
    const ring = scene.add.circle(x, y, 27, 0x1f5132, 0.28).setStrokeStyle?.(4, 0x70ff9f, 0.9)?.setDepth?.(9)
    const core = scene.add.circle(x, y, 16, 0x70ff9f, 0.42).setDepth?.(10)
    scene.tweens?.add?.({ targets: glow, scale: 1.3, alpha: 0.18, duration: 850, yoyo: true, repeat: -1 })
    scene.tweens?.add?.({ targets: ring, scale: 1.12, alpha: 0.62, duration: 620, yoyo: true, repeat: -1 })
    scene.tweens?.add?.({ targets: core, alpha: 0.72, duration: 420, yoyo: true, repeat: -1 })
    scene.portal = { id: id ? String(id) : null, x, y, glow, ring, core, unlockAt, countdownLabel: null }
    return scene.portal
  }

  const ensure = ({ id = null, x = 0, y = 0, unlockAt = scene.time?.now ?? 0 } = {}) => {
    const normalizedId = id == null ? null : String(id)
    const nextX = Number(x) || 0
    const nextY = Number(y) || 0
    const nextUnlockAt = Number.isFinite(Number(unlockAt)) ? Number(unlockAt) : (scene.time?.now ?? 0)
    const current = scene.portal
    if (current) {
      const currentId = current.id == null ? null : String(current.id)
      if (!normalizedId || !currentId || currentId === normalizedId) {
        const resolvedId = normalizedId || currentId
        if (scene.add?.circle && !hasCompleteVisuals(current)) {
          remove()
          const portal = create({ id: resolvedId, x: nextX, y: nextY, unlockAt: nextUnlockAt })
          return { portal, created: Boolean(portal) }
        }
        if (resolvedId) current.id = resolvedId
        current.x = nextX
        current.y = nextY
        current.unlockAt = nextUnlockAt
        current.countdownLabel ??= null
        syncPortal(current)
        return { portal: current, created: false }
      }
      remove()
    }

    const portal = create({ id: normalizedId, x: nextX, y: nextY, unlockAt: nextUnlockAt })
    return { portal, created: Boolean(portal) }
  }

  let api = null
  const restore = () => {
    remove()
    if (scene.destroyPortal === remove) scene.destroyPortal = originalDestroyPortalMethod
    if (scene.__dungeonPortalPresentation === api) scene.__dungeonPortalPresentation = null
  }

  api = { ensure, remove, sync: () => syncPortal(scene.portal), restore }
  scene.__dungeonPortalPresentation = api
  scene.destroyPortal = remove
  scene.events?.once?.('shutdown', restore)
  scene.events?.once?.('destroy', restore)
  return api
}
