/**
 * [INPUT]: cheerio, turndown + turndown-plugin-gfm, wechat.ts 的 extractWeChatMeta
 * [OUTPUT]: parseHtml() — HTML 清洗 + Markdown 转换
 * [POS]: 解析管线核心，位于 fetch 之后、images 之前
 */

import * as cheerio from "cheerio"
import TurndownService from "turndown"
import { gfm } from "turndown-plugin-gfm"
import { isWeChatUrl, extractWeChatMeta } from "./wechat.ts"

export interface ParseResult {
  markdown: string
  title: string
  images: string[]   // 原始图片 URL 列表
  author: string
  publishDate: string
}

// ── 噪音选择器 ─────────────────────────────────────────
const NOISE_SELECTORS = [
  "script", "style", "noscript", "iframe",
  "nav", "footer", "header",
  ".ad", ".ads", ".advertisement", ".social-share",
  ".comment", ".comments", "#comments",
  ".sidebar", ".related", ".recommend",
  ".qr_code_pc", ".reward_area",  // 微信特有
].join(", ")

// ── Turndown 实例 ──────────────────────────────────────
function createTurndown(): TurndownService {
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
  })
  td.use(gfm)
  // 跳过空链接
  td.addRule("skipEmptyLinks", {
    filter: (node) => node.nodeName === "A" && !node.textContent?.trim(),
    replacement: () => "",
  })
  return td
}

// ── 提取图片 URL ───────────────────────────────────────
function extractImages($content: cheerio.Cheerio<cheerio.Element>, $: cheerio.CheerioAPI, baseUrl: string): string[] {
  const urls: string[] = []
  $content.find("img").each((_, el) => {
    const raw = $(el).attr("data-src") || $(el).attr("src") || ""
    if (!raw) return
    if (raw.startsWith("data:")) return
    if ($(el).attr("width") === "1" || $(el).attr("height") === "1") return
    // 相对 URL → 绝对 URL
    try {
      urls.push(new URL(raw, baseUrl).href)
    } catch {
      urls.push(raw)
    }
  })
  return [...new Set(urls)]
}

// ── 微信解析 ───────────────────────────────────────────
function parseWeChat(html: string, url: string, $: cheerio.CheerioAPI, td: TurndownService): ParseResult {
  const meta = extractWeChatMeta(html)

  // 标题：JS 变量 > DOM
  const title = meta.title || $("#activity-name").text().trim() || $("title").text().trim()
  const $content = $("#js_content")

  // 清噪
  $content.find(NOISE_SELECTORS).remove()

  const images = extractImages($content, $, url)
  const markdown = td.turndown($content.html() || "")

  return {
    markdown: `# ${title}\n\n> ${meta.author}${meta.publishDate ? ` | ${meta.publishDate}` : ""}\n\n${markdown}`,
    title,
    images,
    author: meta.author,
    publishDate: meta.publishDate,
  }
}

// ── 普通网页解析 ───────────────────────────────────────
function parseGeneric(url: string, $: cheerio.CheerioAPI, td: TurndownService): ParseResult {
  const title = $("title").text().trim()
    || $("h1").first().text().trim()
    || "Untitled"

  // 清噪
  $(NOISE_SELECTORS).remove()

  // 内容定位：article > main > body
  let $content = $("article")
  if (!$content.length) $content = $("main")
  if (!$content.length) $content = $("body")

  const images = extractImages($content, $, url)
  const markdown = td.turndown($content.html() || "")

  // 如果 markdown 已经以匹配的 h1 开头，不重复添加标题
  const startsWithTitle = markdown.match(/^#\s+(.+)/)?.[1]?.trim() === title

  return {
    markdown: startsWithTitle ? markdown : `# ${title}\n\n${markdown}`,
    title,
    images,
    author: "",
    publishDate: "",
  }
}

// ── 统一入口 ───────────────────────────────────────────
export function parseHtml(html: string, url: string): ParseResult {
  const $ = cheerio.load(html)
  const td = createTurndown()

  return isWeChatUrl(url)
    ? parseWeChat(html, url, $, td)
    : parseGeneric(url, $, td)
}
