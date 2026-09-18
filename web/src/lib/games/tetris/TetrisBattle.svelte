<script>
  import { onMount } from 'svelte'
  import { createTranslator } from '$lib/i18n.js'
  import { subscribeLocale } from '$lib/locale.js'
  import { createReplaySession } from '$lib/replay/session.js'
  import { addGarbage, createGame, hardDrop, move, previewBoard, rotate, tick, visibleBoard } from './engine.js'
  import { replay as tetrisReplay } from './replay.js'
  import TetrisArena from './TetrisArena.svelte'

  export let room
  export let roomCode
  export let identity
  export let socket

  let state=createGame(), opponent=null, result='', unsubscribe=()=>{}, unsubscribeLocale=()=>{}, timer=null, syncTimer=null, gameOverSent=false, audioContext=null, locale='en', copied=false
  let replaySession=null, replayFinished=false
  $: t=createTranslator(locale)
  $: localBoard=visibleBoard(state)
  $: nextBoard=previewBoard(state.next)

  function tone(frequency,duration=.05,volume=.025,delay=0){if(typeof window==='undefined')return;audioContext??=new AudioContext();if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});const o=audioContext.createOscillator(),g=audioContext.createGain(),start=audioContext.currentTime+delay;o.type='square';o.frequency.value=frequency;g.gain.setValueAtTime(volume,start);g.gain.exponentialRampToValueAtTime(.0001,start+duration);o.connect(g);g.connect(audioContext.destination);o.start(start);o.stop(start+duration)}
  function play(name){if(name==='move')tone(150,.025,.012);if(name==='rotate')tone(230,.035,.016);if(name==='lock')tone(95,.055,.025);if(name==='clear'){tone(420,.08,.025);tone(620,.1,.025,.06)}if(name==='attack'){tone(720,.07,.028);tone(900,.08,.02,.05)}if(name==='garbage'){tone(110,.12,.04);tone(82,.14,.03,.07)}if(name==='win'){tone(440,.09,.03);tone(660,.1,.03,.08);tone(880,.14,.03,.16)}if(name==='lose'){tone(300,.1,.03);tone(190,.18,.035,.08)}}

  function ready(){return !!room&&room.players?.length>=room.maxPlayers}
  function hasOpponent(){return room?.maxPlayers===2&&room?.players?.length>=2}
  function opponentName(){return room?.players?.find((p)=>p.id!==identity.sessionId)?.name??t('common.waiting')}

  function replaySnapshot(status=state.status){
    return {
      board:localBoard,
      nextBoard,
      score:state.score??0,
      lines:state.lines??0,
      status,
      opponent:opponent?.board?{board:opponent.board,score:opponent.score??0,lines:opponent.lines??0}:null,
    }
  }
  function recordReplay(force=false){replaySession?.record(replaySnapshot(),{force})}
  function finishReplay(status='finished'){
    if(replayFinished)return
    replayFinished=true
    void replaySession?.finish(replaySnapshot(status))
  }

  function apply(v,localSound=true){
    state=v.state
    for(const event of v.events){
      if(localSound&&['move','rotate','lock','clear','garbage'].includes(event.type))play(event.type)
      if(event.type==='clear'&&event.attack>0&&hasOpponent()){play('attack');socket.request('tetris.attack',{roomId:roomCode,lines:event.attack}).catch(()=>{})}
    }
    recordReplay()
    if(state.status==='gameover'&&!gameOverSent){gameOverSent=true;result=hasOpponent()?'lose':'gameover';play('lose');if(hasOpponent())socket.request('tetris.gameover',{roomId:roomCode}).catch(()=>{});finishReplay('gameover')}
  }

  function perform(action){
    if(!ready()||state.status!=='playing')return
    if(action==='left')apply(move(state,-1))
    else if(action==='right')apply(move(state,1))
    else if(action==='softDrop')apply(tick(state))
    else if(action==='rotate')apply(rotate(state))
    else if(action==='hardDrop')apply(hardDrop(state))
  }

  function handleKey(event){
    const action={ArrowLeft:'left',ArrowRight:'right',ArrowDown:'softDrop',ArrowUp:'rotate',' ':'hardDrop',Spacebar:'hardDrop'}[event.key]
    if(!action)return
    event.preventDefault()
    perform(action)
  }

  function reset(){
    state=createGame();opponent=null;result='';gameOverSent=false;replayFinished=false
    void replaySession?.restart(replaySnapshot())
  }
  function restart(){if(hasOpponent())socket.request('tetris.restart',{roomId:roomCode}).catch(()=>{});reset()}
  async function copyInvite(){if(!roomCode)return;await navigator.clipboard.writeText(`${location.origin}/room/${roomCode.toLowerCase()}/tetris`);copied=true;setTimeout(()=>copied=false,1200)}
  async function sync(){if(!hasOpponent())return;await socket.request('tetris.state',{roomId:roomCode,board:localBoard,score:state.score,lines:state.lines,gameOver:state.status==='gameover'})}
  function title(){if(result==='win')return t('tetris.youWin');if(result==='lose')return t('tetris.youLose');if(result==='gameover')return t('tetris.gameOver');return ready()?(hasOpponent()?t('tetris.battleLive'):t('tetris.solo')):t('tetris.waitOpponent')}

  onMount(()=>{
    unsubscribeLocale=subscribeLocale((next)=>locale=next)
    replaySession=createReplaySession({adapter:tetrisReplay,roomCode:()=>roomCode,room:()=>room,identity,socket})
    if(ready())recordReplay(true)
    const topic=`room:${roomCode.toUpperCase()}`
    unsubscribe=socket.subscribe(topic,(message)=>{
      const payload=message.data?.message
      if(!payload?.type||payload.playerId===identity.sessionId)return
      if(payload.type==='tetris.state'){opponent=payload;recordReplay()}
      else if(payload.type==='tetris.attack'){apply(addGarbage(state,payload.lines),false);play('garbage')}
      else if(payload.type==='tetris.gameover'){if(state.status==='playing'){result='win';play('win');finishReplay('finished')}}
      else if(payload.type==='tetris.restart')reset()
    })
    timer=setInterval(()=>{if(ready()&&state.status==='playing')apply(tick(state),false)},650)
    syncTimer=setInterval(()=>sync().catch(()=>{}),300)
    window.addEventListener('keydown',handleKey,{passive:false})
    return()=>{unsubscribe();unsubscribeLocale();replaySession?.destroy();clearInterval(timer);clearInterval(syncTimer);window.removeEventListener('keydown',handleKey);audioContext?.close()}
  })
