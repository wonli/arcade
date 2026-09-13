const BASE={skeleton:{id:'skeleton',behavior:'pressure'},fast:{id:'fast',behavior:'dash'},brute:{id:'brute',behavior:'slam'},ranged:{id:'ranged',behavior:'kite'}}
export function encounterProfile(archetype='skeleton',{variant=false}={}){if(variant&&archetype==='fast')return{id:'charger',base:'fast',behavior:'dash',telegraphMs:240,dashMultiplier:1.18};if(variant&&archetype==='ranged')return{id:'bombardier',base:'ranged',behavior:'bombard',telegraphMs:420,burst:3,spread:.16};return BASE[archetype]??BASE.skeleton}
const BOSSES=[{id:'warden',style:'charge-shockwave',accent:0xff705c},{id:'stormcaller',style:'zone-projectile',accent:0x70f2ce,burst:5,repositionAfterMs:1800}]
export function bossEncounterProfile(seed=0){return BOSSES[Math.abs(Math.floor(seed))%BOSSES.length]}
export function encounterVariantForFloor(archetype,floor,roll=.5){return encounterProfile(archetype,{variant:floor>=3&&roll<.28&&(archetype==='fast'||archetype==='ranged')})}
