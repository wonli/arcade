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
  for (const control of ['Export JSON', 'Import JSON', 'Undo', 'Redo', 'New room', 'Validate']) assert.match(source, new RegExp(control))
  assert.match(source, /grid-template-columns/)
  assert.match(source, /tileSize|native-grid|room-surface/)
  assert.doesNotMatch(source, /editor-runtime\.js/)
  assert.doesNotMatch(source, /weapon-presentation|WEAPON_CATALOG|createDungeonEditorConfigClient/)
})

test('palette preview URLs are backed by the extracted Dungeon3 metadata', async () => {
  const { listDungeon3RoomAssets } = await import('./room-template-assets.js')
  for (const asset of listDungeon3RoomAssets()) {
    assert.match(asset.image, /^\/assets\/dungeon-tileset\/dungeon-pixel-tileset-for-rpg-and-roguelike-game\/Tiled_files\/.+\.png$/)
  }
})
