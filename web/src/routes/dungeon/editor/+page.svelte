<script>
  import { onMount } from 'svelte'
  import { createDungeonGame, chooseDungeonAssets } from '$lib/games/dungeon/scene.js'
  import { loadPhaser } from '$lib/games/dungeon/phaser.js'
  import { installAffixVisuals } from '$lib/games/dungeon/visuals.js'
  import { installDungeonVfx } from '$lib/games/dungeon/vfx-runtime.js'
  import { installDungeonSpatial } from '$lib/games/dungeon/spatial-runtime.js'
  import { installDungeonAttackRuntime } from '$lib/games/dungeon/attack-runtime.js'
  import { installDungeonEditorRuntime } from '$lib/games/dungeon/editor-runtime.js'
  import { createDungeonEditorConfigClient } from '$lib/games/dungeon/editor-config.js'
  import { normalizeWeaponPresentationConfig, resolveWeaponPresentation, transformWeaponAnchor } from '$lib/games/dungeon/weapon-presentation.js'
  import { WEAPON_CATALOG, materializeWeapon, weaponDefinition } from '$lib/games/dungeon/weapon-catalog.js'
  import { materializeBossLegendary } from '$lib/games/dungeon/legendary-weapons.js'
  import { materializeLegendary } from '$lib/games/dungeon/legendary-growth.js'
  import { weaponVisualProfile } from '$lib/games/dungeon/weapon-visual-runtime.js'
  import { loadDungeonAssetBundle } from '$lib/games/dungeon/asset-bundle.js'

  const PREVIEW_WIDTH = 360
  const PREVIEW_HEIGHT = 310
  const PREVIEW_ZOOM = 4
  const VFX_RADIUS_UNIT = 26
  const CENTER = { x: PREVIEW_WIDTH / 2, y: 184 }
  const configClient = createDungeonEditorConfigClient()
  const rarities = ['common', 'uncommon', 'rare', 'epic']
  const themes = ['steel', 'ember', 'frost', 'storm', 'arcane', 'blood']

  let mount, preview, fileInput
  let game, scene, editorRuntime, resources
  let mounted = false, ready = false, error = '', message = ''
  let configSource = 'embedded', workingConfig = null, dirty = false
  let selectedWeaponType = WEAPON_CATALOG[0]?.type ?? ''
  let selectedRarity = 'epic', selectedTheme = WEAPON_CATALOG[0]?.vfxTheme ?? 'steel', legendaryLevel = 1
  let facing = 'down', poseMode = 'idle'
  let placeMode = false, aiEnabled = true, playerInvincible = true, enemyInvincible = true
  let spawnCount = 4
  let dragState = null
  let weaponNaturalWidth = 32, weaponNaturalHeight = 32

  $: selectedDefinition = weaponDefinition(selectedWeaponType)
  $: selectedItem = materializeEditorWeapon(selectedDefinition)
  $: resolved = workingConfig && selectedItem
    ? resolveWeaponPresentation(workingConfig, selectedItem, facing, { attacking: poseMode === 'attack' })
    : null
  $: art = selectedItem ? weaponVisualProfile(selectedItem) : null
  $: visualScale = art && resolved ? art.scale * resolved.scale * PREVIEW_ZOOM : PREVIEW_ZOOM
  $: weaponX = CENTER.x + (resolved?.pose.x ?? 0) * PREVIEW_ZOOM
  $: weaponY = CENTER.y + (resolved?.pose.y ?? 0) * PREVIEW_ZOOM
  $: previewVisual = resolved ? {
    x: weaponX,
    y: weaponY,
    width: weaponNaturalWidth,
    height: weaponNaturalHeight,
    originX: resolved.grip.x,
    originY: resolved.grip.y,
    scaleX: visualScale,
    scaleY: visualScale,
    angle: resolved.pose.angle,
    flipX: facing === 'right',
  } : null
  $: anchorPoint = previewVisual && resolved ? transformWeaponAnchor(previewVisual, resolved.vfxAnchor) : CENTER
  $: vfxRadius = Math.max(8, VFX_RADIUS_UNIT * (resolved?.vfxSizeScale ?? 1))
  $: playerAsset = resources?.assets?.player?.source === 'rpg-main-character'
    ? resources.assets.player[facing === 'up' ? 'up' : facing === 'down' ? 'down' : 'side']?.[poseMode === 'attack' ? 'attack' : 'idle']
    : resources?.assets?.player

  function materializeEditorWeapon(definition) {
    if (!definition) return null
    if (definition.bossOnly) {
      const base = materializeBossLegendary(definition, 5)
      return { ...materializeLegendary(base, Number(legendaryLevel) || 1), vfxTheme: selectedTheme || definition.vfxTheme }
    }
    return {
      ...materializeWeapon(definition, { rarity: selectedRarity, damage: 12, affixes: [] }),
      vfxTheme: selectedTheme || definition.vfxTheme,
    }
  }

  function sceneNow() {
    return game?.scene?.getScene?.('Dungeon') ?? scene
  }

  function commitWorking(next) {
    workingConfig = normalizeWeaponPresentationConfig(next)
    dirty = true
    error = ''
    applyWorking()
  }

  function applyWorking() {
    const current = sceneNow()
    if (!current || !workingConfig) return
    current.__dungeonWeaponPresentation = workingConfig
    current.__dungeonWeaponVisuals?.sync?.()
    current.__dungeonWeaponVfx?.sync?.()
  }

  function cloneConfig() {
    return structuredClone(workingConfig)
  }

  function weaponOverride(next) {
    next.weapons ??= {}
    next.weapons[selectedWeaponType] ??= {}
    return next.weapons[selectedWeaponType]
  }

  function updatePose(field, value) {
    if (!workingConfig || !resolved) return
    const number = Number(value)
    if (!Number.isFinite(number)) return
    const next = cloneConfig()
    const override = weaponOverride(next)
    override.poses ??= {}
    override.poses[poseMode] ??= {}
    const existing = override.poses[poseMode][facing] ?? {}
    override.poses[poseMode][facing] = { ...resolved.pose, ...existing, [field]: number }
    commitWorking(next)
  }

  function updateWeaponValue(field, value) {
    if (!workingConfig || !resolved) return
    const number = Number(value)
    if (!Number.isFinite(number)) return
    const next = cloneConfig()
    weaponOverride(next)[field] = number
    commitWorking(next)
  }

  function updatePoint(field, axis, value) {
    if (!workingConfig || !resolved) return
    const number = Number(value)
    if (!Number.isFinite(number)) return
    const next = cloneConfig()
    const override = weaponOverride(next)
    override[field] = { ...resolved[field], ...(override[field] ?? {}), [axis]: number }
    commitWorking(next)
  }

  function equipSelected() {
    if (!selectedItem) return
    editorRuntime?.equipWeapon?.(selectedItem)
  }

  function onWeaponChange() {
    const definition = weaponDefinition(selectedWeaponType)
    if (!definition) return
    selectedRarity = definition.bossOnly ? 'legendary' : 'epic'
    selectedTheme = definition.vfxTheme ?? 'steel'
    legendaryLevel = 1
    equipSelected()
  }

  function setFacing(next) {
    facing = next
    const current = sceneNow()
    if (!current) return
    current.playerFacing = next
    current.syncPlayerAnimation?.()
    current.__dungeonWeaponVisuals?.sync?.()
  }

  function previewAttack() {
    const current = sceneNow()
    if (!current) return
    current.playerAttacking = true
    current.syncPlayerAnimation?.('attack')
    current.__dungeonWeaponVisuals?.swing?.()
  }

  function pointerInPreview(event) {
    const rect = preview?.getBoundingClientRect?.()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: (event.clientX - rect.left) * PREVIEW_WIDTH / rect.width,
      y: (event.clientY - rect.top) * PREVIEW_HEIGHT / rect.height,
    }
  }

  function beginDrag(kind, event) {
    if (!resolved) return
    event.preventDefault()
    event.stopPropagation()
    dragState = {
      kind,
      start: pointerInPreview(event),
      pose: { ...resolved.pose },
      anchor: { ...resolved.vfxAnchor },
      vfxSizeScale: resolved.vfxSizeScale,
    }
    window.addEventListener('pointermove', dragMove)
    window.addEventListener('pointerup', endDrag, { once: true })
  }

  function nudgeWeapon(event) {
    if (!resolved) return
    const step = event.shiftKey ? 5 : 1
    if (event.key === 'ArrowLeft') { event.preventDefault(); updatePose('x', resolved.pose.x - step) }
    else if (event.key === 'ArrowRight') { event.preventDefault(); updatePose('x', resolved.pose.x + step) }
    else if (event.key === 'ArrowUp') { event.preventDefault(); updatePose('y', resolved.pose.y - step) }
    else if (event.key === 'ArrowDown') { event.preventDefault(); updatePose('y', resolved.pose.y + step) }
  }

  function dragMove(event) {
    if (!dragState || !resolved) return
    const point = pointerInPreview(event)
    if (dragState.kind === 'move') {
      updatePose('x', dragState.pose.x + (point.x - dragState.start.x) / PREVIEW_ZOOM)
      updatePose('y', dragState.pose.y + (point.y - dragState.start.y) / PREVIEW_ZOOM)
      return
    }
    if (dragState.kind === 'rotate') {
      const dx = point.x - weaponX
      const dy = point.y - weaponY
      updatePose('angle', Math.round((Math.atan2(dy, dx) * 180 / Math.PI + 90) * 10) / 10)
      return
    }
    if (dragState.kind === 'anchor') {
      const dx = point.x - weaponX
      const dy = point.y - weaponY
      const radians = -(resolved.pose.angle * Math.PI / 180)
      let localX = dx * Math.cos(radians) - dy * Math.sin(radians)
      const localY = dx * Math.sin(radians) + dy * Math.cos(radians)
      if (facing === 'right') localX *= -1
      const x = resolved.grip.x + localX / Math.max(1, weaponNaturalWidth * visualScale)
      const y = resolved.grip.y + localY / Math.max(1, weaponNaturalHeight * visualScale)
      updatePoint('vfxAnchor', 'x', Math.max(0, Math.min(1, x)))
      updatePoint('vfxAnchor', 'y', Math.max(0, Math.min(1, y)))
      return
    }
    if (dragState.kind === 'vfx-size') {
      const distance = Math.hypot(point.x - anchorPoint.x, point.y - anchorPoint.y)
      updateWeaponValue('vfxSizeScale', Math.max(0, Math.min(3, Math.round(distance / VFX_RADIUS_UNIT * 100) / 100)))
    }
  }

  function endDrag() {
    dragState = null
    window.removeEventListener('pointermove', dragMove)
  }

  function handleCanvasPointer(event) {
    if (!placeMode || !editorRuntime || !game?.canvas) return
    const rect = game.canvas.getBoundingClientRect()
    const x = (event.clientX - rect.left) * game.canvas.width / rect.width
    const y = (event.clientY - rect.top) * game.canvas.height / rect.height
    const enemy = editorRuntime.spawnEnemyAt(x, y)
    if (enemy) message = `Enemy placed at ${Math.round(enemy.x)}, ${Math.round(enemy.y)}`
  }

  function randomRoom() {
    editorRuntime?.randomizeRoom?.()
    message = 'Generated a new combat room'
  }

  function reloadRoom() {
    editorRuntime?.reloadRoom?.()
    message = 'Reloaded current room geometry'
  }

  async function saveConfig() {
    try {
      const result = await configClient.save(workingConfig)
      configSource = result.source
      workingConfig = normalizeWeaponPresentationConfig(result.config)
      dirty = false
      error = ''
      applyWorking()
      message = 'Saved to data/dungeon/weapon-presentation.json'
    } catch (cause) {
      error = cause?.message ?? 'Failed to save config'
    }
  }

  async function restoreDefault() {
    try {
      const result = await configClient.reset()
      configSource = result.source
      workingConfig = normalizeWeaponPresentationConfig(result.config)
      dirty = false
      error = ''
      applyWorking()
      message = 'Runtime override removed; using embedded defaults'
    } catch (cause) {
      error = cause?.message ?? 'Failed to restore defaults'
    }
  }

  function exportConfig() {
    if (!workingConfig) return
    const blob = new Blob([JSON.stringify(workingConfig, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'weapon-presentation.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  async function importConfig(event) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      workingConfig = normalizeWeaponPresentationConfig(JSON.parse(await file.text()))
      dirty = true
      error = ''
      applyWorking()
      message = `Imported ${file.name}`
    } catch (cause) {
      error = `Import failed: ${cause?.message ?? cause}`
    } finally {
      event.target.value = ''
    }
  }

  async function loadResources() {
    const [Phaser, bundle] = await Promise.all([loadPhaser(), loadDungeonAssetBundle()])
    return { Phaser, assets: chooseDungeonAssets(bundle.manifest, bundle.resolveAsset), vfxManifest: bundle.vfxManifest, assetManifest: bundle.manifest, resolveAsset: bundle.resolveAsset, dispose: bundle.dispose }
  }

  async function startEditor() {
    try {
      const [configResult, loaded] = await Promise.all([configClient.load(), loadResources()])
      if (!mounted) return
      configSource = configResult.source
      workingConfig = normalizeWeaponPresentationConfig(configResult.config)
      resources = loaded
      game = createDungeonGame({
        Phaser: loaded.Phaser,
        parent: mount,
        assets: loaded.assets,
        assetManifest: loaded.assetManifest,
        resolveAsset: loaded.resolveAsset,
        labels: { floor: () => 'SANDBOX', floorClear: () => '' },
      })

      let attempts = 0
      const install = () => {
        if (!mounted) return
        const current = game?.scene?.getScene?.('Dungeon')
        if (!current) {
          if (attempts++ < 90) requestAnimationFrame(install)
          return
        }
        scene = current
        scene.__dungeonWeaponPresentation = workingConfig
        installAffixVisuals(scene)
        installDungeonVfx(scene, loaded.vfxManifest)
        installDungeonSpatial(scene, {
          getProgress: () => ({ floor: scene.floor ?? 1, chapter: 1, roomRole: 'combat', fortuneActive: false }),
          label: (key) => key,
        })
        installDungeonAttackRuntime(scene)
        editorRuntime = installDungeonEditorRuntime(scene)
        editorRuntime.setPlayerInvincible(playerInvincible)
        editorRuntime.setEnemyInvincible(enemyInvincible)
        editorRuntime.setAiEnabled(aiEnabled)
        equipSelected()
        game.canvas?.addEventListener?.('pointerdown', handleCanvasPointer)
        ready = true
      }
      install()
    } catch (cause) {
      console.error(cause)
      error = cause?.message ?? 'Failed to start Dungeon Editor'
    }
  }

  onMount(() => {
    mounted = true
    startEditor()
    return () => {
      mounted = false
      endDrag()
      game?.canvas?.removeEventListener?.('pointerdown', handleCanvasPointer)
      editorRuntime?.restore?.()
      game?.destroy?.(true)
      resources?.dispose?.()
    }
  })
</script>

<svelte:head><title>Dungeon Editor · AQI Arcade</title></svelte:head>

<main class="editor-page">
  <header>
    <div class="identity"><a href="/dungeon">← DUNGEON</a><strong>DUNGEON EDITOR</strong><span class:dirty>{dirty ? 'UNSAVED' : configSource.toUpperCase()}</span></div>
    <div class="header-actions">
      <button on:click={() => fileInput?.click()}>导入 JSON</button>
      <button on:click={exportConfig} disabled={!workingConfig}>导出 JSON</button>
      <button on:click={restoreDefault}>恢复默认</button>
      <button class="save" on:click={saveConfig} disabled={!dirty}>保存</button>
      <input bind:this={fileInput} class="hidden" type="file" accept="application/json,.json" on:change={importConfig} />
    </div>
  </header>

  <section class="workspace">
    <div class="game-column">
      <div class="sandbox-toolbar">
        <button on:click={randomRoom}>随机房间</button>
        <button on:click={reloadRoom}>重载房间</button>
        <button class:active={placeMode} on:click={() => placeMode = !placeMode}>{placeMode ? '点击地图放怪中' : '放置小怪'}</button>
        <button on:click={() => editorRuntime?.spawnAroundPlayer?.(spawnCount)}>玩家周围 × {spawnCount}</button>
        <input aria-label="spawn count" type="number" min="1" max="24" bind:value={spawnCount} />
        <button on:click={() => editorRuntime?.clearEnemies?.()}>清怪</button>
        <label><input type="checkbox" bind:checked={aiEnabled} on:change={() => editorRuntime?.setAiEnabled(aiEnabled)} /> AI</label>
        <label><input type="checkbox" bind:checked={playerInvincible} on:change={() => editorRuntime?.setPlayerInvincible(playerInvincible)} /> 玩家无敌</label>
        <label><input type="checkbox" bind:checked={enemyInvincible} on:change={() => editorRuntime?.setEnemyInvincible(enemyInvincible)} /> 怪物无敌</label>
      </div>
      <div class:placing={placeMode} bind:this={mount} class="game-stage"></div>
      <div class="status">{#if error}<span class="error">{error}</span>{:else}{message || (ready ? 'WASD 移动 · Space 技能 · 真实 Dungeon combat sandbox' : 'Loading Dungeon…')}{/if}</div>
    </div>

    <aside class="inspector">
      <div class="section-title">WEAPON</div>
      <select bind:value={selectedWeaponType} on:change={onWeaponChange}>
        {#each WEAPON_CATALOG as weapon}<option value={weapon.type}>{weapon.name}</option>{/each}
      </select>

      <div class="row thirds">
        <label>品质<select bind:value={selectedRarity} disabled={selectedDefinition?.bossOnly} on:change={equipSelected}>{#if selectedDefinition?.bossOnly}<option value="legendary">legendary</option>{:else}{#each rarities as rarity}<option value={rarity}>{rarity}</option>{/each}{/if}</select></label>
        <label>主题<select bind:value={selectedTheme} on:change={equipSelected}>{#each themes as theme}<option value={theme}>{theme}</option>{/each}</select></label>
        <label>传奇等级<select bind:value={legendaryLevel} disabled={!selectedDefinition?.bossOnly} on:change={equipSelected}>{#each [1,5,10,15,20] as level}<option value={level}>Lv {level}</option>{/each}</select></label>
      </div>

      <div class="row buttons"><span>Facing</span>{#each ['up','down','left','right'] as direction}<button class:active={facing===direction} on:click={() => setFacing(direction)}>{direction}</button>{/each}</div>
      <div class="row buttons"><span>Pose</span><button class:active={poseMode==='idle'} on:click={() => poseMode='idle'}>Idle</button><button class:active={poseMode==='attack'} on:click={() => poseMode='attack'}>Attack</button><button on:click={previewAttack}>挥动</button></div>

      <div bind:this={preview} class="preview">
        <div class="preview-grid"></div>
        {#if playerAsset?.path}
          <div class="player-frame" style={`left:${CENTER.x}px;top:${CENTER.y}px;width:${playerAsset.frameWidth || 32}px;height:${playerAsset.frameHeight || 32}px;transform:translate(-50%,-70%) scale(4) scaleX(${facing==='right'?-1:1});background-image:url('${playerAsset.path}');background-size:${Math.max(1,playerAsset.frames||1)*100}% 100%;`}></div>
        {:else}<div class="player-placeholder" style={`left:${CENTER.x}px;top:${CENTER.y}px`}></div>{/if}

        {#if art?.path && resolved}
          <div class="weapon-origin" role="button" tabindex="0" aria-label="Move weapon; use arrow keys for fine adjustment" style={`left:${weaponX}px;top:${weaponY}px;transform:rotate(${resolved.pose.angle}deg)`} on:pointerdown={(event) => beginDrag('move', event)} on:keydown={nudgeWeapon}>
            <img src={art.path} alt="" draggable="false" on:load={(event) => { weaponNaturalWidth=event.currentTarget.naturalWidth||32; weaponNaturalHeight=event.currentTarget.naturalHeight||32 }} style={`left:${-resolved.grip.x*weaponNaturalWidth}px;top:${-resolved.grip.y*weaponNaturalHeight}px;width:${weaponNaturalWidth}px;height:${weaponNaturalHeight}px;transform-origin:${resolved.grip.x*100}% ${resolved.grip.y*100}%;transform:scale(${facing==='right'?-visualScale:visualScale},${visualScale})`} />
          </div>
          <div class="vfx-ring" style={`left:${anchorPoint.x-vfxRadius}px;top:${anchorPoint.y-vfxRadius}px;width:${vfxRadius*2}px;height:${vfxRadius*2}px`}></div>
          <button class="handle anchor-handle" title="VFX Anchor" style={`left:${anchorPoint.x}px;top:${anchorPoint.y}px`} on:pointerdown={(event)=>beginDrag('anchor',event)}>✦</button>
          <button class="handle size-handle" title="VFX Size" style={`left:${anchorPoint.x+vfxRadius}px;top:${anchorPoint.y}px`} on:pointerdown={(event)=>beginDrag('vfx-size',event)}>↔</button>
          <button class="handle rotate-handle" title="Rotate" style={`left:${weaponX + Math.sin(resolved.pose.angle*Math.PI/180)*70}px;top:${weaponY - Math.cos(resolved.pose.angle*Math.PI/180)*70}px`} on:pointerdown={(event)=>beginDrag('rotate',event)}>↻</button>
        {/if}
        <div class="preview-note">拖武器移动 · ↻ 旋转 · ✦ VFX 挂点 · ↔ VFX 尺寸</div>
      </div>

      {#if resolved}
        <div class="numbers">
          <label>X<input type="number" step="1" value={resolved.pose.x} on:input={(e)=>updatePose('x',e.currentTarget.value)} /></label>
          <label>Y<input type="number" step="1" value={resolved.pose.y} on:input={(e)=>updatePose('y',e.currentTarget.value)} /></label>
          <label>Angle<input type="number" step="1" value={resolved.pose.angle} on:input={(e)=>updatePose('angle',e.currentTarget.value)} /></label>
          <label>Weapon Scale<input type="number" min="0.1" max="8" step="0.05" value={resolved.scale} on:input={(e)=>updateWeaponValue('scale',e.currentTarget.value)} /></label>
          <label>Grip X<input type="number" step="0.01" value={resolved.grip.x} on:input={(e)=>updatePoint('grip','x',e.currentTarget.value)} /></label>
          <label>Grip Y<input type="number" step="0.01" value={resolved.grip.y} on:input={(e)=>updatePoint('grip','y',e.currentTarget.value)} /></label>
          <label>VFX Anchor X<input type="number" step="0.01" value={resolved.vfxAnchor.x} on:input={(e)=>updatePoint('vfxAnchor','x',e.currentTarget.value)} /></label>
          <label>VFX Anchor Y<input type="number" step="0.01" value={resolved.vfxAnchor.y} on:input={(e)=>updatePoint('vfxAnchor','y',e.currentTarget.value)} /></label>
          <label class="wide">VFX Size ×<input type="range" min="0" max="3" step="0.05" value={resolved.vfxSizeScale} on:input={(e)=>updateWeaponValue('vfxSizeScale',e.currentTarget.value)} /><input type="number" min="0" max="8" step="0.05" value={resolved.vfxSizeScale} on:input={(e)=>updateWeaponValue('vfxSizeScale',e.currentTarget.value)} /></label>
        </div>
      {/if}
    </aside>
  </section>
</main>

<style>
  :global(html),:global(body){margin:0;width:100%;height:100%;overflow:hidden;background:#080a0d;color:#e8edf2;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  button,select,input{font:inherit}.editor-page{height:100dvh;display:grid;grid-template-rows:48px minmax(0,1fr);background:#080a0d}header{display:flex;align-items:center;justify-content:space-between;padding:0 14px;border-bottom:1px solid #20262e;background:#0c0f13}.identity,.header-actions{display:flex;align-items:center;gap:12px}header a{color:#7f8a96;text-decoration:none;font:800 10px ui-monospace,monospace}header strong{font:900 13px ui-monospace,monospace;letter-spacing:.12em;color:#c1ff56}header span{padding:4px 7px;background:#161c22;color:#7d8995;font:800 9px ui-monospace,monospace}header span.dirty{color:#ffd56a;background:#282115}.header-actions{gap:6px}.header-actions button,.sandbox-toolbar button,.buttons button{border:1px solid #252d36;background:#12171d;color:#aeb7c1;padding:7px 9px;cursor:pointer}.header-actions .save{background:#c1ff56;color:#071008;border-color:#c1ff56;font-weight:900}.header-actions button:disabled{opacity:.35;cursor:default}.hidden{display:none}.workspace{min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 430px}.game-column{min-width:0;min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr) 28px;border-right:1px solid #20262e}.sandbox-toolbar{display:flex;align-items:center;gap:6px;padding:8px;background:#0b0e12;border-bottom:1px solid #1b2129;overflow-x:auto}.sandbox-toolbar button.active,.sandbox-toolbar button:hover,.buttons button.active{border-color:#6f9242;color:#c1ff56;background:#172015}.sandbox-toolbar input[type=number]{width:42px}.sandbox-toolbar label{display:flex;gap:4px;align-items:center;white-space:nowrap;color:#88939e;font-size:10px}.game-stage{min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#050607;touch-action:none;user-select:none}.game-stage :global(canvas){display:block!important;max-width:100%!important;max-height:100%!important}.game-stage.placing{cursor:crosshair;box-shadow:inset 0 0 0 2px rgba(193,255,86,.35)}.status{padding:6px 10px;color:#66717c;font:10px ui-monospace,monospace;background:#0a0d10}.status .error{color:#ff7a86}.inspector{min-height:0;overflow:auto;padding:14px;background:#0d1116}.section-title{color:#c1ff56;font:900 10px ui-monospace,monospace;letter-spacing:.16em;margin-bottom:8px}.inspector>select{width:100%;height:36px;background:#151b22;color:#e5ebf1;border:1px solid #27313c;padding:0 8px}.row{display:flex;gap:7px;margin-top:10px}.row.thirds>label{flex:1;min-width:0;color:#697581;font-size:9px}.row.thirds select{display:block;width:100%;margin-top:4px;height:31px;background:#12171d;color:#b7c0ca;border:1px solid #252d36}.buttons{align-items:center}.buttons span{width:44px;color:#697581;font-size:9px}.buttons button{flex:1;padding:6px 4px;font-size:9px}.preview{position:relative;width:100%;aspect-ratio:360/310;margin-top:12px;overflow:hidden;background:#080b0e;border:1px solid #222b35;touch-action:none}.preview-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(102,118,134,.11) 1px,transparent 1px),linear-gradient(90deg,rgba(102,118,134,.11) 1px,transparent 1px);background-size:16px 16px}.player-frame{position:absolute;background-repeat:no-repeat;background-position:left top;image-rendering:pixelated;transform-origin:center center;pointer-events:none}.player-placeholder{position:absolute;width:24px;height:36px;transform:translate(-50%,-70%);background:#394552;border:2px solid #8493a1}.weapon-origin{position:absolute;width:1px;height:1px;cursor:move;z-index:5}.weapon-origin img{position:absolute;max-width:none;image-rendering:pixelated;user-select:none;pointer-events:auto}.vfx-ring{position:absolute;border:1px dashed rgba(114,233,255,.48);border-radius:50%;pointer-events:none;box-sizing:border-box}.handle{position:absolute;z-index:12;width:28px;height:28px;margin:-14px 0 0 -14px;border-radius:50%;border:1px solid #314454;background:#0b1218;color:#72e9ff;font:900 12px ui-monospace,monospace;cursor:grab}.size-handle{color:#8df6b2;border-color:#31533b}.rotate-handle{color:#ffd56a;border-color:#55492b}.preview-note{position:absolute;left:8px;bottom:7px;color:#54616d;font:9px ui-monospace,monospace;pointer-events:none}.numbers{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}.numbers label{display:grid;grid-template-columns:1fr 74px;align-items:center;gap:6px;padding:7px 8px;background:#11161c;color:#737f8a;font:9px ui-monospace,monospace}.numbers input[type=number]{width:100%;box-sizing:border-box;background:#080b0f;border:1px solid #27313b;color:#d8e0e8;padding:5px}.numbers .wide{grid-column:1/-1;grid-template-columns:auto 1fr 74px}.numbers input[type=range]{width:100%}
  @media(max-width:980px){.workspace{grid-template-columns:1fr}.inspector{position:absolute;right:0;top:48px;bottom:0;width:min(430px,92vw);z-index:30;box-shadow:-18px 0 40px rgba(0,0,0,.5)}.game-column{border:0}.header-actions button:nth-child(-n+3){display:none}}
</style>
