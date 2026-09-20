import test from 'node:test'
import assert from 'node:assert/strict'
import { generateDungeonGeometry } from './map-generator.js'
import { buildDungeon3TilePlan } from './dungeon3-renderer.js'
import { dungeon3Rules as rules } from './dungeon3-rules.js'

test('source rules preserve complete wall doors, water ripples and both trap assemblies', () => {
  assert.ok(rules.motifs.doors.some(m => m.width === 2 && m.height === 3 && m.cells.length === 6))
  assert.equal(rules.assemblies.doorOpen?.cells?.length, 6)
  assert.ok(rules.assemblies.doorOpen.cells.some((cell, index) => cell.tileId !== rules.assemblies.door.cells[index].tileId))
  assert.ok(rules.assemblies.waterRipple.cells.every(c => rules.tilesets[c.tileset].animations[c.tileId]?.length > 1))
  assert.equal(rules.assemblies.wallTrap.height, 6)
  assert.equal(rules.assemblies.floorTrap.cells.length, 4)
  assert.equal(rules.assemblies.bridgeArch.width, 6)
  assert.ok(rules.assemblies.bridgeArch.cells.every(cell => cell.tileset === 'Arches_columns'))
})

test('connections distinguish same-level bridges from stair transitions; doors belong to walls', () => {
  const kinds = new Set()
  const levels = new Set()
  let archCount = 0, flatCount = 0
  for (let seed = 1; seed <= 30; seed++) {
    const g = generateDungeonGeometry({runSeed:seed})
    for (const room of g.rooms) levels.add(room.level)
    for (const path of g.paths) {
      const a = g.rooms[path.from], b = g.rooms[path.to]
      const delta = Math.abs(a.level - b.level)
      assert.equal(path.levelDelta, delta)
      assert.ok(['stairs', 'bridge', 'door', 'open'].includes(path.connectionKind))
      kinds.add(path.connectionKind)
      const stairs = g.stairs.filter(s => s.pathId === path.id)
      assert.equal(stairs.length, delta ? 1 : 0)
      if (delta) assert.equal(path.connectionKind, 'stairs')
      if (path.connectionKind === 'bridge') {
        assert.equal(delta, 0)
        assert.equal(path.crossesWater, true)
        const bridge = g.bridges.find(entry => entry.pathId === path.id)
        assert.ok(bridge)
        if (bridge.structure === 'arch') archCount++
        else flatCount++
        assert.equal(g.doors.some(door => door.pathId === path.id), false)
      }
      if (path.connectionKind === 'door') {
        assert.equal(delta, 0)
        assert.equal(path.crossesWater, false)
        assert.equal(g.doors.filter(door => door.pathId === path.id).length, 1)
      }
      if (path.connectionKind === 'stairs' || path.connectionKind === 'open') assert.equal(g.doors.some(door => door.pathId === path.id), false)
      for (const stair of stairs) {
        assert.ok(['down', 'up', 'left', 'right'].includes(stair.orientation))
        assert.equal(stair.highLevel - stair.lowLevel, 1)
      }
    }
    for (const door of g.doors) {
      assert.ok(g.walls.some(w => w.id === door.wallId))
      assert.equal(door.motif.height, 3)
      assert.ok(['down', 'up', 'left', 'right'].includes(door.orientation))
    }
    assert.ok(g.traps.some(t => t.kind === 'plate-trap'))
    assert.ok(g.traps.some(t => t.kind === 'wall-trap'))
    for (const trap of g.traps) for (const anchor of [g.spawn,g.exit,g.rest,...g.spawnPoints,...g.chests]) {
      const r=trap.damageArea
      assert.ok(anchor.x < r.x-24 || anchor.x > r.x+r.width+24 || anchor.y < r.y-24 || anchor.y > r.y+r.height+24)
    }
  }
  assert.ok(kinds.has('stairs'), `missing stairs across samples: ${[...kinds]}`)
  assert.ok(kinds.has('bridge'), `missing bridges across samples: ${[...kinds]}`)
  assert.ok(kinds.has('door'), `missing doors across samples: ${[...kinds]}`)
  assert.deepEqual([...levels].sort((a, b) => a - b), [0, 1, 2])
  assert.ok(archCount >= 1, 'missing arch bridge across samples')
  assert.ok(flatCount >= 1, 'missing flat bridge across samples')
})

