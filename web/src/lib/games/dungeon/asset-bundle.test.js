import test from 'node:test'
import assert from 'node:assert/strict'
import { zipSync } from 'fflate'

import { extractDungeonBundle } from './asset-bundle.js'

test('extractDungeonBundle resolves packaged assets to local object URLs on demand', () => {
  const urls = []
  const bytes = zipSync({
    'assets/debts/manifest.json': new TextEncoder().encode(JSON.stringify({ assets: [{ path: '/assets/debts/player.png', source: 'debts' }], png: ['/assets/debts/player.png'] })),
    'assets/vfx/manifest.json': new TextEncoder().encode(JSON.stringify({ assets: [{ path: '/assets/vfx/hit.png', kind: 'impact' }] })),
    'assets/debts/player.png': new Uint8Array([1, 2, 3]),
    'assets/vfx/hit.png': new Uint8Array([4, 5, 6]),
  })

  const bundle = extractDungeonBundle(bytes, {
    createObjectURL(blob) {
      const url = `blob:test-${urls.length}`
      urls.push({ url, blob })
      return url
    },
  })

  assert.equal(bundle.manifest.assets[0].path, '/assets/debts/player.png')
  assert.equal(bundle.vfxManifest.assets[0].path, '/assets/vfx/hit.png')
  assert.equal(bundle.resolveAsset('/assets/debts/player.png'), 'blob:test-0')
  assert.equal(bundle.resolveAsset('/assets/vfx/hit.png'), 'blob:test-1')
  assert.equal(urls.length, 2)
})
