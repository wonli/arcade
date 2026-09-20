<script>
  import {
    createEmptyRoomTemplate,
    parseRoomTemplate,
    serializeRoomTemplate,
    validateRoomTemplate,
  } from '$lib/games/dungeon/room-template.js'
  import { listDungeon3RoomAssets } from '$lib/games/dungeon/room-template-assets.js'
  import {
    createRoomEditorState,
    eraseAt,
    placeAsset,
    placePort,
    setCellKind,
  } from '$lib/games/dungeon/room-template-editor.js'

  const assets = listDungeon3RoomAssets()
  const assetsByKey = new Map(assets.map((asset) => [asset.key, asset]))
  const groups = [
    { key: 'terrain', label: '水域', kinds: ['water'] },
    { key: 'walls', label: '墙体', kinds: ['wall'] },
    { key: 'doors', label: '门', kinds: ['door'] },
    { key: 'bridges', label: '桥', kinds: ['bridge'] },
    { key: 'stairs', label: '楼梯', kinds: ['stairs'] },
  ]

  let state = createRoomEditorState(createEmptyRoomTemplate({ id: 'room-01', width: 24, height: 16 }))
  let selectedAsset = assets[0]
  let selectedTool = 'place'
  let paintKind = 'water'
  let past = []
  let future = []
  let message = ''
  let fileInput
  let pointerPainting = false
  let roomId = 'room-01'

  $: template = state.template
  $: gridCells = buildGridCells(template)
  $: selectedVisual = selectedAsset?.cells?.[0]
  $: validation = validateRoomTemplate(template)

  function buildGridCells(current) {
    const byKey = new Map((current.cells ?? []).map((cell) => [`${cell.x},${cell.y}`, cell]))
    const result = []
    for (let y = 0; y < current.grid.height; y += 1) {
      for (let x = 0; x < current.grid.width; x += 1) {
        result.push(byKey.get(`${x},${y}`) ?? { x, y, kind: 'floor', level: 1 })
      }
    }
    return result
  }

  function sourceForCell(placement, x, y) {
    const localX = x - placement.x
    const localY = y - placement.y
    return placement.source?.cells?.find((cell) => cell.x === localX && cell.y === localY)?.source
      ?? placement.source?.cells?.[0]?.source
  }

  function placementVisual(x, y) {
    const placement = [...(template.placements ?? [])].reverse().find((entry) => (
      x >= entry.x && x < entry.x + entry.width && y >= entry.y && y < entry.y + entry.height
    ))
    if (!placement) return null
    return { placement, asset: assetsByKey.get(placement.asset), source: sourceForCell(placement, x, y) }
  }

  function spriteStyle(source, asset) {
    if (!source || !asset) return ''
    const tileset = asset.columns || 1
    const tileX = source.tileId % tileset
    const tileY = Math.floor(source.tileId / tileset)
    const flipX = source.flipX ? ' scaleX(-1)' : ''
    const flipY = source.flipY ? ' scaleY(-1)' : ''
    return `--sprite-image: url("${asset.image}"); --sprite-columns: ${tileset}; --sprite-x: ${tileX}; --sprite-y: ${tileY}; --sprite-transform: scaleX(${source.flipX ? -1 : 1}) scaleY(${source.flipY ? -1 : 1});`
  }

  function paletteStyle(asset) {
    const source = asset.cells[0]
    return spriteStyle(source, asset)
  }

  function snapshot(value) {
    return JSON.parse(JSON.stringify(value))
  }

  function commit(next, label = '') {
    if (next.errors?.length) {
      state = next
      message = '当前操作未应用：请查看右侧错误。'
      return false
    }
    past = [...past, snapshot(state.template)].slice(-40)
    future = []
    state = { ...next, selectedAsset, selectedTool }
    message = label
    return true
  }

  function chooseAsset(asset) {
    selectedAsset = asset
    selectedTool = 'place'
    state = { ...state, selectedAsset: asset.key, selectedTool }
    message = `已选择：${asset.label}`
  }

  function applyAt(x, y) {
    let next
    if (selectedTool === 'erase') next = eraseAt(state, x, y)
    else if (selectedTool === 'paint') next = setCellKind(state, x, y, paintKind)
    else if (selectedTool === 'port') {
      const edge = x === 0 ? 'west' : x === template.grid.width - 1 ? 'east' : y === 0 ? 'north' : 'south'
      next = placePort(state, {
        id: `port-${template.ports.length + 1}`,
        edge,
        x,
        y,
        kind: 'door',
        level: template.cells.find((cell) => cell.x === x && cell.y === y)?.level ?? 1,
        water: template.cells.find((cell) => cell.x === x && cell.y === y)?.kind === 'water',
      })
    } else next = placeAsset(state, selectedAsset, x, y)
    commit(next, selectedTool === 'port' ? '已添加连接端口' : '')
  }

  function beginCell(event, x, y) {
    event.preventDefault()
    pointerPainting = true
    applyAt(x, y)
  }

  function enterCell(event, x, y) {
    if (pointerPainting && event.buttons) applyAt(x, y)
  }

  function stopPainting() { pointerPainting = false }

  function selectTool(tool) {
    selectedTool = tool
    state = { ...state, selectedTool }
    message = tool === 'erase' ? '橡皮擦已启用' : tool === 'port' ? '点击房间边缘添加门洞连接端口' : '地形画笔已启用'
  }

  function undo() {
    if (!past.length) return
    const previous = past[past.length - 1]
    past = past.slice(0, -1)
    future = [snapshot(template), ...future].slice(0, 40)
    state = { ...createRoomEditorState(previous), selectedAsset, selectedTool }
    message = '已撤销'
  }

  function redo() {
    if (!future.length) return
    const next = future[0]
    future = future.slice(1)
    past = [...past, snapshot(template)].slice(-40)
    state = { ...createRoomEditorState(next), selectedAsset, selectedTool }
    message = '已重做'
  }

  function newRoom() {
    const id = roomId.trim() || 'untitled-room'
    const next = createRoomEditorState(createEmptyRoomTemplate({ id, name: id, width: 24, height: 16 }))
    past = []
    future = []
    state = { ...next, selectedAsset, selectedTool: 'place' }
    selectedTool = 'place'
    message = '已创建空白房间：没有自动添加墙、门或装饰。'
  }

  function exportJson() {
    try {
      const text = serializeRoomTemplate(template)
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `dungeon3-room-${template.id}.json`
      link.click()
      URL.revokeObjectURL(url)
      message = 'JSON 已导出'
    } catch (error) {
      message = error.message
    }
  }

  function openImport() { fileInput?.click() }

  async function importJson(event) {
    const file = event.currentTarget.files?.[0]
    if (!file) return
    try {
      const imported = parseRoomTemplate(await file.text())
      past = [...past, snapshot(template)].slice(-40)
      future = []
      state = { ...createRoomEditorState(imported), selectedAsset, selectedTool }
      roomId = imported.id
      message = `已导入：${file.name}`
    } catch (error) {
      state = { ...state, errors: [{ path: 'import', message: error.message }] }
      message = '导入失败，原房间保持不变。'
    } finally {
      event.currentTarget.value = ''
    }
  }

  function validateNow() {
    message = validation.valid ? '验证通过，可以导出模板。' : '验证失败，请处理右侧错误。'
    state = { ...state, errors: validation.valid ? [] : validation.errors }
  }
