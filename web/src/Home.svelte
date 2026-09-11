<script>
  const games = [
    { name: 'GOMOKU', kicker: 'FIVE IN A ROW', glyph: '● ○', status: 'PLAY NOW', className: 'gomoku', active: true },
    { name: 'TETRIS BATTLE', kicker: 'SEND GARBAGE. MAKE ENEMIES.', glyph: '▦', status: 'COMING NEXT', className: 'tetris' },
    { name: 'SNAKE ARENA', kicker: 'EAT. GROW. RUIN FRIENDSHIPS.', glyph: '━━●', status: 'IN THE LAB', className: 'snake' },
    { name: 'CHESS', kicker: 'CLASSIC PROBLEMS, NEW SOCKETS.', glyph: '♟', status: 'LATER', className: 'chess' },
  ]

  let roomCode = ''

  function createRoom() {
    window.location.hash = '/room/new?game=gomoku'
  }

  function joinRoom() {
    const code = roomCode.trim().toUpperCase()
    if (!code) return
    window.location.hash = `/room/${code}`
  }
</script>

<div class="page-shell">
  <div class="noise"></div>
  <header class="topbar">
    <a class="brand" href="#/" aria-label="AQI Arcade home"><span class="brand-mark">A</span><span>AQI ARCADE</span></a>
    <div class="status-pill"><span class="pulse"></span>REALTIME READY</div>
  </header>

  <main>
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">MULTIPLAYER, WITHOUT THE CEREMONY.</p>
        <h1>Pick a game.<br />Send the link.<br /><span>Beat your friend.</span></h1>
        <p class="hero-note">No account. No lobby maze. Just a room, two people, and a suspicious amount of confidence.</p>
      </div>

      <aside class="quick-room">
        <div class="panel-label">QUICK MATCH</div>
        <div class="quick-room-glyph">●<span>○</span></div>
        <h2>Gomoku</h2>
        <p>Create a room now, or jump into one with a six-character code.</p>
        <button class="primary-button" onclick={createRoom}>CREATE ROOM <span>↗</span></button>
        <div class="join-row">
          <input bind:value={roomCode} maxlength="6" placeholder="ROOM CODE" aria-label="Room code" onkeydown={(event) => event.key === 'Enter' && joinRoom()} />
          <button onclick={joinRoom} aria-label="Join room">→</button>
        </div>
      </aside>
    </section>

    <section class="games-section">
      <div class="section-heading">
        <div><p class="eyebrow">CABINET 01</p><h2>Choose your weapon.</h2></div>
        <p>More games arrive when they survive contact with AQI.</p>
      </div>

      <div class="game-grid">
        {#each games as game, index}
          <article class:active={game.active} class="game-card {game.className}">
            <div class="card-topline"><span>0{index + 1}</span><span>{game.status}</span></div>
            <div class="game-glyph">{game.glyph}</div>
            <div class="game-copy"><p>{game.kicker}</p><h3>{game.name}</h3></div>
            {#if game.active}
              <button onclick={createRoom} class="card-action">START GAME <span>↗</span></button>
            {:else}
              <div class="card-action disabled">LOCKED <span>·</span></div>
            {/if}
          </article>
        {/each}
      </div>
    </section>
  </main>

  <footer><span>POWERED BY AQI</span><span>ROOM → GAME → REMATCH</span><span>NO PRODUCT MANAGERS WERE HARMED</span></footer>
</div>
