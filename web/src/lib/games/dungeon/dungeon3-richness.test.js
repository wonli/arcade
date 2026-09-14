import test from 'node:test'
import assert from 'node:assert/strict'
import { generateDungeonGeometry } from './map-generator.js'
import { buildDungeon3TilePlan } from './dungeon3-renderer.js'
import { activeTrapAt } from './dungeon3-hazards.js'
import { buildNavGrid, findPath } from './pathfinding.js'
import { circleHitsSolid } from './spatial.js'

test('themed room density varies across seeds while complete motifs and safe routes remain intact', () => {
  const coffinCounts = new Set()
  const spikeCounts = new Set()
  const inletCounts = new Set()
  const shrinePathHeights = new Set()

  for(let seed=1;seed<=120;seed++) {
    const g=generateDungeonGeometry({runSeed:seed})
    assert.ok(new Set(g.rooms.map(r=>r.theme)).size>=4,`seed ${seed}: room themes`)
    assert.equal(g.decorations.filter(d=>d.kind==='statue').length,0,`seed ${seed}: ordinary room contains Statue_fire`)

    const crypts=g.rooms.filter(room=>room.theme==='crypt')
    assert.ok(crypts.length>=1,`seed ${seed}: missing crypt`)
    for(const crypt of crypts) {
      const count=g.decorations.filter(d=>d.roomId===crypt.id&&d.kind==='coffin').length
      assert.ok(count>=1&&count<=4,`seed ${seed}: crypt coffin count ${count}`)
      coffinCounts.add(count)
    }

    const gauntlet=g.rooms.find(room=>room.theme==='gauntlet')
    const banks=g.traps.filter(t=>t.roomId===gauntlet.id&&t.kind==='spikes')
    assert.ok(banks.length>=1&&banks.length<=3,`seed ${seed}: spike bank count ${banks.length}`)
    spikeCounts.add(banks.length)
    for(const bank of banks) assert.ok(bank.motif.width>=4&&bank.motif.cells.length===bank.motif.width)

    const flooded=g.rooms.find(room=>room.theme==='flooded')
    assert.ok((flooded.inlets?.length??0)>=2&&(flooded.inlets?.length??0)<=4,`seed ${seed}: flooded inlet count ${flooded.inlets?.length??0}`)
    inletCounts.add(flooded.inlets.length)

    const shrine=g.rooms.find(room=>room.theme==='shrine')
    const processional=g.pavingAreas.find(a=>a.roomId===shrine.id&&a.kind==='processional')
    assert.ok(processional,`seed ${seed}: missing shrine path`)
    assert.ok(processional.height>=64&&processional.height<=128,`seed ${seed}: shrine path height ${processional.height}`)
    shrinePathHeights.add(processional.height)

    assert.ok(g.waterFeatures.length>=6,`seed ${seed}: empty water`)
    assert.ok(new Set(g.waterFeatures.map(f=>f.motif.id)).size>=3,`seed ${seed}: uniform water`)
    for(const p of g.criticalPath) assert.equal(activeTrapAt(p,g,1100),null,`seed ${seed}: compulsory damage on main route`)
  }

  assert.ok(coffinCounts.size>1,'crypt density never varies')
  assert.ok(spikeCounts.size>1,'gauntlet density never varies')
  assert.ok(inletCounts.size>1,'flooded shoreline never varies')
  assert.ok(shrinePathHeights.size>1,'shrine path length never varies')
})

