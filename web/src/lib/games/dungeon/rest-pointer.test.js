import test from 'node:test'
import assert from 'node:assert/strict'

import { bindRestChoicePointer } from './infinite-runtime.js'

test('rest choice text is interactive and selects its reward on pointer down', () => {
  let interactive = false
  let pointerHandler = null
  let selected = null
  const text = {
    setInteractive() { interactive = true; return this },
    on(event, handler) { if (event === 'pointerdown') pointerHandler = handler; return this },
  }

  bindRestChoicePointer(text, 2, (index) => { selected = index })

  assert.equal(interactive, true)
  assert.equal(typeof pointerHandler, 'function')
  pointerHandler()
  assert.equal(selected, 2)
})
