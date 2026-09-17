import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const fallbackUrl = new URL('../../static/assets/preview-fallback.svg', import.meta.url)

test('preview fallback is an animated svg hero asset', async () => {
  const source = await readFile(fallbackUrl, 'utf8')

  assert.match(source, /<svg\b/)
  assert.match(source, /viewBox="0 0 1600 900"/)
  assert.match(source, /<animateTransform\b|<animate\b/)
  assert.match(source, /prefers-reduced-motion/)
  assert.match(source, /#c1ff56/i)
})
