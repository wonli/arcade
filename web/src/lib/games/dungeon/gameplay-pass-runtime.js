import { bossEncounterProfile, encounterVariantForFloor } from './encounter-profile.js'
import { createPerformanceBudget } from './performance-budget.js'

export function installDungeonGameplayPass(scene,{random=Math.random}={}){
  if(!scene||scene.__dungeonGameplayPass)return scene?.__dungeonGameplayPass??null
  const originalSpawn=scene.spawnEnemy?.bind(scene),originalBoss=scene.updateBoss?.bind(scene),originalProjectile=scene.fireEnemyProjectile?.bind(scene)
  const budget=createPerformanceBudget({cosmetics:24,projectiles:20})
  if(originalSpawn)scene.spawnEnemy=function gameplaySpawn(...args){const enemy=originalSpawn(...args);if(!enemy)return enemy;if(enemy.boss){enemy.encounter=bossEncounterProfile((scene.floor??1)+(scene.__runSeed??0));if(enemy.encounter.id==='stormcaller')enemy.tint=enemy.encounter.accent}else{enemy.encounter=encounterVariantForFloor(enemy.archetype,scene.floor??1,random());if(enemy.encounter.id==='charger')enemy.nextSpecialAt=Math.min(enemy.nextSpecialAt??Infinity,(scene.time?.now??0)+420);if(enemy.encounter.id==='bombardier')enemy.projectileCooldown=Math.max(720,Math.round((enemy.projectileCooldown||1400)*.82))}return enemy}
  if(originalProjectile)scene.fireEnemyProjectile=function budgetedProjectile(enemy){if((scene.enemyProjectiles?.length??0)>=20)return;return originalProjectile(enemy)}
  if(originalBoss)scene.updateBoss=function variedBoss(enemy,time,dt){if(enemy?.encounter?.id!=='stormcaller')return originalBoss(enemy,time,dt);if(enemy.hp/enemy.maxHp<=enemy.phaseThreshold&&enemy.phase===1){enemy.phase=2;enemy.visual?.setTint?.(enemy.encounter.accent)};scene.moveEnemyTowardPlayer?.(enemy,time,dt);if(time<(enemy.nextVariantAttackAt??0))return;enemy.nextVariantAttackAt=time+(enemy.phase===2?1050:1450);const burst=enemy.phase===2?5:3;for(let i=0;i<burst;i++){if(!budget.acquire('projectiles'))break;originalProjectile?.(enemy);budget.release('projectiles')} }
  const restore=()=>{if(originalSpawn)scene.spawnEnemy=originalSpawn;if(originalBoss)scene.updateBoss=originalBoss;if(originalProjectile)scene.fireEnemyProjectile=originalProjectile;scene.__dungeonGameplayPass=null}
  scene.events?.once?.('shutdown',restore);scene.events?.once?.('destroy',restore);const api={budget,restore};scene.__dungeonGameplayPass=api;return api
}