test('room themes reserve hazard and safe-route footprints before loose dressing', () => {
  for (let seed=1;seed<=30;seed++) {
    const g=generateDungeonGeometry({runSeed:seed,floor:3})
    const shrine=g.rooms.find(room=>room.theme==='shrine')
    const crypt=g.rooms.find(room=>room.theme==='crypt')
    const gauntlet=g.rooms.find(room=>room.theme==='gauntlet')
    const flooded=g.rooms.find(room=>room.theme==='flooded')

    assert.equal(shrine.layout?.type,'altar',`seed ${seed}: shrine layout`)
    assert.equal(shrine.layout?.landmark,undefined,`seed ${seed}: ordinary shrine reserves a statue landmark`)
    assert.ok(shrine.layout.safeLane.width>=64,`seed ${seed}: shrine safe lane`)

    assert.equal(crypt.layout?.type,'burial',`seed ${seed}: crypt layout`)
    assert.ok(crypt.layout.safeLane.width>=80,`seed ${seed}: crypt aisle too narrow`)
    const coffins=g.decorations.filter(d=>d.roomId===crypt.id&&d.kind==='coffin')
    assert.ok(coffins.length>=1&&coffins.length<=4,`seed ${seed}: crypt density out of range`)

    assert.equal(gauntlet.layout?.type,'trap-corridor',`seed ${seed}: gauntlet layout`)
    assert.ok(gauntlet.layout.safeLane.width>=64,`seed ${seed}: gauntlet bypass too narrow`)
    const gauntletBanks=g.traps.filter(t=>t.roomId===gauntlet.id&&t.kind==='spikes')
    assert.ok(gauntletBanks.length>=1&&gauntletBanks.length<=3,`seed ${seed}: gauntlet density out of range`)

    assert.equal(flooded.layout?.type,'flood-basin',`seed ${seed}: flooded layout`)
    assert.ok((flooded.inlets?.length??0)>=2&&(flooded.inlets?.length??0)<=4,`seed ${seed}: flooded shoreline out of range`)

    const shrinePaving=g.pavingAreas.filter(a=>a.roomId===shrine.id&&a.kind==='processional')
    assert.ok(shrinePaving.some(a=>a.height>=64&&a.height<=128&&a.width>=48),`seed ${seed}: shrine path invalid`)
    for(const p of g.criticalPath) assert.equal(activeTrapAt(p,g,1100),null,`seed ${seed}: themed layout blocks the safe route`)
  }
})

test('crypt coffin groups never seal an east-west room connection for the largest actor', () => {
  for (let seed=1;seed<=400;seed++) {
    const g=generateDungeonGeometry({runSeed:seed,floor:1})
    const nav=buildNavGrid(g,{cellSize:16,actorRadius:26})
    for (const crypt of g.rooms.filter(room=>room.theme==='crypt')) {
      const horizontal=g.paths.some(path=>{
        if(path.from!==crypt.id&&path.to!==crypt.id) return false
        const other=g.rooms[path.from===crypt.id?path.to:path.from]
        return other.center.y===crypt.center.y
      })
      if(!horizontal) continue
      // Test actual connected shores. A closed outer bank 16px from water
      // cannot hold a radius-26 actor and is not a room entrance.
      for(const path of g.paths) {
        const other=path.from===crypt.id?g.rooms[path.to]:path.to===crypt.id?g.rooms[path.from]:null
        if(!other || other.center.y!==crypt.center.y) continue
        const entrance={x:other.center.x<crypt.center.x?crypt.x+16:crypt.x+crypt.width-16,y:crypt.center.y}
        assert.ok(findPath(nav,entrance,crypt.center).length,`seed ${seed}: crypt connection ${path.id} sealed`)
      }
    }
  }
})

test('visible east-west crypt paving stays walkable near coffin groups', () => {
  for (let seed=1;seed<=400;seed++) {
    const g=generateDungeonGeometry({runSeed:seed,floor:1})
    for (const crypt of g.rooms.filter(room=>room.theme==='crypt')) {
      const horizontal=g.paths.some(path=>{
        if(path.from!==crypt.id&&path.to!==crypt.id) return false
        const other=g.rooms[path.from===crypt.id?path.to:path.from]
        return other.center.y===crypt.center.y
      })
      if(!horizontal) continue
      for(const offsetY of [-16,0,16]) {
        for(let x=crypt.x+32;x<=crypt.x+crypt.width-32;x+=16) {
          assert.equal(circleHitsSolid({x,y:crypt.center.y+offsetY},20,g),false,
            `seed ${seed}: visible crypt lane blocked at ${x},${crypt.center.y+offsetY}`)
        }
      }
    }
  }
})

test('the rendered ordinary-map assets keep complete motifs at every randomized density', () => {
  for (const seed of [5,13,33,57,91]) {
    const g=generateDungeonGeometry({runSeed:seed}),plan=buildDungeon3TilePlan(g)
    assert.equal(plan.filter(t=>t.tileset==='Statue_fire').length,0,`seed ${seed}: ordinary map renders Statue_fire`)
    assert.ok(plan.filter(t=>t.tileset==='coffins').length>=6,`seed ${seed}: coffin motif cropped`)
    assert.ok(plan.filter(t=>t.tileset==='Spikes').length>=4,`seed ${seed}: spike motif cropped`)
    assert.ok(new Set(plan.filter(t=>t.layer==='path').map(t=>t.tileId)).size>=5,`seed ${seed}: path tiles lack connected variation`)
    for(const t of plan.filter(t=>t.layer==='water-detail'||t.layer==='underwater-ruin')) assert.equal(g.grid.cells[t.y/16*g.grid.columns+t.x/16].kind,'water')
  }
})
