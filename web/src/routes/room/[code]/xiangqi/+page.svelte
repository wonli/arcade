<script>
  import { onMount } from 'svelte'
  import { getIdentity, defaultName } from '$lib/identity.js'
  import { createTranslator } from '$lib/i18n.js'
  import { subscribeLocale } from '$lib/locale.js'
  import { createXiangqiTranslator } from '$lib/games/xiangqi/i18n.js'
  import { shouldApplyXiangqiSnapshot } from '$lib/games/xiangqi/client-state.js'
  import { buildXiangqiCreateRequest } from '$lib/games/xiangqi/setup.js'
  import XiangqiBoard from '$lib/games/xiangqi/XiangqiBoard.svelte'
  import { socket } from '$lib/ws/arcade'

  export let data

  const identity = getIdentity()
  const name = defaultName(identity.playerId)

  let roomCode = (data?.code ?? '').toUpperCase()
  let room = null
  let gameState = null
  let connection = 'connecting'
  let error = ''
  let copied = false
  let locale = 'en'
  let unsubscribeRoom = () => {}
  let unsubscribeConnection = () => {}
  let unsubscribeLocale = () => {}
  let clockNow = Date.now()
  let clockTimer = null

  $: t = createXiangqiTranslator(locale, createTranslator(locale))
  $: myIndex = room?.players?.findIndex((player) => player.id === identity.sessionId) ?? -1
  $: myColor = myIndex === 0 ? 'red' : myIndex === 1 ? 'black' : ''
  $: turnSeconds = gameState?.status === 'playing' && Number.isFinite(room?.turnDeadlineUnixMs)
    ? Math.max(0, Math.ceil((room.turnDeadlineUnixMs - clockNow) / 1000))
    : null

  function applySnapshot(snapshot) {
    if (!snapshot || snapshot.type) return
    const nextState = snapshot.state ?? null
    if (room?.id === snapshot.id && !shouldApplyXiangqiSnapshot(gameState, nextState)) return
    room = snapshot
    gameState = nextState
  }

  function subscribeRoom() {
    unsubscribeRoom()
    const topic = `room:${roomCode}`
    unsubscribeRoom = socket.subscribe(topic, (message) => {
      if (message.data?.topicId !== topic) return
      const payload = message.data.message
      if (payload?.type) return
      applySnapshot(payload)
    })
  }

  async function bootstrap() {
    error = ''
    connection = 'connecting'
    await socket.connect()
    await socket.request('arcade.login', { playerId: identity.sessionId, sessionId: identity.sessionId })

    if (roomCode === 'NEW') {
      const snapshot = await socket.request(
        'room.create',
        buildXiangqiCreateRequest({ name, players: data?.players }),
      )
      applySnapshot(snapshot)
      roomCode = snapshot.id
      history.replaceState(null, '', `/room/${roomCode.toLowerCase()}/xiangqi`)
    } else {
      applySnapshot(await socket.request('room.join', { roomId: roomCode, name }))
    }

    subscribeRoom()
    connection = 'live'
  }

  async function moveXiangqi(move) {
    if (!gameState || gameState.status !== 'playing' || gameState.turn !== myColor) return
    error = ''
    try {
      applySnapshot(await socket.request('game.move', { roomId: roomCode, move }))
    } catch (err) {
      error = err?.message ?? String(err)
    }
  }

  async function addBot() {
    error = ''
    try {
      applySnapshot(await socket.request('room.addBot', { roomId: roomCode }))
    } catch (err) {
      error = err?.message ?? String(err)
    }
  }

  async function copyInvite() {
    await navigator.clipboard.writeText(`${location.origin}/room/${roomCode.toLowerCase()}/xiangqi`)
    copied = true
    setTimeout(() => (copied = false), 1200)
  }

  async function reconnect() {
    try {
      await bootstrap()
    } catch (err) {
      connection = 'offline'
      error = err?.message ?? String(err)
    }
  }

  function canAddBot() {
    return room?.players?.length === 1 && room?.players?.[0]?.id === identity.sessionId
  }

  function statusLabel() {
    if (!room || room.players?.length < room.maxPlayers) return t('room.waitOpponent')
    if (!gameState) return t('room.preparing')
    if (gameState.status === 'finished') {
      if (!gameState.winner) return t('room.draw')
      return gameState.winner === myColor ? t('xiangqi.youWin') : t('xiangqi.youLose')
    }
    const turn = gameState.turn === myColor
      ? t('room.yourTurn')
      : (room?.players?.[1]?.bot && gameState.turn === 'black' ? t('room.botTurn') : t('room.opponentTurn'))
    return gameState.check ? `${turn} · ${t('room.check')}` : turn
  }

  function connectionLabel() {
    if (connection === 'live') return t('common.live')
    if (connection === 'offline') return locale === 'zh-CN' ? '离线' : 'OFFLINE'
    return locale === 'zh-CN' ? '连接中' : 'CONNECTING'
  }

  onMount(() => {
    unsubscribeLocale = subscribeLocale((next) => (locale = next))
    unsubscribeConnection = socket.onConnection((state) => (connection = state))
    clockTimer = setInterval(() => (clockNow = Date.now()), 250)
    bootstrap().catch((err) => {
      connection = 'offline'
      error = err?.message ?? String(err)
    })
    return () => {
      if (clockTimer) clearInterval(clockTimer)
      unsubscribeRoom()
      unsubscribeConnection()
      unsubscribeLocale()
    }
  })
