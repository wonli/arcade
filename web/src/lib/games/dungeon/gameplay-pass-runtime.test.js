import test from 'node:test'
import assert from 'node:assert/strict'
import { installDungeonGameplayPass } from './gameplay-pass-runtime.js'

test('runtime annotates encounter variants and keeps original spawn result',()=>{const enemy={archetype:'fast',boss:false};const scene={floor:4,spawnEnemy(){return enemy},events:{once(){}}};const runtime=installDungeonGameplayPass(scene,{random:()=>0});const result=scene.spawnEnemy(0);assert.equal(result,enemy);assert.equal(enemy.encounter.id,'charger');runtime.restore()})

test('stormcaller uses existing projectile primitive and never mutates player hp directly',()=>{let shots=0;const enemy={boss:true,hp:100,maxHp:100,x:0,y:0,encounter:{id:'stormcaller'},nextVariantAttackAt:0};const scene={playerState:{hp:100,x:100,y:0},time:{now:1000,delayedCall(_ms,fn){fn()}},fireEnemyProjectile(){shots++},moveEnemyTowardPlayer(){},updateBoss(){throw new Error('warden path should not run')},events:{once(){}}};installDungeonGameplayPass(scene,{random:()=>0});scene.updateBoss(enemy,1000,.016);assert.ok(shots>=1);assert.equal(scene.playerState.hp,100)})
