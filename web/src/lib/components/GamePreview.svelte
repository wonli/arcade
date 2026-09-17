<script>
  import { fetchPreview } from '$lib/preview/client.js'
  import { previewSummaryKeys } from '$lib/preview/presentation.js'

  export let game
  export let locale = 'en'
  export let t = (key) => key

  let metadata = null
  let loadedGame = ''
  let loading = false
  let imageFailed = false
  let loadToken = 0

  $: if (game && game !== loadedGame) {
    loadedGame = game
    void load(game)
  }
  $: summaryRows = previewSummaryKeys(metadata?.summary ?? {})
  $: capturedTime = formatCapturedTime(metadata?.capturedAt)

  async function load(nextGame) {
    const token = ++loadToken
    loading = true
    imageFailed = false
    metadata = null
    try {
      const next = await fetchPreview(nextGame)
      if (token !== loadToken || nextGame !== game) return
      metadata = next
    } catch {
      if (token !== loadToken || nextGame !== game) return
      metadata = null
    } finally {
      if (token === loadToken) loading = false
    }
  }

  function formatCapturedTime(value) {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    try {
      return new Intl.DateTimeFormat(locale === 'zh-CN' ? 'zh-CN' : 'en', { hour: '2-digit', minute: '2-digit' }).format(date)
    } catch {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  }
</script>

<section class="preview-card" data-game={game} aria-label={t('home.preview')}>
  <div class="media">
    {#if metadata?.imageUrl && !imageFailed}
      <img src={metadata.imageUrl} alt="" onerror={() => (imageFailed = true)} />
    {:else}
      <div class="placeholder" aria-hidden="true">
        <div class="placeholder-grid"></div>
        <div class="placeholder-mark">{String(game ?? '').slice(0, 2).toUpperCase()}</div>
      </div>
    {/if}
    <div class="shade"></div>
    <div class="preview-status"><span class:live={!!metadata && !imageFailed}></span>{metadata && !imageFailed ? t('home.preview') : t('home.previewUnavailable')}</div>
    <div class="overlay">
      <div class="copy">
        <span class="eyebrow">AQI ARCADE · {String(game ?? '').toUpperCase()}</span>
        <h2>{t(`game.${game}.name`)}</h2>
        <div class="facts">
          {#if metadata?.players}<span>{t('home.playersCount',{count:metadata.players})}</span>{/if}
          {#each summaryRows as row}<span>{t(row[0],row[1])}</span>{/each}
        </div>
      </div>
      <div class="time">
        {#if capturedTime}<strong>{t('home.lastPlayed',{time:capturedTime})}</strong>{:else if loading}<strong>…</strong>{/if}
      </div>
    </div>
  </div>
</section>

<style>
  .preview-card{min-width:0;height:100%;display:flex;align-items:center}.media{position:relative;width:100%;aspect-ratio:16/9;overflow:hidden;border:1px solid #30363f;background:#080a0d;box-shadow:10px 10px 0 #050607;isolation:isolate}.media img,.placeholder{position:absolute;inset:0;width:100%;height:100%}.media img{object-fit:cover}.placeholder{overflow:hidden;background:radial-gradient(circle at 65% 38%,rgba(193,255,86,.12),transparent 32%),#0b0d10}.placeholder-grid{position:absolute;inset:-20%;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:32px 32px;transform:perspective(600px) rotateX(58deg) scale(1.3);transform-origin:center bottom}.placeholder-mark{position:absolute;inset:0;display:grid;place-items:center;color:#c1ff56;font:900 clamp(76px,10vw,150px) ui-monospace,monospace;letter-spacing:-.12em;opacity:.17}.shade{position:absolute;z-index:2;inset:0;background:linear-gradient(180deg,rgba(5,6,7,.05) 25%,rgba(5,6,7,.82) 100%);pointer-events:none}.preview-status{position:absolute;z-index:3;top:16px;left:16px;display:flex;align-items:center;gap:7px;padding:7px 9px;background:rgba(7,9,11,.74);backdrop-filter:blur(7px);color:#89929d;font:800 8px ui-monospace,monospace;letter-spacing:.09em;text-transform:uppercase}.preview-status>span{width:6px;height:6px;border-radius:50%;background:#59616b}.preview-status>span.live{background:#c1ff56}.overlay{position:absolute;z-index:3;left:0;right:0;bottom:0;display:flex;align-items:end;justify-content:space-between;gap:20px;padding:24px}.eyebrow{color:#8b949e;font:800 9px ui-monospace,monospace;letter-spacing:.14em}.copy h2{margin:6px 0 10px;color:#f4f0e8;font-size:clamp(28px,4vw,48px);line-height:.92;letter-spacing:-.05em}.facts{display:flex;flex-wrap:wrap;gap:6px}.facts span{padding:5px 7px;border:1px solid rgba(255,255,255,.16);background:rgba(8,10,13,.58);color:#c5cbd1;font-size:9px}.time{flex:0 0 auto;color:#c1ff56;font:800 9px ui-monospace,monospace;letter-spacing:.06em;text-align:right}.time strong{font-weight:800}
  @media(max-width:900px){.preview-card{height:auto}.media{box-shadow:7px 7px 0 #050607}.overlay{padding:18px}.copy h2{font-size:36px}}
  @media(max-width:560px){.overlay{align-items:start;flex-direction:column;gap:9px;padding:14px}.copy h2{font-size:30px;margin-bottom:7px}.time{text-align:left}.preview-status{top:10px;left:10px}.facts span{font-size:8px}}
</style>