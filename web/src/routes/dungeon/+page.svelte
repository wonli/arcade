<script>
  import { onMount } from 'svelte'
  import { createDungeonGame, chooseDungeonAssets } from '$lib/games/dungeon/scene.js'
  import { formatAffixLabel, weaponHudModel } from '$lib/games/dungeon/presentation.js'
  import { loadPhaser } from '$lib/games/dungeon/phaser.js'

  const messages = {
    'zh-CN': {
      title: '无尽地牢', subtitle: 'WASD 移动 · 自动普攻 · Space 主动技能', hp: '生命', damage: '伤害', kills: '击杀', floor: '层数', weapon: '武器', none: '无', loading: '正在进入地牢…', back: '返回 Arcade', asset: 'Debts in the Depths · CC0', pickupWeapon: '装备{rarity}地牢之刃，基础伤害 +{damage}。', pickupPotion: '喝下生命药水，恢复 {heal} 点生命。', dropWeapon: '{rarity}装备掉落！', dropPotion: '生命药水掉落！', gameover: '本次探索结束。', skill: '主动技能命中 {hits} 个敌人。', floorTitle: '第 {floor} 层', floorClear: '本层已清空', floorStart: '进入第 {floor} 层。', portal: '出口已开启，进入绿色传送门。', runComplete: '地牢征服', runCompleteHint: '五层探索完成', runCompleteEvent: '五层地牢已全部清空！', dungeonBlade: '地牢之刃', rarityCommon: '普通', rarityUncommon: '精良', rarityRare: '稀有', rarityEpic: '史诗'
    },
    en: {
      title: 'Endless Dungeon', subtitle: 'WASD move · auto attack · Space active skill', hp: 'HP', damage: 'Damage', kills: 'Kills', floor: 'Floor', weapon: 'Weapon', none: 'None', loading: 'Entering the dungeon…', back: 'Back to Arcade', asset: 'Debts in the Depths · CC0', pickupWeapon: '{rarity} Dungeon Blade equipped. Base damage +{damage}.', pickupPotion: 'Health potion restored {heal} HP.', dropWeapon: '{rarity} equipment dropped!', dropPotion: 'Health potion dropped!', gameover: 'Run ended.', skill: 'Active skill hit {hits} enemies.', floorTitle: 'FLOOR {floor}', floorClear: 'FLOOR CLEAR', floorStart: 'Entered floor {floor}.', portal: 'Exit portal opened. Step into the green portal.', runComplete: 'DUNGEON CLEARED', runCompleteHint: 'Five floors survived', runCompleteEvent: 'All five dungeon floors cleared!', dungeonBlade: 'Dungeon Blade', rarityCommon: 'Common', rarityUncommon: 'Uncommon', rarityRare: 'Rare', rarityEpic: 'Epic'
    }
  }

  let mount
  let game
  let ready = false
  let error = ''
  let locale = 'en'
  let stats = { hp: 100, maxHp: 100, damage: 10, kills: 0, floor: 1, weapon: null, weaponRarity: null, weaponDamage: 0, weaponAffixes: [] }
  let eventText = ''

  const t = (key, values = {}) => {
    let text = messages[locale]?.[key] ?? messages.en[key] ?? key
    for (const [name, value] of Object.entries(values)) text = text.replace(`{${name}}`, value)
    return text
  }

  const rarityName = (rarity) => {
    const key = {
      common: 'rarityCommon',
      uncommon: 'rarityUncommon',
      rare: 'rarityRare',
      epic: 'rarityEpic',
    }[rarity]
    return key ? t(key) : ''
  }

  $: weaponModel = weaponHudModel(stats, locale)

  function setLocale(next) {
    locale = next
    localStorage.setItem('arcade.locale', next)
  }

  function onEvent(event) {
    const potion = event.item?.type === 'consumable.health_potion'
    if (event.type === 'pickup') eventText = potion ? t('pickupPotion', { heal: event.healed ?? 0 }) : t('pickupWeapon', { rarity: rarityName(event.item?.rarity), damage: event.item?.damage ?? 0 })
    if (event.type === 'drop') eventText = potion ? t('dropPotion') : t('dropWeapon', { rarity: rarityName(event.item?.rarity) })
    if (event.type === 'gameover') eventText = t('gameover')
    if (event.type === 'skill') eventText = t('skill', { hits: event.hits })
    if (event.type === 'floorstart') eventText = t('floorStart', { floor: event.floor })
    if (event.type === 'floorclear') eventText = t('floorClear')
    if (event.type === 'portal') eventText = t('portal')
    if (event.type === 'runcomplete') eventText = t('runCompleteEvent')
  }

  onMount(async () => {
    const saved = localStorage.getItem('arcade.locale')
    locale = saved || (navigator.language?.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en')

    try {
      const [Phaser, response] = await Promise.all([
        loadPhaser(),
        fetch('/assets/debts/manifest.json').catch(() => null),
      ])
      const manifest = response?.ok ? await response.json() : { png: [] }
      const assets = chooseDungeonAssets(manifest)
      game = createDungeonGame({
        Phaser,
        parent: mount,
        assets,
        labels: {
          floor: (floor) => t('floorTitle', { floor }),
          floorClear: () => t('floorClear'),
          runComplete: () => t('runComplete'),
          runCompleteHint: () => t('runCompleteHint'),
          rarity: (rarity) => rarityName(rarity),
          affix: (id, value, tier) => formatAffixLabel({ id, value, tier }, locale),
        },
        onStats(next) { stats = next },
        onEvent,
      })
      ready = true
    } catch (cause) {
      console.error(cause)
      error = cause?.message || 'Failed to start dungeon'
    }

    return () => game?.destroy(true)
  })
</script>

<svelte:head>
  <title>{t('title')} · AQI Arcade</title>
  <meta name="description" content="AQI Arcade Endless Dungeon combat prototype" />
</svelte:head>

<main class="page">
  <header class="topbar">
    <div>
      <a href="/" class="brand">AQI ARCADE</a>
      <h1>{t('title')}</h1>
      <p>{t('subtitle')}</p>
    </div>
    <div class="actions">
      <button class:active={locale === 'zh-CN'} on:click={() => setLocale('zh-CN')}>中文</button>
      <button class:active={locale === 'en'} on:click={() => setLocale('en')}>EN</button>
      <a href="/">{t('back')}</a>
    </div>
  </header>

  <section class="hud">
    <div><span>{t('hp')}</span><strong>{stats.hp}/{stats.maxHp}</strong></div>
    <div><span>{t('damage')}</span><strong>{stats.damage}</strong></div>
    <div><span>{t('kills')}</span><strong>{stats.kills}</strong></div>
    <div><span>{t('floor')}</span><strong>{stats.floor}/5</strong></div>
    <div class="weapon-cell">
      <span>{t('weapon')}</span>
      <strong class:common={stats.weaponRarity === 'common'} class:uncommon={stats.weaponRarity === 'uncommon'} class:rare={stats.weaponRarity === 'rare'} class:epic={stats.weaponRarity === 'epic'}>
        {stats.weapon ? `${rarityName(stats.weaponRarity)} ${t('dungeonBlade')} +${weaponModel.damage}` : t('none')}
      </strong>
      {#if weaponModel.affixes.length}
        <ul class="affixes">
          {#each weaponModel.affixes as affix}
            <li class:build={affix.startsWith('★')}>{affix}</li>
          {/each}
        </ul>
      {/if}
    </div>
  </section>

  <section class="stage-shell">
    <div bind:this={mount} class="stage"></div>
    {#if !ready && !error}<div class="overlay">{t('loading')}</div>{/if}
    {#if error}<div class="overlay error">{error}</div>{/if}
  </section>

  <footer>
    <span>{eventText || t('subtitle')}</span>
    <span>{t('asset')}</span>
  </footer>
</main>

<style>
  :global(body){margin:0;background:#080a0d;color:#f4f0e8;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.page{min-height:100vh;padding:20px;box-sizing:border-box}.topbar{width:min(1180px,100%);margin:0 auto 14px;display:flex;justify-content:space-between;gap:24px;align-items:flex-end}.brand{color:#c1ff56;text-decoration:none;font-size:11px;font-weight:900;letter-spacing:.18em}.topbar h1{margin:8px 0 3px;font-size:clamp(28px,5vw,48px);letter-spacing:-.05em}.topbar p{margin:0;color:#7e8792;font-size:13px}.actions{display:flex;gap:8px;align-items:center}.actions button,.actions a{height:34px;padding:0 11px;border:1px solid #30363f;background:#111419;color:#9aa4ae;font:inherit;font-size:11px;display:inline-flex;align-items:center;text-decoration:none;cursor:pointer}.actions button.active{border-color:#c1ff56;color:#c1ff56}.hud{width:min(1180px,100%);margin:0 auto 12px;display:grid;grid-template-columns:repeat(4,1fr) minmax(280px,1.7fr);border:1px solid #262c34;background:#101319}.hud>div{padding:10px 14px;border-right:1px solid #262c34}.hud>div:last-child{border-right:0}.hud span{display:block;color:#66717d;font-size:9px;text-transform:uppercase;letter-spacing:.12em}.hud strong{display:block;margin-top:3px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:14px}.hud strong.common{color:#f4f0e8}.hud strong.uncommon{color:#70ff9f}.hud strong.rare{color:#67a8ff}.hud strong.epic{color:#c984ff}.affixes{list-style:none;margin:6px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:4px 10px}.affixes li{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;color:#9ca7b2;white-space:nowrap}.affixes li.build{color:#ffd56a;font-weight:800}.stage-shell{position:relative;width:min(1180px,100%);aspect-ratio:16/10;margin:0 auto;border:1px solid #30363f;background:#0b0d10;box-shadow:14px 14px 0 #040506;overflow:hidden}.stage{width:100%;height:100%}.stage :global(canvas){display:block;width:100%!important;height:100%!important}.overlay{position:absolute;inset:0;display:grid;place-items:center;background:#0b0d10;color:#c1ff56;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:800;letter-spacing:.08em}.overlay.error{color:#ff6875;padding:32px;text-align:center}footer{width:min(1180px,100%);margin:16px auto 0;display:flex;justify-content:space-between;gap:20px;color:#67717c;font-size:11px}@media(max-width:720px){.page{padding:12px}.topbar{align-items:flex-start;flex-direction:column}.actions{flex-wrap:wrap}.hud{grid-template-columns:repeat(2,1fr)}.hud>div{border-bottom:1px solid #262c34}.weapon-cell{grid-column:1/-1}.stage-shell{aspect-ratio:4/5;box-shadow:8px 8px 0 #040506}footer{flex-direction:column}.topbar h1{font-size:34px}}
</style>