<script>
  import { onMount } from 'svelte'
  import VirtualJoystick from '$lib/components/VirtualJoystick.svelte'
  import { getIdentity, defaultName } from '$lib/identity.js'
  import { socket } from '$lib/ws/arcade'
  import { createDungeonGame, chooseDungeonAssets } from '$lib/games/dungeon/scene.js'
  import { formatAffixLabel, weaponHudModel } from '$lib/games/dungeon/presentation.js'
  import { installAffixVisuals } from '$lib/games/dungeon/visuals.js'
  import { installPickupInteraction } from '$lib/games/dungeon/pickup-runtime.js'
  import { createComparisonCard } from '$lib/games/dungeon/comparison-runtime.js'
  import { installInfiniteDungeon } from '$lib/games/dungeon/infinite-runtime.js'
  import { installDungeonSpatial } from '$lib/games/dungeon/spatial-runtime.js'
  import { installDungeonAttackRuntime } from '$lib/games/dungeon/attack-runtime.js'
  import { installDungeonBacktracking } from '$lib/games/dungeon/backtrack-runtime.js'
  import { installDungeonVfx } from '$lib/games/dungeon/vfx-runtime.js'
  import { installDungeonTouchInput } from '$lib/games/dungeon/touch-runtime.js'
  import { installDungeonHud } from '$lib/games/dungeon/hud-runtime.js'
  import { installDungeonCoop } from '$lib/games/dungeon/coop-runtime.js'
  import { dungeonRoomRole } from '$lib/games/dungeon/coop-state.js'
  import { rngFor } from '$lib/games/dungeon/deterministic-rng.js'
  import { initialDungeonStats, initialDungeonProgress } from '$lib/games/dungeon/session.js'
  import { loadPhaser } from '$lib/games/dungeon/phaser.js'

  export let data

  const identity = getIdentity()
  const name = defaultName(identity.playerId)
  let roomCode = String(data?.code ?? '').toUpperCase()
  let room = null
  let role = 'waiting'
  let connection = 'connecting'
  let error = ''
  let copied = false
  let ready = false
  let starting = false
  let gameOver = false
  let eventText = ''
  let stats = initialDungeonStats()
  let progress = initialDungeonProgress()
  let mount
  let game = null
  let gameResources = null
  let touchInput = null
  let pickupRuntime = null
  let hudRuntime = null
  let coopRuntime = null
  let pendingInput = null
  let pendingEvents = []
  let pendingSync = null
  let unsubscribeRoom = () => {}
  let unsubscribeConnection = () => {}
  let mounted = false

  $: playerCount = room?.players?.length ?? 0
  $: weaponModel = weaponHudModel(stats, 'en')
  $: inviteUrl = roomCode && roomCode !== 'NEW' && typeof location !== 'undefined'
    ? `${location.origin}/${roomCode.toLowerCase()}/dungeon/`
    : ''

  const rarityName = (rarity) => ({ common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' }[rarity] ?? '')
  const dungeonSeed = () => `room:${roomCode}`

  function applyRoom(next) {
    if (!next || next.type || next.game !== 'dungeon') return
    room = next

    if (game && coopRuntime?.role === 'host' && next.players?.length < 2) {
      role = 'host'
      coopRuntime.peerDisconnected?.()
      eventText = 'P2 disconnected · continuing solo'
      return
    }
    if (game && coopRuntime?.role === 'guest' && next.players?.length < 2) {
      touchInput?.stopMove()
      ready = false
      error = 'Host disconnected · this co-op run has ended'
      return
    }

    role = dungeonRoomRole(next, identity.sessionId)
    if (next.players?.length === 2 && next.status === 'playing') startDungeon()
  }

  function subscribeRoom() {
    unsubscribeRoom()
    if (!roomCode || roomCode === 'NEW') return
    const topic = `room:${roomCode}`
    unsubscribeRoom = socket.subscribe(topic, (message) => {
      if (message.data?.topicId !== topic) return
      const payload = message.data.message
      if (!payload) return
      if (!payload.type) {
        applyRoom(payload)
        return
      }
      if (payload.type === 'dungeon.input' && payload.playerId !== identity.sessionId) {
        if (coopRuntime) coopRuntime.receiveInput(payload.input)
        else pendingInput = payload.input
      }
      if (payload.type === 'dungeon.event' && payload.playerId !== identity.sessionId) {
        if (coopRuntime) coopRuntime.receiveEvent(payload.event)
        else pendingEvents = [...pendingEvents, payload.event]
      }
      if (payload.type === 'dungeon.sync' && payload.playerId !== identity.sessionId) {
        if (coopRuntime) coopRuntime.receiveSync(payload.sync)
        else pendingSync = payload.sync
      }
    })
  }

  async function connectAndLogin() {
    await socket.connect()
    await socket.request('arcade.login', {
      playerId: identity.sessionId,
      sessionId: identity.sessionId,
    })
    connection = 'live'
  }

  async function bootstrapRoom() {
    error = ''
    connection = 'connecting'
    await connectAndLogin()

    if (roomCode === 'NEW') {
      const snapshot = await socket.request('room.create', { game: 'dungeon', players: 2, name })
      roomCode = snapshot.id
      history.replaceState(null, '', `/${roomCode.toLowerCase()}/dungeon/`)
      applyRoom(snapshot)
      subscribeRoom()
      return
    }

    subscribeRoom()
    applyRoom(await socket.request('room.join', { roomId: roomCode, name }))
  }

  async function copyInvite() {
    if (!inviteUrl) return
    await navigator.clipboard.writeText(inviteUrl)
    copied = true
    setTimeout(() => { copied = false }, 1200)
  }

  function sendInput(input) {
    if (role !== 'guest' || !roomCode) return
    socket.notify('dungeon.input', { roomId: roomCode, input })
  }

  function sendEvent(event) {
    if (role !== 'host' || !roomCode) return
    socket.notify('dungeon.event', { roomId: roomCode, event })
  }

  function sendSync(sync) {
    if (role !== 'host' || !roomCode) return
    socket.notify('dungeon.sync', { roomId: roomCode, sync })
  }

  function onEvent(event) {
    if (event.type === 'pickup') eventText = event.item?.type === 'consumable.health_potion'
      ? `Recovered ${event.healed ?? 0} HP`
      : `${rarityName(event.item?.rarity)} weapon equipped`
    if (event.type === 'drop') eventText = event.item?.type === 'consumable.health_potion'
      ? 'Health potion dropped'
      : `${rarityName(event.item?.rarity)} weapon dropped`
    if (event.type === 'floorstart') eventText = `Floor ${event.floor} · ${event.roomRole ?? 'combat'}`
    if (event.type === 'floorclear') eventText = 'Floor clear'
    if (event.type === 'portal') eventText = 'Exit opened'
    if (event.type === 'rest') eventText = role === 'host' ? 'Rest camp · host chooses the team reward' : 'Rest camp'
    if (event.type === 'gameover') {
      gameOver = true
      touchInput?.stopMove()
    }
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

  function installSpatialForRole(scene) {
    const interactionKey = scene.input?.keyboard?.addKey?.('E')
    const before = role === 'guest' && interactionKey?.listeners
      ? new Set(interactionKey.listeners('down'))
      : null

    const runtime = installDungeonSpatial(scene, {
      getProgress: () => scene.__infiniteDungeon?.getProgress?.() ?? progress,
      onEvent,
      label: (key) => key,
    })

    // Spatial owns local chest mutation. Guest keeps the Key itself so
    // PlayerRuntime can still send interact intent; only the chest callback is removed.
    if (before && interactionKey?.listeners) {
      for (const listener of interactionKey.listeners('down')) {
        if (!before.has(listener)) interactionKey.off?.('down', listener)
      }
    }
    return runtime
  }

  async function startDungeon() {
    if (!mounted || starting || game || !room || room.players?.length < 2) return
    starting = true
    ready = false
    error = ''
    gameOver = false
    role = dungeonRoomRole(room, identity.sessionId)

    try {
      const { Phaser, assets, vfxManifest } = await loadGameResources()
      if (!mounted) return
      const runSeed = dungeonSeed()

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
        onStats(next) {
          stats = { ...stats, ...next }
          hudRuntime?.update?.()
        },
        onEvent,
      })
      game = runGame

      let attempts = 0
      const install = () => {
        if (!mounted || game !== runGame) return
        const scene = runGame.scene?.getScene?.('Dungeon')
        if (!scene) {
          if (attempts++ < 120) requestAnimationFrame(install)
          return
        }

        installAffixVisuals(scene)
        installDungeonVfx(scene, vfxManifest)

        scene.__comparisonCard ??= createComparisonCard(scene, {
          getLocale: () => 'en',
          label: (key) => ({
            ground: 'Ground Item', current: 'Equipped', dungeonBlade: 'Dungeon Blade',
            emptyWeapon: 'No weapon equipped', equip: 'Equip',
          }[key] ?? key),
          rarityName,
        })
        scene.__dungeonInventoryStats = (count) => {
          stats = { ...stats, healthPotions: count }
          hudRuntime?.update?.()
        }

        // Same runtime stack as solo. Host/Guest only differ in authority.
        pickupRuntime = installPickupInteraction(scene, {
          authority: role === 'host',
          getLocale: () => 'en',
          onSelection(next) { scene.__comparisonCard?.setSelection?.(next) },
        })

        scene.__infiniteDungeon = installInfiniteDungeon(scene, {
          authority: role === 'host',
          random: rngFor(runSeed, 1, 'progression', 'run'),
          onProgress(next) {
            progress = next
            hudRuntime?.update?.()
          },
          onEvent: role === 'host' ? onEvent : () => {},
          label: (key) => ({
            floor: 'FLOOR', chapter: 'CHAPTER', floorClear: 'FLOOR CLEAR',
            restTitle: 'REST CAMP', restComplete: 'REST COMPLETE',
            'rest.recover': 'Recover 50% HP', 'rest.temper': 'Temper weapon',
            'rest.fortune': 'Improve next loot',
          }[key] ?? key),
        })

        installSpatialForRole(scene)
        installDungeonAttackRuntime(scene)

        if (role === 'host') {
          installDungeonBacktracking(scene, {
            onProgress(next) {
              progress = next
              hudRuntime?.update?.()
            },
          })
        }

        touchInput = installDungeonTouchInput(scene)

        const localId = identity.sessionId
        const remoteId = room.players.find((player) => player.id !== localId)?.id
        if (!remoteId) {
          error = 'Could not resolve teammate'
          return
        }

        coopRuntime = installDungeonCoop(scene, {
          role,
          runSeed,
          localPlayerId: localId,
          remotePlayerId: remoteId,
          sendInput,
          sendEvent,
          sendSync,
          getProgress: () => scene.__infiniteDungeon?.getProgress?.() ?? progress,
          onProgress(next) {
            progress = next
            hudRuntime?.update?.()
          },
          onGameOver() {
            gameOver = true
            touchInput?.stopMove()
          },
          onProtocolError(cause) {
            ready = false
            error = cause?.message ?? 'Dungeon synchronization failed'
          },
        })

        hudRuntime = installDungeonHud(scene, {
          getStats: () => stats,
          getProgress: () => progress,
          getLabels: () => ({
            locale: 'en', hp: 'HP', weapon: 'Weapon', details: 'Stats', none: 'None',
            emptyWeapon: 'No weapon equipped', dungeonBlade: 'Dungeon Blade', baseDamage: 'Weapon damage',
            combat: 'Combat', elite: 'Elite', rest: 'Rest', boss: 'Boss',
            'rarity:common': 'Common', 'rarity:uncommon': 'Uncommon', 'rarity:rare': 'Rare',
            'rarity:epic': 'Epic', 'rarity:legendary': 'Legendary',
          }),
          onPotion: () => pickupRuntime?.useHealthPotion?.(),
          onDetails: () => {},
        })

        pendingEvents.sort((a, b) => (Number(a?.eventSeq) || 0) - (Number(b?.eventSeq) || 0))
        for (const event of pendingEvents) coopRuntime.receiveEvent(event)
        pendingEvents = []
        if (pendingSync) {
          coopRuntime.receiveSync(pendingSync)
          pendingSync = null
        }
        if (pendingInput) {
          coopRuntime.receiveInput(pendingInput)
          pendingInput = null
        }
        ready = true
      }

      install()
    } catch (cause) {
      console.error(cause)
      error = cause?.message ?? 'Failed to start co-op dungeon'
    } finally {
      starting = false
    }
  }

  function handleJoystickMove(event) {
    touchInput?.setMove(event.detail.x, event.detail.y)
  }

  function triggerSkill(event) {
    event.preventDefault()
    touchInput?.triggerSkill()
  }

  function triggerInteract(event) {
    event.preventDefault()
    touchInput?.triggerInteract()
  }

  function newExpedition() {
    location.href = '/new/dungeon/'
  }

  onMount(() => {
    mounted = true
    unsubscribeConnection = socket.onConnection((state) => { connection = state })
    bootstrapRoom().catch((cause) => {
      connection = 'offline'
      error = cause?.message ?? 'Failed to join dungeon room'
    })

    return () => {
      mounted = false
      unsubscribeRoom()
      unsubscribeConnection()
      touchInput?.stopMove()
      coopRuntime?.destroy?.()
      game?.destroy(true)
      game = null
      coopRuntime = null
    }
  })
</script>

<svelte:head>
  <title>Dungeon · {roomCode.toLowerCase()} · AQI Arcade</title>
</svelte:head>

<main class="page">
  <header class="topbar">
    <div>
      <a class="brand" href="/">AQI ARCADE</a>
      <h1>Endless Dungeon · Co-op</h1>
      <p>P1 owns gameplay facts · both clients render the same Dungeon</p>
    </div>
    <div class="actions">
      <span class:offline={connection !== 'live'}>{connection.toUpperCase()}</span>
      <a href="/dungeon">SOLO</a>
      <a href="/">ARCADE</a>
    </div>
  </header>

  <section class="roombar">
    <div><span>ROOM</span><strong>{roomCode === 'NEW' ? '······' : roomCode}</strong></div>
    <div><span>ROLE</span><strong>{role.toUpperCase()}</strong></div>
    <div><span>PLAYERS</span><strong>{playerCount}/2</strong></div>
    <button onclick={copyInvite} disabled={!inviteUrl}>{copied ? 'COPIED' : 'COPY INVITE'}</button>
  </section>

  {#if error}
    <section class="notice error"><strong>CO-OP ERROR</strong><span>{error}</span><button onclick={newExpedition}>NEW ROOM</button></section>
  {:else if playerCount < 2 && !game}
    <section class="notice waiting">
      <div class="pulse"></div>
      <strong>WAITING FOR P2</strong>
      <span>{inviteUrl || 'Creating room…'}</span>
      <button onclick={copyInvite} disabled={!inviteUrl}>COPY INVITE</button>
    </section>
  {:else}
    <section class="hudstrip">
      <div><span>HP</span><strong>{stats.hp}/{stats.maxHp}</strong></div>
      <div><span>DAMAGE</span><strong>{stats.damage}</strong></div>
      <div><span>FLOOR</span><strong>{progress.floor}</strong></div>
      <div><span>CHAPTER</span><strong>{progress.chapter}</strong></div>
      <div><span>ROOM</span><strong>{progress.roomRole ?? 'combat'}</strong></div>
      <div class="weapon"><span>WEAPON</span><strong>{stats.weapon ? `${rarityName(stats.weaponRarity)} +${weaponModel.damage}` : 'None'}</strong></div>
    </section>

    <section class="stage-shell">
      <div bind:this={mount} class="stage"></div>
      {#if !gameOver}
        <div class="touch-controls" aria-hidden="true">
          <div class="joystick-slot"><VirtualJoystick on:move={handleJoystickMove} /></div>
          <div class="touch-actions">
            <button class="touch-button interact" onpointerdown={triggerInteract}>USE</button>
            <button class="touch-button skill" onpointerdown={triggerSkill}>SKILL</button>
          </div>
        </div>
      {/if}
      {#if !ready}<div class="overlay">SYNCING DUNGEON…</div>{/if}
      {#if gameOver}
        <div class="gameover-overlay">
          <div class="gameover-panel"><strong>EXPEDITION ENDED</strong><button onclick={newExpedition}>NEW ROOM</button></div>
        </div>
      {/if}
    </section>

    <footer>
      <span>{eventText || (role === 'host' ? 'HOST · authoritative gameplay facts' : 'P2 · local presentation + host authority')}</span>
      <span>{room?.players?.map((player) => player.name).join(' · ')}</span>
    </footer>
  {/if}
</main>

<style>
  :global(body){margin:0;background:#080a0d;color:#f4f0e8;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;overscroll-behavior:none}.page{min-height:100vh;padding:18px;box-sizing:border-box}.topbar,.roombar,.hudstrip,.stage-shell,footer{width:min(1180px,100%);margin-left:auto;margin-right:auto}.topbar{display:flex;justify-content:space-between;gap:20px;align-items:flex-end;margin-bottom:12px}.brand{color:#c1ff56;text-decoration:none;font-size:11px;font-weight:900;letter-spacing:.18em}.topbar h1{margin:7px 0 3px;font-size:clamp(26px,4vw,44px);letter-spacing:-.045em}.topbar p{margin:0;color:#7d8792;font-size:12px}.actions{display:flex;gap:7px;align-items:center}.actions a,.actions span{height:32px;padding:0 10px;border:1px solid #30363f;background:#111419;color:#9aa4ae;font:800 10px ui-monospace,monospace;display:inline-flex;align-items:center;text-decoration:none}.actions span{color:#c1ff56}.actions span.offline{color:#ff6875}.roombar,.hudstrip{display:grid;gap:1px;background:#272c33;border:1px solid #272c33}.roombar{grid-template-columns:repeat(3,1fr) auto;margin-bottom:10px}.hudstrip{grid-template-columns:repeat(5,minmax(72px,1fr)) minmax(160px,2fr);margin-bottom:10px}.roombar>div,.hudstrip>div{padding:9px 12px;background:#101319}.roombar span,.hudstrip span{display:block;color:#68727d;font:800 9px ui-monospace,monospace;letter-spacing:.12em}.roombar strong,.hudstrip strong{display:block;margin-top:3px;font:900 13px ui-monospace,monospace}.roombar button,.notice button,.gameover-panel button{border:0;background:#c1ff56;color:#080a0d;padding:0 18px;font-weight:900;cursor:pointer}.roombar button:disabled{opacity:.35}.notice{width:min(700px,calc(100% - 32px));margin:14vh auto 0;padding:34px;box-sizing:border-box;border:1px solid #30363f;background:#101319;box-shadow:12px 12px 0 #030405;text-align:center}.notice strong{display:block;font-size:24px}.notice span{display:block;margin:12px 0 22px;color:#7e8792;word-break:break-all}.notice button{height:44px}.notice.error{border-color:#6d3038}.pulse{width:12px;height:12px;margin:0 auto 18px;border-radius:50%;background:#c1ff56;box-shadow:0 0 18px #c1ff56;animation:pulse 1.2s infinite}.stage-shell{position:relative;aspect-ratio:16/10;max-height:calc(100vh - 220px);background:#050608;border:1px solid #242a31;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none}.stage{width:100%;height:100%}.stage :global(canvas){display:block;width:100%!important;height:100%!important;object-fit:contain}.overlay,.gameover-overlay{position:absolute;inset:0;display:grid;place-items:center;background:rgba(5,6,8,.72);z-index:30;font:900 14px ui-monospace,monospace;letter-spacing:.12em}.gameover-overlay{z-index:60}.gameover-panel{padding:28px;border:1px solid #4b535d;background:#0d1014;text-align:center;box-shadow:10px 10px 0 #030405}.gameover-panel strong{display:block;margin-bottom:18px;font-size:22px}.gameover-panel button{height:44px}.touch-controls{position:absolute;inset:0;z-index:40;pointer-events:none}.joystick-slot{position:absolute;left:18px;bottom:18px;pointer-events:auto}.touch-actions{position:absolute;right:18px;bottom:22px;display:flex;gap:12px;align-items:flex-end;pointer-events:auto}.touch-button{width:68px;height:68px;border-radius:50%;border:2px solid rgba(255,255,255,.28);background:rgba(10,13,17,.74);color:#fff;font:900 11px ui-monospace,monospace;touch-action:none}.touch-button.skill{width:82px;height:82px;border-color:#c1ff56;color:#c1ff56}.touch-button.interact{border-color:#67a8ff;color:#8bc4ff}footer{display:flex;justify-content:space-between;gap:16px;padding:9px 2px;color:#707a85;font:700 10px ui-monospace,monospace}.weapon strong{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}@keyframes pulse{50%{opacity:.35;transform:scale(.76)}}@media(pointer:fine){.touch-controls{display:none}}@media(max-width:760px){.page{padding:8px}.topbar{align-items:flex-start}.topbar p{display:none}.actions a{display:none}.roombar{grid-template-columns:repeat(3,1fr)}.roombar button{grid-column:1/-1;height:38px}.hudstrip{grid-template-columns:repeat(3,1fr)}.hudstrip .weapon{grid-column:span 2}.stage-shell{max-height:none;aspect-ratio:16/11}footer{font-size:9px;flex-direction:column;gap:4px}.joystick-slot{left:10px;bottom:10px}.touch-actions{right:10px;bottom:14px}.touch-button{width:58px;height:58px}.touch-button.skill{width:70px;height:70px}}
</style>