</script>

<div class="battle-shell">
  <section class="battle-main">
    <div class="battle-title">
      <div><span>{t('tetris.title')}</span><h1>{title()}</h1></div>
      <div class="title-tools">
        {#if room?.maxPlayers===2}
          <div class="invite-tools">
            <div class="invite-room"><small>{t('common.roomCode')}</small><strong>{roomCode.toLowerCase()}</strong></div>
            <button onclick={copyInvite}>{copied?t('common.linkCopied'):t('common.copyInvite')}</button>
          </div>
        {/if}
        <div class="stats"><strong>{state.score}</strong><span>{t('common.score')}</span><strong>{state.lines}</strong><span>{t('common.lines')}</span></div>
      </div>
    </div>

    <TetrisArena
      board={localBoard}
      {nextBoard}
      opponent={room?.maxPlayers===2 ? opponent : null}
      opponentName={opponentName()}
      nextLabel={t('tetris.next')}
      opponentLabel={t('tetris.opponent')}
      scoreLabel={t('common.score')}
      linesLabel={t('common.lines')}
    />

    <div class="touch-controls" aria-label="Tetris touch controls">
      <button aria-label={t('tetris.touch.moveLeft')} onpointerdown={(event)=>{event.preventDefault();perform('left')}}>←</button>
      <button aria-label={t('tetris.touch.rotate')} onpointerdown={(event)=>{event.preventDefault();perform('rotate')}}>↻</button>
      <button aria-label={t('tetris.touch.moveRight')} onpointerdown={(event)=>{event.preventDefault();perform('right')}}>→</button>
      <button aria-label={t('tetris.touch.softDrop')} onpointerdown={(event)=>{event.preventDefault();perform('softDrop')}}>↓</button>
      <button class="hard" aria-label={t('tetris.touch.hardDrop')} onpointerdown={(event)=>{event.preventDefault();perform('hardDrop')}}>⇣</button>
    </div>
    <div class="controls">{t('tetris.controls')}</div>
    {#if state.status==='gameover'||result==='win'}<button class="restart" onclick={restart}>{t('common.playAgain')}</button>{/if}
  </section>
</div>

<style>
.battle-shell{width:100%}
.battle-main{width:min(100%,980px);margin:0 auto}.battle-title{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:12px}.battle-title>div:first-child{min-width:0}.battle-title span{color:#8b949e;font-size:10px;font-weight:800;letter-spacing:.16em}.battle-title h1{margin:4px 0 0;font-size:clamp(24px,4vw,34px);line-height:1;letter-spacing:-.04em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.title-tools{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex:0 1 auto;min-width:0;flex-wrap:wrap}.invite-tools{height:30px;display:flex;align-items:stretch;border:1px solid #30363f;background:#0b0d10;white-space:nowrap}.invite-room{display:flex;align-items:center;gap:6px;padding:0 8px;border-right:1px solid #30363f;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.invite-room small{color:#66707b;font-size:7px;font-weight:900;letter-spacing:.1em}.invite-room strong{color:#f4f0e8;font-size:10px;letter-spacing:.08em}.invite-tools button{height:28px;padding:0 9px;border:0;background:#111419;color:#c1ff56;font:900 8px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.05em;cursor:pointer}.stats{display:grid;grid-template-columns:auto auto;gap:1px 8px;align-items:baseline;text-align:right}.stats strong{color:#c1ff56;font:800 18px ui-monospace,monospace}.stats span{font-size:9px}.controls{margin-top:10px;color:#66707b;font:10px ui-monospace,monospace;text-align:center}.touch-controls{display:none;grid-template-columns:repeat(5,minmax(48px,64px));justify-content:center;gap:7px;margin:10px auto 0;touch-action:none}.touch-controls button{height:46px;border:1px solid #3b424c;background:#111419;color:#f4f0e8;font-size:20px;font-weight:900;touch-action:manipulation}.touch-controls button:active,.touch-controls .hard{border-color:#c1ff56}.touch-controls button:active{background:#c1ff56;color:#0b0d10}.restart{display:block;width:min(100%,360px);height:44px;margin:10px auto 0;border:0;background:#c1ff56;color:#0b0d10;font-weight:900;cursor:pointer}
@media(max-height:700px){.battle-title{margin-bottom:8px}.battle-title h1{font-size:24px}.controls{margin-top:7px}}
@media(hover:none),(pointer:coarse){.touch-controls{display:grid}.controls{display:none}}
@media(max-width:720px){.battle-title{align-items:start;gap:8px}.title-tools{gap:6px;max-width:58%;}.invite-room small{display:none}.invite-room{padding:0 7px}.invite-tools button{padding:0 7px;max-width:104px;overflow:hidden;text-overflow:ellipsis}.stats strong{font-size:16px}.touch-controls{display:grid}.controls{display:none}}
@media(max-width:480px){.battle-title{margin-bottom:8px}.battle-title h1{font-size:22px}.battle-title>div:first-child>span{display:none}.title-tools{max-width:64%;}.invite-tools{height:28px}.invite-room strong{font-size:9px}.invite-tools button{height:26px;font-size:7px;max-width:86px}.touch-controls{grid-template-columns:repeat(5,1fr);gap:5px}.touch-controls button{height:44px}}
</style>