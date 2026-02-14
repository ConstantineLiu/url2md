# url2md

Convert any URL to clean, local Markdown with images downloaded. Built for WeChat articles (`mp.weixin.qq.com`) and general web pages.

[**中文文档**](./README.zh-CN.md)

## Why

- **WeChat blocks curl/wget** — requires a real browser. url2md handles this automatically via puppeteer-core
- **Images disappear** — WeChat CDN tokens expire. url2md downloads images immediately and rewrites Markdown references to local paths
- **Zero bloat** — uses your system Chrome (no Chromium download), 4 runtime dependencies

## Install

```bash
git clone https://github.com/ConstantineLiu/url2md.git
cd url2md
bun install
```

## Usage

```bash
# Single URL
bun src/cli.ts https://example.com/article

# WeChat article (auto-detected, launches browser)
bun src/cli.ts https://mp.weixin.qq.com/s/xxxxx

# Custom output directory
bun src/cli.ts https://example.com -o ~/reading/

# Force browser mode (for JS-heavy sites)
bun src/cli.ts --browser https://example.com

# Batch mode (one URL per line)
bun src/cli.ts --batch urls.txt

# Pipe
echo "https://example.com" | bun src/cli.ts
```

## Output

```
output/
  Article-Title.md
  Article-Title-images/
    Article-Title-01.png
    Article-Title-02.jpg
```

- Filenames are slugified (Unicode-safe, no spaces or special chars)
- Images downloaded in parallel (concurrency: 5)
- Tracking pixels (< 100 bytes) and data URIs are skipped

## How It Works

```
URL -> fetcher (direct fetch or browser)
    -> parser  (cheerio cleanup + turndown conversion)
    -> images  (parallel download + reference rewrite)
    -> output  (.md file + images/)
```

- **WeChat detection**: `mp.weixin.qq.com` URLs automatically use browser mode. Injects script to fix lazy-loaded images (`data-src` -> `src`)
- **Fallback strategy**: Normal URLs try `fetch()` first; if content is too short (< 500 chars), falls back to browser
- **puppeteer-core**: Connects to your installed Chrome — no Chromium download needed

## Architecture

```
src/
├── cli.ts        # CLI entry + pipeline orchestration
├── fetcher.ts    # Fetch strategy (direct -> browser fallback)
├── browser.ts    # puppeteer-core Chrome lifecycle
├── parser.ts     # cheerio cleanup + turndown Markdown conversion
├── images.ts     # Parallel image download + MD reference rewrite
└── wechat.ts     # WeChat-specific: URL detection, lazy-load fix, metadata extraction
```

## AI Agent Integration

url2md can be used as a skill/tool by AI agents (Claude Code, etc.).

### Skill Definition

```yaml
name: inbox
description: >
  Convert any URL (including WeChat articles) to clean local Markdown with
  downloaded images. Use when user shares a URL and wants it saved as Markdown,
  or asks to "download/save/extract" an article with images.
allowed-tools: Bash, Write, Read
```

### When to Trigger

- User shares a URL and wants Markdown output
- User says "download this article", "save as markdown", "extract this page"
- Processing WeChat public account articles

### Agent Commands

```bash
bun <path-to-url2md>/src/cli.ts <url>
bun <path-to-url2md>/src/cli.ts <url> -o <output-directory>
bun <path-to-url2md>/src/cli.ts --browser <url>
bun <path-to-url2md>/src/cli.ts --batch urls.txt
```

### Agent Workflow

1. Check dependencies: `cd <path-to-url2md> && bun install`
2. Run: `bun <path-to-url2md>/src/cli.ts <url> -o <target-dir>`
3. Show user: output file path, title, image count, first 20 lines preview
4. WeChat URLs (`mp.weixin.qq.com`) are auto-detected and use browser mode

## Requirements

- [Bun](https://bun.sh) runtime
- Google Chrome installed (for browser mode)
  - macOS: `/Applications/Google Chrome.app`
  - Windows: `C:\Program Files\Google\Chrome\Application\chrome.exe`
  - Linux: `/usr/bin/google-chrome`
  - Or set `CHROME_PATH` env var

## Dependencies

| Package | Purpose |
|---------|---------|
| puppeteer-core | Browser automation (connects to system Chrome) |
| cheerio | HTML parsing and cleanup |
| turndown | HTML to Markdown conversion |
| turndown-plugin-gfm | GFM support (tables, strikethrough) |

## License

MIT
