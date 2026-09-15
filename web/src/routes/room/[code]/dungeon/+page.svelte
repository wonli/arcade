<script>
  import { onMount } from 'svelte'
  import VirtualJoystick from '$lib/components/VirtualJoystick.svelte'
  import { getIdentity, defaultName } from '$lib/identity.js'
  import { socket } from '$lib/ws/arcade'
  import { createDungeonGame, chooseDungeonAssets } from '$lib/games/dungeon/scene.js'
  import { loadPhaser } from '$lib/games/dungeon/phaser.js'
  import { installAffixVisuals } from '$lib/games/dungeon/visuals.js'
  import { installDungeonVfx } from '$lib/games/dungeon/vfx-runtime.js'
  import { installPickupInteraction } from '$lib/games/dungeon/pickup-runtime.js'
  import { installInfiniteDungeon } from '$lib/games/dungeon/infinite-runtime.js'
  import { installDungeonSpatial } from '$lib/games/dungeon/spatial-runtime.js'
  import { installDungeonAttackRuntime } from '$lib/games/dungeon/attack-runtime.js'
  import { installDungeonBacktracking } from '$lib/games/dungeon/backtrack-runtime.js'
  import { installDungeonTouchInput } from '$lib/games/dungeon/touch-runtime.js'
  import { createDungeonNetworkRuntime } from '$lib/games/dungeon/network-runtime.js'
  import { initialDungeonStats, initialDungeonProgress } from '$lib/games/dungeon/session.js'

  export let data

  const identity = getIdentity()
  const name = defaultName(identity.playerId)

  let roomCode = String(data?.code ?? '').toUpperCase()
  let room = null
  let mount
  let game = null
  let scene = null
  let touchInput = null
  let pickupRuntime = null
  let networkRuntime = null
  let unsubscribeRoom = () => {}
  let unsubscribeConnection = () => {}
  let connection = 'connecting'
  let ready = false
  let error = ''
  let eventText = ''
  let stats = initialDungeonStats()
  let progress = initialDungeonProgress()
  let resources = null

  $: isHost = room?.hostId === identity.sessionId
  $: waiting = room?.status !== 'playing'

  async function loadResources() {
    if (resources) return resources
    const [Phaser, dungeonResponse, vfxResponse] = await Promise.all([
      loadPhaser(),
      fetch('/assets/debts/manifest.json').catch(() => null),
      fetch('/assets/vfx/manifest.json').catch(() => null),
    ])
    const manifest = dungeonResponse?.ok ? await dungeonResponse.json() : { png: [] }
    const vfxManifest = vfxResponse?.ok ? await vfxResponse.json() : { assets: [] }
    resources = { Phaser, assets: chooseDungeonAssets(manifest), vfxManifest }
    return resources
  }

  function onEvent(event) {
    if (!event?.type) return
    if (event.type === 'floorstart') eventText = `Floor ${event.floor}`
    else if (event.type === 'skill') eventText = `Skill · ${event.hits ?? 0} hits`
    else if (event.type === 'pickup') eventText = 'Item picked up'
    else if (event.type === 'drop') eventText = 'Loot dropped'
    else if (event.type === 'gameover') eventText = 'Run ended'
    else eventText = event.type
  }

  function ensureNetwork() {
    if (networkRuntime || !scene || !room || room.status !== 'playing') return
    networkRuntime = createDungeonNetworkRuntime({
      socket,
      scene,
      roomId: room.id,
      localPlayerId: identity.sessionId,
      hostId: room.hostId,
      onFact(fact) {
        if (fact?.type) eventText = `FACT · ${fact.type}`
      },
      onError(cause) {
        console.warn('Dungeon network:', cause)
      },
    })
    networkRuntime.start()
  }

  function subscribeRoomState() {
    unsubscribeRoom()
    const topic = `room:${roomCode}`
    unsubscribeRoom = socket.subscribe(topic, (message) => {
      if (message.data?.topicId !== topic) return
      const payload = message.data.message
      if (!payload || payload.type) return
      room = payload
      ensureNetwork()
    })
  }

  async function startGame() {
    const { Phaser, assets, vfxManifest } = await loadResources()
    if (!mount) return

    const runGame = createDungeonGame({
      Phaser,
      parent: mount,
      assets,
      onStats(next) { stats = { ...stats, ...next } },
      onEvent,
    })
    game = runGame

    let attempts = 0
    const install = () => {
      if (game !== runGame) return
      const nextScene = runGame.scene?.getScene?.('Dungeon')
      if (!nextScene) {
        if (attempts++ < 90) requestAnimationFrame(install)
        return
      }

      scene = nextScene
      installAffixVisuals(scene)
      installDungeonVfx(scene, vfxManifest)
      pickupRuntime = installPickupInteraction(scene)
      if (!scene.__infiniteDungeon) {
        scene.__infiniteDungeon = installInfiniteDungeon(scene, {
          onProgress(next) { progress = next },
          onEvent,
        })
      }
      installDungeonSpatial(scene, {
        getProgress: () => scene.__infiniteDungeon?.getProgress?.() ?? progress,
        onEvent,
      })
      installDungeonAttackRuntime(scene)
      installDungeonBacktracking(scene, { onProgress(next) { progress = next } })
      touchInput = installDungeonTouchInput(scene)
      ready = true
      ensureNetwork()
    }
    install()
  }

  async function bootstrap() {
    connection = 'connecting'
    error = ''
    await socket.connect()
    await socket.request('arcade.login', {
      playerId: identity.sessionId,
      sessionId: identity.sessionId,
    })

    if (roomCode === 'NEW') {
      room = await socket.request('room.create', { game: 'dungeon', name, players: 2 })
      roomCode = room.id
      history.replaceState(null, '', `/room/${roomCode.toLowerCase()}/dungeon`)
    } else {
      room = await socket.request('room.join', { roomId: roomCode, name })
    }

    if (room?.game !== 'dungeon') throw new Error('Room is not a Dungeon room')
    subscribeRoomState()
    connection = 'live'
    await startGame()
  }

  function moveJoystick(event) {
    touchInput?.setMove(event.detail.x, event.detail.y)
  }

  function useSkill(event) {
    event.preventDefault()
    touchInput?.triggerSkill()
  }

  function useInteract(event) {
    event.preventDefault()
    touchInput?.triggerInteract()
  }

  async function copyInvite() {
    await navigator.clipboard.writeText(`${location.origin}/room/${roomCode.toLowerCase()}/dungeon`)
    eventText = 'Invite copied'
  }

  onMount(() => {
    unsubscribeConnection = socket.onConnection((state) => { connection = state })
    bootstrap().catch((cause) => {
      console.error(cause)
      connection = 'offline'
      error = cause?.message || 'Failed to join Dungeon room'
    })

    return () => {
      networkRuntime?.stop()
      networkRuntime = null
      unsubscribeRoom()
      unsubscribeConnection()
      touchInput?.stopMove()
      pickupRuntime = null
      scene = null
      game?.destroy(true)
      game = null
    }
  })
