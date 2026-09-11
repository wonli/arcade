<script>
  import { onMount } from 'svelte'

  export let room
  export let roomCode
  export let identity
  export let socket

  let state = room?.state ?? null
  let privateWord = ''
  let privateRound = 0
  let messages = []
  let guess = ''
  let error = ''
  let copied = false
  let remaining = 60
  let canvas
  let context
  let drawing = false
  let pendingPoints = []
  let color = '#111111'
  let width = 6
  let eraser = false
  let unsubscribe = () => {}
  let timer = null
  let resizeObserver = null
  let audioContext = null

  const palette = ['#111111', '#ff5d5d', '#ffcf5a', '#c1ff56', '#65d5ff', '#a98bff']

  function isHost() { return room?.hostId === identity.sessionId }
  function isDrawer() { return state?.drawerId === identity.sessionId && state?.status === 'playing' }
  function alreadyGuessed() { return state?.guessed?.includes(identity.sessionId) ?? false }

  function tone(frequency, duration = .06, volume = .022, delay = 0) {
    if (typeof window === 'undefined') return
    audioContext ??= new AudioContext()
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => {})
    const oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()
    const start = audioContext.currentTime + delay
    oscillator.type = 'sine'
    oscillator.frequency.value = frequency
    gain.gain.setValueAtTime(volume, start)
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration)
    oscillator.connect(gain)
    gain.connect(audioContext.destination)
    oscillator.start(start)
    oscillator.stop(start + duration)
  }

  function play(name) {
    if (name === 'round') { tone(360,.05); tone(520,.07,.025,.06) }
    if (name === 'correct') { tone(660,.06); tone(880,.1,.028,.05) }
    if (name === 'finish') { tone(440,.08); tone(660,.08,.025,.08); tone(880,.14,.03,.16) }
  }

  function addMessage(kind, text, name = '') {
    messages = [...messages.slice(-39), { kind, text, name, id: crypto.randomUUID() }]
  }

  function applyState(next, sound = true) {
    if (!next) return
    const previous = state
    state = next
    updateRemaining()
    requestAnimationFrame(redraw)
    if (sound && previous?.round !== next.round && next.status === 'playing') play('round')
    if (sound && previous?.status !== 'finished' && next.status === 'finished') play('finish')
    syncPrivateWord()
  }

  async function syncPrivateWord() {
    if (!isDrawer()) {
      privateWord = ''
      privateRound = 0
      return
    }
    if (privateRound === state.round && privateWord) return
    try {
      const result = await socket.request('draw.privateState', { roomId: roomCode })
      if (result?.round === state.round && result?.drawerId === identity.sessionId) {
        privateWord = result.word ?? ''
        privateRound = state.round
      }
    } catch (err) {
      error = err.message
    }
  }

  async function start() {
    error = ''
    messages = []
    privateWord = ''
    privateRound = 0
    try { await socket.request('draw.start', { roomId: roomCode }) }
    catch (err) { error = err.message }
  }

  async function copyInvite() {
    await navigator.clipboard.writeText(`${location.origin}/room/${roomCode.toLowerCase()}/drawguess`)
    copied = true
    setTimeout(() => (copied = false), 1200)
  }

  async function submitGuess() {
    const text = guess.trim()
    if (!text || isDrawer() || alreadyGuessed() || state?.status !== 'playing') return
    guess = ''
    error = ''
    try { await socket.request('draw.guess', { roomId: roomCode, text }) }
    catch (err) { error = err.message }
  }

  async function clearCanvas() {
    if (!isDrawer()) return
    error = ''
    try { await socket.request('draw.clear', { roomId: roomCode }) }
    catch (err) { error = err.message }
  }

  function logicalPoint(event) {
    const rect = canvas.getBoundingClientRect()
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    }
  }

  function pointerDown(event) {
    if (!isDrawer()) return
    event.preventDefault()
    canvas.setPointerCapture?.(event.pointerId)
    drawing = true
    const point = logicalPoint(event)
    pendingPoints = [point]
  }

  function pointerMove(event) {
    if (!drawing || !isDrawer()) return
    event.preventDefault()
    const point = logicalPoint(event)
    const previous = pendingPoints[pendingPoints.length - 1]
    if (previous) drawSegment(previous, point, { color, width, eraser })
    pendingPoints = [...pendingPoints, point]
    if (pendingPoints.length >= 12) flushStroke(false)
  }

  function pointerUp(event) {
    if (!drawing) return
    event.preventDefault()
    const point = logicalPoint(event)
    const previous = pendingPoints[pendingPoints.length - 1]
    if (previous && (previous.x !== point.x || previous.y !== point.y)) {
      drawSegment(previous, point, { color, width, eraser })
      pendingPoints = [...pendingPoints, point]
    }
    drawing = false
    flushStroke(true)
  }

  function flushStroke(final) {
    if (pendingPoints.length < 2) {
      if (final) pendingPoints = []
      return
    }
    const points = pendingPoints
    const stroke = { points, color, width, eraser }
    const tail = points[points.length - 1]
    pendingPoints = final ? [] : [tail]
    socket.request('draw.stroke', { roomId: roomCode, stroke }).catch((err) => { error = err.message })
  }

  function resizeCanvas() {
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const dpr = Math.max(1, window.devicePixelRatio || 1)
    const nextWidth = Math.max(1, Math.round(rect.width * dpr))
    const nextHeight = Math.max(1, Math.round(rect.height * dpr))
    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
      canvas.width = nextWidth
      canvas.height = nextHeight
      context = canvas.getContext('2d')
      redraw()
    }
  }

  function redraw() {
    if (!canvas || !context) return
    context.save()
    context.globalCompositeOperation = 'source-over'
    context.fillStyle = '#f7f4ed'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.restore()
    for (const stroke of state?.strokes ?? []) drawStroke(stroke)
  }

  function drawStroke(stroke) {
    const points = stroke?.points ?? []
    for (let index = 1; index < points.length; index++) {
      drawSegment(points[index - 1], points[index], stroke)
    }
  }

  function drawSegment(a, b, stroke) {
    if (!context || !canvas) return
    context.save()
    context.globalCompositeOperation = stroke.eraser ? 'destination-out' : 'source-over'
    context.strokeStyle = stroke.color || '#111111'
    context.lineWidth = Math.max(2, (stroke.width || 6) * canvas.width / 800)
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.beginPath()
    context.moveTo(a.x * canvas.width, a.y * canvas.height)
    context.lineTo(b.x * canvas.width, b.y * canvas.height)
    context.stroke()
    context.restore()
  }

  function updateRemaining() {
    if (!state?.deadline || state.status !== 'playing') { remaining = 0; return }
    remaining = Math.max(0, Math.ceil((new Date(state.deadline).getTime() - Date.now()) / 1000))
  }

  function sortedPlayers() {
    const players = state?.players ?? room?.players ?? []
    return [...players].sort((a, b) => (state?.scores?.[b.id] ?? 0) - (state?.scores?.[a.id] ?? 0))
  }

  function statusTitle() {
    if (!state || room?.status === 'waiting') return 'Waiting room'
    if (state.status === 'finished') {
      if (state.winners?.includes(identity.sessionId)) return 'You win'
      const winner = state.players?.find((player) => state.winners?.includes(player.id))
      return winner ? `${winner.name} wins` : 'Game finished'
    }
    return isDrawer() ? 'Your turn to draw' : `${state.drawerName} is drawing`
  }

  onMount(() => {
    const topic = `room:${roomCode.toUpperCase()}`
    unsubscribe = socket.subscribe(topic, (message) => {
      if (message.data?.topicId !== topic) return
      const payload = message.data.message
      if (!payload?.type?.startsWith('draw.')) return
      if (payload.type === 'draw.state') applyState(payload.state)
      if (payload.type === 'draw.stroke' && payload.playerId !== identity.sessionId) {
        state = { ...state, strokes: [...(state?.strokes ?? []), payload.stroke] }
        drawStroke(payload.stroke)
      }
      if (payload.type === 'draw.clear') {
        state = { ...state, strokes: [] }
        redraw()
      }
      if (payload.type === 'draw.chat') addMessage('chat', payload.text, payload.playerName)
      if (payload.type === 'draw.correct') {
        addMessage('correct', 'guessed it!', payload.playerName)
        play('correct')
        if (payload.state) applyState(payload.state, false)
      }
    })

    context = canvas?.getContext('2d')
    resizeObserver = new ResizeObserver(resizeCanvas)
    if (canvas) resizeObserver.observe(canvas)
    resizeCanvas()
    applyState(room?.state, false)
    timer = setInterval(updateRemaining, 250)

    return () => {
      unsubscribe()
      if (timer) clearInterval(timer)
      resizeObserver?.disconnect()
      audioContext?.close()
    }
  })
