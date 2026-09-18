const DEFAULT_COLOR = 0x70f2ce

export function installDungeonProjectilePresentation(scene) {
  if (!scene || typeof scene !== 'object') throw new TypeError('Dungeon scene is required')
  if (scene.__dungeonProjectilePresentation) return scene.__dungeonProjectilePresentation

  const byId = new Map()

  function ensure(snapshot = {}) {
    const id = String(snapshot.id ?? '')
    if (!id) return null
    let projectile = byId.get(id) ?? null
    if (!projectile) {
      const color = snapshot.color ?? DEFAULT_COLOR
      const visual = scene.add?.circle?.(Number(snapshot.x) || 0, Number(snapshot.y) || 0, 7, color, 0.92)
      visual?.setStrokeStyle?.(2, 0xd6fff3, 0.9)?.setDepth?.(24)
      const glow = scene.add?.circle?.(Number(snapshot.x) || 0, Number(snapshot.y) || 0, 13, color, 0.16)
      glow?.setDepth?.(23)
      projectile = { id, visual, glow }
      byId.set(id, projectile)
    }
    return sync(projectile, snapshot)
  }

  function sync(projectile, snapshot = projectile) {
    if (!projectile) return null
    projectile.kind = snapshot.kind ?? projectile.kind ?? 'enemy'
    projectile.ownerId = String(snapshot.ownerId ?? projectile.ownerId ?? '')
    projectile.x = finite(snapshot.x, projectile.x)
    projectile.y = finite(snapshot.y, projectile.y)
    projectile.vx = finite(snapshot.vx, projectile.vx)
    projectile.vy = finite(snapshot.vy, projectile.vy)
    projectile.visual?.setPosition?.(projectile.x, projectile.y)
    projectile.glow?.setPosition?.(projectile.x, projectile.y)
    return projectile
  }

  function remove(id) {
    const key = String(id ?? '')
    const projectile = byId.get(key)
    if (!projectile) return null
    projectile.visual?.destroy?.()
    projectile.glow?.destroy?.()
    byId.delete(key)
    return projectile
  }

  function clear() {
    for (const id of [...byId.keys()]) remove(id)
  }

  function reconcile(snapshots = []) {
    const wanted = new Set()
    const result = []
    for (const snapshot of snapshots ?? []) {
      const id = String(snapshot?.id ?? '')
      if (!id) continue
      wanted.add(id)
      const projectile = ensure(snapshot)
      if (projectile) result.push(projectile)
    }
    for (const id of [...byId.keys()]) if (!wanted.has(id)) remove(id)
    return result
  }

  const api = { ensure, sync, remove, clear, reconcile, values: () => [...byId.values()] }
  scene.__dungeonProjectilePresentation = api
  scene.events?.once?.('shutdown', clear)
  scene.events?.once?.('destroy', clear)
  return api
}

function finite(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : (Number(fallback) || 0)
}
