import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { diagramSpecs } from './softdoc-diagrams.mjs'

const root = process.cwd()
const tempRoot = path.join(root, '.tmp', 'softdocs')
const htmlDir = path.join(tempRoot, 'diagram-pages')
const imageDir = path.join(tempRoot, 'diagrams')

const browserCandidates = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'
]

const pickBrowser = async () => {
  for (const candidate of browserCandidates) {
    try {
      await fs.access(candidate)
      return candidate
    } catch {
      continue
    }
  }
  throw new Error('No supported browser found for diagram rendering')
}

const mermaidUrl = pathToFileURL(path.join(root, 'node_modules', 'mermaid', 'dist', 'mermaid.esm.min.mjs')).href

const buildHtml = (diagram) => `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${diagram.title}</title>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background: #ffffff;
      overflow: hidden;
      font-family: "Microsoft YaHei", "PingFang SC", Arial, sans-serif;
    }
    body {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .canvas {
      width: ${diagram.width - 120}px;
      height: ${diagram.height - 120}px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: #ffffff;
    }
    .mermaid {
      width: 100%;
      text-align: center;
    }
    svg {
      max-width: 100%;
      max-height: 100%;
    }
  </style>
</head>
<body>
  <div class="canvas">
    <div class="mermaid">${diagram.definition.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
  </div>
  <script type="module">
    import mermaid from '${mermaidUrl}';
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
      flowchart: { useMaxWidth: true, htmlLabels: true },
      sequence: { useMaxWidth: true, wrap: true }
    });
    await mermaid.run({ querySelector: '.mermaid' });
    if (document.fonts?.ready) await document.fonts.ready;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  </script>
</body>
</html>`

const browser = await pickBrowser()

await fs.mkdir(htmlDir, { recursive: true })
await fs.mkdir(imageDir, { recursive: true })

for (const diagram of diagramSpecs) {
  const htmlPath = path.join(htmlDir, `${diagram.id}.html`)
  const imagePath = path.join(imageDir, diagram.filename)
  await fs.writeFile(htmlPath, buildHtml(diagram), 'utf8')

  await new Promise((resolve, reject) => {
    const child = spawn(browser, [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--allow-file-access-from-files',
      '--run-all-compositor-stages-before-draw',
      '--default-background-color=ffffff',
      `--window-size=${diagram.width},${diagram.height}`,
      `--screenshot=${imagePath}`,
      `file:///${htmlPath.replace(/\\/g, '/')}`
    ], { stdio: 'inherit' })

    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`Diagram render failed: ${diagram.id}`))
    })
    child.on('error', reject)
  })
}

console.log(`Rendered ${diagramSpecs.length} diagrams to ${imageDir}`)
