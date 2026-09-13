import test from 'node:test'
import assert from 'node:assert/strict'
import { dressThemedRooms } from './dungeon3-dressing.js'
import { generateDungeonGeometry } from './map-generator.js'
import { buildNavGrid, findPath } from './pathfinding.js'
import { circleHitsSolid, movementWithCollision } from './spatial.js'

const TILE=16
const PLAYER_RADIUS=18

test('statue pixel collision follows the visible stone foot', () => {
  const room={id:'shrine',theme:'shrine',x:100,y:100,width:256,height:160,center:{x:228,y:180}}
  const g={rooms:[room],paths:[],decorations:[],solids:[],pavingAreas:[],water:[],bridges:[]}
  dressThemedRooms(g,()=>0.5)
  const {x:left,y:top}=room.layout.landmark
  const from={x:left-8,y:top+96}
  const crossed=movementWithCollision(from,{x:96,y:0},PLAYER_RADIUS,g)
  assert.ok(Math.abs(crossed.x-(left+88))<1e-6&&crossed.y===top+96,
    'transparent foreground must not inherit the full 5x5 visual footprint')
  assert.equal(circleHitsSolid({x:left+40,y:top+73},PLAYER_RADIUS,g),true,
    'the visible stone foot must still block the player')
  assert.deepEqual(g.decorations[0].footprint,{width:80,height:80},
    'collision calibration must preserve the complete TMX assembly')
})

test('generated shrines leave practical player clearance beside Statue_fire',()=>{
  for(let seed=1;seed<=80;seed++) for(let floor=1;floor<=3;floor++) {
    const g=generateDungeonGeometry({runSeed:seed,floor})
    const room=g.rooms.find(r=>r.theme==='shrine')
    const statue=g.decorations.find(d=>d.roomId===room.id&&d.kind==='statue')
    assert.ok(statue,`seed ${seed}/${floor}: missing statue`)
    const top=statue.y-statue.footprint.height/2
    const nav=buildNavGrid(g,{cellSize:TILE,actorRadius:PLAYER_RADIUS})

    // A single mathematically valid slit is not enough for joystick movement.
    // Require two adjacent 16px player-center columns between the west edge and
    // the statue's grounded foot, and prove both connect back to the room core.
    for(const x of [room.x+24,room.x+40]) {
      const point={x,y:top+73}
      assert.equal(circleHitsSolid(point,PLAYER_RADIUS,g),false,
        `seed ${seed}/${floor}: statue flank choke at ${point.x},${point.y}`)
      assert.ok(findPath(nav,room.center,point).length,
        `seed ${seed}/${floor}: statue flank unreachable at ${point.x},${point.y}`)
    }

    // Sample the broad visible foreground separately from terrace lips. Points
    // that are intrinsically occupied by another authored boundary are skipped;
    // every physically open sample must remain connected to the shrine core.
    for(const point of [
      {x:room.x+40,y:top+96},
      {x:room.x+56,y:top+96},
      {x:room.x+72,y:top+96},
    ]) {
      if(circleHitsSolid(point,PLAYER_RADIUS,g)) continue
      assert.ok(findPath(nav,room.center,point).length,
        `seed ${seed}/${floor}: statue foreground isolated at ${point.x},${point.y}`)
    }
  }
})
