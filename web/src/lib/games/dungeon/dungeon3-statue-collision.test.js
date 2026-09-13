import test from 'node:test'
import assert from 'node:assert/strict'
import { dressThemedRooms } from './dungeon3-dressing.js'
import { circleHitsSolid, movementWithCollision } from './spatial.js'

test('statue leaves its transparent flanks and foreground walkable while its foot remains solid', () => {
  const room = {id:'shrine',theme:'shrine',x:100,y:100,width:256,height:160,center:{x:228,y:180}}
  const g = {rooms:[room],paths:[],decorations:[],solids:[],pavingAreas:[],water:[],bridges:[]}
  dressThemedRooms(g,()=>0.5)
  const {x:left,y:top} = room.layout.landmark
  for (const x of [left+12,left+68]) {
    const from = {x,y:top+104}
    const expected = {x,y:top+64}
    assert.deepEqual(movementWithCollision(from,{x:0,y:-40},18,g),expected,
      'transparent floor beside the narrow statue base must be reachable')
  }
  const from = {x:left-8,y:top+96}
  const crossed = movementWithCollision(from,{x:96,y:0},18,g)
  assert.ok(Math.abs(crossed.x-(left+88))<1e-6 && crossed.y===top+96,
    'a player must be able to cross the floor immediately in front of the statue')
  assert.equal(circleHitsSolid({x:left+40,y:top+73},18,g),true,
    'the visible stone foot must still block the player')
  assert.deepEqual(g.decorations[0].footprint,{width:80,height:80},
    'collision calibration must preserve the full TMX assembly')
})
