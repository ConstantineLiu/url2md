/**
 * [INPUT]: puppeteer-core
 * [OUTPUT]: launchBrowser(), navigateAndCapture(), closeBrowser()
 * [POS]: Chrome 生命周期管理，被 fetcher.ts 消费
 */

import puppeteer, { type Browser, type Page } from "puppeteer-core"
import { prepareWeChatPage, isWeChatUrl } from "./wechat.ts"

const CHROME_PATHS: Record<string, string> = {
  darwin: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  win32:  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  linux:  "/usr/bin/google-chrome",
}
const CHROME_PATH = process.env.CHROME_PATH ?? CHROME_PATHS[process.platform] ?? "google-chrome"
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

let browser: Browser | null = null

// ── 启动 ──────────────────────────────────────────────
export async function launchBrowser(): Promise<Browser> {
  if (browser?.connected) return browser
  browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    args: [`--user-agent=${UA}`],
  })
  return browser
}

// ── 抓取页面 ───────────────────────────────────────────
export async function navigateAndCapture(url: string): Promise<string> {
  const b = await launchBrowser()
  const page: Page = await b.newPage()
  try {
    await page.goto(url, { timeout: 30_000, waitUntil: ["domcontentloaded", "networkidle2"] })

    // 微信页面需要特殊处理懒加载图片
    if (isWeChatUrl(url)) {
      await prepareWeChatPage(page)
      // 等待图片 src 替换生效
      await new Promise((r) => setTimeout(r, 1000))
    }

    return await page.content()
  } finally {
    await page.close()
  }
}

// ── 关闭 ──────────────────────────────────────────────
export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close()
    browser = null
  }
}
