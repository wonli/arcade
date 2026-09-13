import test from 'node:test'
import assert from 'node:assert/strict'
import { dungeon3Rules as rules } from './dungeon3-rules.js'
import { activeTrapAt } from './dungeon3-hazards.js'

test('wall flames hurt only on visible flame cells, never behind or beside the emitter', () => {
  const trap={kind:'wall-trap',x:116,y:148,motif:rules.assemblies.wallTrap,damageArea:{x:100,y:132,width:32,height:64}}
  const geometry={traps:[trap]}
  assert.equal(activeTrapAt({x:116,y:140},geometry,0),null)
  assert.equal(activeTrapAt({x:116,y:140},geometry,1050),trap)
  assert.equal(activeTrapAt({x:80,y:140},geometry,1050),null)
  assert.equal(activeTrapAt({x:116,y:110},geometry,1050),null)
  assert.equal(activeTrapAt({x:116,y:188},geometry,1050),null)
})
test('floor traps use their full footprint and the animated damaging phase', () => {
  const trap={kind:'plate-trap',x:116,y:116,motif:rules.assemblies.floorTrap,damageArea:{x:100,y:100,width:32,height:32}}
  assert.equal(activeTrapAt({x:101,y:101},{traps:[trap]},0),null)
  assert.equal(activeTrapAt({x:101,y:101},{traps:[trap]},1100),trap)
  assert.equal(activeTrapAt({x:140,y:116},{traps:[trap]},1100),null)
})
