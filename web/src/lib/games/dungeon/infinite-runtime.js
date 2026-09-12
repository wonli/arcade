import { rollAffixes } from './affixes.js'
import { advanceProgress, createRunProgress, difficultyProfile, roomRoleAt } from './progression.js'
import { applyRestChoice, consumeFortune, restChoices } from './rest.js'

const RARITIES = ['common', 'uncommon', 'rare', 'epic']

export function encounterPlan(progress) {
  const role = progress?.roomRole ?? roomRoleAt(progress)
  if (role === 'rest') return { kind: 'rest', count: 0, eliteCount: 0, bossCount: 0 }
  const profile = difficultyProfile(progress)
  if (role === 'boss') return { kind: 'boss', count: Math.max(1, Math.min(5, 2 + Math.floor((progress?.chapter ?? 1) / 3))), eliteCount: 0, bossCount: 1, profile }
  return {
    kind: role === 'elite' ? 'elite' : 'combat',
    count: profile.waveCount,
    eliteCount: role === 'elite' ? profile.eliteCount : 0,
    bossCount: 0,
    profile,
  }
}

export function lootPromotionChance(floor = 1, fortuneActive = false) {
  const depthChance = Math.min(0.35, Math.max(0, floor - 5) * 0.008)
  return Math.min(0.76, depthChance + (fortuneActive ? 0.34 : 0))
}

export function progressSnapshot(progress, fortunePending = false, fortuneActive = false) {
  return {
    ...progress,
    roomRole: roomRoleAt(progress),
    fortunePending,
    fortuneActive,
  }
}

function promoteEquipment(item, floor, fortuneActive, random) {
  if (!item?.type?.startsWith('weapon.') || random() >= lootPromotionChance(floor, fortuneActive)) return item
  const index = RARITIES.indexOf(item.rarity)
  if (index < 0 || index >= RARITIES.length - 1) return item
  const rarity = RARITIES[index + 1]
  return {
    ...item,
    rarity,
    damage: (item.damage ?? 0) + 2,
    affixes: rollAffixes(floor, rarity, random),
  }
}

function scaleEnemy(scene, enemy, profile, { elite = false, boss = false } = {}) {
  if (!enemy || !profile) return
  const hpFactor = profile.hpMultiplier * (elite ? 1.5 : 1) * (boss ? profile.bossHpMultiplier : 1)
  const damageFactor = profile.damageMultiplier * (elite ? 1.25 : 1) * (boss ? profile.bossDamageMultiplier : 1)
  enemy.maxHp = Math.max(1, Math.round(enemy.maxHp * hpFactor))
  enemy.hp = enemy.maxHp
  enemy.speed *= Math.min(profile.speedMultiplier, boss ? 1.15 : profile.speedMultiplier)
  enemy.contactDamage = Math.max(1, Math.round(enemy.contactDamage * damageFactor))
  if (enemy.projectileDamage) enemy.projectileDamage = Math.max(1, Math.round(enemy.projectileDamage * damageFactor))
  if (boss) {
    enemy.chargeCooldown = Math.max(1600, Math.round(enemy.chargeCooldown * profile.bossCooldownMultiplier))
    enemy.shockwaveCooldown = Math.max(2200, Math.round(enemy.shockwaveCooldown * profile.bossCooldownMultiplier))
  }
  if (elite && !boss) {
    enemy.elite = true
    enemy.scale *= 1.14
    enemy.visual?.setScale?.(enemy.visual.scaleX * 1.14, enemy.visual.scaleY * 1.14)
    enemy.visual?.setTint?.(0xffd86b)
    enemy.tint = 0xffd86b
  }
  scene.updateHealthBar?.(enemy.healthBar, enemy.x, enemy.y - enemy.barOffset, enemy.hp, enemy.maxHp)
}

