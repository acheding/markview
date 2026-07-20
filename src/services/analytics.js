// 匿名流量统计：全站唯一对接第三方分析服务的地方。
//
// 只统计基础流量（访客数、页面浏览量、来源、设备、国家）——即 Vercel 免费计划可见的部分；
// 功能级自定义事件需付费计划才能查看，故一律不埋，免得留下看不到结果的死代码。
//
// 用框架无关的 inject() 而非官方文档给 Vue 推荐的 <Analytics> 组件：后者 import 了
// vue-router 的 useRoute（用于自动追踪路由跳转），而本项目是单页应用、没有 vue-router，
// 引入即构建失败。inject() 不碰路由，效果等同。
//
// 隐私红线（本项目的立身之本是「文档不经过任何服务器」，统计不得破坏这一点）：
// 上报的 URL 必须剥掉 hash 与 query——分享链接把整篇文档压缩在 location.hash 里，
// 原样上报等同于把用户文档发到服务器上。
import { inject } from '@vercel/analytics'

const isBrowser = typeof window !== 'undefined'
// 仅生产构建真正上报：开发环境走空转，不污染线上数据。
const isEnabled = () => isBrowser && import.meta.env.PROD

let injected = false

// 只保留 origin + pathname：hash（分享链接全文）与 query 一律丢弃。
const sanitizeEvent = (event) => {
    try {
        const url = new URL(event.url, window.location.href)
        return { ...event, url: `${url.origin}${url.pathname}` }
    } catch {
        // URL 解析不出来时宁可丢弃这条上报，也不冒险原样发出去。
        return null
    }
}

/**
 * 注入统计脚本。在应用挂载后调用一次；重复调用无副作用。
 * 统计属于纯附加能力，任何失败（脚本被拦截器挡掉、网络不通）都必须静默，
 * 绝不能影响编辑器本身。
 */
export const initAnalytics = () => {
    if (!isEnabled() || injected) return
    injected = true
    try {
        inject({ mode: 'production', beforeSend: sanitizeEvent })
    } catch {
        /* 统计不可用不影响主功能 */
    }
}
