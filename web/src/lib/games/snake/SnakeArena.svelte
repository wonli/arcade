<script>
  import { onMount } from 'svelte'
  import { createTranslator } from '$lib/i18n.js'
  import { subscribeLocale } from '$lib/locale.js'
  import { createReplaySession } from '$lib/replay/session.js'
  import { DEFAULT_SNAKE_SPEED, normalizeSnakeSpeed } from '$lib/games/snake/speed.js'
  import { replay as snakeReplay } from '$lib/games/snake/replay.js'
  import { swipeDirection } from '$lib/games/touch/swipe.js'
  import SnakeGameSurface from './SnakeGameSurface.svelte'

  export let room
  export let roomCode
  export let identity
  export let socket

  let state = room?.state ?? null
  let error = ''
  let copied = false
  let speed = DEFAULT_SNAKE_SPEED
  let unsubscribe = () => {}
  let unsubscribeLocale = () => {}
  let audioContext = null
  let locale = 'en'
  let swipeStart = null
  let replaySession = null
  let replayFinished = false

  $: t = createTranslator(locale)

  const keyDirections = { ArrowUp:'up', w:'up', W:'up', ArrowDown:'down', s:'down', S:'down', ArrowLeft:'left', a:'left', A:'left', ArrowRight:'right', d:'right', D:'right' }

  function isHost() { return room?.hostId === identity.sessionId }

  function tone(frequency, duration = 0.06, volume = 0.025, delay = 0) {
    if (typeof window === 'undefined') return
    audioContext ??= new AudioContext()
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => {})
    const oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()
    const start = audioContext.currentTime + delay
    oscillator.type = 'square'
    oscillator.frequency.value = frequency
    gain.gain.setValueAtTime(volume, start)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    oscillator.connect(gain)
    gain.connect(audioContext.destination)
    oscillator.start(start)
    oscillator.stop(start + duration)
  }

  function play(name) {
    if (name === 'start') { tone(330,.05); tone(440,.05,.025,.06); tone(660,.08,.03,.12) }
    if (name === 'eat') { tone(640,.045,.02); tone(860,.05,.02,.035) }
    if (name === 'death') { tone(180,.08,.035); tone(90,.16,.035,.06) }
    if (name === 'otherDeath') tone(240,.08,.018)
    if (name === 'win') { tone(440,.08,.03); tone(660,.09,.03,.08); tone(880,.16,.035,.16) }
  }

  function snakeFor(snapshot, playerId) { return snapshot?.snakes?.find((snake) => snake.playerId === playerId) }

  function applyState(next) {
    if (!next) return
    const previous = state
    const startingRound = next.status === 'playing' && previous?.status !== 'playing'
    state = next
    if (startingRound) {
      replayFinished = false
      void replaySession?.restart(next)
    } else if (next.status === 'playing') {
      replaySession?.record(next)
    }

    if (!previous) { play('start'); return }
    const beforeMe = snakeFor(previous, identity.sessionId)
    const afterMe = snakeFor(next, identity.sessionId)
    if ((afterMe?.score ?? 0) > (beforeMe?.score ?? 0)) play('eat')
    if (beforeMe?.alive && !afterMe?.alive) play('death')
    const otherDeaths = (previous.snakes ?? []).filter((before) => {
      if (before.playerId === identity.sessionId || !before.alive) return false
      const after = snakeFor(next, before.playerId)
      return after && !after.alive
    }).length
    if (otherDeaths > 0) play('otherDeath')
    if (previous.status !== 'finished' && next.status === 'finished') {
      if (next.winner === identity.sessionId) play('win')
      if (!replayFinished) {
        replayFinished = true
        void replaySession?.finish(next)
      }
    }
  }

  async function start() { error=''; try { await socket.request('snake.start',{roomId:roomCode,speed}) } catch(err){ error=err.message } }
  async function restart() { error=''; state=null; replayFinished=false; try { await socket.request('snake.restart',{roomId:roomCode}) } catch(err){ error=err.message } }
  async function copyInvite() { await navigator.clipboard.writeText(`${location.origin}/room/${roomCode.toLowerCase()}/snake`); copied=true; setTimeout(()=>copied=false,1200) }

  function sendDirection(direction) {
    if (!direction || state?.status === 'finished' || (room?.status !== 'playing' && state?.status !== 'playing')) return
    socket.request('snake.input', { roomId: roomCode, direction }).catch((err) => { error = err.message })
  }

  function handleKey(event) {
    const direction = keyDirections[event.key]
    if (!direction) return
    event.preventDefault()
    sendDirection(direction)
  }

  function pointerDown(event) {
    if (state?.status === 'finished') return
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    swipeStart = { x: event.clientX, y: event.clientY }
  }

  function pointerUp(event) {
    if (!swipeStart) return
    event.preventDefault()
    const direction = swipeDirection(swipeStart, { x: event.clientX, y: event.clientY })
    swipeStart = null
    if (direction) sendDirection(direction)
  }

  function statusLabel() {
    if (!state) return room?.status === 'waiting' ? t('snake.waitingRoom') : '…'
    if (state.status !== 'finished') return t('snake.live')
    if (state.winner === identity.sessionId) return t('snake.youWin')
    if (state.winner) return t('snake.wins', { name: snakeFor(state,state.winner)?.name ?? 'Opponent' })
    return room?.players?.length === 1 ? t('snake.gameOver') : t('snake.nobody')
  }

  onMount(() => {
    speed = normalizeSnakeSpeed(sessionStorage.getItem('arcade.snake.speed'))
    unsubscribeLocale = subscribeLocale((next) => (locale = next))
    replaySession = createReplaySession({adapter:snakeReplay,roomCode:()=>roomCode,room:()=>room,identity,socket})
    if (state?.status === 'playing') void replaySession.restart(state)

    const topic = `room:${roomCode.toUpperCase()}`
    unsubscribe = socket.subscribe(topic, (message) => {
      if (message.data?.topicId !== topic) return
      const payload = message.data.message
      if (payload?.type === 'snake.state') applyState(payload.state)
    })
    window.addEventListener('keydown', handleKey, { passive: false })
    return () => {
      unsubscribe()
      unsubscribeLocale()
      replaySession?.destroy()
      window.removeEventListener('keydown',handleKey)
      audioContext?.close()
    }
  })
