<script>
  import {
    parseRoomTemplate,
    serializeRoomTemplate,
    validateRoomTemplate,
  } from '$lib/games/dungeon/room-template.js'
  import { listDungeon3RoomAssets } from '$lib/games/dungeon/room-template-assets.js'
  import {
    ROOM_SCENARIOS,
    createRoomEditorState,
    createRoomScenarioTemplate,
    deletePlacements,
    eraseAt,
    getTemplateAssetKeys,
    movePlacements,
    placeAsset,
    placePort,
    selectPlacementIds,
    setCellKind,
  } from '$lib/games/dungeon/room-template-editor.js'

  const assets = listDungeon3RoomAssets()
  const assetsByKey = new Map(assets.map((asset) => [asset.key, asset]))
  const groups = [
    { key: 'terrain', label: '水域', kinds: ['water'] },
    { key: 'walls', label: '墙体', kinds: ['wall'] },
    { key: 'wall-caps', label: '墙端堵头', paletteGroup: 'wall-caps' },
    { key: 'doors', label: '门', kinds: ['door'] },
    { key: 'bridges', label: '桥', kinds: ['bridge'] },
    { key: 'arches', label: '拱券 / 柱体', paletteGroup: 'arches' },
    { key: 'stairs', label: '楼梯', kinds: ['stairs'] },
    { key: 'details', label: '水面细节', kinds: ['water-detail'] },
    { key: 'objects', label: '物件 / 陷阱', kinds: ['object'] },
    { key: 'floor', label: '地面', kinds: ['floor'] },
  ]

  const focusedScenarios = ROOM_SCENARIOS.slice(0, 5)
  const extraScenarios = ROOM_SCENARIOS.slice(5)
  let scenario = 'wall'
  let state = { ...createRoomEditorState(createRoomScenarioTemplate(scenario, { id: 'room-01' })), selectedTool: 'select' }
  let selectedAsset = assets[0]
  let selectedTool = 'select'
  let selectedPlacementIds = new Set()
  let paintKind = 'water'
  let past = []
  let future = []
  let message = ''
  let fileInput
  let pointerPainting = false
  let interaction = null
  let roomId = 'room-01'

  $: template = state.template
  $: gridCells = buildGridCells(template)
  $: selectedVisual = selectedAsset?.cells?.[0]
  $: correctionAssets = getTemplateAssetKeys(template).map((key) => assetsByKey.get(key)).filter(Boolean)
  $: selectionRect = interaction?.kind === 'marquee' ? makeSelectionRect(interaction.startX, interaction.startY, interaction.lastX, interaction.lastY) : null
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

  function assetsForGroup(group) {
    if (group.paletteGroup) return assets.filter((asset) => asset.paletteGroup === group.paletteGroup)
    return assets.filter((asset) => group.kinds.includes(asset.kind) && !asset.paletteGroup)
  }

  function assetPreviewStyle(asset) {
    const tileSize = Math.min(16, Math.max(9, Math.floor(30 / Math.max(asset.width, asset.height, 1))))
    const width = Math.max(30, asset.width * tileSize)
    const height = Math.max(30, asset.height * tileSize)
    return `--preview-width: ${width}px; --preview-height: ${height}px; --preview-tile-size: ${tileSize}px; --preview-offset-x: ${Math.floor((width - asset.width * tileSize) / 2)}px; --preview-offset-y: ${Math.floor((height - asset.height * tileSize) / 2)}px;`
  }

  function previewTileStyle(cell, asset) {
    return `${spriteStyle(cell, asset)} left: calc(var(--preview-offset-x) + ${cell.x} * var(--preview-tile-size)); top: calc(var(--preview-offset-y) + ${cell.y} * var(--preview-tile-size));`
  }

  function snapshot(value) {
    return JSON.parse(JSON.stringify(value))
  }

  function commit(next, label = '') {
    if (next.errors?.length) {
      state = next
      message = `当前操作未应用：${next.errors.map((error) => error.message).join('；')}`
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

  function makeSelectionRect(startX, startY, endX, endY) {
    return {
      x: Math.min(startX, endX),
      y: Math.min(startY, endY),
      width: Math.abs(endX - startX) + 1,
      height: Math.abs(endY - startY) + 1,
    }
  }

  function selectPlacement(id, append) {
    const next = append ? new Set(selectedPlacementIds) : new Set()
    if (append && next.has(id)) next.delete(id)
    else next.add(id)
    selectedPlacementIds = next
    return next
  }

  function beginSelection(event, x, y) {
    const visual = placementVisual(x, y)
    if (visual) {
      const alreadySelected = selectedPlacementIds.has(visual.placement.id)
      const next = alreadySelected && !event.shiftKey
        ? new Set(selectedPlacementIds)
        : selectPlacement(visual.placement.id, event.shiftKey)
      interaction = next.size ? { kind: 'move', ids: [...next], startX: x, startY: y, lastX: x, lastY: y } : null
      message = next.size ? `已选中 ${next.size} 个资源，可拖动移动` : '已取消选择'
      return
    }
    if (!event.shiftKey) selectedPlacementIds = new Set()
    interaction = { kind: 'marquee', startX: x, startY: y, lastX: x, lastY: y, additive: event.shiftKey }
    message = '拖动框选资源'
  }

  function finishInteraction() {
    pointerPainting = false
    if (!interaction) return
    const current = interaction
    interaction = null
    if (current.kind === 'marquee') {
      const found = selectPlacementIds(template, makeSelectionRect(current.startX, current.startY, current.lastX, current.lastY))
      selectedPlacementIds = current.additive ? new Set([...selectedPlacementIds, ...found]) : new Set(found)
      message = selectedPlacementIds.size ? `已选中 ${selectedPlacementIds.size} 个资源` : '框选区域内没有资源'
      return
    }
    const dx = current.lastX - current.startX
    const dy = current.lastY - current.startY
    if (!dx && !dy) return
    const next = movePlacements(state, current.ids, dx, dy)
    if (commit(next, `已移动 ${current.ids.length} 个资源`)) selectedPlacementIds = new Set(current.ids)
  }

  function cancelInteraction() {
    pointerPainting = false
    interaction = null
  }

  function handleKeydown(event) {
    const tag = event.target?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || event.target?.isContentEditable) return
    if (event.key === 'Escape') {
      selectedPlacementIds = new Set()
      cancelInteraction()
      message = '已取消选择'
      return
    }
    if ((event.key === 'Delete' || event.key === 'Backspace') && selectedPlacementIds.size) {
      event.preventDefault()
      const count = selectedPlacementIds.size
      const next = deletePlacements(state, [...selectedPlacementIds])
      if (commit(next, `已删除 ${count} 个资源`)) selectedPlacementIds = new Set()
    }
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
    if (selectedTool === 'select') {
      beginSelection(event, x, y)
      return
    }
    pointerPainting = true
    applyAt(x, y)
  }

  function enterCell(event, x, y) {
    if (interaction) {
      interaction = { ...interaction, lastX: x, lastY: y }
      return
    }
    if (pointerPainting && event.buttons) applyAt(x, y)
  }

  function stopPainting() { pointerPainting = false }

  function selectTool(tool) {
    selectedTool = tool
    state = { ...state, selectedTool }
    message = tool === 'select' ? '选择工具：点击资源或拖动空白区域框选' : tool === 'erase' ? '橡皮擦已启用' : tool === 'port' ? '点击房间边缘添加门洞连接端口' : '地形画笔已启用'
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
    const next = createRoomEditorState(createRoomScenarioTemplate(scenario, { id, name: id }))
    past = []
    future = []
    state = { ...next, selectedAsset, selectedTool: 'select' }
    selectedTool = 'select'
    selectedPlacementIds = new Set()
    interaction = null
    message = '已生成资源样板房：所有已识别资源都已摆出，等待你在浏览器中校正组合。'
  }

  function loadScenario(nextScenario) {
    scenario = nextScenario
    const next = createRoomEditorState(createRoomScenarioTemplate(scenario, { id: roomId.trim() || 'dungeon3-scenario' }))
    past = []
    future = []
    state = { ...next, selectedAsset, selectedTool: 'select' }
    selectedTool = 'select'
    selectedPlacementIds = new Set()
    interaction = null
    message = `已生成组合样板：${ROOM_SCENARIOS.find((item) => item.key === scenario)?.label ?? scenario}`
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
      state = { ...createRoomEditorState(imported), selectedAsset, selectedTool: 'select' }
      selectedTool = 'select'
      selectedPlacementIds = new Set()
      interaction = null
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

<svelte:window on:keydown={handleKeydown} />

<div class="editor-shell" role="application" aria-label="房间模板编辑器" on:pointerup={finishInteraction} on:pointerleave={cancelInteraction}>
  <header class="editor-nav">
    <div class="nav-brand">
      <p class="eyebrow">DUNGEON3 / AUTHORING TOOL</p>
      <strong>房间模板编辑器</strong>
    </div>

    <nav class="nav-scenarios" aria-label="Room scenarios">
      <span class="nav-label">结构</span>
      {#each focusedScenarios as item (item.key)}
        <button class:selected={scenario === item.key} title={item.description} on:click={() => loadScenario(item.key)}>{item.label}</button>
      {/each}
      <span class="nav-divider"></span>
      <span class="nav-secondary-label">其他</span>
      {#each extraScenarios as item (item.key)}
        <button class:selected={scenario === item.key} title={item.description} on:click={() => loadScenario(item.key)}>{item.label}</button>
      {/each}
    </nav>

    <div class="nav-status" aria-live="polite">
      <strong>{template.name}</strong>
      <span>{template.grid.width} × {template.grid.height} · {template.placements.length} 资源 · {template.ports.length} 连接</span>
      <button class="validate-button" on:click={validateNow}>检查</button>
      {#if validation.valid}<span class="summary-valid">✓</span>{:else}<span class="summary-invalid">{validation.errors.length} 个问题</span>{/if}
    </div>

    <div class="nav-actions">
      <input bind:value={roomId} aria-label="房间名称" placeholder="房间名称" class="room-id" />
      <button class="primary" on:click={newRoom}>重新生成当前样板</button>
      <button on:click={undo} disabled={!past.length}>撤销</button>
      <button on:click={redo} disabled={!future.length}>重做</button>
      <button on:click={openImport}>导入 JSON</button>
      <button class="primary" on:click={exportJson}>导出校正 JSON</button>
      <input class="hidden-input" bind:this={fileInput} type="file" accept="application/json,.json" on:change={importJson} />
    </div>
  </header>

  <main class="workspace">
    <aside class="panel palette-panel">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">PALETTE</p>
          <h2>校正资源</h2>
          <p class="panel-hint">第二步：选中后点击中间网格</p>
        </div>
        <span class="count">{assets.length}</span>
      </div>
      <div class="palette-scroll" aria-label="可滚动资源列表">
        {#each groups as group}
          <section class="asset-group">
            <h3>{group.label}</h3>
            <div class="asset-list">
            {#each assetsForGroup(group) as asset (asset.key)}
              <button class:chosen={selectedAsset.key === asset.key} class="asset-card" on:pointerdown={(event) => { event.preventDefault(); chooseAsset(asset) }}>
                  <span class="asset-preview" style={assetPreviewStyle(asset)} aria-hidden="true">
                    {#each asset.cells as cell (`${cell.x},${cell.y}`)}
                      <span class="preview-tile" style={previewTileStyle(cell, asset)}></span>
                    {/each}
                  </span>
                  <span class="asset-copy"><strong>{asset.label}</strong><small>{asset.key}</small></span>
              </button>
              {/each}
            </div>
          </section>
        {/each}
      </div>
    </aside>

    <section class="canvas-panel">
      <div class="correction-strip" aria-label="当前样板资源样本">
        <div class="correction-heading">
          <div>
            <strong>当前样板资源</strong>
            <span>点击样本直接选择</span>
          </div>
          <small>样本区不会导出</small>
        </div>
        <div class="sample-list">
          {#each correctionAssets as asset (asset.key)}
            <button
              class="sample-card"
              class:chosen={selectedAsset.key === asset.key}
              title={`${asset.label} · ${asset.key}`}
              on:click={() => chooseAsset(asset)}
            >
              <span class="sample-sprite" style={paletteStyle(asset)}></span>
              <span class="sample-copy"><strong>{asset.label}</strong><small>{asset.key}</small></span>
            </button>
          {/each}
        </div>
      </div>
      <div class="surface-scroll">
        <div class="canvas-tools">
          <div class="tool-row">
            <button class:active={selectedTool === 'select'} on:click={() => selectTool('select')}>选择</button>
            <button class:active={selectedTool === 'paint'} on:click={() => selectTool('paint')}>铺地形</button>
            <button class:active={selectedTool === 'erase'} on:click={() => selectTool('erase')}>擦除</button>
            <button class:active={selectedTool === 'port'} on:click={() => selectTool('port')}>添加连接点</button>
          </div>
          {#if selectedTool === 'paint'}
            <div class="paint-row">
              <button class:active={paintKind === 'floor'} on:click={() => paintKind = 'floor'}>地面</button>
              <button class:active={paintKind === 'water'} on:click={() => paintKind = 'water'}>水面</button>
            </div>
          {/if}
        </div>
        <div
          class="room-surface"
          role="grid"
          aria-label="房间编辑画布"
          tabindex="0"
          class:native-grid={true}
          style={`--cols:${template.grid.width}; --rows:${template.grid.height};`}
          on:pointerup={finishInteraction}
          on:pointerleave={cancelInteraction}
        >
          {#each gridCells as cell (`${cell.x},${cell.y}`)}
            {@const visual = placementVisual(cell.x, cell.y)}
            <button
              class:water-cell={cell.kind === 'water'}
              class:port-cell={template.ports.some((port) => port.x === cell.x && port.y === cell.y)}
              class:selected-cell={visual && selectedPlacementIds.has(visual.placement.id)}
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
          {#if selectionRect}
            <span
              class="selection-marquee"
              style={`--selection-x:${selectionRect.x}; --selection-y:${selectionRect.y}; --selection-width:${selectionRect.width}; --selection-height:${selectionRect.height};`}
              aria-hidden="true"
            ></span>
          {/if}
        </div>
      </div>
    </section>

  </main>
</div>

<style>
  :global(*) { box-sizing: border-box; }
  :global(body) { margin: 0; background: #090b0e; color: #eee8df; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  :global(button), :global(input) { font: inherit; }
  :global(button) { color: inherit; }
  .editor-shell { height: 100dvh; min-height: 640px; overflow: hidden; display: flex; flex-direction: column; padding: 0; background: radial-gradient(circle at 52% 38%, #1b2228 0, #0b0d10 52%, #07080a 100%); }
  .editor-nav { flex: 0 0 auto; display: flex; align-items: center; gap: 10px; min-width: 0; max-width: 1680px; width: 100%; margin: 0 auto 6px; padding: 6px 8px; border: 1px solid #2b353c; border-radius: 6px; background: rgba(14, 19, 23, .94); box-shadow: 0 8px 22px rgba(0,0,0,.16); }
  h2, h3, p { margin: 0; }
  h2 { font-size: 17px; }
  h3 { color: #a6afb6; font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; }
  .eyebrow { color: #4edfc4; font-size: 10px; letter-spacing: 0.18em; font-weight: 800; margin-bottom: 7px; }
  .nav-brand { flex: 0 0 auto; min-width: 178px; display: grid; gap: 2px; }
  .nav-brand .eyebrow { margin-bottom: 0; font-size: 8px; }
  .nav-brand strong { color: #eee8df; font-size: 16px; white-space: nowrap; }
  .nav-scenarios { display: flex; flex: 1 1 auto; align-items: center; gap: 5px; min-width: 0; overflow-x: auto; padding: 2px 0 4px; scrollbar-width: none; }
  .nav-scenarios::-webkit-scrollbar { display: none; }
  .nav-scenarios button { flex: 0 0 auto; padding: 6px 8px; font-size: 10px; white-space: nowrap; }
  .nav-label, .nav-secondary-label { flex: 0 0 auto; color: #718087; font-size: 10px; letter-spacing: .1em; text-transform: uppercase; }
  .nav-secondary-label { color: #596a70; }
  .nav-divider { flex: 0 0 auto; width: 1px; height: 18px; margin: 0 2px; background: #303b43; }
  .nav-scenarios button.selected { border-color: #62e1c6; background: #1a4543; color: #b8fff1; }
  .nav-status { flex: 0 0 auto; display: flex; align-items: center; gap: 6px; min-width: max-content; padding-left: 9px; border-left: 1px solid #303b43; color: #82918e; font-size: 10px; white-space: nowrap; }
  .nav-status strong { color: #d9fff6; }
  .nav-status .summary-valid { color: #74e1bd; }
  .nav-actions, .tool-row, .paint-row { display: flex; gap: 6px; align-items: center; flex-wrap: nowrap; }
  .nav-actions { flex: 0 0 auto; }
  .nav-actions button { padding: 7px 8px; white-space: nowrap; }
  button { border: 1px solid #303b43; border-radius: 6px; background: #141a1f; padding: 8px 10px; cursor: pointer; transition: border-color .15s, background .15s, transform .15s; }
  button:hover:not(:disabled) { border-color: #54ceb8; background: #1a2a2b; }
  button:active:not(:disabled) { transform: translateY(1px); }
  button:disabled { cursor: not-allowed; opacity: .35; }
  button.primary { border-color: #55d7bf; color: #071312; background: #50cdb7; font-weight: 800; }
  button.active, button.chosen { border-color: #61e6ca; background: #1a4543; color: #b8fff1; }
  .room-id { width: 92px; border: 1px solid #303b43; border-radius: 6px; background: #0d1216; color: #d9e0df; padding: 7px 8px; }
  .hidden-input { display: none; }
  .summary-valid { color: #74e1bd; }
  .summary-invalid { color: #ffd07b; }
  .workspace { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(160px, 200px) minmax(0, 1fr); gap: 10px; max-width: 1680px; width: 100%; margin: 0 auto; padding: 8px; align-items: stretch; }
  .panel, .canvas-panel { min-height: 0; height: 100%; border: 0; border-radius: 0; background: transparent; box-shadow: none; }
  .panel { padding: 0 8px 0 0; overflow: hidden; }
  .palette-panel { min-width: 0; display: flex; flex-direction: column; }
  .panel-heading { display: flex; align-items: start; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
  .count { color: #68757c; font-size: 11px; }
  .panel-hint { margin-top: 4px; color: #718087; font-size: 10px; }
  .canvas-panel { min-width: 0; padding: 0; display: flex; flex-direction: column; overflow: hidden; }
  .canvas-tools { position: absolute; z-index: 10; top: 8px; left: 8px; display: flex; align-items: center; gap: 6px; padding: 4px; border: 1px solid #2b383e; border-radius: 4px; background: rgba(7, 10, 13, .62); backdrop-filter: blur(2px); pointer-events: none; }
  .canvas-tools button { pointer-events: auto; }
  .tool-row { flex: 0 0 auto; }
  .tool-row button, .paint-row button { flex: 1; padding: 7px 5px; font-size: 11px; white-space: nowrap; }
  .paint-row { display: flex; gap: 5px; }
  .palette-scroll { min-height: 0; flex: 1; overflow-x: hidden; overflow-y: auto; padding-right: 4px; scrollbar-gutter: stable; }
  .asset-group { margin-top: 18px; }
  .asset-group h3 { margin-bottom: 8px; }
  .asset-list { display: grid; gap: 6px; }
  .asset-card { display: flex; align-items: center; gap: 9px; width: 100%; padding: 6px; text-align: left; }
  .asset-card .asset-copy { min-width: 0; display: grid; gap: 2px; }
  .asset-copy strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
  small { color: #77858c; font-size: 10px; }
  .asset-preview { position: relative; display: inline-block; flex: 0 0 auto; width: var(--preview-width); height: var(--preview-height); min-width: 30px; border-radius: 4px; overflow: hidden; background-color: #262e32; image-rendering: pixelated; }
  .preview-tile { position: absolute; display: block; width: var(--preview-tile-size); height: var(--preview-tile-size); background-image: var(--sprite-image); background-size: calc(var(--sprite-columns) * var(--preview-tile-size)) auto; background-position: calc(var(--sprite-x) * -1 * var(--preview-tile-size)) calc(var(--sprite-y) * -1 * var(--preview-tile-size)); background-repeat: no-repeat; transform: var(--sprite-transform); transform-origin: center; image-rendering: pixelated; }
  .correction-strip { display: flex; align-items: center; gap: 8px; min-width: 0; margin-bottom: 5px; padding: 3px 6px; border: 1px solid #315b57; border-radius: 4px; background: rgba(16, 43, 42, .52); }
  .correction-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex: 0 0 auto; color: #b8d2cc; font-size: 10px; }
  .correction-heading > div { display: flex; align-items: baseline; gap: 8px; }
  .correction-heading strong { color: #d9fff6; }
  .correction-heading span { color: #7fa29a; font-size: 10px; }
  .correction-heading small { color: #6e8f88; white-space: nowrap; }
  .sample-list { display: flex; flex: 1 1 auto; min-width: 0; gap: 5px; overflow-x: auto; padding-bottom: 1px; }
  .sample-card { display: flex; align-items: center; gap: 5px; flex: 0 0 auto; min-width: 108px; padding: 3px 5px; text-align: left; }
  .sample-card.chosen { border-color: #61e6ca; background: #1a4543; color: #b8fff1; }
  .sample-sprite { display: inline-block; flex: 0 0 28px; width: 28px; height: 28px; border-radius: 3px; background-color: #262e32; background-image: var(--sprite-image); background-size: calc(var(--sprite-columns) * 28px) auto; background-position: calc(var(--sprite-x) * -28px) calc(var(--sprite-y) * -28px); background-repeat: no-repeat; image-rendering: pixelated; }
  .sample-copy { display: grid; min-width: 0; gap: 2px; }
  .sample-copy strong { overflow: hidden; max-width: 118px; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; }
  .sample-copy small { overflow: hidden; max-width: 118px; text-overflow: ellipsis; white-space: nowrap; }
  .surface-scroll { position: relative; flex: 1; min-height: 0; display: flex; align-items: flex-start; justify-content: flex-start; overflow: auto; padding: 18px; border: 1px solid #2b383e; border-radius: 8px; background: #070a0d; }
  .room-surface { position: relative; display: grid; grid-template-columns: repeat(var(--cols), 32px); grid-template-rows: repeat(var(--rows), 32px); flex: 0 0 auto; border: 2px solid #4f605f; background: #20282a; box-shadow: 0 0 0 8px #101719, 0 18px 40px rgba(0,0,0,.5); }
  .grid-cell { position: relative; overflow: hidden; min-width: 0; min-height: 0; padding: 0; border: 0; border-right: 1px solid rgba(94, 113, 111, .22); border-bottom: 1px solid rgba(94, 113, 111, .22); border-radius: 0; background: #4c4c4d; }
  .grid-cell:hover { z-index: 2; outline: 2px solid #73e7cc; }
  .grid-cell.selected-cell { z-index: 1; outline: 2px solid #ffd477; box-shadow: inset 0 0 0 2px rgba(255, 212, 119, .48); }
  .grid-cell.water-cell { background: #23666b; }
  .grid-cell.port-cell::after { content: ''; position: absolute; inset: 5px; border: 2px solid #ffd477; border-radius: 50%; box-shadow: 0 0 8px #ffd477; pointer-events: none; }
  .placed-sprite { position: absolute; inset: 0; display: block; background-color: transparent; background-image: var(--sprite-image); background-size: calc(var(--sprite-columns) * 32px) auto; background-position: calc(var(--sprite-x) * -32px) calc(var(--sprite-y) * -32px); background-repeat: no-repeat; image-rendering: pixelated; transform: var(--sprite-transform); transform-origin: center; }
  .selection-marquee { position: absolute; z-index: 5; pointer-events: none; left: calc(2px + var(--selection-x) * 32px); top: calc(2px + var(--selection-y) * 32px); width: calc(var(--selection-width) * 32px); height: calc(var(--selection-height) * 32px); border: 2px dashed #ffd477; background: rgba(255, 212, 119, .12); box-shadow: 0 0 0 1px rgba(255, 212, 119, .28); }
  .water-glyph { color: #6bd3d2; font-size: 22px; line-height: 30px; text-shadow: 0 0 7px #49c9cb; }
  .validate-button { padding: 6px 8px; font-size: 11px; }
  @media (max-width: 1120px) {
    .editor-nav { flex-wrap: wrap; align-items: center; }
    .nav-scenarios { order: 3; flex-basis: 100%; }
    .nav-status { margin-left: auto; }
    .workspace { grid-template-columns: minmax(160px, 190px) minmax(0, 1fr); }
  }
  @media (max-width: 780px) {
    .editor-shell { height: auto; min-height: 100dvh; overflow: visible; padding: 0; }
    .editor-nav { align-items: flex-start; }
    .nav-brand { min-width: 150px; }
    .nav-status { flex: 1 1 auto; min-width: 0; overflow: hidden; }
    .nav-status span { overflow: hidden; text-overflow: ellipsis; }
    .nav-actions { max-width: 100%; overflow-x: auto; padding-bottom: 2px; }
    .workspace { flex: 0 0 auto; display: flex; flex-direction: column; }
    .palette-panel { order: 2; height: 420px; }
    .palette-scroll { flex: 1; }
    .canvas-panel { order: 1; height: 620px; }
  }
</style>
