<script>
  import { onMount } from 'svelte'
  import VirtualJoystick from '$lib/components/VirtualJoystick.svelte'
  import { createDungeonGame, chooseDungeonAssets } from '$lib/games/dungeon/scene.js'
  import { formatAffixLabel, gameOverSummary, weaponHudModel } from '$lib/games/dungeon/presentation.js'
  import { installAffixVisuals } from '$lib/games/dungeon/visuals.js'
  import { installPickupInteraction } from '$lib/games/dungeon/pickup-runtime.js'
  import { createComparisonCard } from '$lib/games/dungeon/comparison-runtime.js'
  import { installInfiniteDungeon } from '$lib/games/dungeon/infinite-runtime.js'
  import { installDungeonSpatial } from '$lib/games/dungeon/spatial-runtime.js'
  import { installDungeonAttackRuntime } from '$lib/games/dungeon/attack-runtime.js'
  import { installDungeonBacktracking } from '$lib/games/dungeon/backtrack-runtime.js'
  import { installDungeonVfx } from '$lib/games/dungeon/vfx-runtime.js'
  import { installDungeonTouchInput } from '$lib/games/dungeon/touch-runtime.js'
  import { initialDungeonStats, initialDungeonProgress } from '$lib/games/dungeon/session.js'
  import { loadPhaser } from '$lib/games/dungeon/phaser.js'

  const messages = {
    'zh-CN': { title:'无尽地牢', subtitle:'WASD 移动 · 自动普攻 · Space 主动技能 · E 交互/换装', hp:'生命', damage:'伤害', kills:'击杀', floor:'层数', chapter:'章节', room:'房间', weapon:'武器', none:'无', loading:'正在进入地牢…', back:'返回 Arcade', asset:'Dungeon + Pixel VFX assets', pickupWeapon:'装备{rarity}地牢之刃，基础伤害 +{damage}。', pickupPotion:'喝下生命药水，恢复 {heal} 点生命。', storePotion:'生命药水已收入背包。', dropWeapon:'{rarity}装备掉落！', dropPotion:'生命药水掉落！', gameover:'本次探索结束。', runEnded:'探索终结', runSummary:'本次地牢记录', restart:'重新开始', skill:'主动技能命中 {hits} 个敌人。', floorTitle:'第 {floor} 层', floorClear:'本层已清空', floorStart:'进入第 {floor} 层。', portal:'出口已开启，进入绿色传送门。', dungeonBlade:'地牢之刃', rarityCommon:'普通', rarityUncommon:'精良', rarityRare:'稀有', rarityEpic:'史诗', current:'当前装备', ground:'地上装备', equip:'装备', emptyWeapon:'未装备武器', combat:'战斗', elite:'精英', rest:'休息', boss:'首领', restTitle:'篝火休息', restComplete:'休整完成 · 出口已开启', restRecover:'恢复 50% 最大生命', restTemper:'强化当前武器', restFortune:'下一战利品品质提升', restEntered:'发现休息层，靠近篝火选择奖励。', restChoice:'已选择：{choice}', openChest:'打开宝箱', chestOpened:'宝箱开启！', touchSkill:'技能', touchInteract:'交互', potion:'药水', usePotion:'使用药水', details:'属性', close:'返回战斗', baseDamage:'武器伤害', totalDamage:'总伤害', affixes:'词缀', noAffixes:'暂无词缀', paused:'游戏已暂停' },
    en: { title:'Endless Dungeon', subtitle:'WASD move · auto attack · Space skill · E interact/equip', hp:'HP', damage:'Damage', kills:'Kills', floor:'Floor', chapter:'Chapter', room:'Room', weapon:'Weapon', none:'None', loading:'Entering the dungeon…', back:'Back to Arcade', asset:'Dungeon + Pixel VFX assets', pickupWeapon:'{rarity} Dungeon Blade equipped. Base damage +{damage}.', pickupPotion:'Health potion restored {heal} HP.', storePotion:'Health potion stored.', dropWeapon:'{rarity} equipment dropped!', dropPotion:'Health potion dropped!', gameover:'Run ended.', runEnded:'RUN ENDED', runSummary:'DUNGEON RECORD', restart:'Restart', skill:'Active skill hit {hits} enemies.', floorTitle:'FLOOR {floor}', floorClear:'FLOOR CLEAR', floorStart:'Entered floor {floor}.', portal:'Exit portal opened. Step into the green portal.', dungeonBlade:'Dungeon Blade', rarityCommon:'Common', rarityUncommon:'Uncommon', rarityRare:'Rare', rarityEpic:'Epic', current:'Equipped', ground:'Ground Item', equip:'Equip', emptyWeapon:'No weapon equipped', combat:'Combat', elite:'Elite', rest:'Rest', boss:'Boss', restTitle:'REST CAMP', restComplete:'Rest complete · exit opened', restRecover:'Recover 50% max HP', restTemper:'Temper current weapon', restFortune:'Improve next loot quality', restEntered:'Rest floor found. Approach the camp to choose.', restChoice:'Selected: {choice}', openChest:'Open Chest', chestOpened:'Chest opened!', touchSkill:'SKILL', touchInteract:'USE', potion:'Potion', usePotion:'Use potion', details:'Stats', close:'Resume', baseDamage:'Weapon damage', totalDamage:'Total damage', affixes:'Affixes', noAffixes:'No affixes', paused:'GAME PAUSED' }
  }

  let mount, game, gameResources, touchInput = null, pickupRuntime = null
  let mounted = false, ready = false, gameOver = false, panelOpen = false
  let error = '', locale = 'en', eventText = ''
  let stats = initialDungeonStats(), progress = initialDungeonProgress()

  const t = (key, values = {}) => { let text = messages[locale]?.[key] ?? messages.en[key] ?? key; for (const [name,value] of Object.entries(values)) text = text.replace(`{${name}}`, value); return text }
  const rarityName = (rarity) => { const key = { common:'rarityCommon', uncommon:'rarityUncommon', rare:'rarityRare', epic:'rarityEpic' }[rarity]; return key ? t(key) : '' }
  const roomName = (role) => t(role || 'combat')
  $: weaponModel = weaponHudModel(stats, locale)
  $: runSummary = gameOverSummary(stats, progress)
  $: hpPercent = Math.max(0, Math.min(100, (stats.hp / Math.max(1, stats.maxHp)) * 100))

  function dungeonScene() { return game?.scene?.getScene?.('Dungeon') }
  function setLocale(next) { locale = next; localStorage.setItem('arcade.locale', next); dungeonScene()?.__comparisonCard?.refresh?.() }
  function setPanel(open) {
    if (panelOpen === open || gameOver) return
    panelOpen = open
    touchInput?.stopMove()
    const scene = dungeonScene()
    if (!scene) return
    if (open) scene.scene?.pause?.()
    else scene.scene?.resume?.()
  }
  function togglePanel() { setPanel(!panelOpen) }
  function usePotion(event) { event?.stopPropagation?.(); if (pickupRuntime?.useHealthPotion?.()) eventText = t('pickupPotion', { heal: 28 }) }

  function onEvent(event) {
    const potion = event.item?.type === 'consumable.health_potion'
    if (event.type === 'pickup') eventText = potion ? t('pickupPotion', { heal: event.healed ?? 0 }) : t('pickupWeapon', { rarity: rarityName(event.item?.rarity), damage: event.item?.damage ?? 0 })
    if (event.type === 'drop') eventText = potion ? t('dropPotion') : t('dropWeapon', { rarity: rarityName(event.item?.rarity) })
    if (event.type === 'gameover') { eventText = t('gameover'); gameOver = true; panelOpen = false; touchInput?.stopMove() }
    if (event.type === 'skill') eventText = t('skill', { hits: event.hits })
    if (event.type === 'floorstart') eventText = `${t('floorStart', { floor: event.floor })} · ${roomName(event.roomRole)}`
    if (event.type === 'floorclear') eventText = t('floorClear')
    if (event.type === 'portal') eventText = t('portal')
    if (event.type === 'rest') eventText = t('restEntered')
    if (event.type === 'restchoice') eventText = t('restChoice', { choice: t(`rest${event.choice[0].toUpperCase()}${event.choice.slice(1)}`) })
    if (event.type === 'chestopen') eventText = t('chestOpened')
  }
  function triggerSkill(event) { event.preventDefault(); touchInput?.triggerSkill() }
  function triggerInteract(event) { event.preventDefault(); touchInput?.triggerInteract() }
  function handleJoystickMove(event) { touchInput?.setMove(event.detail.x, event.detail.y) }

  async function loadGameResources() {
    if (gameResources) return gameResources
    const [Phaser, dungeonResponse, vfxResponse] = await Promise.all([loadPhaser(), fetch('/assets/debts/manifest.json').catch(() => null), fetch('/assets/vfx/manifest.json').catch(() => null)])
    const manifest = dungeonResponse?.ok ? await dungeonResponse.json() : { png: [] }
    const vfxManifest = vfxResponse?.ok ? await vfxResponse.json() : { assets: [] }
    return gameResources = { Phaser, assets: chooseDungeonAssets(manifest), vfxManifest }
  }

  async function startDungeon() {
    const previousGame = game
    game = null; pickupRuntime = null; panelOpen = false; touchInput?.stopMove(); touchInput = null; previousGame?.destroy(true); if (mount) mount.innerHTML = ''
    stats = initialDungeonStats(); progress = initialDungeonProgress(); eventText = ''; gameOver = false; ready = false; error = ''
    try {
      const { Phaser, assets, vfxManifest } = await loadGameResources()
      if (!mounted) return
      const runGame = createDungeonGame({ Phaser, parent: mount, assets, labels: { floor:(floor)=>t('floorTitle',{floor}), floorClear:()=>t('floorClear'), rarity:(rarity)=>rarityName(rarity), affix:(id,value,tier)=>formatAffixLabel({id,value,tier},locale) }, onStats(next) { stats = { ...stats, ...next } }, onEvent })
      game = runGame
      let attempts = 0
      const installRuntime = () => {
        if (!mounted || game !== runGame) return
        const scene = runGame.scene?.getScene?.('Dungeon')
        if (!scene) { if (attempts++ < 60) requestAnimationFrame(installRuntime); return }
        installAffixVisuals(scene); installDungeonVfx(scene, vfxManifest)
        if (!scene.__comparisonCard) scene.__comparisonCard = createComparisonCard(scene, { getLocale:()=>locale, label:(key)=>t(({ground:'ground',current:'current',dungeonBlade:'dungeonBlade',emptyWeapon:'emptyWeapon',equip:'equip'})[key]??key), rarityName })
        scene.__dungeonInventoryStats = (count) => { stats = { ...stats, healthPotions: count } }
        pickupRuntime = installPickupInteraction(scene, { onSelection(next) { scene.__comparisonCard?.setSelection(next) } })
        if (!scene.__infiniteDungeon) scene.__infiniteDungeon = installInfiniteDungeon(scene, { onProgress(next){ progress = next }, onEvent, label:(key)=>t(({floor:'floor',chapter:'chapter',floorClear:'floorClear',restTitle:'restTitle',restComplete:'restComplete','rest.recover':'restRecover','rest.temper':'restTemper','rest.fortune':'restFortune'})[key]??key) })
        installDungeonSpatial(scene, { getProgress:()=>scene.__infiniteDungeon?.getProgress?.()??progress, onEvent, label:(key)=>t(key) })
        installDungeonAttackRuntime(scene); installDungeonBacktracking(scene, { onProgress(next){ progress = next } }); touchInput = installDungeonTouchInput(scene)
      }
      installRuntime(); ready = true
    } catch (cause) { console.error(cause); error = cause?.message || 'Failed to start dungeon' }
  }

  onMount(() => { mounted = true; const saved = localStorage.getItem('arcade.locale'); locale = saved || (navigator.language?.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en'); startDungeon(); return () => { mounted = false; touchInput?.stopMove(); game?.destroy(true); game = null } })
</script>

<svelte:head><title>{t('title')} · AQI Arcade</title></svelte:head>

<main class="page">
  <header class="topbar"><div><a href="/" class="brand">AQI ARCADE</a><h1>{t('title')}</h1><p>{t('subtitle')}</p></div><div class="actions"><button class:active={locale==='zh-CN'} on:click={()=>setLocale('zh-CN')}>中文</button><button class:active={locale==='en'} on:click={()=>setLocale('en')}>EN</button><a href="/">{t('back')}</a></div></header>
  <section class="stage-shell">
    <div bind:this={mount} class="stage"></div>
    <div class="game-hud">
      <div class="vitals"><div class="hp-line"><span>{t('hp')}</span><strong>{stats.hp}/{stats.maxHp}</strong></div><div class="hp-track"><i style={`width:${hpPercent}%`}></i></div><div class="micro"><span>F{progress.floor}</span><span>{roomName(progress.roomRole)}</span><span>☠ {stats.kills}</span></div></div>
      <div class="hud-actions">
        <button class="potion-chip" disabled={(stats.healthPotions??0)<=0 || stats.hp>=stats.maxHp} on:click={usePotion} aria-label={t('usePotion')}><b>♥</b><span>{stats.healthPotions??0}</span></button>
        <button class="weapon-chip" on:click={togglePanel}><span class="weapon-kicker">{t('weapon')} · {t('details')}</span><strong class:common={stats.weaponRarity==='common'} class:uncommon={stats.weaponRarity==='uncommon'} class:rare={stats.weaponRarity==='rare'} class:epic={stats.weaponRarity==='epic'}>{stats.weapon ? `${rarityName(stats.weaponRarity)} ${t('dungeonBlade')}` : t('none')}</strong><small>{stats.weapon ? `+${weaponModel.damage} ${t('baseDamage')}` : t('emptyWeapon')}</small></button>
      </div>
    </div>

    {#if !gameOver && !panelOpen}<div class="touch-controls" aria-hidden="true"><div class="joystick-slot"><VirtualJoystick on:move={handleJoystickMove}/></div><div class="touch-actions"><button class="touch-button interact" on:pointerdown={triggerInteract}>{t('touchInteract')}</button><button class="touch-button skill" on:pointerdown={triggerSkill}>{t('touchSkill')}</button></div></div>{/if}
    {#if !ready && !error}<div class="overlay">{t('loading')}</div>{/if}
    {#if error}<div class="overlay error">{error}</div>{/if}

    {#if panelOpen}
      <div class="stats-overlay" role="dialog" aria-modal="true" aria-label={t('details')}>
        <div class="stats-panel">
          <div class="pause-mark">II · {t('paused')}</div>
          <div class="weapon-title"><div><span>{t('current')}</span><h2 class:common={stats.weaponRarity==='common'} class:uncommon={stats.weaponRarity==='uncommon'} class:rare={stats.weaponRarity==='rare'} class:epic={stats.weaponRarity==='epic'}>{stats.weapon ? `${rarityName(stats.weaponRarity)} ${t('dungeonBlade')}` : t('emptyWeapon')}</h2></div><button class="close" on:click={()=>setPanel(false)}>×</button></div>
          <div class="stat-grid"><div><span>{t('baseDamage')}</span><strong>{weaponModel.damage}</strong></div><div><span>{t('totalDamage')}</span><strong>{stats.damage}</strong></div><div><span>{t('hp')}</span><strong>{stats.hp}/{stats.maxHp}</strong></div><div><span>{t('potion')}</span><strong>♥ × {stats.healthPotions??0}</strong></div></div>
          <div class="affix-box"><span>{t('affixes')}</span>{#if weaponModel.affixes.length}<div class="affix-list">{#each weaponModel.affixes as affix}<div>◆ {affix}</div>{/each}</div>{:else}<p>{t('noAffixes')}</p>{/if}</div>
          <div class="panel-actions"><button class="use-potion" disabled={(stats.healthPotions??0)<=0 || stats.hp>=stats.maxHp} on:click={usePotion}>♥ {t('usePotion')} · {stats.healthPotions??0}</button><button class="resume" on:click={()=>setPanel(false)}>{t('close')}</button></div>
        </div>
      </div>
    {/if}

    {#if gameOver}<div class="gameover-overlay"><div class="gameover-panel" role="dialog" aria-modal="true"><div class="gameover-kicker">RUN ENDED</div><h2>{t('runEnded')}</h2><div class="run-stats"><div><span>{t('floor')}</span><strong>{runSummary.floor}</strong></div><div><span>{t('kills')}</span><strong>{runSummary.kills}</strong></div></div><div class="run-weapon"><span>{t('weapon')}</span><strong>{runSummary.weapon ? `${rarityName(runSummary.rarity)} ${t('dungeonBlade')} +${runSummary.damage}` : t('none')}</strong></div><div class="gameover-actions"><a href="/">{t('back')}</a><button on:click={startDungeon}>{t('restart')}</button></div></div></div>{/if}
  </section>
  <footer><span>{eventText || t('subtitle')}</span><span>{t('asset')}</span></footer>
</main>

<style>
:global(body){margin:0;background:#080a0d;color:#f4f0e8;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.page{min-height:100vh;padding:20px;box-sizing:border-box}.topbar{width:min(1180px,100%);margin:0 auto 14px;display:flex;justify-content:space-between;gap:24px;align-items:flex-end}.brand{color:#c1ff56;text-decoration:none;font-size:11px;font-weight:900;letter-spacing:.18em}.topbar h1{margin:8px 0 3px;font-size:clamp(28px,5vw,48px);letter-spacing:-.05em}.topbar p{margin:0;color:#7e8792;font-size:13px}.actions{display:flex;gap:8px;align-items:center}.actions button,.actions a{height:34px;padding:0 11px;border:1px solid #30363f;background:#111419;color:#9aa4ae;font:inherit;font-size:11px;display:inline-flex;align-items:center;text-decoration:none;cursor:pointer}.actions button.active{border-color:#c1ff56;color:#c1ff56}.stage-shell{position:relative;width:min(1180px,100%);aspect-ratio:16/10;margin:0 auto;border:1px solid #30363f;background:#0b0d10;box-shadow:14px 14px 0 #040506;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;overscroll-behavior:contain}.stage{width:100%;height:100%}.stage :global(canvas){display:block;width:100%!important;height:100%!important;touch-action:none}.game-hud{position:absolute;z-index:40;left:16px;right:16px;top:14px;display:flex;justify-content:space-between;gap:14px;pointer-events:none;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.vitals{width:min(310px,42%);padding:10px 12px;border:1px solid rgba(90,104,120,.7);background:rgba(7,9,12,.78);box-shadow:4px 4px 0 rgba(0,0,0,.35);backdrop-filter:blur(4px)}.hp-line{display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#aab2bb}.hp-line strong{font-size:13px;color:#f4f0e8}.hp-track{height:8px;margin-top:7px;background:#241317;border:1px solid #47242b}.hp-track i{display:block;height:100%;background:#e65869}.micro{display:flex;gap:12px;margin-top:7px;font-size:9px;color:#7d8792;text-transform:uppercase}.hud-actions{display:flex;gap:8px;pointer-events:auto}.potion-chip,.weapon-chip{border:1px solid rgba(90,104,120,.8);background:rgba(7,9,12,.82);color:#f4f0e8;box-shadow:4px 4px 0 rgba(0,0,0,.35);backdrop-filter:blur(4px);cursor:pointer;touch-action:manipulation}.potion-chip{width:54px;min-height:54px;display:grid;place-items:center;align-content:center}.potion-chip b{color:#ff6875;font-size:18px}.potion-chip span{font:900 11px ui-monospace,monospace}.potion-chip:disabled{opacity:.35;cursor:default}.weapon-chip{min-width:220px;padding:8px 12px;text-align:left}.weapon-kicker,.weapon-chip small{display:block;color:#6f7b87;font:800 8px ui-monospace,monospace;letter-spacing:.11em;text-transform:uppercase}.weapon-chip strong{display:block;margin:3px 0;font:900 12px ui-monospace,monospace}.common{color:#f4f0e8}.uncommon{color:#70ff9f}.rare{color:#67a8ff}.epic{color:#c984ff}.touch-controls{display:none;position:absolute;inset:0;z-index:45;pointer-events:none}.joystick-slot{position:absolute;left:max(18px,env(safe-area-inset-left));bottom:max(18px,env(safe-area-inset-bottom));pointer-events:auto}.touch-actions{position:absolute;right:max(18px,env(safe-area-inset-right));bottom:max(22px,env(safe-area-inset-bottom));display:flex;align-items:flex-end;gap:14px;pointer-events:auto}.touch-button{width:76px;height:76px;border-radius:50%;border:2px solid rgba(244,240,232,.5);background:rgba(15,18,23,.72);color:#f4f0e8;font:800 11px ui-monospace,monospace;touch-action:manipulation}.touch-button.skill{width:88px;height:88px;color:#d7c4ff;border-color:rgba(201,132,255,.82);background:rgba(74,38,96,.72)}.touch-button.interact{color:#c1ff56;border-color:rgba(193,255,86,.72)}.overlay{position:absolute;inset:0;display:grid;place-items:center;background:#0b0d10;color:#c1ff56;font-family:ui-monospace,monospace;font-weight:800;z-index:60}.overlay.error{color:#ff6875;padding:32px;text-align:center}.stats-overlay,.gameover-overlay{position:absolute;inset:0;z-index:80;display:grid;place-items:center;padding:20px;background:rgba(3,4,6,.76);backdrop-filter:blur(5px)}.stats-panel,.gameover-panel{width:min(520px,calc(100% - 20px));box-sizing:border-box;padding:22px;border:1px solid #3b4550;border-top:3px solid #c1ff56;background:#10141a;box-shadow:12px 12px 0 rgba(0,0,0,.45);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.pause-mark{color:#c1ff56;font-size:9px;font-weight:900;letter-spacing:.18em}.weapon-title{display:flex;justify-content:space-between;gap:20px;align-items:start;margin-top:10px}.weapon-title span,.affix-box>span,.stat-grid span,.run-stats span,.run-weapon span{display:block;color:#68737f;font-size:9px;letter-spacing:.12em;text-transform:uppercase}.weapon-title h2{margin:5px 0 0;font-size:24px}.close{width:44px;height:44px;border:1px solid #3c4651;background:#171c23;color:#d8dde2;font-size:26px;cursor:pointer}.stat-grid{display:grid;grid-template-columns:repeat(4,1fr);margin-top:18px;border:1px solid #2d343d;background:#090c10}.stat-grid>div{padding:12px;border-right:1px solid #2d343d}.stat-grid>div:last-child{border:0}.stat-grid strong{display:block;margin-top:4px;font-size:16px}.affix-box{margin-top:12px;padding:14px;border:1px solid #2d343d;background:#090c10}.affix-list{display:grid;gap:7px;margin-top:9px;color:#cbd3dc;font-size:12px}.affix-box p{margin:8px 0 0;color:#65707c;font-size:11px}.panel-actions{display:grid;grid-template-columns:1fr 1.25fr;gap:10px;margin-top:16px}.panel-actions button,.gameover-actions button,.gameover-actions a{min-height:52px;border:1px solid #3a444f;font:900 11px ui-monospace,monospace;letter-spacing:.05em;cursor:pointer;display:flex;align-items:center;justify-content:center;text-decoration:none}.use-potion{background:#2a1319;color:#ff8993}.use-potion:disabled{opacity:.35}.resume{background:#c1ff56;color:#080a0d;border-color:#c1ff56!important}.gameover-kicker{color:#ff6875;font-size:10px;font-weight:900;letter-spacing:.18em}.gameover-panel h2{margin:8px 0 16px}.run-stats{display:grid;grid-template-columns:1fr 1fr;border:1px solid #2d343d}.run-stats>div,.run-weapon{padding:13px}.run-stats strong,.run-weapon strong{display:block;margin-top:4px}.run-weapon{margin-top:10px;border:1px solid #2d343d}.gameover-actions{display:grid;grid-template-columns:1fr 1.35fr;gap:10px;margin-top:16px}.gameover-actions a{background:#171b21;color:#aab2bb}.gameover-actions button{background:#c1ff56;color:#080a0d;border-color:#c1ff56}footer{width:min(1180px,100%);margin:16px auto 0;display:flex;justify-content:space-between;gap:20px;color:#67717c;font-size:11px}@media(any-pointer:coarse){.touch-controls{display:block}}@media(max-width:720px){.page{padding:10px}.topbar{align-items:flex-start;flex-direction:column}.topbar p{display:none}.actions{flex-wrap:wrap}.stage-shell{aspect-ratio:4/5;box-shadow:8px 8px 0 #040506}.game-hud{left:9px;right:9px;top:max(9px,env(safe-area-inset-top));gap:7px}.vitals{width:46%;padding:8px}.micro{gap:7px;font-size:8px}.weapon-chip{min-width:0;width:132px;padding:7px 8px}.weapon-chip strong{font-size:10px}.weapon-chip small{font-size:7px}.potion-chip{width:46px;min-height:48px}.stats-overlay{padding:max(10px,env(safe-area-inset-top)) max(10px,env(safe-area-inset-right)) max(10px,env(safe-area-inset-bottom)) max(10px,env(safe-area-inset-left));align-items:end}.stats-panel{width:100%;padding:18px;border-top:3px solid #c1ff56}.stat-grid{grid-template-columns:1fr 1fr}.stat-grid>div{border-bottom:1px solid #2d343d}.panel-actions{grid-template-columns:1fr}.panel-actions button{min-height:56px}.resume{order:-1}.touch-button{width:68px;height:68px}.touch-button.skill{width:80px;height:80px}footer{flex-direction:column}.gameover-panel{width:100%}}
</style>
