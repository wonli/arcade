import test from 'node:test'
import assert from 'node:assert/strict'

import { randomId } from './identity.js'

test('uses native randomUUID when available', () => {
  assert.equal(randomId({ randomUUID: () => 'native-id' }), 'native-id')
})

test('falls back to UUID v4 using getRandomValues', () => {
  const cryptoImpl = {
    getRandomValues(bytes) {
      for (let i = 0; i < bytes.length; i++) bytes[i] = i
      return bytes
    },
  }
  const id = randomId(cryptoImpl)
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
})

test('falls back without crypto and still produces distinct ids', () => {
  let roll = 0.1
  const random = () => (roll += 0.1)
  const first = randomId(null, random, () => 123456)
  const second = randomId(null, random, () => 123456)
  assert.notEqual(first, second)
  assert.match(first, /^legacy-/)
})
