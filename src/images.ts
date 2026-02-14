/**
 * [INPUT]: Node.js fs, path, fetch
 * [OUTPUT]: downloadImages() — 并行下载图片 + 重写 MD 引用
 * [POS]: 管线最后一步，在 parser 输出 markdown 后处理图片本地化
 */

import { mkdir, writeFile } from "node:fs/promises"
import { join, extname } from "node:path"

const MAX_CONCURRENT = 5
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

// ── 从 URL 推断扩展名 ──────────────────────────────────
function guessExt(url: string, contentType?: string): string {
  if (contentType?.includes("png")) return ".png"
  if (contentType?.includes("gif")) return ".gif"
  if (contentType?.includes("webp")) return ".webp"
  if (contentType?.includes("svg")) return ".svg"

  const pathExt = extname(new URL(url).pathname).split("?")[0]
  if ([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"].includes(pathExt)) return pathExt

  return ".jpg"
}

// ── 并发控制 ───────────────────────────────────────────
async function pooled<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = []
  let idx = 0

  async function run() {
    while (idx < tasks.length) {
      const i = idx++
      results[i] = await tasks[i]()
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, run))
  return results
}

// ── 主函数 ─────────────────────────────────────────────
export interface ImageDownloadResult {
  markdown: string       // 重写后的 markdown
  downloaded: number
  failed: number
}

export async function downloadImages(
  markdown: string,
  imageUrls: string[],
  slug: string,
  outputDir: string,
): Promise<ImageDownloadResult> {
  if (!imageUrls.length) return { markdown, downloaded: 0, failed: 0 }

  const imgDir = join(outputDir, `${slug}-images`)
  await mkdir(imgDir, { recursive: true })

  let downloaded = 0
  let failed = 0
  const urlToLocal = new Map<string, string>()

  const tasks = imageUrls.map((url, i) => async () => {
    const idx = String(i + 1).padStart(2, "0")
    // 先下载拿到 content-type，再决定扩展名
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": UA,
          "Referer": url.includes("mmbiz.qpic.cn") ? "https://mp.weixin.qq.com/" : "",
        },
        redirect: "follow",
      })
      if (!res.ok) { failed++; return }
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.length < 100) { failed++; return }

      const ext = guessExt(url, res.headers.get("content-type") ?? undefined)
      const filename = `${slug}-${idx}${ext}`
      await writeFile(join(imgDir, filename), buf)

      urlToLocal.set(url, `./${slug}-images/${filename}`)
      downloaded++
    } catch {
      failed++
    }
  })

  await pooled(tasks, MAX_CONCURRENT)

  // 重写 markdown 中的图片 URL
  let rewritten = markdown
  for (const [remote, local] of urlToLocal) {
    // 转义 URL 中的特殊正则字符
    const escaped = remote.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    rewritten = rewritten.replace(new RegExp(escaped, "g"), local)
  }

  return { markdown: rewritten, downloaded, failed }
}
