<script>
  import { onMount } from 'svelte'
  import { createDungeonGame, chooseDungeonAssets } from './scene.js'
  import { setProceduralRunSeed } from './spatial.js'
  import { installDungeonSpatial } from './spatial-runtime.js'
  import { loadPhaser } from './phaser.js'

  let { frameStore } = $props()

  let mount
  let game = null
  let scene = null
  let spatialRuntime = null
  let replayEnemies = new Map()
  let replayDropSignature = ''
  let activeSceneKey = ''
  let activeRunSeed = null
  let replayProgress = { floor: 1, chapter: 1, chapterFloor: 1, roomRole: 'combat' }
  let ready = $state(false)

  $effect(() => {
    const frame = $frameStore
    if (scene && frame) applyFrame(frame)
  })

  function destroyReplayEnemy(enemy) {
    enemy?.visual?.destroy?.()
    scene?.destroyHealthBar?.(enemy?.healthBar)
  }

  function destroyReplayEnemies() {
    for (const enemy of replayEnemies.values()) destroyReplayEnemy(enemy)
    replayEnemies.clear()
  }

  function clearReplayDrops() {
    scene?.clearDrops?.()
    replayDropSignature = ''
  }

  function clearLiveArtifacts() {
    if (!scene) return
    scene.clearEnemies?.()
    scene.clearEnemyProjectiles?.()
    scene.clearDrops?.()
    scene.destroyPortal?.()
    scene.ambient?.stop?.()
    for (const child of [...(scene.children?.list ?? [])]) {
      if (child?.type === 'Text') child.destroy?.()
    }
  }

  function normalizeProgress(frame = {}) {
    return {
      floor: Math.max(1, Number(frame.progress?.floor) || 1),
      chapter: Math.max(1, Number(frame.progress?.chapter) || 1),
      chapterFloor: Math.max(1, Number(frame.progress?.chapterFloor ?? frame.progress?.room) || 1),
      roomRole: frame.progress?.roomRole ?? 'combat',
    }
  }

  function frameSceneKey(frame = {}) {
    const progress = normalizeProgress(frame)
    return String(frame.sceneKey || `${progress.floor}:${progress.chapter}:${progress.chapterFloor}`)
  }

  function frameRunSeed(frame = {}) {
    const value = String(frame.runSeed ?? '').trim().toUpperCase()
    return value || null
  }

  function applyRunSeed(frame = {}) {
    const nextRunSeed = frameRunSeed(frame)
    if (nextRunSeed === activeRunSeed) return false
    setProceduralRunSeed(nextRunSeed)
    activeRunSeed = nextRunSeed
    return true
  }

  function rebuildSceneIfNeeded(frame = {}) {
    const nextProgress = normalizeProgress(frame)
    const nextSceneKey = frameSceneKey(frame)
    const seedChanged = applyRunSeed(frame)
    replayProgress = nextProgress
    if (!seedChanged && activeSceneKey === nextSceneKey && ready) return false

    activeSceneKey = nextSceneKey
    destroyReplayEnemies()
    clearReplayDrops()
    scene.floor = nextProgress.floor
    if (spatialRuntime?.refreshRoom) spatialRuntime.refreshRoom()
    else scene.drawArena?.()
    return true
  }

  function enemyType(enemy = {}) {
    const value = String(enemy.archetype || enemy.kind || 'skeleton')
    if (['skeleton', 'fast', 'brute', 'ranged'].includes(value)) return value
    if (value === 'boss') return 'brute'
    return 'skeleton'
  }

  function enemyPresentationKey(source = {}) {
    return `${enemyType(source)}:${source.boss ? 1 : 0}:${source.elite ? 1 : 0}`
  }

  function createReplayEnemy(source = {}) {
    const boss = !!source.boss || source.kind === 'boss'
    const elite = !!source.elite || source.kind === 'elite'
    const type = enemyType(source)
    const visual = scene.makeActor?.(0, 0, 'enemy', type)
    visual?.setDepth?.(boss || elite ? 12 : 10)
    if (boss) visual?.setTint?.(0xff705c)
    else if (elite) visual?.setTint?.(0xffd86b)
    const width = boss ? 150 : type === 'brute' ? 46 : 36
    const height = boss ? 11 : type === 'brute' ? 7 : 5
    const barOffset = boss ? 58 : 30
    return {
      visual,
      presentationKey: enemyPresentationKey(source),
      barOffset,
      lastX: null,
      healthBar: scene.createHealthBar?.(0, -barOffset, width, height, boss ? 0xffc857 : 0xff5964),
    }
  }

  function syncReplayEnemies(frameEnemies = []) {
    const width = 960
    const height = 600
    const living = frameEnemies.filter((enemy) => enemy?.alive !== false)
    const seen = new Set()

    living.forEach((source, index) => {
      const id = String(source.id || `enemy-${index}`)
      seen.add(id)
      let enemy = replayEnemies.get(id)
      const presentationKey = enemyPresentationKey(source)
      if (enemy && enemy.presentationKey !== presentationKey) {
        destroyReplayEnemy(enemy)
        replayEnemies.delete(id)
        enemy = null
      }
      if (!enemy) {
        enemy = createReplayEnemy(source)
        replayEnemies.set(id, enemy)
      }

      const x = Math.min(1, Math.max(0, Number(source.x) || 0)) * width
      const y = Math.min(1, Math.max(0, Number(source.y) || 0)) * height
      const hp = Math.max(0, Number(source.hp ?? source.maxHp ?? 1))
      const maxHp = Math.max(1, Number(source.maxHp ?? (hp || 1)))
      if (enemy.lastX != null && Math.abs(x - enemy.lastX) > 0.5) enemy.visual?.setFlipX?.(x < enemy.lastX)
      enemy.lastX = x
      enemy.visual?.setPosition?.(x, y)
      scene.updateHealthBar?.(enemy.healthBar, x, y - enemy.barOffset, hp, maxHp)
    })

    for (const [id, enemy] of replayEnemies) {
      if (seen.has(id)) continue
      destroyReplayEnemy(enemy)
      replayEnemies.delete(id)
    }
  }

  function syncReplayDrops(frameDrops = []) {
    const drops = frameDrops.filter((drop) => drop?.item)
    const signature = JSON.stringify(drops.map((drop) => [drop.id, drop.x, drop.y, drop.item]))
    if (signature === replayDropSignature) return

    clearReplayDrops()
    replayDropSignature = signature
    for (const drop of drops) {
      const x = Math.min(1, Math.max(0, Number(drop.x) || 0)) * 960
      const y = Math.min(1, Math.max(0, Number(drop.y) || 0)) * 600
      scene.spawnDrop?.(x, y, drop.item)
    }
  }

  function syncReplayPlayer(frame = {}) {
    const source = frame.player ?? {}
    const player = scene.localPlayer
    if (!player?.state) return

    const x = Math.min(1, Math.max(0, Number(source.x) || 0)) * 960
    const y = Math.min(1, Math.max(0, Number(source.y) || 0)) * 600
    player.state.x = x
    player.state.y = y
    player.state.hp = Number(frame.stats?.hp ?? player.state.hp ?? 0)
    player.state.maxHp = Math.max(1, Number(frame.stats?.maxHp ?? player.state.maxHp ?? 100))
    player.facing = ['up', 'down', 'left', 'right'].includes(source.facing) ? source.facing : 'down'
    player.moving = !!source.moving
    player.attacking = !!source.attacking
    player.actor?.setPosition?.(x, y)
    scene.updateHealthBar?.(player.bar, x, y - 42, player.state.hp, player.state.maxHp)
    scene.syncPlayerAnimation?.(player.attacking ? 'attack' : null, player)
  }

  function applyFrame(frame = {}) {
    if (!scene) return
    rebuildSceneIfNeeded(frame)
    syncReplayPlayer(frame)
    syncReplayEnemies(frame.enemies ?? [])
    syncReplayDrops(frame.drops ?? [])
  }

  async function startReplay() {
    const [Phaser, dungeonResponse] = await Promise.all([
      loadPhaser(),
      fetch('/assets/debts/manifest.json').catch(() => null),
    ])
    const manifest = dungeonResponse?.ok ? await dungeonResponse.json() : { png: [] }
    if (!mount) return

    game = createDungeonGame({
      Phaser,
      parent: mount,
      assets: chooseDungeonAssets(manifest),
      labels: {},
      onStats: () => {},
      onEvent: () => {},
    })

    let attempts = 0
    const attach = () => {
      if (!game || !mount) return
      scene = game.scene?.getScene?.('Dungeon')
      if (!scene) {
        if (attempts++ < 90) requestAnimationFrame(attach)
        return
      }

      const firstFrame = $frameStore
      replayProgress = normalizeProgress(firstFrame)
      applyRunSeed(firstFrame)
      clearLiveArtifacts()
      spatialRuntime = installDungeonSpatial(scene, {
        player: scene.localPlayer,
        getProgress: () => replayProgress,
        onEvent: () => {},
        label: (key) => key,
      })
      scene.scene?.pause?.()
      ready = true
      activeSceneKey = ''
      applyFrame(firstFrame)
    }
    requestAnimationFrame(attach)
  }

  onMount(() => {
    startReplay().catch((error) => console.warn('Dungeon replay surface failed:', error))
    return () => {
      destroyReplayEnemies()
      clearReplayDrops()
      game?.destroy?.(true)
      setProceduralRunSeed(null)
      activeRunSeed = null
      game = null
      scene = null
      spatialRuntime = null
    }
  })
</script>

<div bind:this={mount} class="dungeon-replay-surface"></div>

<style>
  .dungeon-replay-surface{width:960px;height:600px;overflow:hidden;background:#0b0d10}
  .dungeon-replay-surface :global(canvas){display:block!important;width:960px!important;height:600px!important;max-width:none!important;max-height:none!important}
</style>
