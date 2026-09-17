<script>
  import { onMount } from 'svelte'
  import { createDungeonGame, chooseDungeonAssets } from './scene.js'
  import { loadPhaser } from './phaser.js'

  let { frameStore } = $props()

  let mount
  let game = null
  let scene = null
  let replayEnemies = []
  let ready = $state(false)

  $effect(() => {
    const frame = $frameStore
    if (scene && frame) applyFrame(frame)
  })

  function destroyReplayEnemies() {
    for (const enemy of replayEnemies) {
      enemy.visual?.destroy?.()
      scene?.destroyHealthBar?.(enemy.healthBar)
    }
    replayEnemies = []
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

  function rebuildArena(floor) {
    const nextFloor = Math.max(1, Number(floor) || 1)
    if (scene.floor === nextFloor && ready) return
    scene.floor = nextFloor
    scene.drawArena?.()
  }

  function enemyType(enemy = {}) {
    const value = String(enemy.archetype || enemy.kind || 'skeleton')
    if (['skeleton', 'fast', 'brute', 'ranged'].includes(value)) return value
    if (value === 'boss') return 'brute'
    return 'skeleton'
  }

  function ensureReplayEnemies(frameEnemies = []) {
    while (replayEnemies.length > frameEnemies.length) {
      const enemy = replayEnemies.pop()
      enemy.visual?.destroy?.()
      scene?.destroyHealthBar?.(enemy.healthBar)
    }

    while (replayEnemies.length < frameEnemies.length) {
      const index = replayEnemies.length
      const source = frameEnemies[index] ?? {}
      const boss = !!source.boss || source.kind === 'boss'
      const elite = !!source.elite || source.kind === 'elite'
      const visual = scene.makeActor?.(0, 0, 'enemy', enemyType(source))
      visual?.setDepth?.(boss || elite ? 12 : 10)
      if (boss) visual?.setTint?.(0xff705c)
      else if (elite) visual?.setTint?.(0xffd86b)
      const width = boss ? 150 : enemyType(source) === 'brute' ? 46 : 36
      const height = boss ? 11 : enemyType(source) === 'brute' ? 7 : 5
      const offset = boss ? 58 : 30
      replayEnemies.push({
        visual,
        boss,
        elite,
        barOffset: offset,
        healthBar: scene.createHealthBar?.(0, -offset, width, height, boss ? 0xffc857 : 0xff5964),
      })
    }
  }

  function applyFrame(frame = {}) {
    if (!scene) return
    rebuildArena(frame.progress?.floor)

    const width = 960
    const height = 600
    const player = frame.player ?? {}
    const px = Math.min(1, Math.max(0, Number(player.x) || 0)) * width
    const py = Math.min(1, Math.max(0, Number(player.y) || 0)) * height
    scene.localPlayer.state.x = px
    scene.localPlayer.state.y = py
    scene.localPlayer.state.hp = Number(frame.stats?.hp ?? scene.localPlayer.state.hp ?? 0)
    scene.localPlayer.state.maxHp = Math.max(1, Number(frame.stats?.maxHp ?? scene.localPlayer.state.maxHp ?? 100))
    scene.localPlayer.actor?.setPosition?.(px, py)
    scene.updateHealthBar?.(scene.localPlayer.bar, px, py - 42, scene.localPlayer.state.hp, scene.localPlayer.state.maxHp)

    const enemies = (frame.enemies ?? []).filter((enemy) => enemy.alive !== false)
    ensureReplayEnemies(enemies)
    enemies.forEach((source, index) => {
      const enemy = replayEnemies[index]
      const x = Math.min(1, Math.max(0, Number(source.x) || 0)) * width
      const y = Math.min(1, Math.max(0, Number(source.y) || 0)) * height
      const hp = Math.max(0, Number(source.hp ?? source.maxHp ?? 1))
      const maxHp = Math.max(1, Number(source.maxHp ?? (hp || 1)))
      enemy.visual?.setPosition?.(x, y)
      scene.updateHealthBar?.(enemy.healthBar, x, y - enemy.barOffset, hp, maxHp)
    })
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
      scene.scene?.pause?.()
      clearLiveArtifacts()
      ready = true
      applyFrame($frameStore)
    }
    requestAnimationFrame(attach)
  }

  onMount(() => {
    startReplay().catch((error) => console.warn('Dungeon replay surface failed:', error))
    return () => {
      destroyReplayEnemies()
      game?.destroy?.(true)
      game = null
      scene = null
    }
  })
</script>

<div bind:this={mount} class="dungeon-replay-surface"></div>

<style>
  .dungeon-replay-surface{width:960px;height:600px;overflow:hidden;background:#0b0d10}
  .dungeon-replay-surface :global(canvas){display:block!important;width:960px!important;height:600px!important;max-width:none!important;max-height:none!important}
</style>
