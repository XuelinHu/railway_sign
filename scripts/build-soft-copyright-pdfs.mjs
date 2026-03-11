import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { PDFDocument } from 'pdf-lib'

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

const trimSourcePdfIfNeeded = async (inputPath, outputPath) => {
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
  const lastPages = Array.from({ length: 29 }, (_, index) => pageCount - 29 + index)
  const selected = [...firstPages, ...lastPages]
  const copiedPages = await targetPdf.copyPages(sourcePdf, selected)
  copiedPages.forEach((page) => targetPdf.addPage(page))
  await fs.writeFile(outputPath, await targetPdf.save())

  return {
    pageCount,
    trimmed: true,
    keptPages: selected.length,
    rangeText: `1-30, ${pageCount - 28}-${pageCount}`
  }
}

const updateResultDoc = async ({ designPages, sourceFullPages, trimmed, keptPages, rangeText }) => {
  const resultPath = path.join(docsDir, '软著材料整理结果.md')
  let content = await fs.readFile(resultPath, 'utf8')
  const extra = `

## 5. PDF 页数校验

- \`docs/软件设计说明书.pdf\`：${designPages} 页
- \`docs/软著源代码整理稿.full.pdf\`：${sourceFullPages} 页
- \`docs/软著源代码整理稿.pdf\`：${trimmed ? `${keptPages} 页（按 ${rangeText} 保留）` : `${keptPages} 页（未触发裁剪）`}
`

  if (content.includes('## 5. PDF 页数校验')) {
    content = content.replace(/## 5\. PDF 页数校验[\s\S]*$/m, extra.trimStart())
  } else {
    content += extra
  }

  await fs.writeFile(resultPath, content, 'utf8')
}

await runNodeScript(path.join('scripts', 'generate-soft-copyright-docs.mjs'))
await runNodeScript(path.join('scripts', 'export-markdown-pdf.mjs'), [
  path.join('docs', '软件设计说明书.md'),
  path.join('docs', '软件设计说明书.pdf')
])
await runNodeScript(path.join('scripts', 'export-markdown-pdf.mjs'), [
  path.join('docs', '软著源代码整理稿.md'),
  path.join('docs', '软著源代码整理稿.full.pdf')
])

const designPdfPath = path.join(docsDir, '软件设计说明书.pdf')
const sourceFullPdfPath = path.join(docsDir, '软著源代码整理稿.full.pdf')
const sourcePdfPath = path.join(docsDir, '软著源代码整理稿.pdf')

const designPages = await countPages(designPdfPath)
if (designPages < 30) {
  throw new Error(`软件设计说明书页数不足 30 页，当前为 ${designPages} 页`)
}

const trimResult = await trimSourcePdfIfNeeded(sourceFullPdfPath, sourcePdfPath)
await updateResultDoc({
  designPages,
  sourceFullPages: trimResult.pageCount,
  trimmed: trimResult.trimmed,
  keptPages: trimResult.keptPages,
  rangeText: trimResult.rangeText || '全部页面'
})

console.log(`Design PDF pages: ${designPages}`)
console.log(`Source PDF pages(full): ${trimResult.pageCount}`)
console.log(`Source PDF trimmed: ${trimResult.trimmed ? 'yes' : 'no'}`)
