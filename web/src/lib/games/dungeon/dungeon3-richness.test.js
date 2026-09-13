import test from 'node:test'
import assert from 'node:assert/strict'
import { generateDungeonGeometry } from './map-generator.js'
import { buildDungeon3TilePlan } from './dungeon3-renderer.js'
import { activeTrapAt } from './dungeon3-hazards.js'

test('every dungeon reserves themed rooms, a complete fire statue, coffin groups and continuous spike banks', () => {
  for(let seed=1;seed<=30;seed++) {
    const g=generateDungeonGeometry({runSeed:seed})
    assert.ok(new Set(g.rooms.map(r=>r.theme)).size>=4,`seed ${seed}: room themes`)
    const statues=g.decorations.filter(d=>d.kind==='statue')
    assert.ok(statues.some(s=>s.motif?.width===5&&s.motif?.height===5&&s.motif.cells.length===25),`seed ${seed}: incomplete statue`)
    assert.ok(g.decorations.filter(d=>d.kind==='coffin').length>=4,`seed ${seed}: sparse coffins`)
    const banks=g.traps.filter(t=>t.kind==='spikes')
    assert.ok(banks.length>=2,`seed ${seed}: missing spike banks`)
    for(const bank of banks) assert.ok(bank.motif.width>=4&&bank.motif.cells.length===bank.motif.width)
    assert.ok(g.waterFeatures.length>=6,`seed ${seed}: empty water`)
    assert.ok(new Set(g.waterFeatures.map(f=>f.motif.id)).size>=3,`seed ${seed}: uniform water`)
    assert.ok(g.rooms.some(r=>r.inlets?.length),`seed ${seed}: rectangular shorelines only`)
    for(const p of g.criticalPath) assert.equal(activeTrapAt(p,g,1100),null,`seed ${seed}: compulsory damage on main route`)
  }
})

test('the rendered assets contain full statues, coffin groups, connected plate paths and spike rows', () => {
  const g=generateDungeonGeometry({runSeed:33}),plan=buildDungeon3TilePlan(g)
  const statue=g.decorations.find(d=>d.kind==='statue')
  assert.equal(plan.filter(t=>t.ownerX===statue.x&&t.ownerY===statue.y&&t.tileset==='Statue_fire').length,25)
  assert.ok(plan.filter(t=>t.tileset==='coffins').length>=24)
  assert.ok(plan.filter(t=>t.tileset==='Spikes').length>=8)
  assert.ok(new Set(plan.filter(t=>t.layer==='path').map(t=>t.tileId)).size>=7)
  for(const t of plan.filter(t=>t.layer==='water-detail'||t.layer==='underwater-ruin')) assert.equal(g.grid.cells[t.y/16*g.grid.columns+t.x/16].kind,'water')
})
