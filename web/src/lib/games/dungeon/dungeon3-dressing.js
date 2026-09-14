import { dungeon3Rules as rules } from './dungeon3-rules.js'

const TILE = 16
const pick = (random, entries) => entries[Math.floor(random() * entries.length)]
const overlaps = (a,b) => a.x < b.x+b.width && a.x+a.width > b.x && a.y < b.y+b.height && a.y+a.height > b.y
const anchorArea = p => ({x:p.x-32,y:p.y-32,width:64,height:64})
const roomAnchors = g => [g.spawn,g.exit,g.rest,...g.spawnPoints,...g.chests]

function shuffled(random, entries) {
  return entries.map(value=>({value,order:random()})).sort((a,b)=>a.order-b.order).map(entry=>entry.value)
}

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

// Keep the collision half of a coffin on the side furthest from the room's
// centre route. The complete 3x2 motif is still rendered, but its blocking
// footprint no longer reaches into paving that visually reads as walkable.
function coffinCollision(room, left, top) {
  const upperHalf = top + TILE <= room.center.y
  return {x:left,y:upperHalf ? top : top+TILE,width:48,height:TILE}
}

// Themes own their landmark, hazard and route footprint before random clutter is
// considered. Density is intentionally variable, but every random choice comes
// from pre-vetted slots that preserve the same broad routes for radius-26 actors.
export function dressThemedRooms(g, random) {
  const coffinPool = rules.motifs.coffins.filter(m => m.width === 3 && m.height === 2)
  const addProp = (room,kind,motif,left,top,collision) => {
    g.decorations.push({kind,motif,roomId:room.id,x:left+motif.width*8,y:top+motif.height*8,
      footprint:{width:motif.width*TILE,height:motif.height*TILE},scale:'landmark',blocking:true,planned:true})
    g.solids.push({...collision,kind:'prop',authored:true,planned:true})
  }

  for (const room of g.rooms) {
    if (room.theme === 'shrine') {
      // Statue_fire is reserved for the dedicated rest/campfire room. Keeping
      // it out of generated shrine geometry prevents a decorative landmark from
      // consuming ordinary traversal space or participating in collision/nav.
      const pathHeight = pick(random,[64,96,128])
      addPaving(g,room,'processional',room.center.x-32,room.y+room.height-pathHeight,64,pathHeight)
      room.layout = {type:'altar',safeLane:{x:room.center.x-32,y:room.y+32,width:64,height:128}}
      continue
    }

    if (room.theme === 'crypt') {
      // A crypt may be sparse or dense. Pick 1-4 complete coffins from four
      // burial slots. Their collision half faces away from the central route,
      // so the visible paving remains usable instead of hiding a 20px halo.
      const placements = shuffled(random,[
        [room.x+32,room.y+16],[room.x+32,room.y+112],
        [room.x+room.width-80,room.y+16],[room.x+room.width-80,room.y+112],
      ])
      const coffinCount = 1 + Math.floor(random()*4)
      for (const [left,top] of placements.slice(0,coffinCount)) {
        const motif = pick(random,coffinPool)
        addProp(room,'coffin',motif,left,top,coffinCollision(room,left,top))
      }
      addPaving(g,room,'burial-aisle',room.center.x-48,room.y+32,96,128)
      room.layout = {type:'burial',safeLane:{x:room.center.x-48,y:room.y+24,width:96,height:136},groups:coffinCount}
      continue
    }

    if (room.theme === 'gauntlet') {
      // One to three adjacent rows produce anything from a warning strip to a
      // full 4x3 bank. The hazard stays on one side and the opposite bypass is
      // unchanged, so density never turns into compulsory damage.
      const motif = rules.assemblies.spikes
      // Keep a two-tile landing so a west entrance can reach the bypass
      // without entering the bank while any of its rows are raised.
      const left = room.x + TILE * 2
      const bankCount = 1 + Math.floor(random()*3)
      for (let row=0; row<bankCount; row++) {
        const y = room.y + 48 + row*TILE
        const damageArea = {x:left,y,width:motif.width*TILE,height:TILE}
        if (roomAnchors(g).some(p=>overlaps(damageArea,anchorArea(p)))) continue
        g.traps.push({id:`spikes-${room.id}-${row}`,roomId:room.id,kind:'spikes',motif,
          x:left+motif.width*8,y:y+8,damageArea,animationOffset:row*300,planned:true})
      }
      addPaving(g,room,'gauntlet-bypass',room.center.x+16,room.y+32,64,128)
      room.layout = {type:'trap-corridor',hazardLane:{x:left,y:room.y+48,width:motif.width*TILE,height:TILE*bankCount},safeLane:{x:room.center.x+16,y:room.y+24,width:64,height:136}}
      continue
    }

    if (room.theme === 'flooded') {
      // Two southern cuts come from the base generator. Add zero, one or two
      // asymmetric northern pockets from safe edge slots. Keeping both pockets
      // within the first 48px of the room also preserves radius-26 clearance on
      // an east-west corridor centred at y+80.
      const extras = shuffled(random,[
        {x:room.x+TILE,y:room.y+TILE,width:TILE*2,height:TILE*2,kind:'inlet'},
        {x:room.x+room.width-TILE*3,y:room.y+TILE,width:TILE*2,height:TILE*2,kind:'inlet'},
      ])
      const extraCount = Math.floor(random()*3)
      for (const extra of extras.slice(0,extraCount)) {
        if (!(room.inlets ?? []).some(area=>overlaps(area,extra))) floodArea(g,room,extra)
      }
      addPaving(g,room,'flooded-spine',room.center.x-32,room.y+32,64,128)
      room.layout = {type:'flood-basin',safeLane:{x:room.center.x-32,y:room.y+24,width:64,height:136}}
      continue
    }

    // Galleries are allowed to be genuinely empty. Half receive one complete
    // coffin composition, half keep the visual breathing room.
    if (room.theme === 'gallery') {
      if (random()<0.5) {
        const motif = pick(random,coffinPool)
        const left = room.x+room.width-80, top = room.y+16
        addProp(room,'coffin',motif,left,top,coffinCollision(room,left,top))
      }
      room.layout = {type:'gallery',safeLane:{x:room.center.x-32,y:room.y+24,width:64,height:136}}
    }
  }
  for (const room of g.rooms.filter(r=>r.theme==='crypt')) {
    const horizontal=g.paths.some(path=>{
      const other=path.from===room.id?g.rooms[path.to]:path.to===room.id?g.rooms[path.from]:null
      return other && other.center.y===room.center.y
    })
    if(horizontal) room.layout.approachLanes=[{x:room.x+16,y:room.center.y-40,width:room.width-32,height:80,axis:'horizontal',actorRadius:20}]
  }

}

