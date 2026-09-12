import test from 'node:test'
import assert from 'node:assert/strict'
import { installDungeonWorld } from './world-runtime.js'

const visual = () => ({scaleX:1,scaleY:1,setDepth(){return this},setScale(){return this},setPosition(){},destroy(){}})
function scene() {
  const listeners = {}
  const s = { floor:1, enemies:[], drops:[], enemyProjectiles:[], players:new Map(), time:{now:0}, keys:{SPACE:{}},
    events:{ on(k,fn){listeners[k]=fn},once(){},off(){} }, listeners,
    makeActor:visual,createHealthBar:()=>({}),destroyHealthBar(){},updateHealthBar(){},emitStats(){},
    add:{circle:visual},playerState:{hp:100},drawArena(){},destroyPortal(){},deathBurst(){},
  }
  for(const name of ['damageEnemy','killEnemy','spawnDrop','destroyDrop','openPortal','advanceFloor','completeRun','hitPlayer','gameOver','moveEnemyTowardPlayer','updateRangedEnemy','updateBoss','updateEnemyProjectiles','spawnEnemy','checkFloorClear','updateEnemies','slash','trySkill','updateDrops']) s[name]=()=>{}
  s.clearEnemies=()=>{s.enemies=[]};s.clearDrops=()=>{s.drops=[]};s.clearEnemyProjectiles=()=>{s.enemyProjectiles=[]}
  return s
}
test('host publishes every 300ms and damage publishes immediately after mutation', async()=>{
  const s=scene(), messages=[]
  s.enemies=[{id:'a',x:1,y:2,hp:10,maxHp:10}]
  s.damageEnemy=e=>{e.hp=5}
  installDungeonWorld(s,{host:true,multiplayer:{},sendState:x=>messages.push(x)})
  s.listeners.update(0);s.listeners.update(299)
  assert.equal(messages.length,1)
  s.listeners.update(300);assert.equal(messages.length,2)
  s.damageEnemy(s.enemies[0]);await Promise.resolve()
  assert.equal(messages.length,3);assert.equal(messages[2].enemies[0].hp,5)
})
test('guest replaces local enemies, ignores stale snapshots and interpolates host positions',()=>{
  const s=scene();s.enemies=[{id:'local'}]
  const api=installDungeonWorld(s,{host:false,multiplayer:{},sendCommand(){}})
  assert.equal(s.enemies.length,0)
  const state={sequence:1,floor:1,enemies:[{id:'host',x:10,y:20,hp:10,maxHp:10,scale:1,barOffset:28}],drops:[],players:[]}
  assert.equal(api.receiveState(state),true)
  api.receiveState({...state,sequence:2,enemies:[{...state.enemies[0],x:100}]})
  assert.equal(api.receiveState(state),false)
  s.updateEnemies(0,0.016)
  assert.ok(s.enemies[0].x>10 && s.enemies[0].x<100)
  api.receiveState({...state,sequence:3,enemies:[]});assert.equal(s.enemies.length,0)
})
test('host validates guest attack floor, distance and cooldown',()=>{
  const s=scene(), local={id:'p1',state:{x:0,y:0,hp:100}}, remote={id:'p2',state:{x:10,y:10,hp:100}}
  s.localPlayerEntity=local;s.players=new Map([['p1',local],['p2',remote]])
  s.enemies=[{id:'a',x:20,y:20,hp:10}]
  let hits=0;s.slash=()=>hits++
  const api=installDungeonWorld(s,{host:true,multiplayer:{local,remote},sendState(){}})
  api.receiveCommand({kind:'attack',floor:2,target:'a'});assert.equal(hits,0)
  api.receiveCommand({kind:'attack',floor:1,target:'a'});assert.equal(hits,1)
  api.receiveCommand({kind:'attack',floor:1,target:'a'});assert.equal(hits,1)
  s.time.now=1000;remote.state.x=900
  api.receiveCommand({kind:'attack',floor:1,target:'a'});assert.equal(hits,1)
  assert.equal(s.localPlayerEntity,local)
})
