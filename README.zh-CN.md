# url2md

把任何 URL 转成干净的本地 Markdown，自动下载图片。专为微信公众号和普通网页设计。

[**English**](./README.md)

## 为什么做这个

- **微信屏蔽直接请求** — curl/wget 拿不到内容，url2md 通过 puppeteer-core 自动启动真实浏览器
- **图片会失效** — 微信 CDN token 过期后图片就没了，url2md 立即下载并重写为本地路径
- **零膨胀** — 使用系统 Chrome（不下载 Chromium），仅 4 个运行时依赖

## 安装

```bash
git clone https://github.com/ConstantineLiu/url2md.git
cd url2md
bun install
```

## 使用

```bash
# 单个 URL
bun src/cli.ts https://example.com/article

# 微信公众号（自动检测，启动浏览器）
bun src/cli.ts https://mp.weixin.qq.com/s/xxxxx

# 指定输出目录
bun src/cli.ts https://example.com -o ~/reading/

# 强制浏览器模式（JS 重度网站）
bun src/cli.ts --browser https://example.com

# 批量模式（一行一个 URL）
bun src/cli.ts --batch urls.txt

# 管道
echo "https://example.com" | bun src/cli.ts
```

## 输出

```
output/
  文章标题.md
  文章标题-images/
    文章标题-01.png
    文章标题-02.jpg
```

- 文件名 slug 化（Unicode 安全，无空格和特殊字符）
- 图片并行下载（并发 5）
- 跳过追踪像素（< 100 字节）和 data URI

## 工作原理

```
URL -> fetcher（直接抓取或浏览器）
    -> parser （cheerio 清洗 + turndown 转换）
    -> images （并行下载 + 引用重写）
    -> output （.md 文件 + images/）
```

- **微信检测**: `mp.weixin.qq.com` 自动走浏览器路径，注入脚本修复懒加载图片（`data-src` -> `src`）
- **回退策略**: 普通 URL 先 fetch，内容不足 500 字符则回退浏览器
- **puppeteer-core**: 连接系统 Chrome，不下载 Chromium

## 架构

```
src/
├── cli.ts        # 入口 + 管线编排
├── fetcher.ts    # 抓取策略链（直接 fetch -> 浏览器回退）
├── browser.ts    # puppeteer-core Chrome 生命周期
├── parser.ts     # cheerio 清洗 + turndown Markdown 转换
├── images.ts     # 图片并行下载 + Markdown 引用重写
└── wechat.ts     # 微信专用：URL 检测、懒加载修复、元数据提取
```

## AI 智能体集成

url2md 可作为 AI 智能体（Claude Code 等）的 skill/tool 使用。

### Skill 定义

```yaml
name: inbox
description: >
  将任何 URL（包括微信公众号文章）转为干净的本地 Markdown，自动下载图片。
  当用户分享 URL 并希望保存为 Markdown，或要求"下载/保存/提取"文章时触发。
allowed-tools: Bash, Write, Read
```

### 触发时机

- 用户分享 URL 并想要 Markdown 输出
- 用户说"下载文章""保存为 markdown""提取页面"
- 处理微信公众号文章

### 调用方式

```bash
bun <url2md路径>/src/cli.ts <url>
bun <url2md路径>/src/cli.ts <url> -o <输出目录>
bun <url2md路径>/src/cli.ts --browser <url>
bun <url2md路径>/src/cli.ts --batch urls.txt
```

### 工作流

1. 检查依赖: `cd <url2md路径> && bun install`
2. 执行: `bun <url2md路径>/src/cli.ts <url> -o <目标目录>`
3. 展示: 输出路径、标题、图片数量、前 20 行预览
4. 微信链接（`mp.weixin.qq.com`）自动检测并使用浏览器模式

## 依赖环境

- [Bun](https://bun.sh) 运行时
- Google Chrome（浏览器模式需要）
  - macOS: `/Applications/Google Chrome.app`
  - Windows: `C:\Program Files\Google\Chrome\Application\chrome.exe`
  - Linux: `/usr/bin/google-chrome`
  - 或设置 `CHROME_PATH` 环境变量

## 运行时依赖

| 包名 | 用途 |
|------|------|
| puppeteer-core | 浏览器自动化，连接系统 Chrome |
| cheerio | HTML 解析清洗 |
| turndown | HTML 转 Markdown |
| turndown-plugin-gfm | GFM 表格和删除线支持 |

## License

MIT
