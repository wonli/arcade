<script>
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { createTranslator } from '$lib/i18n.js'
  import { subscribeLocale } from '$lib/locale.js'

  let roomCode = ''
  let game = 'gomoku'
  let players = 2
  let chessDifficulty = 'medium'
  let locale = 'en'
  let unsubscribeLocale = () => {}

  $: t = createTranslator(locale)

  const games = [
    { id: 'gomoku', number: '01' },
    { id: 'chess', number: '02' },
    { id: 'tetris', number: '03' },
    { id: 'snake', number: '04' },
    { id: 'drawguess', number: '05' },
    { id: 'dungeon', number: '06' },
  ]

  function selectGame(value) {
    game = value
    if (game === 'gomoku') players = 2
    if (game === 'chess' || game === 'dungeon') players = 1
  }

  function createRoom() {
    if (game === 'dungeon') {
      goto(players === 1 ? '/dungeon' : '/room/new/dungeon')
      return
    }
    if (game === 'snake' || game === 'drawguess') {
      goto(`/room/new/${game}`)
      return
    }
    if (game === 'chess' && players === 1) {
      goto(`/room/new/chess?players=1&difficulty=${chessDifficulty}`)
      return
    }
    goto(`/room/new/${game}?players=${players}`)
  }

  function joinRoom() {
    const code = roomCode.trim().toLowerCase()
    if (!code) return
    goto(`/room/${code}/${game}`)
  }

  function title() { return t(`game.${game}.name`) }
  function shortLabel(id) { return t(`game.${id}.short`) }

  function description() {
    if (game === 'gomoku' || game === 'snake' || game === 'drawguess') return t(`game.${game}.description`)
    if (game === 'chess') return t(players === 1 ? 'game.chess.descriptionBot' : 'game.chess.descriptionOnline', { difficulty: difficultyLabel(chessDifficulty) })
    if (game === 'tetris') return t(players === 1 ? 'game.tetris.descriptionSolo' : 'game.tetris.descriptionOnline')
    return t(players === 1 ? 'game.dungeon.descriptionSolo' : 'game.dungeon.descriptionOnline')
  }

  function createLabel() {
    if (game === 'dungeon') return t(players === 1 ? 'create.dungeonSolo' : 'create.dungeonOnline')
    if (game === 'snake') return t('create.snake')
    if (game === 'drawguess') return t('create.drawguess')
    if (game === 'gomoku') return t('create.gomoku')
    if (game === 'chess') return players === 1 ? t('create.chessBot', { difficulty: difficultyLabel(chessDifficulty) }) : t('create.chessOnline')
    return t(players === 1 ? 'create.tetrisSolo' : 'create.tetrisOnline')
  }

  function helper() {
    if (game === 'dungeon') return t(players === 1 ? 'helper.dungeonSolo' : 'helper.dungeonOnline')
    if (game === 'snake') return t('helper.snake')
    if (game === 'drawguess') return t('helper.drawguess')
    if (game === 'chess') return t(players === 1 ? 'helper.chessBot' : 'helper.chessOnline')
    return t(players === 2 ? 'helper.twoPlayers' : 'helper.solo')
  }

  function difficultyLabel(level) {
    if (locale !== 'zh-CN') return level
    return { easy: '简单', medium: '普通', hard: '困难', expert: '专家' }[level] ?? level
  }

  onMount(() => {
    unsubscribeLocale = subscribeLocale((next) => (locale = next))
    return () => unsubscribeLocale()
  })
</script>

<svelte:head>
  <title>AQI Arcade</title>
  <meta name="description" content="Tiny multiplayer games powered by AQI realtime." />
</svelte:head>