export function installInfiniteDungeon(scene, {
  random = Math.random,
  onProgress = () => {},
  onEvent = () => {},
  label = (key) => key,
} = {}) {
  if (!scene || scene.__infiniteDungeonInstalled) return null
  scene.__infiniteDungeonInstalled = true

  let progress = createRunProgress(random)
  let fortunePending = false
  let fortuneActive = false
  let restRuntime = null

  scene.floor = progress.floor

  const originalOpenPortal = scene.openPortal.bind(scene)
  const originalSpawnDrop = scene.spawnDrop.bind(scene)
  const originalClearDrops = scene.clearDrops.bind(scene)

  const snapshot = () => progressSnapshot(progress, fortunePending, fortuneActive)
  const publish = () => onProgress(snapshot())

  const destroyRest = () => {
    if (!restRuntime) return
    for (const object of restRuntime.objects) object?.destroy?.()
    for (const key of restRuntime.keys) key?.off?.('down')
    scene.events?.off?.('update', restRuntime.update)
    restRuntime = null
  }

  const openInfinitePortal = () => {
    if (scene.portal || scene.dead) return
    const x = 480
    const y = 600 - 48 * 1.7
    const glow = scene.add.circle(x, y, 40, 0x70ff9f, 0.08).setDepth(8)
    const ring = scene.add.circle(x, y, 27, 0x1f5132, 0.28).setStrokeStyle(4, 0x70ff9f, 0.9).setDepth(9)
    const core = scene.add.circle(x, y, 16, 0x70ff9f, 0.42).setDepth(10)
    scene.tweens.add({ targets: glow, scale: 1.3, alpha: 0.18, duration: 850, yoyo: true, repeat: -1 })
    scene.tweens.add({ targets: ring, scale: 1.12, alpha: 0.62, duration: 620, yoyo: true, repeat: -1 })
    scene.tweens.add({ targets: core, alpha: 0.72, duration: 420, yoyo: true, repeat: -1 })
    scene.portal = { x, y, glow, ring, core, unlockAt: scene.time.now + 500 }
    onEvent({ type: 'portal', floor: progress.floor, chapter: progress.chapter })
  }

  scene.openPortal = openInfinitePortal

  scene.spawnDrop = function spawnDropWithProgression(x, y, item) {
    const next = promoteEquipment(item, progress.floor, fortuneActive, random)
    originalSpawnDrop(x, y, next)
  }

  const spawnRestRoom = () => {
    const x = 480
    const y = 300
    const objects = []
    const glow = scene.add.circle(x, y, 56, 0xffc66d, 0.08).setDepth(8)
    const fire = scene.add.circle(x, y + 5, 18, 0xff9e52, 0.5).setStrokeStyle(3, 0xffd27c, 0.9).setDepth(9)
    const title = scene.add.text(x, y - 74, label('restTitle'), { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '20px', fontStyle: 'bold', color: '#ffd27c', stroke: '#08090b', strokeThickness: 4 }).setOrigin(0.5).setDepth(30)
    objects.push(glow, fire, title)
    scene.tweens.add({ targets: glow, scale: 1.18, alpha: 0.16, duration: 900, yoyo: true, repeat: -1 })

    const keys = ['ONE', 'TWO', 'THREE'].map((name) => scene.input.keyboard.addKey(name))
    let choicesVisible = false
    let used = false
    const choiceLabels = restChoices()
    const choiceTexts = []

    const showChoices = () => {
      if (choicesVisible || used) return
      choicesVisible = true
      choiceLabels.forEach((choice, index) => {
        const text = scene.add.text(x, y + 48 + index * 24, `${index + 1}. ${label(`rest.${choice}`)}`, { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '12px', color: index === 0 ? '#70ff9f' : index === 1 ? '#67a8ff' : '#c984ff', stroke: '#08090b', strokeThickness: 3 }).setOrigin(0.5).setDepth(31)
        choiceTexts.push(text)
        objects.push(text)
      })
    }

    const choose = (index) => {
      if (!choicesVisible || used) return
      const choice = choiceLabels[index]
      if (!choice) return
      used = true
      const result = applyRestChoice(scene.playerState, choice, random)
      scene.playerState = result.playerState
      if (result.fortunePending) fortunePending = true
      scene.updateHealthBar?.(scene.playerBar, scene.playerState.x, scene.playerState.y - 42, scene.playerState.hp, scene.playerState.maxHp)
      scene.emitStats?.()
      publish()
      onEvent({ type: 'restchoice', choice, floor: progress.floor, chapter: progress.chapter })
      for (const text of choiceTexts) text.destroy()
      title.setText(label('restComplete'))
      openInfinitePortal()
    }

    keys.forEach((key, index) => key.on('down', () => choose(index)))
    const update = () => {
      if (used) return
      if (Math.hypot(scene.playerState.x - x, scene.playerState.y - y) <= 96) showChoices()
    }
    scene.events.on('update', update)
    restRuntime = { objects, keys, update }
    onEvent({ type: 'rest', floor: progress.floor, chapter: progress.chapter })
  }

  const startInfiniteFloor = (initial = false) => {
    destroyRest()
    scene.floorCleared = false
    scene.floorKills = 0
    scene.destroyPortal()

    const role = roomRoleAt(progress)
    progress = { ...progress, roomRole: role }
    const fortune = consumeFortune(fortunePending, role)
    fortuneActive = fortune.active
    fortunePending = fortune.remaining

    if (!initial) {
      scene.clearEnemies()
      scene.clearEnemyProjectiles()
      originalClearDrops()
      scene.playerState.x = 480
      scene.playerState.y = 300
      scene.player.setPosition(scene.playerState.x, scene.playerState.y)
      scene.drawArena()
    }

    if (role === 'rest') {
      spawnRestRoom()
    } else {
      const plan = encounterPlan(progress)
      if (plan.kind === 'boss') {
        const boss = scene.spawnEnemy(0, { elite: true })
        scaleEnemy(scene, boss, plan.profile, { boss: true })
        for (let i = 1; i < plan.count; i++) {
          const enemy = scene.spawnEnemy(i, { elite: false })
          scaleEnemy(scene, enemy, plan.profile)
        }
      } else {
        for (let i = 0; i < plan.count; i++) {
          const enemy = scene.spawnEnemy(i, { elite: false })
          scaleEnemy(scene, enemy, plan.profile, { elite: plan.kind === 'elite' && i < plan.eliteCount })
        }
      }
    }

    scene.showBanner(`${label('floor')} ${progress.floor} · ${label('chapter')} ${progress.chapter}`, role === 'boss' ? '#ffd56a' : role === 'rest' ? '#ffd27c' : role === 'elite' ? '#c984ff' : '#f4f0e8', 34)
    onEvent({ type: 'floorstart', floor: progress.floor, chapter: progress.chapter, roomRole: role })
    publish()
    scene.emitStats?.()
  }

  scene.startFloor = startInfiniteFloor

  scene.checkFloorClear = function checkInfiniteFloorClear() {
    const role = roomRoleAt(progress)
    if (role === 'rest' || scene.floorCleared || scene.dead) return
    const living = scene.enemies.filter((enemy) => enemy.hp > 0).length
    if (living > 0) return
    scene.floorCleared = true
    scene.showBanner(label('floorClear'), '#c1ff56', 34)
    onEvent({ type: 'floorclear', floor: progress.floor, chapter: progress.chapter, roomRole: role })
    scene.time.delayedCall(650, () => openInfinitePortal())
  }

  scene.advanceFloor = function advanceInfiniteFloor() {
    if (scene.dead) return
    fortuneActive = false
    scene.destroyPortal()
    progress = advanceProgress(progress, random)
    scene.floor = progress.floor
    scene.lastContactAt = scene.time.now
    startInfiniteFloor(false)
  }

  publish()

  scene.events?.once?.('shutdown', () => {
    destroyRest()
    scene.openPortal = originalOpenPortal
  })

  return {
    getProgress: snapshot,
    destroy: destroyRest,
  }
}
