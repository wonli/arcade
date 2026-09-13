import test from 'node:test'
import assert from 'node:assert/strict'
import { sourceKeepsEnemyVisibleOnDeath } from './enemy-feedback-contract.js'

test('scene death path keeps the sprite available for the feedback runtime', () => {
  assert.equal(sourceKeepsEnemyVisibleOnDeath('killEnemy(enemy) {\n this.destroyHealthBar(enemy.healthBar)\n }'), true)
  assert.equal(sourceKeepsEnemyVisibleOnDeath('killEnemy(enemy) {\n enemy.visual.setVisible(false)\n }'), false)
})
