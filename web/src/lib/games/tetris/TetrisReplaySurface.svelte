<script>
  import { onMount } from 'svelte'
  import { createTranslator } from '$lib/i18n.js'
  import { subscribeLocale } from '$lib/locale.js'
  import TetrisArena from './TetrisArena.svelte'

  let { frameStore } = $props()
  let locale = $state('en')
  const t = $derived(createTranslator(locale))

  onMount(() => subscribeLocale((next) => (locale = next)))
</script>

<div class="surface">
  <div class="stats"><strong>{$frameStore?.score ?? 0}</strong><span>{t('common.score')}</span><strong>{$frameStore?.lines ?? 0}</strong><span>{t('common.lines')}</span></div>
  <TetrisArena
    board={$frameStore?.board ?? []}
    nextBoard={$frameStore?.nextBoard ?? []}
    opponent={$frameStore?.opponent ?? null}
    opponentName={t('tetris.opponent')}
    nextLabel={t('tetris.next')}
    opponentLabel={t('tetris.opponent')}
    scoreLabel={t('common.score')}
    linesLabel={t('common.lines')}
    compact={true}
  />
</div>

<style>
  .surface{width:590px;height:700px;box-sizing:border-box;padding:22px 24px;background:#0b0d10;color:#f4f0e8;overflow:hidden}
  .stats{height:36px;display:grid;grid-template-columns:auto auto auto auto;justify-content:end;align-items:baseline;gap:1px 8px;margin-bottom:12px}.stats strong{color:#c1ff56;font:800 18px ui-monospace,monospace}.stats span{color:#8b949e;font-size:9px;font-weight:800;letter-spacing:.12em}
</style>
