<script>
  import { onMount } from 'svelte'
  import { createProjection, offsetAlong, projectPoint, rotatedRectangleCorners, screenToWorld } from './projection3d.js'

  export let state = null
  export let identity = null
  export let assetUrls = null
  export let interactive = false
  export let onAim = () => {}
  export let onFire = () => {}
  export let compact = false

  const PLAYER_COLORS = [
    { top: '#4da5ff', side: '#1f6098', bright: '#a7d4ff' },
    { top: '#ff6d62', side: '#963e39', bright: '#ffb2ac' },
  ]
  const OBSTACLE_COLORS = [
    { top: '#826348', side: '#503a2b', line: '#b48a63' },
    { top: '#756858', side: '#433b32', line: '#a99882' },
    { top: '#9b845e', side: '#5d4e38', line: '#c2a87c' },
    { top: '#4e6d43', side: '#2c4327', line: '#779b67' },
  ]

  let stage
  let canvas
  let context
  let projection
  let observer
  let renderFrame = 0
  let mounted = false
  let grassImage = null
  let grassSource = ''

  function me() {
    return state?.tanks?.find((tank) => tank.playerId === identity?.sessionId) ?? null
  }

  function queueRender() {
    if (!mounted || renderFrame) return
    renderFrame = requestAnimationFrame(() => {
      renderFrame = 0
      renderScene()
    })
  }

  function resize() {
    if (!canvas || !stage) return
    const width = Math.max(1, stage.clientWidth)
    const height = Math.max(1, stage.clientHeight)
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const pixelWidth = Math.round(width * dpr)
    const pixelHeight = Math.round(height * dpr)
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth
      canvas.height = pixelHeight
    }
    context = canvas.getContext('2d')
    context?.setTransform(dpr, 0, 0, dpr, 0, 0)
    projection = createProjection({
      worldWidth: state?.width ?? 1200,
      worldHeight: state?.height ?? 720,
      viewportWidth: width,
      viewportHeight: height,
      maxHeight: 84,
    })
    queueRender()
  }

  function loadGrass(source) {
    grassSource = source ?? ''
    grassImage = null
    if (!source) {
      queueRender()
      return
    }
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => {
      if (grassSource !== source) return
      grassImage = image
      queueRender()
    }
    image.onerror = () => {
      if (grassSource === source) queueRender()
    }
    image.src = source
  }

  function fillPolygon(points, fill, stroke = null, lineWidth = 1) {
    if (!context || points.length < 3) return
    context.beginPath()
    context.moveTo(points[0].x, points[0].y)
    for (let index = 1; index < points.length; index += 1) {
      context.lineTo(points[index].x, points[index].y)
    }
    context.closePath()
    context.fillStyle = fill
    context.fill()
    if (stroke) {
      context.strokeStyle = stroke
      context.lineWidth = lineWidth
      context.stroke()
    }
  }

  function projectedPolygon(points, z) {
    return points.map((point) => projectPoint(projection, point.x, point.y, z))
  }

  function drawPrism(points, baseZ, height, colors) {
    const bottom = projectedPolygon(points, baseZ)
    const top = projectedPolygon(points, baseZ + height)
    context.save()
    for (let index = 0; index < points.length; index += 1) {
      const next = (index + 1) % points.length
      fillPolygon([top[index], top[next], bottom[next], bottom[index]], colors.side)
    }
    fillPolygon(top, colors.top, colors.line ?? '#ffffff22', Math.max(0.7, projection.scale * 0.9))
    context.restore()
  }

  function rectanglePoints(rect) {
    return [
      { x: rect.x, y: rect.y },
      { x: rect.x + rect.w, y: rect.y },
      { x: rect.x + rect.w, y: rect.y + rect.h },
      { x: rect.x, y: rect.y + rect.h },
    ]
  }

  function circlePoints(x, y, radius, segments = 10) {
    return Array.from({ length: segments }, (_, index) => {
      const angle = index / segments * Math.PI * 2
      return { x: x + Math.cos(angle) * radius, y: y + Math.sin(angle) * radius }
    })
  }

  function drawGround() {
    const topLeft = projectPoint(projection, 0, 0, 0)
    const bottomRight = projectPoint(projection, state.width, state.height, 0)
    const width = bottomRight.x - topLeft.x
    const height = bottomRight.y - topLeft.y

    context.save()
    context.shadowColor = '#000a'
    context.shadowBlur = 22
    context.shadowOffsetY = 12
    context.fillStyle = '#213226'
    context.fillRect(topLeft.x, topLeft.y, width, height)
    context.restore()

    context.save()
    context.beginPath()
    context.rect(topLeft.x, topLeft.y, width, height)
    context.clip()
    context.fillStyle = '#263b2b'
    context.fillRect(topLeft.x, topLeft.y, width, height)

    if (grassImage) {
      const tile = 96
      context.globalAlpha = 0.52
      for (let y = 0; y < state.height; y += tile) {
        for (let x = 0; x < state.width; x += tile) {
          const start = projectPoint(projection, x, y, 0)
          const end = projectPoint(projection, Math.min(x + tile, state.width), Math.min(y + tile, state.height), 0)
          context.drawImage(grassImage, start.x, start.y, end.x - start.x + 1, end.y - start.y + 1)
        }
      }
      context.globalAlpha = 1
      context.fillStyle = '#0d171238'
      context.fillRect(topLeft.x, topLeft.y, width, height)
    }

    context.lineWidth = 1
    context.strokeStyle = '#dfffc00b'
    for (let x = 0; x <= state.width; x += 120) {
      const start = projectPoint(projection, x, 0, 0)
      const end = projectPoint(projection, x, state.height, 0)
      context.beginPath()
      context.moveTo(start.x, start.y)
      context.lineTo(end.x, end.y)
      context.stroke()
    }
    for (let y = 0; y <= state.height; y += 120) {
      const start = projectPoint(projection, 0, y, 0)
      const end = projectPoint(projection, state.width, y, 0)
      context.beginPath()
      context.moveTo(start.x, start.y)
      context.lineTo(end.x, end.y)
      context.stroke()
    }
    context.restore()

    context.strokeStyle = '#76916b55'
    context.lineWidth = Math.max(1, projection.scale * 3)
    context.strokeRect(topLeft.x, topLeft.y, width, height)
  }

  function drawShadow(x, y, radiusX, radiusY, alpha = 0.28) {
    const point = projectPoint(projection, x, y, 0)
    context.save()
    context.translate(point.x + projection.scale * 5, point.y + projection.scale * 7)
    context.scale(1, projection.cosTilt)
    context.beginPath()
    context.ellipse(0, 0, radiusX * projection.scale, radiusY * projection.scale, 0, 0, Math.PI * 2)
    context.fillStyle = `rgba(0,0,0,${alpha})`
    context.fill()
    context.restore()
  }

  function drawObstacle(obstacle, index) {
    const colors = OBSTACLE_COLORS[index % OBSTACLE_COLORS.length]
    const height = [42, 34, 25, 52][index % 4]
    drawShadow(obstacle.x + obstacle.w / 2, obstacle.y + obstacle.h / 2, obstacle.w * 0.48, obstacle.h * 0.48, 0.22)
    drawPrism(rectanglePoints(obstacle), 0, height, colors)

    const topCenter = projectPoint(projection, obstacle.x + obstacle.w / 2, obstacle.y + obstacle.h / 2, height + 1)
    context.save()
    context.fillStyle = colors.line
    context.globalAlpha = 0.22
    context.fillRect(topCenter.x - obstacle.w * projection.scale * 0.22, topCenter.y - 1, obstacle.w * projection.scale * 0.44, 2)
    context.restore()
  }

  function drawTank(tank, index) {
    const colors = PLAYER_COLORS[index % PLAYER_COLORS.length]
    const alpha = tank.alive ? 1 : 0.3
    context.save()
    context.globalAlpha = alpha
    drawShadow(tank.x, tank.y, 32, 25, tank.alive ? 0.36 : 0.16)

    const perpendicular = tank.angle + Math.PI / 2
    for (const direction of [-1, 1]) {
      const trackCenter = offsetAlong(tank.x, tank.y, direction * 18, perpendicular)
      drawPrism(rotatedRectangleCorners(trackCenter.x, trackCenter.y, 62, 9, tank.angle), 3, 12, {
        top: '#252c31',
        side: '#11161a',
        line: '#4a535b',
      })
    }

    drawPrism(rotatedRectangleCorners(tank.x, tank.y, 56, 36, tank.angle), 10, 21, {
      top: colors.top,
      side: colors.side,
      line: colors.bright,
    })

    const barrelCenter = offsetAlong(tank.x, tank.y, 24, tank.turretAngle)
    drawPrism(rotatedRectangleCorners(barrelCenter.x, barrelCenter.y, 49, 7, tank.turretAngle), 31, 7, {
      top: '#3d4952',
      side: '#20282e',
      line: '#66747f',
    })

    drawPrism(circlePoints(tank.x, tank.y, 15, 12), 29, 15, {
      top: colors.bright,
      side: colors.side,
      line: '#ffffff77',
    })
    drawPrism(circlePoints(tank.x, tank.y, 6, 10), 44, 5, {
      top: '#28323a',
      side: '#151b20',
      line: '#596671',
    })
    context.restore()
  }

  function drawBullet(bullet) {
    const point = projectPoint(projection, bullet.x, bullet.y, 13)
    const radius = Math.max(2.4, 5 * projection.scale)
    context.save()
    context.shadowColor = '#ffd86b'
    context.shadowBlur = Math.max(5, 11 * projection.scale)
    context.fillStyle = '#ffe59a'
    context.beginPath()
    context.arc(point.x, point.y, radius, 0, Math.PI * 2)
    context.fill()
    context.shadowBlur = 0
    context.fillStyle = '#fff8cf'
    context.beginPath()
    context.arc(point.x - radius * 0.25, point.y - radius * 0.3, radius * 0.42, 0, Math.PI * 2)
    context.fill()
    context.restore()
  }

  function drawTankLabels() {
    for (const tank of state.tanks ?? []) {
      const point = projectPoint(projection, tank.x, tank.y, 66)
      const name = String(tank.name ?? '').toUpperCase()
      context.save()
      context.font = '900 10px ui-monospace, SFMono-Regular, Menlo, monospace'
      context.textAlign = 'center'
      context.textBaseline = 'bottom'
      const width = Math.max(46, context.measureText(name).width + 12)
      context.fillStyle = '#0b0d10dc'
      context.fillRect(point.x - width / 2, point.y - 20, width, 14)
      context.fillStyle = '#f4f0e8'
      context.fillText(name, point.x, point.y - 8)
      context.fillStyle = '#111820'
      context.fillRect(point.x - 22, point.y - 4, 44, 4)
      context.fillStyle = tank.alive ? '#c1ff56' : '#59636d'
      context.fillRect(point.x - 22, point.y - 4, 44 * Math.max(0, Math.min(100, tank.hp ?? 0)) / 100, 4)
      context.restore()
    }
  }

  function renderScene() {
    if (!context || !projection || !state?.width || !state?.height) return
    const width = stage.clientWidth
    const height = stage.clientHeight
    context.clearRect(0, 0, width, height)
    context.fillStyle = '#090d10'
    context.fillRect(0, 0, width, height)

    drawGround()

    const drawables = []
    for (const [index, obstacle] of (state.obstacles ?? []).entries()) {
      drawables.push({ depth: obstacle.y + obstacle.h, draw: () => drawObstacle(obstacle, index) })
    }
    for (const [index, tank] of (state.tanks ?? []).entries()) {
      drawables.push({ depth: tank.y + 27, draw: () => drawTank(tank, index) })
    }
    for (const bullet of state.bullets ?? []) {
      drawables.push({ depth: bullet.y + 6, draw: () => drawBullet(bullet) })
    }
    drawables.sort((left, right) => left.depth - right.depth)
    for (const item of drawables) item.draw()
    drawTankLabels()
  }

  function aim(event) {
    if (!interactive || !state || !projection) return
    const tank = me()
    if (!tank) return
    const rect = canvas.getBoundingClientRect()
    const world = screenToWorld(projection, event.clientX - rect.left, event.clientY - rect.top, { clamp: true })
    onAim(Math.atan2(world.y - tank.y, world.x - tank.x))
  }

  function pointerDown(event) {
    if (!interactive) return
    event.preventDefault()
    canvas.setPointerCapture?.(event.pointerId)
    aim(event)
    onFire(true)
  }

  function pointerUp(event) {
    if (!interactive) return
    event.preventDefault()
    aim(event)
    onFire(false)
  }

  onMount(() => {
    mounted = true
    observer = new ResizeObserver(resize)
    observer.observe(stage)
    resize()
    loadGrass(assetUrls?.grass)
    return () => {
      mounted = false
      observer?.disconnect()
      if (renderFrame) cancelAnimationFrame(renderFrame)
    }
  })

  $: if (mounted && assetUrls?.grass !== grassSource) loadGrass(assetUrls?.grass)
  $: if (mounted && state) {
    state.tick
    state.roundResetTicks
    resize()
    queueRender()
  }
