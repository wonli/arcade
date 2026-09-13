import test from 'node:test'
import assert from 'node:assert/strict'
import { generateDungeonGeometry } from './map-generator.js'
import { buildDungeon3TilePlan } from './dungeon3-renderer.js'
import { activeTrapAt } from './dungeon3-hazards.js'
import { buildNavGrid, findPath } from './pathfinding.js'

test('every dungeon reserves themed rooms, a complete fire statue, coffin groups and continuous spike banks', () => {
  for(let seed=1;seed<=30;seed++) {
    const g=generateDungeonGeometry({runSeed:seed})
    assert.ok(new Set(g.rooms.map(r=>r.theme)).size>=4,`seed ${seed}: room themes`)
    const statues=g.decorations.filter(d=>d.kind==='statue')
    assert.ok(statues.some(s=>s.motif?.width===5&&s.motif?.height===5&&s.motif.cells.length===25),`seed ${seed}: incomplete statue`)
    assert.ok(g.decorations.filter(d=>d.kind==='coffin').length>=4,`seed ${seed}: sparse coffins`)
    const banks=g.traps.filter(t=>t.kind==='spikes')
    assert.ok(banks.length>=3,`seed ${seed}: missing spike bank array`)
    for(const bank of banks) assert.ok(bank.motif.width>=4&&bank.motif.cells.length===bank.motif.width)
    assert.ok(g.waterFeatures.length>=6,`seed ${seed}: empty water`)
    assert.ok(new Set(g.waterFeatures.map(f=>f.motif.id)).size>=3,`seed ${seed}: uniform water`)
    assert.ok(g.rooms.some(r=>(r.inlets?.length??0)>=3),`seed ${seed}: rectangular shorelines only`)
    for(const p of g.criticalPath) assert.equal(activeTrapAt(p,g,1100),null,`seed ${seed}: compulsory damage on main route`)
  }
})

test('room themes reserve landmark, hazard and safe-route footprints before loose dressing', () => {
  for (let seed=1;seed<=30;seed++) {
    const g=generateDungeonGeometry({runSeed:seed,floor:3})
    const shrine=g.rooms.find(room=>room.theme==='shrine')
    const crypt=g.rooms.find(room=>room.theme==='crypt')
    const gauntlet=g.rooms.find(room=>room.theme==='gauntlet')
    const flooded=g.rooms.find(room=>room.theme==='flooded')

    assert.equal(shrine.layout?.type,'altar',`seed ${seed}: shrine layout`)
    assert.deepEqual([shrine.layout.landmark.width,shrine.layout.landmark.height],[80,80],`seed ${seed}: statue reservation`)
    assert.ok(shrine.layout.safeLane.width>=64,`seed ${seed}: shrine safe lane`)

    assert.equal(crypt.layout?.type,'burial',`seed ${seed}: crypt layout`)
    assert.ok(crypt.layout.safeLane.width>=80,`seed ${seed}: crypt aisle too narrow`)
    assert.ok(g.decorations.filter(d=>d.roomId===crypt.id&&d.kind==='coffin').length>=4,`seed ${seed}: crypt lacks a coffin composition`)

    assert.equal(gauntlet.layout?.type,'trap-corridor',`seed ${seed}: gauntlet layout`)
    assert.ok(gauntlet.layout.safeLane.width>=64,`seed ${seed}: gauntlet bypass too narrow`)
    const gauntletBanks=g.traps.filter(t=>t.roomId===gauntlet.id&&t.kind==='spikes')
    assert.ok(gauntletBanks.length>=3,`seed ${seed}: gauntlet lacks a continuous trap array`)

    assert.equal(flooded.layout?.type,'flood-basin',`seed ${seed}: flooded layout`)
    assert.ok((flooded.inlets?.length??0)>=3,`seed ${seed}: flooded room shoreline lacks variation`)

    const shrinePaving=g.pavingAreas.filter(a=>a.roomId===shrine.id&&a.kind==='processional')
    assert.ok(shrinePaving.some(a=>a.height>=96&&a.width>=48),`seed ${seed}: shrine path is still a small paving patch`)
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
      const left={x:crypt.x+16,y:crypt.center.y}
      const right={x:crypt.x+crypt.width-16,y:crypt.center.y}
      assert.ok(findPath(nav,left,crypt.center).length,`seed ${seed}: crypt west side sealed`)
      assert.ok(findPath(nav,crypt.center,right).length,`seed ${seed}: crypt east side sealed`)
    }
  }
})

test('the rendered assets contain full statues, coffin groups, connected plate paths and spike rows', () => {
  const g=generateDungeonGeometry({runSeed:33}),plan=buildDungeon3TilePlan(g)
  const statue=g.decorations.find(d=>d.kind==='statue')
  assert.equal(plan.filter(t=>t.ownerX===statue.x&&t.ownerY===statue.y&&t.tileset==='Statue_fire').length,25)
  assert.ok(plan.filter(t=>t.tileset==='coffins').length>=24)
  assert.ok(plan.filter(t=>t.tileset==='Spikes').length>=12)
  assert.ok(new Set(plan.filter(t=>t.layer==='path').map(t=>t.tileId)).size>=7)
  for(const t of plan.filter(t=>t.layer==='water-detail'||t.layer==='underwater-ruin')) assert.equal(g.grid.cells[t.y/16*g.grid.columns+t.x/16].kind,'water')
})
