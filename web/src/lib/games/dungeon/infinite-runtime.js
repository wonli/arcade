import { placePlayerAtRoomSpawn, roomAnchor } from './room-anchors.js'
import { deriveEquipment, rollAffixes } from './affixes.js'
import { elitePresentation, roomClearFeedback } from './combat-feel.js'
import { advanceProgress, createRunProgress, difficultyProfile, playerProgressionProfile, roomRoleAt } from './progression.js'
import { growPlayerLegendaryForRoom } from './legendary-growth.js'
import { currentWeapon } from './player-loadout.js'
import { applyRestChoice, consumeFortune, restChoices } from './rest.js'
import { renderRestStatue, restStatuePlan } from './rest-statue.js'

export { restStatuePlan }

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

export function scalePlayerForProgress(scene, progress, player = scene?.localPlayer) {
  const state = player?.state
  if (!state) return null
  const floor = Math.max(1, Math.floor(progress?.floor || 1))
  if (scene.__dungeonPlayerScaledFloor === floor) return state

  const currentBase = state.baseStats ?? {
    damage: state.damage ?? 10,
    critChance: state.critChance ?? 0.18,
    speed: state.speed ?? 190,
    maxHp: state.maxHp ?? 100,
  }
  const naturalBase = scene.__dungeonNaturalPlayerBase ?? { ...currentBase }
  scene.__dungeonNaturalPlayerBase ??= naturalBase
  const previousScaled = scene.__dungeonLastScaledPlayerBase ?? naturalBase
  const permanent = scene.__dungeonPermanentPlayerBonus ?? { damage: 0, maxHp: 0 }
  permanent.damage += Math.max(0, (currentBase.damage ?? naturalBase.damage) - (previousScaled.damage ?? naturalBase.damage))
  permanent.maxHp += Math.max(0, (currentBase.maxHp ?? naturalBase.maxHp) - (previousScaled.maxHp ?? naturalBase.maxHp))
  scene.__dungeonPermanentPlayerBonus = permanent

  const profile = playerProgressionProfile(progress)
  const nextBase = {
    ...currentBase,
    damage: Math.max(1, Math.round((naturalBase.damage ?? 10) * profile.damageMultiplier + permanent.damage)),
    maxHp: Math.max(1, Math.round((naturalBase.maxHp ?? 100) * profile.maxHpMultiplier + permanent.maxHp)),
  }
  const next = deriveEquipment(nextBase, currentWeapon(state), state)
  next.baseStats = nextBase
  player.state = next
  scene.__dungeonLastScaledPlayerBase = { ...nextBase }
  scene.__dungeonPlayerScaledFloor = floor
  return next
}

export function bindRestChoicePointer(text, index, choose) {
  text?.setInteractive?.()
  text?.on?.('pointerdown', () => choose(index))
  return text
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

function attachEliteAura(scene, enemy, { boss = false } = {}) {
  if (!enemy || enemy.eliteAura) return
  const presentation = elitePresentation({ boss })
  const aura = scene.add.circle(enemy.x, enemy.y + 8, presentation.auraRadius, presentation.auraColor, boss ? 0.08 : 0.06)
    .setStrokeStyle(boss ? 3 : 2, presentation.auraColor, boss ? 0.78 : 0.64)
    .setDepth(Math.max(7, (enemy.visual?.depth ?? 20) - 1))
  aura.setScale?.(1, 0.42)
  scene.tweens.add({
    targets: aura,
    scaleX: boss ? 1.28 : 1.2,
    scaleY: boss ? 0.54 : 0.5,
    alpha: boss ? 0.24 : 0.18,
    duration: presentation.pulseMs,
    yoyo: true,
    repeat: -1,
  })
  enemy.eliteAura = aura
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
    const presentation = elitePresentation({ boss: true })
    enemy.visual?.setTint?.(presentation.tint)
    attachEliteAura(scene, enemy, { boss: true })
  }
  if (elite && !boss) {
    const presentation = elitePresentation({ boss: false })
    enemy.elite = true
    enemy.scale *= presentation.scale
    enemy.visual?.setScale?.(enemy.visual.scaleX * presentation.scale, enemy.visual.scaleY * presentation.scale)
    enemy.visual?.setTint?.(presentation.tint)
    enemy.tint = presentation.tint
    attachEliteAura(scene, enemy)
  }
  scene.updateHealthBar?.(enemy.healthBar, enemy.x, enemy.y - enemy.barOffset, enemy.hp, enemy.maxHp)
}

