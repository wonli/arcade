import test from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const directory = path.dirname(fileURLToPath(import.meta.url))
const legacyAliases = [
  'playerState',
  'player',
  'playerBar',
  'playerFacing',
  'playerMoving',
  'playerAttacking',
  'lastAttackAt',
  'skillReadyAt',
  'lastContactAt',
  'dead',
]
const playerFields = [
  'state',
  'actor',
  'bar',
  'facing',
  'moving',
  'attacking',
  'lastAttackAt',
  'skillReadyAt',
  'lastContactAt',
  'dead',
]
const sceneAccess = new RegExp(`\\bscene(?:\\?\\.|\\.)(${legacyAliases.join('|')})\\b`, 'g')
const dungeonSceneAccess = new RegExp(`\\bthis(?:\\?\\.|\\.)(${legacyAliases.join('|')})\\b`, 'g')
const directLocalPlayerAccess = new RegExp(
  `\\bscene(?:\\?\\.|\\.)localPlayer(?:\\?\\.|\\.)(${playerFields.join('|')})\\b`,
  'g',
)

async function productionFiles(root = directory) {
  const files = []
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.name === 'test') continue
    const fullPath = path.join(root, entry.name)
    if (entry.isDirectory()) {
      files.push(...await productionFiles(fullPath))
      continue
    }
    if (!entry.name.endsWith('.js') || entry.name.endsWith('.test.js')) continue
    files.push(fullPath)
  }
  return files.sort()
}

function sourceViolations(source, filename, patterns) {
  const violations = []
  const lines = source.split('\n')
  for (let index = 0; index < lines.length; index++) {
    for (const pattern of patterns) {
      pattern.lastIndex = 0
      for (const match of lines[index].matchAll(pattern)) {
        violations.push(`${path.relative(directory, filename)}:${index + 1} ${match[0]}`)
      }
    }
  }
  return violations
}

test('Dungeon production code has no legacy Scene player aliases', async () => {
  const violations = []

  for (const filename of await productionFiles()) {
    const source = await readFile(filename, 'utf8')
    const patterns = path.basename(filename) === 'scene.js'
      ? [sceneAccess, dungeonSceneAccess]
      : [sceneAccess]
    violations.push(...sourceViolations(source, filename, patterns))
  }

  assert.deepEqual(violations, [], `legacy Scene player aliases remain:\n${violations.join('\n')}`)
})

test('Dungeon runtimes do not dereference scene.localPlayer gameplay fields', async () => {
  const violations = []

  for (const filename of await productionFiles()) {
    if (path.basename(filename) === 'scene.js') continue
    const source = await readFile(filename, 'utf8')
    violations.push(...sourceViolations(source, filename, [directLocalPlayerAccess]))
  }

  assert.deepEqual(
    violations,
    [],
    `runtime code must use its bound PlayerEntity instead of scene.localPlayer gameplay fields:\n${violations.join('\n')}`,
  )
})
