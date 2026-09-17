<script>
  import { onMount } from 'svelte'
  import { getIdentity, defaultName } from '$lib/identity.js'
  import { createTranslator } from '$lib/i18n.js'
  import { subscribeLocale } from '$lib/locale.js'
  import PreviewButton from '$lib/components/PreviewButton.svelte'
  import { uploadPreview } from '$lib/preview/client.js'
  import { createPreviewController } from '$lib/preview/controller.js'
  import { renderChessPreview, renderGomokuPreview } from '$lib/preview/renderers.js'
  import { socket } from '$lib/ws/arcade'
  import TetrisBattle from '$lib/games/tetris/TetrisBattle.svelte'
  import SnakeArena from '$lib/games/snake/SnakeArena.svelte'
  import DrawGuess from '$lib/games/drawguess/DrawGuess.svelte'
  import ChessBoard from '$lib/games/chess/ChessBoard.svelte'

  export let data

  const identity = getIdentity()
  const name = defaultName(identity.playerId)

  let roomCode = (data?.code ?? '').toUpperCase()
  let gameName = (data?.game ?? 'gomoku').toLowerCase()
  let room = null
  let gameState = null
  let connection = 'connecting'
  let error = ''
  let copied = false
  let botDifficulty = data?.difficulty ?? 'medium'
  let locale = 'en'
  let unsubscribeRoom = () => {}
  let unsubscribeConnection = () => {}
  let unsubscribeLocale = () => {}
  let unsubscribePreview = () => {}
  let audioContext = null
  let previewController = null
  let previewGame = ''
  let previewState = { phase: 'idle', autoRemaining: 0, cooldownRemaining: 0, error: '' }

  $: t = createTranslator(locale)
  $: if (room && (gameName === 'gomoku' || gameName === 'chess') && previewGame !== gameName) setupRoomPreview(gameName)
  $: roomPreviewActive = !!previewController && gameState?.status === 'playing' && (room?.players?.length ?? 0) >= (room?.maxPlayers ?? 2)
  $: if (previewController) {
    if (roomPreviewActive) previewController.enterPlaying(`${roomCode}:${gameName}`)
    else previewController.leavePlaying()
  }

  const size = 15
  const cells = Array.from({ length: size * size }, (_, index) => ({ x: index % size, y: Math.floor(index / size) }))

  function tone(frequency, duration, volume = .035, delay = 0) {
    if (typeof window === 'undefined') return
    audioContext ??= new AudioContext()
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => {})
    const oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()
    const start = audioContext.currentTime + delay
    oscillator.frequency.value = frequency
    oscillator.type = 'sine'
    gain.gain.setValueAtTime(volume, start)
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration)
    oscillator.connect(gain)
    gain.connect(audioContext.destination)
    oscillator.start(start)
    oscillator.stop(start + duration)
  }

  function playMoveSound() { tone(360, .06, .025) }

  function playFinishSound(winner, roomState) {
    if (!winner) { tone(300, .12); tone(260, .16, .03, .1); return }
    if (gameName === 'chess') {
      if (winner === myChessColor(roomState)) { tone(440, .1); tone(660, .16, .035, .09) }
      else { tone(330, .1); tone(220, .18, .035, .09) }
      return
    }
    if (winner === myStone(roomState)) { tone(440, .1); tone(660, .16, .035, .09) }
    else { tone(330, .1); tone(220, .18, .035, .09) }
  }

  function applySnapshot(snapshot) {
    if (!snapshot || snapshot.type) return
    const previous = gameState
    room = snapshot
    gameState = snapshot.state ?? null
    if (!previous || !gameState) return
    if (gameName === 'gomoku') {
      if (gameState.status === 'finished' && previous.status !== 'finished') playFinishSound(gameState.winner, snapshot)
      else if (gameState.moves > previous.moves) playMoveSound()
    }
    if (gameName === 'chess' && gameState.status === 'finished' && previous.status !== 'finished') {
      playFinishSound(gameState.winner, snapshot)
    }
  }

  function myStone(roomState) {
    const index = roomState?.players?.findIndex((player) => player.id === identity.sessionId) ?? -1
    return index === 0 ? 1 : index === 1 ? 2 : 0
  }

  function myChessColor(roomState) {
    const index = roomState?.players?.findIndex((player) => player.id === identity.sessionId) ?? -1
    return index === 0 ? 'white' : index === 1 ? 'black' : ''
  }

  function canMove(roomState, state, x, y) { return !!state && state.status === 'playing' && myStone(roomState) === state.turn && state.board?.[y]?.[x] === 0 }
  function canAddBot(roomState) { return (gameName === 'gomoku' || gameName === 'chess') && roomState?.maxPlayers === 2 && roomState?.players?.length === 1 && roomState.players[0]?.id === identity.sessionId }
  function isMultiplayer(roomState) { return roomState?.maxPlayers === 2 }

  function setupRoomPreview(nextGame) {
    unsubscribePreview()
    previewController?.destroy()
    previewGame = nextGame
    previewController = createPreviewController({
      game: nextGame,
      roomId: () => roomCode,
      players: () => room?.players?.length ?? 0,
      capture: captureRoomPreview,
      upload: (payload) => uploadPreview({ ...payload, socket }),
    })
    unsubscribePreview = previewController.subscribe((next) => (previewState = next))
  }

  async function captureRoomPreview() {
    if (!gameState) throw new Error('game preview is not ready')
    if (gameName === 'chess') {
      return { blob: await renderChessPreview(gameState), summary: { moves: gameState.ply ?? 0 } }
    }
    return { blob: await renderGomokuPreview(gameState), summary: { moves: gameState.moves ?? 0 } }
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
      const wantsChessBot = gameName === 'chess' && data?.players === 1
      const snapshot = await socket.request('room.create', { game: gameName, name, players: wantsChessBot ? 2 : (data?.players ?? 2) })
      applySnapshot(snapshot)
      roomCode = snapshot.id
      if (wantsChessBot) {
        applySnapshot(await socket.request('room.addBot', { roomId: roomCode, difficulty: botDifficulty }))
      }
      history.replaceState(null, '', `/room/${roomCode.toLowerCase()}/${gameName}`)
    } else {
      const snapshot = await socket.request('room.join', { roomId: roomCode, name })
      if (snapshot.game !== gameName) {
        gameName = snapshot.game
        history.replaceState(null, '', `/room/${roomCode.toLowerCase()}/${gameName}`)
      }
      applySnapshot(snapshot)
    }

    subscribeRoom()
    connection = 'live'
  }

  async function moveStone(x, y) { if (!canMove(room, gameState, x, y)) return; error=''; try { applySnapshot(await socket.request('game.move',{roomId:roomCode,move:{x,y}})) } catch(err){ error=err.message } }
  async function moveChess(move) { error=''; try { applySnapshot(await socket.request('game.move',{roomId:roomCode,move})) } catch(err){ error=err.message } }
  async function addBot() { error=''; try { applySnapshot(await socket.request('room.addBot',{roomId:roomCode,difficulty:botDifficulty})) } catch(err){ error=err.message } }
  async function rematch() { error=''; try { applySnapshot(await socket.request('room.rematch',{roomId:roomCode})) } catch(err){ error=err.message } }
  async function copyInvite() { await navigator.clipboard.writeText(`${location.origin}/room/${roomCode.toLowerCase()}/${gameName}`); copied=true; setTimeout(()=>copied=false,1200) }
  async function reconnect() { try { await bootstrap() } catch(err){ connection='offline'; error=err.message } }
  function stoneAt(state,x,y){ return state?.board?.[y]?.[x]??0 }
  function isLast(state,x,y){ return state?.last?.x===x&&state?.last?.y===y }

  function gameLabel(roomState,state){
    if(!roomState||roomState.players.length<roomState.maxPlayers)return t('room.waitFriend')
    if(!state)return t('room.preparing')
    if(state.status==='finished'){if(!state.winner)return t('room.draw');return state.winner===myStone(roomState)?t('room.youWin'):t('room.friendWins')}
    return state.turn===myStone(roomState)?t('room.yourTurn'):t('room.friendTurn')
  }

  function chessLabel(roomState, state) {
    if (!roomState || roomState.players.length < roomState.maxPlayers) return t('room.waitOpponent')
    if (!state) return t('room.preparing')
    if (state.status === 'finished') {
      if (state.winner) return state.winner === myChessColor(roomState) ? t('room.checkmateYou') : t('room.checkmateOpponent')
      if (state.drawReason === 'stalemate') return t('room.stalemate')
      if (state.drawReason === 'threefold-repetition') return t('room.threefold')
      if (state.drawReason === 'fifty-move') return t('room.fiftyMove')
      if (state.drawReason === 'insufficient-material') return t('room.insufficient')
      return t('room.draw')
    }
    const mine = myChessColor(roomState)
    const turn = state.turn === mine ? t('room.yourTurn') : (roomState.players?.[1]?.bot && state.turn === 'black' ? t('room.botTurn') : t('room.opponentTurn'))
    return state.check ? `${turn} · ${t('room.check')}` : turn
  }

  function pageTitle(){
    if(gameName==='tetris')return t('game.tetris.name')
    if(gameName==='snake')return t('game.snake.name')
    if(gameName==='drawguess')return t('game.drawguess.name')
    if(gameName==='chess')return t('game.chess.name')
    return t('game.gomoku.name')
  }

  function connectionLabel() {
    if (connection === 'live') return t('common.live')
    if (connection === 'offline') return locale === 'zh-CN' ? '离线' : 'OFFLINE'
    return locale === 'zh-CN' ? '连接中' : 'CONNECTING'
  }

  function difficultyLabel(value) {
    if (locale !== 'zh-CN') return value[0].toUpperCase() + value.slice(1)
    return { easy:'简单', medium:'普通', hard:'困难', expert:'专家' }[value] ?? value
  }

  function gomokuBoardLabel() { return locale === 'zh-CN' ? '五子棋棋盘' : 'Gomoku board' }
  function placeStoneLabel(x, y) { return locale === 'zh-CN' ? `在第 ${x + 1} 列第 ${y + 1} 行落子` : `Place stone at ${x + 1}, ${y + 1}` }

  onMount(()=>{
    unsubscribeLocale=subscribeLocale((next)=>{locale=next})
    unsubscribeConnection=socket.onConnection((state)=>{connection=state})
    bootstrap().catch((err)=>{connection='offline';error=err.message})
    return()=>{unsubscribeRoom();unsubscribeConnection();unsubscribeLocale();unsubscribePreview();previewController?.destroy();audioContext?.close()}
  })
