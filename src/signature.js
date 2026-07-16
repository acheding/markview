/**
 * 控制台署名彩蛋
 * 页面加载时在浏览器 Console 打印带样式的作者标识与开发背景。
 * UI 上不留任何痕迹,只有打开开发者工具的人才会看到。
 */
export function printSignature() {
    // 配色对齐设计 token:徽章用主强调色 --color-accent (#3a5ccc)
    const badge = 'padding:2px 8px;border-radius:3px 0 0 3px;background:#3a5ccc;color:#fff;font-weight:700'
    const author = 'padding:2px 8px;border-radius:0 3px 3px 0;background:#22252e;color:#aebdf0'
    const dim = 'color:#8a93a5;font-size:11px;line-height:2'

    console.log('%cMarkView%cCrafted by acheding', badge, author)
    console.log('%cSide project · Pair-programmed with Claude Opus 4.8', dim)
}
