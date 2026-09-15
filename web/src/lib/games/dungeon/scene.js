import { placePlayerAtRoomSpawn, roomAnchor, safeEnemySpawn } from './room-anchors.js'
import { createDungeonAmbient } from './ambient.js'
import { attachLocalPlayerEntity } from './player-entity.js'
import { castPlayerSkill } from './player-skill-runtime.js'
import { currentEffects, currentWeapon } from './player-loadout.js'
import { currentEffects, currentWeapon } from './player-loadout.js'
import { currentEffects, currentWeapon } from './player-loadout.js'
import { currentEffects, currentWeapon } from './player-loadout.js'
import { currentEffects, currentWeapon } from './player-loadout.js'
import { currentEffects, currentWeapon } from './player-loadout.js'
import { currentEffects, currentWeapon } from './player-loadout.js'
import { currentEffects, currentWeapon } from './player-loadout.js'
import { currentEffects, currentWeapon } from './player-loadout.js'
import { currentEffects, currentWeapon } from './player-loadout.js'
import { currentEffects, currentWeapon } from './player-loadout.js'
import { currentEffects, currentWeapon } from './player-loadout.js'
import { affixSummary } from './affixes.js'
import {
  applyPickup,
  attackInterval,
  bossReward,
  enemyArchetype,
  floorWave,
  healFromHit,
  modifiedDamage,
  nearestTarget,
  rollDamage,
  rollEquipment,
  rollPotion,
  secondaryTarget,
} from './combat.js'

const WIDTH = 960
const HEIGHT = 600
const TILE = 48
const BASE_STATS = { damage: 10, critChance: 0.18, speed: 190, maxHp: 100 }

function normalizeAssets(manifest = {}) {
  if (Array.isArray(manifest.assets)) return manifest.assets
  if (Array.isArray(manifest.png)) return manifest.png.map((path) => ({ path, frames: 1, frameWidth: 0, frameHeight: 0 }))
  return []
}

function chooseAsset(assets, patterns, predicate = () => true) {
  for (const pattern of patterns) {
    const found = assets.find((asset) => predicate(asset) && pattern.test(asset.path))
    if (found) return found
  }
  return null
}

function chooseRpgAnimation(assets, direction, action) {
  return assets.find((asset) => asset.source === 'rpg-main-character' && asset.direction === direction && asset.action === action) || null
}

export function directionFromInput(dx, dy, current = 'down') {
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'left' : 'right'
  if (dy < 0) return 'up'
  if (dy > 0) return 'down'
  if (dx < 0) return 'left'
  if (dx > 0) return 'right'
  return current
}

export function rarityPresentation(rarity = 'common') {
  const styles = {
    common: { color: 0xf4f0e8, beamAlpha: 0.22, particles: 0 },
    uncommon: { color: 0x70ff9f, beamAlpha: 0.34, particles: 2 },
    rare: { color: 0x67a8ff, beamAlpha: 0.5, particles: 4 },
    epic: { color: 0xc984ff, beamAlpha: 0.68, particles: 7 },
  }
  return styles[rarity] || styles.common
}

export function floorOutcome(floor, livingEnemies) {
  if (livingEnemies > 0) return 'combat'
  return floor >= 5 ? 'complete' : 'portal'
}

export function roomLayoutForFloor(floor) {
  return ['pillars', 'cross', 'broken-hall'][(Math.max(1, Math.floor(floor || 1)) - 1) % 3]
}

export function weaponDropPresentation(item, formatter = (entry) => entry.id) {
  const affixes = affixSummary(item)
  const focus = affixes.find((entry) => entry.build) || affixes[0] || null
  return {
    affixes,
    build: Boolean(focus?.build),
    hint: focus ? `${focus.build ? '★ ' : ''}${formatter(focus)}` : '',
  }
}

function roomDescriptor(floor) {
  const name = roomLayoutForFloor(floor)
  if (name === 'cross') {
    return {
      name,
      pillars: [[WIDTH / 2 - 120, HEIGHT / 2], [WIDTH / 2 + 120, HEIGHT / 2]],
      blocks: [[WIDTH / 2, 132, 210, 18], [WIDTH / 2, HEIGHT - 132, 210, 18], [228, HEIGHT / 2, 18, 150], [WIDTH - 228, HEIGHT / 2, 18, 150]],
      torches: [[WIDTH / 2 - 170, 92], [WIDTH / 2 + 170, 92], [WIDTH / 2 - 170, HEIGHT - 92], [WIDTH / 2 + 170, HEIGHT - 92]],
      spawnPoints: [[120, 92], [WIDTH - 120, 92], [120, HEIGHT - 92], [WIDTH - 120, HEIGHT - 92], [WIDTH / 2, 82], [WIDTH / 2, HEIGHT - 82]],
    }
  }
  if (name === 'broken-hall') {
    return {
      name,
      pillars: [[188, 176], [WIDTH - 188, HEIGHT - 176], [WIDTH / 2 + 76, 164]],
      blocks: [[300, 260, 170, 18], [WIDTH - 280, 346, 190, 18], [WIDTH / 2, 454, 140, 18]],
      torches: [[112, 86], [WIDTH - 110, 122], [164, HEIGHT - 92], [WIDTH - 150, HEIGHT - 82]],
      spawnPoints: [[92, 110], [WIDTH - 92, 120], [110, HEIGHT - 94], [WIDTH - 110, HEIGHT - 108], [WIDTH / 2 + 170, 92], [WIDTH / 2 - 160, HEIGHT - 90]],
    }
  }
  return {
    name,
    pillars: [[144, 144], [WIDTH - 144, 144], [144, HEIGHT - 144], [WIDTH - 144, HEIGHT - 144]],
    blocks: [],
    torches: [[96, 72], [WIDTH - 96, 72], [96, HEIGHT - 72], [WIDTH - 96, HEIGHT - 72]],
    spawnPoints: [[90, 90], [WIDTH - 90, 90], [90, HEIGHT - 90], [WIDTH - 90, HEIGHT - 90], [WIDTH / 2, 80], [WIDTH / 2, HEIGHT - 80]],
  }
}

