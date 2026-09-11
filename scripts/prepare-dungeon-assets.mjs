import { execFileSync } from 'node:child_process'
import { readdirSync, rmSync, mkdirSync, writeFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const root = resolve(scriptDir, '..')
const archive = join(root, 'assets', 'DebtsInTheDepthsAssets.zip')
const output = join(root, 'web', 'static', 'assets', 'debts')

rmSync(output, { recursive: true, force: true })
mkdirSync(output, { recursive: true })
execFileSync('unzip', ['-q', '-o', archive, '-d', output], { stdio: 'inherit' })

function walk(dir) {
  const files = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const stat = statSync(full)
    if (stat.isDirectory()) files.push(...walk(full))
    else if (/\.png$/i.test(name)) files.push('/assets/debts/' + relative(output, full).split('\\').join('/'))
  }
  return files
}

const manifest = {
  source: 'Debts in the Depths by Reaktori',
  license: 'CC0-1.0',
  png: walk(output).sort(),
}

writeFileSync(join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
console.log(`Prepared ${manifest.png.length} dungeon PNG assets`)
