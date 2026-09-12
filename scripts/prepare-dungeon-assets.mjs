import { execFileSync } from 'node:child_process'
import { chmodSync, copyFileSync, existsSync, lstatSync, readdirSync, readFileSync, rmSync, mkdirSync, writeFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describeDungeonAsset, describeDungeonTilesetAsset, describeRpgMainCharacterAsset } from '../web/src/lib/games/dungeon/assets.js'
import { classifyVfxAsset } from '../web/src/lib/games/dungeon/vfx-assets.js'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const root = resolve(scriptDir, '..')
const packs = [
  { source: 'debts', archive: join(root, 'assets', 'DebtsInTheDepthsAssets.zip'), output: join(root, 'web', 'static', 'assets', 'debts'), publicBase: '/assets/debts/' },
  { source: 'rpg-main-character', archive: join(root, 'assets', 'RPGMCharacter_v1.0.zip'), output: join(root, 'web', 'static', 'assets', 'rpg-main-character'), publicBase: '/assets/rpg-main-character/' },
  { source: 'dungeon-tileset', archive: join(root, 'assets', 'dungeon-pixel-tileset-for-rpg-and-roguelike-game.zip'), output: join(root, 'web', 'static', 'assets', 'dungeon-tileset'), publicBase: '/assets/dungeon-tileset/' },
]

const vfxPacks = [
  ['foozle', 'Foozle_2DE0001_Pixel_Magic_Effects.zip'],
  ['lightning', 'Lightning.zip'],
  ['spell-effects', 'Spell Effects.zip'],
  ['free-pixel-magic', 'free-pixel-magic-sprite-effects-pack.zip'],
  ['kenney-particles', 'kenney_particle-pack.zip'],
].map(([source, archiveName]) => ({ source, archive: join(root, 'assets', archiveName), output: join(root, 'web', 'static', 'assets', 'vfx', source), publicBase: `/assets/vfx/${source}/` }))

function makeWritable(target) {
  if (!existsSync(target)) return
  const stat = lstatSync(target)
  if (stat.isDirectory()) {
    chmodSync(target, 0o755)
    for (const name of readdirSync(target)) makeWritable(join(target, name))
    return
  }
  chmodSync(target, 0o644)
}

function pngSize(file) {
  const header = readFileSync(file).subarray(0, 24)
  if (header.length < 24 || header.toString('ascii', 1, 4) !== 'PNG') return null
  return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) }
}

function pngHasAlpha(file) {
  const bytes = readFileSync(file)
  if (bytes.length < 26 || bytes.toString('ascii', 1, 4) !== 'PNG') return false
  const colorType = bytes[25]
  if (colorType === 4 || colorType === 6) return true
  return bytes.includes(Buffer.from('tRNS', 'ascii'))
}

function inferVfxFrames(width, height) {
  if (width > height && width % height === 0) {
    const frames = width / height
    if (frames >= 2 && frames <= 32) return { frames, frameWidth: height, frameHeight: height }
  }
  if (height > width && height % width === 0) {
    const frames = height / width
    if (frames >= 2 && frames <= 32) return { frames, frameWidth: width, frameHeight: width }
  }
  return { frames: 1, frameWidth: width, frameHeight: height }
}

function classifyEnvironmentKind(path) {
  const lower = path.toLowerCase()
  if (/water|pool|river|liquid/.test(lower)) return 'water'
  if (/chest|coffer|treasure/.test(lower)) return 'chest'
  if (/torch|brazier|candle|lantern|flame/.test(lower)) return 'torch'
  if (/pillar|column|statue|crate|barrel|rock|boulder|bones|skull/.test(lower)) return 'obstacle'
  if (/wall|border|brick/.test(lower)) return 'wall'
  if (/floor|ground|tile/.test(lower)) return 'floor'
  return null
}

