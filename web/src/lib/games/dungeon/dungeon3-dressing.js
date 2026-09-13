import { dungeon3Rules as rules } from './dungeon3-rules.js'

const TILE = 16
const pick = (random, entries) => entries[Math.floor(random() * entries.length)]
const overlaps = (a,b) => a.x < b.x+b.width && a.x+a.width > b.x && a.y < b.y+b.height && a.y+a.height > b.y
const anchorArea = p => ({x:p.x-32,y:p.y-32,width:64,height:64})
const roomAnchors = g => [g.spawn,g.exit,g.rest,...g.spawnPoints,...g.chests]

function addPaving(g, room, kind, x, y, width, height) {
  g.pavingAreas.push({roomId:room.id,kind,x,y,width,height})
}

function floodArea(g, room, area) {
  const {columns,cells} = g.grid
  for (let y=area.y/TILE; y<(area.y+area.height)/TILE; y++) {
    for (let x=area.x/TILE; x<(area.x+area.width)/TILE; x++) {
      const cell=cells[y*columns+x]
      if (!cell || cell.kind!=='floor') continue
      cell.kind='water'
      cell.level=0
    }
  }
  room.inlets ??= []
  room.inlets.push(area)
}

// Themes own their landmark, hazard and route footprint before random clutter is
// considered. Every composition leaves the room centre and a broad route to it
// clear because spawn/exit/rest/encounter anchors all live there.
export function dressThemedRooms(g, random) {
  const coffinPool = rules.motifs.coffins.filter(m => m.width === 3 && m.height === 2)
  const addProp = (room,kind,motif,left,top,collision) => {
    g.decorations.push({kind,motif,roomId:room.id,x:left+motif.width*8,y:top+motif.height*8,
      footprint:{width:motif.width*TILE,height:motif.height*TILE},scale:'landmark',blocking:true,planned:true})
    g.solids.push({...collision,kind:'prop',authored:true,planned:true})
  }

  for (const room of g.rooms) {
    if (room.theme === 'shrine') {
      const motif = rules.assemblies.statue
      // Odd-width motifs must start on a tile boundary; the room centre itself
      // sits on a grid line, so centring by half the pixel width would shift all
      // five columns by eight pixels.
      const left = room.center.x - TILE*2
      const top = room.y + TILE
      // Statue_fire is one authored 5x5 composition. Keep all 25 cells inside
      // the room instead of letting a wall crop the upper-left fragment.
      addProp(room,'statue',motif,left,top,{
        x:left+TILE,y:top+(motif.height-1)*TILE,width:(motif.width-2)*TILE,height:TILE,
      })
      // A processional slab path uses the connected paving mask. It deliberately
      // overlaps the visual base of the statue and then runs to the south exit.
      addPaving(g,room,'processional',room.center.x-32,room.y+64,64,96)
      room.layout = {type:'altar',landmark:{x:left,y:top,width:motif.width*TILE,height:motif.height*TILE},safeLane:{x:room.center.x-32,y:room.y+80,width:64,height:80}}
      continue
    }

    if (room.theme === 'crypt') {
      // Two paired burial rows frame a deliberately empty centre aisle.
      const placements = [
        [room.x+32,room.y+32],[room.x+32,room.y+96],
        [room.x+room.width-80,room.y+32],[room.x+room.width-80,room.y+96],
      ]
      for (const [left,top] of placements) {
        const motif = pick(random,coffinPool)
        addProp(room,'coffin',motif,left,top,{x:left,y:top,width:48,height:32})
      }
      addPaving(g,room,'burial-aisle',room.center.x-48,room.y+32,96,128)
      room.layout = {type:'burial',safeLane:{x:room.center.x-48,y:room.y+24,width:96,height:136},groups:2}
      continue
    }

    if (room.theme === 'gauntlet') {
      // Build a contiguous 4x3 spike field on one side of the corridor. The
      // opposite half remains a straight, readable bypass for a radius-26 actor.
      const motif = rules.assemblies.spikes
      const left = room.x + TILE
      for (let row=0; row<3; row++) {
        const y = room.y + 48 + row*TILE
        const damageArea = {x:left,y,width:motif.width*TILE,height:TILE}
        if (roomAnchors(g).some(p=>overlaps(damageArea,anchorArea(p)))) continue
        g.traps.push({id:`spikes-${room.id}-${row}`,roomId:room.id,kind:'spikes',motif,
          x:left+motif.width*8,y:y+8,damageArea,animationOffset:row*300,planned:true})
      }
      addPaving(g,room,'gauntlet-bypass',room.center.x+16,room.y+32,64,128)
      room.layout = {type:'trap-corridor',hazardLane:{x:left,y:room.y+48,width:motif.width*TILE,height:TILE*3},safeLane:{x:room.center.x+16,y:room.y+24,width:64,height:136}}
      continue
    }

    if (room.theme === 'flooded') {
      // The generator already cuts two southern bites. Add an asymmetric north
      // pocket here so flooded rooms cannot collapse into the same rectangular pond.
      const extra = {x:room.x+TILE,y:room.y+TILE*2,width:TILE*2,height:TILE*2,kind:'inlet'}
      if (!(room.inlets ?? []).some(area=>overlaps(area,extra))) floodArea(g,room,extra)
      addPaving(g,room,'flooded-spine',room.center.x-32,room.y+32,64,128)
      room.layout = {type:'flood-basin',safeLane:{x:room.center.x-32,y:room.y+24,width:64,height:136}}
      continue
    }

    // Galleries are the only rooms where a loose coffin is part of the theme.
    if (room.theme === 'gallery') {
      const motif = pick(random,coffinPool)
      const left = room.x+room.width-80, top = room.y+32
      addProp(room,'coffin',motif,left,top,{x:left,y:top,width:48,height:32})
      room.layout = {type:'gallery',safeLane:{x:room.center.x-32,y:room.y+24,width:64,height:136}}
    }
  }
}

export function populateWater(g, random) {
  const {columns,rows,cells} = g.grid
  const water = (x,y) => x>=0&&y>=0&&x<columns&&y<rows&&cells[y*columns+x].kind==='water'
  const occupied = new Set()
  const variants = [rules.assemblies.waterRipple,rules.assemblies.waterFoam,rules.assemblies.waterLong,rules.assemblies.waterSmall]
  // A shuffled list yields clusters and quiet water instead of a repeated grid.
  const candidates = []
  for(let y=3;y<rows-2;y++) for(let x=3;x<columns-3;x++) if(water(x,y)) candidates.push({x,y,order:random()})
  candidates.sort((a,b)=>a.order-b.order)
  const place = (motif,layer,limit) => {
    let count=0
    for(const p of candidates) {
      if(count>=limit) break
      if(!motif.cells.every(c=>water(p.x+c.x,p.y+c.y)&&!occupied.has(`${p.x+c.x},${p.y+c.y}`))) continue
      g.waterFeatures.push({x:p.x*TILE,y:p.y*TILE,motif,layer,animationOffset:Math.floor(random()*6)*150})
      for(const c of motif.cells) occupied.add(`${p.x+c.x},${p.y+c.y}`)
      count++
    }
  }
  // Water gets several authored surface languages per floor rather than one
  // repeated ripple. Large/long motifs are attempted first so small details do
  // not consume every viable footprint.
  const detailLimit = Math.max(4,Math.floor(candidates.length/55))
  for(const motif of variants) place(motif,'water-detail',detailLimit)
  // Masonry is a separate underwater layer and can sit beneath moving ripples.
  occupied.clear()
  place(rules.assemblies.underwaterRuin,'underwater-ruin',Math.max(4,g.rooms.length+1))
}
