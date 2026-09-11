<script>
  import { onMount } from 'svelte'
  import { getIdentity, defaultName } from './lib/identity.js'
  import { socket } from './lib/socket.js'

  export let code = ''

  const identity = getIdentity()
  const name = defaultName(identity.playerId)

  let roomCode = code.toUpperCase()
  let room = null
  let gameState = null
  let connection = 'connecting'
  let error = ''
  let copied = false

  const size = 15
  const cells = Array.from({ length: size * size }, (_, index) => ({
    x: index % size,
    y: Math.floor(index / size),
  }))

  function applySnapshot(snapshot) {
    if (!snapshot) return
    room = snapshot
    gameState = snapshot.state ?? null
  }

  function myStone() {
    const index = room?.players?.findIndex((player) => player.id === identity.playerId) ?? -1
    return index === 0 ? 1 : index === 1 ? 2 : 0
  }

  function canMove(x, y) {
    if (!gameState || gameState.status !== 'playing') return false
    if (myStone() !== gameState.turn) return false
    return gameState.board?.[y]?.[x] === 0
  }

  async function bootstrap() {
    error = ''
    connection = 'connecting'

    await socket.connect()
    await socket.request('arcade.login', identity)

    if (roomCode === 'NEW') {
      const snapshot = await socket.request('room.create', { game: 'gomoku', name })
      applySnapshot(snapshot)
      roomCode = snapshot.id
      history.replaceState(null, '', `#/room/${roomCode}`)
    } else {
      const snapshot = await socket.request('room.join', { roomId: roomCode, name })
      applySnapshot(snapshot)
    }

    connection = 'live'
  }

  async function move(x, y) {
    if (!canMove(x, y)) return
    error = ''
    try {
      const snapshot = await socket.request('game.move', {
        roomId: roomCode,
        move: { x, y },
      })
      applySnapshot(snapshot)
    } catch (err) {
      error = err.message
    }
  }

  async function copyInvite() {
    await navigator.clipboard.writeText(`${location.origin}${location.pathname}#/room/${roomCode}`)
    copied = true
    setTimeout(() => (copied = false), 1200)
  }

  async function reconnect() {
    try {
      await bootstrap()
    } catch (err) {
      connection = 'offline'
      error = err.message
    }
  }

  function stoneAt(x, y) {
    return gameState?.board?.[y]?.[x] ?? 0
  }

  function isLast(x, y) {
    return gameState?.last?.x === x && gameState?.last?.y === y
  }

  function gameLabel() {
    if (!room || room.players.length < 2) return 'WAITING FOR RIVAL'
    if (!gameState) return 'PREPARING BOARD'
    if (gameState.status === 'finished') {
      if (!gameState.winner) return 'DRAW'
      return gameState.winner === myStone() ? 'YOU WIN' : 'RIVAL WINS'
    }
    return gameState.turn === myStone() ? 'YOUR TURN' : 'RIVAL TURN'
  }

  onMount(() => {
    const unsubscribe = socket.subscribe((event) => {
      if (event.type === 'connection' && event.state === 'closed') {
        connection = 'offline'
        return
      }
      if (event.type !== 'message') return

      const message = event.message
      const topic = `room:${roomCode}`
      if (message.action !== topic || message.data?.topicId !== topic) return
      applySnapshot(message.data.message)
    })

    bootstrap().catch((err) => {
      connection = 'offline'
      error = err.message
    })

    return () => unsubscribe()
  })
</script>

<div class="room-shell">
  <div class="noise"></div>

  <header class="room-topbar">
    <a class="brand" href="#/"><span class="brand-mark">A</span><span>AQI ARCADE</span></a>
    <div class="room-meta">
      <span>ROOM <strong>{roomCode}</strong></span>
      <span class:offline={connection !== 'live'} class="live-badge"><i></i>{connection === 'live' ? 'LIVE' : connection.toUpperCase()}</span>
    </div>
  </header>

  <main class="room-main">
    <section class="match-head">
      <div class="player-card active-player">
        <div class="player-stone black"></div>
        <div><span>BLACK / PLAYER 01</span><strong>{room?.players?.[0]?.name ?? name}</strong></div>
      </div>

      <div class="match-status">
        <span>GOMOKU · FIRST TO FIVE</span>
        <h1>{gameLabel()}</h1>
        <p>{room?.players?.length ?? 0}/2 PLAYERS CONNECTED</p>
      </div>

      <div class="player-card right">
        <div><span>WHITE / PLAYER 02</span><strong>{room?.players?.[1]?.name ?? 'WAITING...'}</strong></div>
        <div class="player-stone white"></div>
      </div>
    </section>

    <section class="board-stage">
      <div class="board-frame">
        <div class="gomoku-board" aria-label="Gomoku board">
          {#each cells as cell}
            <button
              class:last={isLast(cell.x, cell.y)}
              class:playable={canMove(cell.x, cell.y)}
              class="board-cell"
              onclick={() => move(cell.x, cell.y)}
              aria-label={`Place stone at ${cell.x + 1}, ${cell.y + 1}`}
            >
              {#if stoneAt(cell.x, cell.y) === 1}
                <span class="stone stone-black"></span>
              {:else if stoneAt(cell.x, cell.y) === 2}
                <span class="stone stone-white"></span>
              {:else}
                <span class="ghost-stone"></span>
              {/if}
            </button>
          {/each}
        </div>
      </div>

      <aside class="room-panel">
        <div class="panel-label">ROOM CONTROL</div>
        <div class="code-display"><span>{roomCode}</span><small>INVITE CODE</small></div>
        <button class="primary-button" onclick={copyInvite}>{copied ? 'LINK COPIED' : 'COPY INVITE LINK'} <span>↗</span></button>

        <div class="room-facts">
          <div><span>MODE</span><strong>FREESTYLE</strong></div>
          <div><span>BOARD</span><strong>15 × 15</strong></div>
          <div><span>SYNC</span><strong>FULL STATE</strong></div>
        </div>

        {#if error}
          <div class="room-error">{error}</div>
        {/if}
        {#if connection === 'offline'}
          <button class="secondary-button" onclick={reconnect}>RECONNECT</button>
        {/if}
      </aside>
    </section>
  </main>

  <footer class="room-footer"><span>SERVER AUTHORITATIVE</span><span>BLACK MOVES FIRST</span><span>FRIENDSHIP NOT GUARANTEED</span></footer>
</div>
