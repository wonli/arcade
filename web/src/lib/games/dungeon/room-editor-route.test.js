import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const routePath = fileURLToPath(new URL('../../../routes/dungeon/room-editor/+page.svelte', import.meta.url))

test('room editor route is a native Dungeon3 template editor, not the weapon editor', async () => {
  const source = await readFile(routePath, 'utf8')

  for (const moduleName of ['room-template.js', 'room-template-assets.js', 'room-template-editor.js']) {
    assert.match(source, new RegExp(moduleName.replace('.', '\\.'), 'i'))
  }
  for (const control of ['导出校正 JSON', '导入 JSON', '撤销', '重做', '重新生成当前样板', '检查']) assert.match(source, new RegExp(control))
  assert.match(source, /grid-template-columns/)
  assert.match(source, /tileSize|native-grid|room-surface/)
  assert.match(source, /correction-strip/)
  assert.match(source, /sample-card/)
  assert.match(source, /不会导出/)
  assert.doesNotMatch(source, /class="panel inspector-panel"/)
  assert.match(source, /grid-template-columns: minmax\(160px, 200px\) minmax\(0, 1fr\)/)
  assert.doesNotMatch(source, /editor-runtime\.js/)
  assert.doesNotMatch(source, /weapon-presentation|WEAPON_CATALOG|createDungeonEditorConfigClient/)
})

test('room editor uses a full-height workbench with an independently scrolling palette', async () => {
  const source = await readFile(routePath, 'utf8')

  assert.match(source, /class="palette-scroll"/)
  assert.match(source, /\.editor-shell\s*\{[^}]*height:\s*100dvh/s)
  assert.match(source, /\.workspace\s*\{[^}]*flex:\s*1/s)
  assert.match(source, /\.palette-panel\s*\{[^}]*display:\s*flex/s)
  assert.match(source, /\.palette-scroll\s*\{[^}]*overflow-y:\s*auto/s)
  assert.match(source, /\.canvas-panel\s*\{[^}]*min-height:\s*0/s)
  assert.match(source, /\.surface-scroll\s*\{[^}]*min-height:\s*0/s)
})

test('room editor compresses identity, scenarios and actions into one top navigation', async () => {
  const source = await readFile(routePath, 'utf8')

  assert.match(source, /class="editor-nav"/)
  assert.match(source, /class="nav-scenarios"/)
  assert.match(source, /class="nav-actions"/)
  assert.doesNotMatch(source, /class="workflow-bar"/)
  assert.doesNotMatch(source, /class="scenario-bar"/)
  assert.doesNotMatch(source, /class="nav-help"/)
  assert.match(source, /\.editor-nav\s*\{[^}]*display:\s*flex/s)
  assert.match(source, /\.nav-scenarios\s*\{[^}]*overflow-x:\s*auto/s)
})

test('room editor gives the canvas the available space', async () => {
  const source = await readFile(routePath, 'utf8')

  assert.doesNotMatch(source, /class="canvas-heading"/)
  assert.doesNotMatch(source, /class="canvas-status"/)
  assert.match(source, /\.editor-shell\s*\{[^}]*padding:\s*0/s)
  assert.match(source, /\.correction-strip\s*\{[^}]*padding:\s*3px/s)
  assert.match(source, /\.canvas-panel\s*\{[^}]*padding:\s*0/s)
})

test('room editor overlays canvas tools without consuming canvas space', async () => {
  const source = await readFile(routePath, 'utf8')

  assert.match(source, /class="surface-scroll"[\s\S]*class="canvas-tools"/)
  assert.match(source, /\.workspace\s*\{[^}]*padding:\s*8px/s)
  assert.match(source, /\.surface-scroll\s*\{[^}]*position:\s*relative/s)
  assert.match(source, /\.canvas-tools\s*\{[^}]*position:\s*absolute/s)
})

test('room editor keeps scenario scrolling compact and tool labels on one line', async () => {
  const source = await readFile(routePath, 'utf8')

  assert.match(source, /\.nav-scenarios\s*\{[^}]*scrollbar-width:\s*none/s)
  assert.match(source, /\.nav-scenarios::\-webkit-scrollbar\s*\{[^}]*display:\s*none/s)
  assert.match(source, /\.canvas-tools\s*\{[^}]*background:\s*rgba\(/s)
  assert.match(source, /\.tool-row button[^}]*white-space:\s*nowrap/s)
})

test('room editor opens in selection mode so authored placements can be corrected immediately', async () => {
  const source = await readFile(routePath, 'utf8')

  assert.match(source, /let selectedTool = 'select'/)
  assert.match(source, /selectedTool: 'select'/)
  assert.match(source, /function chooseAsset\(asset\)\s*\{[\s\S]*selectedTool = 'place'/)
})

test('palette preview URLs are backed by the extracted Dungeon3 metadata', async () => {
  const { listDungeon3RoomAssets } = await import('./room-template-assets.js')
  for (const asset of listDungeon3RoomAssets()) {
    assert.match(asset.image, /^\/assets\/dungeon-tileset\/dungeon-pixel-tileset-for-rpg-and-roguelike-game\/Tiled_files\/.+\.png$/)
  }
})

test('room editor renders complete multi-tile resource previews', async () => {
  const source = await readFile(routePath, 'utf8')

  assert.match(source, /class="asset-preview"/)
  assert.match(source, /class="preview-tile"/)
  assert.match(source, /assetPreviewStyle\(asset\)/)
  assert.match(source, /paletteGroup === 'arches'/)
})
