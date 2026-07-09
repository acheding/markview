import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd())

    return {
        plugins: [vue()],
        base: env.VITE_APP_PATH || '/',
        build: {
            assetsInlineLimit: 0
        },
        server: {
            port: 3001,
            open: false
        }
    }
})
