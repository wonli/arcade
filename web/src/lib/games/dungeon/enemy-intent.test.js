import test from 'node:test'
import assert from 'node:assert/strict'
import { enemyIntentProfile } from './enemy-behavior.js'

test('enemy intent cues stay short and readable',()=>{const fast=enemyIntentProfile('fast'),brute=enemyIntentProfile('brute'),ranged=enemyIntentProfile('ranged');assert.ok(fast.leadMs>0&&fast.leadMs<300);assert.equal(brute.leadMs,420);assert.ok(ranged.leadMs>=120);assert.ok(fast.scaleY<1);assert.ok(brute.scaleY>1);assert.ok(ranged.flash)})
