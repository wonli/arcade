<script>
  import { onMount } from 'svelte'
  import '../styles.css'
  import '../room.css'
  import { currentLocale, setAppLocale, subscribeLocale } from '$lib/locale.js'

  let locale = currentLocale()
  let unsubscribe = () => {}

  if (typeof window !== 'undefined') setAppLocale(locale)

  onMount(() => {
    unsubscribe = subscribeLocale((next) => (locale = next))
    return () => unsubscribe()
  })
</script>

<div class="app-language" aria-label="Language">
  <button class:active={locale === 'en'} aria-pressed={locale === 'en'} onclick={() => setAppLocale('en')}>EN</button>
  <button class:active={locale === 'zh-CN'} aria-pressed={locale === 'zh-CN'} onclick={() => setAppLocale('zh-CN')}>中文</button>
</div>

<slot />

<style>
  .app-language{position:fixed;top:14px;right:16px;z-index:1000;display:flex;padding:3px;border:1px solid #30363f;background:rgba(11,13,16,.92);backdrop-filter:blur(10px)}
  .app-language button{min-width:42px;height:30px;padding:0 9px;border:0;background:transparent;color:#737b85;font:800 10px ui-monospace,SFMono-Regular,Menlo,monospace;cursor:pointer}
  .app-language button.active{background:#c1ff56;color:#0b0d10}
  @media(max-width:640px){.app-language{top:8px;right:8px}.app-language button{min-width:38px;height:28px}}
</style>