</script>

<section class="snake-shell">
  {#if room?.status === 'waiting' && !state}
    <div class="lobby-head">
      <div><span>{t('game.snake.name')}</span><h1>{t('snake.waitingRoom')}</h1><p>{t('snake.players',{count:room.players.length,max:room.maxPlayers})}</p></div>
      <div class="code"><strong>{roomCode.toLowerCase()}</strong><small>{t('common.roomCode')}</small></div>
    </div>
    <div class="lobby-grid">
      <div class="roster">
        {#each room.players as player,index}<div class="roster-row"><i data-player={index}></i><strong>{player.name}</strong><span>{player.id===room.hostId?t('common.host'):t('common.ready')}</span></div>{/each}
      </div>
      <aside class="lobby-actions">
        <button class="invite" onclick={copyInvite}>{copied?t('common.linkCopied'):t('common.copyInvite')}</button>
        {#if isHost()}<button class="start" onclick={start}>{t('snake.start')}</button>{:else}<p>{t('snake.waitHost')}</p>{/if}
      </aside>
    </div>
  {:else}
    <div class="arena-head">
      <div><span>{t('game.snake.name')}</span><h1>{statusLabel()}</h1></div>
      <div class="arena-tools"><div class="tick"><strong>{state?.tick??0}</strong><span>{t('snake.tick')}</span></div></div>
    </div>

    <SnakeGameSurface
      {state}
      interactive={true}
      onPointerDown={pointerDown}
      onPointerUp={pointerUp}
      onPointerCancel={() => (swipeStart=null)}
      onDirection={sendDirection}
      showTouchControls={state?.status !== 'finished'}
      scoreboardLabel={t('common.scoreboard')}
      scoreLabel={t('common.score')}
      aliveLabel={t('snake.alive')}
      outLabel={t('snake.out')}
      keyboardLabel={t('snake.keyboard')}
      touchHint={t('snake.touchHint')}
      upLabel={t('snake.up')}
      downLabel={t('snake.down')}
      leftLabel={t('snake.left')}
      rightLabel={t('snake.right')}
    />

    {#if state?.status==='finished'&&isHost()}<button class="restart" onclick={restart}>{t('common.playAgain')}</button>{/if}
  {/if}
  {#if error}<div class="snake-error">{error}</div>{/if}
</section>

<style>
  .snake-shell{width:min(100%,1180px);margin:0 auto}.lobby-head,.arena-head{display:flex;align-items:end;justify-content:space-between;gap:24px;margin-bottom:24px}.lobby-head span,.arena-head span{color:#7f8791;font-size:10px;font-weight:900;letter-spacing:.18em}.lobby-head h1,.arena-head h1{margin:5px 0 0;font-size:clamp(30px,5vw,48px);letter-spacing:-.045em}.lobby-head p{margin:8px 0 0;color:#7f8791}.code{text-align:right}.code strong{display:block;color:#c1ff56;font:900 28px ui-monospace,monospace;letter-spacing:.08em}.code small{color:#69727d;font-size:9px;letter-spacing:.14em}.lobby-grid{display:grid;grid-template-columns:minmax(320px,1fr) 260px;gap:24px}.roster{border:1px solid #2d333b;background:#0b0d10}.roster-row{display:grid;grid-template-columns:14px 1fr auto;align-items:center;gap:12px;padding:15px 16px;border-bottom:1px solid #20252c}.roster-row:last-child{border-bottom:0}.roster-row i{width:10px;height:10px;background:#c1ff56}.roster-row span{color:#69727d;font-size:9px;letter-spacing:.12em}.lobby-actions{display:flex;flex-direction:column;gap:10px}.lobby-actions button,.restart{height:48px;font-weight:900;cursor:pointer}.invite{border:1px solid #3b424c;background:transparent;color:#f4f0e8}.start,.restart{border:0;background:#c1ff56;color:#0b0d10}.lobby-actions p{color:#7f8791;font-size:12px;text-align:center}.arena-tools{display:flex;align-items:center;gap:12px}.tick{display:flex;flex-direction:column;text-align:right}.tick strong{color:#c1ff56;font:900 22px ui-monospace,monospace}.tick span{font-size:8px}.restart{display:block;width:min(100%,420px);margin:22px auto 0}.snake-error{margin-top:16px;color:#ff8d8d;text-align:center;font-size:12px}
  [data-player='0']{background:#c1ff56!important}[data-player='1']{background:#8ee7ff!important}[data-player='2']{background:#ffcf5a!important}[data-player='3']{background:#ff8db3!important}[data-player='4']{background:#b9a1ff!important}[data-player='5']{background:#75f0c0!important}[data-player='6']{background:#ff9f62!important}[data-player='7']{background:#f4f0e8!important}
  @media(max-width:520px){.lobby-head,.arena-head{align-items:start}.arena-tools{align-items:flex-end;flex-direction:column}.code{font-size:12px}.lobby-grid{grid-template-columns:1fr}}
</style>
