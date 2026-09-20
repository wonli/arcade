import { dungeon3Rules } from './dungeon3-rules.js'

const TILESET_ROOT = '/assets/dungeon-tileset/dungeon-pixel-tileset-for-rpg-and-roguelike-game/Tiled_files/'

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function cellsFromRef(ref) {
  return [{ x: 0, y: 0, ...clone(ref) }]
}

function entry(key, label, kind, motif, semantic, allowedRotations = [0], paletteGroup = undefined) {
  const cells = clone(motif.cells)
  const first = cells[0]
  const tileset = dungeon3Rules.tilesets[first.tileset]
  return {
    key,
    label,
    kind,
    width: motif.width,
    height: motif.height,
    image: `${TILESET_ROOT}${tileset.image}`,
    columns: tileset.columns,
    cells,
    allowedRotations,
    semantic,
    sourceId: motif.id,
    source: clone(motif.source ?? {}),
    ...(paletteGroup ? { paletteGroup } : {}),
  }
}

function oneCell(key, label, kind, ref, semantic, allowedRotations = [0]) {
  return entry(key, label, kind, { width: 1, height: 1, cells: cellsFromRef(ref) }, semantic, allowedRotations)
}

function archesColumnMotif(column) {
  return {
    id: `Arches_columns-wall-cap-${column}`,
    width: 1,
    height: 3,
    source: { atlas: 'Arches_columns.png', x: column, y: 10 },
    cells: [10, 11, 12].map((row) => ({
      x: 0,
      y: row - 10,
      tileset: 'Arches_columns',
      tileId: row * 20 + column,
      flipX: false,
      flipY: false,
      flipDiagonal: false,
    })),
  }
}

