<script>
  import { onMount } from 'svelte'
  import { createTranslator } from '$lib/i18n.js'
  import { subscribeLocale } from '$lib/locale.js'
  import SnakeGameSurface from './SnakeGameSurface.svelte'

  let { frameStore } = $props()
  let locale = $state('en')
  const t = $derived(createTranslator(locale))
  onMount(() => subscribeLocale((next) => (locale = next)))
</script>

<div class="surface">
  <SnakeGameSurface
    state={$frameStore}
    scoreboardLabel={t('common.scoreboard')}
    scoreLabel={t('common.score')}
    aliveLabel={t('snake.alive')}
    outLabel={t('snake.out')}
    compact={true}
  />
</div>

<style>
  .surface{width:1164px;height:640px;display:flex;align-items:center;background:#0b0d10;color:#f4f0e8;overflow:hidden}
</style>
