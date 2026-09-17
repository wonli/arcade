<script>
  import { onMount } from 'svelte'
  import PreviewButton from '$lib/components/PreviewButton.svelte'
  import { createTranslator } from '$lib/i18n.js'
  import { subscribeLocale } from '$lib/locale.js'
  import { uploadPreview } from '$lib/preview/client.js'
  import { createPreviewController } from '$lib/preview/controller.js'
  import { renderTetrisPreview } from '$lib/preview/renderers.js'
  import { addGarbage, createGame, hardDrop, move, previewBoard, rotate, tick, visibleBoard, WIDTH, HEIGHT } from './engine.js'

  export let room
  export let roomCode
  export let identity
  export let socket

  let state=createGame(), opponent=null, result='', unsubscribe=()=>{}, unsubscribeLocale=()=>{}, unsubscribePreview=()=>{}, timer=null, syncTimer=null, gameOverSent=false, audioContext=null, locale='en'
  let previewController=null, previewState={phase:'idle',autoRemaining:0,cooldownRemaining:0,error:''}, previewSession=1
  $: t=createTranslator(locale)
  $: previewActive=!!room&&room.players?.length>=room.maxPlayers&&state.status==='playing'
  $: if(previewController){if(previewActive)previewController.enterPlaying(`${roomCode}:${previewSession}`);else previewController.leavePlaying()}

  const cells=Array.from({length:WIDTH*HEIGHT},(_,index)=>({x:index%WIDTH,y:Math.floor(index/WIDTH)}))
  const previewCells=Array.from({length:16},(_,index)=>({x:index%4,y:Math.floor(index/4)}))

  function tone(frequency,duration=.05,volume=.025,delay=0){if(typeof window==='undefined')return;audioContext??=new AudioContext();if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});const o=audioContext.createOscillator(),g=audioContext.createGain(),start=audioContext.currentTime+delay;o.type='square';o.frequency.value=frequency;g.gain.setValueAtTime(volume,start);g.gain.exponentialRampToValueAtTime(.0001,start+duration);o.connect(g);g.connect(audioContext.destination);o.start(start);o.stop(start+duration)}
  function play(name){if(name==='move')tone(150,.025,.012);if(name==='rotate')tone(230,.035,.016);if(name==='lock')tone(95,.055,.025);if(name==='clear'){tone(420,.08,.025);tone(620,.1,.025,.06)}if(name==='attack'){tone(720,.07,.028);tone(900,.08,.02,.05)}if(name==='garbage'){tone(110,.12,.04);tone(82,.14,.03,.07)}if(name==='win'){tone(440,.09,.03);tone(660,.1,.03,.08);tone(880,.14,.03,.16)}if(name==='lose'){tone(300,.1,.03);tone(190,.18,.035,.08)}}

  function ready(){return !!room&&room.players?.length>=room.maxPlayers}
  function hasOpponent(){return room?.maxPlayers===2&&room?.players?.length>=2}
  function opponentName(){return room?.players?.find((p)=>p.id!==identity.sessionId)?.name??t('common.waiting')}

  function apply(v,localSound=true){
    state=v.state
    for(const event of v.events){
      if(localSound&&['move','rotate','lock','clear','garbage'].includes(event.type))play(event.type)
      if(event.type==='clear'&&event.attack>0&&hasOpponent()){play('attack');socket.request('tetris.attack',{roomId:roomCode,lines:event.attack}).catch(()=>{})}
    }
    if(state.status==='gameover'&&!gameOverSent){gameOverSent=true;result=hasOpponent()?'lose':'gameover';play('lose');if(hasOpponent())socket.request('tetris.gameover',{roomId:roomCode}).catch(()=>{})}
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

  function reset(){state=createGame();opponent=null;result='';gameOverSent=false;previewSession+=1}
  function restart(){if(hasOpponent())socket.request('tetris.restart',{roomId:roomCode}).catch(()=>{});reset()}
  async function sync(){if(!hasOpponent())return;await socket.request('tetris.state',{roomId:roomCode,board:visibleBoard(state),score:state.score,lines:state.lines,gameOver:state.status==='gameover'})}
  function title(){if(result==='win')return t('tetris.youWin');if(result==='lose')return t('tetris.youLose');if(result==='gameover')return t('tetris.gameOver');return ready()?(hasOpponent()?t('tetris.battleLive'):t('tetris.solo')):t('tetris.waitOpponent')}

  async function capturePreview(){
    return {
      blob:await renderTetrisPreview({...state,board:visibleBoard(state)},opponent),
      summary:{score:state.score??0,lines:state.lines??0},
    }
  }

  onMount(()=>{
    unsubscribeLocale=subscribeLocale((next)=>locale=next)
    previewController=createPreviewController({game:'tetris',roomId:()=>roomCode,players:()=>room?.players?.length??1,capture:capturePreview,upload:(payload)=>uploadPreview({...payload,socket})})
    unsubscribePreview=previewController.subscribe((next)=>previewState=next)
    const topic=`room:${roomCode.toUpperCase()}`
    unsubscribe=socket.subscribe(topic,(message)=>{const payload=message.data?.message;if(!payload?.type||payload.playerId===identity.sessionId)return;if(payload.type==='tetris.state')opponent=payload;else if(payload.type==='tetris.attack'){apply(addGarbage(state,payload.lines),false);play('garbage')}else if(payload.type==='tetris.gameover'){if(state.status==='playing'){result='win';play('win')}}else if(payload.type==='tetris.restart')reset()})
    timer=setInterval(()=>{if(ready()&&state.status==='playing')apply(tick(state),false)},650)
    syncTimer=setInterval(()=>sync().catch(()=>{}),300)
    window.addEventListener('keydown',handleKey,{passive:false})
    return()=>{unsubscribe();unsubscribeLocale();unsubscribePreview();previewController?.destroy();clearInterval(timer);clearInterval(syncTimer);window.removeEventListener('keydown',handleKey);audioContext?.close()}
  })
</script>

<div class="battle-shell">
  <section class="battle-main">
    <div class="battle-title">
      <div><span>{t('tetris.title')}</span><h1>{title()}</h1></div>
      <div class="title-tools">
        {#if previewActive}<PreviewButton state={previewState} {t} onUpdate={()=>previewController?.updateNow()} />{/if}
        <div class="stats"><strong>{state.score}</strong><span>{t('common.score')}</span><strong>{state.lines}</strong><span>{t('common.lines')}</span></div>
      </div>
    </div>
    <div class:solo={room?.maxPlayers===1} class="arena">
      <div class="local-zone">
        <div class="board local" aria-label="Tetris">{#each cells as cell}{@const value=visibleBoard(state)[cell.y][cell.x]}<i class:filled={value!==0} data-value={value}></i>{/each}</div>
        <aside class="next-panel"><span>{t('tetris.next')}</span><div class="preview" aria-label={`Next piece ${state.next?.kind??''}`}>{#each previewCells as cell}{@const value=previewBoard(state.next)[cell.y][cell.x]}<i class:filled={value!==0} data-value={value}></i>{/each}</div></aside>
      </div>
      {#if room?.maxPlayers===2}<aside class="rival"><div class="rival-head"><span>{t('tetris.opponent')}</span><strong>{opponentName()}</strong></div><div class="board mini" aria-label="Opponent Tetris board">{#each cells as cell}{@const value=opponent?.board?.[cell.y]?.[cell.x]??0}<i class:filled={value!==0} data-value={value}></i>{/each}</div><div class="rival-stats"><span>{t('common.score')} <strong>{opponent?.score??0}</strong></span><span>{t('common.lines')} <strong>{opponent?.lines??0}</strong></span></div></aside>{/if}
    </div>

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
.battle-shell{width:100%}.battle-main{width:min(100%,1040px);margin:0 auto}.battle-title{display:flex;align-items:end;justify-content:space-between;gap:24px;margin-bottom:22px}.battle-title span,.next-panel>span{color:#8b949e;font-size:11px;font-weight:800;letter-spacing:.16em}.battle-title h1{margin:5px 0 0;font-size:clamp(28px,5vw,44px);letter-spacing:-.04em}.title-tools{display:flex;align-items:center;gap:14px}.stats{display:grid;grid-template-columns:auto auto;gap:2px 10px;align-items:baseline;text-align:right}.stats strong{color:#c1ff56;font:800 22px ui-monospace,monospace}.arena{display:grid;grid-template-columns:minmax(330px,520px) minmax(150px,230px);gap:clamp(28px,5vw,64px);align-items:start;justify-content:center}.arena.solo{grid-template-columns:minmax(330px,520px)}.local-zone{display:grid;grid-template-columns:minmax(260px,420px) 82px;gap:18px;align-items:start}.board{display:grid;grid-template-columns:repeat(10,1fr);background:#080a0d;border:1px solid #30363f;box-shadow:10px 10px 0 #050607;touch-action:none}.board i,.preview i{aspect-ratio:1;border:1px solid #15191f;background:#0d1014}.board i.filled,.preview i.filled{background:#c1ff56;border-color:#0b0d10;box-shadow:inset 0 0 0 2px rgba(255,255,255,.12)}.board i[data-value='2'],.board i[data-value='5'],.preview i[data-value='2'],.preview i[data-value='5']{background:#f5ede0}.board i[data-value='3'],.board i[data-value='6'],.preview i[data-value='3'],.preview i[data-value='6']{background:#8ee7ff}.board i[data-value='4'],.board i[data-value='7'],.preview i[data-value='4'],.preview i[data-value='7']{background:#ffcf5a}.board i[data-value='8']{background:#464d57}.next-panel{padding-top:2px}.preview{display:grid;grid-template-columns:repeat(4,1fr);width:82px;margin-top:10px;padding:5px;background:#080a0d;border:1px solid #30363f}.preview i{border-color:transparent}.rival{padding-top:18px}.rival-head{display:flex;flex-direction:column;gap:4px;margin-bottom:12px}.rival-head span{color:#737b85;font-size:10px;letter-spacing:.14em}.rival-head strong{font-size:14px}.mini{box-shadow:6px 6px 0 #050607}.rival-stats{display:flex;justify-content:space-between;gap:12px;margin-top:14px;color:#7f8791;font-size:12px}.rival-stats strong{color:#f4f0e8}.controls{margin-top:20px;color:#66707b;font:12px ui-monospace,monospace;text-align:center}.touch-controls{display:none;grid-template-columns:repeat(5,minmax(52px,72px));justify-content:center;gap:8px;margin:18px auto 0;touch-action:none}.touch-controls button{height:52px;border:1px solid #3b424c;background:#111419;color:#f4f0e8;font-size:22px;font-weight:900;touch-action:manipulation}.touch-controls button:active,.touch-controls .hard{border-color:#c1ff56}.touch-controls button:active{background:#c1ff56;color:#0b0d10}.restart{display:block;width:min(100%,420px);height:48px;margin:18px auto 0;border:0;background:#c1ff56;color:#0b0d10;font-weight:900;cursor:pointer}
@media(hover:none),(pointer:coarse){.touch-controls{display:grid}.controls{display:none}}
@media(max-width:720px){.battle-title{align-items:start}.title-tools{align-items:flex-end;flex-direction:column}.arena{grid-template-columns:minmax(230px,1fr) 100px;gap:14px}.arena.solo{grid-template-columns:1fr}.local-zone{grid-template-columns:minmax(0,1fr) 64px;gap:10px}.next-panel{padding-top:0}.preview{width:64px}.rival{padding-top:8px}.rival-stats{flex-direction:column;gap:3px}.touch-controls{display:grid}.controls{display:none}}
@media(max-width:480px){.battle-title{margin-bottom:14px}.battle-title h1{font-size:26px}.arena{grid-template-columns:minmax(0,1fr) 84px}.local-zone{grid-template-columns:minmax(0,1fr) 54px}.preview{width:54px;padding:3px}.touch-controls{grid-template-columns:repeat(5,1fr);gap:5px}.touch-controls button{height:48px}.rival-stats{font-size:10px}}
</style>