</script>

<section class="draw-shell">
  {#if room?.status === 'waiting' && !state}
    <div class="lobby-head">
      <div><span>DRAW & GUESS</span><h1>Waiting room</h1><p>{room.players.length}/{room.maxPlayers} players · 2 minimum · Host starts</p></div>
      <div class="code"><strong>{roomCode.toLowerCase()}</strong><small>ROOM CODE</small></div>
    </div>
    <div class="lobby-grid">
      <div class="roster">
        {#each room.players as player, index}
          <div class="roster-row"><i>{index + 1}</i><strong>{player.name}</strong><span>{player.id === room.hostId ? 'HOST' : 'READY'}</span></div>
        {/each}
      </div>
      <aside class="lobby-actions">
        <button class="outline" onclick={copyInvite}>{copied ? 'Link copied' : 'Copy invite link'}</button>
        {#if isHost()}<button class="primary" disabled={room.players.length < 2} onclick={start}>Start game</button>{:else}<p>Waiting for host to start…</p>{/if}
      </aside>
    </div>
  {:else}
    <div class="game-head">
      <div><span>DRAW & GUESS</span><h1>{statusTitle()}</h1><p>{state?.status === 'playing' ? `ROUND ${state.round} / ${state.totalRounds}` : 'FINAL SCORE'}</p></div>
      {#if state?.status === 'playing'}<div class:danger={remaining <= 10} class="timer"><strong>{remaining}</strong><small>SECONDS</small></div>{/if}
    </div>

    <div class="game-grid">
      <div class="canvas-column">
        <div class:locked={!isDrawer()} class="canvas-frame">
          <canvas bind:this={canvas} onpointerdown={pointerDown} onpointermove={pointerMove} onpointerup={pointerUp} onpointercancel={pointerUp} aria-label="Drawing canvas"></canvas>
          {#if !isDrawer() && state?.status === 'playing'}<div class="watching">WATCH & GUESS</div>{/if}
        </div>

        <div class="word-bar">
          <span>{isDrawer() ? 'YOUR WORD' : 'WORD'}</span>
          <strong>{isDrawer() ? (privateWord || 'loading…') : (state?.hint ?? '')}</strong>
        </div>

        {#if isDrawer() && state?.status === 'playing'}
          <div class="tools">
            <div class="palette">
              {#each palette as item}<button class:active={!eraser && color === item} style={`--swatch:${item}`} aria-label={`Color ${item}`} onclick={() => { color = item; eraser = false }}></button>{/each}
            </div>
            <div class="widths">
              {#each [4, 8, 14] as item}<button class:active={width === item && !eraser} onclick={() => { width = item; eraser = false }}>{item}px</button>{/each}
            </div>
            <button class:active={eraser} class="tool" onclick={() => (eraser = !eraser)}>Eraser</button>
            <button class="tool danger-button" onclick={clearCanvas}>Clear</button>
          </div>
        {/if}
      </div>

      <aside class="side-panel">
        <section class="scores">
          <div class="panel-title">SCOREBOARD</div>
          {#each sortedPlayers() as player, index}
            <div class="score-row">
              <span>{index + 1}</span>
              <div><strong>{player.name}</strong><small>{player.id === state?.drawerId ? 'DRAWING' : state?.guessed?.includes(player.id) ? 'GUESSED' : 'PLAYING'}</small></div>
              <b>{state?.scores?.[player.id] ?? 0}</b>
            </div>
          {/each}
        </section>

        <section class="chat">
          <div class="panel-title">GUESSES</div>
          <div class="messages">
            {#if messages.length === 0}<p class="empty">Bad guesses will appear here. Great guesses stay secret.</p>{/if}
            {#each messages as message}
              <div class:correct={message.kind === 'correct'} class="message"><strong>{message.name}</strong><span>{message.text}</span></div>
            {/each}
          </div>
          {#if state?.status === 'playing' && !isDrawer()}
            <div class="guess-box">
              <input bind:value={guess} disabled={alreadyGuessed()} maxlength="48" placeholder={alreadyGuessed() ? 'YOU GOT IT!' : 'TYPE YOUR GUESS'} onkeydown={(event) => event.key === 'Enter' && submitGuess()} />
              <button disabled={alreadyGuessed()} onclick={submitGuess}>Guess</button>
            </div>
          {/if}
        </section>
      </aside>
    </div>

    {#if state?.status === 'finished' && isHost()}<button class="play-again" onclick={start}>Play again</button>{/if}
  {/if}

  {#if error}<div class="draw-error">{error}</div>{/if}
</section>

<style>
  .draw-shell{width:min(100%,1200px);margin:0 auto}.lobby-head,.game-head{display:flex;align-items:end;justify-content:space-between;gap:24px;margin-bottom:24px}.lobby-head span,.game-head span,.panel-title,.word-bar span{color:#7f8791;font-size:10px;font-weight:900;letter-spacing:.18em}.lobby-head h1,.game-head h1{margin:5px 0 0;font-size:clamp(30px,5vw,48px);letter-spacing:-.045em}.lobby-head p,.game-head p{margin:7px 0 0;color:#69727d;font-size:11px;letter-spacing:.12em}.code{text-align:right}.code strong{display:block;color:#c1ff56;font:900 28px ui-monospace,monospace;letter-spacing:.08em}.code small{color:#69727d;font-size:9px;letter-spacing:.14em}.lobby-grid{display:grid;grid-template-columns:minmax(320px,1fr) 260px;gap:24px}.roster{border:1px solid #2d333b;background:#0b0d10}.roster-row{display:grid;grid-template-columns:28px 1fr auto;align-items:center;gap:12px;padding:15px 16px;border-bottom:1px solid #20252c}.roster-row:last-child{border-bottom:0}.roster-row i{display:grid;place-items:center;width:24px;height:24px;background:#c1ff56;color:#0b0d10;font-style:normal;font-weight:900;font-size:10px}.roster-row span{color:#69727d;font-size:9px;letter-spacing:.12em}.lobby-actions{display:flex;flex-direction:column;gap:10px}.lobby-actions button,.play-again{height:48px;font-weight:900;cursor:pointer}.outline{border:1px solid #3b424c;background:transparent;color:#f4f0e8}.primary,.play-again{border:0;background:#c1ff56;color:#0b0d10}.primary:disabled{opacity:.35;cursor:not-allowed}.lobby-actions p{color:#7f8791;font-size:12px;text-align:center}.timer{display:flex;flex-direction:column;align-items:flex-end}.timer strong{font:900 44px ui-monospace,monospace;color:#c1ff56;line-height:1}.timer small{margin-top:5px;color:#69727d;font-size:8px;letter-spacing:.14em}.timer.danger strong{color:#ff6b6b}.game-grid{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:22px;align-items:start}.canvas-frame{position:relative;aspect-ratio:16/10;border:1px solid #30363f;background:#f7f4ed;box-shadow:10px 10px 0 #050607;touch-action:none}.canvas-frame canvas{display:block;width:100%;height:100%;cursor:crosshair;touch-action:none}.canvas-frame.locked canvas{cursor:default}.watching{position:absolute;right:12px;bottom:10px;padding:6px 8px;background:#0b0d10;color:#7f8791;font-size:8px;font-weight:900;letter-spacing:.14em;pointer-events:none}.word-bar{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-top:18px;padding:15px 16px;border:1px solid #2d333b;background:#0b0d10}.word-bar strong{font:900 clamp(20px,4vw,30px) ui-monospace,monospace;letter-spacing:.18em;color:#f4f0e8}.tools{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin-top:10px}.palette,.widths{display:flex;gap:6px}.palette button{width:30px;height:30px;border:2px solid #30363f;background:var(--swatch);cursor:pointer}.palette button.active{outline:2px solid #f4f0e8;outline-offset:2px}.widths button,.tool{height:32px;padding:0 10px;border:1px solid #30363f;background:#0b0d10;color:#8f98a3;font-size:10px;font-weight:800;cursor:pointer}.widths button.active,.tool.active{border-color:#c1ff56;color:#c1ff56}.danger-button{margin-left:auto;color:#ff8d8d}.side-panel{display:grid;gap:14px}.scores,.chat{border:1px solid #2d333b;background:#0b0d10;padding:15px}.score-row{display:grid;grid-template-columns:22px 1fr auto;align-items:center;gap:9px;padding:10px 0;border-bottom:1px solid #20252c}.score-row>span{color:#59616b;font:900 10px ui-monospace,monospace}.score-row div{display:flex;flex-direction:column;gap:2px;min-width:0}.score-row strong{overflow:hidden;text-overflow:ellipsis;font-size:11px}.score-row small{color:#69727d;font-size:7px;letter-spacing:.1em}.score-row b{color:#c1ff56;font:900 16px ui-monospace,monospace}.chat{display:flex;flex-direction:column;min-height:330px}.messages{flex:1;max-height:310px;overflow:auto;margin:10px 0}.empty{color:#59616b;font-size:11px;line-height:1.5}.message{padding:8px 0;border-bottom:1px solid #1d2228;font-size:11px}.message strong{margin-right:7px;color:#8f98a3}.message span{color:#d7d3ca}.message.correct span{color:#c1ff56;font-weight:900}.guess-box{display:grid;grid-template-columns:1fr 68px;gap:7px}.guess-box input,.guess-box button{height:38px;border-radius:0}.guess-box input{min-width:0;padding:0 10px;border:1px solid #30363f;background:#111419;color:#f4f0e8;font-size:11px}.guess-box button{border:0;background:#c1ff56;color:#0b0d10;font-weight:900;cursor:pointer}.guess-box input:disabled,.guess-box button:disabled{opacity:.35}.play-again{display:block;width:min(100%,420px);margin:24px auto 0}.draw-error{margin-top:16px;color:#ff8d8d;text-align:center;font-size:12px}
  @media(max-width:900px){.game-grid,.lobby-grid{grid-template-columns:1fr}.side-panel{grid-template-columns:1fr 1fr}.canvas-frame{box-shadow:6px 6px 0 #050607}}@media(max-width:620px){.lobby-head,.game-head{align-items:start}.side-panel{grid-template-columns:1fr}.tools{align-items:flex-start}.danger-button{margin-left:0}.word-bar{align-items:flex-start;flex-direction:column;gap:7px}.word-bar strong{font-size:20px}.game-grid{gap:16px}}
</style>
