<script>
  import { onMount } from 'svelte'
  import { createTranslator } from '$lib/i18n.js'
  import { subscribeLocale } from '$lib/locale.js'
  import { createReplaySession } from '$lib/replay/session.js'
  import { loadTankAssetBundle } from './asset-bundle.js'
  import { replay as tankReplay } from './replay.js'
  import TankGameSurface from './TankGameSurface.svelte'

  export let room
  export let roomCode
  export let identity
  export let socket

  const assetKeys = ['grass','blueBody','blueTurret','redBody','redTurret','bullet','barrel','barricade','sandbag','tree','muzzle']
  const movementKeys = new Set(['w','W','a','A','s','S','d','D','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'])

  let state = room?.state ?? null
  let error = ''
  let copied = false
  let locale = 'en'
  let unsubscribe = () => {}
  let unsubscribeLocale = () => {}
  let replaySession = null
  let replayFinished = false
  let bundle = null
  let assetUrls = null
  let assetStatus = 'checking'
  let assetPhase = 'checking'
  let assetPercent = 0
  let assetError = ''
  let mounted = false
  let held = new Set()
  let touchForward = false
  let touchBack = false
  let touchLeft = false
  let touchRight = false
  let firing = false
  let aimAngle = 0
  let inputTimer = null

  $: t = createTranslator(locale)

  function isHost() { return room?.hostId === identity.sessionId }
  function enoughPlayers() { return (room?.players?.length ?? 0) === 2 }

  function tankFor(snapshot, playerId) {
    return snapshot?.tanks?.find((tank) => tank.playerId === playerId) ?? null
  }

  function applyState(next) {
    if (!next) return
    const previous = state
    const starting = next.status === 'playing' && previous?.status !== 'playing'
    state = next
    if (starting) {
      replayFinished = false
      void replaySession?.restart(next)
    } else if (next.status === 'playing') {
      replaySession?.record(next)
    }
    if (previous?.status !== 'finished' && next.status === 'finished' && !replayFinished) {
      replayFinished = true
      void replaySession?.finish(next)
    }
  }

  async function prepareAssets() {
    assetError = ''
    assetStatus = 'loading'
    assetPhase = 'checking'
    assetPercent = 0
    const previous = bundle
    bundle = null
    assetUrls = null
    previous?.dispose()
    try {
      const loaded = await loadTankAssetBundle({
        onProgress(progress) {
          assetPhase = progress.phase ?? 'download'
          assetPercent = progress.percent ?? 0
        },
      })
      if (!mounted) { loaded.dispose(); return }
      const urls = Object.fromEntries(assetKeys.map((key) => [key, loaded.asset(key)]))
      bundle = loaded
      assetUrls = urls
      assetStatus = 'ready'
      assetPhase = 'ready'
      assetPercent = 100
    } catch (cause) {
      if (!mounted) return
      assetStatus = 'error'
      assetPhase = 'error'
      assetError = cause?.message ?? String(cause)
    }
  }

  async function start() {
    if (assetStatus !== 'ready' || !enoughPlayers()) return
    error = ''
    try { await socket.request('tank.start', { roomId: roomCode }) }
    catch (cause) { error = cause.message }
  }

  async function restart() {
    if (assetStatus !== 'ready') return
    error = ''
    replayFinished = false
    try { await socket.request('tank.restart', { roomId: roomCode }) }
    catch (cause) { error = cause.message }
  }

  async function copyInvite() {
    await navigator.clipboard.writeText(`${location.origin}/room/${roomCode.toLowerCase()}/tank`)
    copied = true
    setTimeout(() => (copied = false), 1200)
  }

  function movementInput() {
    const forward = held.has('w') || held.has('W') || held.has('ArrowUp') || touchForward
    const back = held.has('s') || held.has('S') || held.has('ArrowDown') || touchBack
    const left = held.has('a') || held.has('A') || held.has('ArrowLeft') || touchLeft
    const right = held.has('d') || held.has('D') || held.has('ArrowRight') || touchRight
    return {
      throttle: (forward ? 1 : 0) + (back ? -1 : 0),
      turn: (right ? 1 : 0) + (left ? -1 : 0),
    }
  }

  function sendInput() {
    if (assetStatus !== 'ready' || state?.status !== 'playing' || state?.roundResetTicks > 0) return
    const movement = movementInput()
    socket.request('tank.input', {
      roomId: roomCode,
      input: { ...movement, turretAngle: aimAngle, fire: firing },
    }).catch((cause) => { error = cause.message })
  }

  function handleKeyDown(event) {
    if (movementKeys.has(event.key)) {
      event.preventDefault()
      held.add(event.key)
      sendInput()
      return
    }
    if (event.code === 'Space') {
      event.preventDefault()
      firing = true
      sendInput()
    }
  }

  function handleKeyUp(event) {
    if (movementKeys.has(event.key)) {
      event.preventDefault()
      held.delete(event.key)
      sendInput()
      return
    }
    if (event.code === 'Space') {
      event.preventDefault()
      firing = false
      sendInput()
    }
  }

  function clearControls() {
    held.clear()
    touchForward = touchBack = touchLeft = touchRight = false
    firing = false
    sendInput()
  }

  function setAim(angle) {
    aimAngle = angle
    sendInput()
  }

  function setFire(value) {
    firing = value
    sendInput()
  }

  function touchControl(name, value) {
    if (name === 'forward') touchForward = value
    if (name === 'back') touchBack = value
    if (name === 'left') touchLeft = value
    if (name === 'right') touchRight = value
    sendInput()
  }

  function statusLabel() {
    if (!state) return t('tank.waitingRoom')
    if (state.status === 'finished') {
      if (state.winner === identity.sessionId) return t('tank.youWin')
      return t('tank.opponentWins')
    }
    if (state.roundResetTicks > 0) return t('tank.nextRound', { round: state.round + 1 })
    return t('tank.live')
  }

  function assetLabel() {
    if (assetStatus === 'ready') return t('tank.assetsReady')
    if (assetStatus === 'error') return t('tank.assetsFailed')
    if (assetPhase === 'cache') return t('tank.assetsCache')
    if (assetPhase === 'unpack') return t('tank.assetsPreparing')
    if (assetPhase === 'download') return t('tank.assetsDownloading', { percent: assetPercent })
    return t('tank.assetsChecking')
  }

  onMount(() => {
    mounted = true
    unsubscribeLocale = subscribeLocale((next) => (locale = next))
    replaySession = createReplaySession({ adapter: tankReplay, roomCode: () => roomCode, room: () => room, identity, socket })
    if (state?.status === 'playing') void replaySession.restart(state)

    const topic = `room:${roomCode.toUpperCase()}`
    unsubscribe = socket.subscribe(topic, (message) => {
      if (message.data?.topicId !== topic) return
      const payload = message.data.message
      if (payload?.type === 'tank.state') applyState(payload.state)
    })

    window.addEventListener('keydown', handleKeyDown, { passive: false })
    window.addEventListener('keyup', handleKeyUp, { passive: false })
    window.addEventListener('blur', clearControls)
    inputTimer = setInterval(sendInput, 50)
    void prepareAssets()

    return () => {
      mounted = false
      unsubscribe()
      unsubscribeLocale()
      replaySession?.destroy()
      bundle?.dispose()
      clearInterval(inputTimer)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', clearControls)
    }
  })
