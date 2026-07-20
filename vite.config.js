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
                includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'],
                manifest: {
                    name: 'MarkView',
                    short_name: 'MarkView',
                    description: '纯前端的本地 Markdown 实时预览工具，数据保存在浏览器中，离线可用。',
                    lang: 'zh-CN',
                    theme_color: '#dbe3f7',
                    background_color: '#ffffff',
                    display: 'standalone',
                    // 桌面端 PWA 安装（Windows 快捷方式/任务栏）不会光栅化 SVG，必须提供 PNG，
                    // 否则回退成应用名首字母的黑色占位图标。SVG 保留作矢量补充。
                    icons: [
                        { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
                        { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
                        { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
                        { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }
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
                    cleanupOutdatedCaches: true,
                    // 地址栏直接访问 /og-image.png 这类静态文件属于 navigate 请求，会被导航回退
                    // 拦截并返回 index.html（看起来像"图片打不开，显示首页"）。带扩展名的路径一律放行。
                    navigateFallbackDenylist: [/\/[^/?]+\.[^/]+$/]
                }
            })
        ],
        base,
        // 渲染 Worker 内部按需动态 import（katex / highlight.js），会产生代码分割，
        // 默认的 iife worker 格式不支持分割，必须用 ES module 格式（运行时也已用 { type: 'module' } 创建）。
        worker: {
            format: 'es'
        },
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