export function chooseDungeonAssets(manifest = {}) {
  const all = normalizeAssets(manifest)
  const rpgAssets = all.filter((asset) => asset.source === 'rpg-main-character')
  const oldAssets = all.filter((asset) => asset.source !== 'rpg-main-character')
  const hasRpgPlayer = rpgAssets.some((asset) => asset.action && asset.direction)
  const player = hasRpgPlayer ? {
    source: 'rpg-main-character',
    down: { idle: chooseRpgAnimation(all, 'down', 'idle'), walk: chooseRpgAnimation(all, 'down', 'walk'), attack: chooseRpgAnimation(all, 'down', 'attack') },
    up: { idle: chooseRpgAnimation(all, 'up', 'idle'), walk: chooseRpgAnimation(all, 'up', 'walk'), attack: chooseRpgAnimation(all, 'up', 'attack') },
    side: { idle: chooseRpgAnimation(all, 'side', 'idle'), walk: chooseRpgAnimation(all, 'side', 'walk'), attack: chooseRpgAnimation(all, 'side', 'attack') },
  } : chooseAsset(oldAssets, [/wizard/i, /hero/i, /player/i, /knight/i, /character/i])

  const genericEnemy = chooseAsset(oldAssets, [/skeleton/i, /slime/i, /blob/i, /goblin/i, /bat/i, /rat/i, /dragon/i, /creature/i, /monster/i])
  const enemies = {
    skeleton: chooseAsset(oldAssets, [/skeleton/i, /skull/i, /goblin/i]) || genericEnemy,
    fast: chooseAsset(oldAssets, [/bat/i, /rat/i, /slime/i, /blob/i]) || genericEnemy,
    brute: chooseAsset(oldAssets, [/dragon/i, /ogre/i, /brute/i, /golem/i, /monster/i, /goblin/i]) || genericEnemy,
    ranged: chooseAsset(oldAssets, [/wizard/i, /mage/i, /caster/i, /archer/i, /bow/i]) || genericEnemy,
  }

  return {
    player,
    enemy: enemies.skeleton || genericEnemy,
    enemies,
    floor: chooseAsset(oldAssets, [/floor/i, /ground/i, /brick/i, /stone/i, /tile/i], (asset) => asset.frames === 1),
    wall: chooseAsset(oldAssets, [/wall/i, /brick/i, /stone/i, /brimstone/i], (asset) => asset.frames === 1),
    weapon: chooseAsset(oldAssets, [/sword/i, /blade/i, /weapon/i, /axe/i, /staff/i, /bow/i, /item/i]),
  }
}

