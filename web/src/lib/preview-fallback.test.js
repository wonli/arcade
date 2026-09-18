import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const fallbackUrl = new URL('../../static/assets/banner.png', import.meta.url)

test('preview fallback uses the committed banner png', async () => {
  const source = await readFile(fallbackUrl)

  assert.ok(source.length > 8)
  assert.deepEqual([...source.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10])
})