</script>

<svelte:head><title>{pageTitle()} · {roomCode.toLowerCase()} · AQI Arcade</title></svelte:head>

<div class="room-shell">
  <header class="room-topbar">
    <a class="brand" href="/"><span class="brand-mark">A</span><span>AQI ARCADE</span></a>
    <div class="room-meta"><span>{pageTitle()} · <strong>{roomCode.toLowerCase()}</strong></span><span class:offline={connection!=='live'} class="live-badge"><i></i>{connectionLabel()}</span></div>
  </header>

  <main class="room-main">
    {#if gameName === 'drawguess'}
      {#if room}<DrawGuess {room} {roomCode} {identity} {socket} />{/if}
      {#if error}<div class="room-error standalone-error">{error}</div>{/if}
      {#if connection === 'offline'}<button class="secondary-button reconnect" onclick={reconnect}>{t('common.reconnect')}</button>{/if}
    {:else if gameName === 'snake'}
      {#if room}<SnakeArena {room} {roomCode} {identity} {socket} />{/if}
      {#if error}<div class="room-error standalone-error">{error}</div>{/if}
      {#if connection === 'offline'}<button class="secondary-button reconnect" onclick={reconnect}>{t('common.reconnect')}</button>{/if}
    {:else if gameName === 'tetris'}
      {#if room}<TetrisBattle {room} {roomCode} {identity} {socket} />{/if}
      {#if isMultiplayer(room)}<aside class="room-panel tetris-panel"><div class="code-display"><span>{roomCode.toLowerCase()}</span><small>{t('common.roomCode')}</small></div><button class="primary-button" onclick={copyInvite}>{copied?t('common.linkCopied'):t('common.copyInvite')}</button></aside>{/if}
      {#if error}<div class="room-error">{error}</div>{/if}
      {#if connection==='offline'}<button class="secondary-button" onclick={reconnect}>{t('common.reconnect')}</button>{/if}
    {:else if gameName === 'chess'}
      <section class="match-head chess-head">
        <div class="player-card active-player"><div class="chess-side white-side">♔</div><div><span>{t('room.white')}</span><strong>{room?.players?.[0]?.name??name}</strong></div></div>
        <div class="match-status"><span>{t('game.chess.name').toUpperCase()}</span><h1>{chessLabel(room,gameState)}</h1><p>{t('room.halfMoves',{count:gameState?.ply??0})}</p></div>
        <div class="player-card right"><div><span>{t('room.black')}</span><strong>{room?.players?.[1]?.name??t('common.waiting')}{room?.players?.[1]?.botDifficulty ? ` · ${difficultyLabel(room.players[1].botDifficulty).toUpperCase()}` : ''}</strong></div><div class="chess-side black-side">♚</div></div>
      </section>
      <section class="board-stage chess-stage">
        <div class="chess-board-column">{#if room && gameState}<ChessBoard {room} state={gameState} {identity} onMove={moveChess} />{/if}</div>
        <aside class="room-panel chess-panel">
          <div class="code-display"><span>{roomCode.toLowerCase()}</span><small>{t('common.roomCode')}</small></div>
          <button class="primary-button" onclick={copyInvite}>{copied?t('common.linkCopied'):t('common.copyInvite')}</button>
          {#if roomPreviewActive}<PreviewButton state={previewState} {t} onUpdate={() => previewController?.updateNow()} />{/if}
          {#if canAddBot(room)}
            <div class="difficulty-control"><label for="bot-difficulty">{t('room.botDifficulty')}</label><select id="bot-difficulty" bind:value={botDifficulty}><option value="easy">{difficultyLabel('easy')}</option><option value="medium">{difficultyLabel('medium')}</option><option value="hard">{difficultyLabel('hard')}</option><option value="expert">{difficultyLabel('expert')}</option></select></div>
            <button class="secondary-button" onclick={addBot}>{t('room.playBot')}</button>
          {/if}
          {#if gameState?.status==='finished'&&myChessColor(room)}<button class="secondary-button" onclick={rematch}>{t('common.playAgain')}</button>{/if}
          {#if error}<div class="room-error">{error}</div>{/if}
          {#if connection==='offline'}<button class="secondary-button" onclick={reconnect}>{t('common.reconnect')}</button>{/if}
        </aside>
      </section>
    {:else}
      <section class="match-head"><div class="player-card active-player"><div class="player-stone black"></div><div><span>{t('room.black')}</span><strong>{room?.players?.[0]?.name??name}</strong></div></div><div class="match-status"><span>{t('game.gomoku.name').toUpperCase()}</span><h1>{gameLabel(room,gameState)}</h1><p>{t('room.players',{count:room?.players?.length??0,max:room?.maxPlayers??2})}</p></div><div class="player-card right"><div><span>{t('room.white')}</span><strong>{room?.players?.[1]?.name??t('common.waiting')}</strong></div><div class="player-stone white"></div></div></section>
      <section class="board-stage"><div class="board-frame"><div class="gomoku-board" aria-label={gomokuBoardLabel()}>{#each cells as cell}<button class:last={isLast(gameState,cell.x,cell.y)} class:playable={canMove(room,gameState,cell.x,cell.y)} class="board-cell" onclick={()=>moveStone(cell.x,cell.y)} aria-label={placeStoneLabel(cell.x,cell.y)}>{#if stoneAt(gameState,cell.x,cell.y)===1}<span class="stone stone-black"></span>{:else if stoneAt(gameState,cell.x,cell.y)===2}<span class="stone stone-white"></span>{:else}<span class="ghost-stone"></span>{/if}</button>{/each}</div></div>
      {#if isMultiplayer(room)}<aside class="room-panel"><div class="code-display"><span>{roomCode.toLowerCase()}</span><small>{t('common.roomCode')}</small></div><button class="primary-button" onclick={copyInvite}>{copied?t('common.linkCopied'):t('common.copyInvite')}</button>{#if roomPreviewActive}<PreviewButton state={previewState} {t} onUpdate={() => previewController?.updateNow()} />{/if}{#if canAddBot(room)}<button class="secondary-button" onclick={addBot}>{t('room.addBot')}</button>{/if}{#if gameState?.status==='finished'&&myStone(room)!==0}<button class="secondary-button" onclick={rematch}>{t('common.playAgain')}</button>{/if}{#if error}<div class="room-error">{error}</div>{/if}{#if connection==='offline'}<button class="secondary-button" onclick={reconnect}>{t('common.reconnect')}</button>{/if}</aside>{/if}</section>
    {/if}
  </main>
</div>

<style>
  .tetris-panel{width:min(100%,960px);margin:26px auto 0;display:grid;grid-template-columns:180px minmax(180px,260px);gap:12px;align-items:stretch}.tetris-panel .code-display{margin:0}.standalone-error{width:min(100%,1180px);margin:16px auto 0}.reconnect{display:block;margin:14px auto 0}.chess-stage{align-items:start}.chess-board-column{min-width:0;width:100%}.chess-side{display:grid;place-items:center;width:42px;height:42px;border:1px solid #343a42;font-family:'Times New Roman',serif;font-size:32px}.white-side{background:#f3eddf;color:#17191c}.black-side{background:#17191c;color:#f3eddf}.difficulty-control{display:grid;gap:7px;margin-top:12px}.difficulty-control label{color:#727c87;font-size:9px;font-weight:900;letter-spacing:.14em}.difficulty-control select{height:44px;padding:0 10px;border:1px solid #3b424c;border-radius:0;background:#0b0d10;color:#f4f0e8;font:inherit;text-transform:uppercase}.chess-panel{position:sticky;top:92px}@media(max-width:900px){.chess-panel{position:static}}@media(max-width:640px){.tetris-panel{grid-template-columns:1fr}.chess-head .player-card strong{font-size:11px}.chess-side{width:34px;height:34px;font-size:26px}}
</style>