export function listDungeon3RoomAssets() {
  const stairs = dungeon3Rules.motifs.stairs.find((motif) => motif.width === 5 && motif.height === 3) ?? dungeon3Rules.motifs.stairs[0]
  const flatBridge = {
    id: 'flat-bridge-deck',
    width: 1,
    height: 1,
    cells: cellsFromRef(dungeon3Rules.floorSkins[0].center),
  }
  const wallCaps = Array.from({ length: 18 }, (_, index) => {
    const column = index + 1
    return entry(
      `wall-cap.${String(index + 1).padStart(2, '0')}`,
      `墙端堵头·${String(index + 1).padStart(2, '0')}`,
      'wall',
      archesColumnMotif(column),
      `wall-cap:Arches_columns:${column}`,
      [0, 180],
      'wall-caps',
    )
  })

  const assets = [
    entry('wall.vertical.west', '竖墙·左边缘', 'wall', dungeon3Rules.assemblies.wallVerticalWest, 'wall-vertical-west'),
    entry('wall.vertical.east', '竖墙·右边缘', 'wall', dungeon3Rules.assemblies.wallVerticalEast, 'wall-vertical-east'),
    entry('wall.vertical.body', '竖墙·中段', 'wall', dungeon3Rules.assemblies.wallVerticalBody, 'wall-vertical-body'),
    entry('wall.horizontal', '横墙段', 'wall', dungeon3Rules.assemblies.wall, 'wall-horizontal'),
    entry('door.closed', '门·关闭', 'door', dungeon3Rules.assemblies.door, 'door-closed', [0, 180]),
    entry('door.open', '门·开启', 'door', dungeon3Rules.assemblies.doorOpen, 'door-open', [0, 180]),
    oneCell('water.body', '开阔水面', 'water', dungeon3Rules.water.body, 'water-body'),
    oneCell('water.edge.n', '水岸·北缘', 'water', dungeon3Rules.water.coast.n, 'water-coast-n'),
    oneCell('water.edge.w', '水岸·西缘', 'water', dungeon3Rules.water.coast.w, 'water-coast-w'),
    entry('stairs.default', '楼梯', 'stairs', stairs, 'stairs', [0, 180]),
    entry('bridge.flat', '平桥桥面', 'bridge', flatBridge, 'water-bridge-flat', [0, 90, 180, 270]),
    entry('bridge.arch', '拱桥·Arches_columns', 'bridge', dungeon3Rules.assemblies.bridgeArch, 'water-bridge-arch', [0, 180]),
    ...wallCaps,
  ]

  const addAssembly = (key, label, kind, semantic) => {
    const motif = dungeon3Rules.assemblies[key]
    if (motif?.cells?.length) assets.push(entry(`assembly.${key}`, label, kind, motif, semantic))
  }
  addAssembly('statue', '火焰雕像', 'object', 'statue-fire')
  addAssembly('spikes', '尖刺组', 'object', 'spikes')
  addAssembly('waterSmall', '水面细节·小', 'water-detail', 'water-detail-small')
  addAssembly('waterLong', '水面细节·长', 'water-detail', 'water-detail-long')
  addAssembly('waterFoam', '水面细节·泡沫', 'water-detail', 'water-detail-foam')
  addAssembly('underwaterRuin', '水下遗迹', 'water-detail', 'underwater-ruin')
  addAssembly('waterRipple', '水面波纹', 'water-detail', 'water-ripple')
  addAssembly('floorTrap', '地面陷阱', 'object', 'floor-trap')
  addAssembly('wallTrap', '墙面陷阱', 'object', 'wall-trap')
  addAssembly('terrace', '台阶墙面', 'wall', 'terrace')

  const addMotifs = (group, label, kind, semantic, allowedRotations = [0]) => {
    for (const [index, motif] of dungeon3Rules.motifs[group].entries()) {
      if (!motif?.cells?.length) continue
      if (group === 'arches' && motif.id === dungeon3Rules.assemblies.bridgeArch?.id) continue
      if (group === 'stairs' && motif.id === stairs.id) continue
      assets.push(entry(`${semantic}.${String(index + 1).padStart(2, '0')}`, `${label}·${String(index + 1).padStart(2, '0')}`, kind, motif, `${semantic}:${motif.id}`, allowedRotations, group === 'arches' ? 'arches' : undefined))
    }
  }
  addMotifs('coffins', '棺材', 'object', 'coffin')
  addMotifs('otherObjects', '物件', 'object', 'object')
  addMotifs('arches', '拱券装饰', 'object', 'arch-decoration')
  addMotifs('candles', '烛台', 'object', 'candle')
  addMotifs('reliefs', '骷髅浮雕', 'object', 'relief')
  addMotifs('plates', '地面板块', 'floor', 'plate')
  addMotifs('stairs', '楼梯变体', 'stairs', 'stairs-variant', [0, 180])
  addMotifs('doors', '门体变体', 'door', 'door-variant', [0, 180])

  for (const [name, ref] of Object.entries(dungeon3Rules.water.coast)) {
    if (name === 'n' || name === 'w') continue
    assets.push(oneCell(`water.coast.${name}`, `水岸·${name}`, 'water', ref, `water-coast-${name}`))
  }
  for (const [index, ref] of dungeon3Rules.water.sheen.entries()) assets.push(oneCell(`water.sheen.${String(index + 1).padStart(2, '0')}`, `水面高光·${String(index + 1).padStart(2, '0')}`, 'water-detail', ref, 'water-sheen'))
  for (const [index, ref] of dungeon3Rules.water.southFoot.entries()) assets.push(oneCell(`water.south-foot.${String(index + 1).padStart(2, '0')}`, `水岸脚·${String(index + 1).padStart(2, '0')}`, 'water', ref, 'water-south-foot'))
  for (const name of ['innerNW', 'innerNE', 'innerSW', 'innerSE']) assets.push(oneCell(`water.inner.${name}`, `内凹水角·${name}`, 'water', dungeon3Rules.water[name], `water-inner-${name}`))
  for (const [name, motif] of Object.entries(dungeon3Rules.water.concaveSouth)) assets.push(entry(`water.concave.${name}`, `内凹水岸·${name}`, 'water', motif, `water-concave-${name}`))
  for (const [index, skin] of dungeon3Rules.floorSkins.entries()) assets.push(oneCell(`floor.skin.${index + 1}`, `地面皮肤·${index + 1}`, 'floor', skin.center, `floor-skin-${index + 1}`))

  return assets
}