// Place these after all theme-specific water cuts and landmark reservations.
// A failed candidate is moved to another authored wall/floor slot, never clipped.
export function populateRoomHazards(g) {
  const landArea = area => {
    for (let y=area.y/TILE;y<(area.y+area.height)/TILE;y++) for(let x=area.x/TILE;x<(area.x+area.width)/TILE;x++) {
      const cell=g.grid.cells[y*g.grid.columns+x]
      if (!cell || !['floor','bridge'].includes(cell.kind)) return false
    }
    return true
  }
  const available = (room, area) => landArea(area) &&
    !roomAnchors(g).some(p=>overlaps(area,{x:p.x-24,y:p.y-24,width:48,height:48})) &&
    !(room.layout?.safeLane && overlaps(area,room.layout.safeLane)) &&
    !g.decorations.some(d=>d.footprint && overlaps(area,{x:d.x-d.footprint.width/2,y:d.y-d.footprint.height/2,...d.footprint})) &&
    !g.traps.some(t=>overlaps(area,t.damageArea))
  const addWallTrap = room => {
    const wall=g.walls.find(w=>w.roomId===room.id)
    for(const x of [room.x+32,room.x+room.width-48,room.x+16,room.x+room.width-64]) {
      const area={x,y:wall.y+32,width:32,height:64}
      if (wall.opening && x<wall.opening.x+wall.opening.width && x+32>wall.opening.x) continue
      if (!available(room,area)) continue
      g.traps.push({id:`wall-trap-${room.id}`,roomId:room.id,wallId:wall.id,kind:'wall-trap',x:x+16,y:wall.y+48,
        motif:rules.assemblies.wallTrap,damageArea:area,orientation:'down'})
      return true
    }
    return false
  }
  for(const room of g.rooms.filter(r=>['gallery','flooded'].includes(r.theme))) addWallTrap(room)
  // Both flooded side walls can face water; the shrine's opposite wall is then
  // the valid host. Preserve the feature without placing a flame over a pool.
  if(!g.traps.some(t=>t.kind==='wall-trap')) addWallTrap(g.rooms.find(r=>r.theme==='shrine'))
  for(const room of g.rooms.filter(r=>r.theme!=='crypt')) {
    const x=room.x+room.width-48
    for(const y of [room.y+room.height-48,room.y+48]) {
      const area={x,y,width:32,height:32}
      if(!available(room,area)) continue
      g.traps.push({id:`floor-trap-${room.id}`,roomId:room.id,kind:'plate-trap',x:x+16,y:y+16,
        motif:rules.assemblies.floorTrap,damageArea:area})
      break
    }
  }
}

export function populateWater(g, random) {
  const {columns,rows,cells} = g.grid
  const water = (x,y) => x>=0&&y>=0&&x<columns&&y<rows&&cells[y*columns+x].kind==='water'
  const occupied = new Set()
  const variants = [rules.assemblies.waterRipple,rules.assemblies.waterFoam,rules.assemblies.waterLong,rules.assemblies.waterSmall]
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
  // Quiet and busy floors both occur: the divisor changes detail density while
  // the complete authored motifs and their non-overlap rules stay identical.
  const densityDivisor = pick(random,[45,55,70])
  const detailLimit = Math.max(3,Math.floor(candidates.length/densityDivisor))
  for(const motif of variants) place(motif,'water-detail',detailLimit)
  occupied.clear()
  const ruinLimit = Math.max(3,Math.floor(g.rooms.length*(0.65+random()*0.7)))
  place(rules.assemblies.underwaterRuin,'underwater-ruin',ruinLimit)
}
