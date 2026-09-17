<script>
  import { fetchPreview } from '$lib/preview/client.js'
  import { previewSummaryKeys } from '$lib/preview/presentation.js'

  let { game, locale = 'en', t = (key) => key } = $props()

  let metadata = $state(null)
  let loadedGame = $state('')
  let loading = $state(false)
  let imageFailed = $state(false)
  let loadToken = 0

  const summaryRows = $derived(previewSummaryKeys(metadata?.summary ?? {}))
  const capturedTime = $derived(formatCapturedTime(metadata?.capturedAt))
  const hasLivePreview = $derived(!!metadata?.imageUrl && !imageFailed)
  const previewSrc = $derived(hasLivePreview ? metadata.imageUrl : '/assets/banner.png')

  $effect(() => {
    if (!game || game === loadedGame) return
    loadedGame = game
    void load(game)
  })

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

<section class="preview-hero" data-game={game} aria-label={t('home.preview')}>
  <img class:fallback={!hasLivePreview} src={previewSrc} alt="" onerror={() => (imageFailed = true)} />

  <div class="edge-fade" aria-hidden="true"></div>
  <div class="bottom-fade" aria-hidden="true"></div>

  <div class="preview-status">
    <span class:live={hasLivePreview}></span>
    {hasLivePreview ? t('home.preview') : (loading ? '…' : t('home.previewUnavailable'))}
  </div>

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
      {#if capturedTime}<strong>{t('home.lastPlayed',{time:capturedTime})}</strong>{/if}
    </div>
  </div>
</section>

<style>
  .preview-hero{position:relative;width:100%;height:100%;min-height:0;overflow:hidden;background:#000;isolation:isolate}
  .preview-hero img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;transform:scale(1.02);filter:saturate(.9) contrast(1.06)}
  .preview-hero img.fallback{object-position:center 48%;filter:saturate(.9) contrast(1.08) brightness(.9)}
  .edge-fade{position:absolute;z-index:2;inset:0;pointer-events:none;background:
    linear-gradient(90deg,#0b0d10 0%,rgba(11,13,16,.88) 3%,rgba(11,13,16,.28) 11%,transparent 24%,transparent 76%,rgba(11,13,16,.3) 89%,rgba(11,13,16,.9) 97%,#0b0d10 100%),
    linear-gradient(180deg,#0b0d10 0%,rgba(11,13,16,.45) 7%,transparent 22%,transparent 72%,rgba(11,13,16,.55) 92%,#0b0d10 100%)}
  .bottom-fade{position:absolute;z-index:2;left:0;right:0;bottom:0;height:48%;pointer-events:none;background:linear-gradient(180deg,transparent,rgba(3,4,5,.26) 28%,rgba(3,4,5,.88) 100%)}
  .preview-status{position:absolute;z-index:4;top:18px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:7px;padding:7px 9px;background:rgba(6,8,10,.48);backdrop-filter:blur(8px);color:#89929d;font:800 8px ui-monospace,monospace;letter-spacing:.09em;text-transform:uppercase}
  .preview-status>span{width:6px;height:6px;border-radius:50%;background:#59616b}.preview-status>span.live{background:#c1ff56;box-shadow:0 0 12px rgba(193,255,86,.48)}
  .overlay{position:absolute;z-index:4;left:0;right:0;bottom:0;display:flex;align-items:end;justify-content:space-between;gap:24px;padding:34px 40px 38px}
  .eyebrow{color:#8b949e;font:800 9px ui-monospace,monospace;letter-spacing:.16em}.copy h2{margin:8px 0 12px;color:#f4f0e8;font-size:clamp(38px,5.2vw,72px);line-height:.88;letter-spacing:-.06em;text-shadow:0 8px 28px rgba(0,0,0,.55)}
  .facts{display:flex;flex-wrap:wrap;gap:6px}.facts span{padding:5px 7px;border:1px solid rgba(255,255,255,.12);background:rgba(8,10,13,.42);backdrop-filter:blur(5px);color:#c5cbd1;font-size:9px}
  .time{flex:0 0 auto;color:#c1ff56;font:800 9px ui-monospace,monospace;letter-spacing:.06em;text-align:right}.time strong{font-weight:800}
  @media(max-width:1050px){.preview-hero{min-height:420px}.overlay{padding:28px}.copy h2{font-size:52px}}
  @media(max-width:650px){.preview-hero{min-height:360px}.overlay{align-items:start;flex-direction:column;gap:9px;padding:22px}.copy h2{font-size:42px;margin-bottom:9px}.time{text-align:left}.preview-status{top:12px}.facts span{font-size:8px}.edge-fade{background:linear-gradient(180deg,#0b0d10 0%,rgba(11,13,16,.28) 12%,transparent 30%,transparent 72%,rgba(11,13,16,.76) 94%,#0b0d10 100%)}}
</style>
