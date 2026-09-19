<script>
  import { onMount } from 'svelte'
  import { goto, onNavigate } from '$app/navigation'
  import VirtualJoystick from '$lib/components/VirtualJoystick.svelte'
  import { getIdentity, defaultName } from '$lib/identity.js'
  import { setAppLocale, subscribeLocale } from '$lib/locale.js'
  import { createReplaySession, finalizeReplaySession } from '$lib/replay/session.js'
  import { socket } from '$lib/ws/arcade'
  import { createDungeonGame, chooseDungeonAssets } from '$lib/games/dungeon/scene.js'
  import { captureDungeonReplayState, replay as dungeonReplay } from '$lib/games/dungeon/replay.js'
  import { installDungeonReplayEventCapture } from '$lib/games/dungeon/replay-event-capture-runtime.js'
  import { installDungeonPresentationStack } from '$lib/games/dungeon/presentation-stack.js'
  import { loadPhaser } from '$lib/games/dungeon/phaser.js'
  import { installPickupInteraction } from '$lib/games/dungeon/pickup-runtime.js'
  import { createComparisonCard } from '$lib/games/dungeon/comparison-runtime.js'
  import { installInfiniteDungeon } from '$lib/games/dungeon/infinite-runtime.js'
  import { installDungeonSpatial } from '$lib/games/dungeon/spatial-runtime.js'
  import { setProceduralRunSeed } from '$lib/games/dungeon/spatial.js'
  import { setProgressionRunSeed } from '$lib/games/dungeon/progression.js'
  import { installDungeonAttackRuntime } from '$lib/games/dungeon/attack-runtime.js'
  import { installDungeonBacktracking } from '$lib/games/dungeon/backtrack-runtime.js'
  import { installDungeonTouchInput } from '$lib/games/dungeon/touch-runtime.js'
  import { installPlayerIntentRuntime } from '$lib/games/dungeon/player-intent-runtime.js'
  import { installDungeonHud } from '$lib/games/dungeon/hud-runtime.js'
  import { createDungeonNetworkRuntime, dungeonSceneReadyForNetwork } from '$lib/games/dungeon/network-runtime.js'
  import { formatAffixLabel, weaponHudModel } from '$lib/games/dungeon/presentation.js'
  import { createDungeonTranslator, dungeonHudLabels, normalizeDungeonLocale } from '$lib/games/dungeon/i18n.js'
  import { initialDungeonStats, initialDungeonProgress } from '$lib/games/dungeon/session.js'
  import { loadDungeonAssetBundle } from '$lib/games/dungeon/asset-bundle.js'

  export let data

  const identity = getIdentity()
  const name = defaultName(identity.playerId)

  let roomCode = String(data?.code ?? '').toUpperCase()
  let room = null
  let mount
  let stopped = false
  let game = null
  let scene = null
  let touchInput = null
  let pickupRuntime = null
  let hudRuntime = null
  let playerIntentRuntime = null
  let networkRuntime = null
  let replaySession = null
  let replayTimer = null
  let replayFinished = false
  let replayFinishPromise = null
  let unsubscribeRoom = () => {}
  let unsubscribeConnection = () => {}
  let unsubscribeLocale = () => {}
  let connection = 'connecting'
  let ready = false
  let panelOpen = false
  let error = ''
  let eventText = ''
  let locale = 'en'
  let stats = initialDungeonStats()
  let progress = initialDungeonProgress()
  let resources = null
  let assetProgress = null

  $: isHost = room?.hostId === identity.sessionId
  $: waiting = room?.status !== 'playing'
  $: weaponModel = weaponHudModel(stats, locale)
  $: loadingLabel = assetProgress?.phase === 'download'
    ? `${t('syncingDungeon')} ${assetProgress.percent ?? 0}%`
    : assetProgress?.phase === 'cache' ? `${t('syncingDungeon')} · local` : t('syncingDungeon')

  function t(key, values = {}) {
    return createDungeonTranslator(locale)(key, values)
  }

  function rarityName(rarity) {
    const key = {
      common: 'rarityCommon',
      uncommon: 'rarityUncommon',
      rare: 'rarityRare',
      epic: 'rarityEpic',
      legendary: 'rarityLegendary',
    }[rarity]
    return key ? t(key) : ''
  }

  function hudLabels() {
    return dungeonHudLabels(locale)
  }

  function connectionLabel() {
    return t({ connecting: 'connectionConnecting', live: 'connectionLive', offline: 'connectionOffline' }[connection] ?? 'connectionOffline')
  }

  function applyLocale(next) {
    locale = normalizeDungeonLocale(next)
    scene?.__comparisonCard?.refresh?.()
    pickupRuntime?.refreshLabels?.()
    hudRuntime?.update()
  }

  function setLocale(next) {
    setAppLocale(normalizeDungeonLocale(next))
  }

  function toggleLocale() {
    setLocale(locale === 'zh-CN' ? 'en' : 'zh-CN')
  }

  function currentPlayerSlot() {
    return (room?.players ?? []).findIndex((player) => String(player?.id ?? '') === identity.sessionId)
  }

  function setPanel(open) {
    panelOpen = Boolean(open)
    if (panelOpen) touchInput?.stopMove()
  }

  function usePotion(event) {
    event?.preventDefault?.()
    event?.stopPropagation?.()
    if ((stats.healthPotions ?? 0) <= 0) {
      eventText = t('noHealthPotions')
      return
    }
    if ((stats.hp ?? 0) >= (stats.maxHp ?? 0)) {
      eventText = t('fullHealth')
      return
    }
    if (pickupRuntime?.useHealthPotion?.()) {
      eventText = t('healthPotionUsed')
      hudRuntime?.update()
    }
  }

  function dungeonReplayState() {
    return captureDungeonReplayState({ scene, stats, progress })
  }

  function recordDungeonReplay(force = false) {
    const state = dungeonReplayState()
    if (state) replaySession?.record(state, { force })
  }

  function recordDungeonReplayEvent(event) {
    return replaySession?.recordEvent(event) ?? false
  }

  function refreshReplayEventCapture() {
    if (!scene) return null
    scene.__dungeonReplayEventCapture?.destroy?.()
    return installDungeonReplayEventCapture(scene)
  }

  function finishDungeonReplay() {
    if (replayFinishPromise) return replayFinishPromise
    if (replayFinished) return Promise.resolve(false)
    replayFinished = true
    const session = replaySession
    const state = dungeonReplayState()
    if (!session || !state) return Promise.resolve(false)
    replayFinishPromise = session.finish(state).catch((cause) => {
      console.warn('Dungeon replay final upload failed:', cause)
      return false
    })
    return replayFinishPromise
  }

  onNavigate(() => {
    if (!replaySession) return
    return finishDungeonReplay().then(() => {})
  })

  async function returnHome(event) {
    event?.preventDefault?.()
    await finishDungeonReplay()
    await goto('/')
  }

  async function loadResources() {
    if (resources) return resources
    const [Phaser, bundle] = await Promise.all([
      loadPhaser(),
      loadDungeonAssetBundle({ onProgress: (next) => { assetProgress = next } }),
    ])
    if (stopped) {
      bundle.dispose()
      return null
    }
    resources = { Phaser, assets: chooseDungeonAssets(bundle.manifest, bundle.resolveAsset), vfxManifest: bundle.vfxManifest, assetManifest: bundle.manifest, resolveAsset: bundle.resolveAsset, dispose: bundle.dispose }
    return resources
  }

  function onEvent(event) {
    if (!event?.type) return
    if (event.type === 'floorstart') eventText = t('floorStart', { floor: event.floor })
    else if (event.type === 'floorclear') eventText = t('floorClear')
    else if (event.type === 'portal') eventText = t('portal')
    else if (event.type === 'rest') eventText = t('restEntered')
    else if (event.type === 'restchoice') eventText = t('restChoice', { choice: t(`rest${event.choice?.[0]?.toUpperCase?.() ?? ''}${event.choice?.slice?.(1) ?? ''}`) })
    else if (event.type === 'chestopen') eventText = t('chestOpened')
    else if (event.type === 'skill') eventText = t('skillHits', { hits: event.hits ?? 0 })
    else if (event.type === 'pickup') eventText = t('itemPickedUp')
    else if (event.type === 'drop') eventText = t('lootDropped')
    else if (event.type === 'gameover') {
      panelOpen = false
      eventText = t('gameover')
      void finishDungeonReplay()
    } else eventText = event.type
  }

  function ensureNetwork() {
    const playerSlot = currentPlayerSlot()
    if (networkRuntime || !ready || !dungeonSceneReadyForNetwork(scene) || !room || room.status !== 'playing' || playerSlot < 0) return
    networkRuntime = createDungeonNetworkRuntime({
      socket,
      scene,
      roomId: room.id,
      runSeed: roomCode,
      localPlayerId: identity.sessionId,
      hostId: room.hostId,
      playerSlot,
      onFact(fact) {
        if (fact?.type) eventText = `FACT · ${fact.type}`
      },
      onError(cause) {
        console.warn('Dungeon network:', cause)
      },
    })
    networkRuntime.start()
    networkRuntime.updatePeers(room?.players ?? [])
    refreshReplayEventCapture()
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
      networkRuntime?.updatePeers(room?.players ?? [])
      recordDungeonReplay(true)
    })
  }

  async function startGame() {
    const loaded = await loadResources()
    if (!loaded || !mount) return
    const { Phaser, assets, vfxManifest, assetManifest, resolveAsset } = loaded

    replayFinished = false
    replayFinishPromise = null
    setProceduralRunSeed(roomCode)
    setProgressionRunSeed(roomCode)
    const runGame = createDungeonGame({
      Phaser,
      parent: mount,
      assets,
      assetManifest,
      resolveAsset,
      labels: {
        floor: (floor) => t('floorTitle', { floor }),
        floorClear: () => t('floorClear'),
        rarity: (rarity) => rarityName(rarity),
        affix: (id, value, tier) => formatAffixLabel({ id, value, tier }, locale),
      },
      onStats(next) {
        stats = { ...stats, ...next }
        hudRuntime?.update()
      },
      onEvent,
    })
    game = runGame

    let attempts = 0
    const install = () => {
      if (game !== runGame) return
      const nextScene = runGame.scene?.getScene?.('Dungeon')
      if (!dungeonSceneReadyForNetwork(nextScene)) {
        if (attempts++ < 90) requestAnimationFrame(install)
        return
      }

      scene = nextScene
      scene.captureDungeonEvent = recordDungeonReplayEvent
      installDungeonPresentationStack(scene, { vfxManifest })

      if (!scene.__comparisonCard) {
        scene.__comparisonCard = createComparisonCard(scene, {
          getLocale: () => locale,
          label: (key) => t(({
            ground: 'ground',
            current: 'current',
            dungeonBlade: 'dungeonBlade',
            emptyWeapon: 'emptyWeapon',
            equip: 'equip',
          })[key] ?? key),
          rarityName,
        })
      }

      scene.__dungeonInventoryStats = (count) => {
        stats = { ...stats, healthPotions: count }
        hudRuntime?.update()
      }

      pickupRuntime = installPickupInteraction(scene, {
        getLocale: () => locale,
        onSelection(next) { scene.__comparisonCard?.setSelection(next) },
      })
      if (!scene.__infiniteDungeon) {
        scene.__infiniteDungeon = installInfiniteDungeon(scene, {
          onProgress(next) {
            progress = next
            hudRuntime?.update()
          },
          onEvent,
          label: (key) => t(({
            floor: 'floor', chapter: 'chapter', floorClear: 'floorClear', restTitle: 'restTitle', restComplete: 'restComplete',
            'rest.recover': 'restRecover', 'rest.temper': 'restTemper', 'rest.fortune': 'restFortune',
          })[key] ?? key),
        })
      }
      installDungeonSpatial(scene, {
        getProgress: () => scene.__infiniteDungeon?.getProgress?.() ?? progress,
        onEvent,
        label: (key) => t(key),
      })
      installDungeonAttackRuntime(scene)
      playerIntentRuntime = installPlayerIntentRuntime(scene, {
        onIntent(intent) { networkRuntime?.handleLocalIntent?.(intent) },
      })
      installDungeonBacktracking(scene, {
        onProgress(next) {
          progress = next
          hudRuntime?.update()
        },
      })
      refreshReplayEventCapture()
      touchInput = installDungeonTouchInput(scene)
      hudRuntime = installDungeonHud(scene, {
        getStats: () => stats,
        getProgress: () => progress,
        getLabels: hudLabels,
        onPotion: () => usePotion(),
        onDetails: () => setPanel(true),
      })
      ready = true
      ensureNetwork()
      recordDungeonReplay(true)
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

    if (room?.game !== 'dungeon') throw new Error(t('roomNotDungeon'))
    replaySession = createReplaySession({adapter:dungeonReplay,roomCode:()=>room?.id??roomCode,room:()=>room,identity,socket})
    subscribeRoomState()
    connection = 'live'
    await startGame()
    replayTimer = setInterval(() => {
      if (ready && !replayFinished) recordDungeonReplay()
    }, 200)
  }

  function moveJoystick(event) {
    if (!panelOpen) touchInput?.setMove(event.detail.x, event.detail.y)
  }

  function useSkill(event) {
    event.preventDefault()
    if (!panelOpen) touchInput?.triggerSkill()
  }

  function useInteract(event) {
    event.preventDefault()
    if (!panelOpen) touchInput?.triggerInteract()
  }

  async function copyInvite() {
    await navigator.clipboard.writeText(`${location.origin}/room/${roomCode.toLowerCase()}/dungeon`)
    eventText = t('inviteCopied')
  }

  onMount(() => {
    stopped = false
    unsubscribeLocale = subscribeLocale(applyLocale)
    unsubscribeConnection = socket.onConnection((state) => { connection = state })
    bootstrap().catch((cause) => {
      console.error(cause)
      connection = 'offline'
      error = cause?.message || t('failedJoinRoom')
    })

    return () => {
      stopped = true
      if (replayTimer) clearInterval(replayTimer)
      const session = replaySession
      replaySession = null
      if (session) {
        if (replayFinishPromise) {
          void replayFinishPromise.finally(() => session.destroy())
        } else if (!replayFinished) {
          const state = dungeonReplayState()
          replayFinished = true
          if (state) void finalizeReplaySession(session, state).catch(() => false)
          else session.destroy()
        } else {
          session.destroy()
        }
      }
      playerIntentRuntime?.restore?.()
      playerIntentRuntime = null
      networkRuntime?.stop()
      networkRuntime = null
      unsubscribeRoom()
      unsubscribeConnection()
      unsubscribeLocale()
      touchInput?.stopMove()
      scene?.__comparisonCard?.destroy?.()
      if (scene) scene.__comparisonCard = null
      pickupRuntime = null
      hudRuntime = null
      panelOpen = false
      scene = null
      game?.destroy(true)
      game = null
      resources?.dispose?.()
      resources = null
      setProgressionRunSeed(null)
      setProceduralRunSeed(null)
    }
  })
</script>

<svelte:head><title>{t('title')} · {roomCode.toLowerCase()} · AQI Arcade</title></svelte:head>

<main class="page">
  <header>
    <div>
      <a href="/" onclick={returnHome}>AQI ARCADE</a>
      <strong>DUNGEON · {roomCode.toLowerCase()}</strong>
      <span class:offline={connection !== 'live'}>{connectionLabel()}</span>
    </div>
    <div class="players">
      <span>{t(isHost ? 'host' : 'guest')}</span>
      <span>{t('players', { count: room?.players?.length ?? 0 })}</span>
      <button onclick={toggleLocale}>{locale === 'zh-CN' ? 'EN' : '中文'}</button>
      <button onclick={copyInvite}>{t('copyInvite')}</button>
    </div>
  </header>

  <section class="stage-shell">
    <div bind:this={mount} class="stage"></div>

    {#if waiting && (!assetProgress || assetProgress.percent >= 100)}
      <div class="banner">{t('waitingPlayer', { room: roomCode.toLowerCase() })}</div>
    {:else if !ready}
      <div class="banner">{loadingLabel}</div>
    {/if}

    {#if error}<div class="error">{error}</div>{/if}

    {#if !panelOpen}
      <div class="touch-controls">
        <div class="joystick"><VirtualJoystick on:move={moveJoystick}/></div>
        <div class="touch-actions">
          <button onpointerdown={useInteract}>{t('touchInteract')}</button>
          <button class="skill" onpointerdown={useSkill}>{t('touchSkill')}</button>
        </div>
      </div>
    {/if}

    {#if panelOpen}
      <div class="stats-overlay" role="dialog" aria-modal="true" aria-label={t('details')}>
        <div class="stats-panel">
          <div class="panel-kicker">{t('liveCoopLoadout')}</div>
          <div class="weapon-title">
            <div>
              <span>{t('currentWeapon')}</span>
              <h2 class:common={stats.weaponRarity==='common'} class:uncommon={stats.weaponRarity==='uncommon'} class:rare={stats.weaponRarity==='rare'} class:epic={stats.weaponRarity==='epic'} class:legendary={stats.weaponRarity==='legendary'}>
                {stats.weapon ? `${weaponModel.archetypeLabel ?? t('weapon')} · ${weaponModel.name ?? t('dungeonBlade')}` : t('emptyWeapon')}
              </h2>
            </div>
            <button class="close" onclick={() => setPanel(false)} aria-label={t('closeLabel')}>×</button>
          </div>

          <div class="stat-grid">
            <div><span>{t('weaponDamage')}</span><strong>{weaponModel.damage}</strong></div>
            <div><span>{t('totalDamage')}</span><strong>{stats.damage}</strong></div>
            <div><span>{t('hp')}</span><strong>{stats.hp}/{stats.maxHp}</strong></div>
            <div><span>{t('potions')}</span><strong>{stats.healthPotions ?? 0}</strong></div>
          </div>

          <div class="affix-box">
            <span>{t('affixes')}</span>
            {#if weaponModel.affixes.length}
              <div class="affix-list">{#each weaponModel.affixes as affix}<div>◆ {affix}</div>{/each}</div>
            {:else}
              <p>{t('noAffixes')}</p>
            {/if}
          </div>

          <div class="panel-actions">
            <button class="use-potion" disabled={(stats.healthPotions ?? 0) <= 0 || stats.hp >= stats.maxHp} onclick={usePotion}>{t('usePotion')} · {stats.healthPotions ?? 0}</button>
            <button class="resume" onclick={() => setPanel(false)}>{t('backToGame')}</button>
          </div>
          <p class="online-note">{t('onlineWorldContinues')}</p>
        </div>
      </div>
    {/if}
  </section>

  <footer>
    <span>{t('hp')} {stats.hp ?? 0}/{stats.maxHp ?? 0} · {t('damage')} {stats.damage ?? 0} · {t('floor')} {progress.floor ?? 1}</span>
    <span>{eventText || t('coopStatus')}</span>
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
  .stats-overlay{position:absolute;inset:0;z-index:90;display:grid;place-items:center;padding:18px;background:rgba(3,4,6,.76);backdrop-filter:blur(4px)}.stats-panel{width:min(520px,calc(100% - 20px));box-sizing:border-box;padding:22px;background:rgba(14,18,23,.97);box-shadow:0 20px 55px rgba(0,0,0,.55);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.panel-kicker{color:#c1ff56;font-size:9px;font-weight:900;letter-spacing:.18em}.weapon-title{display:flex;justify-content:space-between;gap:20px;align-items:start;margin-top:10px}.weapon-title span,.affix-box>span,.stat-grid span{display:block;color:#68737f;font-size:9px;letter-spacing:.12em}.weapon-title h2{margin:5px 0 0;font-size:22px}.close{width:42px;height:42px;border:0;background:#1a2028;color:#d8dde2;font-size:24px;cursor:pointer}.stat-grid{display:grid;grid-template-columns:repeat(4,1fr);margin-top:18px;background:#090c10}.stat-grid>div{padding:12px;border-right:1px solid rgba(71,80,91,.45)}.stat-grid>div:last-child{border:0}.stat-grid strong{display:block;margin-top:4px;font-size:16px}.affix-box{margin-top:12px;padding:14px;background:#090c10}.affix-list{display:grid;gap:7px;margin-top:9px;color:#cbd3dc;font-size:12px}.affix-box p{margin:8px 0 0;color:#65707c;font-size:11px}.panel-actions{display:grid;grid-template-columns:1fr 1.25fr;gap:10px;margin-top:16px}.panel-actions button{min-height:50px;border:0;font:900 11px ui-monospace,monospace;letter-spacing:.05em;cursor:pointer}.use-potion{background:#2a1319;color:#ff8993}.use-potion:disabled{opacity:.35;cursor:not-allowed}.resume{background:#c1ff56;color:#080a0d}.online-note{margin:10px 0 0;color:#626d78;font-size:9px}.common{color:#f4f0e8}.uncommon{color:#70ff9f}.rare{color:#67a8ff}.epic{color:#c984ff}.legendary{color:#ffb347}
  footer{min-height:16px;line-height:16px}
  @media(any-pointer:coarse){.touch-controls{display:block}}
  @media(max-width:720px){.page{padding:6px;grid-template-rows:auto minmax(0,1fr)}header strong{display:none}footer{display:none}.players span:first-child{display:none}.stage-shell{width:100%;height:100%}.joystick{left:10px;bottom:28px}.touch-actions{right:10px;bottom:28px}.stats-overlay{padding:8px;align-items:end}.stats-panel{width:100%;padding:16px}.stat-grid{grid-template-columns:1fr 1fr}.stat-grid>div{border-bottom:1px solid rgba(71,80,91,.4)}.panel-actions{grid-template-columns:1fr}}
</style>