</script>

<div class:compact class="tank-surface">
  <div bind:this={stage} class:interactive class="arena-stage">
    <canvas
      bind:this={canvas}
      onpointermove={aim}
      onpointerdown={pointerDown}
      onpointerup={pointerUp}
      onpointercancel={() => onFire(false)}
      oncontextmenu={(event) => event.preventDefault()}
      role={interactive ? 'application' : undefined}
      aria-label="Tank battle arena"
    ></canvas>
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
  .tank-surface{width:100%;display:grid;gap:12px;user-select:none;-webkit-user-select:none}.arena-stage{position:relative;width:100%;aspect-ratio:5/3;overflow:hidden;border:1px solid #30363f;background:#090d10;touch-action:none;box-shadow:0 20px 55px #0008 inset}.arena-stage:after{content:'';position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 50% 42%,transparent 48%,#02040566 100%);z-index:2}.arena-stage.interactive{cursor:crosshair}.arena-stage canvas{position:absolute;inset:0;width:100%;height:100%;display:block;z-index:1}.round-flash{position:absolute;z-index:10;inset:0;display:grid;place-items:center;background:#05070899;color:#f4f0e8;font:950 clamp(30px,6vw,72px) ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;pointer-events:none}.score-strip{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:10px}.score-player,.score-target{min-height:52px;border:1px solid #30363f;background:#0e1115;display:flex;align-items:center;gap:12px;padding:0 14px}.score-player strong,.score-target strong{margin-left:auto;color:#c1ff56;font:950 25px ui-monospace,SFMono-Regular,Menlo,monospace}.score-player.red{flex-direction:row-reverse;text-align:right}.score-player.red strong{margin-left:0;margin-right:auto;color:#ff6d62}.score-player span,.score-target span{color:#87909a;font-size:9px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.score-target{display:grid;place-items:center;gap:0;padding:5px 18px}.score-target strong{margin:0;font-size:18px}.compact{gap:8px}.compact .score-strip{display:none}
  @media(max-width:640px){.score-player,.score-target{min-height:42px;padding:0 8px}.score-player strong{font-size:20px}.score-player span,.score-target span{font-size:7px}}
</style>
