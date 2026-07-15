import { createApp } from 'vue'
import App from './App.vue'
import { printSignature } from './signature.js'
import './styles/index.css'

createApp(App).mount('#app')

printSignature()
