import test from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const directory = path.dirname(fileURLToPath(import.meta.url))
const legacyScenePlayerAccess = /\b(?:scene|this)\.(playerState|player|playerBar|playerFacing|playerMoving|playerAttacking|lastAttackAt|skillReadyAt|lastContactAt|dead)\b/g

async function productionFiles() {
  const entries = await readdir(directory, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.js') && !entry.name.endsWith('.test.js'))
    .map((entry) => entry.name)
    .sort()
}

test('Dungeon production code has no legacy Scene player aliases', async () => {
  const violations = []

  for (const filename of await productionFiles()) {
    const source = await readFile(path.join(directory, filename), 'utf8')
    const lines = source.split('\n')
    for (let index = 0; index < lines.length; index++) {
      for (const match of lines[index].matchAll(legacyScenePlayerAccess)) {
        violations.push(`${filename}:${index + 1} ${match[0]}`)
      }
    }
  }

  assert.deepEqual(violations, [], `legacy Scene player aliases remain:\n${violations.join('\n')}`)
})
