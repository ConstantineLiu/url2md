#!/usr/bin/env bun
/**
 * [INPUT]: fetcher.ts, parser.ts, images.ts, browser.ts
 * [OUTPUT]: CLI 入口，url2md 命令
 * [POS]: 管线编排器，所有模块的唯一消费者
 */

import { parseArgs } from "node:util"
import { readFile, writeFile, mkdir } from "node:fs/promises"
import { join, resolve } from "node:path"
import { fetchPage } from "./fetcher.ts"
import { parseHtml } from "./parser.ts"
import { downloadImages } from "./images.ts"
import { closeBrowser } from "./browser.ts"

// ── 参数解析 ───────────────────────────────────────────
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    output:  { type: "string",  short: "o", default: "" },
    browser: { type: "boolean", short: "b", default: false },
    batch:   { type: "string",  default: "" },
    help:    { type: "boolean", short: "h", default: false },
  },
})

// ── 帮助 ──────────────────────────────────────────────
function showHelp() {
  console.log(`
url2md - URL to Markdown exporter

Usage:
  url2md <url> [-o dir] [--browser] [--batch file]

Options:
  -o, --output <dir>   Output directory (default: ./output)
  -b, --browser        Force browser mode
      --batch <file>   Batch mode: one URL per line
  -h, --help           Show this help

Examples:
  url2md https://mp.weixin.qq.com/s/xxxxx
  url2md https://example.com/article -o ~/reading/
  url2md --batch urls.txt
  echo "https://example.com" | url2md
`)
}

// ── 文件名清洗 ─────────────────────────────────────────
function slugify(title: string): string {
  return title
    .replace(/[^\p{L}\p{N}]+/gu, "-")  // 只保留字母（任何语言）和数字，其余→连字符
    .replace(/^-|-$/g, "")              // 去首尾连字符
    .slice(0, 100)
    || "untitled"
}

// ── 单 URL 处理 ────────────────────────────────────────
async function processUrl(url: string, outputDir: string, forceBrowser: boolean): Promise<void> {
  const start = Date.now()
  console.log(`\n-> ${url}`)

  // 1. 抓取
  console.log("  Fetching...")
  const { html, usedBrowser } = await fetchPage(url, forceBrowser)
  console.log(`  Fetched (${usedBrowser ? "browser" : "direct"}, ${(html.length / 1024).toFixed(0)}KB)`)

  // 2. 解析
  console.log("  Parsing...")
  const { markdown, title, images } = parseHtml(html, url)
  console.log(`  Title: ${title}`)
  console.log(`  Found ${images.length} images`)

  // 3. 图片下载
  const slug = slugify(title)
  const imgResult = await downloadImages(markdown, images, slug, outputDir)
  if (images.length) {
    console.log(`  Images: ${imgResult.downloaded} downloaded, ${imgResult.failed} failed`)
  }

  // 4. 写入
  await mkdir(outputDir, { recursive: true })
  const mdPath = join(outputDir, `${slug}.md`)
  await writeFile(mdPath, imgResult.markdown, "utf-8")

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`  -> ${mdPath} (${elapsed}s)`)
}

// ── 收集 URL ───────────────────────────────────────────
async function collectUrls(): Promise<string[]> {
  // 批量模式
  if (values.batch) {
    const content = await readFile(values.batch, "utf-8")
    return content.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"))
  }

  // 位置参数
  if (positionals.length) {
    return positionals
  }

  // 管道输入
  if (!process.stdin.isTTY) {
    const chunks: Buffer[] = []
    for await (const chunk of process.stdin) chunks.push(chunk)
    const input = Buffer.concat(chunks).toString("utf-8")
    return input.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"))
  }

  return []
}

// ── 主流程 ─────────────────────────────────────────────
async function main() {
  if (values.help) { showHelp(); process.exit(0) }

  const urls = await collectUrls()
  if (!urls.length) { showHelp(); process.exit(1) }

  const outputDir = resolve(values.output || "./output")
  const forceBrowser = values.browser ?? false

  console.log(`url2md: ${urls.length} URL(s) -> ${outputDir}`)

  let success = 0
  let fail = 0

  for (const url of urls) {
    try {
      await processUrl(url, outputDir, forceBrowser)
      success++
    } catch (err) {
      console.error(`  ERROR: ${err instanceof Error ? err.message : err}`)
      fail++
    }
  }

  // 批量模式用过浏览器要关闭
  await closeBrowser()

  if (urls.length > 1) {
    console.log(`\nDone: ${success} success, ${fail} failed`)
  }
}

main().catch((err) => {
  console.error(`Fatal: ${err.message}`)
  process.exit(1)
})
