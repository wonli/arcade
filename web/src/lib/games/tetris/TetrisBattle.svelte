<script>
  import { onMount } from 'svelte'
  import { addGarbage, createGame, hardDrop, move, rotate, tick, visibleBoard, WIDTH, HEIGHT } from './engine.js'

  export let room
  export let roomCode
  export let identity
  export let socket

  let state = createGame()
  let opponent = null
  let result = ''
  let unsubscribe = () => {}
  let timer = null
  let syncTimer = null
  let gameOverSent = false
  let audioContext = null

  const cells = Array.from({ length: WIDTH * HEIGHT }, (_, index) => ({
    x: index % WIDTH,
    y: Math.floor(index / WIDTH),
  }))

  function tone(frequency, duration = 0.05, volume = 0.025, delay = 0) {
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
    if (name === 'move') tone(150, 0.025, 0.012)
    if (name === 'rotate') tone(230, 0.035, 0.016)
    if (name === 'lock') tone(95, 0.055, 0.025)
    if (name === 'clear') { tone(420, 0.08, 0.025); tone(620, 0.1, 0.025, 0.06) }
    if (name === 'attack') { tone(720, 0.07, 0.028); tone(900, 0.08, 0.02, 0.05) }
    if (name === 'garbage') { tone(110, 0.12, 0.04); tone(82, 0.14, 0.03, 0.07) }
    if (name === 'win') { tone(440, 0.09, 0.03); tone(660, 0.1, 0.03, 0.08); tone(880, 0.14, 0.03, 0.16) }
    if (name === 'lose') { tone(300, 0.1, 0.03); tone(190, 0.18, 0.035, 0.08) }
  }

  function ready() {
    return room?.players?.length === 2
  }

  function opponentName() {
    return room?.players?.find((player) => player.id !== identity.playerId)?.name ?? 'Waiting...'
  }

  function apply(resultValue, localSound = true) {
    state = resultValue.state
    for (const event of resultValue.events) {
      if (localSound && ['move', 'rotate', 'lock', 'clear', 'garbage'].includes(event.type)) play(event.type)
      if (event.type === 'clear' && event.attack > 0) {
        play('attack')
        socket.request('tetris.attack', { roomId: roomCode, lines: event.attack }).catch(() => {})
      }
    }
    if (state.status === 'gameover' && !gameOverSent) {
      gameOverSent = true
      result = 'You lose'
      play('lose')
      socket.request('tetris.gameover', { roomId: roomCode }).catch(() => {})
    }
  }

  function handleKey(event) {
    if (!ready() || state.status !== 'playing') return
    if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', ' ', 'Spacebar'].includes(event.key)) event.preventDefault()
    if (event.key === 'ArrowLeft') apply(move(state, -1))
    else if (event.key === 'ArrowRight') apply(move(state, 1))
    else if (event.key === 'ArrowDown') apply(tick(state))
    else if (event.key === 'ArrowUp') apply(rotate(state))
    else if (event.key === ' ' || event.key === 'Spacebar') apply(hardDrop(state))
  }

  function reset() {
    state = createGame()
    opponent = null
    result = ''
    gameOverSent = false
  }

  function restart() {
    socket.request('tetris.restart', { roomId: roomCode }).catch(() => {})
  }

  async function sync() {
    if (!ready()) return
    const board = visibleBoard(state)
    await socket.request('tetris.state', {
      roomId: roomCode,
      board,
      score: state.score,
      lines: state.lines,
      gameOver: state.status === 'gameover',
    })
  }

  onMount(() => {
    const topic = `room:${roomCode.toUpperCase()}`
    unsubscribe = socket.subscribe(topic, (message) => {
      const payload = message.data?.message
      if (!payload?.type || payload.playerId === identity.playerId) return

      if (payload.type === 'tetris.state') {
        opponent = payload
      } else if (payload.type === 'tetris.attack') {
        apply(addGarbage(state, payload.lines), false)
        play('garbage')
      } else if (payload.type === 'tetris.gameover') {
        if (state.status === 'playing') {
          result = 'You win'
          play('win')
        }
      } else if (payload.type === 'tetris.restart') {
        reset()
      }
    })

    timer = setInterval(() => {
      if (ready() && state.status === 'playing') apply(tick(state), false)
    }, 650)
    syncTimer = setInterval(() => sync().catch(() => {}), 300)
    window.addEventListener('keydown', handleKey, { passive: false })

    return () => {
      unsubscribe()
      clearInterval(timer)
      clearInterval(syncTimer)
      window.removeEventListener('keydown', handleKey)
      audioContext?.close()
    }
  })
