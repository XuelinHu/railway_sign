import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'

const root = process.cwd()
const docsDir = path.join(root, 'docs')

const runNodeScript = (script, args = []) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [script, ...args], {
    cwd: root,
    stdio: 'inherit'
  })

  child.on('exit', (code) => {
    if (code === 0) resolve()
    else reject(new Error(`${script} exited with code ${code}`))
  })
  child.on('error', reject)
})

const loadPdf = async (targetPath) => {
  const bytes = await fs.readFile(targetPath)
  return PDFDocument.load(bytes)
}

const countPages = async (targetPath) => {
  const pdf = await loadPdf(targetPath)
  return pdf.getPageCount()
}

const mmToPt = (mm) => (mm * 72) / 25.4

const loadDocMeta = async (markdownPath, fallbackTitle) => {
  const packageJson = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'))
  const markdown = await fs.readFile(markdownPath, 'utf8')
  const heading = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() || fallbackTitle
  const softwareName = heading
    .replace(/软件设计说明书$/, '')
    .replace(/源代码整理稿$/, '')
    .replace(/程序鉴别材料$/, '')
    .replace(/文档鉴别材料$/, '')
    .trim()

  return {
    softwareName: softwareName || fallbackTitle,
    version: packageJson.version || '1.0.0'
  }
}

const loadChineseFontBytes = async () => {
  const candidates = [
    'C:/Windows/Fonts/simhei.ttf',
    'C:/Windows/Fonts/msyh.ttc',
    'C:/Windows/Fonts/simsun.ttc'
  ]

  for (const candidate of candidates) {
    try {
      return await fs.readFile(candidate)
    } catch {
      continue
    }
  }

  throw new Error('未找到可用的中文字体文件用于页眉页脚排版')
}

const getFileSizeMb = async (targetPath) => {
  const stat = await fs.stat(targetPath)
  return stat.size / (1024 * 1024)
}

const trimPdfIfNeeded = async (inputPath, outputPath) => {
  const sourcePdf = await loadPdf(inputPath)
  const pageCount = sourcePdf.getPageCount()

  if (pageCount <= 60) {
    if (inputPath !== outputPath) {
      await fs.copyFile(inputPath, outputPath)
    }
    return { pageCount, trimmed: false, keptPages: pageCount }
  }

  const targetPdf = await PDFDocument.create()
  const firstPages = Array.from({ length: 30 }, (_, index) => index)
  const lastPages = Array.from({ length: 30 }, (_, index) => pageCount - 30 + index)
  const selected = [...firstPages, ...lastPages]
  const copiedPages = await targetPdf.copyPages(sourcePdf, selected)
  copiedPages.forEach((page) => targetPdf.addPage(page))
  await fs.writeFile(outputPath, await targetPdf.save())

  return {
    pageCount,
    trimmed: true,
    keptPages: selected.length,
    rangeText: `1-30, ${pageCount - 29}-${pageCount}`
  }
}

const stampFinalPdf = async (targetPath, meta, fontBytes) => {
  const pdf = await loadPdf(targetPath)
  pdf.registerFontkit(fontkit)
  const chineseFont = await pdf.embedFont(fontBytes, { subset: true })
  const latinFont = await pdf.embedFont(StandardFonts.Helvetica)
  const pageCount = pdf.getPageCount()
  const topBandHeight = mmToPt(18)
  const bottomBandHeight = mmToPt(15)
  const headerText = `${meta.softwareName} V${meta.version}`
  const headerFontSize = 10.5
  const footerFontSize = 10
  const footerY = mmToPt(6.5)
  const lineColor = rgb(0.78, 0.81, 0.85)
  const textColor = rgb(0.22, 0.25, 0.29)
  const pageCountTextWidthCache = new Map()
  const headerTextWidthCache = new Map()

  pdf.getPages().forEach((page, index) => {
    const { width, height } = page.getSize()
    const headerY = height - mmToPt(12)
    const topLineY = height - mmToPt(18)
    const pageNoText = `${index + 1} / ${pageCount}`
    const pageNoTextWidth = pageCountTextWidthCache.get(pageNoText) || latinFont.widthOfTextAtSize(pageNoText, footerFontSize)
    pageCountTextWidthCache.set(pageNoText, pageNoTextWidth)
    const headerTextWidth = headerTextWidthCache.get(headerText) || chineseFont.widthOfTextAtSize(headerText, headerFontSize)
    headerTextWidthCache.set(headerText, headerTextWidth)

    page.drawRectangle({
      x: 0,
      y: height - topBandHeight,
      width,
      height: topBandHeight,
      color: rgb(1, 1, 1)
    })

    page.drawRectangle({
      x: 0,
      y: 0,
      width,
      height: bottomBandHeight,
      color: rgb(1, 1, 1)
    })

    page.drawLine({
      start: { x: mmToPt(12), y: topLineY },
      end: { x: width - mmToPt(12), y: topLineY },
      thickness: 0.8,
      color: lineColor
    })

    page.drawLine({
      start: { x: mmToPt(12), y: mmToPt(14) },
      end: { x: width - mmToPt(12), y: mmToPt(14) },
      thickness: 0.8,
      color: lineColor
    })

    page.drawText(headerText, {
      x: (width - headerTextWidth) / 2,
      y: headerY,
      size: headerFontSize,
      font: chineseFont,
      color: textColor
    })

    page.drawText(pageNoText, {
      x: (width - pageNoTextWidth) / 2,
      y: footerY,
      size: footerFontSize,
      font: latinFont,
      color: textColor
    })
  })

  await fs.writeFile(targetPath, await pdf.save())
  return pageCount
}

