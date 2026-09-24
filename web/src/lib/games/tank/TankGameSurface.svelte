<script>
  export let state = null
  export let identity = null
  export let assetUrls = null
  export let interactive = false
  export let onAim = () => {}
  export let onFire = () => {}
  export let compact = false

  const obstacleKeys = ['barrel', 'barricade', 'sandbag', 'tree']

  function me() {
    return state?.tanks?.find((tank) => tank.playerId === identity?.sessionId) ?? null
  }

  function positionStyle(item, size = 54) {
    if (!state?.width || !state?.height) return ''
    return `left:${item.x / state.width * 100}%;top:${item.y / state.height * 100}%;width:${size / state.width * 100}%;height:${size / state.height * 100}%`
  }

  function tankBodyStyle(tank) {
    return `${positionStyle(tank, 62)};transform:translate(-50%,-50%) rotate(${tank.angle + Math.PI / 2}rad)`
  }

  function turretStyle(tank) {
    if (!state?.width || !state?.height) return ''
    return `left:${tank.x / state.width * 100}%;top:${tank.y / state.height * 100}%;width:${28 / state.width * 100}%;height:${60 / state.height * 100}%;transform:translate(-50%,-50%) rotate(${tank.turretAngle + Math.PI / 2}rad)`
  }

  function bulletStyle(bullet) {
    const angle = Math.atan2(bullet.vy, bullet.vx) + Math.PI / 2
    return `${positionStyle(bullet, 20)};transform:translate(-50%,-50%) rotate(${angle}rad)`
  }

  function obstacleStyle(obstacle) {
    if (!state?.width || !state?.height) return ''
    return `left:${obstacle.x / state.width * 100}%;top:${obstacle.y / state.height * 100}%;width:${obstacle.w / state.width * 100}%;height:${obstacle.h / state.height * 100}%`
  }

  function obstacleAsset(index) {
    return assetUrls?.[obstacleKeys[index % obstacleKeys.length]] ?? ''
  }

  function aim(event) {
    if (!interactive || !state) return
    const tank = me()
    if (!tank) return
    const rect = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width * state.width
    const y = (event.clientY - rect.top) / rect.height * state.height
    onAim(Math.atan2(y - tank.y, x - tank.x))
  }

  function pointerDown(event) {
    if (!interactive) return
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    aim(event)
    onFire(true)
  }

  function pointerUp(event) {
    if (!interactive) return
    event.preventDefault()
    aim(event)
    onFire(false)
  }

  function tankAsset(index, kind) {
    if (index === 0) return kind === 'body' ? assetUrls?.blueBody : assetUrls?.blueTurret
    return kind === 'body' ? assetUrls?.redBody : assetUrls?.redTurret
  }
</script>

<div class:compact class="tank-surface">
  <div
    class:interactive
    class="arena"
    style={`background-image:url("${assetUrls?.grass ?? ''}")`}
    onpointermove={aim}
    onpointerdown={pointerDown}
    onpointerup={pointerUp}
    onpointercancel={() => onFire(false)}
    oncontextmenu={(event) => event.preventDefault()}
    role={interactive ? 'application' : undefined}
    aria-label="Tank battle arena"
  >
    {#each state?.obstacles ?? [] as obstacle,index}
      <div class="obstacle" style={obstacleStyle(obstacle)}>
        {#if obstacleAsset(index)}<img src={obstacleAsset(index)} alt="" draggable="false" />{/if}
      </div>
    {/each}

    {#each state?.bullets ?? [] as bullet}
      <img class="bullet" src={assetUrls?.bullet ?? ''} alt="" draggable="false" style={bulletStyle(bullet)} />
    {/each}

    {#each state?.tanks ?? [] as tank,index}
      <div class:dead={!tank.alive} class="tank-wrap">
        <img class="tank-body" src={tankAsset(index,'body') ?? ''} alt="" draggable="false" style={tankBodyStyle(tank)} />
        <img class="tank-turret" src={tankAsset(index,'turret') ?? ''} alt="" draggable="false" style={turretStyle(tank)} />
        <div class="tank-label" style={`left:${tank.x / (state?.width || 1) * 100}%;top:${tank.y / (state?.height || 1) * 100}%`}>
          <strong>{tank.name}</strong>
          <span><i style={`width:${Math.max(0,tank.hp)}%`}></i></span>
        </div>
      </div>
    {/each}

    {#if state?.roundResetTicks > 0}
      <div class="round-flash">ROUND {state.round + 1}</div>
    {/if}
  </div>

  <div class="score-strip">
    {#each state?.tanks ?? [] as tank,index}
      <div class:red={index===1} class="score-player">
        <span>{tank.name}</span>
        <strong>{tank.score ?? 0}</strong>
      </div>
    {/each}
    <div class="score-target"><span>FIRST TO</span><strong>{state?.targetScore ?? 5}</strong></div>
  </div>
</div>

<style>
  .tank-surface{width:100%;display:grid;gap:12px;user-select:none;-webkit-user-select:none}.arena{position:relative;width:100%;aspect-ratio:5/3;overflow:hidden;border:1px solid #30363f;background-color:#314b2f;background-repeat:repeat;background-size:7.5% auto;touch-action:none;box-shadow:0 20px 55px #0006 inset}.arena:after{content:'';position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at center,transparent 48%,#06100955 100%)}.arena.interactive{cursor:crosshair}.obstacle{position:absolute;display:grid;place-items:center;z-index:2;pointer-events:none}.obstacle img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 6px 4px #0005)}.tank-body,.tank-turret,.bullet{position:absolute;z-index:4;object-fit:contain;pointer-events:none;transform-origin:center}.tank-turret{z-index:5;filter:drop-shadow(0 3px 2px #0005)}.tank-body{filter:drop-shadow(0 5px 4px #0007)}.bullet{z-index:6;filter:drop-shadow(0 2px 2px #0008)}.dead .tank-body,.dead .tank-turret{opacity:.22;filter:grayscale(1)}.tank-label{position:absolute;z-index:7;transform:translate(-50%,34px);display:grid;justify-items:center;gap:3px;pointer-events:none;white-space:nowrap}.tank-label strong{padding:2px 5px;background:#0b0d10cc;color:#f4f0e8;font:900 8px ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase}.tank-label span{display:block;width:42px;height:3px;background:#111820}.tank-label i{display:block;height:100%;background:#c1ff56}.round-flash{position:absolute;z-index:10;inset:0;display:grid;place-items:center;background:#05070899;color:#f4f0e8;font:950 clamp(30px,6vw,72px) ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;pointer-events:none}.score-strip{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:10px}.score-player,.score-target{min-height:52px;border:1px solid #30363f;background:#0e1115;display:flex;align-items:center;gap:12px;padding:0 14px}.score-player strong,.score-target strong{margin-left:auto;color:#c1ff56;font:950 25px ui-monospace,SFMono-Regular,Menlo,monospace}.score-player.red{flex-direction:row-reverse;text-align:right}.score-player.red strong{margin-left:0;margin-right:auto;color:#ff6d62}.score-player span,.score-target span{color:#87909a;font-size:9px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.score-target{display:grid;place-items:center;gap:0;padding:5px 18px}.score-target strong{margin:0;font-size:18px}.compact{gap:8px}.compact .score-strip{display:none}
  @media(max-width:640px){.tank-label{transform:translate(-50%,24px)}.tank-label strong{font-size:6px}.score-player,.score-target{min-height:42px;padding:0 8px}.score-player strong{font-size:20px}.score-player span,.score-target span{font-size:7px}}
</style>
