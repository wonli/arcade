<script>
  let { metadata, t } = $props()
</script>

<section class="setup-help" aria-label={t('home.howToPlay')}>
  <div class="help-block rules-block">
    <span class="help-label">{t('home.howToPlay')}</span>
    <ul>
      {#each metadata.howToPlay ?? [] as key}
        <li>{t(key)}</li>
      {/each}
    </ul>
  </div>

  {#if metadata.controls?.length}
    <div class="help-block controls-block">
      <span class="help-label">{t('home.controls')}</span>
      <div class="control-list">
        {#each metadata.controls as control}
          <div class="control-row">
            <div class="keycaps" aria-hidden="true">
              {#each control.keys as key}
                <kbd>{key}</kbd>
              {/each}
            </div>
            <span>{t(control.label)}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  {#if metadata.tip}
    <div class="help-block tip-block">
      <span class="help-label">{t('home.tip')}</span>
      <p>{t(metadata.tip)}</p>
    </div>
  {/if}
</section>

<style>
  .setup-help{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr) minmax(0,1fr);gap:18px;margin:0;min-height:0}.help-block{display:grid;align-content:start;gap:9px}.help-label{color:#69727d;font-size:8px;font-weight:900;letter-spacing:.16em;text-transform:uppercase}.rules-block ul{display:grid;gap:8px;margin:0;padding:0;list-style:none}.rules-block li{position:relative;padding-left:15px;color:#cbd1d7;font-size:11px;line-height:1.35}.rules-block li::before{content:'•';position:absolute;left:0;top:0;color:#c1ff56}.control-list{display:grid;gap:9px}.control-row{display:flex;align-items:center;gap:10px;min-width:0}.control-row>span{color:#8e969f;font-size:10px;line-height:1.3}.keycaps{display:flex;align-items:center;gap:4px;flex:0 0 auto}.keycaps kbd{display:inline-flex;align-items:center;justify-content:center;min-width:27px;height:27px;padding:0 7px;box-sizing:border-box;border:1px solid #3a424b;border-bottom-color:#59636d;background:#14181d;color:#eef2f4;font:800 10px ui-monospace,SFMono-Regular,Menlo,monospace;box-shadow:inset 0 -2px 0 rgba(255,255,255,.04)}.tip-block{padding-top:2px}.tip-block p{margin:0;color:#69727d;font-size:10px;line-height:1.45}
  @media(max-width:1050px){.setup-help{grid-template-columns:1fr 1fr}.tip-block{grid-column:1/-1}}
  @media(max-width:650px){.setup-help{grid-template-columns:1fr;gap:18px}.tip-block{grid-column:auto}.control-row{align-items:flex-start;flex-direction:column;gap:6px}.keycaps kbd{height:29px;min-width:29px}}
  /* The help panel remains a vertical block inside the right rail. */
  .setup-help{grid-template-columns:1fr;gap:22px;margin-top:24px}
  .help-block{align-content:normal}
  .rules-block li{line-height:1.45}
  @media(max-width:1050px){.setup-help{grid-template-columns:1fr}.tip-block{grid-column:auto}}
  @media(max-width:650px){.setup-help{gap:18px;margin-top:18px}}
</style>
