<script>
  import { onMount } from 'svelte'
  import { createDungeonGame, chooseDungeonAssets } from './scene.js'
  import { normalizeDungeonReplayPlayers } from './replay.js'
  import {
    cleanupGroundDropPresentation,
    queueGroundDropArt,
    syncGroundDropPresentation,
    updateGroundDropPresentation,
  } from './ground-drop-presentation.js'
  import { despawnRemotePlayer, spawnRemotePlayer, syncRemotePlayerPresentation } from './remote-player-runtime.js'
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

  function destroyReplayPlayers() {
    if (!(scene?.players instanceof Map)) return
    for (const player of [...scene.players.values()]) {
      if (player !== scene.localPlayer) despawnRemotePlayer(scene, player)
    }
  }

  function clearReplayDrops() {
    for (const drop of scene?.drops ?? []) cleanupGroundDropPresentation(scene, drop)
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
      const before = scene.drops?.length ?? 0
      scene.spawnDrop?.(x, y, drop.item)
      const spawned = scene.drops?.[before] ?? scene.drops?.at?.(-1)
      if (spawned) syncGroundDropPresentation(scene, spawned, { x, y, now: scene.time?.now ?? 0 })
    }
  }

  function bindReplayLocalPlayer(source) {
    const player = scene?.localPlayer
    if (!player?.state) return null
    const id = String(source?.id || 'player-0')
    if (String(player.id) === id) return player

    if (scene.players instanceof Map) {
      if (scene.players.get(player.id) === player) scene.players.delete(player.id)
      const conflict = scene.players.get(id)
      if (conflict && conflict !== player) despawnRemotePlayer(scene, conflict)
      player.id = id
      scene.players.set(id, player)
    } else {
      player.id = id
    }
    return player
  }

  function replayPlayerSnapshot(source) {
    const x = Math.min(1, Math.max(0, Number(source.x) || 0)) * 960
    const y = Math.min(1, Math.max(0, Number(source.y) || 0)) * 600
    return {
      id: String(source.id || 'player-0'),
      slot: Number.isInteger(source.slot) ? source.slot : null,
      state: {
        x,
        y,
        hp: Math.max(0, Number(source.hp) || 0),
        maxHp: Math.max(1, Number(source.maxHp) || 100),
      },
      facing: ['up', 'down', 'left', 'right'].includes(source.facing) ? source.facing : 'down',
      moving: !!source.moving,
      attacking: !!source.attacking,
      dead: !!source.dead,
    }
  }

  function applyReplayPlayer(player, snapshot, local = false) {
    if (!player?.state) return null
    player.slot = Number.isInteger(snapshot.slot) ? snapshot.slot : player.slot ?? null
    player.state.x = snapshot.state.x
    player.state.y = snapshot.state.y
    player.state.hp = snapshot.state.hp
    player.state.maxHp = snapshot.state.maxHp
    player.facing = snapshot.facing
    player.moving = snapshot.moving
    player.attacking = snapshot.attacking
    player.dead = snapshot.dead

    if (local) {
      player.actor?.setPosition?.(player.state.x, player.state.y)
      scene.updateHealthBar?.(player.bar, player.state.x, player.state.y - 42, player.state.hp, player.state.maxHp)
      scene.syncPlayerAnimation?.(player.attacking ? 'attack' : null, player)
    } else {
      syncRemotePlayerPresentation(scene, player)
    }
    return player
  }

  function syncReplayPlayers(frame = {}) {
    const sources = normalizeDungeonReplayPlayers(frame)
    if (!sources.length) return

    const localSource = sources[0]
    const localPlayer = bindReplayLocalPlayer(localSource)
    const seen = new Set()

    for (const source of sources) {
      const snapshot = replayPlayerSnapshot(source)
      seen.add(snapshot.id)
      if (snapshot.id === String(localPlayer?.id)) {
        applyReplayPlayer(localPlayer, snapshot, true)
        continue
      }

      let player = scene.players instanceof Map ? scene.players.get(snapshot.id) : null
      if (!player) player = spawnRemotePlayer(scene, snapshot)
      applyReplayPlayer(player, snapshot, false)
    }

    if (!(scene.players instanceof Map)) return
    for (const player of [...scene.players.values()]) {
      if (player === localPlayer || seen.has(String(player.id))) continue
      despawnRemotePlayer(scene, player)
    }
  }

  function applyFrame(frame = {}) {
    if (!scene) return
    rebuildSceneIfNeeded(frame)
    syncReplayPlayers(frame)
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
      if (!scene?.localPlayer?.actor) {
        if (attempts++ < 90) requestAnimationFrame(attach)
        return
      }

      const firstFrame = $frameStore
      const finishAttach = () => {
        if (!game || !mount || !scene?.localPlayer?.actor) return
        replayProgress = normalizeProgress(firstFrame)
        applyRunSeed(firstFrame)
        clearLiveArtifacts()
        spatialRuntime = installDungeonSpatial(scene, {
          player: scene.localPlayer,
          getProgress: () => replayProgress,
          onEvent: () => {},
          label: (key) => key,
        })
        scene.update = (time) => {
          for (const drop of scene.drops ?? []) updateGroundDropPresentation(scene, drop, time)
        }
        ready = true
        activeSceneKey = ''
        applyFrame(firstFrame)
      }

      const queuedDropArt = queueGroundDropArt(scene)
      if (queuedDropArt > 0 && scene.load?.once && scene.load?.start) {
        scene.load.once('complete', finishAttach)
        scene.load.start()
        return
      }
      finishAttach()
    }
    requestAnimationFrame(attach)
  }

  onMount(() => {
    startReplay().catch((error) => console.warn('Dungeon replay surface failed:', error))
    return () => {
      destroyReplayPlayers()
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