function walk(pack, dir) {
  const files = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const stat = statSync(full)
    if (stat.isDirectory()) { files.push(...walk(pack, full)); continue }
    if (!/\.png$/i.test(name)) continue
    const path = pack.publicBase + relative(pack.output, full).split('\\').join('/')
    const size = pngSize(full)
    if (!size) continue
    let layout
    if (pack.source === 'debts') layout = describeDungeonAsset(path, size.width, size.height)
    else if (pack.source === 'rpg-main-character') layout = describeRpgMainCharacterAsset(path, size.width, size.height)
    else layout = { ...describeDungeonTilesetAsset(path, size.width, size.height), kind: classifyEnvironmentKind(path) }
    files.push({ path, source: pack.source, width: size.width, height: size.height, ...layout })
  }
  return files
}

function walkVfx(pack, dir) {
  const files = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const stat = statSync(full)
    if (stat.isDirectory()) { files.push(...walkVfx(pack, full)); continue }
    if (!/\.png$/i.test(name)) continue
    const size = pngSize(full)
    if (!size) continue
    const path = pack.publicBase + relative(pack.output, full).split('\\').join('/')
    const classified = classifyVfxAsset(path, size.width, size.height, { hasAlpha: pngHasAlpha(full) })
    if (!classified) continue
    files.push({ ...classified, source: pack.source, ...inferVfxFrames(size.width, size.height) })
  }
  return files
}

function extractZip(pack) {
  if (!existsSync(pack.archive)) { console.warn(`Skipping missing archive ${pack.archive}`); return false }
  makeWritable(pack.output)
  rmSync(pack.output, { recursive: true, force: true })
  mkdirSync(pack.output, { recursive: true })
  execFileSync('unzip', ['-q', '-o', pack.archive, '-d', pack.output], { stdio: 'inherit' })
  return true
}

const assets = []
for (const pack of packs) {
  if (!extractZip(pack)) continue
  const packAssets = walk(pack, pack.output).sort((a, b) => a.path.localeCompare(b.path))
  assets.push(...packAssets)
  console.log(`Prepared ${packAssets.length} ${pack.source} PNG assets`)
  if (pack.source === 'dungeon-tileset') {
    console.log('Dungeon tileset inventory:')
    for (const asset of packAssets) console.log(`  ${asset.width}x${asset.height}\t${asset.frameWidth}x${asset.frameHeight}\t${asset.frames}f\t${asset.kind ?? '-'}\t${asset.path}`)
  }
}

const manifest = {
  sources: [
    { id: 'debts', name: 'Debts in the Depths by Reaktori', license: 'CC0-1.0' },
    { id: 'rpg-main-character', name: 'RPG Main Character by Szadi art.' },
    { id: 'dungeon-tileset', name: 'Dungeon Pixel Tileset for RPG and Roguelike Game' },
  ],
  assets: assets.sort((a, b) => a.path.localeCompare(b.path)),
  png: assets.map((asset) => asset.path),
}

const manifestDir = join(root, 'web', 'static', 'assets', 'debts')
writeFileSync(join(manifestDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')

const vfxAssets = []
for (const pack of vfxPacks) {
  if (!extractZip(pack)) continue
  const packAssets = walkVfx(pack, pack.output).sort((a, b) => a.path.localeCompare(b.path))
  vfxAssets.push(...packAssets)
  console.log(`Prepared ${packAssets.length} classified ${pack.source} VFX assets`)
}
const vfxRoot = join(root, 'web', 'static', 'assets', 'vfx')
mkdirSync(vfxRoot, { recursive: true })
writeFileSync(join(vfxRoot, 'manifest.json'), JSON.stringify({ sources: vfxPacks.map((pack) => ({ id: pack.source })), assets: vfxAssets.sort((a, b) => a.path.localeCompare(b.path)) }, null, 2) + '\n')

const dungeonAudioDir = join(root, 'web', 'static', 'assets', 'dungeon')
mkdirSync(dungeonAudioDir, { recursive: true })
copyFileSync(join(root, 'assets', 'm1.m4a'), join(dungeonAudioDir, 'm1.m4a'))
console.log(`Prepared ${manifest.assets.length} dungeon PNG assets total`)
console.log(`Prepared ${vfxAssets.length} classified dungeon VFX assets total`)
console.log('Prepared dungeon music asset m1.m4a')
