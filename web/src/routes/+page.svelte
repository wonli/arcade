<script>
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import GamePreview from '$lib/components/GamePreview.svelte'
  import LauncherHelp from '$lib/components/LauncherHelp.svelte'
  import { gameCopy, difficultyLabel } from '$lib/home/game-copy.js'
  import { getLauncherMetadata } from '$lib/games/launcher-registry.js'
  import { createTranslator } from '$lib/i18n.js'
  import { setAppLocale, subscribeLocale } from '$lib/locale.js'

  let roomCode = $state('')
  let game = $state('gomoku')
  let players = $state(2)
  let chessDifficulty = $state('medium')
  let locale = $state('en')
  let unsubscribeLocale = () => {}

  const t = $derived(createTranslator(locale))
  const copy = $derived(gameCopy({ game, players, chessDifficulty, locale }, t))
  const launcherMetadata = $derived(getLauncherMetadata(game))

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

  function shortLabel(id) { return t(`game.${id}.short`) }

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
                <button class:active={chessDifficulty === level} onclick={() => (chessDifficulty = level)}>{difficultyLabel(level, locale)}</button>
              {/each}
            </div>
          {/if}
        </div>

        <LauncherHelp metadata={launcherMetadata} {t} />

        <div class="setup-actions">
          {#if (game !== 'chess' || players === 2) && (game !== 'dungeon' || players === 2)}
            <div class="join-block">
              <div class="divider"><span>{t('home.orJoin')}</span></div>
              <div class="join">
                <input bind:value={roomCode} maxlength="6" autocomplete="off" placeholder={t('home.roomCode')} aria-label={t('home.roomCode')} onkeydown={(event) => event.key === 'Enter' && joinRoom()} />
                <button onclick={joinRoom}>{t('home.joinButton')}</button>
              </div>
            </div>
          {/if}

          <button class="create" onclick={createRoom}>{copy.createLabel}</button>
        </div>
      </section>
    </div>
  </section>
</main>

<style>
  .home{height:100dvh;min-height:620px;display:grid;grid-template-rows:50px minmax(0,1fr);box-sizing:border-box;overflow:hidden;background:#0b0d10}.home-nav{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:0 20px;border-bottom:1px solid #272c33;background:#0b0d10}.home-brand{display:inline-flex;align-items:center;gap:10px;color:#f4f0e8;text-decoration:none;font-size:11px;font-weight:900;letter-spacing:.16em}.brand-mark{display:grid;place-items:center;width:26px;height:26px;background:#c1ff56;color:#0b0d10;font-size:12px;letter-spacing:0}.language-switch{display:flex;align-items:center;gap:5px;color:#3f4650;font:800 10px ui-monospace,SFMono-Regular,Menlo,monospace}.language-switch button{height:30px;padding:0 7px;border:0;background:transparent;color:#737b85;font:inherit;cursor:pointer}.language-switch button.active{color:#c1ff56}.launcher{min-height:0;padding:14px 18px 18px;box-sizing:border-box;overflow:hidden}.launcher-grid{height:100%;min-height:0;display:grid;grid-template-columns:200px minmax(0,1fr) 310px;gap:18px;min-width:0}.library,.preview-column,.setup{min-width:0;min-height:0}.library{display:flex;flex-direction:column;padding-right:2px}.section-label{height:28px;display:flex;align-items:center;color:#69727d;font-size:9px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.game-picker{display:flex;flex:1;min-height:0;flex-direction:column;gap:7px;overflow:auto;padding-right:4px;overscroll-behavior:contain}.game-picker button{display:grid;grid-template-columns:26px 1fr;gap:9px;align-items:center;min-height:64px;padding:9px 10px;border:1px solid #30363f;background:#0b0d10;color:#f4f0e8;text-align:left;cursor:pointer}.game-picker button.active{border-color:#c1ff56;background:#10150f;box-shadow:inset 3px 0 0 #c1ff56}.game-picker button>span{color:#505862;font:800 9px ui-monospace,monospace}.game-picker button.active>span{color:#c1ff56}.game-picker strong{display:block;font-size:12px;line-height:1.15}.game-picker small{display:block;margin-top:5px;color:#69727d;font-size:8px;line-height:1.25}.preview-column{display:flex;align-items:stretch;justify-content:stretch;padding:0;overflow:hidden}.setup{display:flex;flex-direction:column;min-height:0}.setup-controls{padding-top:14px}.mode-picker{display:grid;grid-template-columns:1fr 1fr;gap:7px}.mode-picker button,.difficulty-picker button{border:1px solid #30363f;background:#0b0d10;color:#f4f0e8;cursor:pointer}.mode-picker button{min-height:58px;padding:10px;text-align:left}.mode-picker button.active,.difficulty-picker button.active{border-color:#c1ff56;box-shadow:inset 0 -3px 0 #c1ff56}.mode-picker strong{display:block;font-size:10px}.mode-picker small{display:block;margin-top:6px;color:#69727d;font-size:8px;line-height:1.2}.mode-summary{height:58px;display:flex;flex-direction:column;justify-content:center;padding:0 11px;border:1px solid #30363f;background:#0b0d10}.mode-summary strong{font:900 11px ui-monospace,monospace;color:#f4f0e8}.mode-summary span{margin-top:5px;color:#69727d;font-size:8px}.difficulty-picker{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-top:7px}.difficulty-picker button{height:36px;padding:0 3px;text-align:center;text-transform:uppercase;font-size:8px;font-weight:900}.setup-actions{margin-top:auto;padding-top:20px}.create{width:100%;height:52px;border:0;background:#c1ff56;color:#0b0d10;font-weight:900;cursor:pointer}.divider{display:flex;align-items:center;gap:10px;height:34px;color:#59616b;font-size:8px;text-transform:uppercase}.divider:before,.divider:after{content:'';height:1px;flex:1;background:#272c33}.join{display:grid;grid-template-columns:1fr 72px;gap:7px}.join input,.join button{height:40px;border-radius:0;font:inherit}.join input{min-width:0;padding:0 10px;border:1px solid #30363f;background:#0b0d10;color:#f4f0e8;text-transform:lowercase;letter-spacing:.08em;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.join button{border:1px solid #3b424c;background:transparent;color:#f4f0e8;font-size:10px;font-weight:800;cursor:pointer}.join-block{margin-bottom:14px}
  @media(max-width:1050px){.home{height:auto;min-height:100dvh;overflow:auto}.home-nav{position:sticky;top:0;z-index:20}.launcher{overflow:visible;padding:14px}.launcher-grid{height:auto;grid-template-columns:180px minmax(0,1fr);grid-template-rows:auto auto}.library{max-height:430px}.preview-column{min-height:420px}.setup{grid-column:1/-1;border-top:1px solid #272c33;padding-top:16px;min-height:520px}.setup-controls{padding-top:14px}.setup-actions{padding-top:18px}}
  @media(max-width:650px){.home{grid-template-rows:46px minmax(0,1fr)}.home-nav{padding:0 12px}.home-brand{font-size:10px}.brand-mark{width:24px;height:24px}.language-switch button{height:28px;padding:0 5px}.launcher{padding:10px 8px 16px}.launcher-grid{grid-template-columns:1fr;gap:14px}.library{max-height:none}.game-picker{display:grid;grid-template-columns:repeat(3,minmax(126px,1fr));grid-auto-flow:column;grid-auto-columns:minmax(126px,1fr);overflow-x:auto;overflow-y:hidden;padding:0 0 6px}.game-picker button{min-height:62px}.preview-column{grid-row:2;min-height:360px}.setup{grid-column:1;min-height:0;border-top:1px solid #272c33;padding-top:14px}.setup-controls{padding-top:12px}.setup-actions{margin-top:24px;padding-top:0}.create{height:52px}.join input,.join button{height:44px}}
</style>
