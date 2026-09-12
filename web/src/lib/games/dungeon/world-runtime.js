import { bindLocalPlayerAliases } from './player-entity.js'
import { attackInterval, skillProfile, applyPickup } from './combat.js'

const clone = value => JSON.parse(JSON.stringify(value))
const enemyFields = ['id', 'x', 'y', 'hp', 'maxHp', 'archetype', 'elite', 'boss', 'scale', 'barOffset', 'tint', 'phase']

export function installDungeonWorld(scene, { host, multiplayer, sendState, sendCommand }) {
  let sequence = 0, received = -1, lastSend = -Infinity, nextID = 0, applying = false, stopped = false
  const originals = new Map()
  const wrap = (name, fn) => { const original = scene[name]?.bind(scene); originals.set(name, scene[name]); scene[name] = fn(original) }
  const identify = drop => (drop.netID ??= `drop-${++nextID}`)
  const asPlayer = (entity, fn) => {
    const local = scene.localPlayerEntity
    const contact = scene.lastContactAt
    scene.lastContactAt = entity.lastContactAt ?? -Infinity
    bindLocalPlayerAliases(scene, entity)
    try { return fn() } finally { entity.lastContactAt = scene.lastContactAt; scene.lastContactAt = contact; bindLocalPlayerAliases(scene, local) }
  }
  const snapshot = () => ({
    sequence: ++sequence, floor: scene.floor, floorCleared: scene.floorCleared, runComplete: scene.runComplete,
    enemies: scene.enemies.filter(e => e.hp > 0).map(e => Object.fromEntries(enemyFields.map(key => [key, e[key]]))),
    drops: scene.drops.map(d => ({ id: identify(d), x: d.x, y: d.y, item: clone(d.item) })),
    players: [...scene.players.values()].map(p => ({ id: p.id, state: clone(p.state) })),
    chests: (scene.__roomChests ?? []).map(c => ({ id: c.id, opened: c.opened })),
    portal: Boolean(scene.portal),
    projectiles: scene.enemyProjectiles.map(p => ({ x:p.x, y:p.y })),
  })
  const publish = () => { if (host && !stopped && !applying) sendState(snapshot()) }
  let eventQueued = false
  const publishEvent = () => {
    if (eventQueued) return
    eventQueued = true
    queueMicrotask(() => { eventQueued = false; publish() })
  }
  const command = (kind, extra = {}) => sendCommand({ kind, floor: scene.floor, ...extra })
  const api = {
    publish,
    receiveCommand(input) {
      if (!host || !input || input.floor !== scene.floor) return
      const player = multiplayer.remote
      if (!player || player.state.hp <= 0) return
      const now = scene.time.now
      asPlayer(player, () => {
        if (input.kind === 'attack') {
          const target = scene.enemies.find(e => e.id === input.target && e.hp > 0)
          if (!target || Math.hypot(target.x-player.state.x, target.y-player.state.y) > 165 || now < (player.nextAttack ?? 0)) return
          player.nextAttack = now + attackInterval(player.state, now)
          scene.slash(target)
        } else if (input.kind === 'skill') {
          if (now < (player.nextSkill ?? 0)) return
          const profile = skillProfile(player.state)
          player.nextSkill = now + profile.cooldown
          for (const enemy of [...scene.enemies]) if (enemy.hp > 0 && Math.hypot(enemy.x-player.state.x, enemy.y-player.state.y) <= profile.radius) scene.damageEnemy(enemy, Math.round(player.state.damage*1.6), true, 28)
        } else if (input.kind === 'pickup') {
          const drop = scene.drops.find(d => identify(d) === input.target)
          if (!drop || Math.hypot(drop.x-player.state.x, drop.y-player.state.y) > 34) return
          player.state = applyPickup(player.state, drop.item, player.state.baseStats)
          scene.destroyDrop(drop)
          scene.drops.splice(scene.drops.indexOf(drop), 1)
        } else if (input.kind === 'portal' && scene.portal && now >= scene.portal.unlockAt && Math.hypot(scene.portal.x-player.state.x, scene.portal.y-player.state.y) <= 38) {
          scene.advanceFloor()
        } else if (input.kind === 'chest') scene.__openNearestChest?.()
      })
      publish()
    },
    receiveState(state) {
      if (host || !state || !Number.isInteger(state.sequence) || state.sequence <= received) return false
      received = state.sequence
      applying = true
      try {
        const changedFloor = scene.floor !== state.floor
        if (changedFloor) { scene.floor = state.floor; scene.drawArena(); scene.destroyPortal() }
        scene.floorCleared = state.floorCleared
        const existing = new Map(scene.enemies.map(e => [e.id,e]))
        scene.enemies = state.enemies.map(data => {
          let enemy = existing.get(data.id)
          existing.delete(data.id)
          if (!enemy) {
            const visual = scene.makeActor(data.x, data.y, 'enemy', data.archetype).setDepth(data.elite ? 12 : 10)
            visual.setScale(visual.scaleX * data.scale, visual.scaleY * data.scale)
            if (data.tint) visual.setTint?.(data.tint)
            enemy = { ...data, visual, healthBar: scene.createHealthBar(data.x,data.y-data.barOffset,data.boss?150:36,5,0xff5964) }
          }
          const { x, y } = enemy
          Object.assign(enemy, data, { x, y, targetX: data.x, targetY: data.y })
          return enemy
        })
        for (const enemy of existing.values()) { scene.deathBurst?.(enemy.x,enemy.y); enemy.visual.destroy(); scene.destroyHealthBar(enemy.healthBar) }
        const drops = new Map(scene.drops.map(d => [d.netID,d]))
        for (const data of state.drops) {
          if (drops.has(data.id)) { drops.delete(data.id); continue }
          originals.get('spawnDrop').call(scene,data.x,data.y,data.item)
          scene.drops.at(-1).netID = data.id
        }
        for (const drop of drops.values()) { scene.destroyDrop(drop); scene.drops.splice(scene.drops.indexOf(drop),1) }
        for (const data of state.players) {
          const entity = scene.players.get(data.id)
          if (!entity) continue
          const {x,y} = entity.state
          Object.assign(entity.state,data.state)
          if (entity.local && !changedFloor) Object.assign(entity.state,{x,y})
        }
        for (const visual of scene.__worldProjectiles ?? []) visual.destroy()
        scene.__worldProjectiles = (state.projectiles ?? []).map(p => scene.add.circle(p.x,p.y,5,0xff9367).setDepth(18))
        for (const chest of scene.__roomChests ?? []) if (state.chests?.find(c=>c.id===chest.id)?.opened) { chest.opened = true; chest.visuals.lock?.setVisible(false) }
        if (state.portal && !scene.portal) originals.get('openPortal').call(scene)
        if (!state.portal) scene.destroyPortal()
        if (state.runComplete && !scene.runComplete) scene.completeRun()
        scene.emitStats()
        if (scene.playerState.hp <= 0 && !scene.dead) scene.gameOver()
      } finally { applying = false }
      return true
    },
  }
  if (host) {
    wrap('gameOver', original => () => { if (scene.localPlayerEntity === multiplayer.local) original() })
    for (const name of ['damageEnemy','killEnemy','spawnDrop','destroyDrop','openPortal','advanceFloor','completeRun','hitPlayer']) wrap(name, original => (...args) => { const result = original(...args); publishEvent(); return result })
    const advance = scene.advanceFloor
    scene.advanceFloor = (...args) => {
      const floor = scene.floor
      advance(...args)
      if (scene.floor !== floor && scene.__roomGeometry?.spawn) {
        for (const player of scene.players.values()) {
          Object.assign(player.state, scene.__roomGeometry.spawn)
          player.targetX = player.state.x; player.targetY = player.state.y
        }
      }
    }
    wrap('updateEnemyProjectiles', original => dt => {
      const remote = multiplayer.remote
      if (remote?.state.hp > 0) {
        for (const projectile of scene.enemyProjectiles) {
          if (Math.hypot(projectile.x-remote.state.x,projectile.y-remote.state.y) <= 20) {
            asPlayer(remote, () => scene.hitPlayer(projectile.damage))
            projectile.life = 0
          }
        }
      }
      original(dt)
    })
    for (const name of ['moveEnemyTowardPlayer','updateRangedEnemy','updateBoss']) wrap(name, original => (enemy,...args) => {
      const players = [...scene.players.values()].filter(p=>p.state.hp>0)
      players.sort((a,b)=>Math.hypot(a.state.x-enemy.x,a.state.y-enemy.y)-Math.hypot(b.state.x-enemy.x,b.state.y-enemy.y))
      return players[0] ? asPlayer(players[0],()=>original(enemy,...args)) : undefined
    })
  } else {
    scene.clearEnemies(); scene.clearEnemyProjectiles(); scene.clearDrops()
    for (const name of ['spawnEnemy','damageEnemy','killEnemy','checkFloorClear','spawnDrop','openPortal','updateEnemyProjectiles','hitPlayer']) wrap(name, () => () => {})
    wrap('updateEnemies', () => (_time,dt) => {
      const alpha = 1-Math.exp(-12*dt)
      for (const e of scene.enemies) { e.x+=(e.targetX-e.x)*alpha; e.y+=(e.targetY-e.y)*alpha; e.visual.setPosition(e.x,e.y); scene.updateHealthBar(e.healthBar,e.x,e.y-e.barOffset,e.hp,e.maxHp) }
    })
    wrap('slash', () => target => { scene.__dungeonVfx?.slash?.(scene.playerState,target,false); command('attack',{target:target.id}) })
    wrap('trySkill', () => () => {
      if (scene.keys.SPACE.isDown && !scene.__worldSkillDown) command('skill')
      scene.__worldSkillDown = scene.keys.SPACE.isDown
    })
    let nextPickup = 0
    wrap('updateDrops', () => () => {
      if (scene.time.now < nextPickup) return
      const drop = scene.drops.find(d=>Math.hypot(d.x-scene.playerState.x,d.y-scene.playerState.y)<=34)
      if (drop) { nextPickup=scene.time.now+300; command('pickup',{target:drop.netID}) }
    })
    wrap('advanceFloor', () => () => command('portal'))
  }
  scene.__worldChestRequest = host ? null : () => command('chest')
  const update = time => { if (time-lastSend >= 300) { lastSend=time; publish() } }
  scene.events.on('update',update)
  scene.events.once('shutdown',()=>{ stopped=true; scene.events.off('update',update); for (const [key,value] of originals) scene[key]=value; delete scene.__worldChestRequest })
  return api
}
