export const DUNGEON_MESSAGES = Object.freeze({
  'zh-CN': Object.freeze({
    title: '无尽地牢',
    subtitle: 'WASD 移动 · 自动普攻 · Space 主动技能 · E 交互/换装',
    hp: '生命', damage: '伤害', kills: '击杀', floor: '层数', chapter: '章节', room: '房间', weapon: '武器', none: '无',
    loading: '正在进入地牢…', back: '返回 Arcade', asset: 'Dungeon + Pixel VFX assets',
    pickupWeapon: '装备 {rarity} · {identity}，基础伤害 +{damage}。', pickupPotion: '生命药水恢复 {heal} 点生命。', storePotion: '生命药水已收入背包。',
    fullHealth: '生命值已满。', dropWeapon: '{rarity} · {identity} 掉落！', dropPotion: '生命药水掉落！', gameover: '本次探索结束。',
    runEnded: '探索终结', runSummary: '本次地牢记录', restart: '重新开始', skill: '主动技能命中 {hits} 个敌人。', skillHits: '技能 · 命中 {hits} 个敌人',
    floorTitle: '第 {floor} 层', floorClear: '本层已清空', floorStart: '进入第 {floor} 层。', portal: '出口已开启，进入绿色传送门。',
    dungeonBlade: '地牢之刃', rarityCommon: '普通', rarityUncommon: '精良', rarityRare: '稀有', rarityEpic: '史诗', rarityLegendary: '传奇',
    current: '当前装备', ground: '地上装备', equip: '装备', emptyWeapon: '未装备武器', combat: '战斗', elite: '精英', rest: '休息', boss: '首领',
    restTitle: '篝火休息', restComplete: '休整完成 · 出口已开启', restRecover: '恢复 50% 最大生命', restTemper: '强化当前武器', restFortune: '下一战利品品质提升',
    restEntered: '发现休息层，靠近篝火选择奖励。', restChoice: '已选择：{choice}', openChest: '打开宝箱', chestOpened: '宝箱开启！',
    touchSkill: '技能', touchInteract: '交互', potion: '药水', usePotion: '使用药水', details: '属性', close: '返回战斗',
    baseDamage: '武器伤害', totalDamage: '总伤害', affixes: '词缀', noAffixes: '暂无词缀', paused: '游戏已暂停',
    host: '房主', guest: '队友', players: '{count}/2 玩家', copyInvite: '复制邀请', inviteCopied: '邀请链接已复制',
    waitingPlayer: '等待玩家 · 分享 {room}', syncingDungeon: '正在同步地牢…', liveCoopLoadout: '实时联机 · 装备', currentWeapon: '当前武器',
    noHealthPotions: '没有生命药水', healthPotionUsed: '已使用生命药水', itemPickedUp: '已拾取物品', lootDropped: '战利品掉落',
    weaponDamage: '武器伤害', potions: '药水', backToGame: '返回游戏', onlineWorldContinues: '打开面板时，联机世界仍会继续运行。',
    coopStatus: '20Hz 玩家快照 · 房主权威世界状态', roomNotDungeon: '该房间不是 Dungeon 房间', failedJoinRoom: '加入 Dungeon 房间失败',
    closeLabel: '关闭', connectionConnecting: '连接中', connectionLive: '已连接', connectionOffline: '离线',
  }),
  en: Object.freeze({
    title: 'Endless Dungeon',
    subtitle: 'WASD move · auto attack · Space skill · E interact/equip',
    hp: 'HP', damage: 'Damage', kills: 'Kills', floor: 'Floor', chapter: 'Chapter', room: 'Room', weapon: 'Weapon', none: 'None',
    loading: 'Entering the dungeon…', back: 'Back to Arcade', asset: 'Dungeon + Pixel VFX assets',
    pickupWeapon: 'Equipped {rarity} · {identity}. Base damage +{damage}.', pickupPotion: 'Health potion restored {heal} HP.', storePotion: 'Health potion stored.',
    fullHealth: 'HP is already full.', dropWeapon: '{rarity} · {identity} dropped!', dropPotion: 'Health potion dropped!', gameover: 'Run ended.',
    runEnded: 'RUN ENDED', runSummary: 'DUNGEON RECORD', restart: 'Restart', skill: 'Active skill hit {hits} enemies.', skillHits: 'Skill · {hits} hits',
    floorTitle: 'FLOOR {floor}', floorClear: 'FLOOR CLEAR', floorStart: 'Entered floor {floor}.', portal: 'Exit portal opened. Step into the green portal.',
    dungeonBlade: 'Dungeon Blade', rarityCommon: 'Common', rarityUncommon: 'Uncommon', rarityRare: 'Rare', rarityEpic: 'Epic', rarityLegendary: 'Legendary',
    current: 'Equipped', ground: 'Ground Item', equip: 'Equip', emptyWeapon: 'No weapon equipped', combat: 'Combat', elite: 'Elite', rest: 'Rest', boss: 'Boss',
    restTitle: 'REST CAMP', restComplete: 'Rest complete · exit opened', restRecover: 'Recover 50% max HP', restTemper: 'Temper current weapon', restFortune: 'Improve next loot quality',
    restEntered: 'Rest floor found. Approach the camp to choose.', restChoice: 'Selected: {choice}', openChest: 'Open Chest', chestOpened: 'Chest opened!',
    touchSkill: 'SKILL', touchInteract: 'USE', potion: 'Potion', usePotion: 'Use potion', details: 'Stats', close: 'Resume',
    baseDamage: 'Weapon damage', totalDamage: 'Total damage', affixes: 'Affixes', noAffixes: 'No affixes', paused: 'GAME PAUSED',
    host: 'HOST', guest: 'GUEST', players: '{count}/2 PLAYERS', copyInvite: 'COPY INVITE', inviteCopied: 'Invite copied',
    waitingPlayer: 'WAITING FOR PLAYER · SHARE {room}', syncingDungeon: 'SYNCING DUNGEON…', liveCoopLoadout: 'LIVE CO-OP · LOADOUT', currentWeapon: 'CURRENT WEAPON',
    noHealthPotions: 'No health potions', healthPotionUsed: 'Health potion used', itemPickedUp: 'Item picked up', lootDropped: 'Loot dropped',
    weaponDamage: 'WEAPON DMG', potions: 'POTIONS', backToGame: 'BACK TO GAME', onlineWorldContinues: 'The online world keeps running while this panel is open.',
    coopStatus: '20Hz player snapshots · Host authoritative world state', roomNotDungeon: 'Room is not a Dungeon room', failedJoinRoom: 'Failed to join Dungeon room',
    closeLabel: 'Close', connectionConnecting: 'CONNECTING', connectionLive: 'LIVE', connectionOffline: 'OFFLINE',
  }),
})

