import { mount } from 'svelte'
import './styles.css'
import './room.css'
import App from './App.svelte'

mount(App, {
  target: document.getElementById('app'),
})
