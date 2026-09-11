<script>
  import { onMount } from 'svelte'
  import { getIdentity, defaultName } from '$lib/identity.js'
  import { socket } from '$lib/ws/arcade'
  import TetrisBattle from '$lib/games/tetris/TetrisBattle.svelte'
  export let data
  const identity = getIdentity(); const name = defaultName(identity.playerId)
  let roomCode=(data?.code??'').toUpperCase(), gameName=(data?.game??'gomoku').toLowerCase(), room=null, gameState=null, connection='connecting', error='', copied=false
  let unsubscribeRoom=()=>{}, unsubscribeConnection=()=>{}, audioContext=null
  const size=15, cells=Array.from({length:size*size},(_,index)=>({x:index%size,y:Math.floor(index/size)}))
  function tone(frequency,duration,volume=.035,delay=0){if(typeof window==='undefined')return;audioContext??=new AudioContext();if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});const o=audioContext.createOscillator(),g=audioContext.createGain(),start=audioContext.currentTime+delay;o.frequency.value=frequency;o.type='sine';g.gain.setValueAtTime(volume,start);g.gain.exponentialRampToValueAtTime(.0001,start+duration);o.connect(g);g.connect(audioContext.destination);o.start(start);o.stop(start+duration)}
  function playMoveSound(){tone(360,.06,.025)}
  function playFinishSound(winner,roomState){if(!winner){tone(300,.12);tone(260,.16,.03,.1);return}if(winner===myStone(roomState)){tone(440,.1);tone(660,.16,.035,.09)}else{tone(330,.1);tone(220,.18,.035,.09)}}
  function applySnapshot(snapshot){if(!snapshot||snapshot.type)return;const previous=gameState;room=snapshot;gameState=snapshot.state??null;if(gameName!=='gomoku'||!previous||!gameState)return;if(gameState.status==='finished'&&previous.status!=='finished')playFinishSound(gameState.winner,snapshot);else if(gameState.moves>previous.moves)playMoveSound()}
  function myStone(roomState){const index=roomState?.players?.findIndex((p)=>p.id===identity.sessionId)??-1;return index===0?1:index===1?2:0}
  function canMove(roomState,state,x,y){return !!state&&state.status==='playing'&&myStone(roomState)===state.turn&&state.board?.[y]?.[x]===0}
  function canAddBot(roomState){return gameName==='gomoku'&&roomState?.maxPlayers===2&&roomState?.players?.length===1&&roomState.players[0]?.id===identity.sessionId}
  function isMultiplayer(roomState){return roomState?.maxPlayers===2}
  function subscribeRoom(){unsubscribeRoom();const topic=`room:${roomCode}`;unsubscribeRoom=socket.subscribe(topic,(message)=>{if(message.data?.topicId!==topic)return;const payload=message.data.message;if(payload?.type)return;applySnapshot(payload)})}
  async function bootstrap(){error='';connection='connecting';await socket.connect();await socket.request('arcade.login',{playerId:identity.sessionId,sessionId:identity.sessionId});if(roomCode==='NEW'){const snapshot=await socket.request('room.create',{game:gameName,name,players:data?.players??2});applySnapshot(snapshot);roomCode=snapshot.id;history.replaceState(null,'',`/room/${roomCode.toLowerCase()}/${gameName}`)}else{const snapshot=await socket.request('room.join',{roomId:roomCode,name});if(snapshot.game!==gameName){gameName=snapshot.game;history.replaceState(null,'',`/room/${roomCode.toLowerCase()}/${gameName}`)}applySnapshot(snapshot)}subscribeRoom();connection='live'}
  async function moveStone(x,y){if(!canMove(room,gameState,x,y))return;error='';try{applySnapshot(await socket.request('game.move',{roomId:roomCode,move:{x,y}}))}catch(err){error=err.message}}
  async function addBot(){error='';try{applySnapshot(await socket.request('room.addBot',{roomId:roomCode}))}catch(err){error=err.message}}
  async function rematch(){error='';try{applySnapshot(await socket.request('room.rematch',{roomId:roomCode}))}catch(err){error=err.message}}
  async function copyInvite(){await navigator.clipboard.writeText(`${location.origin}/room/${roomCode.toLowerCase()}/${gameName}`);copied=true;setTimeout(()=>copied=false,1200)}
  async function reconnect(){try{await bootstrap()}catch(err){connection='offline';error=err.message}}
  function stoneAt(state,x,y){return state?.board?.[y]?.[x]??0} function isLast(state,x,y){return state?.last?.x===x&&state?.last?.y===y}
  function gameLabel(roomState,state){if(!roomState||roomState.players.length<roomState.maxPlayers)return'Waiting for a friend';if(!state)return'Preparing board';if(state.status==='finished'){if(!state.winner)return'Draw';return state.winner===myStone(roomState)?'You win':'Friend wins'}return state.turn===myStone(roomState)?'Your turn':"Friend's turn"}
  onMount(()=>{unsubscribeConnection=socket.onConnection((state)=>{connection=state});bootstrap().catch((err)=>{connection='offline';error=err.message});return()=>{unsubscribeRoom();unsubscribeConnection();audioContext?.close()}})