export function installInfiniteDungeon(scene, {
  random = Math.random,
  onProgress = () => {},
  onEvent = () => {},
  label = (key) => key,
  player = scene?.localPlayer,
} = {}) {
  if (!scene || !player || scene.__infiniteDungeonInstalled) return null
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

  const destroyEliteAuras = () => {
    for (const enemy of scene.enemies ?? []) {
      enemy.eliteAura?.destroy?.()
      enemy.eliteAura = null
    }
  }

  const syncEliteAuras = () => {
    for (const enemy of scene.enemies ?? []) {
      const aura = enemy.eliteAura
      if (!aura) continue
      if (enemy.hp <= 0 || enemy.visual?.active === false) {
        aura.destroy?.()
        enemy.eliteAura = null
        continue
      }
      aura.setPosition?.(enemy.x, enemy.y + Math.max(6, (enemy.barOffset ?? 24) * 0.2))
    }
  }
  scene.events?.on?.('update', syncEliteAuras)

  const playClearFeedback = (role) => {
    const feedback = roomClearFeedback({ roomRole: role })
    const x = player.state?.x ?? 480
    const y = player.state?.y ?? 300
    scene.__hitStopUntil = Math.max(scene.__hitStopUntil ?? 0, (scene.time?.now ?? 0) + feedback.hitStopMs)
    scene.cameras?.main?.shake?.(feedback.durationMs, feedback.shake)
    scene.__dungeonAttackRuntime?.playImpactSound?.({
      damage: role === 'boss' ? 80 : role === 'elite' ? 64 : 48,
      critical: true,
      killed: true,
      elite: role === 'elite' || role === 'boss',
      gain: feedback.soundGain,
    })

    const ring = scene.add.circle(x, y, 18, feedback.color, 0.08)
      .setStrokeStyle(role === 'boss' ? 5 : 4, feedback.color, 0.9)
      .setDepth(44)
    scene.tweens.add({
      targets: ring,
      radius: feedback.ringRadius,
      alpha: 0,
      duration: feedback.durationMs + 180,
      onComplete: () => ring.destroy(),
    })
    scene.__dungeonVfx?.sparkle?.(x - 26, y - 8, { width: 32, height: 32 })
    scene.__dungeonVfx?.sparkle?.(x + 28, y + 4, { width: 28, height: 28 })
    if (role === 'elite' || role === 'boss') scene.__dungeonVfx?.sparkle?.(x, y - 30, { width: 38, height: 38 })
  }

  const destroyRest = () => {
    if (!restRuntime) return
    for (const object of restRuntime.objects) object?.destroy?.()
    for (const key of restRuntime.keys) key?.off?.('down')
    scene.events?.off?.('update', restRuntime.update)
    restRuntime = null
  }

  const openInfinitePortal = () => {
    if (scene.portal || player.dead) return
    const { x, y } = roomAnchor(scene.__roomGeometry, 'exit')
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
    const { x, y } = roomAnchor(scene.__roomGeometry, 'rest')
    const objects = []
    const glow = scene.add.circle(x, y, 56, 0xffc66d, 0.08).setDepth(8)
    const statue = renderRestStatue(scene, { x, y }, { depth: 9 })
    const title = scene.add.text(x, y - 74, label('restTitle'), { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '20px', fontStyle: 'bold', color: '#ffd27c', stroke: '#08090b', strokeThickness: 4 }).setOrigin(0.5).setDepth(30)
    objects.push(glow, ...statue, title)
    scene.tweens.add({ targets: glow, scale: 1.18, alpha: 0.16, duration: 900, yoyo: true, repeat: -1 })

    const keys = ['ONE', 'TWO', 'THREE'].map((name) => scene.input.keyboard.addKey(name))
    let choicesVisible = false
    let used = false
    const choiceLabels = restChoices()
    const choiceTexts = []

    const choose = (index) => {
      if (!choicesVisible || used) return
      const choice = choiceLabels[index]
      if (!choice) return
      used = true
      const result = applyRestChoice(player.state, choice, random)
      player.state = result.playerState
      if (result.fortunePending) fortunePending = true
      scene.updateHealthBar?.(player.bar, player.state.x, player.state.y - 42, player.state.hp, player.state.maxHp)
      if (player === scene.localPlayer) scene.emitStats?.()
      publish()
      onEvent({ type: 'restchoice', choice, floor: progress.floor, chapter: progress.chapter })
      for (const text of choiceTexts) text.destroy()
      title.setText(label('restComplete'))
      openInfinitePortal()
    }

    const showChoices = () => {
      if (choicesVisible || used) return
      choicesVisible = true
      choiceLabels.forEach((choice, index) => {
        const text = scene.add.text(x, y + 48 + index * 24, `${index + 1}. ${label(`rest.${choice}`)}`, { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '12px', color: index === 0 ? '#70ff9f' : index === 1 ? '#67a8ff' : '#c984ff', stroke: '#08090b', strokeThickness: 3 }).setOrigin(0.5).setDepth(31)
        bindRestChoicePointer(text, index, choose)
        choiceTexts.push(text)
        objects.push(text)
      })
    }

    keys.forEach((key, index) => key.on('down', () => choose(index)))
    const update = () => {
      if (used) return
      if (Math.hypot(player.state.x - x, player.state.y - y) <= 96) showChoices()
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
      destroyEliteAuras()
      scene.clearEnemies()
      scene.clearEnemyProjectiles()
      originalClearDrops()
      scene.drawArena()
      placePlayerAtRoomSpawn(scene, player)
    }

    scalePlayerForProgress(scene, progress, player)
    scene.updateHealthBar?.(player.bar, player.state.x, player.state.y - 42, player.state.hp, player.state.maxHp)

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
    if (player === scene.localPlayer) scene.emitStats?.()
  }

  scene.startFloor = startInfiniteFloor

  scene.checkFloorClear = function checkInfiniteFloorClear(target = player) {
    const role = roomRoleAt(progress)
    if (role === 'rest' || scene.floorCleared || target.dead) return
    const living = scene.enemies.filter((enemy) => enemy.hp > 0).length
    if (living > 0) return
    scene.floorCleared = true

    const growth = growPlayerLegendaryForRoom(target.state, role)
    if (growth.grew) {
      target.state = growth.playerState
      scene.updateHealthBar?.(target.bar, target.state.x, target.state.y - 42, target.state.hp, target.state.maxHp)
      if (target === scene.localPlayer) scene.emitStats?.()
      onEvent({
        type: 'legendarylevel',
        floor: progress.floor,
        chapter: progress.chapter,
        level: growth.level,
        awakening: growth.awakening,
        weapon: growth.weapon,
      })
      const awakeningMilestone = [5, 10, 15, 20].includes(growth.level)
      scene.time.delayedCall(180, () => {
        scene.showBanner(`${growth.weapon?.name ?? 'LEGENDARY'} · LV ${growth.level}`, awakeningMilestone ? '#ffd56a' : '#ffb347', awakeningMilestone ? 30 : 22)
      })
    }

    playClearFeedback(role)
    scene.showBanner(label('floorClear'), role === 'boss' ? '#ffb55c' : role === 'elite' ? '#c984ff' : '#c1ff56', 34)
    onEvent({ type: 'floorclear', floor: progress.floor, chapter: progress.chapter, roomRole: role })
    scene.time.delayedCall(650, () => openInfinitePortal())
  }

  scene.advanceFloor = function advanceInfiniteFloor(target = player) {
    if (target.dead) return
    fortuneActive = false
    scene.destroyPortal()
    progress = advanceProgress(progress, random)
    scene.floor = progress.floor
    target.lastContactAt = scene.time.now
    startInfiniteFloor(false)
  }

  publish()

  scene.events?.once?.('shutdown', () => {
    destroyRest()
    destroyEliteAuras()
    scene.events?.off?.('update', syncEliteAuras)
    scene.openPortal = originalOpenPortal
  })

  return {
    getProgress: snapshot,
    destroy() {
      destroyRest()
      destroyEliteAuras()
      scene.events?.off?.('update', syncEliteAuras)
    },
  }
}
