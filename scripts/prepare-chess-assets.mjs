import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const root = resolve(scriptDir, '..')
const source = join(root, 'assets', 'chess')
const output = join(root, 'web', 'static', 'assets', 'chess')

if (!existsSync(source)) throw new Error(`Missing chess assets: ${source}`)
mkdirSync(dirname(output), { recursive: true })
cpSync(source, output, { recursive: true, force: true })
console.log('Prepared chess assets')
