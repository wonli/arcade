import { unzipSync } from 'fflate'

const RUNTIME_MANIFEST_URL = '/assets/tank/runtime-manifest.json'
const ASSET_MANIFEST_PATH = 'assets/tank/assets.json'
const CACHE_PREFIX = 'tank-assets-'

function entryPath(path) { return String(path ?? '').replace(/^\/+/, '') }

function mimeType(path) {
  if (/\.json$/i.test(path)) return 'application/json'
  if (/\.png$/i.test(path)) return 'image/png'
  return 'application/octet-stream'
}

function readText(files, path) {
  const bytes = files[entryPath(path)]
  if (!bytes) throw new Error(`Tank bundle is missing ${path}`)
  return new TextDecoder().decode(bytes)
}

function unpackTankBundle(bytes) {
  const files = unzipSync(bytes)
  const manifest = JSON.parse(readText(files, ASSET_MANIFEST_PATH))
  if (!manifest?.assets || typeof manifest.assets !== 'object') throw new Error('Tank asset manifest is invalid')
  for (const path of Object.values(manifest.assets)) {
    if (!files[entryPath(path)]) throw new Error(`Tank bundle is missing ${path}`)
  }
  return { files, manifest }
}

export function extractTankBundle(bytes, {
  createObjectURL = (blob) => URL.createObjectURL(blob),
  revokeObjectURL = (url) => URL.revokeObjectURL(url),
} = {}) {
  const { files, manifest } = unpackTankBundle(bytes)
  const objectUrls = []
  const resolved = new Map()

  function asset(name) {
    const path = manifest.assets?.[name]
    if (!path) throw new Error(`Missing tank asset: ${name}`)
    if (resolved.has(path)) return resolved.get(path)
    const entry = files[entryPath(path)]
    if (!entry) throw new Error(`Tank bundle is missing ${path}`)
    const url = createObjectURL(new Blob([entry], { type: mimeType(path) }))
    resolved.set(path, url)
    objectUrls.push(url)
    return url
  }

  return {
    manifest,
    asset,
    dispose() {
      for (const url of objectUrls) revokeObjectURL(url)
      objectUrls.length = 0
      resolved.clear()
    },
  }
}

async function readResponseBytes(response, onProgress, phase = 'download') {
  const total = Number(response.headers?.get?.('content-length')) || 0
  if (!response.body?.getReader) {
    const bytes = new Uint8Array(await response.arrayBuffer())
    onProgress({ phase, loaded: bytes.byteLength, total: total || bytes.byteLength, percent: 100 })
    return bytes
  }
  const reader = response.body.getReader()
  const chunks = []
  let loaded = 0
  while (true) {
    const next = await reader.read()
    if (next.done) break
    chunks.push(next.value)
    loaded += next.value.byteLength
    onProgress({ phase, loaded, total, percent: total ? Math.min(100, Math.round(loaded / total * 100)) : 0 })
  }
  const bytes = new Uint8Array(loaded)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  onProgress({ phase, loaded, total: total || loaded, percent: 100 })
  return bytes
}

async function removeOldTankCaches(cacheStorage, currentName) {
  const keys = await cacheStorage.keys()
  await Promise.all(keys
    .filter((key) => key.startsWith(CACHE_PREFIX) && key !== currentName)
    .map((key) => cacheStorage.delete(key)))
}

async function readCachedOrDownloadedZip(runtime, fetchImpl, cacheStorage, onProgress) {
  const cacheName = `${CACHE_PREFIX}${runtime.version}`
  if (cacheStorage) {
    try {
      const cache = await cacheStorage.open(cacheName)
      const cached = await cache.match(runtime.zip)
      if (cached) {
        try {
          const bytes = await readResponseBytes(cached, onProgress, 'cache')
          unpackTankBundle(bytes)
          await removeOldTankCaches(cacheStorage, cacheName).catch(() => {})
          return bytes
        } catch {
          await cacheStorage.delete(cacheName).catch(() => {})
        }
      }
    } catch {
      // CacheStorage can exist but be unavailable in private/embedded contexts.
    }
  }

  const response = await fetchImpl(runtime.zip)
  if (!response.ok) throw new Error(`Tank asset package request failed: ${response.status}`)
  const cacheCopy = response.clone?.()
  const bytes = await readResponseBytes(response, onProgress, 'download')
  unpackTankBundle(bytes)
  if (cacheStorage && cacheCopy) {
    try {
      const cache = await cacheStorage.open(cacheName)
      await cache.put(runtime.zip, cacheCopy)
      await removeOldTankCaches(cacheStorage, cacheName)
    } catch {
      // The downloaded bytes remain usable for this session even when persistence is denied.
    }
  }
  return bytes
}

export async function loadTankAssetBundle({
  fetchImpl = globalThis.fetch,
  cacheStorage = globalThis.caches,
  onProgress = () => {},
} = {}) {
  const runtimeResponse = await fetchImpl(RUNTIME_MANIFEST_URL, { cache: 'no-store' })
  if (!runtimeResponse.ok) throw new Error(`Tank runtime manifest request failed: ${runtimeResponse.status}`)
  const runtime = await runtimeResponse.json()
  if (!runtime?.version || !runtime?.zip) throw new Error('Tank runtime manifest is invalid')

  const bytes = await readCachedOrDownloadedZip(runtime, fetchImpl, cacheStorage, onProgress)
  onProgress({ phase: 'unpack', loaded: 0, total: bytes.byteLength, percent: 0 })
  const bundle = extractTankBundle(bytes)
  onProgress({ phase: 'unpack', loaded: bytes.byteLength, total: bytes.byteLength, percent: 100 })
  return { ...bundle, version: runtime.version }
}
