<script>
  import { goto } from '$app/navigation'

  let roomCode = ''
  let game = 'gomoku'

  function createRoom() {
    goto(`/room/new/${game}`)
  }

  function joinRoom() {
    const code = roomCode.trim().toLowerCase()
    if (!code) return
    goto(`/room/${code}/${game}`)
  }
</script>

<svelte:head>
  <title>AQI Arcade</title>
  <meta name="description" content="Tiny multiplayer games powered by AQI realtime." />
</svelte:head>

<main class="home">
  <section class="home-card">
    <a class="home-brand" href="/">AQI ARCADE</a>

    <div class="game-picker" aria-label="Choose a game">
      <button class:active={game === 'gomoku'} onclick={() => (game = 'gomoku')}>
        <span>01</span>
        <strong>Gomoku</strong>
        <small>Five in a row</small>
      </button>
      <button class:active={game === 'tetris'} onclick={() => (game = 'tetris')}>
        <span>02</span>
        <strong>Tetris Battle</strong>
        <small>Clear lines. Send garbage.</small>
      </button>
    </div>

    <div class="home-game">
      <h1>{game === 'gomoku' ? 'Gomoku' : 'Tetris Battle'}</h1>
      <p>{game === 'gomoku' ? 'Two players. Five in a row.' : 'Your board. Their board. One survives.'}</p>
    </div>

    <button class="create" onclick={createRoom}>Create {game === 'gomoku' ? 'Gomoku' : 'Tetris'} room</button>

    <div class="divider"><span>or join</span></div>

    <div class="join">
      <input
        bind:value={roomCode}
        maxlength="6"
        autocomplete="off"
        placeholder="ROOM CODE"
        aria-label="Room code"
        onkeydown={(event) => event.key === 'Enter' && joinRoom()}
      />
      <button onclick={joinRoom}>Join</button>
    </div>

    <small>Share the room link with a friend and play.</small>
  </section>
</main>

<style>
  .home {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 24px;
    background: #0b0d10;
  }

  .home-card {
    width: min(100%, 560px);
    padding: 34px;
    border: 1px solid #272c33;
    background: #111419;
    box-shadow: 12px 12px 0 #050607;
  }

  .home-brand {
    color: #c1ff56;
    text-decoration: none;
    font-size: 12px;
    font-weight: 900;
    letter-spacing: .18em;
  }

  .game-picker {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-top: 32px;
  }

  .game-picker button {
    min-height: 104px;
    padding: 16px;
    border: 1px solid #30363f;
    background: #0b0d10;
    color: #f4f0e8;
    text-align: left;
    cursor: pointer;
  }

  .game-picker button.active {
    border-color: #c1ff56;
    box-shadow: inset 0 -3px 0 #c1ff56;
  }

  .game-picker span,
  .game-picker small {
    display: block;
    color: #69727d;
    font-size: 10px;
    letter-spacing: .12em;
  }

  .game-picker strong {
    display: block;
    margin: 9px 0 5px;
    font-size: 17px;
  }

  .home-game {
    padding: 38px 0 28px;
    text-align: center;
  }

  .home-game h1 {
    margin: 0 0 8px;
    font-size: clamp(34px, 8vw, 54px);
    line-height: 1;
    letter-spacing: -.05em;
  }

  .home-game p,
  .home-card > small {
    color: #7f8791;
  }

  .home-game p { margin: 0; }

  button,
  input {
    border-radius: 0;
    font: inherit;
  }

  .create,
  .join input,
  .join button {
    height: 50px;
  }

  .create {
    width: 100%;
    border: 0;
    background: #c1ff56;
    color: #0b0d10;
    font-weight: 900;
    cursor: pointer;
  }

  .divider {
    display: flex;
    align-items: center;
    gap: 14px;
    margin: 24px 0;
    color: #59616b;
    font-size: 11px;
    text-transform: uppercase;
  }

  .divider::before,
  .divider::after {
    content: '';
    height: 1px;
    flex: 1;
    background: #272c33;
  }

  .join { display: grid; grid-template-columns: 1fr 92px; gap: 10px; }

  .join input {
    min-width: 0;
    padding: 0 14px;
    border: 1px solid #30363f;
    background: #0b0d10;
    color: #f4f0e8;
    text-transform: lowercase;
    letter-spacing: .12em;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }

  .join button {
    border: 1px solid #3b424c;
    background: transparent;
    color: #f4f0e8;
    font-weight: 800;
    cursor: pointer;
  }

  .home-card > small {
    display: block;
    margin-top: 18px;
    text-align: center;
    line-height: 1.5;
  }

  @media (max-width: 520px) {
    .home { padding: 14px; }
    .home-card { padding: 24px 20px; box-shadow: 8px 8px 0 #050607; }
    .game-picker { grid-template-columns: 1fr; }
  }
</style>
