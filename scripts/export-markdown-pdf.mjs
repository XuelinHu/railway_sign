import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const root = process.cwd()
const args = process.argv.slice(2)

if (args.length < 2) {
  console.error('Usage: node scripts/export-markdown-pdf.mjs <input.md> <output.pdf> [source|design]')
  process.exit(1)
}

const inputPath = path.resolve(root, args[0])
const outputPath = path.resolve(root, args[1])
const explicitDocKind = args[2]
const tempHtmlPath = path.resolve(root, '.tmp', `${path.basename(outputPath, '.pdf')}.print.html`)
const inputDirUrl = pathToFileURL(path.dirname(inputPath) + path.sep).href
const markedUrl = pathToFileURL(path.join(root, 'node_modules', 'marked', 'lib', 'marked.umd.js')).href

const browserCandidates = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'
]

const ensureDir = async (targetPath) => fs.mkdir(path.dirname(targetPath), { recursive: true })

const escapeHtml = (value) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')

const pickBrowser = async () => {
  for (const candidate of browserCandidates) {
    try {
      await fs.access(candidate)
      return candidate
    } catch {
      continue
    }
  }
  throw new Error('No supported browser found for PDF export')
}

const md = await fs.readFile(inputPath, 'utf8')
const title = path.basename(inputPath, path.extname(inputPath))
const docKind = explicitDocKind || (/源代码/.test(title) ? 'source' : 'design')
const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <base href="${inputDirUrl}">
  <title>${escapeHtml(title)}</title>
  <script src="${markedUrl}"></script>
  <style>
    @page { size: A4 portrait; margin: 20mm 12mm 18mm 12mm; }
    * { box-sizing: border-box; }
    body { font-family: "Microsoft YaHei", "PingFang SC", Arial, sans-serif; color: #1f2328; margin: 0; }
    body.design-doc { line-height: 1.8; }
    body.source-doc { line-height: 1.22; }
    main { width: 100%; }
    h1, h2, h3, h4 { color: #0f2742; page-break-after: avoid; }
    body.design-doc h1 { font-size: 25px; border-bottom: 2px solid #d0d7de; padding-bottom: 8px; margin: 0 0 18px; }
    body.design-doc h2 { font-size: 19px; margin-top: 24px; margin-bottom: 12px; }
    body.design-doc h3 { font-size: 15.5px; margin-top: 18px; margin-bottom: 10px; }
    body.design-doc h4 { font-size: 13px; margin-top: 12px; margin-bottom: 6px; }
    body.source-doc h1 { font-size: 18px; border-bottom: 1px solid #d0d7de; padding-bottom: 6px; margin: 0 0 10px; }
    body.source-doc h2 { font-size: 14px; margin-top: 12px; margin-bottom: 4px; }
    body.source-doc h3, body.source-doc h4 { font-size: 12px; margin-top: 8px; margin-bottom: 4px; }
    body.design-doc p, body.design-doc li, body.design-doc td, body.design-doc th { font-size: 13.5px; line-height: 1.8; }
    body.source-doc p, body.source-doc li, body.source-doc td, body.source-doc th { font-size: 10px; line-height: 1.25; }
    p, ul, ol, table, pre, blockquote { margin-top: 4px; margin-bottom: 6px; }
    body.design-doc p, body.design-doc ul, body.design-doc ol, body.design-doc table, body.design-doc pre, body.design-doc blockquote { margin-top: 8px; margin-bottom: 14px; }
    ul, ol { padding-left: 24px; }
    code { font-family: Consolas, "Courier New", monospace; background: #f6f8fa; padding: 1px 4px; border-radius: 4px; }
    body.design-doc code { font-size: 11px; }
    body.source-doc code { font-size: 9px; }
    pre { background: #0d1117; color: #e6edf3; padding: 6px 8px; border-radius: 6px; overflow: hidden; white-space: pre-wrap; word-break: break-word; page-break-inside: auto; }
    body.source-doc pre { line-height: 1.16; }
    body.source-doc pre code { background: transparent; color: inherit; padding: 0; font-size: 8.6px; line-height: 1.16; }
    body.design-doc pre code { background: transparent; color: inherit; padding: 0; font-size: 10px; line-height: 1.25; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #d0d7de; padding: 6px 8px; vertical-align: top; }
    blockquote { color: #57606a; border-left: 4px solid #d0d7de; margin: 0; padding-left: 12px; }
    img { display: block; max-width: 100%; height: auto; margin: 10px auto 18px; border: 1px solid #d0d7de; border-radius: 8px; page-break-inside: avoid; object-fit: contain; }
    body.design-doc img { margin: 16px auto 12px; }
    hr { border: none; border-top: 1px solid #d0d7de; margin: 10px 0; }
    .doc-figure { margin: 16px 0 18px; page-break-inside: avoid; }
    .figure-image { display: block; margin: 0 auto; }
    .diagram-image { width: 100%; max-width: 100%; }
    .screenshot-image { width: auto; max-width: 100%; max-height: 205mm; }
    .figure-caption { text-align: center; font-size: 12.5px; color: #374151; margin: 8px 0 0; page-break-before: avoid; }
    .table-caption { text-align: center; font-size: 12.5px; color: #374151; margin: 14px 0 10px; page-break-after: avoid; }
    .page-break { break-before: page; page-break-before: always; height: 0; }
  </style>
</head>
<body class="${docKind === 'source' ? 'source-doc' : 'design-doc'}">
  <main id="app"></main>
  <script id="source" type="text/plain">${md.replace(/<\/script>/gi, '<\\/script>')}</script>
  <script>
    const source = document.getElementById('source').textContent;
    document.getElementById('app').innerHTML = marked.parse(source, { gfm: true, breaks: false });
    window.__PRINT_READY__ = true;
  </script>
</body>
</html>`

await ensureDir(outputPath)
await ensureDir(tempHtmlPath)
await fs.writeFile(tempHtmlPath, html, 'utf8')

const browser = await pickBrowser()

await new Promise((resolve, reject) => {
  const child = spawn(browser, [
    '--headless=new',
    '--disable-gpu',
    '--allow-file-access-from-files',
    '--no-pdf-header-footer',
    '--run-all-compositor-stages-before-draw',
    '--virtual-time-budget=20000',
    `--print-to-pdf=${outputPath}`,
    tempHtmlPath
  ], { stdio: 'inherit' })

  child.on('exit', (code) => {
    if (code === 0) resolve()
    else reject(new Error(`Browser exited with code ${code}`))
  })
  child.on('error', reject)
})

console.log(`Exported PDF: ${outputPath}`)
