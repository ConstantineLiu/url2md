/**
 * [INPUT]: puppeteer-core Page 对象
 * [OUTPUT]: isWeChatUrl(), prepareWeChatPage(), extractWeChatMeta()
 * [POS]: 微信公众号专用逻辑，被 fetcher.ts 和 parser.ts 消费
 */

import type { Page } from "puppeteer-core"

// ── 检测 ──────────────────────────────────────────────
export function isWeChatUrl(url: string): boolean {
  return /mp\.weixin\.qq\.com/.test(url)
}

// ── 页面准备 ───────────────────────────────────────────
// 微信图片用 data-src 懒加载，必须注入脚本强制替换为 src
export async function prepareWeChatPage(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.querySelectorAll("img[data-src]").forEach((img) => {
      const dataSrc = img.getAttribute("data-src")
      if (dataSrc) img.setAttribute("src", dataSrc)
    })
  })
}

// ── 元数据提取 ─────────────────────────────────────────
export interface WeChatMeta {
  title: string
  author: string
  publishDate: string
}

export function extractWeChatMeta(html: string): WeChatMeta {
  // 从页面 JS 变量提取（比 DOM 可靠）
  const titleMatch = html.match(/var\s+msg_title\s*=\s*"([^"]*)"/)
    ?? html.match(/var\s+msg_title\s*=\s*'([^']*)'/)
  const authorMatch = html.match(/var\s+nickname\s*=\s*"([^"]*)"/)
    ?? html.match(/var\s+nickname\s*=\s*'([^']*)'/)
  const timeMatch = html.match(/var\s+ct\s*=\s*"(\d+)"/)
    ?? html.match(/var\s+create_time\s*=\s*"(\d+)"/)

  const timestamp = timeMatch?.[1] ? parseInt(timeMatch[1], 10) * 1000 : 0

  return {
    title: titleMatch?.[1]?.trim() ?? "",
    author: authorMatch?.[1]?.trim() ?? "",
    publishDate: timestamp ? new Date(timestamp).toISOString().split("T")[0] : "",
  }
}
