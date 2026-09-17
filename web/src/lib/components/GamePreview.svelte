<script>
  import { fetchReplay } from '$lib/replay/client.js'
  import { getReplayAdapter } from '$lib/replay/registry.js'

  let { game, locale = 'en', t = (key) => key } = $props()

  let metadata = $state(null)
  let loadedGame = $state('')
  let loading = $state(false)
  let replayActive = $state(false)
  let replayTarget = $state(null)
  let player = null
  let loadToken = 0

  const capturedTime = $derived(formatCapturedTime(metadata?.recordedAt))

  $effect(() => {
    const nextGame = game
    const target = replayTarget
    if (!nextGame || !target) return
    void load(nextGame, target)
    return () => {
      loadToken += 1
      destroyPlayer()
    }
  })

  async function load(nextGame, target) {
    const token = ++loadToken
    loadedGame = nextGame
    loading = true
    replayActive = false
    metadata = null
    destroyPlayer()
    target.replaceChildren()

    try {
      const result = await fetchReplay(nextGame)
      if (token !== loadToken || nextGame !== game || target !== replayTarget) return
      if (!result) return
      const adapter = getReplayAdapter(nextGame)
      if (!adapter || adapter.version !== result.metadata?.version) throw new Error('unsupported replay version')
      const recording = adapter.decode(result.bytes)
      player = adapter.createPlayer(target, recording)
      metadata = result.metadata
      replayActive = true
    } catch {
      if (token !== loadToken || nextGame !== game) return
      replayActive = false
      metadata = null
      destroyPlayer()
      target.replaceChildren()
    } finally {
      if (token === loadToken) loading = false
    }
  }

  function destroyPlayer() {
    try { player?.destroy?.() } catch {}
    player = null
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
  <img class="fallback" class:hidden={replayActive} src="/assets/banner.png" alt="" />
  <div class="replay-stage" class:active={replayActive} bind:this={replayTarget}></div>

  <div class="edge-fade" aria-hidden="true"></div>
  <div class="bottom-fade" aria-hidden="true"></div>

  <div class="preview-status">
    <span class:live={replayActive}></span>
    {replayActive ? t('home.preview') : (loading ? '…' : t('home.previewUnavailable'))}
  </div>

  <div class="overlay">
    <div class="copy">
      <span class="eyebrow">AQI ARCADE · {String(game ?? '').toUpperCase()}</span>
      <h2>{t(`game.${game}.name`)}</h2>
      <div class="facts">
        {#if metadata?.players}<span>{t('home.playersCount',{count:metadata.players})}</span>{/if}
        {#if replayActive}<span>REPLAY · {Math.max(1, Math.round((metadata?.durationMs ?? 0) / 1000))}S</span>{/if}
      </div>
    </div>
    <div class="time">
      {#if capturedTime}<strong>{t('home.lastPlayed',{time:capturedTime})}</strong>{/if}
    </div>
  </div>
</section>

<style>
  .preview-hero{position:relative;width:100%;height:100%;min-height:0;overflow:hidden;background:#000;isolation:isolate}
  .fallback,.replay-stage{position:absolute;inset:0;width:100%;height:100%}
  .fallback{object-fit:cover;object-position:center 48%;transform:scale(1.02);filter:saturate(.9) contrast(1.08) brightness(.9);opacity:1;transition:opacity .25s ease}
  .fallback.hidden{opacity:0}
  .replay-stage{z-index:1;opacity:0;transition:opacity .25s ease;background:#0b0d10}
  .replay-stage.active{opacity:1}
  .replay-stage :global(canvas){width:100%!important;height:100%!important;display:block}
  .edge-fade{position:absolute;z-index:2;inset:0;pointer-events:none;background:
    linear-gradient(90deg,#0b0d10 0%,rgba(11,13,16,.88) 3%,rgba(11,13,16,.28) 11%,transparent 24%,transparent 76%,rgba(11,13,16,.3) 89%,rgba(11,13,16,.9) 97%,#0b0d10 100%),
    linear-gradient(180deg,#0b0d10 0%,rgba(11,13,16,.45) 7%,transparent 22%,transparent 72%,rgba(11,13,16,.55) 92%,#0b0d10 100%)}
  .bottom-fade{position:absolute;z-index:2;left:0;right:0;bottom:0;height:48%;pointer-events:none;background:linear-gradient(180deg,transparent,rgba(3,4,5,.26) 28%,rgba(3,4,5,.88) 100%)}
  .preview-status{position:absolute;z-index:4;top:18px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:7px;padding:7px 9px;background:rgba(6,8,10,.48);backdrop-filter:blur(8px);color:#89929d;font:800 8px ui-monospace,monospace;letter-spacing:.09em;text-transform:uppercase}
  .preview-status>span{width:6px;height:6px;border-radius:50%;background:#59616b}.preview-status>span.live{background:#c1ff56;box-shadow:0 0 12px rgba(193,255,86,.48)}
  .overlay{position:absolute;z-index:4;left:0;right:0;bottom:0;height:196px;box-sizing:border-box;display:grid;grid-template-columns:minmax(0,1fr) 150px;align-items:end;gap:24px;padding:28px 40px 38px;overflow:hidden}
  .copy{min-width:0;display:grid;grid-template-rows:12px 72px 24px;align-content:end}
  .eyebrow{display:block;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;color:#8b949e;font:800 9px ui-monospace,monospace;letter-spacing:.16em}
  .copy h2{min-width:0;margin:8px 0 0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;color:#f4f0e8;font-size:clamp(38px,5.2vw,72px);line-height:.88;letter-spacing:-.06em;text-shadow:0 8px 28px rgba(0,0,0,.55)}
  .facts{height:24px;display:flex;align-items:end;flex-wrap:nowrap;gap:6px;overflow:hidden}
  .facts span{flex:0 0 auto;padding:5px 7px;border:1px solid rgba(255,255,255,.12);background:rgba(8,10,13,.42);backdrop-filter:blur(5px);color:#c5cbd1;font-size:9px;white-space:nowrap}
  .time{width:150px;height:24px;display:flex;align-items:end;justify-content:flex-end;overflow:hidden;color:#c1ff56;font:800 9px ui-monospace,monospace;letter-spacing:.06em;text-align:right;white-space:nowrap}.time strong{overflow:hidden;text-overflow:ellipsis;font-weight:800}
  @media(max-width:1050px){.preview-hero{min-height:420px}.overlay{height:176px;grid-template-columns:minmax(0,1fr) 130px;padding:24px 28px 28px}.copy{grid-template-rows:12px 58px 24px}.copy h2{font-size:52px}.time{width:130px}}
  @media(max-width:650px){.preview-hero{min-height:360px}.overlay{height:162px;grid-template-columns:minmax(0,1fr);grid-template-rows:1fr 16px;gap:7px;padding:18px 22px 22px}.copy{grid-template-rows:11px 48px 22px}.copy h2{font-size:42px;margin-top:6px}.time{width:100%;height:16px;justify-content:flex-start;text-align:left}.preview-status{top:12px}.facts{height:22px}.facts span{font-size:8px}.edge-fade{background:linear-gradient(180deg,#0b0d10 0%,rgba(11,13,16,.28) 12%,transparent 30%,transparent 72%,rgba(11,13,16,.76) 94%,#0b0d10 100%)}}
</style>