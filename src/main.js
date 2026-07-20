import { createApp } from 'vue'
import App from './App.vue'
import { tooltip } from './directives/tooltip.js'
import { printSignature } from './signature.js'
import { initAnalytics } from './services/analytics.js'
import './styles/index.css'

createApp(App).directive('tooltip', tooltip).mount('#app')

initAnalytics()

printSignature()
