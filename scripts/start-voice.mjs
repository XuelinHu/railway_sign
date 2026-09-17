#!/usr/bin/env node
// 启动本地语音服务（Python 边车，默认 127.0.0.1:8039）。
// 自动挑选解释器、检查依赖与模型是否存在，缺失时给出明确的修复命令，然后透传信号给子进程。
import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const serverPath = join(root, 'voice_service', 'voice_server.py')
const modelDir = process.env.VOICE_ASR_MODEL_DIR || join(root, 'voice_service', 'models', 'sense-voice')

const candidates = [process.env.VOICE_PYTHON, process.env.PYTHON, 'python3'].filter(Boolean)
const python = candidates.find((cmd) => spawnSync(cmd, ['-c', 'import sys'], { stdio: 'ignore' }).status === 0) || 'python3'

if (!existsSync(serverPath)) {
  console.error(`[voice] 找不到 ${serverPath}`)
  process.exit(1)
}

// 依赖检查：缺失时只提示，不阻断启动（TTS 仍可用，只是 /asr 会返回 503）
const probe = spawnSync(python, ['-c', 'import sherpa_onnx, edge_tts, numpy'], { encoding: 'utf8' })
if (probe.status !== 0) {
  console.warn('[voice] 提示：缺少 Python 依赖，语音识别不可用。请先执行：')
  console.warn(`[voice]   ${python} -m pip install -r voice_service/requirements.txt`)
}
if (!existsSync(modelDir)) {
  console.warn('[voice] 提示：未找到 SenseVoice 模型，请先执行：bash voice_service/download_model.sh')
}

console.log(`[voice] 使用解释器：${python}`)
console.log(`[voice] 模型目录：${modelDir}`)

const child = spawn(python, [serverPath], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
})

child.on('exit', (code, signal) => {
  if (signal) console.log(`[voice] 已由信号 ${signal} 结束`)
  process.exit(code ?? 0)
})

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => child.kill(sig))
}
