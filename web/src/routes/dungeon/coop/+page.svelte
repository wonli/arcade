<script>
  import { onMount } from 'svelte'
  import VirtualJoystick from '$lib/components/VirtualJoystick.svelte'
  import { getIdentity, defaultName } from '$lib/identity.js'
  import { socket } from '$lib/ws/arcade'
  import { createDungeonGame, chooseDungeonAssets } from '$lib/games/dungeon/scene.js'
  import { formatAffixLabel, weaponHudModel } from '$lib/games/dungeon/presentation.js'
  import { installAffixVisuals } from '$lib/games/dungeon/visuals.js'
  import { installInfiniteDungeon } from '$lib/games/dungeon/infinite-runtime.js'
  import { installDungeonSpatial } from '$lib/games/dungeon/spatial-runtime.js'
  import { installDungeonAttackRuntime } from '$lib/games/dungeon/attack-runtime.js'
  import { installDungeonVfx } from '$lib/games/dungeon/vfx-runtime.js'
  import { installDungeonTouchInput } from '$lib/games/dungeon/touch-runtime.js'
  import { installDungeonMultiplayer } from '$lib/games/dungeon/multiplayer-runtime.js'
  import { multiplayerRole } from '$lib/games/dungeon/multiplayer-state.js'
  import { initialDungeonStats, initialDungeonProgress } from '$lib/games/dungeon/session.js'
  import { loadPhaser } from '$lib/games/dungeon/phaser.js'

  let mount
  let game
  let gameResources
  let identity
  let name = ''
  let room = null
  let roomCode = ''
  let role = 'waiting'
  let connection = 'offline'
  let ready = false
  let joining = false
  let error = ''
  let copied = false
  let gameOver = false
  let eventText = ''
  let stats = initialDungeonStats()
  let progress = initialDungeonProgress()
  let touchInput = null
  let multiplayer = null
  let pendingState = null
  let pendingInput = null
  let unsubscribeRoom = () => {}
  let unsubscribeConnection = () => {}
  let mounted = false
  let stateInFlight = false
  let inputInFlight = false
  let queuedState = null
  let queuedInput = null

  $: weaponModel = weaponHudModel(stats, 'en')
  $: playerCount = room?.players?.length ?? 0
  $: inviteUrl = roomCode && typeof location !== 'undefined' ? `${location.origin}/dungeon/coop?room=${roomCode.toLowerCase()}` : ''

  const rarityName = (rarity) => ({ common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic' }[rarity] ?? '')

  function applyRoom(next) {
    if (!next || next.type || next.game !== 'dungeon') return
    room = next
    role = identity ? multiplayerRole(next, identity.sessionId) : 'waiting'
    if (next.players?.length === 2 && next.status === 'playing' && !game) startDungeon()
  }

  function subscribeRoom() {
    unsubscribeRoom()
    if (!roomCode) return
    const topic = `room:${roomCode}`
    unsubscribeRoom = socket.subscribe(topic, (message) => {
      if (message.data?.topicId !== topic) return
      const payload = message.data.message
      if (!payload) return
      if (!payload.type) { applyRoom(payload); return }
      if (payload.type === 'dungeon.input' && payload.playerId !== identity.sessionId) {
        if (multiplayer) multiplayer.receiveInput(payload.input)
        else pendingInput = payload.input
      }
      if (payload.type === 'dungeon.state' && payload.playerId !== identity.sessionId) {
        if (multiplayer) multiplayer.receiveState(payload.state)
        else pendingState = payload.state
      }
    })
  }

  async function ensureConnected() {
    await socket.connect()
    await socket.request('arcade.login', { playerId: identity.sessionId, sessionId: identity.sessionId })
    connection = 'live'
  }

  async function createRoom() {
    if (joining) return
    joining = true
    error = ''
    try {
      await ensureConnected()
      const snapshot = await socket.request('room.create', { game: 'dungeon', players: 2, name })
      roomCode = snapshot.id
      history.replaceState(null, '', `/dungeon/coop?room=${roomCode.toLowerCase()}`)
      applyRoom(snapshot)
      subscribeRoom()
    } catch (cause) {
      error = cause?.message ?? 'Failed to create room'
    } finally {
      joining = false
    }
  }

  async function joinRoom(code) {
    if (joining) return
    joining = true
    error = ''
    roomCode = code.toUpperCase()
    try {
      await ensureConnected()
      subscribeRoom()
      applyRoom(await socket.request('room.join', { roomId: roomCode, name }))
    } catch (cause) {
      error = cause?.message ?? 'Failed to join room'
    } finally {
      joining = false
    }
  }

  async function copyInvite() {
    if (!inviteUrl) return
    await navigator.clipboard.writeText(inviteUrl)
    copied = true
    setTimeout(() => { copied = false }, 1200)
  }

  function sendInput(input) {
    if (role !== 'guest' || !roomCode) return
    if (inputInFlight) {
      queuedInput = { ...(queuedInput ?? {}), ...input, skill: Boolean(queuedInput?.skill || input.skill) }
      return
    }
    inputInFlight = true
    socket.request('dungeon.input', { roomId: roomCode, input }).catch(() => {}).finally(() => {
      inputInFlight = false
      if (queuedInput) { const next = queuedInput; queuedInput = null; sendInput(next) }
    })
  }

  function sendState(state) {
    if (role !== 'host' || !roomCode) return
    if (stateInFlight) { queuedState = state; return }
    stateInFlight = true
    socket.request('dungeon.state', { roomId: roomCode, state }).catch(() => {}).finally(() => {
      stateInFlight = false
      if (queuedState) { const next = queuedState; queuedState = null; sendState(next) }
    })
  }

  function onEvent(event) {
    if (event.type === 'pickup') eventText = event.item?.type === 'consumable.health_potion' ? `Recovered ${event.healed ?? 0} HP` : `${rarityName(event.item?.rarity)} weapon equipped`
    if (event.type === 'drop') eventText = event.item?.type === 'consumable.health_potion' ? 'Health potion dropped' : `${rarityName(event.item?.rarity)} weapon dropped`
    if (event.type === 'floorstart') eventText = `Floor ${event.floor} · ${event.roomRole ?? 'combat'}`
    if (event.type === 'floorclear') eventText = 'Floor clear'
    if (event.type === 'portal') eventText = 'Exit opened'
    if (event.type === 'rest') eventText = role === 'host' ? 'Rest camp · host chooses the team reward' : 'Rest camp · waiting for host'
    if (event.type === 'gameover') { gameOver = true; touchInput?.stopMove() }
  }

  async function loadGameResources() {
    if (gameResources) return gameResources
    const [Phaser, dungeonResponse, vfxResponse] = await Promise.all([
      loadPhaser(),
      fetch('/assets/debts/manifest.json').catch(() => null),
      fetch('/assets/vfx/manifest.json').catch(() => null),
    ])
    const manifest = dungeonResponse?.ok ? await dungeonResponse.json() : { png: [] }
    const vfxManifest = vfxResponse?.ok ? await vfxResponse.json() : { assets: [] }
    gameResources = { Phaser, assets: chooseDungeonAssets(manifest), vfxManifest }
    return gameResources
  }

  async function startDungeon() {
    if (!mounted || game || !room || room.players?.length < 2) return
    ready = false
    error = ''
    gameOver = false
    role = multiplayerRole(room, identity.sessionId)
    try {
      const { Phaser, assets, vfxManifest } = await loadGameResources()
      if (!mounted) return
      const runGame = createDungeonGame({
        Phaser,
        parent: mount,
        assets,
        labels: {
          floor: (floor) => `FLOOR ${floor}`,
          floorClear: () => 'FLOOR CLEAR',
          rarity: (rarity) => rarityName(rarity),
          affix: (id, value, tier) => formatAffixLabel({ id, value, tier }, 'en'),
        },
        onStats(next) { stats = next },
        onEvent,
      })
      game = runGame
      let attempts = 0
      const install = () => {
        if (!mounted || game !== runGame) return
        const scene = runGame.scene?.getScene?.('Dungeon')
        if (!scene) {
          if (attempts++ < 90) requestAnimationFrame(install)
          return
        }
        installAffixVisuals(scene)
        installDungeonVfx(scene, vfxManifest)
        if (role === 'host') {
          scene.__infiniteDungeon = installInfiniteDungeon(scene, {
            onProgress(next) { progress = next },
            onEvent,
            label: (key) => ({ floor: 'FLOOR', chapter: 'CHAPTER', floorClear: 'FLOOR CLEAR', restTitle: 'REST CAMP', restComplete: 'REST COMPLETE', 'rest.recover': 'Recover 50% HP', 'rest.temper': 'Temper weapon', 'rest.fortune': 'Improve next loot' }[key] ?? key),
          })
        }
        installDungeonSpatial(scene, { getProgress: () => progress, onEvent, label: (key) => key })
        installDungeonAttackRuntime(scene)
        multiplayer = installDungeonMultiplayer(scene, {
          role,
          sendInput,
          sendState,
          onProgress(next) { progress = next },
          onGameOver() { gameOver = true; touchInput?.stopMove() },
        })
        touchInput = installDungeonTouchInput(scene)
        if (pendingState) { multiplayer?.receiveState(pendingState); pendingState = null }
        if (pendingInput) { multiplayer?.receiveInput(pendingInput); pendingInput = null }
        ready = true
      }
      install()
    } catch (cause) {
      error = cause?.message ?? 'Failed to start co-op dungeon'
    }
  }

  function handleJoystickMove(event) { touchInput?.setMove(event.detail.x, event.detail.y) }
  function triggerSkill(event) { event.preventDefault(); touchInput?.triggerSkill() }
  function triggerInteract(event) { event.preventDefault(); if (role === 'host') touchInput?.triggerInteract() }
  function newRoom() { location.href = '/dungeon/coop' }

  onMount(() => {
    mounted = true
    identity = getIdentity()
    name = defaultName(identity.playerId)
    unsubscribeConnection = socket.onConnection((state) => { connection = state })
    const code = new URLSearchParams(location.search).get('room')?.trim()
    if (code) joinRoom(code)
    return () => {
      mounted = false
      unsubscribeRoom()
      unsubscribeConnection()
      touchInput?.stopMove()
      multiplayer?.destroy?.()
      game?.destroy(true)
      game = null
      multiplayer = null
    }
  })
</script>

<svelte:head><title>Endless Dungeon Co-op · AQI Arcade</title></svelte:head>

<main class="page">
  <header class="topbar">
    <div><a href="/" class="brand">AQI ARCADE</a><h1>Endless Dungeon · Co-op</h1><p>2-player shared dungeon · host authoritative</p></div>
    <div class="actions"><span class:offline={connection !== 'live'}>{connection.toUpperCase()}</span><a href="/dungeon">SOLO</a><a href="/">ARCADE</a></div>
  </header>

  {#if !roomCode}
    <section class="lobby-card"><span class="eyebrow">CO-OP EXPEDITION</span><h2>Open a two-player dungeon</h2><p>Create a room, send the invite link, and the run starts when your teammate joins.</p><button on:click={createRoom} disabled={joining}>{joining ? 'CREATING…' : 'CREATE ROOM'}</button>{#if error}<div class="error-text">{error}</div>{/if}</section>
  {:else}
    <section class="roombar">
      <div><span>ROOM</span><strong>{roomCode}</strong></div><div><span>ROLE</span><strong>{role.toUpperCase()}</strong></div><div><span>PLAYERS</span><strong>{playerCount}/2</strong></div><button on:click={copyInvite}>{copied ? 'COPIED' : 'COPY INVITE'}</button>
    </section>

    {#if playerCount < 2}
      <section class="waiting"><div class="pulse"></div><h2>Waiting for teammate</h2><p>{inviteUrl}</p>{#if error}<div class="error-text">{error}</div>{/if}</section>
    {:else}
      <section class="hud">
        <div><span>HP</span><strong>{stats.hp}/{stats.maxHp}</strong></div><div><span>DAMAGE</span><strong>{stats.damage}</strong></div><div><span>KILLS</span><strong>{stats.kills}</strong></div><div><span>FLOOR</span><strong>{progress.floor}</strong></div><div><span>CHAPTER</span><strong>{progress.chapter}</strong></div><div><span>ROOM</span><strong>{progress.roomRole ?? 'combat'}</strong></div><div class="weapon"><span>WEAPON</span><strong>{stats.weapon ? `${rarityName(stats.weaponRarity)} Blade +${weaponModel.damage}` : 'None'}</strong></div>
      </section>
      <section class="stage-shell">
        <div bind:this={mount} class="stage"></div>
        {#if !gameOver}<div class="touch-controls" aria-hidden="true"><div class="joystick-slot"><VirtualJoystick on:move={handleJoystickMove} /></div><div class="touch-actions"><button class="touch-button interact" on:pointerdown={triggerInteract}>USE</button><button class="touch-button skill" on:pointerdown={triggerSkill}>SKILL</button></div></div>{/if}
        {#if !ready && !error}<div class="overlay">SYNCING DUNGEON…</div>{/if}
        {#if error}<div class="overlay error">{error}</div>{/if}
        {#if gameOver}<div class="gameover-overlay"><div class="gameover-panel"><strong>EXPEDITION ENDED</strong><button on:click={newRoom}>NEW ROOM</button></div></div>{/if}
      </section>
      <footer><span>{eventText || (role === 'host' ? 'You are hosting the shared world.' : 'World state is synchronized from the host.')}</span><span>{room?.players?.map((player) => player.name).join(' · ')}</span></footer>
    {/if}
  {/if}
</main>

<style>
  :global(body){margin:0;background:#080a0d;color:#f4f0e8;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.page{min-height:100vh;padding:20px;box-sizing:border-box}.topbar{width:min(1180px,100%);margin:0 auto 14px;display:flex;justify-content:space-between;gap:24px;align-items:flex-end}.brand{color:#c1ff56;text-decoration:none;font-size:11px;font-weight:900;letter-spacing:.18em}.topbar h1{margin:8px 0 3px;font-size:clamp(28px,5vw,48px);letter-spacing:-.05em}.topbar p{margin:0;color:#7e8792;font-size:13px}.actions{display:flex;gap:8px;align-items:center}.actions a,.actions span{height:34px;padding:0 11px;border:1px solid #30363f;background:#111419;color:#9aa4ae;font:800 11px ui-monospace,monospace;display:inline-flex;align-items:center;text-decoration:none}.actions span{color:#c1ff56}.actions span.offline{color:#ff6875}.lobby-card,.waiting{width:min(720px,100%);margin:12vh auto 0;padding:34px;border:1px solid #30363f;background:#101319;box-shadow:14px 14px 0 #040506;box-sizing:border-box}.eyebrow{color:#c1ff56;font:900 10px ui-monospace,monospace;letter-spacing:.16em}.lobby-card h2,.waiting h2{font-size:30px;margin:10px 0}.lobby-card p,.waiting p{color:#7e8792;line-height:1.6;word-break:break-all}.lobby-card button,.roombar button,.gameover-panel button{height:42px;padding:0 18px;border:1px solid #c1ff56;background:#c1ff56;color:#080a0d;font:900 11px ui-monospace,monospace;letter-spacing:.08em;cursor:pointer}.lobby-card button:disabled{opacity:.5}.error-text{margin-top:14px;color:#ff6875}.roombar{width:min(1180px,100%);margin:0 auto 12px;display:grid;grid-template-columns:repeat(3,1fr) auto;border:1px solid #262c34;background:#101319}.roombar>div{padding:9px 12px;border-right:1px solid #262c34}.roombar span,.hud span{display:block;color:#66717d;font-size:9px;letter-spacing:.12em}.roombar strong,.hud strong{display:block;margin-top:3px;font:800 14px ui-monospace,monospace}.roombar button{margin:6px}.waiting{text-align:center;margin-top:8vh}.pulse{width:12px;height:12px;margin:0 auto 18px;border-radius:50%;background:#c1ff56;box-shadow:0 0 0 0 rgba(193,255,86,.4);animation:pulse 1.2s infinite}@keyframes pulse{70%{box-shadow:0 0 0 18px rgba(193,255,86,0)}100%{box-shadow:0 0 0 0 rgba(193,255,86,0)}}.hud{width:min(1180px,100%);margin:0 auto 12px;display:grid;grid-template-columns:repeat(6,minmax(84px,1fr)) minmax(200px,1.5fr);border:1px solid #262c34;background:#101319}.hud>div{padding:10px 12px;border-right:1px solid #262c34}.hud>div:last-child{border-right:0}.stage-shell{position:relative;width:min(1180px,100%);aspect-ratio:16/10;margin:0 auto;border:1px solid #30363f;background:#0b0d10;box-shadow:14px 14px 0 #040506;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none}.stage{width:100%;height:100%}.stage :global(canvas){display:block;width:100%!important;height:100%!important;touch-action:none}.overlay,.gameover-overlay{position:absolute;inset:0;display:grid;place-items:center;background:rgba(11,13,16,.86);z-index:60;color:#c1ff56;font:900 13px ui-monospace,monospace;letter-spacing:.08em}.overlay.error{color:#ff6875;padding:30px;text-align:center}.gameover-overlay{z-index:70;background:rgba(4,5,6,.72)}.gameover-panel{padding:24px;border:1px solid #39414b;background:#101319;text-align:center}.gameover-panel strong{display:block;margin-bottom:16px}.touch-controls{display:none;position:absolute;inset:0;z-index:45;pointer-events:none}.joystick-slot{position:absolute;left:max(18px,env(safe-area-inset-left));bottom:max(18px,env(safe-area-inset-bottom));pointer-events:auto}.touch-actions{position:absolute;right:max(18px,env(safe-area-inset-right));bottom:max(22px,env(safe-area-inset-bottom));display:flex;align-items:flex-end;gap:14px;pointer-events:auto}.touch-button{width:76px;height:76px;border-radius:50%;border:2px solid rgba(244,240,232,.5);background:rgba(15,18,23,.7);color:#f4f0e8;font:800 11px ui-monospace,monospace;touch-action:manipulation}.touch-button.skill{width:88px;height:88px;color:#d7c4ff;border-color:rgba(201,132,255,.82);background:rgba(74,38,96,.7)}.touch-button.interact{color:#c1ff56;border-color:rgba(193,255,86,.72)}footer{width:min(1180px,100%);margin:16px auto 0;display:flex;justify-content:space-between;gap:20px;color:#67717c;font-size:11px}@media(any-pointer:coarse){.touch-controls{display:block}}@media(max-width:900px){.hud{grid-template-columns:repeat(3,1fr)}.weapon{grid-column:1/-1}.roombar{grid-template-columns:repeat(3,1fr)}.roombar button{grid-column:1/-1}}@media(max-width:720px){.page{padding:12px}.topbar{align-items:flex-start;flex-direction:column}.actions{flex-wrap:wrap}.stage-shell{aspect-ratio:4/5;box-shadow:8px 8px 0 #040506}footer{flex-direction:column}.touch-button{width:68px;height:68px}.touch-button.skill{width:80px;height:80px}}
</style>