</script>

<section class="tank-shell">
  {#if room?.status === 'waiting' && !state}
    <div class="lobby-head">
      <div><span>{t('game.tank.name')}</span><h1>{t('tank.waitingRoom')}</h1><p>{t('tank.players',{count:room.players.length,max:2})}</p></div>
      <div class="code"><strong>{roomCode.toLowerCase()}</strong><small>{t('common.roomCode')}</small></div>
    </div>
    <div class="lobby-grid">
      <div class="roster">
        {#each room.players as player,index}
          <div class="roster-row"><i class:red={index===1}></i><strong>{player.name}</strong><span>{player.id===room.hostId?t('common.host'):t('common.ready')}</span></div>
        {/each}
        {#if room.players.length < 2}<div class="empty-seat">{t('room.waitOpponent')}</div>{/if}
      </div>
      <aside class="lobby-actions">
        <div class:failed={assetStatus==='error'} class:ready={assetStatus==='ready'} class="asset-state">
          <span>{t('tank.assets')}</span><strong>{assetLabel()}</strong>
          {#if assetStatus === 'loading'}<div><i style={`width:${assetPercent}%`}></i></div>{/if}
          {#if assetError}<small>{assetError}</small>{/if}
        </div>
        {#if assetStatus === 'error'}<button class="retry" onclick={prepareAssets}>{t('tank.retryAssets')}</button>{/if}
        <button class="invite" onclick={copyInvite}>{copied?t('common.linkCopied'):t('common.copyInvite')}</button>
        {#if isHost()}
          <button class="start" disabled={assetStatus!=='ready'||!enoughPlayers()} onclick={start}>{t('tank.start')}</button>
        {:else}
          <p>{t('tank.waitHost')}</p>
        {/if}
      </aside>
    </div>
  {:else if assetStatus !== 'ready'}
    <div class="asset-gate">
      <span>{t('game.tank.name')}</span>
      <h1>{assetLabel()}</h1>
      {#if assetStatus === 'loading'}<div class="gate-progress"><i style={`width:${assetPercent}%`}></i></div>{/if}
      {#if assetError}<p>{assetError}</p><button onclick={prepareAssets}>{t('tank.retryAssets')}</button>{/if}
    </div>
  {:else}
    <div class="arena-head">
      <div><span>{t('game.tank.name')}</span><h1>{statusLabel()}</h1><p>{t('tank.round',{round:state?.round??1})} · {t('tank.firstTo',{score:state?.targetScore??5})}</p></div>
      <div class="code"><strong>{roomCode.toLowerCase()}</strong><small>{t('common.roomCode')}</small></div>
    </div>

    <TankGameSurface {state} {identity} {assetUrls} interactive={state?.status==='playing'} onAim={setAim} onFire={setFire} />

    <div class="controls-row">
      <div class="drive-pad" aria-label={t('tank.driveControls')}>
        <button onpointerdown={() => touchControl('forward',true)} onpointerup={() => touchControl('forward',false)} onpointercancel={() => touchControl('forward',false)}>▲</button>
        <button onpointerdown={() => touchControl('left',true)} onpointerup={() => touchControl('left',false)} onpointercancel={() => touchControl('left',false)}>◀</button>
        <button onpointerdown={() => touchControl('back',true)} onpointerup={() => touchControl('back',false)} onpointercancel={() => touchControl('back',false)}>▼</button>
        <button onpointerdown={() => touchControl('right',true)} onpointerup={() => touchControl('right',false)} onpointercancel={() => touchControl('right',false)}>▶</button>
      </div>
      <p>{t('tank.controls')}</p>
      <button class="fire" onpointerdown={() => setFire(true)} onpointerup={() => setFire(false)} onpointercancel={() => setFire(false)}>{t('tank.fire')}</button>
    </div>

    {#if state?.status==='finished' && isHost()}<button class="restart" onclick={restart}>{t('common.playAgain')}</button>{/if}
  {/if}
  {#if error}<div class="tank-error">{error}</div>{/if}
</section>

<style>
  .tank-shell{width:min(100%,1180px);margin:0 auto}.lobby-head,.arena-head{display:flex;align-items:end;justify-content:space-between;gap:24px;margin-bottom:20px}.lobby-head>div>span,.arena-head>div>span,.asset-gate>span{color:#7f8791;font-size:10px;font-weight:900;letter-spacing:.18em}.lobby-head h1,.arena-head h1,.asset-gate h1{margin:5px 0 0;font-size:clamp(30px,5vw,48px);letter-spacing:-.045em}.lobby-head p,.arena-head p{margin:8px 0 0;color:#7f8791}.code{text-align:right}.code strong{display:block;color:#c1ff56;font:900 28px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em}.code small{color:#69727d;font-size:9px;letter-spacing:.14em}.lobby-grid{display:grid;grid-template-columns:minmax(320px,1fr) 300px;gap:24px}.roster{border:1px solid #2d333b;background:#0b0d10}.roster-row{display:grid;grid-template-columns:14px 1fr auto;align-items:center;gap:12px;padding:15px 16px;border-bottom:1px solid #20252c}.roster-row i{width:10px;height:10px;background:#4da5ff}.roster-row i.red{background:#ff6d62}.roster-row span{color:#69727d;font-size:9px;letter-spacing:.12em}.empty-seat{padding:18px 16px;color:#69727d;font-size:11px}.lobby-actions{display:flex;flex-direction:column;gap:10px}.lobby-actions button,.restart,.asset-gate button{height:48px;font-weight:900;cursor:pointer}.invite,.retry{border:1px solid #3b424c;background:transparent;color:#f4f0e8}.start,.restart,.asset-gate button{border:0;background:#c1ff56;color:#0b0d10}.start:disabled{opacity:.32;cursor:not-allowed}.lobby-actions p{color:#7f8791;font-size:12px;text-align:center}.asset-state{padding:13px;border:1px solid #30363f;background:#0e1115}.asset-state>span{display:block;color:#69727d;font-size:8px;font-weight:900;letter-spacing:.14em}.asset-state>strong{display:block;margin-top:6px;font-size:11px}.asset-state>div,.gate-progress{height:4px;margin-top:10px;background:#20252c;overflow:hidden}.asset-state>div i,.gate-progress i{display:block;height:100%;background:#c1ff56}.asset-state.ready{border-color:#45572d}.asset-state.failed{border-color:#66363b}.asset-state.failed strong,.asset-state small{color:#ff8d8d}.asset-state small{display:block;margin-top:7px;line-height:1.35}.asset-gate{min-height:480px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;border:1px solid #292f36;background:#0c0f13;padding:30px}.asset-gate .gate-progress{width:min(420px,80%);margin-top:22px}.asset-gate p{max-width:620px;color:#ff8d8d;font-size:11px}.asset-gate button{min-width:180px;padding:0 22px;margin-top:12px}.controls-row{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:14px;margin-top:12px}.controls-row p{margin:0;color:#69727d;text-align:center;font-size:9px;letter-spacing:.08em}.drive-pad{display:grid;grid-template-columns:repeat(4,44px);gap:5px}.drive-pad button,.fire{height:44px;border:1px solid #3a424c;background:#101419;color:#f4f0e8;font-weight:950;touch-action:none;cursor:pointer}.fire{min-width:100px;border-color:#ff6d62;color:#ff8d84}.restart{display:block;width:min(100%,420px);margin:18px auto 0}.tank-error{margin-top:14px;color:#ff8d8d;text-align:center;font-size:12px}
  @media(max-width:700px){.lobby-head,.arena-head{align-items:start}.lobby-grid{grid-template-columns:1fr}.controls-row{grid-template-columns:1fr auto}.controls-row p{display:none}.drive-pad{grid-template-columns:repeat(4,minmax(42px,1fr))}.fire{min-width:82px}}
</style>