const formatTrimText = (result) => (
  result.trimmed
    ? `${result.keptPages} 页（按 ${result.rangeText} 保留）`
    : `${result.keptPages} 页（未触发裁剪）`
)

const updateResultDoc = async ({
  designFullPages,
  designResult,
  sourceFullPages,
  sourceResult,
  designSizeMb,
  sourceSizeMb
}) => {
  const resultPath = path.join(docsDir, '软著材料整理结果.md')
  let content = await fs.readFile(resultPath, 'utf8')
  content = content.replace(/## 3\. PDF 转换状态[\s\S]*?## 4\. 推荐转换方式/m, `## 3. PDF 转换状态

- \`docs/软著源代码整理稿.pdf\`：已生成
- \`docs/软件设计说明书.pdf\`：已生成

## 4. 推荐转换方式`)

  const extra = `

## 5. PDF 页数校验

- \`docs/软件设计说明书.full.pdf\`：${designFullPages} 页
- \`docs/软件设计说明书.pdf\`：${formatTrimText(designResult)}
- \`docs/软著源代码整理稿.full.pdf\`：${sourceFullPages} 页
- \`docs/软著源代码整理稿.pdf\`：${formatTrimText(sourceResult)}

## 6. PDF 格式校验

- 页面规格：A4 纵向排版
- 页眉内容：软件名称 + 版本号
- 页脚内容：连续页码
- 提交格式：PDF
- \`docs/软件设计说明书.pdf\`：${designSizeMb.toFixed(2)} MB
- \`docs/软著源代码整理稿.pdf\`：${sourceSizeMb.toFixed(2)} MB

## 7. 图片与截图目录

- \`docs/assets/diagrams\`：正式图形材料目录
- \`docs/assets/screenshots\`：正式页面截图目录
`

  if (content.includes('## 5. PDF 页数校验')) {
    content = content.replace(/## 5\. PDF 页数校验[\s\S]*$/m, extra.trimStart())
  } else {
    content += extra
  }

  await fs.writeFile(resultPath, content, 'utf8')
}

await runNodeScript(path.join('scripts', 'render-softdoc-diagrams.mjs'))
await runNodeScript(path.join('scripts', 'generate-soft-copyright-docs.mjs'))
await runNodeScript(path.join('scripts', 'export-markdown-pdf.mjs'), [
  path.join('docs', '软件设计说明书.md'),
  path.join('docs', '软件设计说明书.full.pdf'),
  'design'
])
await runNodeScript(path.join('scripts', 'export-markdown-pdf.mjs'), [
  path.join('docs', '软著源代码整理稿.md'),
  path.join('docs', '软著源代码整理稿.full.pdf'),
  'source'
])

const designPdfPath = path.join(docsDir, '软件设计说明书.pdf')
const designFullPdfPath = path.join(docsDir, '软件设计说明书.full.pdf')
const sourceFullPdfPath = path.join(docsDir, '软著源代码整理稿.full.pdf')
const sourcePdfPath = path.join(docsDir, '软著源代码整理稿.pdf')
const designMeta = await loadDocMeta(path.join(docsDir, '软件设计说明书.md'), '软件设计说明书')
const sourceMeta = await loadDocMeta(path.join(docsDir, '软著源代码整理稿.md'), '软著源代码整理稿')
const fontBytes = await loadChineseFontBytes()

const designFullPages = await countPages(designFullPdfPath)
if (designFullPages < 30) {
  throw new Error(`软件设计说明书页数不足 30 页，当前为 ${designFullPages} 页`)
}

const designResult = await trimPdfIfNeeded(designFullPdfPath, designPdfPath)
const sourceResult = await trimPdfIfNeeded(sourceFullPdfPath, sourcePdfPath)
await stampFinalPdf(designPdfPath, designMeta, fontBytes)
await stampFinalPdf(sourcePdfPath, sourceMeta, fontBytes)
const designSizeMb = await getFileSizeMb(designPdfPath)
const sourceSizeMb = await getFileSizeMb(sourcePdfPath)

if (designSizeMb > 20) {
  throw new Error(`软件设计说明书 PDF 超过 20MB，当前为 ${designSizeMb.toFixed(2)} MB`)
}
if (sourceSizeMb > 20) {
  throw new Error(`软著源代码整理稿 PDF 超过 20MB，当前为 ${sourceSizeMb.toFixed(2)} MB`)
}

await updateResultDoc({
  designFullPages,
  designResult,
  sourceFullPages: sourceResult.pageCount,
  sourceResult,
  designSizeMb,
  sourceSizeMb
})

console.log(`Design PDF pages(full): ${designFullPages}`)
console.log(`Design PDF trimmed: ${designResult.trimmed ? 'yes' : 'no'}`)
console.log(`Source PDF pages(full): ${sourceResult.pageCount}`)
console.log(`Source PDF trimmed: ${sourceResult.trimmed ? 'yes' : 'no'}`)
