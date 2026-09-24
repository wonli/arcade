import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const archivePath = resolve(root, 'assets', 'kenney_topdownTanksRedux.zip')
const outputRoot = resolve(root, 'web', 'static', 'assets', 'tank')
const runtimeManifestPath = resolve(outputRoot, 'runtime-manifest.json')
const sourceURL = process.env.TANK_ASSET_SOURCE_URL || 'https://opengameart.org/sites/default/files/kenney_topdownTanksRedux.zip'
const requireFromWeb = createRequire(new URL('../web/package.json', import.meta.url))
const { unzipSync, zipSync } = requireFromWeb('fflate')
const encoder = new TextEncoder()

const wanted = Object.freeze({
  grass: 'tileGrass1.png',
  blueBody: 'tankBody_blue.png',
  blueTurret: 'tankBlue_barrel1.png',
  redBody: 'tankBody_red.png',
  redTurret: 'tankRed_barrel1.png',
  bullet: 'bulletBlue2.png',
  barrel: 'barrelRust_top.png',
  barricade: 'barricadeMetal.png',
  sandbag: 'sandbagBrown.png',
  tree: 'treeGreen_large.png',
  muzzle: 'shotLarge.png',
})

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

async function ensureArchive() {
  if (existsSync(archivePath) && statSync(archivePath).size > 0) return
  mkdirSync(dirname(archivePath), { recursive: true })
  console.log(`Downloading Kenney Top-down Tanks Redux from ${sourceURL}`)
  const response = await fetch(sourceURL, { redirect: 'follow' })
  if (!response.ok) throw new Error(`Tank source archive request failed: ${response.status}`)
  writeFileSync(archivePath, new Uint8Array(await response.arrayBuffer()))
  console.log(`Cached source archive at ${archivePath}`)
}

function findEntry(files, fileName) {
  const target = fileName.toLowerCase()
  const matches = Object.keys(files).filter((path) => basename(path).toLowerCase() === target && files[path]?.length)
  if (!matches.length) throw new Error(`Kenney tank archive is missing ${fileName}`)
  matches.sort((a, b) => a.length - b.length || a.localeCompare(b))
  return matches[0]
}

function removeOldBundles() {
  if (!existsSync(outputRoot)) return
  for (const name of readdirSync(outputRoot)) {
    if (/^tank-assets-[0-9a-f]+\.zip$/.test(name)) rmSync(resolve(outputRoot, name), { force: true })
  }
}

await ensureArchive()
const sourceFiles = unzipSync(new Uint8Array(readFileSync(archivePath)))
const bundleFiles = {}
const assets = {}
const entries = []

for (const [id, fileName] of Object.entries(wanted)) {
  const sourcePath = findEntry(sourceFiles, fileName)
  const publicPath = `/assets/tank/files/${fileName}`
  const archiveEntry = publicPath.slice(1)
  const bytes = sourceFiles[sourcePath]
  bundleFiles[archiveEntry] = bytes
  assets[id] = publicPath
  entries.push({ path: publicPath, sha256: sha256(bytes) })
}

entries.sort((a, b) => a.path.localeCompare(b.path))
const assetManifest = {
  source: {
    id: 'kenney-topdown-tanks-redux',
    name: 'Top-down Tanks Redux',
    author: 'Kenney',
    license: 'CC0-1.0',
    sourceUrl: 'https://kenney.nl/assets/top-down-tanks-redux',
  },
  assets,
}
const assetManifestBytes = encoder.encode(JSON.stringify(assetManifest, null, 2) + '\n')
bundleFiles['assets/tank/assets.json'] = assetManifestBytes
entries.push({ path: '/assets/tank/assets.json', sha256: sha256(assetManifestBytes) })

const version = createHash('sha256')
  .update(JSON.stringify({ entries, assetManifest }))
  .digest('hex')
  .slice(0, 16)
const zipName = `tank-assets-${version}.zip`

mkdirSync(outputRoot, { recursive: true })
removeOldBundles()
const zipBytes = zipSync(bundleFiles, { level: 6 })
writeFileSync(resolve(outputRoot, zipName), zipBytes)
writeFileSync(runtimeManifestPath, JSON.stringify({
  version,
  zip: `/assets/tank/${zipName}`,
  files: entries,
}, null, 2) + '\n')

console.log(`Prepared Tank asset package ${zipName} (${zipBytes.byteLength} bytes, ${Object.keys(assets).length} runtime assets)`)
