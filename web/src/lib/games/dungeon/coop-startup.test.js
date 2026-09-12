import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Exercise the page's actual startup handler with delayed resources, as when
// room.join's response and room broadcast arrive before Phaser has loaded.
const page = readFileSync(new URL('../../../routes/dungeon/coop/+page.svelte', import.meta.url), 'utf8')
const handler = page.slice(page.indexOf('  async function startDungeon()'), page.indexOf('  function handleJoystickMove'))

test('join response and room broadcast create only one game while resources load', async () => {
  let release
  const resources = new Promise(resolve => { release = resolve })
  const games = []
  const start = new Function('loadGameResources', 'createDungeonGame', `
    let mounted = true, game = null, starting = false, ready, error, role;
    const room = { players: [{id: 'host'}, {id: 'guest'}] };
    const identity = { sessionId: 'guest' }, mount = {};
    const multiplayerRole = () => 'guest', tick = async () => {};
    const onEvent = () => {}, dungeonSceneReady = () => false;
    const requestAnimationFrame = () => {};
    ${handler}
    return startDungeon;
  `)(() => resources, () => {
    const game = { scene: { getScene: () => null } }
    games.push(game)
    return game
  })

  const response = start()
  const broadcast = start()
  release({ Phaser: {}, assets: {}, vfxManifest: {} })
  await Promise.all([response, broadcast])
  assert.equal(games.length, 1, 'P2 must have one canvas and one scene')
})
