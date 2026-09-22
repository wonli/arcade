import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('./PoliceThiefBoard.svelte', import.meta.url), 'utf8')
const graphSource = await readFile(new URL('./graph.js', import.meta.url), 'utf8')

test('police thief pieces render readable role names', () => {
  assert.match(source, /thiefLabel/)
  assert.match(source, /policeLabel/)
  assert.match(source, /thief-piece/)
  assert.match(source, /police-piece/)
})

test('police thief pieces use the committed svg assets', () => {
  assert.match(source, /game\/policethief\/assets\/p\.svg/)
  assert.match(source, /game\/policethief\/assets\/t\.svg/)
  assert.match(source, /<img[^>]+src=\{policeIcon\}/)
  assert.match(source, /<img[^>]+src=\{thiefIcon\}/)
})

test('board gives the top node breathing room and a distinct playfield', () => {
  assert.match(graphSource, /id: 'A', x: 50, y: 15/)
  assert.match(source, /class="board-surface"/)
  assert.match(source, /\.board-surface\{[^}]*background:/)
})

test('board node circles are large enough to read at desktop and mobile sizes', () => {
  assert.match(source, /\.node-core\{[^}]*width:26px;height:26px/)
  assert.match(source, /@media\(max-width:650px\)[\s\S]*\.node-core\{width:22px;height:22px\}/)
})

test('board paths stay above decorative layers and remain clearly visible', () => {
  assert.match(source, /\.board-frame\{[^}]*z-index:3/)
  assert.match(source, /\.paths\{[^}]*z-index:4/)
  assert.match(source, /\.node\{[^}]*z-index:5/)
  assert.match(source, /\.path-line\{stroke:#aab4bf;stroke-width:3;opacity:1\}/)
})

test('mobile board fills and centers within its parent without a heavy inner frame', () => {
  assert.match(source, /\.path-board\{[^}]*margin-inline:auto;[^}]*box-sizing:border-box/)
  assert.match(source, /@media\(max-width:650px\)[\s\S]*\.path-board\{width:100%\}/)
  assert.match(source, /@media\(max-width:650px\)[\s\S]*\.board-surface,\.board-grid\{inset:2\.5%\}/)
  assert.match(source, /@media\(max-width:650px\)[\s\S]*\.board-frame\{display:none\}/)
})
