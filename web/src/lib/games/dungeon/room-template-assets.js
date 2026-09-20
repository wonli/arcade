import { dungeon3Rules } from './dungeon3-rules.js'

const TILESET_ROOT = '/assets/dungeon-tileset/dungeon-pixel-tileset-for-rpg-and-roguelike-game/Tiled_files/'

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function cellsFromRef(ref) {
  return [{ x: 0, y: 0, ...clone(ref) }]
}

function entry(key, label, kind, motif, semantic, allowedRotations = [0]) {
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
  }
}

function oneCell(key, label, kind, ref, semantic, allowedRotations = [0]) {
  return entry(key, label, kind, { width: 1, height: 1, cells: cellsFromRef(ref) }, semantic, allowedRotations)
}

export function listDungeon3RoomAssets() {
  const stairs = dungeon3Rules.motifs.stairs.find((motif) => motif.width === 5 && motif.height === 3) ?? dungeon3Rules.motifs.stairs[0]
  const flatBridge = {
    width: 1,
    height: 1,
    cells: cellsFromRef(dungeon3Rules.floorSkins[0].center),
  }

  return [
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
  ]
}