test('render plan includes animated water, complete traps, bridge decks and elevation faces', () => {
  const g=generateDungeonGeometry({runSeed:33})
  const plan=buildDungeon3TilePlan(g)
  for(const layer of ['water-detail','underwater-ruin','bridge-deck','elevation-face','wall','floor-trap','wall-trap']) assert.ok(plan.some(t=>t.layer===layer),layer)
  const archGeometry = [33, 1, 7, 13, 21, 29].map(runSeed => generateDungeonGeometry({ runSeed }))
    .find(geometry => geometry.bridges.some(bridge => bridge.structure === 'arch'))
  assert.ok(archGeometry, 'fixed samples did not produce an arch bridge')
  const archPlan = buildDungeon3TilePlan(archGeometry)
  assert.ok(archPlan.some(tile => tile.layer === 'bridge-structure'))
  for (const tile of archPlan.filter(t => t.layer === 'bridge-structure')) assert.equal(tile.tileset, 'Arches_columns')
  for (const stair of archGeometry.stairs) assert.equal(archPlan.some(tile => tile.layer === 'bridge-structure' && tile.pathId === stair.pathId), false)
  for(const trap of g.traps) assert.equal(plan.filter(t=>t.trapId===trap.id).length,trap.motif.cells.length)
  for(const t of plan.filter(t=>t.layer==='water-detail')) assert.equal(g.grid.cells[t.y/16*g.grid.columns+t.x/16].kind,'water')
})

test('opened doors keep an authored open-door frame instead of becoming empty space', () => {
  const g = generateDungeonGeometry({ runSeed: 33 })
  const door = g.doors[0]
  const closed = buildDungeon3TilePlan(g).filter(tile => tile.featureKind === 'door' && tile.wallId === door.wallId)
  door.opened = true
  const opened = buildDungeon3TilePlan(g).filter(tile => tile.featureKind === 'door' && tile.wallId === door.wallId)
  assert.equal(opened.length, closed.length)
  assert.deepEqual(opened.map(tile => tile.tileId), rules.assemblies.doorOpen.cells.map(cell => cell.tileId))
})

test('doors sit on the room boundary with a narrow visual opening and a full traversal throat', () => {
  const orientations = { north: 'down', south: 'down', west: 'right', east: 'left' }
  const seenSides = new Set()
  for (let seed = 1; seed <= 40; seed++) {
    const g = generateDungeonGeometry({ runSeed: seed })
    for (const door of g.doors) {
      const room = g.rooms[door.roomId]
      const wall = g.walls.find(entry => entry.id === door.wallId)
      assert.ok(room && wall)
      assert.equal(door.orientation, orientations[door.side])
      seenSides.add(door.side)
      if (wall.orientation === 'horizontal') {
        assert.equal(door.x, room.center.x)
        assert.equal(door.y, door.side === 'north' ? room.y : room.y + room.height)
        assert.equal(wall.opening.width, 32)
        assert.equal(wall.passage.width, 96)
        assert.equal(door.collision.width, 96)
        assert.equal(door.collision.height, 16)
        assert.equal(door.collision.x, door.x - 48)
      } else {
        assert.equal(door.x, door.side === 'west' ? room.x : room.x + room.width)
        assert.equal(door.y, room.center.y)
        assert.equal(wall.opening.height, 32)
        assert.equal(wall.passage.height, 96)
        assert.equal(door.collision.width, 16)
        assert.equal(door.collision.height, 96)
        assert.equal(door.collision.y, door.y - 48)
      }
    }
  }
  assert.ok(seenSides.size >= 2, `expected doors on several wall sides, saw ${[...seenSides]}`)
})