<main class="home">
  <section class="launcher">
    <header class="launcher-head">
      <a class="home-brand" href="/">AQI ARCADE</a>
      <span>{t('home.chooseGame')}</span>
    </header>

    <div class="launcher-grid">
      <section class="library" aria-label={t('home.chooseGame')}>
        <div class="game-picker">
          {#each games as item}
            <button class:active={game === item.id} onclick={() => selectGame(item.id)}>
              <span>{item.number}</span>
              <strong>{t(`game.${item.id}.name`)}</strong>
              <small>{shortLabel(item.id)}</small>
            </button>
          {/each}
        </div>
      </section>

      <section class="setup">
        <div class="home-game">
          <span>{t('home.setup')}</span>
          <h1>{title()}</h1>
          <p>{description()}</p>
        </div>

        {#if game === 'tetris' || game === 'chess' || game === 'dungeon'}
          <div class="mode-picker" aria-label="Player mode">
            <button class:active={players === 1} onclick={() => (players = 1)}><strong>{game === 'chess' ? t('home.players.bot') : t('home.players.one')}</strong><small>{t('home.startInstantly')}</small></button>
            <button class:active={players === 2} onclick={() => (players = 2)}><strong>{t('home.players.two')}</strong><small>{game === 'chess' ? t('home.onlineRoom') : t('home.inviteFriend')}</small></button>
          </div>
        {/if}

        {#if game === 'chess' && players === 1}
          <div class="difficulty-picker" aria-label={t('home.difficulty')}>
            {#each ['easy','medium','hard','expert'] as level}
              <button class:active={chessDifficulty === level} onclick={() => (chessDifficulty = level)}>{difficultyLabel(level)}</button>
            {/each}
          </div>
        {/if}

        <button class="create" onclick={createRoom}>{createLabel()}</button>

        {#if (game !== 'chess' || players === 2) && (game !== 'dungeon' || players === 2)}
          <div class="join-block">
            <div class="divider"><span>{t('home.orJoin')}</span></div>
            <div class="join">
              <input bind:value={roomCode} maxlength="6" autocomplete="off" placeholder={t('home.roomCode')} aria-label={t('home.roomCode')} onkeydown={(event) => event.key === 'Enter' && joinRoom()} />
              <button onclick={joinRoom}>{t('home.joinButton')}</button>
            </div>
          </div>
        {/if}
        <small class="helper">{helper()}</small>
      </section>
    </div>
  </section>
</main>

<style>
  .home{min-height:100vh;display:grid;place-items:center;padding:18px;background:#0b0d10}.launcher{width:min(100%,1040px);padding:24px;border:1px solid #272c33;background:#111419;box-shadow:12px 12px 0 #050607}.launcher-head{display:flex;align-items:center;justify-content:space-between;padding-right:104px}.launcher-head>span,.home-game>span{color:#69727d;font-size:10px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.home-brand{color:#c1ff56;text-decoration:none;font-size:12px;font-weight:900;letter-spacing:.18em}.launcher-grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(320px,.9fr);gap:26px;margin-top:22px}.library{min-width:0}.game-picker,.mode-picker,.difficulty-picker{display:grid;gap:8px}.game-picker{grid-template-columns:repeat(2,minmax(0,1fr))}.game-picker button,.mode-picker button,.difficulty-picker button{border:1px solid #30363f;background:#0b0d10;color:#f4f0e8;text-align:left;cursor:pointer}.game-picker button{position:relative;min-height:82px;padding:13px 14px}.game-picker button.active,.mode-picker button.active,.difficulty-picker button.active{border-color:#c1ff56;box-shadow:inset 0 -3px 0 #c1ff56}.game-picker span{position:absolute;top:11px;right:12px;color:#4e5660;font:800 9px ui-monospace,monospace}.game-picker strong{display:block;padding-right:24px;font-size:15px}.game-picker small,.mode-picker small{display:block;margin-top:7px;color:#69727d;font-size:9px;line-height:1.25;letter-spacing:.05em}.setup{min-width:0;display:flex;flex-direction:column}.home-game{min-height:116px;padding-bottom:16px}.home-game h1{margin:7px 0 7px;font-size:clamp(30px,3.8vw,44px);line-height:.98;letter-spacing:-.05em}.home-game p{min-height:34px;margin:0;color:#7f8791;font-size:12px;line-height:1.45}.mode-picker{grid-template-columns:1fr 1fr}.mode-picker button{min-height:58px;padding:11px 12px}.mode-picker strong{display:block;font-size:11px}.difficulty-picker{grid-template-columns:repeat(4,1fr);margin-top:8px}.difficulty-picker button{min-height:38px;padding:0 5px;text-align:center;text-transform:uppercase;font-size:9px;font-weight:900}.create{width:100%;height:48px;margin-top:10px;border:0;background:#c1ff56;color:#0b0d10;font-weight:900;cursor:pointer}.divider{display:flex;align-items:center;gap:10px;margin:14px 0 10px;color:#59616b;font-size:9px;text-transform:uppercase}.divider:before,.divider:after{content:'';height:1px;flex:1;background:#272c33}.join{display:grid;grid-template-columns:1fr 78px;gap:8px}.join input,.join button{height:42px;border-radius:0;font:inherit}.join input{min-width:0;padding:0 12px;border:1px solid #30363f;background:#0b0d10;color:#f4f0e8;text-transform:lowercase;letter-spacing:.1em;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.join button{border:1px solid #3b424c;background:transparent;color:#f4f0e8;font-size:11px;font-weight:800;cursor:pointer}.helper{display:block;margin-top:12px;color:#6f7781;font-size:10px;line-height:1.45}
  @media(min-width:1000px) and (max-height:820px){.home{padding:12px}.launcher{padding:20px}.launcher-grid{margin-top:16px}.game-picker button{min-height:74px}.home-game{min-height:104px}.home-game h1{font-size:34px}.helper{margin-top:9px}}
  @media(max-width:820px){.home{place-items:start center;padding:58px 14px 18px}.launcher{padding:20px;box-shadow:8px 8px 0 #050607}.launcher-head{padding-right:0}.launcher-grid{grid-template-columns:1fr;gap:20px}.game-picker{grid-template-columns:repeat(2,minmax(0,1fr))}.home-game{min-height:auto}.helper{text-align:center}}
  @media(max-width:520px){.launcher{padding:16px}.launcher-head>span{display:none}.launcher-grid{margin-top:16px}.game-picker{grid-template-columns:1fr 1fr;gap:6px}.game-picker button{min-height:70px;padding:11px}.game-picker strong{font-size:13px}.game-picker small{font-size:8px}.mode-picker{grid-template-columns:1fr 1fr}.difficulty-picker{grid-template-columns:repeat(2,1fr)}.home-game h1{font-size:32px}.create{height:50px}.join input,.join button{height:46px}}
</style>
