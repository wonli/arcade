import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const routePaths = [
  'src/routes/dungeon/+page.svelte',
  'src/routes/room/[code]/dungeon/+page.svelte',
].map((route) => path.resolve(process.cwd(), route))
const sources = routePaths.map((route) => fs.readFileSync(route, 'utf8'))

function assertAll(pattern) {
  for (const source of sources) assert.match(source, pattern)
}

test('dungeon keeps touch controls available in a narrow viewport without relying only on pointer type', () => {
  assertAll(/@media\(max-width:720px\)[\s\S]*?\.touch-controls\s*\{[^}]*display:block/s)
})

test('dungeon gives landscape play the full stage height', () => {
  assertAll(/@media\(orientation:landscape\)\s+and\s+\(max-height:600px\)/)
  assertAll(/\.page\s*\{[^}]*grid-template-rows:minmax\(0,1fr\)/s)
  assertAll(/(?:header|\.topbar)\s*\{[^}]*display:none/s)
  assertAll(/footer\s*\{[^}]*display:none/s)
  assert.match(sources[0], /@media\(max-height:520px\)\s+and\s+\(orientation:portrait\)/)
})

test('dungeon scales touch controls down for mobile and landscape', () => {
  assertAll(/(?:\.touch-actions button|\.touch-button)\s*\{[^}]*width:52px[^}]*height:52px/s)
  assertAll(/(?:\.touch-actions \.skill|\.touch-button\.skill)\s*\{[^}]*width:58px[^}]*height:58px/s)
  assertAll(/@media\(orientation:landscape\)\s+and\s+\(max-height:600px\)[\s\S]*?(?:\.touch-actions button|\.touch-button)\s*\{[^}]*width:46px[^}]*height:46px/s)
})

test('dungeon keeps all gameplay HUD cards fixed to visible stage edges', () => {
  assertAll(/\.hud-weapon,\.hud-progress\s*\{[^}]*position:absolute/s)
  assertAll(/\.hud-weapon\{[^}]*left:max\(12px,env\(safe-area-inset-left\)\)/s)
  assertAll(/\.hud-progress\{[^}]*right:max\(12px,env\(safe-area-inset-right\)\)/s)
  assertAll(/\.potion-action\s*\{[^}]*top:68px[^}]*right:max\(12px,env\(safe-area-inset-right\)\)/s)
  assert.match(sources[0], /\.potion-action\s*\{[^}]*top:60px[^}]*right:max\(8px,env\(safe-area-inset-right\)\)/s)
})
