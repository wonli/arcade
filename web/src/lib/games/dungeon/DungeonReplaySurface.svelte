<script>
  import { onMount } from 'svelte'
  import { createDungeonGame, chooseDungeonAssets } from './scene.js'
  import { createDungeonReplayDriver } from './replay-driver.js'
  import { installDungeonPresentationStack } from './presentation-stack.js'
  import { loadPhaser } from './phaser.js'

  let { recording } = $props()

  let mount
  let game = null
  let driver = null
  let stopped = false

  async function startReplay() {
    const [Phaser, dungeonResponse, vfxResponse] = await Promise.all([
      loadPhaser(),
      fetch('/assets/debts/manifest.json').catch(() => null),
      fetch('/assets/vfx/manifest.json').catch(() => null),
    ])
    const manifest = dungeonResponse?.ok ? await dungeonResponse.json() : { png: [] }
    const vfxManifest = vfxResponse?.ok ? await vfxResponse.json() : { assets: [] }
    if (!mount || stopped) return

    game = createDungeonGame({
      Phaser,
      parent: mount,
      assets: chooseDungeonAssets(manifest),
      labels: {},
      onStats: () => {},
      onEvent: () => {},
      mode: 'replay',
    })

    let attempts = 0
    const attach = () => {
      if (stopped || !game || !mount) return
      const scene = game.scene?.getScene?.('Dungeon')
      if (!scene?.localPlayer?.actor || typeof scene.applyReplayState !== 'function' || typeof scene.presentEvent !== 'function') {
        if (attempts++ < 120) requestAnimationFrame(attach)
        return
      }

      installDungeonPresentationStack(scene, { vfxManifest })
      driver = createDungeonReplayDriver({ recording, scene, loop: true })
      driver.play()
    }
    requestAnimationFrame(attach)
  }

  onMount(() => {
    stopped = false
    startReplay().catch((error) => console.warn('Dungeon replay surface failed:', error))
    return () => {
      stopped = true
      driver?.destroy?.()
      driver = null
      game?.destroy?.(true)
      game = null
    }
  })
</script>

<div bind:this={mount} class="dungeon-replay-surface"></div>

<style>
  .dungeon-replay-surface{width:960px;height:600px;overflow:hidden;background:#0b0d10}
  .dungeon-replay-surface :global(canvas){display:block!important;width:960px!important;height:600px!important;max-width:none!important;max-height:none!important}
</style>