import { dungeon3Rules as rules } from './dungeon3-rules.js'

const TILE = 16
const pick = (random, entries) => entries[Math.floor(random() * entries.length)]
const overlaps = (a,b) => a.x < b.x+b.width && a.x+a.width > b.x && a.y < b.y+b.height && a.y+a.height > b.y
const anchorArea = p => ({x:p.x-32,y:p.y-32,width:64,height:64})

// Reserve the composition before random clutter competes for its floor space.
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
      // The complete statue rises above the north wall. Only its stone base
      // occupies walking space; its wings and flames are never cropped.
      addProp(room,'statue',motif,room.x+16,room.y-32,{x:room.x+32,y:room.y+32,width:48,height:16})
      g.pavingAreas.push({x:room.x+16,y:room.y+32,width:80,height:48})
    }
    if (room.theme !== 'flooded') {
      const sides = room.theme === 'crypt' ? ['left','right'] : ['right']
      for (const side of sides) {
        const motif = pick(random,coffinPool)
        const left = side === 'left' ? room.x+48 : room.x+room.width-96
        const top = room.y+32
        addProp(room,'coffin',motif,left,top,{x:left,y:top,width:48,height:32})
      }
      if (room.theme === 'crypt') g.pavingAreas.push({x:room.center.x-48,y:room.center.y-16,width:96,height:48})
    }
    if (room.theme === 'gauntlet') {
      for (const [index,y] of [room.y+48,room.y+room.height-32].entries()) {
        const motif = rules.assemblies.spikes
        const left = room.x+16, damageArea = {x:left,y,width:motif.width*TILE,height:TILE}
        const anchors = [g.spawn,g.exit,g.rest,...g.spawnPoints,...g.chests]
        if (anchors.some(p=>overlaps(damageArea,anchorArea(p)))) continue
        g.traps.push({id:`spikes-${room.id}-${index}`,roomId:room.id,kind:'spikes',motif,
          x:left+motif.width*8,y:y+8,damageArea,animationOffset:index*450})
      }
    }
  }
}

export function populateWater(g, random) {
  const {columns,rows,cells} = g.grid
  const water = (x,y) => x>=0&&y>=0&&x<columns&&y<rows&&cells[y*columns+x].kind==='water'
  const occupied = new Set()
  const variants = [rules.assemblies.waterFoam,rules.assemblies.waterLong,rules.assemblies.waterRipple,rules.assemblies.waterSmall]
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
  for(const motif of variants) place(motif,'water-detail',Math.max(3,Math.floor(candidates.length/65)))
  // Masonry is a separate underwater layer and can sit beneath moving ripples.
  occupied.clear()
  place(rules.assemblies.underwaterRuin,'underwater-ruin',Math.max(3,g.rooms.length))
}
