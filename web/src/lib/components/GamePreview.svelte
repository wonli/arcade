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
      <div class="placeholder" data-game={game} aria-hidden="true">
        <div class="placeholder-grid"></div>
        <div class="placeholder-scene">
          {#if game === 'gomoku'}
            <div class="gomoku-board"><i></i><i></i><i></i><i></i><i></i></div>
          {:else if game === 'chess'}
            <div class="chess-piece">♞</div>
          {:else if game === 'tetris'}
            <div class="tetris-stack"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
          {:else if game === 'snake'}
            <div class="snake-line"><i></i><i></i><i></i><i></i><i></i><b></b></div>
          {:else if game === 'drawguess'}
            <div class="draw-line"><i></i><i></i><i></i></div>
          {:else}
            <div class="dungeon-door"><i></i><b></b></div>
          {/if}
        </div>
        <div class="placeholder-copy">
          <span>{t('home.previewUnavailable')}</span>
          <strong>{t(`game.${game}.name`)}</strong>
        </div>
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
  .preview-card{width:100%;min-width:0;display:flex;align-items:center}.media{position:relative;width:100%;aspect-ratio:16/9;overflow:hidden;border:1px solid #30363f;background:#080a0d;box-shadow:10px 10px 0 #050607;isolation:isolate}.media img,.placeholder{position:absolute;inset:0;width:100%;height:100%}.media img{object-fit:cover}.placeholder{overflow:hidden;background:radial-gradient(circle at 50% 46%,rgba(193,255,86,.14),transparent 34%),linear-gradient(145deg,#11161a,#080a0d 72%)}.placeholder-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px);background-size:28px 28px;mask-image:linear-gradient(to bottom,rgba(0,0,0,.9),transparent 88%)}.placeholder-scene{position:absolute;left:50%;top:43%;width:min(48%,320px);aspect-ratio:1.3;transform:translate(-50%,-50%);display:grid;place-items:center;opacity:.95}.placeholder-copy{position:absolute;left:22px;top:20px;display:flex;flex-direction:column;gap:5px}.placeholder-copy span{color:#707a85;font:800 8px ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase}.placeholder-copy strong{color:#dce3e7;font-size:13px}.gomoku-board{position:relative;width:74%;aspect-ratio:1;border:1px solid rgba(193,255,86,.38);background-image:linear-gradient(rgba(193,255,86,.2) 1px,transparent 1px),linear-gradient(90deg,rgba(193,255,86,.2) 1px,transparent 1px);background-size:16.666% 16.666%}.gomoku-board i{position:absolute;width:14%;aspect-ratio:1;border-radius:50%;background:#c1ff56;box-shadow:0 0 20px rgba(193,255,86,.25)}.gomoku-board i:nth-child(1){left:19%;top:52%}.gomoku-board i:nth-child(2){left:35%;top:36%;background:#f4f0e8}.gomoku-board i:nth-child(3){left:51%;top:52%}.gomoku-board i:nth-child(4){left:51%;top:20%;background:#f4f0e8}.gomoku-board i:nth-child(5){left:67%;top:52%}.chess-piece{display:grid;place-items:center;width:70%;aspect-ratio:1;border:1px solid rgba(193,255,86,.34);background:repeating-conic-gradient(#151b1f 0 25%,#0b0d10 0 50%) 50%/25% 25%;color:#c1ff56;font:900 clamp(74px,9vw,132px) Georgia,serif;text-shadow:0 8px 32px rgba(0,0,0,.55)}.tetris-stack{display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(4,1fr);gap:4px;width:58%;aspect-ratio:1}.tetris-stack i{border:1px solid rgba(193,255,86,.38);background:#182019}.tetris-stack i:nth-child(1){grid-column:2;grid-row:1;background:#c1ff56}.tetris-stack i:nth-child(2){grid-column:1;grid-row:2;background:#8ee7ff}.tetris-stack i:nth-child(3){grid-column:2;grid-row:2;background:#8ee7ff}.tetris-stack i:nth-child(4){grid-column:3;grid-row:2;background:#ffcf5a}.tetris-stack i:nth-child(5){grid-column:3;grid-row:3;background:#ffcf5a}.tetris-stack i:nth-child(6){grid-column:2;grid-row:4;background:#c1ff56}.tetris-stack i:nth-child(7){grid-column:3;grid-row:4;background:#c1ff56}.snake-line{position:relative;width:78%;height:52%;display:flex;align-items:center;justify-content:center;gap:5px}.snake-line i{width:14%;aspect-ratio:1;border-radius:28%;background:#c1ff56;box-shadow:0 0 18px rgba(193,255,86,.18)}.snake-line i:first-child{border-radius:50% 28% 28% 50%}.snake-line b{position:absolute;right:2%;top:8%;width:8%;aspect-ratio:1;border-radius:50%;background:#f4f0e8}.draw-line{position:relative;width:72%;height:66%;border:1px solid rgba(244,240,232,.28);background:#eee9df}.draw-line i{position:absolute;height:4px;border-radius:999px;background:#17191c;transform-origin:left center}.draw-line i:nth-child(1){left:16%;top:68%;width:48%;transform:rotate(-38deg)}.draw-line i:nth-child(2){left:45%;top:42%;width:34%;transform:rotate(42deg);background:#c1ff56}.draw-line i:nth-child(3){left:52%;top:62%;width:28%;transform:rotate(-18deg)}.dungeon-door{position:relative;width:54%;height:74%;border:2px solid rgba(193,255,86,.34);border-bottom:0;background:linear-gradient(180deg,#172019,#090c0b);box-shadow:inset 0 0 38px rgba(193,255,86,.08)}.dungeon-door:before,.dungeon-door:after{content:'';position:absolute;top:26%;width:18%;height:48%;border:1px solid rgba(193,255,86,.24)}.dungeon-door:before{left:-28%}.dungeon-door:after{right:-28%}.dungeon-door i{position:absolute;left:50%;bottom:0;width:44%;height:64%;transform:translateX(-50%);background:#050607;border:1px solid rgba(193,255,86,.3);border-bottom:0}.dungeon-door b{position:absolute;left:50%;bottom:11%;width:9%;aspect-ratio:1;transform:translateX(-50%);border-radius:50%;background:#c1ff56;box-shadow:0 0 18px #c1ff56}.shade{position:absolute;z-index:2;inset:0;background:linear-gradient(180deg,rgba(5,6,7,.02) 38%,rgba(5,6,7,.9) 100%);pointer-events:none}.preview-status{position:absolute;z-index:3;top:16px;right:16px;display:flex;align-items:center;gap:7px;padding:7px 9px;background:rgba(7,9,11,.74);backdrop-filter:blur(7px);color:#89929d;font:800 8px ui-monospace,monospace;letter-spacing:.09em;text-transform:uppercase}.preview-status>span{width:6px;height:6px;border-radius:50%;background:#59616b}.preview-status>span.live{background:#c1ff56}.overlay{position:absolute;z-index:3;left:0;right:0;bottom:0;display:flex;align-items:end;justify-content:space-between;gap:20px;padding:24px}.eyebrow{color:#8b949e;font:800 9px ui-monospace,monospace;letter-spacing:.14em}.copy h2{margin:6px 0 10px;color:#f4f0e8;font-size:clamp(28px,4vw,48px);line-height:.92;letter-spacing:-.05em}.facts{display:flex;flex-wrap:wrap;gap:6px}.facts span{padding:5px 7px;border:1px solid rgba(255,255,255,.16);background:rgba(8,10,13,.58);color:#c5cbd1;font-size:9px}.time{flex:0 0 auto;color:#c1ff56;font:800 9px ui-monospace,monospace;letter-spacing:.06em;text-align:right}.time strong{font-weight:800}
  @media(max-width:900px){.media{box-shadow:7px 7px 0 #050607}.overlay{padding:18px}.copy h2{font-size:36px}}
  @media(max-width:560px){.overlay{align-items:start;flex-direction:column;gap:9px;padding:14px}.copy h2{font-size:30px;margin-bottom:7px}.time{text-align:left}.preview-status{top:10px;right:10px}.facts span{font-size:8px}.placeholder-copy{left:14px;top:12px}.placeholder-scene{top:40%;width:56%}}
</style>