</script>

<svelte:head><title>Dungeon · {roomCode.toLowerCase()} · AQI Arcade</title></svelte:head>

<main class="page">
  <header>
    <div>
      <a href="/">AQI ARCADE</a>
      <strong>DUNGEON · {roomCode.toLowerCase()}</strong>
      <span class:offline={connection !== 'live'}>{connection.toUpperCase()}</span>
    </div>
    <div class="players">
      <span>{isHost ? 'HOST' : 'GUEST'}</span>
      <span>{room?.players?.length ?? 0}/2 PLAYERS</span>
      <button onclick={copyInvite}>COPY INVITE</button>
    </div>
  </header>

  <section class="stage-shell">
    <div bind:this={mount} class="stage"></div>

    {#if waiting}
      <div class="banner">WAITING FOR PLAYER · SHARE {roomCode.toLowerCase()}</div>
    {:else if !ready}
      <div class="banner">SYNCING DUNGEON…</div>
    {/if}

    {#if error}<div class="error">{error}</div>{/if}

    <div class="touch-controls">
      <div class="joystick"><VirtualJoystick on:move={moveJoystick}/></div>
      <div class="touch-actions">
        <button onpointerdown={useInteract}>USE</button>
        <button class="skill" onpointerdown={useSkill}>SKILL</button>
      </div>
    </div>
  </section>

  <footer>
    <span>HP {stats.hp ?? 0}/{stats.maxHp ?? 0} · DMG {stats.damage ?? 0} · FLOOR {progress.floor ?? 1}</span>
    <span>{eventText || '20Hz player snapshots · Host authoritative commands'}</span>
  </footer>
</main>

<style>
  :global(html),:global(body){margin:0;width:100%;height:100%;overflow:hidden;background:#080a0d;color:#f4f0e8;font-family:Inter,ui-sans-serif,system-ui,sans-serif}
  .page{height:100dvh;box-sizing:border-box;padding:10px;display:grid;grid-template-rows:auto minmax(0,1fr) auto;gap:8px;background:#080a0d}
  header,footer{width:min(1180px,100%);margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:12px}
  header>div,.players{display:flex;align-items:center;gap:10px}header a{color:#c1ff56;text-decoration:none;font-size:10px;font-weight:900;letter-spacing:.14em}header strong{font-size:12px}header span,footer{color:#77818c;font-size:10px}.offline{color:#ff6875}.players button{height:30px;border:1px solid #30363f;background:#111419;color:#c1ff56;font-size:9px;font-weight:900;cursor:pointer}
  .stage-shell{position:relative;justify-self:center;width:min(1180px,100%);height:100%;min-height:0;overflow:hidden;background:#050608;touch-action:none;user-select:none}.stage{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}.stage :global(canvas){display:block!important;max-width:100%!important;max-height:100%!important;margin:auto!important}
  .banner,.error{position:absolute;z-index:40;left:50%;top:12px;transform:translateX(-50%);padding:9px 14px;background:rgba(8,10,13,.88);font:900 10px ui-monospace,monospace;letter-spacing:.08em}.banner{color:#c1ff56}.error{color:#ff6875;top:52px}
  .touch-controls{display:none;position:absolute;inset:0;z-index:35;pointer-events:none}.joystick{position:absolute;left:16px;bottom:34px;pointer-events:auto}.touch-actions{position:absolute;right:16px;bottom:34px;display:flex;gap:12px;align-items:flex-end;pointer-events:auto}.touch-actions button{width:68px;height:68px;border-radius:50%;border:1px solid rgba(193,255,86,.55);background:rgba(15,18,23,.7);color:#c1ff56;font:900 10px ui-monospace,monospace}.touch-actions .skill{width:80px;height:80px;border-color:rgba(201,132,255,.65);color:#d7c4ff}
  footer{min-height:16px;line-height:16px}
  @media(any-pointer:coarse){.touch-controls{display:block}}
  @media(max-width:720px){.page{padding:6px;grid-template-rows:auto minmax(0,1fr)}header strong{display:none}footer{display:none}.players span:first-child{display:none}.stage-shell{width:100%;height:100%}.joystick{left:10px;bottom:28px}.touch-actions{right:10px;bottom:28px}}
</style>
