import test from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const directory = path.dirname(fileURLToPath(import.meta.url))
const aliases = 'playerState|player|playerBar|playerFacing|playerMoving|playerAttacking|lastAttackAt|skillReadyAt|lastContactAt|dead'
const sceneAccess = new RegExp(`\\bscene(?:\\?\\.|\\.)(${aliases})\\b`, 'g')
const dungeonSceneAccess = new RegExp(`\\bthis(?:\\?\\.|\\.)(${aliases})\\b`, 'g')

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
    const patterns = filename === 'scene.js' ? [sceneAccess, dungeonSceneAccess] : [sceneAccess]
    for (let index = 0; index < lines.length; index++) {
      for (const pattern of patterns) {
        pattern.lastIndex = 0
        for (const match of lines[index].matchAll(pattern)) violations.push(`${filename}:${index + 1} ${match[0]}`)
      }
    }
  }

  assert.deepEqual(violations, [], `legacy Scene player aliases remain:\n${violations.join('\n')}`)
})
