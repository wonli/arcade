import { weaponComparisonModel } from './presentation.js'
import { buildHint } from './build-profile.js'

const RARITY_COLORS = {
  common: '#f4f0e8',
  uncommon: '#70ff9f',
  rare: '#67a8ff',
  epic: '#c984ff',
  legendary: '#ffb347',
}

export function comparisonCardPosition(
  player,
  cardSize = { width: 230, height: 330 },
  viewport = { width: 960, height: 600 },
) {
  const margin = 12
  const gap = 20
  const rightX = player.x + gap
  const leftX = player.x - cardSize.width - gap
  const fitsRight = rightX + cardSize.width <= viewport.width - margin
  const side = fitsRight || leftX < margin ? 'right' : 'left'
  const rawX = side === 'right' ? rightX : leftX
  const rawY = player.y - cardSize.height - 18

  return {
    x: Math.max(margin, Math.min(viewport.width - cardSize.width - margin, rawX)),
    y: Math.max(margin, Math.min(viewport.height - cardSize.height - margin, rawY)),
    side,
  }
}

function marker(direction, locale) {
  if (direction === 'up') return ' ↑'
  if (direction === 'down') return ' ↓'
  if (direction === 'new') return locale === 'zh-CN' ? ' 新' : ' NEW'
  if (direction === 'lost') return locale === 'zh-CN' ? ' 失去' : ' LOST'
  return ''
}

function rarityColor(rarity) {
  return RARITY_COLORS[rarity] ?? '#f4f0e8'
}

function identityText(model, fallback) {
  const identity = [model?.archetypeLabel, model?.name].filter(Boolean).join(' · ')
  return identity || fallback
}

function addText(scene, container, x, y, text, style = {}) {
  const node = scene.add.text(x, y, text, {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: style.fontSize ?? '11px',
    fontStyle: style.fontStyle ?? 'normal',
    color: style.color ?? '#aeb8c2',
    lineSpacing: 3,
  }).setOrigin(0, 0)

  container.add(node)
  return node
}

export function createComparisonCard(
  scene,
  { getLocale = () => 'en', label = (key) => key, rarityName = (rarity) => rarity } = {},
) {
  if (!scene) return { setSelection() {}, destroy() {} }

  const cardSize = { width: 230, height: 330 }
  let selection = null
  let container = null

  const clear = () => {
    container?.destroy(true)
    container = null
  }

  const render = () => {
    clear()
    if (!selection) return

    const locale = getLocale()
    const model = weaponComparisonModel(selection.current, selection.candidate, locale)
    container = scene.add.container(0, 0).setDepth(76)
    container.add(
      scene.add
        .rectangle(0, 0, cardSize.width, cardSize.height, 0x080a0d, 0.96)
        .setOrigin(0, 0)
        .setStrokeStyle(1, 0x59636f, 0.95),
    )

    let y = 12
    addText(scene, container, 12, y, label('ground'), { fontSize: '9px', color: '#6f7c88' })
    y += 18

    addText(
      scene,
      container,
      12,
      y,
      `${rarityName(model.candidate.rarity)} ${identityText(model.candidate, label('dungeonBlade'))}`,
      {
        fontSize: '13px',
        fontStyle: 'bold',
        color: rarityColor(model.candidate.rarity),
      },
    )
    y += 20

    const candidateBuild = buildHint(selection.candidate)
    if (candidateBuild) {
      addText(scene, container, 12, y, `◆ ${candidateBuild}`, {
        fontSize: '10px',
        fontStyle: 'bold',
        color: '#ffd56a',
      })
      y += 18
    }

    const delta = model.candidate.damageDelta
    const deltaText = delta > 0 ? ` ↑ +${delta}` : delta < 0 ? ` ↓ ${delta}` : ' ='
    addText(scene, container, 12, y, `${model.candidate.damage} DMG${deltaText}`, {
      fontStyle: 'bold',
      color: delta >= 0 ? '#70ff9f' : '#ff7b84',
    })
    y += 21

    for (const affix of model.candidate.affixes.slice(0, 5)) {
      addText(scene, container, 12, y, `${affix.label}${marker(affix.direction, locale)}`, {
        fontSize: '10px',
        fontStyle: affix.build ? 'bold' : 'normal',
        color: affix.build ? '#ffd56a' : affix.direction === 'down' ? '#ff7b84' : '#aeb8c2',
      })
      y += 17
    }

    y = Math.max(y + 6, 174)
    container.add(
      scene.add.rectangle(12, y, cardSize.width - 24, 1, 0x2b333c, 1).setOrigin(0, 0),
    )
    y += 10

    addText(scene, container, 12, y, label('current'), { fontSize: '9px', color: '#6f7c88' })
    y += 18

    if (model.current) {
      addText(
        scene,
        container,
        12,
        y,
        `${rarityName(model.current.rarity)} ${identityText(model.current, label('dungeonBlade'))}`,
        {
          fontSize: '12px',
          fontStyle: 'bold',
          color: rarityColor(model.current.rarity),
        },
      )
      y += 18

      const currentBuild = buildHint(selection.current)
      if (currentBuild) {
        addText(scene, container, 12, y, `◆ ${currentBuild}`, {
          fontSize: '9px',
          color: '#c8a958',
        })
        y += 16
      }

      addText(scene, container, 12, y, `${model.current.damage} DMG`, {
        fontStyle: 'bold',
        color: '#f4f0e8',
      })
      y += 19

      for (const affix of model.current.affixes.slice(0, 4)) {
        addText(scene, container, 12, y, `${affix.label}${marker(affix.direction, locale)}`, {
          fontSize: '10px',
          color: affix.build ? '#ffd56a' : affix.direction === 'lost' ? '#ff7b84' : '#8f9aa5',
        })
        y += 16
      }
    } else {
      addText(scene, container, 12, y, label('emptyWeapon'), { color: '#697582' })
    }

    addText(scene, container, 12, cardSize.height - 28, `[E] ${label('equip')}`, {
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#c1ff56',
    })
  }

  const syncPosition = () => {
    if (!container || !scene.playerState) return
    const position = comparisonCardPosition(scene.playerState, cardSize, {
      width: scene.scale?.width ?? 960,
      height: scene.scale?.height ?? 600,
    })
    container.setPosition(position.x, position.y)
  }

  scene.events?.on?.('update', syncPosition)

  return {
    setSelection(next) {
      selection = next
      render()
      syncPosition()
    },
    refresh() {
      if (!selection) return
      render()
      syncPosition()
    },
    destroy() {
      scene.events?.off?.('update', syncPosition)
      clear()
      selection = null
    },
  }
}
