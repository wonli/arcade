import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

import { chooseDungeonAssets } from '../web/src/lib/games/dungeon/scene.js'
import { chooseEnvironmentAssets } from '../web/src/lib/games/dungeon/environment-assets.js'
import { vfxPreloadCatalog } from '../web/src/lib/games/dungeon/vfx-runtime.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const staticRoot = join(root, 'web', 'static')
const bundleRoot = join(staticRoot, 'assets', 'dungeon')
const packageManifestPath = join(bundleRoot, 'runtime-manifest.json')

function addAssetPaths(paths, value) {
  if (!value || typeof value !== 'object') return
  if (typeof value.path === 'string' && value.path.startsWith('/assets/')) paths.add(value.path)
  for (const child of Object.values(value)) addAssetPaths(paths, child)
}

function publicToDiskPath(publicPath) {
  return join(staticRoot, publicPath.slice(1))
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
  return {
    paths: [...paths].sort(),
    manifest: reducedManifest(manifest, paths),
    vfxManifest: { ...vfxManifest, assets: (vfxManifest.assets ?? []).filter((asset) => paths.has(asset.path)) },
  }
}

function prepareStaging(paths, manifest, vfxManifest) {
  const staging = join(tmpdir(), `aqi-dungeon-runtime-${process.pid}-${Date.now()}`)
  mkdirSync(staging, { recursive: true })
  const copy = (publicPath) => {
    const source = publicToDiskPath(publicPath)
    if (!existsSync(source)) throw new Error(`Missing runtime asset: ${publicPath}`)
    const target = join(staging, publicPath.slice(1))
    mkdirSync(dirname(target), { recursive: true })
    copyFileSync(source, target)
  }
  for (const publicPath of paths) copy(publicPath)
  mkdirSync(join(staging, 'assets', 'debts'), { recursive: true })
  mkdirSync(join(staging, 'assets', 'vfx'), { recursive: true })
  writeFileSync(join(staging, 'assets/debts/manifest.json'), JSON.stringify(manifest) + '\n')
  writeFileSync(join(staging, 'assets/vfx/manifest.json'), JSON.stringify(vfxManifest) + '\n')
  return staging
}

function main() {
  const debtsPath = join(staticRoot, 'assets', 'debts', 'manifest.json')
  const vfxPath = join(staticRoot, 'assets', 'vfx', 'manifest.json')
  if (!existsSync(debtsPath) || !existsSync(vfxPath)) throw new Error('Run prepare-dungeon-assets.mjs before preparing the runtime bundle')

  const selected = selectRuntimeManifests(JSON.parse(readFileSync(debtsPath)), JSON.parse(readFileSync(vfxPath)))
  const entries = selected.paths.map((publicPath) => ({ path: publicPath, sha256: fileDigest(publicToDiskPath(publicPath)) }))
  const version = createHash('sha256').update(JSON.stringify(entries)).digest('hex').slice(0, 16)
  const zipName = `dungeon-assets-${version}.zip`
  const staging = prepareStaging(selected.paths, selected.manifest, selected.vfxManifest)
  try {
    mkdirSync(bundleRoot, { recursive: true })
    for (const name of readdirSync(bundleRoot)) if (/^dungeon-(?:runtime|assets)-[0-9a-f]+\.zip$/.test(name)) rmSync(join(bundleRoot, name), { force: true })
    execFileSync('zip', ['-q', '-r', join(bundleRoot, zipName), '.'], { cwd: staging })
    writeFileSync(packageManifestPath, JSON.stringify({ version, zip: `/assets/dungeon/${zipName}`, files: entries }, null, 2) + '\n')
    const bytes = statSync(join(bundleRoot, zipName)).size
    console.log(`Prepared Dungeon asset package ${zipName} (${bytes} bytes, ${selected.paths.length} assets)`)
  } finally {
    rmSync(staging, { recursive: true, force: true })
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
