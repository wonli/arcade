<script>
  import { onMount } from 'svelte'

  export let room
  export let roomCode
  export let identity
  export let socket

  let state = null
  let error = ''
  let copied = false
  let unsubscribe = () => {}
  let audioContext = null

  const cells = Array.from({ length: 30 * 20 }, (_, index) => ({
    x: index % 30,
    y: Math.floor(index / 30),
  }))

  const keyDirections = {
    ArrowUp: 'up',
    w: 'up',
    W: 'up',
    ArrowDown: 'down',
    s: 'down',
    S: 'down',
    ArrowLeft: 'left',
    a: 'left',
    A: 'left',
    ArrowRight: 'right',
    d: 'right',
    D: 'right',
  }

  function isHost() {
    return room?.hostId === identity.sessionId
  }

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
    if (name === 'start') { tone(330, .05); tone(440, .05, .025, .06); tone(660, .08, .03, .12) }
    if (name === 'eat') { tone(640, .045, .02); tone(860, .05, .02, .035) }
    if (name === 'death') { tone(180, .08, .035); tone(90, .16, .035, .06) }
    if (name === 'otherDeath') tone(240, .08, .018)
    if (name === 'win') { tone(440, .08, .03); tone(660, .09, .03, .08); tone(880, .16, .035, .16) }
  }

  function snakeFor(snapshot, playerId) {
    return snapshot?.snakes?.find((snake) => snake.playerId === playerId)
  }

  function applyState(next) {
    const previous = state
    state = next
    if (!previous) {
      play('start')
      return
    }

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

    if (previous.status !== 'finished' && next.status === 'finished' && next.winner === identity.sessionId) play('win')
  }

  async function start() {
    error = ''
    try {
      await socket.request('snake.start', { roomId: roomCode })
    } catch (err) {
      error = err.message
    }
  }

  async function restart() {
    error = ''
    state = null
    try {
      await socket.request('snake.restart', { roomId: roomCode })
    } catch (err) {
      error = err.message
    }
  }

  async function copyInvite() {
    await navigator.clipboard.writeText(`${location.origin}/room/${roomCode.toLowerCase()}/snake`)
    copied = true
    setTimeout(() => (copied = false), 1200)
  }

  function handleKey(event) {
    const direction = keyDirections[event.key]
    if (!direction || room?.status !== 'playing') return
    event.preventDefault()
    socket.request('snake.input', { roomId: roomCode, direction }).catch((err) => { error = err.message })
  }

  function snakeIndexAt(snapshot, x, y) {
    if (!snapshot) return -1
    for (let index = 0; index < snapshot.snakes.length; index++) {
      if (snapshot.snakes[index].body?.some((point) => point.x === x && point.y === y)) return index
    }
    return -1
  }

  function isHead(snapshot, index, x, y) {
    const head = snapshot?.snakes?.[index]?.body?.[0]
    return head?.x === x && head?.y === y
  }

  function isFood(snapshot, x, y) {
    return snapshot?.food?.x === x && snapshot?.food?.y === y
  }

  function statusLabel() {
    if (!state) return room?.status === 'waiting' ? 'Lobby' : 'Starting…'
    if (state.status !== 'finished') return 'Arena live'
    if (state.winner === identity.sessionId) return 'You win'
    if (state.winner) return `${snakeFor(state, state.winner)?.name ?? 'Opponent'} wins`
    return room?.players?.length === 1 ? 'Game over' : 'Nobody survives'
  }

  onMount(() => {
    const topic = `room:${roomCode.toUpperCase()}`
    unsubscribe = socket.subscribe(topic, (message) => {
      if (message.data?.topicId !== topic) return
      const payload = message.data.message
      if (payload?.type === 'snake.state') applyState(payload.state)
    })
    window.addEventListener('keydown', handleKey, { passive: false })
    return () => {
      unsubscribe()
      window.removeEventListener('keydown', handleKey)
      audioContext?.close()
    }
  })
</script>

