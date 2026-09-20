import assert from 'node:assert/strict'
import test from 'node:test'
import { dungeonCameraLayout, dungeonHudLayout, dungeonViewportMode } from './viewport-layout.js'

test('mobile viewport detection selects the cover camera mode', () => {
  assert.equal(dungeonViewportMode({ width: 336, height: 629 }), 'cover')
  assert.equal(dungeonViewportMode({ width: 844, height: 390 }), 'cover')
  assert.equal(dungeonViewportMode({ width: 1280, height: 720 }), 'cover')
})

test('mobile cover layout fills a tall viewport while keeping the dungeon aspect ratio', () => {
  const layout = dungeonCameraLayout({ width: 336, height: 629, mode: 'cover' })

  assert.equal(layout.zoom, 629 / 600)
  assert.equal(layout.viewportWidth, 336 / layout.zoom)
  assert.equal(layout.viewportHeight, 600)
  assert.equal(layout.scrollX, (960 - layout.viewportWidth) / 2)
  assert.equal(layout.scrollY, 0)
})

test('mobile HUD layout uses screen-pixel insets even when the camera is zoomed', () => {
  const layout = dungeonHudLayout({ width: 336, height: 629, zoom: 629 / 600, inset: 12, compact: true })

  assert.equal(layout.weapon.x * layout.zoom, 12)
  assert.equal(layout.weapon.y * layout.zoom, 12)
  assert.equal(layout.potion.x * layout.zoom, 266)
  assert.equal(layout.potion.y * layout.zoom, 68)
  assert.equal(layout.progress.x * layout.zoom, 208)
  assert.equal(layout.progress.y * layout.zoom, 12)
})

test('compact mobile HUD keeps the potion below the weapon at wider landscape sizes', () => {
  const layout = dungeonHudLayout({ width: 844, height: 390, zoom: 844 / 960, inset: 12, compact: true })

  assert.equal(layout.potion.x * layout.zoom, 774)
  assert.equal(layout.potion.y * layout.zoom, 68)
})

test('compact mobile HUD clamps the potion to the visible right edge on narrow screens', () => {
  const layout = dungeonHudLayout({ width: 272, height: 500, zoom: 1, inset: 8, compact: true })

  assert.equal(layout.potion.x, 206)
  assert.equal(layout.potion.x + 58, 264)
  assert.ok(layout.potion.x >= 8)
})
