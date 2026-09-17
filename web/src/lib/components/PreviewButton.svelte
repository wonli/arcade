<script>
  export let state = { phase: 'idle', autoRemaining: 0, cooldownRemaining: 0, error: '' }
  export let t = (key) => key
  export let onUpdate = () => {}

  $: disabled = ['idle', 'countdown', 'uploading', 'updated', 'cooldown'].includes(state?.phase)
  $: label = (() => {
    if (state?.phase === 'countdown') return t('preview.autoIn', { seconds: state.autoRemaining ?? 10 })
    if (state?.phase === 'uploading') return t('preview.updating')
    if (state?.phase === 'updated') return t('preview.updated')
    if (state?.phase === 'cooldown') return t('preview.cooldown', { seconds: state.cooldownRemaining ?? 0 })
    if (state?.phase === 'error') return t('preview.retry')
    if (state?.phase === 'ready') return t('preview.update')
    return t('preview.waiting')
  })()
</script>

<button class="preview-button" class:error={state?.phase === 'error'} {disabled} onclick={onUpdate} title={state?.error || label}>
  <span class="dot"></span>
  <span>{label}</span>
</button>

<style>
  .preview-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:34px;padding:0 11px;border:1px solid #343b45;background:#0b0d10;color:#8e98a2;font:800 9px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.07em;text-transform:uppercase;cursor:pointer;touch-action:manipulation}
  .preview-button:not(:disabled):hover{border-color:#c1ff56;color:#f4f0e8}.preview-button:disabled{cursor:default;opacity:.72}.preview-button.error{border-color:#714449;color:#ffabab}.dot{width:6px;height:6px;border-radius:50%;background:#69727d}.preview-button:not(:disabled) .dot{background:#c1ff56}.preview-button.error .dot{background:#ff7f87}
  @media(max-width:640px){.preview-button{min-height:38px;font-size:8px}}
</style>