export function createDungeonGame({ Phaser, parent, assets = {}, labels = {}, onStats = () => {}, onEvent = () => {} }) {
  const text = {
    floor: (value) => typeof labels.floor === 'function' ? labels.floor(value) : `FLOOR ${value}`,
    floorClear: () => typeof labels.floorClear === 'function' ? labels.floorClear() : (labels.floorClear || 'FLOOR CLEAR'),
    runComplete: () => typeof labels.runComplete === 'function' ? labels.runComplete() : (labels.runComplete || 'DUNGEON CLEARED'),
    runCompleteHint: () => typeof labels.runCompleteHint === 'function' ? labels.runCompleteHint() : (labels.runCompleteHint || 'Five floors survived'),
    rarity: (rarity) => typeof labels.rarity === 'function' ? labels.rarity(rarity) : rarity.toUpperCase(),
    affix: (entry) => typeof labels.affix === 'function' ? labels.affix(entry.id, entry.value, entry.tier) : entry.id,
  }

  class DungeonScene extends Phaser.Scene {
    constructor() {
      super('Dungeon')
      attachLocalPlayerEntity(this, {
        id: 'local',
        state: {
          x: WIDTH / 2,
          y: HEIGHT / 2,
          hp: BASE_STATS.maxHp,
          ...BASE_STATS,
          baseStats: { ...BASE_STATS },
          critMultiplier: 2,
          equipment: { weapon: null },
          modifiers: {},
          hasteUntil: 0,
        },
        facing: 'down',
      })
      this.enemies = []
      this.enemyProjectiles = []
      this.drops = []
      this.portal = null
      this.arenaObjects = []
      this.spawnPoints = []
      this.kills = 0
      this.floorKills = 0
      this.floor = 1
      this.floorCleared = false
      this.runComplete = false
      this.ambient = createDungeonAmbient()
    }

    preload() {
      this.loadPlayerAssets()
      for (const type of ['skeleton', 'fast', 'brute', 'ranged']) this.loadAsset(`dungeon-enemy-${type}`, assets.enemies?.[type] || assets.enemy)
      this.loadAsset('dungeon-floor', assets.floor)
      this.loadAsset('dungeon-wall', assets.wall)
      this.loadAsset('dungeon-weapon', assets.weapon)
    }

    loadPlayerAssets() {
      if (assets.player?.source !== 'rpg-main-character') {
        this.loadAsset('dungeon-player', assets.player)
        return
      }
      for (const direction of ['down', 'up', 'side']) {
        for (const action of ['idle', 'walk', 'attack']) this.loadAsset(`dungeon-player-${direction}-${action}`, assets.player[direction]?.[action])
      }
    }

    loadAsset(key, asset) {
      if (!asset?.path) return
      if (asset.frames > 1 && asset.frameWidth > 0 && asset.frameHeight > 0) {
        this.load.spritesheet(key, asset.path, { frameWidth: asset.frameWidth, frameHeight: asset.frameHeight, endFrame: asset.frames - 1 })
      } else {
        this.load.image(key, asset.path)
      }
    }

    create() {
      this.drawArena()
      this.keys = this.input.keyboard.addKeys('W,A,S,D,SPACE')
      this.localPlayer.actor = this.makeActor(this.localPlayer.state.x, this.localPlayer.state.y, 'player').setDepth(20)
      this.localPlayer.bar = this.createHealthBar(this.localPlayer.state.x, this.localPlayer.state.y - 42, 54, 6, 0x55e879)
      this.setupPlayerAnimations()
      this.syncPlayerAnimation()
      this.startFloor(true, this.localPlayer)
      const startAmbient = () => this.ambient.start().catch(() => {})
      this.input.once('pointerdown', startAmbient)
      this.input.keyboard.once('keydown', startAmbient)
      this.events.once('shutdown', () => this.ambient.stop())
      this.events.once('destroy', () => this.ambient.stop())
      this.emitStats()
    }

    trackArena(object) {
      if (object) this.arenaObjects.push(object)
      return object
    }

    clearArena() {
      for (const object of this.arenaObjects) object?.destroy?.()
      this.arenaObjects = []
    }

    drawArena() {
      this.clearArena()
      const layout = roomDescriptor(this.floor)
      this.spawnPoints = layout.spawnPoints
      const graphics = this.trackArena(this.add.graphics().setDepth(0))
      graphics.fillStyle(0x080a0d, 1).fillRect(0, 0, WIDTH, HEIGHT)
      const left = TILE, top = TILE, right = WIDTH - TILE, bottom = HEIGHT - TILE
      for (let y = top; y < bottom; y += TILE) {
        for (let x = left; x < right; x += TILE) {
          if (this.textures.exists('dungeon-floor')) this.addMapTile(x + TILE / 2, y + TILE / 2, 'dungeon-floor', assets.floor, TILE, 1)
          else {
            const shade = ((x / TILE + y / TILE) % 2 === 0) ? 0x171a20 : 0x14171c
            graphics.fillStyle(shade, 1).fillRect(x, y, TILE, TILE)
            graphics.lineStyle(1, 0x232832, 0.55).strokeRect(x, y, TILE, TILE)
          }
        }
      }
      for (let x = left; x < right; x += TILE) {
        this.addWallTile(x + TILE / 2, top / 2)
        this.addWallTile(x + TILE / 2, HEIGHT - top / 2)
      }
      for (let y = top; y < bottom; y += TILE) {
        this.addWallTile(left / 2, y + TILE / 2)
        this.addWallTile(WIDTH - left / 2, y + TILE / 2)
      }
      for (const [x, y] of layout.pillars) this.drawPillar(x, y)
      for (const [x, y, width, height] of layout.blocks) {
        this.trackArena(this.add.rectangle(x + 5, y + 7, width, height, 0x050607, 0.35).setDepth(4))
        this.trackArena(this.add.rectangle(x, y, width, height, 0x252b34, 0.92).setStrokeStyle(2, 0x46515e, 0.85).setDepth(5))
      }
      for (const [x, y] of layout.torches) {
        const glow = this.trackArena(this.add.circle(x, y, 34, 0xff8a3d, 0.07).setDepth(4))
        this.tweens.add({ targets: glow, alpha: 0.19, scale: 1.22, duration: 850, yoyo: true, repeat: -1 })
        this.trackArena(this.add.rectangle(x, y, 5, 12, 0xffb45e, 1).setDepth(5))
      }
    }

    addMapTile(x, y, key, asset, targetHeight, depth) {
      const image = this.trackArena(this.add.image(x, y, key, 0).setDepth(depth))
      const sourceHeight = asset?.frameHeight || asset?.height || image.height || targetHeight
      image.setScale(targetHeight / sourceHeight)
      return image
    }

    addWallTile(x, y) {
      if (this.textures.exists('dungeon-wall')) {
        this.addMapTile(x, y, 'dungeon-wall', assets.wall, TILE, 3).setTint(0x9ca4ad)
        return
      }
      this.trackArena(this.add.rectangle(x, y, TILE - 2, TILE - 2, 0x272d36, 1).setStrokeStyle(2, 0x3d4652, 1).setDepth(3))
    }

    drawPillar(x, y) {
      this.trackArena(this.add.rectangle(x + 5, y + 8, 38, 38, 0x050607, 0.42).setDepth(5))
      this.trackArena(this.add.rectangle(x, y, 36, 36, 0x242a32, 1).setStrokeStyle(3, 0x414b58, 1).setDepth(6))
      this.trackArena(this.add.rectangle(x, y - 12, 26, 5, 0x596573, 0.55).setDepth(7))
    }

    createHealthBar(x, y, width, height, color) {
      const back = this.add.rectangle(x, y, width, height, 0x0a0c0f, 0.88).setDepth(32).setStrokeStyle(1, 0x020304, 0.9)
      const fill = this.add.rectangle(x - width / 2 + 1, y, width - 2, height - 2, color, 1).setOrigin(0, 0.5).setDepth(33)
      return { back, fill, width, height, color }
    }

    updateHealthBar(bar, x, y, hp, maxHp) {
      if (!bar) return
      const ratio = Phaser.Math.Clamp(maxHp > 0 ? hp / maxHp : 0, 0, 1)
      bar.back.setPosition(x, y)
      bar.fill.setPosition(x - bar.width / 2 + 1, y)
      bar.fill.displayWidth = Math.max(0, (bar.width - 2) * ratio)
      bar.fill.setVisible(ratio > 0)
    }

    destroyHealthBar(bar) {
      bar?.back?.destroy()
      bar?.fill?.destroy()
    }

    ensureWalkAnimation(key, asset, animationKey, frameRate) {
      if (!asset || asset.frames <= 1 || this.anims.exists(animationKey)) return
      this.anims.create({ key: animationKey, frames: this.anims.generateFrameNumbers(key, { start: 0, end: asset.frames - 1 }), frameRate, repeat: -1 })
    }

    setupPlayerAnimations() {
      if (assets.player?.source !== 'rpg-main-character' || !this.localPlayer.actor?.anims) return
      for (const direction of ['down', 'up', 'side']) {
        for (const action of ['idle', 'walk', 'attack']) {
          const asset = assets.player[direction]?.[action]
          const key = `dungeon-player-${direction}-${action}`
          if (!asset || !this.textures.exists(key) || this.anims.exists(key)) continue
          this.anims.create({ key, frames: this.anims.generateFrameNumbers(key, { start: 0, end: asset.frames - 1 }), frameRate: action === 'attack' ? 10 : action === 'walk' ? 8 : 4, repeat: action === 'attack' ? 0 : -1 })
        }
      }
      this.localPlayer.actor.on('animationcomplete', (animation) => {
        if (!animation?.key?.endsWith('-attack')) return
        this.localPlayer.attacking = false
        this.syncPlayerAnimation()
      })
    }

    syncPlayerAnimation(forceAction = null, player = this.localPlayer) {
      if (assets.player?.source !== 'rpg-main-character' || !player?.actor?.anims) return
      const action = forceAction || (player.moving ? 'walk' : 'idle')
      const sheetDirection = player.facing === 'up' ? 'up' : player.facing === 'down' ? 'down' : 'side'
      const key = `dungeon-player-${sheetDirection}-${action}`
      player.actor.setFlipX?.(player.facing === 'left')
      if (this.anims.exists(key) && player.actor.anims.currentAnim?.key !== key) player.actor.play(key, true)
    }

    makeActor(x, y, kind, enemyType = 'skeleton') {
      if (kind === 'player' && assets.player?.source === 'rpg-main-character' && this.textures.exists('dungeon-player-down-idle')) {
        return this.add.sprite(x, y, 'dungeon-player-down-idle', 0).setScale(1).setData('usesTexture', true)
      }
      const key = kind === 'player' ? 'dungeon-player' : `dungeon-enemy-${enemyType}`
      const asset = kind === 'player' ? assets.player : (assets.enemies?.[enemyType] || assets.enemy)
      if (this.textures.exists(key)) {
        const animated = asset?.frames > 1
        const visual = animated ? this.add.sprite(x, y, key, 0) : this.add.image(x, y, key)
        const frameHeight = asset?.frameHeight || asset?.height || visual.height || 16
        const targetHeight = kind === 'player' ? 52 : 42
        visual.setScale(Math.max(1, Math.round(targetHeight / frameHeight))).setData('usesTexture', true)
        if (animated) {
          const animationKey = kind === 'player' ? 'dungeon-player-walk' : `dungeon-enemy-${enemyType}-walk`
          this.ensureWalkAnimation(key, asset, animationKey, kind === 'player' ? 8 : 6)
          visual.play(animationKey)
        }
        return visual
      }
      const color = kind === 'player' ? 0xc1ff56 : enemyType === 'fast' ? 0x65bfff : enemyType === 'brute' ? 0xff9367 : enemyType === 'ranged' ? 0x66e6c2 : 0x8d63ff
      return this.add.circle(x, y, kind === 'player' ? 18 : 16, color, 1).setStrokeStyle(3, kind === 'player' ? 0xf5ffe7 : 0xcab8ff, 0.9).setData('usesTexture', false)
    }

    startFloor(initial = false, player = this.localPlayer) {
      this.floorCleared = false
      this.floorKills = 0
      this.destroyPortal()
      if (!initial) {
        this.clearEnemies()
        this.clearEnemyProjectiles()
        this.clearDrops()
        this.drawArena()
        placePlayerAtRoomSpawn(this, player)
      }
      const wave = floorWave(this.floor)
      for (let i = 0; i < wave.count; i++) this.spawnEnemy(i, { elite: i < wave.eliteCount })
      this.showBanner(text.floor(this.floor), '#f4f0e8', 42)
      onEvent({ type: 'floorstart', floor: this.floor, layout: roomLayoutForFloor(this.floor) })
      this.emitStats()
    }

    spawnEnemy(index = 0, { elite = false } = {}) {
      const point = this.spawnPoints[index % Math.max(1, this.spawnPoints.length)] || [72, 72]
      const spread = elite ? 0 : 28
      const desiredX = Phaser.Math.Clamp(point[0] + (Math.random() - 0.5) * spread, 72, WIDTH - 72)
      const desiredY = Phaser.Math.Clamp(point[1] + (Math.random() - 0.5) * spread, 72, HEIGHT - 72)
      const archetype = enemyArchetype(this.floor, Math.random, { elite })
      const { x, y } = safeEnemySpawn(this.__roomGeometry, { x: desiredX, y: desiredY }, archetype.boss ? 26 : 15)
      const visual = this.makeActor(x, y, 'enemy', archetype.type).setDepth(elite ? 12 : 10)
      visual.setScale(visual.scaleX * archetype.scale, visual.scaleY * archetype.scale)
      const tint = elite ? 0xffd86b : null
      if (tint) visual.setTint?.(tint)

      const baseHp = 24 + this.floor * 6
      const maxHp = Math.round(baseHp * archetype.hpMultiplier)
      const speed = (44 + this.floor * 2 + Math.random() * 8) * archetype.speedMultiplier
      const boss = Boolean(archetype.boss)
      const barWidth = boss ? 150 : archetype.type === 'brute' ? 46 : 36
      const barHeight = boss ? 11 : archetype.type === 'brute' ? 7 : 5
      const barOffset = boss ? 58 : 28 + Math.max(0, archetype.scale - 1) * 22
      const enemy = {
        id: `enemy-${Date.now()}-${Math.random()}`,
        x,
        y,
        hp: maxHp,
        maxHp,
        speed,
        visual,
        hitUntil: 0,
        archetype: archetype.type,
        elite: archetype.elite,
        boss,
        phase: 1,
        phaseThreshold: archetype.phaseThreshold ?? 0.5,
        chargeCooldown: archetype.chargeCooldown ?? 0,
        shockwaveCooldown: archetype.shockwaveCooldown ?? 0,
        nextChargeAt: this.time.now + 1600,
        nextShockwaveAt: this.time.now + 2600,
        chargingUntil: 0,
        chargeVx: 0,
        chargeVy: 0,
        attackRange: archetype.attackRange ?? 0,
        preferredRange: archetype.preferredRange ?? 0,
        projectileDamage: archetype.projectileDamage ?? 0,
        projectileCooldown: archetype.projectileCooldown ?? 0,
        projectileSpeed: archetype.projectileSpeed ?? 0,
        nextProjectileAt: this.time.now + 700 + Math.random() * 500,
        contactDamage: archetype.contactDamage,
        tint,
        scale: archetype.scale,
        barOffset,
      }
      enemy.healthBar = this.createHealthBar(x, y - barOffset, barWidth, barHeight, boss ? 0xffc857 : 0xff5964)
      this.enemies.push(enemy)
      return enemy
    }

    update(time, delta) {
      const player = this.localPlayer
      if (player.dead || this.runComplete) return
      const dt = Math.min(delta, 40) / 1000
      this.updatePlayer(dt, player)
      this.updateEnemies(time, dt, player)
      this.updateEnemyProjectiles(dt, player)
      this.updateDrops(player)
      this.updatePortal(time, player)
      this.autoAttack(time, player)
      this.trySkill(time, player)
    }

    updatePlayer(dt, player = this.localPlayer) {
      let dx = 0, dy = 0
      if (this.keys.A.isDown) dx -= 1
      if (this.keys.D.isDown) dx += 1
      if (this.keys.W.isDown) dy -= 1
      if (this.keys.S.isDown) dy += 1
      player.facing = directionFromInput(dx, dy, player.facing)
      player.moving = Boolean(dx || dy)
      const hurtBoost = (player.state.hasteUntil ?? 0) > this.time.now ? 1 + (currentEffects(player.state).hurtHaste ?? 0) : 1
      if (dx || dy) {
        const length = Math.hypot(dx, dy) || 1
        player.state.x += (dx / length) * player.state.speed * hurtBoost * dt
        player.state.y += (dy / length) * player.state.speed * hurtBoost * dt
      }
      player.state.x = Phaser.Math.Clamp(player.state.x, TILE + 18, WIDTH - TILE - 18)
      player.state.y = Phaser.Math.Clamp(player.state.y, TILE + 18, HEIGHT - TILE - 18)
      player.actor?.setPosition?.(player.state.x, player.state.y)
      this.updateHealthBar(player.bar, player.state.x, player.state.y - 42, player.state.hp, player.state.maxHp)
      if (!player.attacking) this.syncPlayerAnimation(null, player)
    }

    updateEnemies(time, dt, player = this.localPlayer) {
      for (const enemy of this.enemies) {
        if (enemy.hp <= 0) continue
        if (enemy.boss) this.updateBoss(enemy, time, dt, player)
        else if (enemy.archetype === 'ranged') this.updateRangedEnemy(enemy, time, dt, player)
        else this.moveEnemyTowardPlayer(enemy, time, dt, player)
      }
    }

    moveEnemyTowardPlayer(enemy, time, dt, player = this.localPlayer) {
      const dx = player.state.x - enemy.x
      const dy = player.state.y - enemy.y
      const distance = Math.hypot(dx, dy) || 1
      enemy.x += (dx / distance) * enemy.speed * dt
      enemy.y += (dy / distance) * enemy.speed * dt
      this.syncEnemyVisual(enemy, time, dx, distance, player)
    }

    updateRangedEnemy(enemy, time, dt, player = this.localPlayer) {
      const dx = player.state.x - enemy.x
      const dy = player.state.y - enemy.y
      const distance = Math.hypot(dx, dy) || 1
      const preferred = enemy.preferredRange || 180

      if (distance > enemy.attackRange) {
        enemy.x += (dx / distance) * enemy.speed * dt
        enemy.y += (dy / distance) * enemy.speed * dt
      } else if (distance < preferred - 34) {
        enemy.x -= (dx / distance) * enemy.speed * 0.72 * dt
        enemy.y -= (dy / distance) * enemy.speed * 0.72 * dt
      } else {
        const strafe = Math.sin((time + enemy.x * 7) / 650) * enemy.speed * 0.28 * dt
        enemy.x += (-dy / distance) * strafe
        enemy.y += (dx / distance) * strafe
      }

      enemy.x = Phaser.Math.Clamp(enemy.x, 66, WIDTH - 66)
      enemy.y = Phaser.Math.Clamp(enemy.y, 66, HEIGHT - 66)
      const nextDx = player.state.x - enemy.x
      const nextDy = player.state.y - enemy.y
      const nextDistance = Math.hypot(nextDx, nextDy) || 1
      this.syncEnemyVisual(enemy, time, nextDx, nextDistance, player)

      if (nextDistance <= enemy.attackRange && time >= enemy.nextProjectileAt) {
        enemy.nextProjectileAt = time + enemy.projectileCooldown
        this.fireEnemyProjectile(enemy, player)
      }
    }

    fireEnemyProjectile(enemy, player = this.localPlayer) {
      const dx = player.state.x - enemy.x
      const dy = player.state.y - enemy.y
      const distance = Math.hypot(dx, dy) || 1
      const speed = enemy.projectileSpeed || 260
      const visual = this.add.circle(enemy.x, enemy.y - 4, 7, 0x70f2ce, 0.92).setStrokeStyle(2, 0xd6fff3, 0.9).setDepth(24)
      const glow = this.add.circle(enemy.x, enemy.y - 4, 13, 0x70f2ce, 0.16).setDepth(23)
      this.enemyProjectiles.push({
        x: enemy.x,
        y: enemy.y - 4,
        vx: (dx / distance) * speed,
        vy: (dy / distance) * speed,
        damage: enemy.projectileDamage || 12,
        life: 3,
        visual,
        glow,
      })
    }

    updateEnemyProjectiles(dt, player = this.localPlayer) {
      for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
        const projectile = this.enemyProjectiles[i]
        projectile.x += projectile.vx * dt
        projectile.y += projectile.vy * dt
        projectile.life -= dt
        projectile.visual?.setPosition(projectile.x, projectile.y)
        projectile.glow?.setPosition(projectile.x, projectile.y)

        const hit = Math.hypot(projectile.x - player.state.x, projectile.y - player.state.y) <= 20
        const expired = projectile.life <= 0 || projectile.x < 42 || projectile.x > WIDTH - 42 || projectile.y < 42 || projectile.y > HEIGHT - 42
        if (!hit && !expired) continue

        if (hit) this.hitPlayer(projectile.damage, player)
        projectile.visual?.destroy()
        projectile.glow?.destroy()
        this.enemyProjectiles.splice(i, 1)
      }
    }

    clearEnemyProjectiles() {
      for (const projectile of this.enemyProjectiles) {
        projectile.visual?.destroy()
        projectile.glow?.destroy()
      }
      this.enemyProjectiles = []
    }

    updateBoss(enemy, time, dt, player = this.localPlayer) {
      if (enemy.phase === 1 && enemy.hp / enemy.maxHp <= enemy.phaseThreshold) {
        enemy.phase = 2
        enemy.speed *= 1.18
        enemy.contactDamage += 5
        enemy.visual.setTint?.(0xff705c)
        this.showBanner('BOSS PHASE II', '#ff705c', 28)
        this.cameras.main.shake(180, 0.008)
      }

      if (time < enemy.chargingUntil) {
        enemy.x += enemy.chargeVx * dt
        enemy.y += enemy.chargeVy * dt
        enemy.x = Phaser.Math.Clamp(enemy.x, 68, WIDTH - 68)
        enemy.y = Phaser.Math.Clamp(enemy.y, 68, HEIGHT - 68)
        const distance = Math.hypot(player.state.x - enemy.x, player.state.y - enemy.y)
        this.syncEnemyVisual(enemy, time, enemy.chargeVx, distance, player)
        if (distance < 42 && time - player.lastContactAt > 420) this.hitPlayer(enemy.contactDamage + 8, player)
        return
      }

      const chargeCooldown = enemy.phase === 2 ? enemy.chargeCooldown * 0.68 : enemy.chargeCooldown
      const shockwaveCooldown = enemy.phase === 2 ? enemy.shockwaveCooldown * 0.72 : enemy.shockwaveCooldown
      if (time >= enemy.nextShockwaveAt) {
        enemy.nextShockwaveAt = time + shockwaveCooldown
        this.bossShockwave(enemy, player)
      }
      if (time >= enemy.nextChargeAt) {
        enemy.nextChargeAt = time + chargeCooldown
        this.bossCharge(enemy, player)
        return
      }
      this.moveEnemyTowardPlayer(enemy, time, dt, player)
    }

    syncEnemyVisual(enemy, time, dx, distance, player = this.localPlayer) {
      enemy.visual.setPosition(enemy.x, enemy.y)
      this.updateHealthBar(enemy.healthBar, enemy.x, enemy.y - enemy.barOffset, enemy.hp, enemy.maxHp)
      if (enemy.visual.setFlipX && Math.abs(dx) > 1) enemy.visual.setFlipX(dx < 0)
      if (time < enemy.hitUntil) enemy.visual.setTintFill?.(0xffffff)
      else if (enemy.boss && enemy.phase === 2) enemy.visual.setTint?.(0xff705c)
      else if (enemy.tint) enemy.visual.setTint?.(enemy.tint)
      else enemy.visual.clearTint?.()
      const contactRadius = enemy.boss ? 42 : 30 + Math.max(0, enemy.scale - 1) * 12
      if (distance < contactRadius && time - player.lastContactAt > 420) this.hitPlayer(enemy.contactDamage, player)
    }

    hitPlayer(damage, player = this.localPlayer) {
      player.lastContactAt = this.time.now
      player.state.hp = Math.max(0, player.state.hp - damage)
      if ((currentEffects(player.state).hurtHaste ?? 0) > 0) player.state.hasteUntil = this.time.now + 1800
      this.updateHealthBar(player.bar, player.state.x, player.state.y - 42, player.state.hp, player.state.maxHp)
      this.flashPlayer(player)
      if (player === this.localPlayer) this.emitStats()
      if (player.state.hp <= 0) this.gameOver(player)
    }

    bossCharge(enemy, player = this.localPlayer) {
      const dx = player.state.x - enemy.x
      const dy = player.state.y - enemy.y
      const distance = Math.hypot(dx, dy) || 1
      const line = this.add.rectangle(enemy.x + dx / 2, enemy.y + dy / 2, distance, 7, 0xff665e, 0.26).setOrigin(0.5).setRotation(Math.atan2(dy, dx)).setDepth(24)
      this.tweens.add({ targets: line, alpha: 0.72, duration: 320, yoyo: true, onComplete: () => line.destroy() })
      this.time.delayedCall(420, () => {
        if (enemy.hp <= 0 || player.dead) return
        const nextDx = player.state.x - enemy.x
        const nextDy = player.state.y - enemy.y
        const nextDistance = Math.hypot(nextDx, nextDy) || 1
        const speed = enemy.phase === 2 ? 430 : 360
        enemy.chargeVx = (nextDx / nextDistance) * speed
        enemy.chargeVy = (nextDy / nextDistance) * speed
        enemy.chargingUntil = this.time.now + 560
      })
    }

    bossShockwave(enemy, player = this.localPlayer) {
      const telegraph = this.add.circle(enemy.x, enemy.y, 34, 0xff8a63, 0.08).setStrokeStyle(4, 0xff8a63, 0.72).setDepth(23)
      this.tweens.add({ targets: telegraph, radius: 120, alpha: 0.5, duration: 560, onComplete: () => {
        const distance = Math.hypot(player.state.x - enemy.x, player.state.y - enemy.y)
        const ring = this.add.circle(enemy.x, enemy.y, 120, 0xff665e, 0.04).setStrokeStyle(7, 0xff665e, 0.9).setDepth(25)
        this.tweens.add({ targets: ring, radius: 168, alpha: 0, duration: 320, onComplete: () => ring.destroy() })
        telegraph.destroy()
        if (distance <= 130) this.hitPlayer(enemy.phase === 2 ? 24 : 18, player)
      } })
    }

    autoAttack(time, player = this.localPlayer) {
      if (time - player.lastAttackAt < attackInterval(player.state, time)) return
      const target = nearestTarget(player.state, this.enemies)
      if (!target || Math.hypot(target.x - player.state.x, target.y - player.state.y) > 165) return
      player.lastAttackAt = time
      this.slash(target, player)
    }

    trySkill(time, player = this.localPlayer) {
      if (!Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) return
      const result = castPlayerSkill(this, player, 'primary', time)
      if (!result.cast) return
      onEvent({ type: 'skill', hits: result.hits, playerId: player.id })
      if (player === this.localPlayer) this.emitStats(time)
    }

    slash(target, player = this.localPlayer) {
      const dx = target.x - player.state.x
      const dy = target.y - player.state.y
      player.facing = directionFromInput(dx, dy, player.facing)
      if (assets.player?.source === 'rpg-main-character') {
        player.attacking = true
        this.syncPlayerAnimation('attack', player)
      }
      const result = rollDamage(player.state)
      const damage = modifiedDamage(player.state, target, result.damage)
      const angle = Math.atan2(dy, dx)
      const slash = this.add.arc(player.state.x + Math.cos(angle) * 34, player.state.y + Math.sin(angle) * 34, 34, -55, 55, false, result.critical ? 0xffdd6e : 0xeafbc9, 0.85).setAngle(Phaser.Math.RadToDeg(angle)).setDepth(30)
      this.tweens.add({ targets: slash, alpha: 0, scale: 1.35, duration: 140, onComplete: () => slash.destroy() })
      this.damageEnemy(target, damage, result.critical, result.critical ? 34 : 22, { direct: true, canProc: true, source: 'weapon' }, player)
      this.healPlayer(healFromHit(player.state, damage, result.critical, { direct: true }), player)
      this.applyWeaponProcs(target, damage, result.critical, player)
    }

    healPlayer(amount, player = this.localPlayer) {
      if (amount <= 0 || player.state.hp <= 0) return
      const before = player.state.hp
      player.state.hp = Math.min(player.state.maxHp, player.state.hp + amount)
      if (player.state.hp !== before) {
        this.updateHealthBar(player.bar, player.state.x, player.state.y - 42, player.state.hp, player.state.maxHp)
        if (player === this.localPlayer) this.emitStats()
      }
    }

    effectLine(from, to, color, width = 3) {
      const dx = to.x - from.x
      const dy = to.y - from.y
      const distance = Math.hypot(dx, dy) || 1
      const line = this.add.rectangle(from.x + dx / 2, from.y + dy / 2, distance, width, color, 0.82).setRotation(Math.atan2(dy, dx)).setDepth(34)
      this.tweens.add({ targets: line, alpha: 0, duration: 170, onComplete: () => line.destroy() })
    }

    applyWeaponProcs(primary, damage, critical, player = this.localPlayer) {
      const effects = currentEffects(player.state)
      if (primary.hp > 0 && effects.piercing > 0 && Math.random() < effects.piercing) {
        const target = secondaryTarget(primary, this.enemies, 145)
        if (target) {
          this.effectLine(primary, target, 0xe7f2ff, 2)
          this.damageEnemy(target, Math.max(1, Math.round(damage * 0.72)), false, 12, { direct: false, canProc: false, source: 'piercing' }, player)
        }
      }
      if (effects.chain > 0 && Math.random() < effects.chain) {
        const target = secondaryTarget(primary, this.enemies, 165)
        if (target) {
          this.effectLine(primary, target, 0x7bc5ff, 3)
          this.damageEnemy(target, Math.max(1, Math.round(damage * 0.56)), false, 8, { direct: false, canProc: false, source: 'chain' }, player)
        }
      }
      if (critical && effects.thunder > 0 && Math.random() < effects.thunder) {
        let source = primary
        const hit = new Set([primary.id])
        for (let i = 0; i < 2; i++) {
          const target = secondaryTarget(source, this.enemies.filter((enemy) => !hit.has(enemy.id)), 190)
          if (!target) break
          hit.add(target.id)
          this.effectLine(source, target, 0x9ae9ff, 5)
          this.damageEnemy(target, Math.max(1, Math.round(damage * 0.68)), false, 5, { direct: false, canProc: false, source: 'thunder' }, player)
          source = target
        }
      }
      if (effects.whirlwind > 0 && Math.random() < effects.whirlwind) {
        const radius = 105
        const ring = this.add.circle(player.state.x, player.state.y, 24, 0xfff0a8, 0.05).setStrokeStyle(4, 0xffdd75, 0.9).setDepth(31)
        this.tweens.add({ targets: ring, radius, alpha: 0, duration: 260, onComplete: () => ring.destroy() })
        for (const enemy of this.enemies) {
          if (enemy.hp <= 0 || enemy === primary) continue
          if (Math.hypot(enemy.x - player.state.x, enemy.y - player.state.y) <= radius) {
            this.damageEnemy(enemy, Math.max(1, Math.round(damage * 0.5)), false, 16, { direct: false, canProc: false, source: 'whirlwind' }, player)
          }
        }
      }
    }

    damageEnemy(enemy, damage, critical, knockback, context = { direct: false, canProc: false, source: 'effect' }, player = this.localPlayer) {
      if (enemy.hp <= 0) return
      enemy.hp = Math.max(0, enemy.hp - damage)
      enemy.hitUntil = this.time.now + 90
      const dx = enemy.x - player.state.x
      const dy = enemy.y - player.state.y
      const distance = Math.hypot(dx, dy) || 1
      const effectiveKnockback = enemy.boss ? knockback * 0.2 : knockback
      enemy.x += (dx / distance) * effectiveKnockback
      enemy.y += (dy / distance) * effectiveKnockback
      this.updateHealthBar(enemy.healthBar, enemy.x, enemy.y - enemy.barOffset, enemy.hp, enemy.maxHp)
      this.damageText(enemy.x, enemy.y - 16, damage, critical)
      if (critical) this.cameras.main.shake(70, 0.004)
      if (enemy.hp <= 0) this.killEnemy(enemy, context, player)
    }

    damageText(x, y, damage, critical) {
      const label = this.add.text(x, y, critical ? `CRIT ${damage}` : `${damage}`, { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: critical ? '18px' : '14px', fontStyle: 'bold', color: critical ? '#ffdc68' : '#f5f1e8', stroke: '#08090b', strokeThickness: 4 }).setOrigin(0.5).setDepth(40)
      this.tweens.add({ targets: label, y: y - 28, alpha: 0, duration: 520, ease: 'Quad.Out', onComplete: () => label.destroy() })
    }

    killEnemy(enemy, context = { source: 'effect' }, player = this.localPlayer) {
      enemy.visual.setVisible(false)
      this.destroyHealthBar(enemy.healthBar)
      enemy.healthBar = null
      this.kills++
      this.floorKills++
      const deathColor = enemy.boss ? 0xffd86b : enemy.archetype === 'fast' ? 0x83c8ff : enemy.archetype === 'brute' ? 0xff9e72 : enemy.archetype === 'ranged' ? 0x70f2ce : 0xa980ff
      this.deathBurst(enemy.x, enemy.y, deathColor)

      const corpseBurst = currentEffects(player.state).corpseBurst ?? 0
      if (corpseBurst > 0 && context.source !== 'corpse_burst') {
        const radius = 110
        const burst = this.add.circle(enemy.x, enemy.y, 18, 0xff8f68, 0.18).setStrokeStyle(3, 0xffb08c, 0.9).setDepth(27)
        this.tweens.add({ targets: burst, radius, alpha: 0, duration: 260, onComplete: () => burst.destroy() })
        const burstDamage = Math.max(1, Math.round(player.state.damage * corpseBurst))
        for (const target of this.enemies) {
          if (target === enemy || target.hp <= 0) continue
          if (Math.hypot(target.x - enemy.x, target.y - enemy.y) <= radius) {
            this.damageEnemy(target, burstDamage, false, 12, { direct: false, canProc: false, source: 'corpse_burst' }, player)
          }
        }
      }

      const equipment = enemy.boss ? bossReward(Math.random, this.floor) : rollEquipment(this.floor)
      const potion = rollPotion()
      if (equipment) this.spawnDrop(enemy.x - (potion ? 12 : 0), enemy.y, equipment)
      if (potion) this.spawnDrop(enemy.x + (equipment ? 12 : 0), enemy.y, potion)

      if (player === this.localPlayer) this.emitStats()
      this.checkFloorClear(player)
      this.time.delayedCall(350, () => {
        const index = this.enemies.indexOf(enemy)
        if (index >= 0) this.enemies.splice(index, 1)
        enemy.visual.destroy()
      })
    }

    checkFloorClear(player = this.localPlayer) {
      if (this.floorCleared || player.dead || this.runComplete) return
      const living = this.enemies.filter((enemy) => enemy.hp > 0).length
      const outcome = floorOutcome(this.floor, living)
      if (outcome === 'combat') return
      this.floorCleared = true
      this.showBanner(text.floorClear(), '#c1ff56', 34)
      onEvent({ type: 'floorclear', floor: this.floor })
      if (outcome === 'complete') this.time.delayedCall(900, () => this.completeRun(player))
      else this.time.delayedCall(750, () => this.openPortal(player))
    }

    deathBurst(x, y, color = 0xa980ff) {
      for (let i = 0; i < 8; i++) {
        const particle = this.add.rectangle(x, y, 5, 5, color, 1).setDepth(25)
        const angle = Math.random() * Math.PI * 2
        const distance = 24 + Math.random() * 34
        this.tweens.add({ targets: particle, x: x + Math.cos(angle) * distance, y: y + Math.sin(angle) * distance, alpha: 0, angle: Math.random() * 180, duration: 260 + Math.random() * 180, onComplete: () => particle.destroy() })
      }
    }

    spawnDrop(x, y, item) {
      const potion = item.type === 'consumable.health_potion'
      const style = potion ? { color: 0xff5964, beamAlpha: 0.32, particles: 1 } : rarityPresentation(item.rarity)
      const color = style.color
      const glow = this.add.rectangle(x, y - 28, potion ? 3 : 4, potion ? 68 : 78, color, style.beamAlpha).setDepth(6)
      let visual
      if (!potion && this.textures.exists('dungeon-weapon')) {
        visual = this.add.image(x, y, 'dungeon-weapon', 0).setDepth(15)
        visual.setTint?.(color)
        const frameHeight = assets.weapon?.frameHeight || assets.weapon?.height || visual.height || 16
        visual.setScale(Math.max(1, Math.round(30 / frameHeight)))
      } else if (potion) {
        const bottle = this.add.rectangle(0, 3, 15, 20, 0xb51e35, 1).setStrokeStyle(2, 0xff8791, 1)
        const neck = this.add.rectangle(0, -10, 8, 6, 0xe5e2d8, 1)
        const shine = this.add.rectangle(-4, -1, 3, 8, 0xffbec4, 0.8)
        visual = this.add.container(x, y, [bottle, neck, shine]).setDepth(15)
      } else {
        const blade = this.add.rectangle(0, -5, 5, 25, 0xdce7ed, 1)
        const guard = this.add.rectangle(0, 8, 16, 4, color, 1)
        const grip = this.add.rectangle(0, 16, 4, 12, 0x8b6846, 1)
        visual = this.add.container(x, y, [blade, guard, grip]).setAngle(42).setDepth(15)
      }

      let label = null
      if (!potion) {
        const cssColor = `#${color.toString(16).padStart(6, '0')}`
        const presentation = weaponDropPresentation(item, text.affix)
        const hint = presentation.hint ? ` · ${presentation.hint}` : ''
        label = this.add.text(x, y + 26, `${text.rarity(item.rarity)}  +${item.damage}${hint}`, { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: presentation.build ? '11px' : '10px', fontStyle: 'bold', color: cssColor, stroke: '#08090b', strokeThickness: 3 }).setOrigin(0.5).setDepth(16)
      }

      const sparkles = []
      for (let i = 0; i < style.particles; i++) {
        const sparkle = this.add.rectangle(x - 14 + Math.random() * 28, y - 18 - Math.random() * 32, 3, 3, color, 0.85).setDepth(14)
        this.tweens.add({ targets: sparkle, y: sparkle.y - 18, alpha: 0.15, duration: 520 + i * 70, yoyo: true, repeat: -1 })
        sparkles.push(sparkle)
      }

      this.tweens.add({ targets: visual, y: y - 6, duration: 480, yoyo: true, repeat: -1 })
      this.tweens.add({ targets: glow, alpha: Math.min(0.92, style.beamAlpha + 0.28), duration: 650, yoyo: true, repeat: -1 })
      this.drops.push({ x, y, item, visual, glow, label, sparkles })
      onEvent({ type: 'drop', item })
    }

    updateDrops(player = this.localPlayer) {
      for (let i = this.drops.length - 1; i >= 0; i--) {
        const drop = this.drops[i]
        if (Math.hypot(drop.x - player.state.x, drop.y - player.state.y) > 34) continue
        const beforeHp = player.state.hp
        player.state = applyPickup(player.state, drop.item, player.state.baseStats)
        this.destroyDrop(drop)
        this.drops.splice(i, 1)
        const healed = Math.max(0, player.state.hp - beforeHp)
        this.pickupBurst(drop.x, drop.y, drop.item, healed)
        this.updateHealthBar(player.bar, player.state.x, player.state.y - 42, player.state.hp, player.state.maxHp)
        onEvent({ type: 'pickup', item: drop.item, healed })
        if (player === this.localPlayer) this.emitStats()
      }
    }

    destroyDrop(drop) {
      drop?.visual?.destroy()
      drop?.glow?.destroy()
      drop?.label?.destroy()
      for (const sparkle of drop?.sparkles || []) sparkle.destroy()
    }

    clearDrops() {
      for (const drop of this.drops) this.destroyDrop(drop)
      this.drops = []
    }

    clearEnemies() {
      for (const enemy of this.enemies) {
        this.destroyHealthBar(enemy.healthBar)
        enemy.visual?.destroy()
      }
      this.enemies = []
    }

    pickupBurst(x, y, item, healed = 0) {
      const potion = item.type === 'consumable.health_potion'
      const color = potion ? '#ff7c86' : `#${rarityPresentation(item.rarity).color.toString(16).padStart(6, '0')}`
      const label = this.add.text(x, y - 28, potion ? `+${healed} HP` : `${item.damage ?? 0} BASE DMG`, { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '14px', fontStyle: 'bold', color, stroke: '#08090b', strokeThickness: 4 }).setOrigin(0.5).setDepth(50)
      this.tweens.add({ targets: label, y: y - 64, alpha: 0, duration: 700, onComplete: () => label.destroy() })
    }

    openPortal(player = this.localPlayer) {
      if (this.portal || player.dead || this.runComplete || this.floor >= 5) return
      const { x, y } = roomAnchor(this.__roomGeometry, 'exit')
      const glow = this.add.circle(x, y, 40, 0x70ff9f, 0.08).setDepth(8)
      const ring = this.add.circle(x, y, 27, 0x1f5132, 0.28).setStrokeStyle(4, 0x70ff9f, 0.9).setDepth(9)
      const core = this.add.circle(x, y, 16, 0x70ff9f, 0.42).setDepth(10)
      this.tweens.add({ targets: glow, scale: 1.3, alpha: 0.18, duration: 850, yoyo: true, repeat: -1 })
      this.tweens.add({ targets: ring, scale: 1.12, alpha: 0.62, duration: 620, yoyo: true, repeat: -1 })
      this.tweens.add({ targets: core, alpha: 0.72, duration: 420, yoyo: true, repeat: -1 })
      this.portal = { x, y, glow, ring, core, unlockAt: this.time.now + 500 }
      onEvent({ type: 'portal', floor: this.floor })
    }

    updatePortal(time, player = this.localPlayer) {
      if (!this.portal || time < this.portal.unlockAt) return
      if (Math.hypot(this.portal.x - player.state.x, this.portal.y - player.state.y) > 38) return
      this.advanceFloor(player)
    }

    destroyPortal() {
      if (!this.portal) return
      this.portal.glow?.destroy()
      this.portal.ring?.destroy()
      this.portal.core?.destroy()
      this.portal = null
    }

    advanceFloor(player = this.localPlayer) {
      if (this.floor >= 5 || player.dead || this.runComplete) return
      this.destroyPortal()
      this.floor++
      player.lastContactAt = this.time.now
      this.startFloor(false, player)
    }

    showBanner(message, color = '#f4f0e8', size = 38) {
      const label = this.add.text(WIDTH / 2, HEIGHT * 0.28, message, { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: `${size}px`, fontStyle: 'bold', color, stroke: '#08090b', strokeThickness: 7 }).setOrigin(0.5).setDepth(70).setAlpha(0)
      this.tweens.add({ targets: label, alpha: 1, y: label.y - 8, duration: 180, yoyo: true, hold: 620, onComplete: () => label.destroy() })
    }

    flashPlayer(player = this.localPlayer) {
      if (player.actor?.setTintFill) {
        player.actor.setTintFill(0xff5f6d)
        this.time.delayedCall(90, () => player.actor?.clearTint?.())
      }
      if (player === this.localPlayer) this.cameras.main.shake(70, 0.003)
    }

    completeRun(player = this.localPlayer) {
      if (this.runComplete || player.dead) return
      this.runComplete = true
      this.destroyPortal()
      this.clearEnemyProjectiles()
      this.ambient.stop()
      this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x050607, 0.7).setDepth(80)
      this.add.text(WIDTH / 2, HEIGHT / 2 - 24, text.runComplete(), { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '42px', fontStyle: 'bold', color: '#c1ff56' }).setOrigin(0.5).setDepth(81)
      this.add.text(WIDTH / 2, HEIGHT / 2 + 34, text.runCompleteHint(), { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '14px', color: '#9aa4ae' }).setOrigin(0.5).setDepth(81)
      onEvent({ type: 'runcomplete', floor: this.floor, kills: this.kills })
      this.emitStats()
    }

    gameOver(player = this.localPlayer) {
      player.dead = true
      if (player !== this.localPlayer) return
      this.clearEnemyProjectiles()
      this.ambient.stop()
      this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x050607, 0.66).setDepth(80)
      this.add.text(WIDTH / 2, HEIGHT / 2 - 18, 'RUN ENDED', { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '42px', fontStyle: 'bold', color: '#f4f0e8' }).setOrigin(0.5).setDepth(81)
      this.add.text(WIDTH / 2, HEIGHT / 2 + 34, 'Refresh to dive again', { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '14px', color: '#8e98a4' }).setOrigin(0.5).setDepth(81)
      onEvent({ type: 'gameover', kills: this.kills })
    }

    emitStats(now = this.time?.now ?? 0) {
      const weapon = currentWeapon(this.localPlayer.state)
      onStats({
        hp: this.localPlayer.state.hp,
        maxHp: this.localPlayer.state.maxHp,
        damage: this.localPlayer.state.damage,
        kills: this.kills,
        floor: this.floor,
        weapon: weapon?.type ?? null,
        weaponRarity: weapon?.rarity ?? null,
        weaponDamage: weapon?.damage ?? 0,
        weaponAffixes: [...(weapon?.affixes ?? [])],
        skillCooldown: Math.max(0, this.localPlayer.skillReadyAt - now),
      })
    }
  }

  return new Phaser.Game({ type: Phaser.AUTO, width: WIDTH, height: HEIGHT, parent, backgroundColor: '#0b0d10', pixelArt: true, antialias: false, scene: DungeonScene, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH } })
}
