import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd())
    const base = env.VITE_APP_PATH || '/'

    return {
        plugins: [
            vue(),
            VitePWA({
                registerType: 'autoUpdate',
                includeAssets: ['favicon.ico', 'icon.svg'],
                manifest: {
                    name: 'MarkView · 本地 Markdown 实时预览',
                    short_name: 'MarkView',
                    description: '纯前端的本地 Markdown 实时预览工具，数据保存在浏览器本地，离线可用。',
                    lang: 'zh-CN',
                    theme_color: '#5672cd',
                    background_color: '#ffffff',
                    display: 'standalone',
                    icons: [
                        { src: 'icon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
                        { src: 'icon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' }
                    ],
                    // 注册为 .md / .markdown 的系统文件处理器：安装后双击这类文件即用 MarkView 打开，
                    // 应用侧由 launchQueue 消费者接收文件并导入为新文档（见 createWorkspace）。
                    file_handlers: [
                        {
                            action: base,
                            accept: {
                                'text/markdown': ['.md', '.markdown']
                            }
                        }
                    ],
                    // 打开文件时优先复用已有窗口（走 launchQueue），而非每次新开一个实例。
                    launch_handler: {
                        client_mode: ['focus-existing', 'auto']
                    }
                },
                workbox: {
                    // 预缓存构建产物，实现离线可用；html2pdf 等较大 chunk 需提高单文件上限。
                    globPatterns: ['**/*.{js,css,html,svg,ico,woff2,ttf}'],
                    maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
                    cleanupOutdatedCaches: true
                }
            })
        ],
        base,
        build: {
            assetsInlineLimit: 0
        },
        server: {
            port: 3001,
            open: false,
            host: true
        }
    }
})