</script>
<svelte:head><title>{gameName==='tetris'?'Tetris Battle':'Gomoku'} · {roomCode.toLowerCase()} · AQI Arcade</title></svelte:head>
<div class="room-shell"><header class="room-topbar"><a class="brand" href="/"><span class="brand-mark">A</span><span>AQI ARCADE</span></a><div class="room-meta"><span>{gameName.toUpperCase()} · <strong>{roomCode.toLowerCase()}</strong></span><span class:offline={connection!=='live'} class="live-badge"><i></i>{connection==='live'?'LIVE':connection.toUpperCase()}</span></div></header>
<main class="room-main">
{#if gameName==='tetris'}
  {#if room}<TetrisBattle {room} {roomCode} {identity} {socket}/>{/if}
  {#if isMultiplayer(room)}<aside class="room-panel tetris-panel"><div class="code-display"><span>{roomCode.toLowerCase()}</span><small>ROOM CODE</small></div><button class="primary-button" onclick={copyInvite}>{copied?'Link copied':'Copy invite link'}</button></aside>{/if}
  {#if error}<div class="room-error">{error}</div>{/if}{#if connection==='offline'}<button class="secondary-button" onclick={reconnect}>Reconnect</button>{/if}
{:else}
  <section class="match-head"><div class="player-card active-player"><div class="player-stone black"></div><div><span>BLACK</span><strong>{room?.players?.[0]?.name??name}</strong></div></div><div class="match-status"><span>GOMOKU</span><h1>{gameLabel(room,gameState)}</h1><p>{room?.players?.length??0}/{room?.maxPlayers??2} players</p></div><div class="player-card right"><div><span>WHITE</span><strong>{room?.players?.[1]?.name??'Waiting...'}</strong></div><div class="player-stone white"></div></div></section>
  <section class="board-stage"><div class="board-frame"><div class="gomoku-board" aria-label="Gomoku board">{#each cells as cell}<button class:last={isLast(gameState,cell.x,cell.y)} class:playable={canMove(room,gameState,cell.x,cell.y)} class="board-cell" onclick={()=>moveStone(cell.x,cell.y)} aria-label={`Place stone at ${cell.x+1}, ${cell.y+1}`}>{#if stoneAt(gameState,cell.x,cell.y)===1}<span class="stone stone-black"></span>{:else if stoneAt(gameState,cell.x,cell.y)===2}<span class="stone stone-white"></span>{:else}<span class="ghost-stone"></span>{/if}</button>{/each}</div></div>
  {#if isMultiplayer(room)}<aside class="room-panel"><div class="code-display"><span>{roomCode.toLowerCase()}</span><small>ROOM CODE</small></div><button class="primary-button" onclick={copyInvite}>{copied?'Link copied':'Copy invite link'}</button>{#if canAddBot(room)}<button class="secondary-button" onclick={addBot}>Add Bot</button>{/if}{#if gameState?.status==='finished'&&myStone(room)!==0}<button class="secondary-button" onclick={rematch}>Play again</button>{/if}{#if error}<div class="room-error">{error}</div>{/if}{#if connection==='offline'}<button class="secondary-button" onclick={reconnect}>Reconnect</button>{/if}</aside>{/if}</section>
{/if}
</main></div>
<style>.tetris-panel{width:min(100%,960px);margin:26px auto 0;display:grid;grid-template-columns:180px minmax(180px,260px);gap:12px;align-items:stretch}.tetris-panel .code-display{margin:0}@media(max-width:640px){.tetris-panel{grid-template-columns:1fr}}</style>
