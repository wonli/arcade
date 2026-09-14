import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const source = readFileSync(fileURLToPath(new URL('./attack-runtime.js', import.meta.url)), 'utf8')
const thunderStart = source.indexOf('effects.thunder')
const thunderEnd = source.indexOf("groupSkill === 'whirlwind'", thunderStart)
const thunderBlock = source.slice(Math.max(0, thunderStart - 80), thunderEnd)

test('thunder rolls directly from its affix chance without requiring a critical hit', () => {
  assert.doesNotMatch(thunderBlock, /critical\s*&&\s*effects\.thunder/)
  assert.match(thunderBlock, /effects\.thunder\s*>\s*0\s*&&\s*random\(\)\s*<\s*effects\.thunder/)
})

test('thunder damages the primary strike and every chained target', () => {
  assert.doesNotMatch(thunderBlock, /index\s*!==\s*0/)
  assert.match(thunderBlock, /scene\.damageEnemy\(\s*segment\.to,/s)
  assert.match(thunderBlock, /source:\s*'thunder'/)
})

test('thunder renders a lightning resource for every segment', () => {
  assert.match(thunderBlock, /segments\.forEach\([\s\S]*__dungeonVfx\?\.lightning\?\.\(segment\.from,\s*segment\.to/)
})
