import test from 'node:test'
import assert from 'node:assert/strict'
import { createDungeonEditorConfigClient } from './editor-config.js'

function response(body, ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }
}

test('load returns source and config', async () => {
  const calls = []
  const client = createDungeonEditorConfigClient(async (url, options = {}) => {
    calls.push([url, options])
    return response({ source: 'embedded', config: { version: 1 } })
  })
  const result = await client.load()
  assert.equal(result.source, 'embedded')
  assert.equal(result.config.version, 1)
  assert.equal(calls[0][0], '/api/dungeon/config/weapon-presentation')
})

test('save PUTs complete config', async () => {
  let request
  const client = createDungeonEditorConfigClient(async (url, options) => {
    request = { url, options }
    return response({ source: 'override', config: { version: 1 } })
  })
  await client.save({ version: 1, defaults: { scale: 1 } })
  assert.equal(request.options.method, 'PUT')
  assert.deepEqual(JSON.parse(request.options.body), { version: 1, defaults: { scale: 1 } })
})

test('reset DELETEs override', async () => {
  let method
  const client = createDungeonEditorConfigClient(async (_url, options) => {
    method = options.method
    return response({ source: 'embedded', config: { version: 1 } })
  })
  const result = await client.reset()
  assert.equal(method, 'DELETE')
  assert.equal(result.source, 'embedded')
})
