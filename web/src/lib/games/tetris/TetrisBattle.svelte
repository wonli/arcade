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

  let state=createGame(), opponent=null, result='', unsubscribe=()=>{}, unsubscribeLocale=()=>{}, unsubscribePreview=()=>{}, timer=null, syncTimer=null, gameOverSent=false, audioContext=null, locale='en', copied=false
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
  async function copyInvite(){if(!roomCode)return;await navigator.clipboard.writeText(`${location.origin}/room/${roomCode.toLowerCase()}/tetris`);copied=true;setTimeout(()=>copied=false,1200)}
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
        {#if room?.maxPlayers===2}
          <div class="invite-tools">
            <div class="invite-room"><small>{t('common.roomCode')}</small><strong>{roomCode.toLowerCase()}</strong></div>
            <button onclick={copyInvite}>{copied?t('common.linkCopied'):t('common.copyInvite')}</button>
          </div>
        {/if}
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
.battle-shell{width:100%;--tetris-board-height:min(620px,max(320px,calc(100dvh - 260px)));--tetris-board-width:calc(var(--tetris-board-height)/2)}
.battle-main{width:min(100%,980px);margin:0 auto}.battle-title{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:12px}.battle-title>div:first-child{min-width:0}.battle-title span,.next-panel>span{color:#8b949e;font-size:10px;font-weight:800;letter-spacing:.16em}.battle-title h1{margin:4px 0 0;font-size:clamp(24px,4vw,34px);line-height:1;letter-spacing:-.04em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.title-tools{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex:0 1 auto;min-width:0;flex-wrap:wrap}.invite-tools{height:30px;display:flex;align-items:stretch;border:1px solid #30363f;background:#0b0d10;white-space:nowrap}.invite-room{display:flex;align-items:center;gap:6px;padding:0 8px;border-right:1px solid #30363f;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.invite-room small{color:#66707b;font-size:7px;font-weight:900;letter-spacing:.1em}.invite-room strong{color:#f4f0e8;font-size:10px;letter-spacing:.08em}.invite-tools button{height:28px;padding:0 9px;border:0;background:#111419;color:#c1ff56;font:900 8px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.05em;cursor:pointer}.stats{display:grid;grid-template-columns:auto auto;gap:1px 8px;align-items:baseline;text-align:right}.stats strong{color:#c1ff56;font:800 18px ui-monospace,monospace}.stats span{font-size:9px}.arena{display:grid;grid-template-columns:max-content minmax(130px,180px);gap:clamp(22px,4vw,48px);align-items:start;justify-content:center}.arena.solo{grid-template-columns:max-content}.local-zone{display:grid;grid-template-columns:var(--tetris-board-width) 82px;gap:18px;align-items:start}.board{display:grid;grid-template-columns:repeat(10,1fr);background:#080a0d;border:1px solid #30363f;box-shadow:8px 8px 0 #050607;touch-action:none}.board.local{width:var(--tetris-board-width);aspect-ratio:1 / 2}.board i,.preview i{aspect-ratio:1;border:1px solid #15191f;background:#0d1014}.board i.filled,.preview i.filled{background:#c1ff56;border-color:#0b0d10;box-shadow:inset 0 0 0 2px rgba(255,255,255,.12)}.board i[data-value='2'],.board i[data-value='5'],.preview i[data-value='2'],.preview i[data-value='5']{background:#f5ede0}.board i[data-value='3'],.board i[data-value='6'],.preview i[data-value='3'],.preview i[data-value='6']{background:#8ee7ff}.board i[data-value='4'],.board i[data-value='7'],.preview i[data-value='4'],.preview i[data-value='7']{background:#ffcf5a}.board i[data-value='8']{background:#464d57}.next-panel{padding-top:2px}.preview{display:grid;grid-template-columns:repeat(4,1fr);width:82px;margin-top:8px;padding:5px;box-sizing:border-box;background:#080a0d;border:1px solid #30363f}.preview i{border-color:transparent}.rival{padding-top:0;width:min(180px,100%)}.rival-head{display:flex;flex-direction:column;gap:4px;margin-bottom:8px}.rival-head span{color:#737b85;font-size:9px;letter-spacing:.14em}.rival-head strong{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mini{width:100%;aspect-ratio:1 / 2;box-shadow:5px 5px 0 #050607}.rival-stats{display:flex;justify-content:space-between;gap:10px;margin-top:9px;color:#7f8791;font-size:10px}.rival-stats strong{color:#f4f0e8}.controls{margin-top:10px;color:#66707b;font:10px ui-monospace,monospace;text-align:center}.touch-controls{display:none;grid-template-columns:repeat(5,minmax(48px,64px));justify-content:center;gap:7px;margin:10px auto 0;touch-action:none}.touch-controls button{height:46px;border:1px solid #3b424c;background:#111419;color:#f4f0e8;font-size:20px;font-weight:900;touch-action:manipulation}.touch-controls button:active,.touch-controls .hard{border-color:#c1ff56}.touch-controls button:active{background:#c1ff56;color:#0b0d10}.restart{display:block;width:min(100%,360px);height:44px;margin:10px auto 0;border:0;background:#c1ff56;color:#0b0d10;font-weight:900;cursor:pointer}
@media(max-height:700px){.battle-shell{--tetris-board-height:min(460px,max(280px,calc(100dvh - 230px)))}.battle-title{margin-bottom:8px}.battle-title h1{font-size:24px}.controls{margin-top:7px}}
@media(hover:none),(pointer:coarse){.battle-shell{--tetris-board-height:min(540px,max(260px,calc(100dvh - 330px)))}.touch-controls{display:grid}.controls{display:none}}
@media(max-width:720px){.battle-shell{--tetris-board-width:min(calc(var(--tetris-board-height)/2),calc(100vw - 132px))}.battle-title{align-items:start;gap:8px}.title-tools{gap:6px;max-width:58%;}.title-tools :global(.preview-button){display:none}.invite-room small{display:none}.invite-room{padding:0 7px}.invite-tools button{padding:0 7px;max-width:104px;overflow:hidden;text-overflow:ellipsis}.stats strong{font-size:16px}.arena{grid-template-columns:max-content 92px;gap:12px}.arena.solo{grid-template-columns:max-content}.local-zone{grid-template-columns:var(--tetris-board-width) 64px;gap:10px}.next-panel{padding-top:0}.preview{width:64px}.rival{width:92px;padding-top:0}.rival-stats{flex-direction:column;gap:2px}.touch-controls{display:grid}.controls{display:none}}
@media(max-width:480px){.battle-shell{--tetris-board-width:min(calc(var(--tetris-board-height)/2),calc(100vw - 112px))}.battle-title{margin-bottom:8px}.battle-title h1{font-size:22px}.battle-title>div:first-child>span{display:none}.title-tools{max-width:64%;}.invite-tools{height:28px}.invite-room strong{font-size:9px}.invite-tools button{height:26px;font-size:7px;max-width:86px}.arena{grid-template-columns:max-content 74px;gap:8px}.local-zone{grid-template-columns:var(--tetris-board-width) 54px;gap:8px}.preview{width:54px;padding:3px}.rival{width:74px}.touch-controls{grid-template-columns:repeat(5,1fr);gap:5px}.touch-controls button{height:44px}.rival-stats{font-size:9px}}
</style>