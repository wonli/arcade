import test from 'node:test'
import assert from 'node:assert/strict'
import { generateDungeonGeometry } from './map-generator.js'
import { buildDungeon3TilePlan } from './dungeon3-renderer.js'
import { dungeon3Rules as rules } from './dungeon3-rules.js'

test('source rules preserve complete wall doors, water ripples and both trap assemblies', () => {
  assert.ok(rules.motifs.doors.some(m => m.width === 2 && m.height === 3 && m.cells.length === 6))
  assert.ok(rules.assemblies.waterRipple.cells.every(c => rules.tilesets[c.tileset].animations[c.tileId]?.length > 1))
  assert.equal(rules.assemblies.wallTrap.height, 6)
  assert.equal(rules.assemblies.floorTrap.cells.length, 4)
})

test('connections distinguish same-level bridges from stair transitions; doors belong to walls', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const g = generateDungeonGeometry({runSeed:seed})
    for (const path of g.paths) {
      const a = g.rooms[path.from], b = g.rooms[path.to]
      const stairs = g.stairs.filter(s => s.pathId === path.id)
      assert.equal(stairs.length, a.level === b.level ? 0 : 1)
      for (const stair of stairs) {
        assert.equal(stair.orientation, 'down')
        assert.equal(stair.highLevel - stair.lowLevel, 1)
      }
    }
    for (const door of g.doors) {
      assert.ok(g.walls.some(w => w.id === door.wallId))
      assert.equal(door.motif.height, 3)
      assert.equal(door.orientation, 'down')
    }
    assert.ok(g.traps.some(t => t.kind === 'plate-trap'))
    assert.ok(g.traps.some(t => t.kind === 'wall-trap'))
    for (const trap of g.traps) for (const anchor of [g.spawn,g.exit,g.rest,...g.spawnPoints,...g.chests]) {
      const r=trap.damageArea
      assert.ok(anchor.x < r.x-24 || anchor.x > r.x+r.width+24 || anchor.y < r.y-24 || anchor.y > r.y+r.height+24)
    }
  }
})

test('render plan includes animated water, complete traps, bridge decks and elevation faces', () => {
  const g=generateDungeonGeometry({runSeed:33})
  const plan=buildDungeon3TilePlan(g)
  for(const layer of ['water-detail','bridge-deck','elevation-face','wall','floor-trap','wall-trap']) assert.ok(plan.some(t=>t.layer===layer),layer)
  for(const trap of g.traps) assert.equal(plan.filter(t=>t.trapId===trap.id).length,trap.motif.cells.length)
  for(const t of plan.filter(t=>t.layer==='water-detail')) assert.equal(g.grid.cells[t.y/16*g.grid.columns+t.x/16].kind,'water')
})
