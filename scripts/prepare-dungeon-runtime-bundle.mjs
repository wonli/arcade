import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { dirname, posix, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chooseDungeonAssets } from '../web/src/lib/games/dungeon/scene.js'
import { chooseEnvironmentAssets } from '../web/src/lib/games/dungeon/environment-assets.js'
import { dungeon3Rules } from '../web/src/lib/games/dungeon/dungeon3-rules.js'
import { vfxPreloadCatalog } from '../web/src/lib/games/dungeon/vfx-runtime.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const staticRoot = resolve(root, 'web', 'static')
const bundleRoot = resolve(staticRoot, 'assets', 'dungeon')
const packageManifestPath = resolve(bundleRoot, 'runtime-manifest.json')
const requireFromWeb = createRequire(new URL('../web/package.json', import.meta.url))
const { zipSync } = requireFromWeb('fflate')
const textEncoder = new TextEncoder()
const dungeonTilesetRoot = '/assets/dungeon-tileset/dungeon-pixel-tileset-for-rpg-and-roguelike-game/Tiled_files'

function addAssetPaths(paths, value) {
  if (!value || typeof value !== 'object') return
  if (typeof value.path === 'string' && value.path.startsWith('/assets/')) paths.add(value.path)
  for (const child of Object.values(value)) addAssetPaths(paths, child)
}

function collectReferencedTilesets(names, value) {
  if (!value || typeof value !== 'object') return
  if (typeof value.tileset === 'string') names.add(value.tileset)
  for (const child of Object.values(value)) collectReferencedTilesets(names, child)
}

function addDungeon3RuleAssetPaths(paths) {
  const names = new Set()
  collectReferencedTilesets(names, dungeon3Rules)
  for (const name of names) {
    const image = dungeon3Rules.tilesets?.[name]?.image
    if (!image) continue
    paths.add(posix.normalize(posix.join(dungeonTilesetRoot, image)))
  }
}

function publicToDiskPath(publicPath) {
  return resolve(staticRoot, publicPath.slice(1))
}

function fileDigest(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

function reducedManifest(manifest, paths) {
  const assets = (manifest.assets ?? []).filter((asset) => paths.has(asset.path))
  return { ...manifest, assets, png: assets.map((asset) => asset.path) }
}

export function selectRuntimeManifests(manifest, vfxManifest) {
  const paths = new Set([
    '/assets/dungeon/m1.m4a',
    '/assets/dungeon/sfx/r1.wav',
    '/assets/dungeon/sfx/m1.wav',
    '/assets/dungeon/sfx/m2.wav',
    '/assets/dungeon/sfx/m3.wav',
  ])
  addAssetPaths(paths, chooseDungeonAssets(manifest))
  addAssetPaths(paths, chooseEnvironmentAssets(manifest))
  addAssetPaths(paths, vfxPreloadCatalog(vfxManifest))
  addDungeon3RuleAssetPaths(paths)
  return {
    paths: [...paths].sort(),
    manifest: reducedManifest(manifest, paths),
    vfxManifest: { ...vfxManifest, assets: (vfxManifest.assets ?? []).filter((asset) => paths.has(asset.path)) },
  }
}

export function runtimeBundleVersion(entries, manifest, vfxManifest) {
  return createHash('sha256')
    .update(JSON.stringify({ entries, manifest, vfxManifest }))
    .digest('hex')
    .slice(0, 16)
}

function archiveFiles(paths, manifest, vfxManifest) {
  const files = {}
  for (const publicPath of paths) {
    const source = publicToDiskPath(publicPath)
    if (!existsSync(source)) throw new Error(`Missing runtime asset: ${publicPath}`)
    files[publicPath.slice(1)] = readFileSync(source)
  }
  files['assets/debts/manifest.json'] = textEncoder.encode(JSON.stringify(manifest) + '\n')
  files['assets/vfx/manifest.json'] = textEncoder.encode(JSON.stringify(vfxManifest) + '\n')
  return files
}

function main() {
  const debtsPath = resolve(staticRoot, 'assets', 'debts', 'manifest.json')
  const vfxPath = resolve(staticRoot, 'assets', 'vfx', 'manifest.json')
  if (!existsSync(debtsPath) || !existsSync(vfxPath)) throw new Error('Run prepare-dungeon-assets.mjs before preparing the runtime bundle')

  const selected = selectRuntimeManifests(JSON.parse(readFileSync(debtsPath)), JSON.parse(readFileSync(vfxPath)))
  const entries = selected.paths.map((publicPath) => ({ path: publicPath, sha256: fileDigest(publicToDiskPath(publicPath)) }))
  const version = runtimeBundleVersion(entries, selected.manifest, selected.vfxManifest)
  const zipName = `dungeon-assets-${version}.zip`

  mkdirSync(bundleRoot, { recursive: true })
  for (const name of readdirSync(bundleRoot)) if (/^dungeon-(?:runtime|assets)-[0-9a-f]+\.zip$/.test(name)) rmSync(resolve(bundleRoot, name), { force: true })

  const zipPath = resolve(bundleRoot, zipName)
  writeFileSync(zipPath, zipSync(archiveFiles(selected.paths, selected.manifest, selected.vfxManifest), { level: 6 }))
  writeFileSync(packageManifestPath, JSON.stringify({ version, zip: `/assets/dungeon/${zipName}`, files: entries }, null, 2) + '\n')
  const bytes = statSync(zipPath).size
  console.log(`Prepared Dungeon asset package ${zipName} (${bytes} bytes, ${selected.paths.length} assets)`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
