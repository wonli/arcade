import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const layout = fs.readFileSync(path.resolve(process.cwd(), 'src/routes/+layout.svelte'), 'utf8')
const nav = fs.readFileSync(path.resolve(process.cwd(), 'src/lib/components/ArcadeTopNav.svelte'), 'utf8')
const app = fs.readFileSync(path.resolve(process.cwd(), 'src/app.html'), 'utf8')

test('arcade navigation reserves the top safe area before dungeon content', () => {
  assert.match(app, /viewport-fit=cover/)
  assert.match(layout, /grid-template-rows:calc\(44px\s*\+\s*env\(safe-area-inset-top\)\)\s+minmax\(0,1fr\)/)
  assert.match(nav, /height:calc\(44px\s*\+\s*env\(safe-area-inset-top\)\)/)
  assert.match(nav, /padding:env\(safe-area-inset-top\)\s+18px\s+0/)
})
