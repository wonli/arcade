import { execFileSync } from 'node:child_process'
import { chmodSync, existsSync, lstatSync, readdirSync, readFileSync, rmSync, mkdirSync, writeFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const root = resolve(scriptDir, '..')
const archive = join(root, 'assets', 'DebtsInTheDepthsAssets.zip')
const output = join(root, 'web', 'static', 'assets', 'debts')

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

makeWritable(output)
rmSync(output, { recursive: true, force: true })
mkdirSync(output, { recursive: true })
execFileSync('unzip', ['-q', '-o', archive, '-d', output], { stdio: 'inherit' })

function pngSize(file) {
  const header = readFileSync(file).subarray(0, 24)
  if (header.length < 24 || header.toString('ascii', 1, 4) !== 'PNG') return null
  return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) }
}

function frameCount(path, width, height) {
  const actor = /character|creature|wizard|dragon|slime|skeleton|goblin|bat|monster|enemy|rat/i.test(path)
  if (!actor || width % 4 !== 0) return 1
  const frameWidth = width / 4
  if (frameWidth < 4 || frameWidth > height * 1.5) return 1
  return 4
}

function walk(dir) {
  const files = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      files.push(...walk(full))
      continue
    }
    if (!/\.png$/i.test(name)) continue

    const path = '/assets/debts/' + relative(output, full).split('\\').join('/')
    const size = pngSize(full)
    if (!size) continue
    const frames = frameCount(path, size.width, size.height)
    files.push({
      path,
      width: size.width,
      height: size.height,
      frames,
      frameWidth: Math.floor(size.width / frames),
      frameHeight: size.height,
    })
  }
  return files
}

const assets = walk(output).sort((a, b) => a.path.localeCompare(b.path))
const manifest = {
  source: 'Debts in the Depths by Reaktori',
  license: 'CC0-1.0',
  assets,
  png: assets.map((asset) => asset.path),
}

writeFileSync(join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
console.log(`Prepared ${manifest.assets.length} dungeon PNG assets`)
