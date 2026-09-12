<script>
  import { goto } from '$app/navigation'

  let roomCode = ''
  let game = 'gomoku'
  let players = 2

  function selectGame(value) {
    game = value
    if (game === 'gomoku') players = 2
    if (game === 'dungeon') players = 1
  }

  function createRoom() {
    if (game === 'dungeon') {
      goto(players === 2 ? '/dungeon/coop' : '/dungeon')
      return
    }
    if (game === 'snake' || game === 'drawguess') {
      goto(`/room/new/${game}`)
      return
    }
    goto(`/room/new/${game}?players=${players}`)
  }

  function joinRoom() {
    const code = roomCode.trim().toLowerCase()
    if (!code) return
    if (game === 'dungeon') {
      if (players === 2) goto(`/dungeon/coop?room=${code}`)
      return
    }
    goto(`/room/${code}/${game}`)
  }

  function title() {
    if (game === 'gomoku') return 'Gomoku'
    if (game === 'tetris') return 'Tetris Battle'
    if (game === 'snake') return 'Snake Arena'
    if (game === 'drawguess') return 'Draw & Guess'
    return 'Endless Dungeon'
  }

  function description() {
    if (game === 'gomoku') return 'Two players. Five in a row.'
    if (game === 'tetris') return players === 1 ? 'Solo practice. Just you and the stack.' : 'Your board. Their board. One survives.'
    if (game === 'snake') return '1–8 players. One arena. Host starts.'
    if (game === 'drawguess') return '2–8 players. Draw badly. Guess loudly.'
    if (players === 2) return 'Two players. One shared dungeon. Loot and survive together.'
    return 'WASD. Auto attacks. Loot everywhere. Go deeper.'
  }

  function createLabel() {
    if (game === 'dungeon') return players === 2 ? 'Create 2 player Dungeon' : 'Enter the Dungeon'
    if (game === 'snake') return 'Create Snake Arena'
    if (game === 'drawguess') return 'Create Draw & Guess'
    if (game === 'gomoku') return 'Start 2 player Gomoku'
    return `Start ${players === 1 ? 'solo' : '2 player'} Tetris`
  }

  function helper() {
    if (game === 'dungeon') return players === 2 ? 'Create a shared run, copy the invite, and start when your teammate joins.' : 'Solo run · WASD + Space · gear upgrades immediately.'
    if (game === 'snake') return 'Create a lobby, invite up to 7 friends, then the host starts the arena.'
    if (game === 'drawguess') return 'Create a lobby, invite friends, then take turns drawing and guessing.'
    if (players === 2) return 'Create a room, share the invite, and the game starts when your friend joins.'
    return 'Solo starts immediately. No invite needed.'
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
      <button class:active={game === 'gomoku'} onclick={() => selectGame('gomoku')}><span>01</span><strong>Gomoku</strong><small>Five in a row</small></button>
      <button class:active={game === 'tetris'} onclick={() => selectGame('tetris')}><span>02</span><strong>Tetris Battle</strong><small>Clear lines. Send garbage.</small></button>
      <button class:active={game === 'snake'} onclick={() => selectGame('snake')}><span>03</span><strong>Snake Arena</strong><small>1–8 players · Host starts</small></button>
      <button class:active={game === 'drawguess'} onclick={() => selectGame('drawguess')}><span>04</span><strong>Draw & Guess</strong><small>2–8 players · Host starts</small></button>
      <button class:active={game === 'dungeon'} onclick={() => selectGame('dungeon')}><span>05</span><strong>Endless Dungeon</strong><small>Solo / 2 player Co-op</small></button>
    </div>

    <div class="home-game"><h1>{title()}</h1><p>{description()}</p></div>

    {#if game === 'tetris' || game === 'dungeon'}
      <div class="mode-picker" aria-label="Choose player mode">
        <button class:active={players === 1} onclick={() => (players = 1)}><strong>1 PLAYER</strong><small>Start instantly</small></button>
        <button class:active={players === 2} onclick={() => (players = 2)}><strong>2 PLAYERS</strong><small>Invite a friend</small></button>
      </div>
    {/if}

    <button class="create" onclick={createRoom}>{createLabel()}</button>

    {#if game !== 'dungeon' || players === 2}
      <div class="divider"><span>or join</span></div>
      <div class="join">
        <input bind:value={roomCode} maxlength="6" autocomplete="off" placeholder="ROOM CODE" aria-label="Room code" onkeydown={(event) => event.key === 'Enter' && joinRoom()} />
        <button onclick={joinRoom}>Join</button>
      </div>
    {/if}
    <small>{helper()}</small>
  </section>
</main>

<style>
  .home{min-height:100vh;display:grid;place-items:center;padding:24px;background:#0b0d10}.home-card{width:min(100%,680px);padding:34px;border:1px solid #272c33;background:#111419;box-shadow:12px 12px 0 #050607}.home-brand{color:#c1ff56;text-decoration:none;font-size:12px;font-weight:900;letter-spacing:.18em}.game-picker,.mode-picker{display:grid;gap:10px}.game-picker{grid-template-columns:repeat(2,1fr);margin-top:32px}.mode-picker{grid-template-columns:1fr 1fr}.game-picker button,.mode-picker button{padding:16px;border:1px solid #30363f;background:#0b0d10;color:#f4f0e8;text-align:left;cursor:pointer}.game-picker button{min-height:104px}.mode-picker button{min-height:72px}.game-picker button.active,.mode-picker button.active{border-color:#c1ff56;box-shadow:inset 0 -3px 0 #c1ff56}.game-picker span,.game-picker small,.mode-picker small{display:block;color:#69727d;font-size:10px;letter-spacing:.1em}.game-picker strong{display:block;margin:9px 0 5px;font-size:17px}.mode-picker strong{display:block;margin-bottom:5px;font-size:13px}.home-game{padding:38px 0 24px;text-align:center}.home-game h1{margin:0 0 8px;font-size:clamp(34px,8vw,54px);line-height:1;letter-spacing:-.05em}.home-game p,.home-card>small{color:#7f8791}.home-game p{margin:0}.create{width:100%;height:50px;margin-top:14px;border:0;background:#c1ff56;color:#0b0d10;font-weight:900;cursor:pointer}.divider{display:flex;align-items:center;gap:14px;margin:24px 0;color:#59616b;font-size:11px;text-transform:uppercase}.divider:before,.divider:after{content:'';height:1px;flex:1;background:#272c33}.join{display:grid;grid-template-columns:1fr 92px;gap:10px}.join input,.join button{height:50px;border-radius:0;font:inherit}.join input{min-width:0;padding:0 14px;border:1px solid #30363f;background:#0b0d10;color:#f4f0e8;text-transform:lowercase;letter-spacing:.12em;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.join button{border:1px solid #3b424c;background:transparent;color:#f4f0e8;font-weight:800;cursor:pointer}.home-card>small{display:block;margin-top:18px;text-align:center;line-height:1.5}@media(max-width:620px){.home{padding:14px}.home-card{padding:24px 20px;box-shadow:8px 8px 0 #050607}.game-picker{grid-template-columns:1fr}.mode-picker{grid-template-columns:1fr 1fr}}
</style>
