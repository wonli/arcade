import test from 'node:test'
import assert from 'node:assert/strict'

import { installCoopBacktrackRuntime } from './coop-backtrack-runtime.js'

function label() {
  return {
    text: '',
    destroyed: false,
    setOrigin() { return this },
    setDepth() { return this },
    setText(value) { this.text = String(value); return this },
    setPosition(x, y) { this.x = x; this.y = y; return this },
    destroy() { this.destroyed = true },
  }
}

function makeScene({ authority = true } = {}) {
  const portal = { id: 'backtrack:2:1', x: 100, y: 100 }
  const p1 = { id: 'P1', state: { x: 100, y: 100, hp: 100 } }
  const p2 = { id: 'P2', state: { x: 100, y: 100, hp: 100 } }
  let owner = null
  let applied = null
  const scene = {
    players: new Map([[p1.id, p1], [p2.id, p2]]),
    add: { text: () => label() },
    events: { once() {} },
    __dungeonBacktracking: {
      setUpdateOwner(next) { owner = next; return () => { owner = null } },
      getPortal: () => portal,
      snapshot: () => ({ version: 1, backtracked: true, previousState: { progress: { floor: 1 } }, currentState: { progress: { floor: 2 } } }),
      applyState(value, options) { applied = { value, options }; return true },
    },
  }
  return { scene, portal, p1, p2, owner: () => owner, applied: () => applied, authority }
}

test('authority owns backtrack dwell for both players and restarts from three when either leaves', () => {
  const { scene, portal, p2, owner } = makeScene()
  const facts = []
  let time = 100
  let retreats = 0
  let transitions = 0
  installCoopBacktrackRuntime(scene, {
    isAuthority: () => true,
    publishFact: (fact) => facts.push(fact),
    onTransition: () => { transitions++ },
    now: () => time,
  })

  const update = () => owner()({
    portal,
    available: true,
    unlocked: true,
    retreat: () => { retreats++; return true },
  })

  update()
  assert.equal(facts.at(-1)?.type, 'backtrack.dwell')
  assert.equal(facts.at(-1)?.seconds, 3)
  assert.deepEqual(facts.at(-1)?.playerIds, ['P1', 'P2'])
  assert.equal(scene.players.get('P1').backtrackCountdownLabel?.text, '3')
  assert.equal(scene.players.get('P2').backtrackCountdownLabel?.text, '3')

  time = 1200
  p2.state.x = 240
  update()
  assert.equal(facts.at(-1)?.active, false)
  assert.deepEqual(facts.at(-1)?.playerIds, [])
  assert.equal(scene.players.get('P1').backtrackCountdownLabel ?? null, null)

  time = 1500
  p2.state.x = 100
  update()
  assert.equal(facts.at(-1)?.seconds, 3)

  time = 4500
  update()
  assert.equal(retreats, 1)
  assert.equal(transitions, 1)
  assert.equal(facts.at(-1)?.type, 'backtrack.transition')
  assert.equal(facts.at(-1)?.navigation?.backtracked, true)
})

test('follower never retreats on its local update and only materializes authority backtrack facts', () => {
  const { scene, portal, owner, applied } = makeScene({ authority: false })
  let retreats = 0
  installCoopBacktrackRuntime(scene, {
    isAuthority: () => false,
    publishFact() { throw new Error('follower must not publish backtrack facts') },
    now: () => 999999,
  })

  owner()({
    portal,
    available: true,
    unlocked: true,
    retreat: () => { retreats++; return true },
  })
  assert.equal(retreats, 0)

  scene.__dungeonCoopBacktrack.applyFact({
    type: 'backtrack.dwell',
    entityId: portal.id,
    active: true,
    seconds: 2,
    playerIds: ['P1', 'P2'],
  })
  assert.equal(scene.players.get('P1').backtrackCountdownLabel?.text, '2')
  assert.equal(scene.players.get('P2').backtrackCountdownLabel?.text, '2')

  const navigation = { version: 1, backtracked: true, previousState: { progress: { floor: 1 } } }
  scene.__dungeonCoopBacktrack.applyFact({ type: 'backtrack.transition', entityId: portal.id, navigation })
  assert.deepEqual(applied(), { value: navigation, options: { materialize: true } })
  assert.equal(scene.players.get('P1').backtrackCountdownLabel ?? null, null)
})