<section class="snake-shell">
  {#if room?.status === 'waiting' && !state}
    <div class="lobby-head">
      <div><span>SNAKE ARENA</span><h1>Waiting room</h1><p>{room.players.length}/{room.maxPlayers} players · Host starts</p></div>
      <div class="code"><strong>{roomCode.toLowerCase()}</strong><small>ROOM CODE</small></div>
    </div>

    <div class="lobby-grid">
      <div class="roster">
        {#each room.players as player, index}
          <div class="roster-row"><i data-player={index}></i><strong>{player.name}</strong><span>{player.id === room.hostId ? 'HOST' : 'READY'}</span></div>
        {/each}
      </div>
      <aside class="lobby-actions">
        <button class="invite" onclick={copyInvite}>{copied ? 'Link copied' : 'Copy invite link'}</button>
        {#if isHost()}<button class="start" onclick={start}>Start arena</button>{:else}<p>Waiting for host to start…</p>{/if}
      </aside>
    </div>
  {:else}
    <div class="arena-head">
      <div><span>SNAKE ARENA</span><h1>{statusLabel()}</h1></div>
      <div class="tick"><strong>{state?.tick ?? 0}</strong><span>TICK</span></div>
    </div>

    <div class="arena-layout">
      <div class="snake-board" aria-label="Snake arena">
        {#each cells as cell}
          {@const snakeIndex = snakeIndexAt(state, cell.x, cell.y)}
          <i
            class:food={isFood(state, cell.x, cell.y)}
            class:snake={snakeIndex >= 0}
            class:head={snakeIndex >= 0 && isHead(state, snakeIndex, cell.x, cell.y)}
            data-player={snakeIndex}
          ></i>
        {/each}
      </div>

      <aside class="leaderboard">
        <span>PLAYERS</span>
        {#each state?.snakes ?? [] as snake, index}
          <div class:dead={!snake.alive} class="score-row">
            <i data-player={index}></i>
            <div><strong>{snake.name}</strong><small>{snake.alive ? 'ALIVE' : 'OUT'}</small></div>
            <b>{snake.score}</b>
          </div>
        {/each}
        <div class="keys">ARROWS / WASD</div>
      </aside>
    </div>

    {#if state?.status === 'finished' && isHost()}
      <button class="restart" onclick={restart}>Play again</button>
    {/if}
  {/if}

  {#if error}<div class="snake-error">{error}</div>{/if}
</section>

<style>
  .snake-shell{width:min(100%,1180px);margin:0 auto}.lobby-head,.arena-head{display:flex;align-items:end;justify-content:space-between;gap:24px;margin-bottom:24px}.lobby-head span,.arena-head span,.leaderboard>span{color:#7f8791;font-size:10px;font-weight:900;letter-spacing:.18em}.lobby-head h1,.arena-head h1{margin:5px 0 0;font-size:clamp(30px,5vw,48px);letter-spacing:-.045em}.lobby-head p{margin:8px 0 0;color:#7f8791}.code{text-align:right}.code strong{display:block;color:#c1ff56;font:900 28px ui-monospace,monospace;letter-spacing:.08em}.code small{color:#69727d;font-size:9px;letter-spacing:.14em}.lobby-grid{display:grid;grid-template-columns:minmax(320px,1fr) 260px;gap:24px}.roster{border:1px solid #2d333b;background:#0b0d10}.roster-row{display:grid;grid-template-columns:14px 1fr auto;align-items:center;gap:12px;padding:15px 16px;border-bottom:1px solid #20252c}.roster-row:last-child{border-bottom:0}.roster-row i,.score-row i{width:10px;height:10px;background:#c1ff56}.roster-row span{color:#69727d;font-size:9px;letter-spacing:.12em}.lobby-actions{display:flex;flex-direction:column;gap:10px}.lobby-actions button,.restart{height:48px;font-weight:900;cursor:pointer}.invite{border:1px solid #3b424c;background:transparent;color:#f4f0e8}.start,.restart{border:0;background:#c1ff56;color:#0b0d10}.lobby-actions p{color:#7f8791;font-size:12px;text-align:center}.arena-layout{display:grid;grid-template-columns:minmax(560px,900px) 220px;gap:24px;align-items:start}.snake-board{display:grid;grid-template-columns:repeat(30,1fr);aspect-ratio:30/20;background:#080a0d;border:1px solid #30363f;box-shadow:10px 10px 0 #050607}.snake-board>i{min-width:0;aspect-ratio:1;border:1px solid #11151a}.snake-board>i.food{background:#f4f0e8;border-radius:50%;transform:scale(.55)}.snake-board>i.snake{background:#c1ff56;border-color:#080a0d}.snake-board>i.head{box-shadow:inset 0 0 0 2px rgba(255,255,255,.55)}.leaderboard{padding:16px;border:1px solid #2d333b;background:#0b0d10}.score-row{display:grid;grid-template-columns:10px 1fr auto;align-items:center;gap:10px;padding:12px 0;border-bottom:1px solid #20252c}.score-row.dead{opacity:.38}.score-row div{display:flex;flex-direction:column;gap:2px}.score-row strong{font-size:12px}.score-row small{color:#69727d;font-size:8px;letter-spacing:.12em}.score-row b{font:900 16px ui-monospace,monospace;color:#c1ff56}.keys{margin-top:16px;color:#69727d;font:10px ui-monospace,monospace;text-align:center}.tick{display:flex;flex-direction:column;text-align:right}.tick strong{color:#c1ff56;font:900 22px ui-monospace,monospace}.tick span{font-size:8px}.restart{display:block;width:min(100%,420px);margin:22px auto 0}.snake-error{margin-top:16px;color:#ff8d8d;text-align:center;font-size:12px}
  [data-player='0']{background:#c1ff56!important}[data-player='1']{background:#8ee7ff!important}[data-player='2']{background:#ffcf5a!important}[data-player='3']{background:#ff8db3!important}[data-player='4']{background:#b9a1ff!important}[data-player='5']{background:#75f0c0!important}[data-player='6']{background:#ff9f62!important}[data-player='7']{background:#f4f0e8!important}
  @media(max-width:820px){.lobby-grid,.arena-layout{grid-template-columns:1fr}.arena-layout{gap:18px}.leaderboard{display:grid;grid-template-columns:repeat(2,1fr);gap:0 16px}.leaderboard>span,.keys{grid-column:1/-1}.snake-board{width:100%;box-shadow:6px 6px 0 #050607}}@media(max-width:520px){.lobby-head,.arena-head{align-items:start}.code{font-size:12px}.leaderboard{grid-template-columns:1fr}.lobby-grid{grid-template-columns:1fr}}
</style>