</script>

<svelte:head>
  <title>Dungeon3 Room Template Editor</title>
</svelte:head>

<div class="editor-shell" on:pointerup={stopPainting} on:pointerleave={stopPainting}>
  <header class="editor-topbar">
    <div>
      <p class="eyebrow">DUNGEON3 / AUTHORING TOOL</p>
      <h1>房间模板编辑器</h1>
      <p class="subtitle">只摆放真实 Dungeon3 资源，随机生成器以后只组合你确认过的房间。</p>
    </div>
    <div class="top-actions">
      <input bind:value={roomId} aria-label="Room id" class="room-id" />
      <button class="primary" on:click={newRoom}>New room</button>
      <button on:click={undo} disabled={!past.length}>Undo</button>
      <button on:click={redo} disabled={!future.length}>Redo</button>
      <button on:click={openImport}>Import JSON</button>
      <button class="primary" on:click={exportJson}>Export JSON</button>
      <input class="hidden-input" bind:this={fileInput} type="file" accept="application/json,.json" on:change={importJson} />
    </div>
  </header>

  <main class="workspace">
    <aside class="panel palette-panel">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">PALETTE</p>
          <h2>真实资源</h2>
        </div>
        <span class="count">{assets.length}</span>
      </div>
      <div class="tool-row">
        <button class:active={selectedTool === 'paint'} on:click={() => selectTool('paint')}>Paint</button>
        <button class:active={selectedTool === 'erase'} on:click={() => selectTool('erase')}>Erase</button>
        <button class:active={selectedTool === 'port'} on:click={() => selectTool('port')}>Add port</button>
      </div>
      {#if selectedTool === 'paint'}
        <div class="paint-row">
          <button class:active={paintKind === 'floor'} on:click={() => paintKind = 'floor'}>Floor</button>
          <button class:active={paintKind === 'water'} on:click={() => paintKind = 'water'}>Water</button>
        </div>
      {/if}
      {#each groups as group}
        <section class="asset-group">
          <h3>{group.label}</h3>
          <div class="asset-list">
            {#each assets.filter((asset) => group.kinds.includes(asset.kind)) as asset (asset.key)}
              <button class:chosen={selectedAsset.key === asset.key} class="asset-card" on:pointerdown={(event) => { event.preventDefault(); chooseAsset(asset) }}>
                <span class="asset-sprite" style={paletteStyle(asset)}></span>
                <span class="asset-copy"><strong>{asset.label}</strong><small>{asset.key}</small></span>
              </button>
            {/each}
          </div>
        </section>
      {/each}
    </aside>

    <section class="canvas-panel">
      <div class="canvas-heading">
        <div>
          <p class="eyebrow">ROOM SURFACE</p>
          <h2>{template.name}</h2>
        </div>
        <div class="surface-meta">{template.grid.width} × {template.grid.height} tiles · 16px native grid</div>
      </div>
      <div class="surface-scroll">
        <div class="room-surface" class:native-grid={true} style={`--cols:${template.grid.width}; --rows:${template.grid.height};`} on:pointerup={stopPainting}>
          {#each gridCells as cell (`${cell.x},${cell.y}`)}
            {@const visual = placementVisual(cell.x, cell.y)}
            <button
              class:water-cell={cell.kind === 'water'}
              class:port-cell={template.ports.some((port) => port.x === cell.x && port.y === cell.y)}
              class="grid-cell"
              aria-label={`cell ${cell.x},${cell.y}`}
              title={`${cell.x},${cell.y} · ${cell.kind}`}
              on:pointerdown={(event) => beginCell(event, cell.x, cell.y)}
              on:pointerenter={(event) => enterCell(event, cell.x, cell.y)}
            >
              {#if visual}
                <span class="placed-sprite" style={spriteStyle(visual.source, visual.asset)}></span>
              {:else if cell.kind === 'water'}
                <span class="water-glyph">≈</span>
              {/if}
            </button>
          {/each}
        </div>
      </div>
      <div class="canvas-status">
        <span class="status-dot"></span>
        {message || '选择左侧资源，然后点击或拖过网格。水面、墙、门、楼梯和桥都不会被自动猜测。'}
      </div>
    </section>

    <aside class="panel inspector-panel">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">INSPECTOR</p>
          <h2>模板检查</h2>
        </div>
        <button class="validate-button" on:click={validateNow}>Validate</button>
      </div>
      <dl class="facts">
        <div><dt>ID</dt><dd>{template.id}</dd></div>
        <div><dt>尺寸</dt><dd>{template.grid.width} × {template.grid.height} / 16px</dd></div>
        <div><dt>图块</dt><dd>{template.placements.length}</dd></div>
        <div><dt>端口</dt><dd>{template.ports.length}</dd></div>
      </dl>
      <div class="inspector-block">
        <h3>当前资源</h3>
        {#if selectedAsset}
          <div class="selected-asset">
            <span class="asset-sprite large" style={paletteStyle(selectedAsset)}></span>
            <div><strong>{selectedAsset.label}</strong><small>{selectedAsset.key}</small><small>{selectedAsset.width} × {selectedAsset.height} · rotations {selectedAsset.allowedRotations.join(', ')}</small></div>
          </div>
        {/if}
      </div>
      <div class="inspector-block">
        <h3>连接端口</h3>
        {#if template.ports.length}
          <ul class="port-list">
            {#each template.ports as port}
              <li><span>{port.edge}</span><code>{port.x},{port.y}</code><small>{port.kind}</small></li>
            {/each}
          </ul>
        {:else}
          <p class="muted">还没有端口。使用 Add port 在边缘放置门洞连接点。</p>
        {/if}
      </div>
      <div class="inspector-block validation-block">
        <h3>验证结果</h3>
        {#if state.errors.length}
          <ul class="error-list">
            {#each state.errors as error}
              <li><code>{error.path || '<root>'}</code> {error.message}</li>
            {/each}
          </ul>
        {:else if validation.valid}
          <p class="valid">✓ 当前模板可导出</p>
        {:else}
          <p class="invalid">有 {validation.errors.length} 个问题</p>
        {/if}
      </div>
    </aside>
  </main>
</div>

<style>
  :global(*) { box-sizing: border-box; }
  :global(body) { margin: 0; background: #090b0e; color: #eee8df; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  :global(button), :global(input) { font: inherit; }
  :global(button) { color: inherit; }
  .editor-shell { min-height: 100vh; padding: 26px; background: radial-gradient(circle at 52% 38%, #1b2228 0, #0b0d10 52%, #07080a 100%); }
  .editor-topbar { display: flex; justify-content: space-between; gap: 28px; align-items: end; max-width: 1680px; margin: 0 auto 18px; padding: 0 0 18px; border-bottom: 1px solid #293039; }
  h1, h2, h3, p { margin: 0; }
  h1 { font-size: clamp(24px, 3vw, 38px); letter-spacing: -0.04em; }
  h2 { font-size: 17px; }
  h3 { color: #a6afb6; font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; }
  .eyebrow { color: #4edfc4; font-size: 10px; letter-spacing: 0.18em; font-weight: 800; margin-bottom: 7px; }
  .subtitle { margin-top: 7px; color: #869098; font-size: 13px; }
  .top-actions, .tool-row, .paint-row { display: flex; gap: 7px; align-items: center; flex-wrap: wrap; }
  button { border: 1px solid #303b43; border-radius: 6px; background: #141a1f; padding: 8px 10px; cursor: pointer; transition: border-color .15s, background .15s, transform .15s; }
  button:hover:not(:disabled) { border-color: #54ceb8; background: #1a2a2b; }
  button:active:not(:disabled) { transform: translateY(1px); }
  button:disabled { cursor: not-allowed; opacity: .35; }
  button.primary { border-color: #55d7bf; color: #071312; background: #50cdb7; font-weight: 800; }
  button.active, button.chosen { border-color: #61e6ca; background: #1a4543; color: #b8fff1; }
  .room-id { width: 118px; border: 1px solid #303b43; border-radius: 6px; background: #0d1216; color: #d9e0df; padding: 8px 9px; }
  .hidden-input { display: none; }
  .workspace { display: grid; grid-template-columns: minmax(220px, 270px) minmax(560px, 1fr) minmax(250px, 310px); gap: 14px; max-width: 1680px; margin: 0 auto; align-items: stretch; }
  .panel, .canvas-panel { min-height: 740px; border: 1px solid #2b353c; border-radius: 10px; background: rgba(14, 19, 23, .92); box-shadow: 0 18px 55px rgba(0,0,0,.22); }
  .panel { padding: 16px; overflow: hidden; }
  .panel-heading, .canvas-heading { display: flex; align-items: start; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
  .count, .surface-meta { color: #68757c; font-size: 11px; }
  .tool-row { margin-bottom: 12px; }
  .tool-row button, .paint-row button { flex: 1; padding: 7px 5px; font-size: 11px; }
  .paint-row { margin: -4px 0 14px; }
  .asset-group { margin-top: 18px; }
  .asset-group h3 { margin-bottom: 8px; }
  .asset-list { display: grid; gap: 6px; }
  .asset-card { display: flex; align-items: center; gap: 9px; width: 100%; padding: 6px; text-align: left; }
  .asset-card .asset-copy, .selected-asset div { min-width: 0; display: grid; gap: 2px; }
  .asset-copy strong, .selected-asset strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
  small { color: #77858c; font-size: 10px; }
  .asset-sprite { display: inline-block; flex: 0 0 34px; width: 34px; height: 34px; border-radius: 4px; background-color: #262e32; background-image: var(--sprite-image); background-size: calc(var(--sprite-columns) * 34px) auto; background-position: calc(var(--sprite-x) * -34px) calc(var(--sprite-y) * -34px); background-repeat: no-repeat; image-rendering: pixelated; }
  .asset-sprite.large { flex-basis: 52px; width: 52px; height: 52px; background-size: calc(var(--sprite-columns) * 52px) auto; background-position: calc(var(--sprite-x) * -52px) calc(var(--sprite-y) * -52px); }
  .canvas-panel { min-width: 0; padding: 20px; display: flex; flex-direction: column; }
  .surface-scroll { flex: 1; display: flex; align-items: center; justify-content: center; overflow: auto; padding: 18px; border: 1px solid #2b383e; border-radius: 8px; background: #070a0d; }
  .room-surface { display: grid; grid-template-columns: repeat(var(--cols), 32px); grid-template-rows: repeat(var(--rows), 32px); flex: 0 0 auto; border: 2px solid #4f605f; background: #20282a; box-shadow: 0 0 0 8px #101719, 0 18px 40px rgba(0,0,0,.5); }
  .grid-cell { position: relative; overflow: hidden; min-width: 0; min-height: 0; padding: 0; border: 0; border-right: 1px solid rgba(94, 113, 111, .22); border-bottom: 1px solid rgba(94, 113, 111, .22); border-radius: 0; background: #4c4c4d; }
  .grid-cell:hover { z-index: 2; outline: 2px solid #73e7cc; }
  .grid-cell.water-cell { background: #23666b; }
  .grid-cell.port-cell::after { content: ''; position: absolute; inset: 5px; border: 2px solid #ffd477; border-radius: 50%; box-shadow: 0 0 8px #ffd477; pointer-events: none; }
  .placed-sprite { position: absolute; inset: 0; display: block; background-color: transparent; background-image: var(--sprite-image); background-size: calc(var(--sprite-columns) * 32px) auto; background-position: calc(var(--sprite-x) * -32px) calc(var(--sprite-y) * -32px); background-repeat: no-repeat; image-rendering: pixelated; transform: var(--sprite-transform); transform-origin: center; }
  .water-glyph { color: #6bd3d2; font-size: 22px; line-height: 30px; text-shadow: 0 0 7px #49c9cb; }
  .canvas-status { min-height: 38px; display: flex; gap: 8px; align-items: center; margin-top: 12px; color: #91a09e; font-size: 12px; }
  .status-dot { width: 7px; height: 7px; flex: 0 0 7px; border-radius: 50%; background: #57d8bf; box-shadow: 0 0 8px #57d8bf; }
  .facts { display: grid; gap: 9px; margin: 0 0 22px; }
  .facts div { display: flex; justify-content: space-between; gap: 12px; padding-bottom: 8px; border-bottom: 1px solid #222c31; }
  dt { color: #78878d; font-size: 10px; text-transform: uppercase; letter-spacing: .13em; }
  dd { margin: 0; color: #d8e3df; font-size: 12px; text-align: right; }
  .validate-button { padding: 6px 8px; font-size: 11px; }
  .inspector-block { padding-top: 16px; margin-top: 16px; border-top: 1px solid #222c31; }
  .inspector-block h3 { margin-bottom: 10px; }
  .selected-asset { display: flex; gap: 10px; align-items: center; }
  .port-list, .error-list { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; }
  .port-list li { display: grid; grid-template-columns: 1fr auto; gap: 4px 8px; padding: 7px 8px; border: 1px solid #2b373b; border-radius: 5px; background: #11171a; font-size: 11px; }
  .port-list li span { color: #80e7d0; }
  .port-list li small { grid-column: 1 / -1; }
  code { color: #d5bc83; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10px; }
  .muted { color: #6f7d82; font-size: 12px; line-height: 1.5; }
  .valid { color: #74e1bd; font-size: 12px; }
  .invalid { color: #ffd07b; font-size: 12px; }
  .error-list li { padding: 7px 8px; border-left: 2px solid #e77968; color: #f2aaa0; background: #231719; font-size: 11px; line-height: 1.45; }
  @media (max-width: 1120px) {
    .editor-topbar { align-items: start; flex-direction: column; }
    .workspace { grid-template-columns: 220px minmax(500px, 1fr); }
    .inspector-panel { grid-column: 1 / -1; min-height: auto; }
  }
  @media (max-width: 780px) {
    .editor-shell { padding: 14px; }
    .workspace { display: flex; flex-direction: column; }
    .palette-panel { order: 2; }
    .canvas-panel { order: 1; min-height: 620px; }
    .inspector-panel { order: 3; }
  }
</style>
