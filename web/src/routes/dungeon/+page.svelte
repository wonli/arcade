<script>
  import { onMount } from 'svelte'
  import { onNavigate } from '$app/navigation'
  import VirtualJoystick from '$lib/components/VirtualJoystick.svelte'
  import { getIdentity } from '$lib/identity.js'
  import { setAppLocale, subscribeLocale } from '$lib/locale.js'
  import { createReplaySession, finalizeReplaySession } from '$lib/replay/session.js'
  import { socket } from '$lib/ws/arcade'
  import { createDungeonGame, chooseDungeonAssets } from '$lib/games/dungeon/scene.js'
  import { captureDungeonReplayState, replay as dungeonReplay } from '$lib/games/dungeon/replay.js'
  import { installDungeonReplayEventCapture } from '$lib/games/dungeon/replay-event-capture-runtime.js'
  import { installDungeonPresentationStack } from '$lib/games/dungeon/presentation-stack.js'
  import { formatAffixLabel, gameOverSummary, weaponHudModel, weaponIdentityLabel } from '$lib/games/dungeon/presentation.js'
  import { installPickupInteraction } from '$lib/games/dungeon/pickup-runtime.js'
  import { createComparisonCard } from '$lib/games/dungeon/comparison-runtime.js'
  import { installInfiniteDungeon } from '$lib/games/dungeon/infinite-runtime.js'
  import { installDungeonSpatial } from '$lib/games/dungeon/spatial-runtime.js'
  import { installDungeonAttackRuntime } from '$lib/games/dungeon/attack-runtime.js'
  import { installDungeonBacktracking } from '$lib/games/dungeon/backtrack-runtime.js'
  import { installDungeonTouchInput } from '$lib/games/dungeon/touch-runtime.js'
  import { installDungeonHud } from '$lib/games/dungeon/hud-runtime.js'
  import { initialDungeonStats, initialDungeonProgress } from '$lib/games/dungeon/session.js'
  import { loadPhaser } from '$lib/games/dungeon/phaser.js'
  import { loadDungeonAssetBundle } from '$lib/games/dungeon/asset-bundle.js'

  const identity = getIdentity()
  const SOLO_REPLAY_ROOM = 'SOLO-DUNGEON'
  const soloReplayRoom = {
    id: SOLO_REPLAY_ROOM,
    hostId: identity.sessionId,
    players: [{ id: identity.sessionId, name: 'Solo' }],
    status: 'playing',
  }

  const messages = {
    'zh-CN': { title:'无尽地牢', subtitle:'WASD 移动 · 自动普攻 · Space 主动技能 · E 交互/换装', hp:'生命', damage:'伤害', kills:'击杀', floor:'层数', chapter:'章节', room:'房间', weapon:'武器', none:'无', loading:'正在进入地牢…', back:'返回 Arcade', asset:'Dungeon + Pixel VFX assets', pickupWeapon:'装备 {rarity} · {identity}，基础伤害 +{damage}。', pickupPotion:'喝下生命药水，恢复 {heal} 点生命。', storePotion:'生命药水已收入背包。', fullHealth:'生命值已满。', dropWeapon:'{rarity} · {identity} 掉落！', dropPotion:'生命药水掉落！', gameover:'本次探索结束。', runEnded:'探索终结', runSummary:'本次地牢记录', restart:'重新开始', skill:'主动技能命中 {hits} 个敌人。', floorTitle:'第 {floor} 层', floorClear:'本层已清空', floorStart:'进入第 {floor} 层。', portal:'出口已开启，进入绿色传送门。', dungeonBlade:'地牢之刃', rarityCommon:'普通', rarityUncommon:'精良', rarityRare:'稀有', rarityEpic:'史诗', rarityLegendary:'传奇', current:'当前装备', ground:'地上装备', equip:'装备', emptyWeapon:'未装备武器', combat:'战斗', elite:'精英', rest:'休息', boss:'首领', restTitle:'篝火休息', restComplete:'休整完成 · 出口已开启', restRecover:'恢复 50% 最大生命', restTemper:'强化当前武器', restFortune:'下一战利品品质提升', restEntered:'发现休息层，靠近篝火选择奖励。', restChoice:'已选择：{choice}', openChest:'打开宝箱', chestOpened:'宝箱开启！', touchSkill:'技能', touchInteract:'交互', potion:'药水', usePotion:'使用药水', details:'属性', close:'返回战斗', baseDamage:'武器伤害', totalDamage:'总伤害', affixes:'词缀', noAffixes:'暂无词缀', paused:'游戏已暂停' },
    en: { title:'Endless Dungeon', subtitle:'WASD move · auto attack · Space skill · E interact/equip', hp:'HP', damage:'Damage', kills:'Kills', floor:'Floor', chapter:'Chapter', room:'Room', weapon:'Weapon', none:'None', loading:'Entering the dungeon…', back:'Back to Arcade', asset:'Dungeon + Pixel VFX assets', pickupWeapon:'Equipped {rarity} · {identity}. Base damage +{damage}.', pickupPotion:'Health potion restored {heal} HP.', storePotion:'Health potion stored.', fullHealth:'HP is already full.', dropWeapon:'{rarity} · {identity} dropped!', dropPotion:'Health potion dropped!', gameover:'Run ended.', runEnded:'RUN ENDED', runSummary:'DUNGEON RECORD', restart:'Restart', skill:'Active skill hit {hits} enemies.', floorTitle:'FLOOR {floor}', floorClear:'FLOOR CLEAR', floorStart:'Entered floor {floor}.', portal:'Exit portal opened. Step into the green portal.', dungeonBlade:'Dungeon Blade', rarityCommon:'Common', rarityUncommon:'Uncommon', rarityRare:'Rare', rarityEpic:'Epic', rarityLegendary:'Legendary', current:'Equipped', ground:'Ground Item', equip:'Equip', emptyWeapon:'No weapon equipped', combat:'Combat', elite:'Elite', rest:'Rest', boss:'Boss', restTitle:'REST CAMP', restComplete:'Rest complete · exit opened', restRecover:'Recover 50% max HP', restTemper:'Temper current weapon', restFortune:'Improve next loot quality', restEntered:'Rest floor found. Approach the camp to choose.', restChoice:'Selected: {choice}', openChest:'Open Chest', chestOpened:'Chest opened!', touchSkill:'SKILL', touchInteract:'USE', potion:'Potion', usePotion:'Use potion', details:'Stats', close:'Resume', baseDamage:'Weapon damage', totalDamage:'Total damage', affixes:'Affixes', noAffixes:'No affixes', paused:'GAME PAUSED' }
  }

  let mount, stageShell, gameViewport, game, gameResources
  let touchInput = null, pickupRuntime = null, hudRuntime = null
  let mounted = false, ready = false, gameOver = false, panelOpen = false
  let error = '', locale = 'en', eventText = ''
  let assetProgress = null
  let stats = initialDungeonStats(), progress = initialDungeonProgress()
  let viewportFrame = 0
  let replaySession = null, replayTimer = null, replayFinished = false
  let replayFinishPromise = null
  let unsubscribeLocale = () => {}

  const t = (key, values = {}) => { let text = messages[locale]?.[key] ?? messages.en[key] ?? key; for (const [name,value] of Object.entries(values)) text = text.replace(`{${name}}`, value); return text }
  const rarityName = (rarity) => { const key = { common:'rarityCommon', uncommon:'rarityUncommon', rare:'rarityRare', epic:'rarityEpic', legendary:'rarityLegendary' }[rarity]; return key ? t(key) : '' }
  const roomName = (role) => t(role || 'combat')
  $: weaponModel = weaponHudModel(stats, locale)
  $: runSummary = gameOverSummary(stats, progress)
  $: loadingLabel = assetProgress?.phase === 'download'
    ? `${t('loading')} ${assetProgress.percent ?? 0}%`
    : assetProgress?.phase === 'unpack' ? `${t('loading')} · ${locale === 'zh-CN' ? '解压资源' : 'unpacking assets'}` : t('loading')

  function hudLabels() {
    return { locale, hp:t('hp'), weapon:t('weapon'), details:t('details'), none:t('none'), emptyWeapon:t('emptyWeapon'), dungeonBlade:t('dungeonBlade'), baseDamage:t('baseDamage'), combat:t('combat'), elite:t('elite'), rest:t('rest'), boss:t('boss'), 'rarity:common':t('rarityCommon'), 'rarity:uncommon':t('rarityUncommon'), 'rarity:rare':t('rarityRare'), 'rarity:epic':t('rarityEpic'), 'rarity:legendary':t('rarityLegendary') }
  }

  function dungeonScene() { return game?.scene?.getScene?.('Dungeon') }

  function dungeonReplayState() {
    return captureDungeonReplayState({ scene: dungeonScene(), stats, progress })
  }

  function recordDungeonReplay(force = false) {
    const state = dungeonReplayState()
    if (state) replaySession?.record(state, { force })
  }

  function recordDungeonReplayEvent(event) {
    return replaySession?.recordEvent(event) ?? false
  }

  function finishDungeonReplay() {
    if (replayFinishPromise) return replayFinishPromise
    if (replayFinished) return Promise.resolve(false)
    replayFinished = true
    const session = replaySession
    const state = dungeonReplayState()
    if (!session || !state) return Promise.resolve(false)
    replayFinishPromise = session.finish(state).catch((cause) => {
      console.warn('Dungeon replay final upload failed:', cause)
      return false
    })
    return replayFinishPromise
  }

  onNavigate(() => {
    if (!replaySession) return
    return finishDungeonReplay().then(() => {})
  })

  async function setupDungeonReplay() {
    try {
      await socket.connect()
      await socket.request('arcade.login', { playerId: identity.sessionId, sessionId: identity.sessionId })
      if (!mounted) return
      replaySession = createReplaySession({
        adapter: dungeonReplay,
        roomCode: SOLO_REPLAY_ROOM,
        room: () => soloReplayRoom,
        identity,
        socket,
      })
      replayTimer = setInterval(() => {
        if (ready && !gameOver && !replayFinished) recordDungeonReplay()
      }, 200)
      recordDungeonReplay(true)
    } catch (cause) {
      console.warn('Dungeon replay disabled:', cause)
    }
  }

  function applyLocale(next) {
    locale = next || 'en'
    dungeonScene()?.__comparisonCard?.refresh?.()
    pickupRuntime?.refreshLabels?.()
    hudRuntime?.update()
  }

  function setLocale(next) { setAppLocale(next) }

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

  function usePotion(event) {
    event?.stopPropagation?.()
    if ((stats.healthPotions ?? 0) <= 0) return
    if (stats.hp >= stats.maxHp) { eventText = t('fullHealth'); return }
    if (pickupRuntime?.useHealthPotion?.()) eventText = t('pickupPotion', { heal: 28 })
  }

  function syncGameViewport() {
    cancelAnimationFrame(viewportFrame)
    viewportFrame = requestAnimationFrame(() => {
      const canvas = mount?.querySelector?.('canvas')
      if (!canvas || !stageShell || !gameViewport) return
      const canvasRect = canvas.getBoundingClientRect()
      const shellRect = stageShell.getBoundingClientRect()
      if (!canvasRect.width || !canvasRect.height) return
      gameViewport.style.left = `${canvasRect.left - shellRect.left}px`
      gameViewport.style.top = `${canvasRect.top - shellRect.top}px`
      gameViewport.style.width = `${canvasRect.width}px`
      gameViewport.style.height = `${canvasRect.height}px`
    })
  }

  function onEvent(event) {
    const potion = event.item?.type === 'consumable.health_potion'
    const identityLabel = weaponIdentityLabel(event.item, locale) || t('dungeonBlade')
    if (event.type === 'pickup') eventText = potion ? t('pickupPotion', { heal: event.healed ?? 0 }) : t('pickupWeapon', { rarity: rarityName(event.item?.rarity), identity: identityLabel, damage: event.item?.damage ?? 0 })
    if (event.type === 'drop') eventText = potion ? t('dropPotion') : t('dropWeapon', { rarity: rarityName(event.item?.rarity), identity: identityLabel })
    if (event.type === 'gameover') { eventText = t('gameover'); gameOver = true; panelOpen = false; touchInput?.stopMove(); void finishDungeonReplay() }
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
    const [Phaser, bundle] = await Promise.all([loadPhaser(), loadDungeonAssetBundle({ onProgress: (next) => { assetProgress = next } })])
    return gameResources = { Phaser, assets: chooseDungeonAssets(bundle.manifest, bundle.resolveAsset), vfxManifest: bundle.vfxManifest, assetManifest: bundle.manifest, resolveAsset: bundle.resolveAsset, dispose: bundle.dispose }
  }

  async function startDungeon() {
    if (replayFinishPromise) await replayFinishPromise
    if (replaySession && replayFinished) await replaySession?.restart?.()
    replayFinished = false
    replayFinishPromise = null

    const previousGame = game
    game = null
    hudRuntime = null
    pickupRuntime = null
    panelOpen = false
    touchInput?.stopMove()
    touchInput = null
    previousGame?.destroy(true)
    if (mount) mount.innerHTML = ''

    stats = initialDungeonStats()
    progress = initialDungeonProgress()
    eventText = ''
    gameOver = false
    ready = false
    error = ''

    try {
      const { Phaser, assets, vfxManifest } = await loadGameResources()
      if (!mounted) return

      const runGame = createDungeonGame({
        Phaser,
        parent: mount,
        assets,
        assetManifest: gameResources.assetManifest,
        resolveAsset: gameResources.resolveAsset,
        labels: { floor:(floor)=>t('floorTitle',{floor}), floorClear:()=>t('floorClear'), rarity:(rarity)=>rarityName(rarity), affix:(id,value,tier)=>formatAffixLabel({id,value,tier},locale) },
        onStats(next) { stats = { ...stats, ...next }; hudRuntime?.update() },
        onEvent,
      })
      game = runGame
      requestAnimationFrame(() => { syncGameViewport(); requestAnimationFrame(syncGameViewport) })

      let attempts = 0
      const installRuntime = () => {
        if (!mounted || game !== runGame) return
        const scene = runGame.scene?.getScene?.('Dungeon')
        if (!scene) { if (attempts++ < 60) requestAnimationFrame(installRuntime); return }

        scene.captureDungeonEvent = recordDungeonReplayEvent
        installDungeonPresentationStack(scene, { vfxManifest })

        if (!scene.__comparisonCard) {
          scene.__comparisonCard = createComparisonCard(scene, { getLocale:()=>locale, label:(key)=>t(({ground:'ground',current:'current',dungeonBlade:'dungeonBlade',emptyWeapon:'emptyWeapon',equip:'equip'})[key]??key), rarityName })
        }

        scene.__dungeonInventoryStats = (count) => { stats = { ...stats, healthPotions: count }; hudRuntime?.update() }
        pickupRuntime = installPickupInteraction(scene, { getLocale: () => locale, onSelection(next) { scene.__comparisonCard?.setSelection(next) } })

        if (!scene.__infiniteDungeon) {
          scene.__infiniteDungeon = installInfiniteDungeon(scene, {
            onProgress(next) { progress = next; hudRuntime?.update() },
            onEvent,
            label:(key)=>t(({floor:'floor',chapter:'chapter',floorClear:'floorClear',restTitle:'restTitle',restComplete:'restComplete','rest.recover':'restRecover','rest.temper':'restTemper','rest.fortune':'restFortune'})[key]??key),
          })
        }

        installDungeonSpatial(scene, { getProgress:()=>scene.__infiniteDungeon?.getProgress?.()??progress, onEvent, label:(key)=>t(key) })
        installDungeonAttackRuntime(scene)
        installDungeonBacktracking(scene, { onProgress(next) { progress = next; hudRuntime?.update() } })
        installDungeonReplayEventCapture(scene)
        touchInput = installDungeonTouchInput(scene)
        hudRuntime = installDungeonHud(scene, { getStats:()=>stats, getProgress:()=>progress, getLabels:hudLabels, onPotion:()=>usePotion(), onDetails:()=>togglePanel() })
        syncGameViewport()
        ready = true
        recordDungeonReplay(true)
      }

      installRuntime()
    } catch (cause) {
      console.error(cause)
      error = cause?.message || 'Failed to start dungeon'
    }
  }

  onMount(() => {
    mounted = true
    unsubscribeLocale = subscribeLocale(applyLocale)

    const observer = new ResizeObserver(syncGameViewport)
    if (stageShell) observer.observe(stageShell)
    window.addEventListener('resize', syncGameViewport)
    void setupDungeonReplay()
    void startDungeon()

    return () => {
      mounted = false
      gameResources?.dispose?.()
      if (replayTimer) clearInterval(replayTimer)
      const session = replaySession
      replaySession = null
      if (session) {
        if (replayFinishPromise) {
          void replayFinishPromise.finally(() => session.destroy())
        } else if (!replayFinished) {
          const state = dungeonReplayState()
          replayFinished = true
          if (state) void finalizeReplaySession(session, state).catch(() => false)
          else session.destroy()
        } else {
          session.destroy()
        }
      }
      cancelAnimationFrame(viewportFrame)
      observer.disconnect()
      window.removeEventListener('resize', syncGameViewport)
      unsubscribeLocale()
      touchInput?.stopMove()
      game?.destroy(true)
      hudRuntime = null
      game = null
    }
  })
