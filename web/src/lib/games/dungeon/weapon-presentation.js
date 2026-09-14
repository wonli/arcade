const DEFAULTS = Object.freeze({
  version: 1,
  defaults: {
    scale: 1,
    grip: { x: 0.5, y: 0.78 },
    vfxAnchor: { x: 0.5, y: 0.08 },
    vfxSizeScale: 1,
    poses: {
      idle: {
        right: { x: -15, y: 6, angle: 52 },
        left: { x: 15, y: 6, angle: 128 },
        up: { x: 8, y: 15, angle: 128 },
        down: { x: 8, y: -15, angle: 52 },
      },
      attack: {
        right: { x: 17, y: 5, angle: 84 },
        left: { x: -17, y: 5, angle: -84 },
        up: { x: 10, y: -16, angle: -84 },
        down: { x: 10, y: 17, angle: 84 },
      },
    },
  },
  archetypes: {},
  weapons: {},
})

function clone(value) {
  return value == null ? value : structuredClone(value)
}

function scalar(value, fallback, min = -Infinity, max = Infinity) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback
}

function point(value, fallback) {
  return {
    x: scalar(value?.x, fallback.x),
    y: scalar(value?.y, fallback.y),
  }
}

function pose(value, fallback) {
  return {
    x: scalar(value?.x, fallback.x),
    y: scalar(value?.y, fallback.y),
    angle: scalar(value?.angle, fallback.angle),
  }
}

function mergeEntry(base, override = {}) {
  const result = {
    scale: scalar(override.scale, base.scale, 0.1, 8),
    grip: point(override.grip, base.grip),
    vfxAnchor: point(override.vfxAnchor, base.vfxAnchor),
    vfxSizeScale: scalar(override.vfxSizeScale, base.vfxSizeScale, 0, 8),
    poses: { idle: {}, attack: {} },
  }
  for (const state of ['idle', 'attack']) {
    for (const facing of ['right', 'left', 'up', 'down']) {
      result.poses[state][facing] = pose(override.poses?.[state]?.[facing], base.poses[state][facing])
    }
  }
  return result
}

export function normalizeWeaponPresentationConfig(config = {}) {
  const base = clone(DEFAULTS)
  const defaults = mergeEntry(base.defaults, config.defaults ?? {})
  const archetypes = {}
  for (const [key, value] of Object.entries(config.archetypes ?? {})) archetypes[key] = clone(value)
  const weapons = {}
  for (const [key, value] of Object.entries(config.weapons ?? {})) weapons[key] = clone(value)
  return {
    version: Number(config.version) || 1,
    defaults,
    archetypes,
    weapons,
  }
}

export function resolveWeaponPresentation(config, item = {}, facing = 'down', { attacking = false } = {}) {
  const normalized = normalizeWeaponPresentationConfig(config)
  const archetype = item?.archetype ?? 'sword'
  const weaponKey = item?.type ?? item?.id ?? ''
  const withArchetype = mergeEntry(normalized.defaults, normalized.archetypes?.[archetype] ?? {})
  const resolved = mergeEntry(withArchetype, normalized.weapons?.[weaponKey] ?? {})
  const state = attacking ? 'attack' : 'idle'
  const direction = ['right', 'left', 'up', 'down'].includes(facing) ? facing : 'down'
  return {
    scale: resolved.scale,
    grip: resolved.grip,
    vfxAnchor: resolved.vfxAnchor,
    vfxSizeScale: resolved.vfxSizeScale,
    pose: resolved.poses[state][direction],
  }
}

export function transformWeaponAnchor(visual, anchor = { x: 0.5, y: 0.5 }) {
  const width = Number(visual?.width ?? visual?.displayWidth ?? 0) || 0
  const height = Number(visual?.height ?? visual?.displayHeight ?? 0) || 0
  const originX = Number.isFinite(Number(visual?.originX)) ? Number(visual.originX) : 0.5
  const originY = Number.isFinite(Number(visual?.originY)) ? Number(visual.originY) : 0.5
  const scaleX = Math.abs(Number(visual?.scaleX ?? 1) || 1)
  const scaleY = Math.abs(Number(visual?.scaleY ?? 1) || 1)
  let localX = (Number(anchor?.x ?? 0.5) - originX) * width * scaleX
  const localY = (Number(anchor?.y ?? 0.5) - originY) * height * scaleY
  if (visual?.flipX) localX *= -1
  const radians = (Number(visual?.angle ?? 0) * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return {
    x: Number(visual?.x ?? 0) + localX * cos - localY * sin,
    y: Number(visual?.y ?? 0) + localX * sin + localY * cos,
  }
}

export function createWeaponPresentationState(config = {}) {
  let current = normalizeWeaponPresentationConfig(config)
  return {
    get config() { return current },
    replace(next) {
      current = normalizeWeaponPresentationConfig(next)
      return current
    },
    snapshot() { return clone(current) },
    resolve(item, facing, options) { return resolveWeaponPresentation(current, item, facing, options) },
  }
}

export const DEFAULT_WEAPON_PRESENTATION = DEFAULTS
