<script>
  import { onMount } from 'svelte'
  import { loadTankAssetBundle } from './asset-bundle.js'
  import TankGameSurface from './TankGameSurface.svelte'

  let { frameStore } = $props()
  let assetUrls = $state(null)
  let assetError = $state('')
  let bundle = null

  const assetKeys = ['grass','blueBody','blueTurret','redBody','redTurret','bullet','barrel','barricade','sandbag','tree','muzzle']

  onMount(() => {
    let stopped = false
    void loadTankAssetBundle().then((loaded) => {
      if (stopped) { loaded.dispose(); return }
      bundle = loaded
      assetUrls = Object.fromEntries(assetKeys.map((key) => [key, loaded.asset(key)]))
    }).catch((error) => {
      if (!stopped) assetError = error?.message ?? String(error)
    })
    return () => {
      stopped = true
      bundle?.dispose()
    }
  })
</script>

<div class="surface">
  {#if assetUrls}
    <TankGameSurface state={$frameStore} {assetUrls} compact={true} />
  {:else if assetError}
    <div class="asset-error">Tank assets unavailable</div>
  {:else}
    <div class="loading">PREPARING TANK ASSETS…</div>
  {/if}
</div>

<style>
  .surface{width:1164px;height:700px;display:grid;place-items:center;padding:24px;box-sizing:border-box;background:#0b0d10;color:#f4f0e8;overflow:hidden}.surface :global(.tank-surface){width:100%}.loading,.asset-error{font:900 14px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.12em}.asset-error{color:#ff8d8d}
</style>
