<script>
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import GamePreview from '$lib/components/GamePreview.svelte'
  import { createTranslator } from '$lib/i18n.js'
  import { setAppLocale, subscribeLocale } from '$lib/locale.js'

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
  <header class="home-nav">
    <a class="home-brand" href="/" aria-label="AQI Arcade home"><span class="brand-mark">A</span><span>AQI ARCADE</span></a>
    <div class="language-switch" aria-label="Language">
      <button class:active={locale === 'en'} aria-pressed={locale === 'en'} onclick={() => setAppLocale('en')}>EN</button>
      <span>/</span>
      <button class:active={locale === 'zh-CN'} aria-pressed={locale === 'zh-CN'} onclick={() => setAppLocale('zh-CN')}>中文</button>
    </div>
  </header>

  <section class="launcher">
    <div class="launcher-grid">
      <nav class="library" aria-label={t('home.chooseGame')}>
        <div class="section-label">{t('home.chooseGame')}</div>
        <div class="game-picker">
          {#each games as item}
            <button class:active={game === item.id} aria-pressed={game === item.id} onclick={() => selectGame(item.id)}>
              <span>{item.number}</span>
              <div><strong>{t(`game.${item.id}.name`)}</strong><small>{shortLabel(item.id)}</small></div>
            </button>
          {/each}
        </div>
      </nav>

      <div class="preview-column">
        <GamePreview {game} {locale} {t} />
      </div>

      <section class="setup">
        <div class="section-label">{t('home.setup')}</div>

        <div class="home-game">
          <div class="home-game-copy">
            <span class="game-index">{games.findIndex((item) => item.id === game) + 1 < 10 ? '0' : ''}{games.findIndex((item) => item.id === game) + 1}</span>
            <h1>{title()}</h1>
            <p>{description()}</p>
          </div>
        </div>

        <div class="setup-controls">
          {#if game === 'tetris' || game === 'chess' || game === 'dungeon'}
            <div class="mode-picker" aria-label="Player mode">
              <button class:active={players === 1} onclick={() => (players = 1)}><strong>{game === 'chess' ? t('home.players.bot') : t('home.players.one')}</strong><small>{t('home.startInstantly')}</small></button>
              <button class:active={players === 2} onclick={() => (players = 2)}><strong>{t('home.players.two')}</strong><small>{game === 'chess' ? t('home.onlineRoom') : t('home.inviteFriend')}</small></button>
            </div>
          {:else}
            <div class="mode-summary">
              <strong>{game === 'snake' ? '1–8' : game === 'drawguess' ? '2–8' : '2'} {locale === 'zh-CN' ? '人' : 'PLAYERS'}</strong>
              <span>{game === 'gomoku' ? t('home.inviteFriend') : t('home.onlineRoom')}</span>
            </div>
          {/if}

          {#if game === 'chess' && players === 1}
            <div class="difficulty-picker" aria-label={t('home.difficulty')}>
              {#each ['easy','medium','hard','expert'] as level}
                <button class:active={chessDifficulty === level} onclick={() => (chessDifficulty = level)}>{difficultyLabel(level)}</button>
              {/each}
            </div>
          {:else}
            <div class="control-spacer" aria-hidden="true"></div>
          {/if}
        </div>

        <div class="setup-actions">
          <button class="create" onclick={createRoom}>{createLabel()}</button>

          {#if (game !== 'chess' || players === 2) && (game !== 'dungeon' || players === 2)}
            <div class="join-block">
              <div class="divider"><span>{t('home.orJoin')}</span></div>
              <div class="join">
                <input bind:value={roomCode} maxlength="6" autocomplete="off" placeholder={t('home.roomCode')} aria-label={t('home.roomCode')} onkeydown={(event) => event.key === 'Enter' && joinRoom()} />
                <button onclick={joinRoom}>{t('home.joinButton')}</button>
              </div>
            </div>
          {:else}
            <div class="join-placeholder" aria-hidden="true"></div>
          {/if}
          <small class="helper">{helper()}</small>
        </div>
      </section>
    </div>
  </section>
</main>

<style>
  .home{height:100dvh;min-height:620px;display:grid;grid-template-rows:50px minmax(0,1fr);box-sizing:border-box;overflow:hidden;background:#0b0d10}.home-nav{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:0 20px;border-bottom:1px solid #272c33;background:#0b0d10}.home-brand{display:inline-flex;align-items:center;gap:10px;color:#f4f0e8;text-decoration:none;font-size:11px;font-weight:900;letter-spacing:.16em}.brand-mark{display:grid;place-items:center;width:26px;height:26px;background:#c1ff56;color:#0b0d10;font-size:12px;letter-spacing:0}.language-switch{display:flex;align-items:center;gap:5px;color:#3f4650;font:800 10px ui-monospace,SFMono-Regular,Menlo,monospace}.language-switch button{height:30px;padding:0 7px;border:0;background:transparent;color:#737b85;font:inherit;cursor:pointer}.language-switch button.active{color:#c1ff56}.launcher{min-height:0;padding:14px 18px 18px;box-sizing:border-box;overflow:hidden}.launcher-grid{height:100%;min-height:0;display:grid;grid-template-columns:200px minmax(0,1fr) 310px;gap:18px;min-width:0}.library,.preview-column,.setup{min-width:0;min-height:0}.library{display:flex;flex-direction:column;padding-right:2px}.section-label{height:28px;display:flex;align-items:center;color:#69727d;font-size:9px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.game-picker{display:flex;flex:1;min-height:0;flex-direction:column;gap:7px;overflow:auto;padding-right:4px;overscroll-behavior:contain}.game-picker button{display:grid;grid-template-columns:26px 1fr;gap:9px;align-items:center;min-height:64px;padding:9px 10px;border:1px solid #30363f;background:#0b0d10;color:#f4f0e8;text-align:left;cursor:pointer}.game-picker button.active{border-color:#c1ff56;background:#10150f;box-shadow:inset 3px 0 0 #c1ff56}.game-picker button>span{color:#505862;font:800 9px ui-monospace,monospace}.game-picker button.active>span{color:#c1ff56}.game-picker strong{display:block;font-size:12px;line-height:1.15}.game-picker small{display:block;margin-top:5px;color:#69727d;font-size:8px;line-height:1.25}.preview-column{display:flex;align-items:center;justify-content:center;border-inline:1px solid #1f242a;padding:0 18px}.setup{display:grid;grid-template-rows:28px minmax(150px,1fr) auto auto;min-height:0}.home-game{min-height:0;display:flex;align-items:center;padding:18px 0 26px;box-sizing:border-box;border-bottom:1px solid #1f242a}.home-game-copy{width:100%}.game-index{display:block;margin-bottom:12px;color:#3f4851;font:900 11px ui-monospace,monospace;letter-spacing:.12em}.home-game h1{margin:0 0 12px;font-size:clamp(32px,3.5vw,48px);line-height:.94;letter-spacing:-.055em}.home-game p{max-width:28ch;margin:0;color:#7f8791;font-size:12px;line-height:1.55}.setup-controls{padding-top:18px;min-height:112px}.mode-picker{display:grid;grid-template-columns:1fr 1fr;gap:7px}.mode-picker button,.difficulty-picker button{border:1px solid #30363f;background:#0b0d10;color:#f4f0e8;cursor:pointer}.mode-picker button{min-height:58px;padding:10px;text-align:left}.mode-picker button.active,.difficulty-picker button.active{border-color:#c1ff56;box-shadow:inset 0 -3px 0 #c1ff56}.mode-picker strong{display:block;font-size:10px}.mode-picker small{display:block;margin-top:6px;color:#69727d;font-size:8px;line-height:1.2}.mode-summary{height:58px;display:flex;flex-direction:column;justify-content:center;padding:0 11px;border:1px solid #30363f;background:#0b0d10}.mode-summary strong{font:900 11px ui-monospace,monospace;color:#f4f0e8}.mode-summary span{margin-top:5px;color:#69727d;font-size:8px}.difficulty-picker{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-top:7px}.difficulty-picker button{height:36px;padding:0 3px;text-align:center;text-transform:uppercase;font-size:8px;font-weight:900}.control-spacer{height:43px}.setup-actions{padding-top:18px;align-self:end}.create{width:100%;height:48px;border:0;background:#c1ff56;color:#0b0d10;font-weight:900;cursor:pointer}.divider{display:flex;align-items:center;gap:10px;height:34px;color:#59616b;font-size:8px;text-transform:uppercase}.divider:before,.divider:after{content:'';height:1px;flex:1;background:#272c33}.join{display:grid;grid-template-columns:1fr 72px;gap:7px}.join input,.join button{height:40px;border-radius:0;font:inherit}.join input{min-width:0;padding:0 10px;border:1px solid #30363f;background:#0b0d10;color:#f4f0e8;text-transform:lowercase;letter-spacing:.08em;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.join button{border:1px solid #3b424c;background:transparent;color:#f4f0e8;font-size:10px;font-weight:800;cursor:pointer}.join-placeholder{height:74px}.helper{display:block;margin-top:11px;color:#6f7781;font-size:9px;line-height:1.4}
  @media(max-width:1050px){.home{height:auto;min-height:100dvh;overflow:auto}.home-nav{position:sticky;top:0;z-index:20}.launcher{overflow:visible;padding:14px}.launcher-grid{height:auto;grid-template-columns:180px minmax(0,1fr);grid-template-rows:auto auto}.library{max-height:430px}.preview-column{min-height:420px;border-right:0}.setup{grid-column:1/-1;border-top:1px solid #272c33;padding-top:16px;display:grid;grid-template-columns:minmax(220px,1fr) minmax(300px,1.2fr);grid-template-rows:auto auto auto;gap:0 18px}.setup>.section-label{grid-column:1/-1}.home-game{min-height:150px;border-bottom:0;padding:18px 0}.setup-controls{min-height:0;padding-top:18px}.setup-actions{padding-top:18px}.helper{padding-right:10px}}
  @media(max-width:650px){.home{grid-template-rows:46px minmax(0,1fr)}.home-nav{padding:0 12px}.home-brand{font-size:10px}.brand-mark{width:24px;height:24px}.language-switch button{height:28px;padding:0 5px}.launcher{padding:10px 8px 16px}.launcher-grid{grid-template-columns:1fr;gap:14px}.library{max-height:none}.game-picker{display:grid;grid-template-columns:repeat(3,minmax(126px,1fr));grid-auto-flow:column;grid-auto-columns:minmax(126px,1fr);overflow-x:auto;overflow-y:hidden;padding:0 0 6px}.game-picker button{min-height:62px}.preview-column{grid-row:2;min-height:0;border:0;padding:0}.setup{grid-column:1;display:flex;border-top:1px solid #272c33;padding-top:14px}.home-game{min-height:160px;border-bottom:1px solid #1f242a;padding:24px 0}.setup-controls{min-height:108px;padding-top:16px}.setup-actions{padding-top:16px}.home-game h1{font-size:38px}.create{height:50px}.join input,.join button{height:44px}.helper{text-align:center;padding:0}}
</style>