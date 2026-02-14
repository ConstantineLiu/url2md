/**
 * [INPUT]: browser.ts 的 navigateAndCapture, wechat.ts 的 isWeChatUrl
 * [OUTPUT]: fetchPage() — 统一抓取策略入口
 * [POS]: 抓取策略链，cli.ts 的第一步
 */

import { isWeChatUrl } from "./wechat.ts"
import { navigateAndCapture } from "./browser.ts"

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
const MIN_CONTENT_LENGTH = 500

// ── 直接 fetch ─────────────────────────────────────────
async function directFetch(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      redirect: "follow",
    })
    if (!res.ok) return null
    const html = await res.text()
    // 内容太短说明被拦截或需要 JS 渲染
    return html.length >= MIN_CONTENT_LENGTH ? html : null
  } catch {
    return null
  }
}

// ── 统一入口 ───────────────────────────────────────────
export interface FetchResult {
  html: string
  usedBrowser: boolean
}

export async function fetchPage(url: string, forceBrowser = false): Promise<FetchResult> {
  // 微信强制浏览器
  if (isWeChatUrl(url) || forceBrowser) {
    const html = await navigateAndCapture(url)
    return { html, usedBrowser: true }
  }

  // 普通网页：先 fetch，失败回退浏览器
  const html = await directFetch(url)
  if (html) return { html, usedBrowser: false }

  console.log("  Direct fetch failed, falling back to browser...")
  const browserHtml = await navigateAndCapture(url)
  return { html: browserHtml, usedBrowser: true }
}
