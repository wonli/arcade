const RULES = [
  ['critical', /(critical|crit)[_ -]?(hit|impact|burst)?|headshot/i],
  ['heal', /(heal|healing|restore|recovery|regen)/i],
  ['portal', /(portal|gateway|teleport|rift)/i],
  ['smoke', /(smoke|dust|cloud|puff)/i],
  ['aura', /(aura|halo|glow|magic[_ -]?circle|buff)/i],
  ['impact', /(impact|hit|strike|collision)/i],
  ['beam', /(laser|beam|ray)/i],
  ['lightning', /(lightning|thunder|bolt|electric)/i],
  ['whirlwind', /(whirlwind|tornado|cyclone|spin)/i],
  ['explosion', /(explosion|explode|blast|burst)/i],
  ['flame', /(fire|flame|torch|burn)/i],
  ['sparkle', /(sparkle|spark|star|shine|glint)/i],
  ['slash', /(slash|sword|cut)/i],
]

const RETRO_IMPACT_KINDS = new Set(['impact', 'critical', 'explosion', 'smoke'])
const SOURCE_DEFAULT_KIND = Object.freeze({
  lightning: 'lightning',
})

function semanticPath(normalized) {
  return normalized.replace(/\/vfx\/[^/]+\//i, '/vfx/')
}

export function classifyVfxAsset(path, width, height, { hasAlpha = true, source = null } = {}) {
  const normalized = String(path || '').replaceAll('\\', '/')
  if (!/\.png$/i.test(normalized)) return null
  if (!hasAlpha) return null
  if (/(preview|thumbnail|sheet[_ -]?guide|readme|background)/i.test(normalized)) return null

  const matched = RULES.find(([, pattern]) => pattern.test(semanticPath(normalized)))
  const kind = matched?.[0] ?? SOURCE_DEFAULT_KIND[source] ?? null
  if (!kind) return null

  const retroImpact = source === 'retro-impact' || normalized.includes('/retro-impact/')
  if (retroImpact && !RETRO_IMPACT_KINDS.has(kind)) return null

  return {
    kind,
    width: Math.max(1, Math.floor(width || 1)),
    height: Math.max(1, Math.floor(height || 1)),
    path: normalized,
  }
}
