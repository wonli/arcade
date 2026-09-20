/** Rebuild with: node scripts/extract-dungeon3-rules.mjs. No runtime XML fetch. */
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { parseTiledMap } from '../web/src/lib/games/dungeon/tiled-map.js'
export const sourcePath = fileURLToPath(new URL('../web/static/assets/dungeon-tileset/dungeon-pixel-tileset-for-rpg-and-roguelike-game/Tiled_files/Dungeon3.tmx', import.meta.url))
const ref = (tileset, tileId) => ({ tileset, tileId, flipX:false, flipY:false, flipDiagonal:false })
const keys = ['nw','n','ne','w','center','e','sw','s','se']
const slice = (tileset, ids) => Object.fromEntries(keys.map((k,i)=>[k,ref(tileset,ids[i])]))
export function extractDungeon3Rules(xml) {
  const map = parseTiledMap(xml)
  const layers = Object.entries(map.layerGroups).flatMap(([name, group]) => group.map(layer=>({name,id:layer.id,cells:layer.chunks.flatMap(chunk=>chunk.gids.flatMap((gid,i)=>{
    const tile=map.decodeGid(gid)
    return tile?[{x:chunk.x+i%chunk.width,y:chunk.y+Math.floor(i/chunk.width),...tile}]:[]
  }))})))
  function motifs(tileset, layerPattern, minCells=1) {
    const result=[]
    for(const layer of layers.filter(l=>layerPattern.test(l.name))) {
      const remaining=new Map(layer.cells.filter(c=>c.tileset===tileset).map(c=>[`${c.x},${c.y}`,c]))
      while(remaining.size) {
        const queue=[remaining.values().next().value], cells=[]
        remaining.delete(`${queue[0].x},${queue[0].y}`)
        for(let i=0;i<queue.length;i++) {
          const c=queue[i]; cells.push(c)
          for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
            const key=`${c.x+dx},${c.y+dy}`, n=remaining.get(key)
            if(n){remaining.delete(key);queue.push(n)}
          }
        }
        if(cells.length<minCells)continue
        const x=Math.min(...cells.map(c=>c.x)),y=Math.min(...cells.map(c=>c.y))
        result.push({id:`${tileset}-${layer.id}-${x}-${y}`,width:Math.max(...cells.map(c=>c.x))-x+1,height:Math.max(...cells.map(c=>c.y))-y+1,source:{layer:layer.name,layerId:layer.id,x,y},cells:cells.map(c=>({...c,x:c.x-x,y:c.y-y})).sort((a,b)=>a.y-b.y||a.x-b.x)})
      }
    }
    return result
  }
  // Crops are spatial assemblies from the source, including cross-tileset walls.
  // Fail extraction when the source changes instead of silently emitting fragments.
  function crop(id, layerName, x, y, width, height) {
    const cells = layers.filter(l => l.name === layerName).flatMap(l => l.cells)
      .filter(c => c.x >= x && c.x < x + width && c.y >= y && c.y < y + height)
      .map(c => ({ ...c, x: c.x - x, y: c.y - y }))
    if (cells.length !== width * height) throw new Error(`Incomplete Dungeon3 assembly: ${id}`)
    return { id, width, height, source: { layer: layerName, x, y }, cells }
  }
  const arches = motifs('Arches_columns', /^Objects2$/, 4).filter(m => m.width <= 6 && m.height <= 6)
  const assemblies = {
    statue: crop('fire-statue', 'Objects1', -6, -1, 5, 5),
    spikes: crop('spike-bank', 'Objects0', -26, 11, 4, 1),
    waterSmall: crop('water-small', 'Water_details2', -17, -3, 3, 2),
    waterLong: crop('water-long', 'Water_details2', 5, -4, 7, 2),
    waterFoam: crop('water-foam', 'Water_details2', -15, 0, 4, 3),
    underwaterRuin: crop('submerged-masonry', 'Walls_under_water', -15, 0, 4, 1),
    waterRipple: crop('water-ripple', 'Water_details', -17, -2, 4, 2),
    wall: crop('wall-section', 'Walls2', 6, 15, 2, 3),
    // Keep each edge as the single-column strip from walls_floor.png. The
    // neighboring column belongs to the wall body/turn and must not be
    // included in an edge asset.
    wallVerticalWest: crop('wall-vertical-west', 'Walls2', -11, 12, 1, 6),
    wallVerticalEast: crop('wall-vertical-east', 'Walls2', -8, 12, 1, 6),
    wallVerticalBody: crop('wall-vertical-body', 'Walls2', -14, 19, 1, 3),
    door: crop('wall-door', 'Walls2', 4, 15, 2, 3),
    floorTrap: crop('floor-pressure-trap', 'Objects0', -22, 7, 2, 2),
    wallTrap: crop('wall-dragon-trap', 'Objects1', -12, 3, 2, 6),
    terrace: crop('terrace-face', 'Floor', -11, 9, 1, 2),
    bridgeArch: arches.find(m => m.width === 6 && m.height === 2 && m.cells.length === 12),
  }
  assemblies.doorOpen = {
    ...assemblies.door,
    id: 'wall-door-open',
    cells: assemblies.door.cells.map(cell => {
      const frames = map.tilesets[cell.tileset]?.animations?.[String(cell.tileId)] ?? []
      const openFrame = frames[Math.floor(frames.length / 2)]
      return openFrame ? { ...cell, tileId: openFrame.tileId } : { ...cell }
    }),
  }
  const coast=slice('Water_coasts_animation',[175,176,177,204,205,206,233,234,235])
  const detailLayers=['floor1_details','floor2_details','floor3_details']
  const floorSkins=['Floor','Floor2','Floor3'].map((name,i)=>({
    id:`dungeon3-floor-${i+1}`,sourceLayer:name,center:ref('walls_floor',138),
    // The TMX uses the same gray substrate at all three elevations.
    nineSlice:coast,
    details:[...new Map(layers.filter(l=>l.name===detailLayers[i]).flatMap(l=>l.cells).map(({x,y,...c})=>[JSON.stringify(c),c])).values()],
  }))
  return {
    version:1,
    provenance:{source:'Tiled_files/Dungeon3.tmx',sha256:createHash('sha256').update(xml).digest('hex'),tileWidth:map.tileWidth,tileHeight:map.tileHeight},
    tilesets:map.tilesets,
    floorSkins,
    assemblies,
    paving:slice('plates',[8,10,12,21,23,25,73,75,77]),
    floorDark:slice('walls_floor',[375,376,377,392,393,394,409,410,411]),
    water:{body:ref('Water_coasts_animation',871),sheen:[323,325,360,362].map(id=>ref('Water_detilazation',id)),coast,southFoot:[262,263,264].map(id=>ref('Water_coasts_animation',id)),
      innerNW:ref('Water_coasts_animation',268),innerNE:ref('Water_coasts_animation',266),
      innerSW:ref('Water_coasts_animation',152),innerSE:ref('Water_coasts_animation',150),
      concaveSouth:{
        sw:{id:'coast-concave-sw',width:1,height:3,source:{layer:'Floor2',x:10,y:19},cells:[152,181,210].map((id,y)=>({x:0,y,...ref('Water_coasts_animation',id)}))},
        se:{id:'coast-concave-se',width:1,height:3,source:{layer:'Floor',x:3,y:5},cells:[150,179,208].map((id,y)=>({x:0,y,...ref('Water_coasts_animation',id)}))},
      },
      description:'Coasts occupy LAND cells; the Water layer underneath uses tile 871. South edges need one additional cliff-foot tile in the water row below. All directions indicate the missing land neighbor. Southern concave transitions are three rows tall in the source: a land lip, a transition face, then its foot. The concaveSouth motifs use the lip as y=0; preserve all cells rather than treating the lip as a one-cell corner.'},
    motifs:{coffins:motifs('coffins',/^Objects/,4).filter(m=>m.cells.length===m.width*m.height),otherObjects:motifs('other_objects',/^Objects/),arches,candles:motifs('candles',/^Objects[56]$/,2).filter(m=>m.width<=6&&m.height<=6),reliefs:motifs('scull_bas-relief',/^Objects2$/,2).filter(m=>m.width<=6&&m.height<=6),plates:motifs('plates',/^plates/),stairs:motifs('stairs',/./,4),doors:motifs('doors',/^Walls/,2)},
  }
}
export function serializeDungeon3Rules(rules) {
  return `// Generated by scripts/extract-dungeon3-rules.mjs; do not hand edit.\nexport const dungeon3Data = ${JSON.stringify(rules)}\n`
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  writeFileSync(new URL('../web/src/lib/games/dungeon/dungeon3-data.js',import.meta.url),serializeDungeon3Rules(extractDungeon3Rules(readFileSync(sourcePath,'utf8'))))
}
