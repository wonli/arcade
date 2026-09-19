<script>
  import { onMount } from 'svelte'
  import { createDungeonGame, chooseDungeonAssets } from './scene.js'
  import { createDungeonReplayDriver, stateAt } from './replay-driver.js'
  import { installDungeonPresentationStack } from './presentation-stack.js'
  import { setProceduralRunSeed } from './spatial.js'
  import { installDungeonSpatial } from './spatial-runtime.js'
  import { loadPhaser } from './phaser.js'
  import { loadDungeonAssetBundle } from './asset-bundle.js'

  let { recording } = $props()

  let mount
  let game = null
  let driver = null
  let stopped = false
  let assetBundle = null

  function progressFromState(state = {}) {
    const value = state?.scene ?? state ?? {}
    return {
      floor: Math.max(1, Number(value.floor) || 1),
      chapter: Math.max(1, Number(value.chapter) || 1),
      chapterFloor: Math.max(1, Number(value.chapterFloor) || 1),
      roomRole: value.roomRole ?? 'combat',
    }
  }

  function applyRunSeed(state = {}) {
    const seed = String(state?.scene?.runSeed ?? '').trim().toUpperCase()
    setProceduralRunSeed(seed || null)
  }

  async function startReplay() {
    const [Phaser, bundle] = await Promise.all([loadPhaser(), loadDungeonAssetBundle()])
    if (!mount || stopped) {
      bundle.dispose()
      return
    }
    assetBundle = bundle
    const vfxManifest = bundle.vfxManifest

    const firstFrame = stateAt(recording, 0)
    applyRunSeed(firstFrame)

    game = createDungeonGame({
      Phaser,
      parent: mount,
      assets: chooseDungeonAssets(bundle.manifest, bundle.resolveAsset),
      assetManifest: bundle.manifest,
      resolveAsset: bundle.resolveAsset,
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

      scene.__replaySceneState = structuredClone(firstFrame.scene ?? {})
      installDungeonSpatial(scene, {
        player: scene.localPlayer,
        getProgress: () => progressFromState(scene.__replaySceneState),
        onEvent: () => {},
        label: (key) => key,
      })
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
      assetBundle?.dispose?.()
      assetBundle = null
      setProceduralRunSeed(null)
    }
  })
</script>

<div bind:this={mount} class="dungeon-replay-surface"></div>

<style>
  .dungeon-replay-surface{width:960px;height:600px;overflow:hidden;background:#0b0d10}
  .dungeon-replay-surface :global(canvas){display:block!important;width:960px!important;height:600px!important;max-width:none!important;max-height:none!important}
</style>
