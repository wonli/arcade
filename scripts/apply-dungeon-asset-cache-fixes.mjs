import { readFileSync, writeFileSync } from 'node:fs'

function replaceOnce(path, before, after) {
  const source = readFileSync(path, 'utf8')
  if (!source.includes(before)) throw new Error(`Expected patch target not found in ${path}`)
  const next = source.replace(before, after)
  if (next === source) throw new Error(`Patch made no change in ${path}`)
  writeFileSync(path, next)
}

replaceOnce(
  'web/src/routes/dungeon/+page.svelte',
  `  async function loadGameResources() {
    if (gameResources) return gameResources
    const [Phaser, bundle] = await Promise.all([loadPhaser(), loadDungeonAssetBundle({ onProgress: (next) => { assetProgress = next } })])
    return gameResources = { Phaser, assets: chooseDungeonAssets(bundle.manifest, bundle.resolveAsset), vfxManifest: bundle.vfxManifest, assetManifest: bundle.manifest, resolveAsset: bundle.resolveAsset, dispose: bundle.dispose }
  }`,
  `  async function loadGameResources() {
    if (gameResources) return gameResources
    const [Phaser, bundle] = await Promise.all([loadPhaser(), loadDungeonAssetBundle({ onProgress: (next) => { assetProgress = next } })])
    if (!mounted) {
      bundle.dispose()
      return null
    }
    return gameResources = { Phaser, assets: chooseDungeonAssets(bundle.manifest, bundle.resolveAsset), vfxManifest: bundle.vfxManifest, assetManifest: bundle.manifest, resolveAsset: bundle.resolveAsset, dispose: bundle.dispose }
  }`,
)

replaceOnce(
  'web/src/routes/dungeon/+page.svelte',
  `      const { Phaser, assets, vfxManifest } = await loadGameResources()
      if (!mounted) return`,
  `      const loaded = await loadGameResources()
      if (!loaded || !mounted) return
      const { Phaser, assets, vfxManifest } = loaded`,
)

replaceOnce(
  'web/src/routes/room/[code]/dungeon/+page.svelte',
  `  let mount
  let game = null`,
  `  let mount
  let stopped = false
  let game = null`,
)

replaceOnce(
  'web/src/routes/room/[code]/dungeon/+page.svelte',
  `  async function loadResources() {
    if (resources) return resources
    const [Phaser, bundle] = await Promise.all([
      loadPhaser(),
      loadDungeonAssetBundle({ onProgress: (next) => { assetProgress = next } }),
    ])
    resources = { Phaser, assets: chooseDungeonAssets(bundle.manifest, bundle.resolveAsset), vfxManifest: bundle.vfxManifest, assetManifest: bundle.manifest, resolveAsset: bundle.resolveAsset, dispose: bundle.dispose }
    return resources
  }`,
  `  async function loadResources() {
    if (resources) return resources
    const [Phaser, bundle] = await Promise.all([
      loadPhaser(),
      loadDungeonAssetBundle({ onProgress: (next) => { assetProgress = next } }),
    ])
    if (stopped) {
      bundle.dispose()
      return null
    }
    resources = { Phaser, assets: chooseDungeonAssets(bundle.manifest, bundle.resolveAsset), vfxManifest: bundle.vfxManifest, assetManifest: bundle.manifest, resolveAsset: bundle.resolveAsset, dispose: bundle.dispose }
    return resources
  }`,
)

replaceOnce(
  'web/src/routes/room/[code]/dungeon/+page.svelte',
  `  async function startGame() {
    const { Phaser, assets, vfxManifest, assetManifest, resolveAsset } = await loadResources()
    if (!mount) return`,
  `  async function startGame() {
    const loaded = await loadResources()
    if (!loaded || !mount) return
    const { Phaser, assets, vfxManifest, assetManifest, resolveAsset } = loaded`,
)

replaceOnce(
  'web/src/routes/room/[code]/dungeon/+page.svelte',
  `  onMount(() => {
    unsubscribeLocale = subscribeLocale(applyLocale)`,
  `  onMount(() => {
    stopped = false
    unsubscribeLocale = subscribeLocale(applyLocale)`,
)

replaceOnce(
  'web/src/routes/room/[code]/dungeon/+page.svelte',
  `    return () => {
      if (replayTimer) clearInterval(replayTimer)`,
  `    return () => {
      stopped = true
      if (replayTimer) clearInterval(replayTimer)`,
)

replaceOnce(
  'web/src/routes/dungeon/editor/+page.svelte',
  `      const [configResult, loaded] = await Promise.all([configClient.load(), loadResources()])
      if (!mounted) return`,
  `      const [configResult, loaded] = await Promise.all([configClient.load(), loadResources()])
      if (!mounted) {
        loaded.dispose()
        return
      }`,
)

replaceOnce(
  'web/src/lib/games/dungeon/asset-cache-contract.test.js',
  `  assert.match(coop, /async function loadResources\\(\\)[\\s\\S]*?if\\s*\\(!mounted\\)\\s*\\{\\s*bundle\\.dispose\\(\\)\\s*return null\\s*\\}/)`,
  `  assert.match(coop, /async function loadResources\\(\\)[\\s\\S]*?if\\s*\\(stopped\\)\\s*\\{\\s*bundle\\.dispose\\(\\)\\s*return null\\s*\\}/)`,
)
