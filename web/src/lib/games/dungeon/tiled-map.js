const FLIP_X = 0x80000000
const FLIP_Y = 0x40000000
const FLIP_DIAGONAL = 0x20000000
const GID_MASK = 0x1fffffff

function decodeXml(value = '') {
  return value
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
}

function attributes(source = '') {
  const result = {}
  for (const match of source.matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) result[match[1]] = decodeXml(match[2])
  return result
}

function int(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function parseAnimations(body = '') {
  const animations = {}
  for (const tileMatch of body.matchAll(/<tile\b([^>]*)>([\s\S]*?)<\/tile>/g)) {
    const tileAttrs = attributes(tileMatch[1])
    const animationMatch = tileMatch[2].match(/<animation>([\s\S]*?)<\/animation>/)
    if (!animationMatch) continue
    const frames = [...animationMatch[1].matchAll(/<frame\b([^>]*)\/?\s*>/g)].map((match) => {
      const attrs = attributes(match[1])
      return { tileId: int(attrs.tileid), duration: int(attrs.duration) }
    })
    if (frames.length) animations[String(int(tileAttrs.id))] = frames
  }
  return animations
}

function parseTilesets(xml = '') {
  const entries = []
  for (const match of xml.matchAll(/<tileset\b([^>]*)>([\s\S]*?)<\/tileset>/g)) {
    const attrs = attributes(match[1])
    const body = match[2]
    const imageMatch = body.match(/<image\b([^>]*)\/?\s*>/)
    const imageAttrs = imageMatch ? attributes(imageMatch[1]) : {}
    entries.push({
      name: attrs.name,
      firstGid: int(attrs.firstgid),
      tileWidth: int(attrs.tilewidth),
      tileHeight: int(attrs.tileheight),
      tileCount: int(attrs.tilecount),
      columns: int(attrs.columns),
      image: imageAttrs.source ?? null,
      imageWidth: int(imageAttrs.width),
      imageHeight: int(imageAttrs.height),
      animations: parseAnimations(body),
    })
  }
  return entries.filter((entry) => entry.name && entry.firstGid > 0).sort((a, b) => a.firstGid - b.firstGid)
}

function parseCsv(value = '') {
  return value
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((entry) => int(entry))
}

function parseLayers(xml = '') {
  const layers = {}
  for (const match of xml.matchAll(/<layer\b([^>]*)>([\s\S]*?)<\/layer>/g)) {
    const attrs = attributes(match[1])
    const body = match[2]
    const dataMatch = body.match(/<data\b([^>]*)>([\s\S]*?)<\/data>/)
    if (!dataMatch) continue
    const dataAttrs = attributes(dataMatch[1])
    if (dataAttrs.encoding && dataAttrs.encoding !== 'csv') continue
    const chunks = []
    for (const chunkMatch of dataMatch[2].matchAll(/<chunk\b([^>]*)>([\s\S]*?)<\/chunk>/g)) {
      const chunkAttrs = attributes(chunkMatch[1])
      chunks.push({
        x: int(chunkAttrs.x),
        y: int(chunkAttrs.y),
        width: int(chunkAttrs.width),
        height: int(chunkAttrs.height),
        gids: parseCsv(chunkMatch[2]),
      })
    }
    if (!chunks.length) {
      chunks.push({ x: 0, y: 0, width: int(attrs.width), height: int(attrs.height), gids: parseCsv(dataMatch[2]) })
    }
    if (attrs.name) layers[attrs.name] = { id: int(attrs.id), width: int(attrs.width), height: int(attrs.height), chunks }
  }
  return layers
}

export function parseTiledMap(xml = '') {
  const mapMatch = xml.match(/<map\b([^>]*)>/)
  if (!mapMatch) throw new Error('Invalid Tiled map: missing <map> root')
  const mapAttrs = attributes(mapMatch[1])
  const tilesetList = parseTilesets(xml)
  const tilesets = Object.fromEntries(tilesetList.map((entry) => [entry.name, entry]))

  const resolveBaseGid = (value) => {
    if (value <= 0) return null
    let selected = null
    for (const tileset of tilesetList) {
      if (tileset.firstGid > value) break
      selected = tileset
    }
    if (!selected) return null
    const tileId = value - selected.firstGid
    if (selected.tileCount > 0 && tileId >= selected.tileCount) return null
    return { tileset: selected.name, tileId }
  }

  const decodeGid = (gid) => {
    const raw = int(gid) >>> 0
    const value = (raw & GID_MASK) >>> 0
    const resolved = resolveBaseGid(value)
    if (!resolved) return null
    return {
      ...resolved,
      flipX: Boolean(raw & FLIP_X),
      flipY: Boolean(raw & FLIP_Y),
      flipDiagonal: Boolean(raw & FLIP_DIAGONAL),
    }
  }

  const resolveGid = (gid) => {
    const decoded = decodeGid(gid)
    return decoded ? { tileset: decoded.tileset, tileId: decoded.tileId } : null
  }

  return {
    version: mapAttrs.version ?? null,
    tiledVersion: mapAttrs.tiledversion ?? null,
    orientation: mapAttrs.orientation ?? null,
    infinite: mapAttrs.infinite === '1',
    tileWidth: int(mapAttrs.tilewidth),
    tileHeight: int(mapAttrs.tileheight),
    tilesets,
    layers: parseLayers(xml),
    resolveGid,
    decodeGid,
  }
}
