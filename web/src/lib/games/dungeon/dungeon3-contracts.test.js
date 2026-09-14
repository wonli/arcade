import test from 'node:test'
import assert from 'node:assert/strict'
import { generateDungeonGeometry } from './map-generator.js'
import { activeTrapAt } from './dungeon3-hazards.js'

const at=(g,x,y)=>g.grid.cells[Math.floor(y/16)*g.grid.columns+Math.floor(x/16)]
test('final shoreline never submerges floor traps or wall flame lanes',()=>{
  for(let seed=1;seed<=35;seed++) {
    const g=generateDungeonGeometry({runSeed:seed})
    for(const t of g.traps) {
      const a=t.damageArea
      for(let y=a.y;y<a.y+a.height;y+=16)for(let x=a.x;x<a.x+a.width;x+=16)assert.notEqual(at(g,x,y)?.kind,'water',`seed ${seed}: ${t.id} over water at ${x},${y}`)
    }
    assert.ok(g.traps.some(t=>t.kind==='plate-trap'))
    assert.ok(g.traps.some(t=>t.kind==='wall-trap'))
    for(let time=0;time<3900;time+=150)for(const p of g.criticalPath)assert.equal(activeTrapAt(p,g,time),null,`seed ${seed}: critical route hazard at ${time}`)
  }
})
test('bridge metadata represents actual water crossings, while dry level changes remain stairs',()=>{
  for(let seed=1;seed<=25;seed++) {
    const g=generateDungeonGeometry({runSeed:seed})
    for(const b of g.bridges) {
      let deck=0
      for(let y=b.y;y<b.y+b.height;y+=16)for(let x=b.x;x<b.x+b.width;x+=16)deck+=at(g,x,y)?.kind==='bridge'?1:0
      assert.ok(deck>0,`seed ${seed}: phantom bridge on path ${b.pathId}`)
    }
    assert.ok(g.stairs.length>0)
  }
})

test('final validation rejects later solids or hazards inside declared safe lanes',async()=>{
  const {layoutContractViolations}=await import('./dungeon3-layout-validation.js')
  const g=generateDungeonGeometry({runSeed:13})
  assert.deepEqual(layoutContractViolations(g),[])
  const room=g.rooms.find(r=>r.theme==='shrine')
  const x=room.center.x,y=room.center.y
  const blocked={...g,solids:[...g.solids,{x:x-8,y:y-8,width:16,height:16,kind:'prop'}]}
  assert.ok(layoutContractViolations(blocked).some(v=>v.kind==='safe-lane-blocked'))
  const trapped={...g,traps:[...g.traps,{id:'late-hazard',damageArea:{x:x-8,y:y-8,width:16,height:16}}]}
  assert.ok(layoutContractViolations(trapped).some(v=>v.kind==='safe-lane-hazard'))
})
