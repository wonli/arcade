import { unzipSync } from 'fflate'

const RUNTIME_MANIFEST_URL = '/assets/dungeon/runtime-manifest.json'
const DEBTS_MANIFEST_PATH = 'assets/debts/manifest.json'
const VFX_MANIFEST_PATH = 'assets/vfx/manifest.json'
const CACHE_PREFIX = 'dungeon-assets-'

function entryPath(path) { return String(path ?? '').replace(/^\/+/, '') }

function mimeType(path) {
  if (/\.json$/i.test(path)) return 'application/json'
  if (/\.png$/i.test(path)) return 'image/png'
  if (/\.wav$/i.test(path)) return 'audio/wav'
  if (/\.m4a$/i.test(path)) return 'audio/mp4'
  return 'application/octet-stream'
}

function textFile(files, path) {
  const bytes = files[entryPath(path)]
  if (!bytes) throw new Error(`Dungeon bundle is missing ${path}`)
  return new TextDecoder().decode(bytes)
}

export function extractDungeonBundle(bytes, {
  createObjectURL = (blob) => URL.createObjectURL(blob),
  revokeObjectURL = (url) => URL.revokeObjectURL(url),
} = {}) {
  const files = unzipSync(bytes)
  const objectUrls = []
  const resolved = new Map()
  const resolveAsset = (path) => {
    if (!path || !String(path).startsWith('/assets/')) return path
    if (resolved.has(path)) return resolved.get(path)
    const entry = files[entryPath(path)]
    if (!entry) return path
    const url = createObjectURL(new Blob([entry], { type: mimeType(path) }))
    objectUrls.push(url)
    resolved.set(path, url)
    return url
  }
  const manifest = JSON.parse(textFile(files, DEBTS_MANIFEST_PATH))
  const vfxManifest = JSON.parse(textFile(files, VFX_MANIFEST_PATH))
  return {
    manifest,
    vfxManifest,
    resolveAsset,
    dispose() {
      for (const url of objectUrls) revokeObjectURL(url)
      objectUrls.length = 0
      resolved.clear()
    },
  }
}

async function readCachedOrDownloadedZip(runtime, fetchImpl, onProgress) {
  const cacheName = `${CACHE_PREFIX}${runtime.version}`
  const cacheStorage = globalThis.caches
  if (cacheStorage) {
    try {
      const cache = await cacheStorage.open(cacheName)
      const cached = await cache.match(runtime.zip)
      if (cached) {
        onProgress({ phase: 'cache', loaded: 0, total: Number(cached.headers?.get?.('content-length')) || 0, percent: 0 })
        const bytes = await readResponseBytes(cached, (progress) => onProgress({ ...progress, phase: 'cache' }))
        onProgress({ phase: 'cache', loaded: bytes.byteLength, total: bytes.byteLength, percent: 100 })
        await removeOldDungeonCaches(cacheStorage, cacheName).catch(() => {})
        return bytes
      }
    } catch {
      // Continue with a normal download when CacheStorage is unavailable.
    }
  }

  const response = await fetchImpl(runtime.zip)
  if (!response.ok) throw new Error(`Dungeon asset package request failed: ${response.status}`)
  const cacheCopy = response.clone?.()
  const bytes = await readResponseBytes(response, onProgress)
  if (cacheStorage && cacheCopy) {
    try {
      const cache = await cacheStorage.open(cacheName)
      await cache.put(runtime.zip, cacheCopy)
      await removeOldDungeonCaches(cacheStorage, cacheName)
    } catch {
      // Private browsing and embedded webviews may expose CacheStorage but deny writes.
    }
  }
  return bytes
}

async function removeOldDungeonCaches(cacheStorage, currentName) {
  const keys = await cacheStorage.keys()
  await Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== currentName).map((key) => cacheStorage.delete(key)))
}

async function readResponseBytes(response, onProgress) {
  const total = Number(response.headers?.get?.('content-length')) || 0
  if (!response.body?.getReader) {
    const bytes = new Uint8Array(await response.arrayBuffer())
    onProgress({ phase: 'download', loaded: bytes.byteLength, total, percent: 100 })
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
    onProgress({ phase: 'download', loaded, total, percent: total ? Math.min(100, Math.round(loaded / total * 100)) : 0 })
  }
  const bytes = new Uint8Array(loaded)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  onProgress({ phase: 'download', loaded, total, percent: 100 })
  return bytes
}

export async function loadDungeonAssetBundle({ fetchImpl = globalThis.fetch, onProgress = () => {} } = {}) {
  try {
    const runtimeResponse = await fetchImpl(RUNTIME_MANIFEST_URL, { cache: 'no-store' })
    if (!runtimeResponse.ok) throw new Error(`Dungeon runtime manifest request failed: ${runtimeResponse.status}`)
    const runtime = await runtimeResponse.json()
    const bytes = await readCachedOrDownloadedZip(runtime, fetchImpl, onProgress)
    onProgress({ phase: 'unpack', loaded: 0, total: bytes.byteLength, percent: 0 })
    const bundle = extractDungeonBundle(bytes)
    onProgress({ phase: 'unpack', loaded: bytes.byteLength, total: bytes.byteLength, percent: 100 })
    return { ...bundle, fromBundle: true, version: runtime.version }
  } catch (cause) {
    const [debtsResponse, vfxResponse] = await Promise.all([
      fetchImpl('/assets/debts/manifest.json').catch(() => null),
      fetchImpl('/assets/vfx/manifest.json').catch(() => null),
    ])
    return {
      manifest: debtsResponse?.ok ? await debtsResponse.json() : { assets: [], png: [] },
      vfxManifest: vfxResponse?.ok ? await vfxResponse.json() : { assets: [] },
      resolveAsset: (path) => path,
      dispose() {},
      fromBundle: false,
      error: cause,
    }
  }
}
