<script>
  import { onMount } from 'svelte'
  import { setAppLocale, subscribeLocale } from '$lib/locale.js'

  export let game = ''
  export let room = ''

  let locale = 'en'
  let unsubscribeLocale = () => {}

  const labels = {
    gomoku: { en: 'GOMOKU', 'zh-CN': '五子棋' },
    chess: { en: 'CHESS', 'zh-CN': '国际象棋' },
    tetris: { en: 'TETRIS', 'zh-CN': '俄罗斯方块' },
    snake: { en: 'SNAKE', 'zh-CN': '贪吃蛇' },
    drawguess: { en: 'DRAW & GUESS', 'zh-CN': '你画我猜' },
    dungeon: { en: 'DUNGEON', 'zh-CN': '无尽地牢' },
  }

  $: gameLabel = labels[game]?.[locale] ?? labels[game]?.en ?? ''
  $: roomLabel = room && room !== 'new' ? room.toLowerCase() : ''

  onMount(() => {
    unsubscribeLocale = subscribeLocale((next) => (locale = next))
    return () => unsubscribeLocale()
  })
</script>

<nav class="arcade-top-nav" aria-label="Arcade">
  <a class="brand" href="/" aria-label="AQI Arcade home">
    <span class="brand-mark">A</span>
    <span class="brand-copy">AQI ARCADE</span>
  </a>

  {#if gameLabel}
    <div class="context" aria-label="Current game">
      <span>{gameLabel}</span>
      {#if roomLabel}<i>·</i><strong>{roomLabel}</strong>{/if}
    </div>
  {/if}

  <div class="language-switch" aria-label="Language">
    <button class:active={locale === 'en'} aria-pressed={locale === 'en'} onclick={() => setAppLocale('en')}>EN</button>
    <span>/</span>
    <button class:active={locale === 'zh-CN'} aria-pressed={locale === 'zh-CN'} onclick={() => setAppLocale('zh-CN')}>中文</button>
  </div>
</nav>

<style>
  .arcade-top-nav{height:44px;box-sizing:border-box;display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:16px;padding:0 18px;border-bottom:1px solid #272c33;background:#0b0d10;color:#f4f0e8;position:relative;z-index:100}
  .brand{justify-self:start;display:inline-flex;align-items:center;gap:9px;min-width:0;color:#f4f0e8;text-decoration:none;font-size:10px;font-weight:900;letter-spacing:.15em;white-space:nowrap}
  .brand-mark{display:grid;place-items:center;width:24px;height:24px;flex:0 0 auto;background:#c1ff56;color:#0b0d10;font-size:11px;letter-spacing:0}
  .context{justify-self:center;display:flex;align-items:center;gap:7px;min-width:0;color:#727b85;font:800 9px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.13em;white-space:nowrap;text-transform:uppercase}
  .context span{overflow:hidden;text-overflow:ellipsis}.context i{color:#3f4650;font-style:normal}.context strong{color:#f4f0e8;font:inherit}
  .language-switch{justify-self:end;display:flex;align-items:center;gap:4px;color:#3f4650;font:800 9px ui-monospace,SFMono-Regular,Menlo,monospace}
  .language-switch button{height:28px;padding:0 6px;border:0;background:transparent;color:#737b85;font:inherit;cursor:pointer}.language-switch button.active{color:#c1ff56}
  @media(max-width:640px){.arcade-top-nav{height:40px;grid-template-columns:minmax(0,1fr) auto;padding:0 10px;gap:8px}.brand{font-size:9px;gap:7px}.brand-mark{width:22px;height:22px}.context{display:none}.language-switch button{height:26px;padding:0 5px}}
  @media(max-width:360px){.brand-copy{display:none}}
</style>