export function normalizeDungeonLocale(locale) {
  const value = String(locale ?? '').trim().toLowerCase()
  return value.startsWith('zh') ? 'zh-CN' : 'en'
}

export function createDungeonTranslator(locale = 'en') {
  const normalized = normalizeDungeonLocale(locale)
  return (key, values = {}) => {
    let text = DUNGEON_MESSAGES[normalized]?.[key] ?? DUNGEON_MESSAGES.en[key] ?? key
    for (const [name, value] of Object.entries(values)) text = text.replaceAll(`{${name}}`, String(value))
    return text
  }
}

export function dungeonHudLabels(locale = 'en') {
  const normalized = normalizeDungeonLocale(locale)
  const t = createDungeonTranslator(normalized)
  return {
    locale: normalized,
    hp: t('hp'),
    weapon: t('weapon'),
    details: t('details'),
    none: t('none'),
    emptyWeapon: t('emptyWeapon'),
    dungeonBlade: t('dungeonBlade'),
    baseDamage: t('baseDamage'),
    floor: t('floor'),
    chapter: t('chapter'),
    combat: t('combat'),
    elite: t('elite'),
    rest: t('rest'),
    boss: t('boss'),
    'rarity:common': t('rarityCommon'),
    'rarity:uncommon': t('rarityUncommon'),
    'rarity:rare': t('rarityRare'),
    'rarity:epic': t('rarityEpic'),
    'rarity:legendary': t('rarityLegendary'),
  }
}