</script>

<div class="battle-shell">
  <section class="battle-main">
    <div class="battle-title">
      <div>
        <span>TETRIS BATTLE</span>
        <h1>{result || (ready() ? 'Battle live' : 'Waiting for opponent')}</h1>
      </div>
      <div class="stats"><strong>{state.score}</strong><span>SCORE</span><strong>{state.lines}</strong><span>LINES</span></div>
    </div>

    <div class="arena">
      <div class="board local" aria-label="Your Tetris board">
        {#each cells as cell}
          {@const value = visibleBoard(state)[cell.y][cell.x]}
          <i class:filled={value !== 0} data-value={value}></i>
        {/each}
      </div>

      <aside class="rival">
        <div class="rival-head"><span>OPPONENT</span><strong>{opponentName()}</strong></div>
        <div class="board mini" aria-label="Opponent Tetris board">
          {#each cells as cell}
            {@const value = opponent?.board?.[cell.y]?.[cell.x] ?? 0}
            <i class:filled={value !== 0} data-value={value}></i>
          {/each}
        </div>
        <div class="rival-stats">
          <span>Score <strong>{opponent?.score ?? 0}</strong></span>
          <span>Lines <strong>{opponent?.lines ?? 0}</strong></span>
        </div>
      </aside>
    </div>

    <div class="controls">← → move · ↑ rotate · ↓ soft drop · SPACE hard drop</div>
    {#if state.status === 'gameover' || result === 'You win'}
      <button class="restart" onclick={restart}>Play again</button>
    {/if}
  </section>
</div>

<style>
  .battle-shell { width: 100%; }
  .battle-main { width: min(100%, 960px); margin: 0 auto; }
  .battle-title { display: flex; align-items: end; justify-content: space-between; gap: 24px; margin-bottom: 22px; }
  .battle-title span { color: #8b949e; font-size: 11px; font-weight: 800; letter-spacing: .16em; }
  .battle-title h1 { margin: 5px 0 0; font-size: clamp(28px, 5vw, 44px); letter-spacing: -.04em; }
  .stats { display: grid; grid-template-columns: auto auto; gap: 2px 10px; align-items: baseline; text-align: right; }
  .stats strong { color: #c1ff56; font: 800 22px ui-monospace, monospace; }
  .arena { display: grid; grid-template-columns: minmax(260px, 420px) minmax(150px, 230px); gap: clamp(28px, 6vw, 72px); align-items: start; justify-content: center; }
  .board { display: grid; grid-template-columns: repeat(10, 1fr); background: #080a0d; border: 1px solid #30363f; box-shadow: 10px 10px 0 #050607; }
  .board i { aspect-ratio: 1; border: 1px solid #15191f; background: #0d1014; }
  .board i.filled { background: #c1ff56; border-color: #0b0d10; box-shadow: inset 0 0 0 2px rgba(255,255,255,.12); }
  .board i[data-value='2'], .board i[data-value='5'] { background: #f5ede0; }
  .board i[data-value='3'], .board i[data-value='6'] { background: #8ee7ff; }
  .board i[data-value='4'], .board i[data-value='7'] { background: #ffcf5a; }
  .board i[data-value='8'] { background: #464d57; }
  .rival { padding-top: 18px; }
  .rival-head { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .rival-head span { color: #737b85; font-size: 10px; letter-spacing: .14em; }
  .rival-head strong { font-size: 14px; }
  .mini { box-shadow: 6px 6px 0 #050607; }
  .rival-stats { display: flex; justify-content: space-between; gap: 12px; margin-top: 14px; color: #7f8791; font-size: 12px; }
  .rival-stats strong { color: #f4f0e8; }
  .controls { margin-top: 26px; color: #66707b; font: 12px ui-monospace, monospace; text-align: center; }
  .restart { display: block; width: min(100%, 420px); height: 48px; margin: 18px auto 0; border: 0; background: #c1ff56; color: #0b0d10; font-weight: 900; cursor: pointer; }
  @media (max-width: 720px) {
    .battle-title { align-items: start; }
    .arena { grid-template-columns: minmax(230px, 1fr) 110px; gap: 18px; }
    .rival { padding-top: 8px; }
    .rival-stats { flex-direction: column; gap: 3px; }
  }
</style>
