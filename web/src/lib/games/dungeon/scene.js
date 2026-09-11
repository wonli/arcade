import { applyPickup, nearestTarget, rollDamage, rollDrop } from './combat.js'

const WIDTH = 960
const HEIGHT = 600
const ENEMY_COUNT = 20
const TILE = 48

function normalizeAssets(manifest = {}) {
  if (Array.isArray(manifest.assets)) return manifest.assets
  if (Array.isArray(manifest.png)) {
    return manifest.png.map((path) => ({
      path,
      width: 0,
      height: 0,
      frames: 1,
      frameWidth: 0,
      frameHeight: 0,
    }))
  }
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

export function chooseDungeonAssets(manifest = {}) {
  const assets = normalizeAssets(manifest)
  const rpgAssets = assets.filter((asset) => asset.source === 'rpg-main-character')
  const hasRpgPlayer = rpgAssets.some((asset) => asset.action && asset.direction)
  const oldAssets = assets.filter((asset) => asset.source !== 'rpg-main-character')

  const player = hasRpgPlayer ? {
    source: 'rpg-main-character',
    down: {
      idle: chooseRpgAnimation(assets, 'down', 'idle'),
      walk: chooseRpgAnimation(assets, 'down', 'walk'),
      attack: chooseRpgAnimation(assets, 'down', 'attack'),
    },
    up: {
      idle: chooseRpgAnimation(assets, 'up', 'idle'),
      walk: chooseRpgAnimation(assets, 'up', 'walk'),
      attack: chooseRpgAnimation(assets, 'up', 'attack'),
    },
    side: {
      idle: chooseRpgAnimation(assets, 'side', 'idle'),
      walk: chooseRpgAnimation(assets, 'side', 'walk'),
      attack: chooseRpgAnimation(assets, 'side', 'attack'),
    },
  } : chooseAsset(oldAssets, [/wizard/i, /hero/i, /player/i, /knight/i, /character/i])

  return {
    player,
    enemy: chooseAsset(oldAssets, [/slime/i, /blob/i, /skeleton/i, /skull/i, /goblin/i, /bat/i, /rat/i, /creature/i, /monster/i]),
    floor: chooseAsset(oldAssets, [/floor/i, /ground/i, /brick/i, /stone/i, /tile/i], (asset) => asset.frames === 1),
    wall: chooseAsset(oldAssets, [/wall/i, /brick/i, /stone/i, /brimstone/i], (asset) => asset.frames === 1),
    weapon: chooseAsset(oldAssets, [/sword/i, /blade/i, /weapon/i, /axe/i, /staff/i, /bow/i, /item/i]),
  }
}

export function createDungeonGame({ Phaser, parent, assets = {}, onStats = () => {}, onEvent = () => {} }) {
  class DungeonScene extends Phaser.Scene {
    constructor() {
      super('Dungeon')
      this.playerState = {
        x: WIDTH / 2,
        y: HEIGHT / 2,
        hp: 100,
        maxHp: 100,
        damage: 10,
        critChance: 0.18,
        critMultiplier: 2,
        speed: 190,
        weapon: null,
      }
      this.playerFacing = 'down'
      this.playerMoving = false
      this.playerAttacking = false
      this.enemies = []
      this.drops = []
      this.kills = 0
      this.floor = 1
      this.lastAttackAt = 0
      this.skillReadyAt = 0
      this.lastContactAt = 0
      this.dead = false
    }

    preload() {
      this.loadPlayerAssets()
      this.loadAsset('dungeon-enemy', assets.enemy)
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
        for (const action of ['idle', 'walk', 'attack']) {
          this.loadAsset(`dungeon-player-${direction}-${action}`, assets.player[direction]?.[action])
        }
      }
    }

    loadAsset(key, asset) {
      if (!asset?.path) return
      if (asset.frames > 1 && asset.frameWidth > 0 && asset.frameHeight > 0) {
        this.load.spritesheet(key, asset.path, {
          frameWidth: asset.frameWidth,
          frameHeight: asset.frameHeight,
          endFrame: asset.frames - 1,
        })
        return
      }
      this.load.image(key, asset.path)
    }

    create() {
      this.drawArena()
      this.keys = this.input.keyboard.addKeys('W,A,S,D,SPACE')
      this.player = this.makeActor(this.playerState.x, this.playerState.y, 'player')
      this.player.setDepth(20)
      this.setupPlayerAnimations()
      this.syncPlayerAnimation()

      for (let i = 0; i < ENEMY_COUNT; i++) this.spawnEnemy(i)
      this.emitStats()
    }

    drawArena() {
      const graphics = this.add.graphics().setDepth(0)
      graphics.fillStyle(0x080a0d, 1)
      graphics.fillRect(0, 0, WIDTH, HEIGHT)

      const left = TILE
      const top = TILE
      const right = WIDTH - TILE
      const bottom = HEIGHT - TILE

      for (let y = top; y < bottom; y += TILE) {
        for (let x = left; x < right; x += TILE) {
          if (this.textures.exists('dungeon-floor')) {
            this.addMapTile(x + TILE / 2, y + TILE / 2, 'dungeon-floor', assets.floor, TILE, 1)
          } else {
            const shade = ((x / TILE + y / TILE) % 2 === 0) ? 0x171a20 : 0x14171c
            graphics.fillStyle(shade, 1)
            graphics.fillRect(x, y, TILE, TILE)
            graphics.lineStyle(1, 0x232832, 0.55)
            graphics.strokeRect(x, y, TILE, TILE)
            if ((x + y) % 144 === 0) {
              graphics.lineStyle(1, 0x2e343d, 0.45)
              graphics.lineBetween(x + 11, y + 17, x + 23, y + 27)
              graphics.lineBetween(x + 23, y + 27, x + 34, y + 21)
            }
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

      this.drawPillar(144, 144)
      this.drawPillar(WIDTH - 144, 144)
      this.drawPillar(144, HEIGHT - 144)
      this.drawPillar(WIDTH - 144, HEIGHT - 144)

      for (const [x, y] of [[96, 72], [WIDTH - 96, 72], [96, HEIGHT - 72], [WIDTH - 96, HEIGHT - 72]]) {
        const glow = this.add.circle(x, y, 34, 0xff8a3d, 0.07).setDepth(4)
        this.tweens.add({ targets: glow, alpha: 0.19, scale: 1.22, duration: 850, yoyo: true, repeat: -1 })
        this.add.rectangle(x, y, 5, 12, 0xffb45e, 1).setDepth(5)
      }
    }

    addMapTile(x, y, key, asset, targetHeight, depth) {
      const image = this.add.image(x, y, key, 0).setDepth(depth)
      const sourceHeight = asset?.frameHeight || asset?.height || image.height || targetHeight
      image.setScale(targetHeight / sourceHeight)
      return image
    }

    addWallTile(x, y) {
      if (this.textures.exists('dungeon-wall')) {
        const tile = this.addMapTile(x, y, 'dungeon-wall', assets.wall, TILE, 3)
        tile.setTint(0x9ca4ad)
        return
      }
      this.add.rectangle(x, y, TILE - 2, TILE - 2, 0x272d36, 1).setStrokeStyle(2, 0x3d4652, 1).setDepth(3)
      this.add.rectangle(x, y - 5, TILE - 10, 7, 0x343c47, 0.7).setDepth(4)
    }

    drawPillar(x, y) {
      this.add.rectangle(x + 5, y + 8, 38, 38, 0x050607, 0.42).setDepth(5)
      this.add.rectangle(x, y, 36, 36, 0x242a32, 1).setStrokeStyle(3, 0x414b58, 1).setDepth(6)
      this.add.rectangle(x, y - 12, 26, 5, 0x596573, 0.55).setDepth(7)
    }

    ensureWalkAnimation(key, asset, animationKey, frameRate) {
      if (!asset || asset.frames <= 1 || this.anims.exists(animationKey)) return
      this.anims.create({
        key: animationKey,
        frames: this.anims.generateFrameNumbers(key, { start: 0, end: asset.frames - 1 }),
        frameRate,
        repeat: -1,
      })
    }

    setupPlayerAnimations() {
      if (assets.player?.source !== 'rpg-main-character' || !this.player?.anims) return
      for (const direction of ['down', 'up', 'side']) {
        for (const action of ['idle', 'walk', 'attack']) {
          const asset = assets.player[direction]?.[action]
          const textureKey = `dungeon-player-${direction}-${action}`
          const animationKey = `dungeon-player-${direction}-${action}`
          if (!asset || !this.textures.exists(textureKey) || this.anims.exists(animationKey)) continue
          this.anims.create({
            key: animationKey,
            frames: this.anims.generateFrameNumbers(textureKey, { start: 0, end: asset.frames - 1 }),
            frameRate: action === 'attack' ? 10 : action === 'walk' ? 8 : 4,
            repeat: action === 'attack' ? 0 : -1,
          })
        }
      }
      this.player.on('animationcomplete', (animation) => {
        if (!animation?.key?.endsWith('-attack')) return
        this.playerAttacking = false
        this.syncPlayerAnimation()
      })
    }

    syncPlayerAnimation(forceAction = null) {
      if (assets.player?.source !== 'rpg-main-character' || !this.player?.anims) return
      const action = forceAction || (this.playerMoving ? 'walk' : 'idle')
      const sheetDirection = this.playerFacing === 'up' ? 'up' : this.playerFacing === 'down' ? 'down' : 'side'
      const animationKey = `dungeon-player-${sheetDirection}-${action}`
      this.player.setFlipX?.(this.playerFacing === 'left')
      if (this.anims.exists(animationKey) && this.player.anims.currentAnim?.key !== animationKey) {
        this.player.play(animationKey, true)
      }
    }

    makeActor(x, y, kind) {
      if (kind === 'player' && assets.player?.source === 'rpg-main-character' && this.textures.exists('dungeon-player-down-idle')) {
        const visual = this.add.sprite(x, y, 'dungeon-player-down-idle', 0)
        visual.setScale(1)
        visual.setData('usesTexture', true)
        return visual
      }

      const key = kind === 'player' ? 'dungeon-player' : 'dungeon-enemy'
      const asset = kind === 'player' ? assets.player : assets.enemy
      if (this.textures.exists(key)) {
        const animated = asset?.frames > 1
        const visual = animated ? this.add.sprite(x, y, key, 0) : this.add.image(x, y, key)
        const frameHeight = asset?.frameHeight || asset?.height || visual.height || 16
        const targetHeight = kind === 'player' ? 52 : 42
        const scale = Math.max(1, Math.round(targetHeight / frameHeight))
        visual.setScale(scale)
        visual.setData('usesTexture', true)

        if (animated) {
          const animationKey = kind === 'player' ? 'dungeon-player-walk' : 'dungeon-enemy-walk'
          this.ensureWalkAnimation(key, asset, animationKey, kind === 'player' ? 8 : 6)
          visual.play(animationKey)
        }
        return visual
      }

      const color = kind === 'player' ? 0xc1ff56 : 0x8d63ff
      const actor = this.add.circle(x, y, kind === 'player' ? 18 : 16, color, 1)
      actor.setStrokeStyle(3, kind === 'player' ? 0xf5ffe7 : 0xcab8ff, 0.9)
      actor.setData('usesTexture', false)
      return actor
    }

    spawnEnemy(index = 0) {
      const edge = index % 4
      const padding = 72
      let x = padding + Math.random() * (WIDTH - padding * 2)
      let y = padding + Math.random() * (HEIGHT - padding * 2)
      if (edge === 0) y = padding
      if (edge === 1) x = WIDTH - padding
      if (edge === 2) y = HEIGHT - padding
      if (edge === 3) x = padding

      const visual = this.makeActor(x, y, 'enemy')
      visual.setDepth(10)
      const enemy = {
        id: `enemy-${Date.now()}-${Math.random()}`,
        x,
        y,
        hp: 26 + Math.floor(this.floor * 1.5),
        maxHp: 26 + Math.floor(this.floor * 1.5),
        speed: 42 + Math.random() * 18 + this.floor,
        visual,
        hitUntil: 0,
      }
      this.enemies.push(enemy)
      return enemy
    }

    update(time, delta) {
      if (this.dead) return
      const dt = Math.min(delta, 40) / 1000
      this.updatePlayer(dt)
      this.updateEnemies(time, dt)
      this.updateDrops()
      this.autoAttack(time)
      this.trySkill(time)
    }

    updatePlayer(dt) {
      let dx = 0
      let dy = 0
      if (this.keys.A.isDown) dx -= 1
      if (this.keys.D.isDown) dx += 1
      if (this.keys.W.isDown) dy -= 1
      if (this.keys.S.isDown) dy += 1

      this.playerFacing = directionFromInput(dx, dy, this.playerFacing)
      this.playerMoving = Boolean(dx || dy)

      if (dx || dy) {
        const length = Math.hypot(dx, dy) || 1
        this.playerState.x += (dx / length) * this.playerState.speed * dt
        this.playerState.y += (dy / length) * this.playerState.speed * dt
      }
      this.playerState.x = Phaser.Math.Clamp(this.playerState.x, TILE + 18, WIDTH - TILE - 18)
      this.playerState.y = Phaser.Math.Clamp(this.playerState.y, TILE + 18, HEIGHT - TILE - 18)
      this.player.setPosition(this.playerState.x, this.playerState.y)
      if (!this.playerAttacking) this.syncPlayerAnimation()
    }

    updateEnemies(time, dt) {
      for (const enemy of this.enemies) {
        if (enemy.hp <= 0) continue
        const dx = this.playerState.x - enemy.x
        const dy = this.playerState.y - enemy.y
        const distance = Math.hypot(dx, dy) || 1
        enemy.x += (dx / distance) * enemy.speed * dt
        enemy.y += (dy / distance) * enemy.speed * dt
        enemy.visual.setPosition(enemy.x, enemy.y)
        if (enemy.visual.setFlipX && Math.abs(dx) > 1) enemy.visual.setFlipX(dx < 0)

        if (time < enemy.hitUntil) {
          if (enemy.visual.setTintFill) enemy.visual.setTintFill(0xffffff)
        } else if (enemy.visual.clearTint) {
          enemy.visual.clearTint()
        }

        if (distance < 30 && time - this.lastContactAt > 420) {
          this.lastContactAt = time
          this.playerState.hp = Math.max(0, this.playerState.hp - 7)
          this.flashPlayer()
          this.emitStats()
          if (this.playerState.hp <= 0) this.gameOver()
        }
      }
    }

    autoAttack(time) {
      if (time - this.lastAttackAt < 430) return
      const target = nearestTarget(this.playerState, this.enemies)
      if (!target) return
      const distance = Math.hypot(target.x - this.playerState.x, target.y - this.playerState.y)
      if (distance > 165) return
      this.lastAttackAt = time
      this.slash(target)
    }

    trySkill(time) {
      if (!Phaser.Input.Keyboard.JustDown(this.keys.SPACE) || time < this.skillReadyAt) return
      this.skillReadyAt = time + 4200
      const ring = this.add.circle(this.playerState.x, this.playerState.y, 20, 0xc1ff56, 0.1)
      ring.setStrokeStyle(4, 0xc1ff56, 0.9)
      this.tweens.add({ targets: ring, radius: 120, alpha: 0, duration: 320, onComplete: () => ring.destroy() })

      let hits = 0
      for (const enemy of this.enemies) {
        if (enemy.hp <= 0) continue
        if (Math.hypot(enemy.x - this.playerState.x, enemy.y - this.playerState.y) <= 130) {
          this.damageEnemy(enemy, Math.round(this.playerState.damage * 1.6), true, 28)
          hits++
        }
      }
      this.cameras.main.shake(100, 0.006)
      onEvent({ type: 'skill', hits })
      this.emitStats(time)
    }

    slash(target) {
      const targetDx = target.x - this.playerState.x
      const targetDy = target.y - this.playerState.y
      this.playerFacing = directionFromInput(targetDx, targetDy, this.playerFacing)
      if (assets.player?.source === 'rpg-main-character') {
        this.playerAttacking = true
        this.syncPlayerAnimation('attack')
      }

      const result = rollDamage(this.playerState)
      const angle = Math.atan2(targetDy, targetDx)
      const x = this.playerState.x + Math.cos(angle) * 34
      const y = this.playerState.y + Math.sin(angle) * 34
      const slash = this.add.arc(x, y, 34, -55, 55, false, result.critical ? 0xffdd6e : 0xeafbc9, 0.85)
      slash.setAngle(Phaser.Math.RadToDeg(angle))
      slash.setDepth(30)
      this.tweens.add({ targets: slash, alpha: 0, scale: 1.35, duration: 140, onComplete: () => slash.destroy() })
      this.damageEnemy(target, result.damage, result.critical, result.critical ? 34 : 22)
    }

    damageEnemy(enemy, damage, critical, knockback) {
      if (enemy.hp <= 0) return
      enemy.hp = Math.max(0, enemy.hp - damage)
      enemy.hitUntil = this.time.now + 90
      const dx = enemy.x - this.playerState.x
      const dy = enemy.y - this.playerState.y
      const distance = Math.hypot(dx, dy) || 1
      enemy.x += (dx / distance) * knockback
      enemy.y += (dy / distance) * knockback
      this.damageText(enemy.x, enemy.y - 16, damage, critical)
      if (critical) this.cameras.main.shake(70, 0.004)
      if (enemy.hp <= 0) this.killEnemy(enemy)
    }

    damageText(x, y, damage, critical) {
      const text = this.add.text(x, y, critical ? `CRIT ${damage}` : `${damage}`, {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: critical ? '18px' : '14px',
        fontStyle: 'bold',
        color: critical ? '#ffdc68' : '#f5f1e8',
        stroke: '#08090b',
        strokeThickness: 4,
      }).setOrigin(0.5).setDepth(40)
      this.tweens.add({ targets: text, y: y - 28, alpha: 0, duration: 520, ease: 'Quad.Out', onComplete: () => text.destroy() })
    }

    killEnemy(enemy) {
      enemy.visual.setVisible(false)
      this.kills++
      this.deathBurst(enemy.x, enemy.y)
      const drop = rollDrop(this.floor)
      if (drop) this.spawnDrop(enemy.x, enemy.y, drop)
      this.emitStats()
      this.time.delayedCall(700, () => {
        const index = this.enemies.indexOf(enemy)
        if (index >= 0) this.enemies.splice(index, 1)
        enemy.visual.destroy()
        if (!this.dead) this.spawnEnemy(this.kills)
      })
    }

    deathBurst(x, y) {
      for (let i = 0; i < 8; i++) {
        const particle = this.add.rectangle(x, y, 5, 5, 0xa980ff, 1).setDepth(25)
        const angle = Math.random() * Math.PI * 2
        const distance = 24 + Math.random() * 34
        this.tweens.add({
          targets: particle,
          x: x + Math.cos(angle) * distance,
          y: y + Math.sin(angle) * distance,
          alpha: 0,
          angle: Math.random() * 180,
          duration: 260 + Math.random() * 180,
          onComplete: () => particle.destroy(),
        })
      }
    }

    spawnDrop(x, y, item) {
      const glow = this.add.rectangle(x, y - 24, 3, 64, 0x70ff9f, 0.26).setDepth(6)
      let visual
      if (this.textures.exists('dungeon-weapon')) {
        visual = this.add.image(x, y, 'dungeon-weapon', 0).setDepth(15)
        const frameHeight = assets.weapon?.frameHeight || assets.weapon?.height || visual.height || 16
        visual.setScale(Math.max(1, Math.round(30 / frameHeight)))
      } else {
        const blade = this.add.rectangle(0, -5, 5, 25, 0xdce7ed, 1)
        const guard = this.add.rectangle(0, 8, 16, 4, 0x70ff9f, 1)
        const grip = this.add.rectangle(0, 16, 4, 12, 0x8b6846, 1)
        visual = this.add.container(x, y, [blade, guard, grip]).setAngle(42).setDepth(15)
      }
      this.tweens.add({ targets: visual, y: y - 6, duration: 480, yoyo: true, repeat: -1 })
      this.tweens.add({ targets: glow, alpha: 0.62, duration: 650, yoyo: true, repeat: -1 })
      this.drops.push({ x, y, item, visual, glow })
      onEvent({ type: 'drop', item })
    }

    updateDrops() {
      for (let i = this.drops.length - 1; i >= 0; i--) {
        const drop = this.drops[i]
        if (Math.hypot(drop.x - this.playerState.x, drop.y - this.playerState.y) > 34) continue
        this.playerState = applyPickup(this.playerState, drop.item)
        drop.visual.destroy()
        drop.glow.destroy()
        this.drops.splice(i, 1)
        this.pickupBurst(drop.x, drop.y)
        onEvent({ type: 'pickup', item: drop.item })
        this.emitStats()
      }
    }

    pickupBurst(x, y) {
      const label = this.add.text(x, y - 28, '+3 DMG', {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#70ff9f',
        stroke: '#08090b',
        strokeThickness: 4,
      }).setOrigin(0.5).setDepth(50)
      this.tweens.add({ targets: label, y: y - 64, alpha: 0, duration: 700, onComplete: () => label.destroy() })
    }

    flashPlayer() {
      if (this.player.setTintFill) {
        this.player.setTintFill(0xff5f6d)
        this.time.delayedCall(90, () => this.player.clearTint?.())
      } else {
        this.tweens.add({ targets: this.player, alpha: 0.25, duration: 55, yoyo: true })
      }
      this.cameras.main.shake(70, 0.003)
    }

    gameOver() {
      this.dead = true
      this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x050607, 0.66).setDepth(80)
      this.add.text(WIDTH / 2, HEIGHT / 2 - 18, 'RUN ENDED', {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: '42px',
        fontStyle: 'bold',
        color: '#f4f0e8',
      }).setOrigin(0.5).setDepth(81)
      this.add.text(WIDTH / 2, HEIGHT / 2 + 34, 'Refresh to dive again', {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: '14px',
        color: '#8e98a4',
      }).setOrigin(0.5).setDepth(81)
      onEvent({ type: 'gameover', kills: this.kills })
    }

    emitStats(now = this.time?.now ?? 0) {
      onStats({
        hp: this.playerState.hp,
        maxHp: this.playerState.maxHp,
        damage: this.playerState.damage,
        kills: this.kills,
        floor: this.floor,
        weapon: this.playerState.weapon,
        skillCooldown: Math.max(0, this.skillReadyAt - now),
      })
    }
  }

  return new Phaser.Game({
    type: Phaser.AUTO,
    width: WIDTH,
    height: HEIGHT,
    parent,
    backgroundColor: '#0b0d10',
    pixelArt: true,
    antialias: false,
    scene: DungeonScene,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  })
}
