import test from 'node:test'
import assert from 'node:assert/strict'
import { strToU8, zipSync } from 'fflate'

import { extractTankBundle, loadTankAssetBundle } from './asset-bundle.js'

function bundleBytes() {
  return zipSync({
    'assets/tank/assets.json': strToU8(JSON.stringify({
      source: 'kenney-topdown-tanks-redux',
      assets: {
        blueBody: '/assets/tank/files/tankBody_blue.png',
        blueTurret: '/assets/tank/files/tankBlue_barrel1.png',
      },
    })),
    'assets/tank/files/tankBody_blue.png': new Uint8Array([1, 2, 3]),
    'assets/tank/files/tankBlue_barrel1.png': new Uint8Array([4, 5, 6]),
  })
}

test('extractTankBundle resolves packaged assets to object URLs', () => {
  const created = []
  const revoked = []
  const bundle = extractTankBundle(bundleBytes(), {
    createObjectURL: () => {
      const url = `blob:test-${created.length}`
      created.push(url)
      return url
    },
    revokeObjectURL: (url) => revoked.push(url),
  })

  assert.equal(bundle.asset('blueBody'), 'blob:test-0')
  assert.equal(bundle.asset('blueBody'), 'blob:test-0', 'asset URLs should be memoized')
  assert.equal(bundle.asset('blueTurret'), 'blob:test-1')
  assert.throws(() => bundle.asset('missing'), /missing tank asset/i)

  bundle.dispose()
  assert.deepEqual(revoked, created)
})

test('loadTankAssetBundle rejects when the runtime manifest cannot be loaded', async () => {
  const fetchImpl = async () => ({ ok: false, status: 503 })
  await assert.rejects(
    () => loadTankAssetBundle({ fetchImpl, cacheStorage: null }),
    /runtime manifest request failed: 503/i,
  )
})

test('loadTankAssetBundle never falls back to individual remote asset requests', async () => {
  const calls = []
  const fetchImpl = async (url) => {
    calls.push(String(url))
    if (String(url).endsWith('runtime-manifest.json')) {
      return {
        ok: true,
        async json() { return { version: 'abc', zip: '/assets/tank/tank-assets-abc.zip' } },
      }
    }
    return { ok: false, status: 404 }
  }

  await assert.rejects(() => loadTankAssetBundle({ fetchImpl, cacheStorage: null }), /package request failed: 404/i)
  assert.deepEqual(calls, [
    '/assets/tank/runtime-manifest.json',
    '/assets/tank/tank-assets-abc.zip',
  ])
})