</script>

<svelte:head><title>{t('title')} · AQI Arcade</title></svelte:head>

<main class="page">
  <header class="topbar">
    <div class="title-copy"><a href="/" class="brand">AQI ARCADE</a><h1>{t('title')}</h1><p>{t('subtitle')}</p></div>
    <div class="actions">
      <button class:active={locale==='zh-CN'} on:click={()=>setLocale('zh-CN')}>中文</button><button class:active={locale==='en'} on:click={()=>setLocale('en')}>EN</button><a href="/">{t('back')}</a>
    </div>
  </header>

  <section bind:this={stageShell} class="stage-shell">
    <div bind:this={mount} class="stage"></div>
    <div bind:this={gameViewport} class="game-viewport">
      {#if !gameOver && !panelOpen}<div class="touch-controls" aria-hidden="true"><div class="joystick-slot"><VirtualJoystick on:move={handleJoystickMove}/></div><div class="touch-actions"><button class="touch-button interact" on:pointerdown={triggerInteract}>{t('touchInteract')}</button><button class="touch-button skill" on:pointerdown={triggerSkill}>{t('touchSkill')}</button></div></div>{/if}
      {#if !ready && !error}<div class="overlay">{loadingLabel}</div>{/if}
      {#if error}<div class="overlay error">{error}</div>{/if}

      {#if panelOpen}
        <div class="stats-overlay" role="dialog" aria-modal="true" aria-label={t('details')}>
          <div class="stats-panel">
            <div class="pause-mark">II · {t('paused')}</div>
            <div class="weapon-title"><div><span>{t('current')}</span><h2 class:common={stats.weaponRarity==='common'} class:uncommon={stats.weaponRarity==='uncommon'} class:rare={stats.weaponRarity==='rare'} class:epic={stats.weaponRarity==='epic'} class:legendary={stats.weaponRarity==='legendary'}>{stats.weapon ? `${rarityName(stats.weaponRarity)} · ${weaponModel.archetypeLabel ?? t('weapon')} · ${weaponModel.name ?? t('dungeonBlade')}` : t('emptyWeapon')}</h2></div><button class="close" on:click={()=>setPanel(false)}>×</button></div>
            <div class="stat-grid"><div><span>{t('baseDamage')}</span><strong>{weaponModel.damage}</strong></div><div><span>{t('totalDamage')}</span><strong>{stats.damage}</strong></div><div><span>{t('hp')}</span><strong>{stats.hp}/{stats.maxHp}</strong></div><div><span>{t('potion')}</span><strong class="potion-count"><span class="potion-bottle small" aria-hidden="true"></span> × {stats.healthPotions??0}</strong></div></div>
            <div class="affix-box"><span>{t('affixes')}</span>{#if weaponModel.affixes.length}<div class="affix-list">{#each weaponModel.affixes as affix}<div>◆ {affix}</div>{/each}</div>{:else}<p>{t('noAffixes')}</p>{/if}</div>
            <div class="panel-actions"><button class="use-potion" disabled={(stats.healthPotions??0)<=0} on:click={usePotion}><span class="potion-bottle small" aria-hidden="true"></span>{t('usePotion')} · {stats.healthPotions??0}</button><button class="resume" on:click={()=>setPanel(false)}>{t('close')}</button></div>
          </div>
        </div>
      {/if}

      {#if gameOver}<div class="gameover-overlay"><div class="gameover-panel" role="dialog" aria-modal="true"><div class="gameover-kicker">RUN ENDED</div><h2>{t('runEnded')}</h2><div class="run-stats"><div><span>{t('floor')}</span><strong>{runSummary.floor}</strong></div><div><span>{t('kills')}</span><strong>{runSummary.kills}</strong></div></div><div class="run-weapon"><span>{t('weapon')}</span><strong>{runSummary.weapon ? `${rarityName(runSummary.rarity)} · ${weaponModel.archetypeLabel ?? t('weapon')} · ${weaponModel.name ?? t('dungeonBlade')} +${runSummary.damage}` : t('none')}</strong></div><div class="gameover-actions"><a href="/">{t('back')}</a><button on:click={startDungeon}>{t('restart')}</button></div></div></div>{/if}
    </div>
  </section>

  <footer><span>{eventText || t('subtitle')}</span><span>{t('asset')}</span></footer>
</main>

<style>
  :global(html),:global(body){margin:0;width:100%;height:100%;overflow:hidden;background:#080a0d}
  :global(body){color:#f4f0e8;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  .page{height:100dvh;padding:12px;box-sizing:border-box;display:grid;grid-template-rows:auto minmax(0,1fr) auto;gap:9px;overflow:hidden}
  .topbar{width:min(1180px,100%);margin:0 auto;display:flex;justify-content:space-between;gap:20px;align-items:center;min-height:46px}
  .title-copy{min-width:0}.brand{color:#c1ff56;text-decoration:none;font-size:10px;font-weight:900;letter-spacing:.18em}.topbar h1{display:inline;margin:0 0 0 12px;font-size:22px;letter-spacing:-.04em}.topbar p{display:inline;margin:0 0 0 12px;color:#6f7882;font-size:11px;white-space:nowrap}
  .actions{display:flex;gap:6px;align-items:center;flex:0 0 auto}.actions button,.actions a{height:30px;padding:0 9px;border:0;background:#111419;color:#89939e;font:inherit;font-size:10px;display:inline-flex;align-items:center;text-decoration:none;cursor:pointer}.actions button.active{background:#182017;color:#c1ff56}
  .stage-shell{position:relative;align-self:stretch;justify-self:center;width:min(1180px,100%);height:100%;min-height:0;background:#050608;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;overscroll-behavior:contain;box-shadow:0 14px 38px rgba(0,0,0,.3)}
  .stage{position:absolute;inset:0;overflow:hidden;display:flex;align-items:center;justify-content:center}.stage :global(canvas){display:block!important;max-width:100%!important;max-height:100%!important;margin:auto!important;touch-action:none}
  .game-viewport{position:absolute;z-index:30;left:0;top:0;width:100%;height:100%;overflow:hidden;pointer-events:none}
  .potion-bottle{position:relative;display:inline-block;width:15px;height:18px;flex:0 0 auto;border-radius:3px 3px 6px 6px;background:#b92f43;box-shadow:inset 0 -5px 0 rgba(82,12,25,.42),0 2px 7px rgba(0,0,0,.36)}.potion-bottle::before{content:"";position:absolute;left:4px;top:-5px;width:7px;height:6px;border-radius:2px 2px 1px 1px;background:#c9bea5;box-shadow:inset 0 -2px 0 rgba(0,0,0,.25)}.potion-bottle::after{content:"";position:absolute;left:3px;top:4px;width:3px;height:6px;border-radius:2px;background:rgba(255,210,214,.52)}.potion-bottle.small{width:12px;height:15px;border-radius:3px 3px 5px 5px}.potion-bottle.small::before{left:3px;top:-4px;width:6px;height:5px}.potion-bottle.small::after{left:2px;top:3px;width:2px;height:5px}
  .common{color:#f4f0e8}.uncommon{color:#70ff9f}.rare{color:#67a8ff}.epic{color:#c984ff}.legendary{color:#ffb347}
  .touch-controls{display:none;position:absolute;inset:0;z-index:45;pointer-events:none}.joystick-slot{position:absolute;left:16px;bottom:42px;pointer-events:auto}.touch-actions{position:absolute;right:16px;bottom:42px;display:flex;align-items:flex-end;gap:12px;pointer-events:auto}.touch-button{width:72px;height:72px;border-radius:50%;border:1px solid rgba(244,240,232,.38);background:rgba(15,18,23,.68);color:#f4f0e8;font:800 10px ui-monospace,monospace;touch-action:manipulation;box-shadow:0 5px 15px rgba(0,0,0,.28)}.touch-button.skill{width:84px;height:84px;color:#d7c4ff;border-color:rgba(201,132,255,.64);background:rgba(74,38,96,.62)}.touch-button.interact{color:#c1ff56;border-color:rgba(193,255,86,.55)}
  .overlay{position:absolute;inset:0;display:grid;place-items:center;background:#0b0d10;color:#c1ff56;font-family:ui-monospace,monospace;font-weight:800;z-index:60;pointer-events:auto}.overlay.error{color:#ff6875;padding:32px;text-align:center}
  .stats-overlay,.gameover-overlay{position:absolute;inset:0;z-index:80;display:grid;place-items:center;padding:18px;background:rgba(3,4,6,.74);backdrop-filter:blur(4px);pointer-events:auto}.stats-panel,.gameover-panel{width:min(520px,calc(100% - 20px));box-sizing:border-box;padding:22px;background:rgba(14,18,23,.96);box-shadow:0 20px 55px rgba(0,0,0,.55);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.pause-mark{color:#c1ff56;font-size:9px;font-weight:900;letter-spacing:.18em}.weapon-title{display:flex;justify-content:space-between;gap:20px;align-items:start;margin-top:10px}.weapon-title span,.affix-box>span,.stat-grid span,.run-stats span,.run-weapon span{display:block;color:#68737f;font-size:9px;letter-spacing:.12em;text-transform:uppercase}.weapon-title h2{margin:5px 0 0;font-size:24px}.close{width:42px;height:42px;border:0;background:#1a2028;color:#d8dde2;font-size:24px;cursor:pointer}.stat-grid{display:grid;grid-template-columns:repeat(4,1fr);margin-top:18px;background:#090c10}.stat-grid>div{padding:12px;border-right:1px solid rgba(71,80,91,.45)}.stat-grid>div:last-child{border:0}.stat-grid strong{display:block;margin-top:4px;font-size:16px}.potion-count{display:flex!important;align-items:center;gap:6px}.affix-box{margin-top:12px;padding:14px;background:#090c10}.affix-list{display:grid;gap:7px;margin-top:9px;color:#cbd3dc;font-size:12px}.affix-box p{margin:8px 0 0;color:#65707c;font-size:11px}.panel-actions{display:grid;grid-template-columns:1fr 1.25fr;gap:10px;margin-top:16px}.panel-actions button,.gameover-actions button,.gameover-actions a{min-height:50px;border:0;font:900 11px ui-monospace,monospace;letter-spacing:.05em;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;text-decoration:none}.use-potion{background:#2a1319;color:#ff8993}.use-potion:disabled{opacity:.35}.resume{background:#c1ff56;color:#080a0d}.gameover-kicker{color:#ff6875;font-size:10px;font-weight:900;letter-spacing:.18em}.gameover-panel h2{margin:8px 0 16px}.run-stats{display:grid;grid-template-columns:1fr 1fr;background:#090c10}.run-stats>div,.run-weapon{padding:13px}.run-stats strong,.run-weapon strong{display:block;margin-top:4px}.run-weapon{margin-top:10px;background:#090c10}.gameover-actions{display:grid;grid-template-columns:1fr 1.35fr;gap:10px;margin-top:16px}.gameover-actions a{background:#171b21;color:#aab2bb}.gameover-actions button{background:#c1ff56;color:#080a0d}
  footer{width:min(1180px,100%);margin:0 auto;display:flex;justify-content:space-between;gap:20px;color:#5f6872;font-size:10px;line-height:16px;min-height:16px}
  @media(any-pointer:coarse){.touch-controls{display:block}}
  @media(max-width:900px){.topbar p{display:none}}
  @media(max-width:720px){
    .page{padding:max(6px,env(safe-area-inset-top)) max(6px,env(safe-area-inset-right)) max(6px,env(safe-area-inset-bottom)) max(6px,env(safe-area-inset-left));grid-template-rows:auto minmax(0,1fr);gap:5px}
    .topbar{min-height:32px;gap:8px}.topbar h1,.topbar p{display:none}.brand{font-size:9px}.actions{gap:3px}.actions button,.actions a{height:28px;padding:0 7px;background:rgba(17,20,25,.76);font-size:9px}
    .stage-shell{width:100%;height:100%;box-shadow:none}
    .stats-overlay,.gameover-overlay{padding:8px;align-items:end}.stats-panel,.gameover-panel{width:100%;padding:16px}.stat-grid{grid-template-columns:1fr 1fr}.stat-grid>div{border-bottom:1px solid rgba(71,80,91,.4)}.panel-actions{grid-template-columns:1fr}.panel-actions button{min-height:52px}.resume{order:-1}.touch-button{width:64px;height:64px}.touch-button.skill{width:76px;height:76px}.joystick-slot{left:10px;bottom:34px}.touch-actions{right:10px;bottom:34px;gap:9px}footer{display:none}
  }
  @media(max-height:520px){.topbar h1,.topbar p,footer{display:none}.topbar{min-height:28px}.page{padding:5px;gap:4px;grid-template-rows:auto minmax(0,1fr)}}
</style>
