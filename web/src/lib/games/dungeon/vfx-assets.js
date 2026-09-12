const RULES = [
  ['beam', /(laser|beam|ray)/i],
  ['lightning', /(lightning|thunder|bolt|electric)/i],
  ['whirlwind', /(whirlwind|tornado|cyclone|spin)/i],
  ['explosion', /(explosion|explode|blast|burst)/i],
  ['flame', /(fire|flame|torch|burn)/i],
  ['sparkle', /(sparkle|spark|star|shine|glint)/i],
  ['slash', /(slash|sword|impact|hit|cut)/i],
]

export function classifyVfxAsset(path, width, height, { hasAlpha = true } = {}) {
  const normalized = String(path || '').replaceAll('\\', '/')
  if (!/\.png$/i.test(normalized)) return null
  if (!hasAlpha) return null
  if (/(preview|thumbnail|sheet[_ -]?guide|readme)/i.test(normalized)) return null
  const matched = RULES.find(([, pattern]) => pattern.test(normalized))
  if (!matched) return null
  return {
    kind: matched[0],
    width: Math.max(1, Math.floor(width || 1)),
    height: Math.max(1, Math.floor(height || 1)),
    path: normalized,
  }
}
