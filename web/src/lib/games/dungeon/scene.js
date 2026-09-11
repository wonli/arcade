import { applyPickup, nearestTarget, rollDamage, rollDrop } from './combat.js'

const WIDTH = 960
const HEIGHT = 600
const ENEMY_COUNT = 20

function chooseAsset(paths, patterns) {
  for (const pattern of patterns) {
    const found = paths.find((path) => pattern.test(path))
    if (found) return found
  }
  return null
}

export function chooseDungeonAssets(manifest = {}) {
  const png = Array.isArray(manifest.png) ? manifest.png : []
  return {
    player: chooseAsset(png, [/wizard/i, /hero/i, /player/i, /knight/i]),
    enemy: chooseAsset(png, [/slime/i, /blob/i, /skeleton/i, /skull/i, /goblin/i, /bat/i, /rat/i, /creature/i]),
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
      if (assets.player) this.load.image('dungeon-player', assets.player)
      if (assets.enemy) this.load.image('dungeon-enemy', assets.enemy)
    }

    create() {
      this.drawArena()
      this.keys = this.input.keyboard.addKeys('W,A,S,D,SPACE')
      this.player = this.makeActor(this.playerState.x, this.playerState.y, 'player')
      this.player.setDepth(20)

      for (let i = 0; i < ENEMY_COUNT; i++) this.spawnEnemy(i)
      this.emitStats()
    }

    drawArena() {
      const graphics = this.add.graphics()
      graphics.fillStyle(0x111319, 1)
      graphics.fillRect(0, 0, WIDTH, HEIGHT)
      graphics.lineStyle(1, 0x242a31, 0.7)
      for (let x = 24; x < WIDTH; x += 48) graphics.lineBetween(x, 0, x, HEIGHT)
      for (let y = 24; y < HEIGHT; y += 48) graphics.lineBetween(0, y, WIDTH, y)
      graphics.lineStyle(4, 0x313944, 1)
      graphics.strokeRect(10, 10, WIDTH - 20, HEIGHT - 20)

      for (const [x, y] of [[90, 70], [WIDTH - 90, 70], [90, HEIGHT - 70], [WIDTH - 90, HEIGHT - 70]]) {
        const glow = this.add.circle(x, y, 34, 0xff9b42, 0.08)
        this.tweens.add({ targets: glow, alpha: 0.18, scale: 1.25, duration: 900, yoyo: true, repeat: -1 })
        this.add.circle(x, y, 5, 0xffb35c, 1)
      }
    }

    makeActor(x, y, kind) {
      const key = kind === 'player' ? 'dungeon-player' : 'dungeon-enemy'
      if (this.textures.exists(key)) {
        const image = this.add.image(x, y, key)
        const source = this.textures.get(key).getSourceImage()
        const side = Math.min(source.width, source.height)
        if (source.width > side || source.height > side) image.setCrop(0, 0, side, side)
        image.setDisplaySize(kind === 'player' ? 48 : 42, kind === 'player' ? 48 : 42)
        image.setData('usesTexture', true)
        return image
      }

      const color = kind === 'player' ? 0xc1ff56 : 0x8d63ff
      const actor = this.add.circle(x, y, kind === 'player' ? 18 : 16, color, 1)
      actor.setStrokeStyle(3, kind === 'player' ? 0xf5ffe7 : 0xcab8ff, 0.9)
      actor.setData('usesTexture', false)
      return actor
    }

    spawnEnemy(index = 0) {
      const edge = index % 4
      const padding = 46
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
      if (dx || dy) {
        const length = Math.hypot(dx, dy) || 1
        this.playerState.x += (dx / length) * this.playerState.speed * dt
        this.playerState.y += (dy / length) * this.playerState.speed * dt
      }
      this.playerState.x = Phaser.Math.Clamp(this.playerState.x, 30, WIDTH - 30)
      this.playerState.y = Phaser.Math.Clamp(this.playerState.y, 30, HEIGHT - 30)
      this.player.setPosition(this.playerState.x, this.playerState.y)
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
      this.slash(target, false)
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
      const result = rollDamage(this.playerState)
      const angle = Math.atan2(target.y - this.playerState.y, target.x - this.playerState.x)
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
      const glow = this.add.rectangle(x, y - 22, 3, 54, 0x70ff9f, 0.3).setDepth(6)
      const visual = this.add.rectangle(x, y, 14, 24, 0x70ff9f, 1).setAngle(45).setDepth(15)
      this.tweens.add({ targets: visual, y: y - 5, duration: 480, yoyo: true, repeat: -1 })
      this.tweens.add({ targets: glow, alpha: 0.6, duration: 650, yoyo: true, repeat: -1 })
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
