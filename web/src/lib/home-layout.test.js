import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const homeSource = readFileSync(new URL('../routes/+page.svelte', import.meta.url), 'utf8')

test('home keeps gameplay help above the settings block inside the join panel', () => {
  const setupIndex = homeSource.indexOf('<section class="setup">')
  const helpIndex = homeSource.indexOf('<LauncherHelp')
  const actionsIndex = homeSource.indexOf('<div class="setup-actions">')
  const joinBlockIndex = homeSource.indexOf('<div class="join-block">')
  const settingsBlockIndex = homeSource.indexOf('<div class="setup-block">')
  const settingsLabelIndex = homeSource.indexOf('<div class="section-label">{t(\'home.setup\')}</div>')
  const controlsIndex = homeSource.indexOf('<div class="setup-controls">')
  const difficultyIndex = homeSource.indexOf('<div class="difficulty-picker"')
  const joinIndex = homeSource.indexOf('<div class="join">')

  assert.ok(setupIndex < helpIndex, 'how-to must stay inside the right setup panel')
  assert.ok(helpIndex < actionsIndex, 'how-to must appear before launcher actions')
  assert.ok(actionsIndex < joinBlockIndex, 'join panel must stay inside launcher actions')
  assert.ok(joinBlockIndex < settingsBlockIndex, 'settings block must be inside the join panel')
  assert.ok(settingsBlockIndex < settingsLabelIndex, 'settings label must be inside the settings block')
  assert.ok(settingsLabelIndex < joinIndex, 'settings label must precede room join controls')
  assert.ok(joinIndex < controlsIndex, 'room join controls must precede settings controls')
  assert.ok(difficultyIndex < controlsIndex, 'chess difficulty must precede player mode controls')
  assert.match(
    homeSource,
    /<div class="setup-block">[\s\S]*<div class="join">[\s\S]*<\/div>\s*\{\/if\}\s*<div class="setup-controls">/,
    'room code controls must remain inside the setup block',
  )
  assert.doesNotMatch(homeSource, /home\.orJoin|class="divider"/, 'room join must not show the obsolete divider label')
  assert.doesNotMatch(homeSource, /<section class="how-to">/)
})