</script>

<svelte:head>
  <title>{t('game.xiangqi.name')} · {roomCode.toLowerCase()} · AQI Arcade</title>
</svelte:head>

<div class="room-shell">
  <header class="room-topbar">
    <a class="brand" href="/"><span class="brand-mark">A</span><span>AQI ARCADE</span></a>
    <div class="room-meta">
      <span>{t('game.xiangqi.name')} · <strong>{roomCode.toLowerCase()}</strong></span>
      <span class:offline={connection !== 'live'} class="live-badge"><i></i>{connectionLabel()}</span>
    </div>
  </header>

  <main class="room-main">
    <section class="match-head">
      <div class="player-card active-player">
        <div class="side-token red-token">帥</div>
        <div><span>{t('xiangqi.red')}</span><strong>{room?.players?.[0]?.name ?? name}</strong></div>
      </div>
      <div class="match-status">
        <span>XIANGQI</span>
        <h1>{statusLabel()}</h1>
        <p>
          {gameState?.ply ?? 0} {locale === 'zh-CN' ? '手' : 'PLY'}
          {#if turnSeconds !== null}<strong class:urgent={turnSeconds <= 5}> · {turnSeconds}s</strong>{/if}
        </p>
      </div>
      <div class="player-card right">
        <div><span>{t('xiangqi.black')}</span><strong>{room?.players?.[1]?.name ?? t('common.waiting')}</strong></div>
        <div class="side-token black-token">將</div>
      </div>
    </section>

    <section class="board-stage">
      <div class="board-column">
        {#if room && gameState}
          <XiangqiBoard {room} state={gameState} {identity} onMove={moveXiangqi} {t} />
        {:else}
          <div class="board-loading">{t('room.preparing')}</div>
        {/if}
      </div>

      <aside class="room-panel">
        <div class="code-display"><span>{roomCode.toLowerCase()}</span><small>{t('common.roomCode')}</small></div>
        <button class="primary-button" onclick={copyInvite}>{copied ? t('common.linkCopied') : t('common.copyInvite')}</button>
        {#if canAddBot()}<button class="secondary-button" onclick={addBot}>{t('room.playBot')}</button>{/if}
        {#if error}<div class="room-error">{error}</div>{/if}
        {#if connection === 'offline'}<button class="secondary-button" onclick={reconnect}>{t('common.reconnect')}</button>{/if}
      </aside>
    </section>
  </main>
</div>

<style>
  .room-shell{min-height:100dvh;background:#0b0d10;color:#f4f0e8}.room-topbar{height:58px;display:flex;align-items:center;justify-content:space-between;gap:18px;padding:0 22px;border-bottom:1px solid #272c33;box-sizing:border-box}.brand{display:inline-flex;align-items:center;gap:10px;color:#f4f0e8;text-decoration:none;font-size:11px;font-weight:900;letter-spacing:.16em}.brand-mark{display:grid;place-items:center;width:26px;height:26px;background:#c1ff56;color:#0b0d10;font-size:12px;letter-spacing:0}.room-meta{display:flex;align-items:center;gap:14px;color:#8d96a1;font:800 9px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase}.room-meta strong{color:#f4f0e8}.live-badge{display:flex;align-items:center;gap:6px}.live-badge i{width:6px;height:6px;border-radius:50%;background:#c1ff56;box-shadow:0 0 10px #c1ff56}.live-badge.offline i{background:#7b4040;box-shadow:none}.room-main{width:min(1180px,calc(100% - 32px));margin:0 auto;padding:28px 0 40px}.match-head{display:grid;grid-template-columns:minmax(0,1fr) minmax(260px,1.1fr) minmax(0,1fr);align-items:center;gap:18px;margin-bottom:24px}.player-card{display:flex;align-items:center;gap:12px;min-width:0;padding:12px;border:1px solid #30363f;background:#0e1115}.player-card.right{justify-content:flex-end;text-align:right}.player-card span{display:block;color:#707985;font-size:8px;font-weight:900;letter-spacing:.14em}.player-card strong{display:block;margin-top:4px;overflow:hidden;text-overflow:ellipsis;color:#f4f0e8;font-size:13px;white-space:nowrap}.side-token{display:grid;place-items:center;flex:0 0 auto;width:42px;height:42px;border-radius:50%;background:#ead9b7;font:800 24px 'Songti SC','STSong','Noto Serif CJK SC',serif}.red-token{border:2px solid #a62824;color:#a62824}.black-token{border:2px solid #17191c;color:#17191c}.match-status{text-align:center}.match-status>span{color:#6e7782;font:900 9px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.16em}.match-status h1{margin:6px 0 4px;color:#f4f0e8;font-size:24px;line-height:1.1}.match-status p{margin:0;color:#69727d;font:800 9px ui-monospace,SFMono-Regular,Menlo,monospace}.match-status p strong{color:#9aa4af}.match-status p strong.urgent{color:#ff8a8a}.board-stage{display:grid;grid-template-columns:minmax(0,1fr) 230px;gap:24px;align-items:start}.board-column{min-width:0;display:grid;place-items:center}.board-loading{width:min(100%,650px);aspect-ratio:8/9;display:grid;place-items:center;border:1px solid #30363f;background:#0e1115;color:#69727d;font-size:12px}.room-panel{position:sticky;top:82px;padding:16px;border:1px solid #30363f;background:#0e1115}.code-display{padding:13px 0 16px;border-bottom:1px solid #272c33}.code-display span{display:block;color:#f4f0e8;font:900 28px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em}.code-display small{display:block;margin-top:4px;color:#68717c;font-size:8px;font-weight:900;letter-spacing:.14em}.primary-button,.secondary-button{width:100%;height:44px;margin-top:12px;border-radius:0;font:inherit;font-size:10px;font-weight:900;cursor:pointer}.primary-button{border:0;background:#c1ff56;color:#0b0d10}.secondary-button{border:1px solid #3b424c;background:#0b0d10;color:#f4f0e8}.room-error{margin-top:12px;padding:10px;border:1px solid #653f3f;background:#1a1112;color:#ffaaaa;font-size:11px;line-height:1.4}@media(max-width:900px){.board-stage{grid-template-columns:1fr}.room-panel{position:static}.match-head{grid-template-columns:1fr 1fr}.match-status{grid-column:1/-1;grid-row:1}.player-card{grid-row:2}}@media(max-width:640px){.room-topbar{height:50px;padding:0 12px}.room-meta>span:first-child{display:none}.room-main{width:calc(100% - 16px);padding:18px 0 28px}.match-head{gap:8px;margin-bottom:14px}.player-card{padding:8px}.side-token{width:34px;height:34px;font-size:19px}.player-card strong{font-size:11px}.match-status h1{font-size:20px}.board-stage{gap:14px}}
</style>
