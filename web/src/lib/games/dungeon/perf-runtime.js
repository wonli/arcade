function percentile(values, ratio) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1))]
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
}

export function perfEnabledFromSearch(search = '') {
  return new URLSearchParams(search).get('perf') === '1'
}

function createPerfPanel() {
  if (typeof document === 'undefined') return null
  const existing = document.querySelector('[data-dungeon-perf]')
  if (existing) return existing.__perfApi ?? null

  const panel = document.createElement('aside')
  panel.dataset.dungeonPerf = '1'
  panel.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:9999;max-height:38vh;border:1px solid #39414b;background:rgba(8,10,13,.94);color:#c1ff56;font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;box-shadow:8px 8px 0 rgba(0,0,0,.4);display:flex;flex-direction:column;'

  const header = document.createElement('div')
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;padding:7px 9px;border-bottom:1px solid #30363f;flex:0 0 auto;'
  const title = document.createElement('strong')
  title.textContent = 'DUNGEON PERF · ?perf=1'
  const copy = document.createElement('button')
  copy.type = 'button'
  copy.textContent = 'COPY'
  copy.style.cssText = 'border:1px solid #c1ff56;background:#111419;color:#c1ff56;padding:4px 9px;font:inherit;font-weight:800;cursor:pointer;'
  header.append(title, copy)

  const output = document.createElement('pre')
  output.style.cssText = 'margin:0;padding:8px 9px;overflow:auto;white-space:pre-wrap;word-break:break-word;user-select:text;-webkit-user-select:text;touch-action:pan-y;'
  panel.append(header, output)
  document.body.appendChild(panel)

  const lines = []
  const api = {
    append(line) {
      lines.push(line)
      if (lines.length > 120) lines.splice(0, lines.length - 120)
      output.textContent = lines.join('\n')
      output.scrollTop = output.scrollHeight
    },
    destroy() { panel.remove() },
  }
  copy.addEventListener('click', async () => {
    const text = lines.join('\n')
    try {
      await navigator.clipboard.writeText(text)
      copy.textContent = 'COPIED'
    } catch {
      const selection = globalThis.getSelection?.()
      const range = document.createRange()
      range.selectNodeContents(output)
      selection?.removeAllRanges()
      selection?.addRange(range)
      copy.textContent = 'SELECTED'
    }
    setTimeout(() => { copy.textContent = 'COPY' }, 1200)
  })
  panel.__perfApi = api
  return api
}

export function createPerfMonitor({ now = () => performance.now(), intervalMs = 2000, log = console.info } = {}) {
  let windowStartedAt = now()
  let frames = []
  let sections = new Map()
  let latestCounts = {}
  let long16 = 0
  let long33 = 0
  let long50 = 0

  function reset(startedAt) {
    windowStartedAt = startedAt
    frames = []
    sections = new Map()
    long16 = 0
    long33 = 0
    long50 = 0
  }

  function flush(at = now()) {
    if (!frames.length) {
      reset(at)
      return
    }
    const elapsed = Math.max(1, at - windowStartedAt)
    const fps = (frames.length * 1000) / elapsed
    const sectionText = [...sections.entries()]
      .map(([name, values]) => `${name}=${average(values).toFixed(2)}ms`)
      .join(' | ')
    const countText = Object.entries(latestCounts)
      .map(([name, value]) => `${name}=${value}`)
      .join(' ')
    const line = `[dungeon:perf] fps=${fps.toFixed(1)} frame avg=${average(frames).toFixed(2)}ms frame p95=${percentile(frames, 0.95).toFixed(2)}ms max=${Math.max(...frames).toFixed(2)}ms | ${countText} | ${sectionText} | long>16.7=${long16} long>33=${long33} long>50=${long50}`
    log(line)
    reset(at)
  }

  return {
    frame(delta) {
      frames.push(delta)
      if (delta > 16.7) long16++
      if (delta > 33) long33++
      if (delta > 50) long50++
      const at = now()
      if (at - windowStartedAt >= intervalMs) flush(at)
    },
    section(name, duration) {
      const key = name.startsWith('update') ? name : `update${name[0]?.toUpperCase() ?? ''}${name.slice(1)}`
      const values = sections.get(key) ?? []
      values.push(duration)
      sections.set(key, values)
    },
    counts(next) { latestCounts = { ...next } },
    event(name, duration, counts = {}) {
      const suffix = Object.entries(counts).map(([key, value]) => `${key}=${value}`).join(' ')
      log(`[dungeon:perf] ${name}=${duration.toFixed(2)}ms${suffix ? ` | ${suffix}` : ''}`)
    },
    flush,
  }
}

export function installDungeonPerf(scene, {
  enabled = typeof window !== 'undefined' && perfEnabledFromSearch(window.location.search),
  now = () => performance.now(),
  log = console.info,
} = {}) {
  if (!enabled || !scene || scene.__dungeonPerf) return scene?.__dungeonPerf ?? null

  const panel = createPerfPanel()
  const output = (line) => {
    log(line)
    panel?.append(line)
  }
  const monitor = createPerfMonitor({ now, log: output })
  const restorers = []
  const wrapTimed = (name, label = name) => {
    const original = scene[name]
    if (typeof original !== 'function') return
    scene[name] = function (...args) {
      const started = now()
      try { return original.apply(this, args) }
      finally { monitor.section(label, now() - started) }
    }
    restorers.push(() => { scene[name] = original })
  }

  for (const name of ['updatePlayer', 'updateEnemies', 'updateEnemyProjectiles', 'updateDrops', 'updatePortal', 'autoAttack', 'trySkill']) wrapTimed(name, name)

  for (const name of ['drawArena', 'startFloor']) {
    const original = scene[name]
    if (typeof original !== 'function') continue
    scene[name] = function (...args) {
      const started = now()
      try { return original.apply(this, args) }
      finally {
        monitor.event(name, now() - started, {
          enemies: this.enemies?.length ?? 0,
          projectiles: this.enemyProjectiles?.length ?? 0,
          drops: this.drops?.length ?? 0,
          arena: this.arenaObjects?.length ?? 0,
        })
      }
    }
    restorers.push(() => { scene[name] = original })
  }

  const originalUpdate = scene.update
  scene.update = function (time, delta, ...rest) {
    monitor.frame(delta)
    try { return originalUpdate.call(this, time, delta, ...rest) }
    finally {
      monitor.counts({
        enemies: this.enemies?.filter?.((enemy) => enemy.hp > 0).length ?? this.enemies?.length ?? 0,
        projectiles: this.enemyProjectiles?.length ?? 0,
        drops: this.drops?.length ?? 0,
        arena: this.arenaObjects?.length ?? 0,
      })
    }
  }
  restorers.push(() => { scene.update = originalUpdate })

  const api = {
    flush: () => monitor.flush(),
    destroy() {
      while (restorers.length) restorers.pop()()
      panel?.destroy()
      delete scene.__dungeonPerf
    },
  }
  scene.__dungeonPerf = api
  output('[dungeon:perf] enabled; aggregated stats every 2s')
  return api
}
