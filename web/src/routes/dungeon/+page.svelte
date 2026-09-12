<script>
  import { onMount } from 'svelte'
  import { createDungeonGame, chooseDungeonAssets } from '$lib/games/dungeon/scene.js'
  import { formatAffixLabel, weaponHudModel } from '$lib/games/dungeon/presentation.js'
  import { installAffixVisuals } from '$lib/games/dungeon/visuals.js'
  import { installPickupInteraction } from '$lib/games/dungeon/pickup-runtime.js'
  import { createComparisonCard } from '$lib/games/dungeon/comparison-runtime.js'
  import { installInfiniteDungeon } from '$lib/games/dungeon/infinite-runtime.js'
  import { installDungeonSpatial } from '$lib/games/dungeon/spatial-runtime.js'
  import { installDungeonAttackRuntime } from '$lib/games/dungeon/attack-runtime.js'
  import { installDungeonBacktracking } from '$lib/games/dungeon/backtrack-runtime.js'
  import { installDungeonVfx } from '$lib/games/dungeon/vfx-runtime.js'
  import { installDungeonTouchInput, joystickVector } from '$lib/games/dungeon/touch-runtime.js'
  import { loadPhaser } from '$lib/games/dungeon/phaser.js'

  const messages = {
    'zh-CN': {
      title: '无尽地牢', subtitle: 'WASD 移动 · 自动普攻 · Space 主动技能 · E 交互/换装', hp: '生命', damage: '伤害', kills: '击杀', floor: '层数', chapter: '章节', room: '房间', weapon: '武器', none: '无', loading: '正在进入地牢…', back: '返回 Arcade', asset: 'Dungeon + Pixel VFX assets', pickupWeapon: '装备{rarity}地牢之刃，基础伤害 +{damage}。', pickupPotion: '喝下生命药水，恢复 {heal} 点生命。', dropWeapon: '{rarity}装备掉落！', dropPotion: '生命药水掉落！', gameover: '本次探索结束。', skill: '主动技能命中 {hits} 个敌人。', floorTitle: '第 {floor} 层', floorClear: '本层已清空', floorStart: '进入第 {floor} 层。', portal: '出口已开启，进入绿色传送门。', dungeonBlade: '地牢之刃', rarityCommon: '普通', rarityUncommon: '精良', rarityRare: '稀有', rarityEpic: '史诗', current: '当前装备', ground: '地上装备', equip: '装备', emptyWeapon: '未装备武器', combat: '战斗', elite: '精英', rest: '休息', boss: '首领', restTitle: '篝火休息', restComplete: '休整完成 · 出口已开启', restRecover: '恢复 50% 最大生命', restTemper: '强化当前武器', restFortune: '下一战利品品质提升', restEntered: '发现休息层，靠近篝火选择奖励。', restChoice: '已选择：{choice}', openChest: '打开宝箱', chestOpened: '宝箱开启！', touchSkill: '技能', touchInteract: '交互'
    },
    en: {
      title: 'Endless Dungeon', subtitle: 'WASD move · auto attack · Space skill · E interact/equip', hp: 'HP', damage: 'Damage', kills: 'Kills', floor: 'Floor', chapter: 'Chapter', room: 'Room', weapon: 'Weapon', none: 'None', loading: 'Entering the dungeon…', back: 'Back to Arcade', asset: 'Dungeon + Pixel VFX assets', pickupWeapon: '{rarity} Dungeon Blade equipped. Base damage +{damage}.', pickupPotion: 'Health potion restored {heal} HP.', dropWeapon: '{rarity} equipment dropped!', dropPotion: 'Health potion dropped!', gameover: 'Run ended.', skill: 'Active skill hit {hits} enemies.', floorTitle: 'FLOOR {floor}', floorClear: 'FLOOR CLEAR', floorStart: 'Entered floor {floor}.', portal: 'Exit portal opened. Step into the green portal.', dungeonBlade: 'Dungeon Blade', rarityCommon: 'Common', rarityUncommon: 'Uncommon', rarityRare: 'Rare', rarityEpic: 'Epic', current: 'Equipped', ground: 'Ground Item', equip: 'Equip', emptyWeapon: 'No weapon equipped', combat: 'Combat', elite: 'Elite', rest: 'Rest', boss: 'Boss', restTitle: 'REST CAMP', restComplete: 'Rest complete · exit opened', restRecover: 'Recover 50% max HP', restTemper: 'Temper current weapon', restFortune: 'Improve next loot quality', restEntered: 'Rest floor found. Approach the camp to choose.', restChoice: 'Selected: {choice}', openChest: 'Open Chest', chestOpened: 'Chest opened!', touchSkill: 'SKILL', touchInteract: 'USE'
    }
  }

  let mount
  let game
  let ready = false
  let error = ''
  let locale = 'en'
  let stats = { hp: 100, maxHp: 100, damage: 10, kills: 0, weapon: null, weaponRarity: null, weaponDamage: 0, weaponAffixes: [] }
  let progress = { floor: 1, chapter: 1, chapterFloor: 1, chapterLength: 4, roomRole: 'combat', fortuneActive: false }
  let eventText = ''
  let touchInput = null
  let joystickX = 0
  let joystickY = 0

  const t = (key, values = {}) => {
    let text = messages[locale]?.[key] ?? messages.en[key] ?? key
    for (const [name, value] of Object.entries(values)) text = text.replace(`{${name}}`, value)
    return text
  }

  const rarityName = (rarity) => {
    const key = { common: 'rarityCommon', uncommon: 'rarityUncommon', rare: 'rarityRare', epic: 'rarityEpic' }[rarity]
    return key ? t(key) : ''
  }

  const roomName = (role) => t(role || 'combat')
  $: weaponModel = weaponHudModel(stats, locale)

  function setLocale(next) {
    locale = next
    localStorage.setItem('arcade.locale', next)
    game?.scene?.getScene?.('Dungeon')?.__comparisonCard?.refresh?.()
  }

  function onEvent(event) {
    const potion = event.item?.type === 'consumable.health_potion'
    if (event.type === 'pickup') eventText = potion ? t('pickupPotion', { heal: event.healed ?? 0 }) : t('pickupWeapon', { rarity: rarityName(event.item?.rarity), damage: event.item?.damage ?? 0 })
    if (event.type === 'drop') eventText = potion ? t('dropPotion') : t('dropWeapon', { rarity: rarityName(event.item?.rarity) })
    if (event.type === 'gameover') eventText = t('gameover')
    if (event.type === 'skill') eventText = t('skill', { hits: event.hits })
    if (event.type === 'floorstart') eventText = `${t('floorStart', { floor: event.floor })} · ${roomName(event.roomRole)}`
    if (event.type === 'floorclear') eventText = t('floorClear')
    if (event.type === 'portal') eventText = t('portal')
    if (event.type === 'rest') eventText = t('restEntered')
    if (event.type === 'restchoice') eventText = t('restChoice', { choice: t(`rest${event.choice[0].toUpperCase()}${event.choice.slice(1)}`) })
    if (event.type === 'chestopen') eventText = t('chestOpened')
  }

  function updateJoystick(event) {
    const target = event.currentTarget
    const vector = joystickVector(event.clientX, event.clientY, target.getBoundingClientRect())
    joystickX = vector.x * 34
    joystickY = vector.y * 34
    touchInput?.setMove(vector.x, vector.y)
  }

  function startJoystick(event) {
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    updateJoystick(event)
  }

  function stopJoystick(event) {
    event.preventDefault()
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture?.(event.pointerId)
    joystickX = 0
    joystickY = 0
    touchInput?.stopMove()
  }

  function triggerSkill(event) {
    event.preventDefault()
    touchInput?.triggerSkill()
  }

  function triggerInteract(event) {
    event.preventDefault()
    touchInput?.triggerInteract()
  }

  onMount(async () => {
    const saved = localStorage.getItem('arcade.locale')
    locale = saved || (navigator.language?.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en')

    try {
      const [Phaser, dungeonResponse, vfxResponse] = await Promise.all([
        loadPhaser(),
        fetch('/assets/debts/manifest.json').catch(() => null),
        fetch('/assets/vfx/manifest.json').catch(() => null),
      ])
      const manifest = dungeonResponse?.ok ? await dungeonResponse.json() : { png: [] }
      const vfxManifest = vfxResponse?.ok ? await vfxResponse.json() : { assets: [] }
      const assets = chooseDungeonAssets(manifest)
      game = createDungeonGame({
        Phaser,
        parent: mount,
        assets,
        labels: {
          floor: (floor) => t('floorTitle', { floor }),
          floorClear: () => t('floorClear'),
          rarity: (rarity) => rarityName(rarity),
          affix: (id, value, tier) => formatAffixLabel({ id, value, tier }, locale),
        },
        onStats(next) { stats = next },
        onEvent,
      })

      let attempts = 0
      const installRuntime = () => {
        const scene = game?.scene?.getScene?.('Dungeon')
        if (!scene) {
          if (attempts++ < 60) requestAnimationFrame(installRuntime)
          return
        }
        installAffixVisuals(scene)
        installDungeonVfx(scene, vfxManifest)
        if (!scene.__comparisonCard) {
          scene.__comparisonCard = createComparisonCard(scene, {
            getLocale: () => locale,
            label: (key) => {
              const map = { ground: 'ground', current: 'current', dungeonBlade: 'dungeonBlade', emptyWeapon: 'emptyWeapon', equip: 'equip' }
              return t(map[key] ?? key)
            },
            rarityName,
          })
        }
        installPickupInteraction(scene, { onSelection(next) { scene.__comparisonCard?.setSelection(next) } })
        if (!scene.__infiniteDungeon) {
          scene.__infiniteDungeon = installInfiniteDungeon(scene, {
            onProgress(next) { progress = next },
            onEvent,
            label: (key) => {
              const map = {
                floor: 'floor', chapter: 'chapter', floorClear: 'floorClear', restTitle: 'restTitle', restComplete: 'restComplete',
                'rest.recover': 'restRecover', 'rest.temper': 'restTemper', 'rest.fortune': 'restFortune',
              }
              return t(map[key] ?? key)
            },
          })
        }
        installDungeonSpatial(scene, {
          getProgress: () => scene.__infiniteDungeon?.getProgress?.() ?? progress,
          onEvent,
          label: (key) => t(key),
        })
        installDungeonAttackRuntime(scene)
        installDungeonBacktracking(scene, { onProgress(next) { progress = next } })
        touchInput = installDungeonTouchInput(scene)
      }
      installRuntime()
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
    <div><span>{t('floor')}</span><strong>{progress.floor}</strong></div>
    <div><span>{t('chapter')}</span><strong>{progress.chapter}</strong></div>
    <div><span>{t('room')}</span><strong class:elite={progress.roomRole === 'elite'} class:rest={progress.roomRole === 'rest'} class:boss={progress.roomRole === 'boss'}>{roomName(progress.roomRole)}</strong></div>
    <div class="weapon-cell">
      <span>{t('weapon')}</span>
      <strong class:common={stats.weaponRarity === 'common'} class:uncommon={stats.weaponRarity === 'uncommon'} class:rare={stats.weaponRarity === 'rare'} class:epic={stats.weaponRarity === 'epic'}>
        {stats.weapon ? `${rarityName(stats.weaponRarity)} ${t('dungeonBlade')} +${weaponModel.damage}` : t('none')}
      </strong>
    </div>
  </section>

  <section class="stage-shell">
    <div bind:this={mount} class="stage"></div>
    <div class="touch-controls" aria-hidden="true">
      <div class="joystick-zone" on:pointerdown={startJoystick} on:pointermove={updateJoystick} on:pointerup={stopJoystick} on:pointercancel={stopJoystick}>
        <div class="joystick-ring"></div>
        <div class="joystick-knob" style={`transform: translate(${joystickX}px, ${joystickY}px)`}></div>
      </div>
      <div class="touch-actions">
        <button class="touch-button interact" on:pointerdown={triggerInteract}>{t('touchInteract')}</button>
        <button class="touch-button skill" on:pointerdown={triggerSkill}>{t('touchSkill')}</button>
      </div>
    </div>
    {#if !ready && !error}<div class="overlay">{t('loading')}</div>{/if}
    {#if error}<div class="overlay error">{error}</div>{/if}
  </section>

  <footer>
    <span>{eventText || t('subtitle')}</span>
    <span>{t('asset')}</span>
  </footer>
</main>

<style>
  :global(body){margin:0;background:#080a0d;color:#f4f0e8;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.page{min-height:100vh;padding:20px;box-sizing:border-box}.topbar{width:min(1180px,100%);margin:0 auto 14px;display:flex;justify-content:space-between;gap:24px;align-items:flex-end}.brand{color:#c1ff56;text-decoration:none;font-size:11px;font-weight:900;letter-spacing:.18em}.topbar h1{margin:8px 0 3px;font-size:clamp(28px,5vw,48px);letter-spacing:-.05em}.topbar p{margin:0;color:#7e8792;font-size:13px}.actions{display:flex;gap:8px;align-items:center}.actions button,.actions a{height:34px;padding:0 11px;border:1px solid #30363f;background:#111419;color:#9aa4ae;font:inherit;font-size:11px;display:inline-flex;align-items:center;text-decoration:none;cursor:pointer}.actions button.active{border-color:#c1ff56;color:#c1ff56}.hud{width:min(1180px,100%);margin:0 auto 12px;display:grid;grid-template-columns:repeat(6,minmax(84px,1fr)) minmax(220px,1.6fr);border:1px solid #262c34;background:#101319}.hud>div{padding:10px 12px;border-right:1px solid #262c34}.hud>div:last-child{border-right:0}.hud span{display:block;color:#66717d;font-size:9px;text-transform:uppercase;letter-spacing:.12em}.hud strong{display:block;margin-top:3px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:14px}.hud strong.common{color:#f4f0e8}.hud strong.uncommon{color:#70ff9f}.hud strong.rare{color:#67a8ff}.hud strong.epic{color:#c984ff}.hud strong.elite{color:#c984ff}.hud strong.rest{color:#ffd27c}.hud strong.boss{color:#ff8d70}.stage-shell{position:relative;width:min(1180px,100%);aspect-ratio:16/10;margin:0 auto;border:1px solid #30363f;background:#0b0d10;box-shadow:14px 14px 0 #040506;overflow:hidden;touch-action:none}.stage{width:100%;height:100%}.stage :global(canvas){display:block;width:100%!important;height:100%!important}.touch-controls{display:none;position:absolute;inset:0;z-index:45;pointer-events:none;touch-action:none}.joystick-zone{position:absolute;left:max(18px,env(safe-area-inset-left));bottom:max(18px,env(safe-area-inset-bottom));width:132px;height:132px;border-radius:50%;pointer-events:auto;touch-action:none}.joystick-ring{position:absolute;inset:10px;border:2px solid rgba(193,255,86,.34);border-radius:50%;background:rgba(8,10,13,.38);box-shadow:inset 0 0 24px rgba(0,0,0,.38)}.joystick-knob{position:absolute;left:43px;top:43px;width:46px;height:46px;border-radius:50%;background:rgba(193,255,86,.78);border:2px solid rgba(244,240,232,.86);box-shadow:0 6px 18px rgba(0,0,0,.38);will-change:transform;pointer-events:none}.touch-actions{position:absolute;right:max(18px,env(safe-area-inset-right));bottom:max(22px,env(safe-area-inset-bottom));display:flex;align-items:flex-end;gap:14px;pointer-events:auto}.touch-button{width:76px;height:76px;border-radius:50%;border:2px solid rgba(244,240,232,.5);background:rgba(15,18,23,.7);color:#f4f0e8;font:800 11px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;touch-action:manipulation;user-select:none;-webkit-user-select:none;box-shadow:0 6px 18px rgba(0,0,0,.35)}.touch-button:active{transform:scale(.94)}.touch-button.skill{width:88px;height:88px;color:#d7c4ff;border-color:rgba(201,132,255,.82);background:rgba(74,38,96,.7)}.touch-button.interact{color:#c1ff56;border-color:rgba(193,255,86,.72)}.overlay{position:absolute;inset:0;display:grid;place-items:center;background:#0b0d10;color:#c1ff56;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:800;letter-spacing:.08em;z-index:60}.overlay.error{color:#ff6875;padding:32px;text-align:center}footer{width:min(1180px,100%);margin:16px auto 0;display:flex;justify-content:space-between;gap:20px;color:#67717c;font-size:11px}@media(any-pointer:coarse){.touch-controls{display:block}}@media(max-width:900px){.hud{grid-template-columns:repeat(3,1fr)}.weapon-cell{grid-column:1/-1}.hud>div{border-bottom:1px solid #262c34}}@media(max-width:720px){.page{padding:12px}.topbar{align-items:flex-start;flex-direction:column}.actions{flex-wrap:wrap}.stage-shell{aspect-ratio:4/5;box-shadow:8px 8px 0 #040506}footer{flex-direction:column}.topbar h1{font-size:34px}.joystick-zone{width:118px;height:118px}.joystick-ring{inset:8px}.joystick-knob{left:38px;top:38px;width:42px;height:42px}.touch-button{width:68px;height:68px}.touch-button.skill{width:80px;height:80px}}
</style>