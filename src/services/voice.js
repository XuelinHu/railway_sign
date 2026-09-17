// 语音统一层：三层能力探测与自动降级。
//
//   1. 安卓原生桥（window.RailwayVoice）：WebView 里由 App 注入，直接调系统麦克风与系统 TTS；
//   2. 浏览器识别（webkitSpeechRecognition）：Chrome / Edge / 安卓 WebView 自带；
//   3. 录音回传：getUserMedia + Web Audio 采集，前端重采样成 16k 单声道 WAV，
//      交给后端 /api/ai/asr（sherpa-onnx SenseVoice）识别。
//
// 播报同理：优先后端 /api/ai/tts（edge-tts 神经网络音色，mp3），失败回落浏览器 speechSynthesis。

import http, { getToken } from './http.js'

const ANDROID_BRIDGE_TIMEOUT_MS = 30000

const getBridge = () => (typeof window !== 'undefined' ? window.RailwayVoice : null)

export const hasAndroidBridge = () => {
  const bridge = getBridge()
  return Boolean(bridge && (typeof bridge.isAvailable !== 'function' || bridge.isAvailable()))
}

export const hasSpeechRecognition = () =>
  typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)

export const hasRecorder = () =>
  typeof navigator !== 'undefined' &&
  Boolean(navigator.mediaDevices?.getUserMedia) &&
  typeof (window.AudioContext || window.webkitAudioContext) === 'function'

export const capabilities = () => ({
  android: hasAndroidBridge(),
  recognition: hasSpeechRecognition(),
  recorder: hasRecorder(),
  synth: typeof window !== 'undefined' && 'speechSynthesis' in window,
  // 只要有一层可用就能语音输入
  input: hasAndroidBridge() || hasSpeechRecognition() || hasRecorder(),
})

// —— 安卓桥：识别结果由 App 通过 window.__railwayVoiceResult(text) 异步回调 ——
let bridgeResolver = null

if (typeof window !== 'undefined') {
  window.__railwayVoiceResult = (text, error) => {
    if (!bridgeResolver) return
    const { resolve, reject, timer } = bridgeResolver
    bridgeResolver = null
    clearTimeout(timer)
    if (error) reject(new Error(String(error)))
    else resolve(String(text || ''))
  }
}

const listenAndroidBridge = () => {
  const bridge = getBridge()
  if (!bridge || typeof bridge.startVoiceInput !== 'function') {
    return Promise.reject(new Error('未检测到安卓原生语音桥'))
  }
  bridge.startVoiceInput()
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      bridgeResolver = null
      try {
        bridge.stopVoiceInput?.()
      } catch (_) {
        /* 忽略原生异常 */
      }
      reject(new Error('安卓语音识别超时'))
    }, ANDROID_BRIDGE_TIMEOUT_MS)
    bridgeResolver = { resolve, reject, timer }
  })
}

const stopAndroidBridge = () => {
  try {
    getBridge()?.stopVoiceInput?.()
  } catch (_) {
    /* 忽略 */
  }
}

// —— 浏览器识别（webkitSpeechRecognition） ——
const listenBrowserRecognition = (lang = 'zh-CN') => {
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!Ctor) return Promise.reject(new Error('当前浏览器不支持语音识别'))
  const recognition = new Ctor()
  recognition.lang = lang
  recognition.interimResults = false
  recognition.continuous = false
  recognition.maxAlternatives = 1

  return new Promise((resolve, reject) => {
    let settled = false
    recognition.onresult = (event) => {
      settled = true
      const text = event.results?.[0]?.[0]?.transcript || ''
      resolve(text.trim())
    }
    recognition.onerror = (event) => {
      if (settled) return
      settled = true
      const map = {
        'not-allowed': '麦克风权限被拒绝，请在浏览器设置中允许',
        'service-not-allowed': '浏览器语音服务不可用（需要 HTTPS 或 localhost）',
        'no-speech': '没有检测到语音，请重试',
        'audio-capture': '未检测到麦克风设备',
        network: '语音识别网络异常',
      }
      reject(new Error(map[event.error] || `语音识别失败：${event.error}`))
    }
    recognition.onend = () => {
      if (!settled) {
        settled = true
        reject(new Error('没有识别到内容，请靠近麦克风重试'))
      }
    }
    try {
      recognition.start()
    } catch (error) {
      reject(new Error(`无法启动语音识别：${error?.message || error}`))
    }
  })
}

// —— 录音回传：Web Audio 采集 → 16k 单声道 WAV ——
let recorder = null

/**
 * 开始录音（需用户手势触发）。返回 {stop: async () => wav Blob, cancel: () => void, level: () => number}
 */
export const startRecording = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
  })
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  const context = new AudioCtx()
  const source = context.createMediaStreamSource(stream)
  const processor = context.createScriptProcessor(4096, 1, 1)
  const silent = context.createGain()
  silent.gain.value = 0 // 不把声音放出来，避免啸叫

  const chunks = []
  let peak = 0
  processor.onaudioprocess = (event) => {
    const input = event.inputBuffer.getChannelData(0)
    chunks.push(new Float32Array(input))
    let localPeak = 0
    for (let i = 0; i < input.length; i += 16) localPeak = Math.max(localPeak, Math.abs(input[i]))
    peak = localPeak
  }

  source.connect(processor)
  processor.connect(silent)
  silent.connect(context.destination)

  const cleanup = () => {
    try {
      processor.disconnect()
      source.disconnect()
      silent.disconnect()
    } catch (_) {
      /* 忽略 */
    }
    stream.getTracks().forEach((track) => track.stop())
    context.close().catch(() => {})
  }

  recorder = {
    context,
    level: () => peak,
    sampleRate: context.sampleRate,
    cancel: () => {
      chunks.length = 0
      cleanup()
      recorder = null
    },
    stop: async () => {
      cleanup()
      recorder = null
      const merged = mergeChunks(chunks)
      if (!merged.length) throw new Error('没有采集到音频')
      const wav = encodeWav(resample(merged, context.sampleRate, 16000), 16000)
      return wav
    },
  }
  return recorder
}

export const stopRecording = async () => {
  if (!recorder) throw new Error('当前没有正在进行的录音')
  return recorder.stop()
}

export const cancelRecording = () => {
  recorder?.cancel()
}

export const recordLevel = () => recorder?.level() ?? 0

const mergeChunks = (chunks) => {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const merged = new Float32Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.length
  }
  return merged
}

// 线性插值重采样到 16kHz（SenseVoice 要求），不依赖 ffmpeg 与 MediaRecorder
const resample = (samples, fromRate, toRate) => {
  if (fromRate === toRate) return samples
  const ratio = fromRate / toRate
  const length = Math.floor(samples.length / ratio)
  const output = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    const position = i * ratio
    const index = Math.floor(position)
    const fraction = position - index
    const next = Math.min(index + 1, samples.length - 1)
    output[i] = samples[index] * (1 - fraction) + samples[next] * fraction
  }
  return output
}

// 16 位 PCM 单声道 WAV（自写文件头）
const encodeWav = (samples, sampleRate) => {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  const writeText = (offset, text) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
  }
  writeText(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeText(8, 'WAVE')
  writeText(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // 单声道
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeText(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
    offset += 2
  }
  return new Blob([view], { type: 'audio/wav' })
}

/**
 * 统一语音输入入口：按 安卓桥 → 浏览器识别 → 录音回传 依次降级。
 * onLevel 用于录音模式下驱动波形动画。
 */
export const listen = async ({ prefer = 'auto', lang = 'zh-CN', onLevel } = {}) => {
  const caps = capabilities()

  if (prefer !== 'record' && caps.android) {
    return { text: await listenAndroidBridge(), source: 'android' }
  }
  if (prefer !== 'record' && caps.recognition) {
    try {
      return { text: await listenBrowserRecognition(lang), source: 'browser' }
    } catch (error) {
      if (!caps.recorder) throw error
      // 浏览器识别失败（如无 HTTPS）时回落到录音上传
    }
  }
  if (!caps.recorder) throw new Error('当前环境不支持语音输入')

  await startRecording()
  const levelTimer = onLevel ? setInterval(() => onLevel(recordLevel()), 120) : null
  // 交给调用方在"停止说话"时调用 finish
  return {
    source: 'record',
    finish: async () => {
      if (levelTimer) clearInterval(levelTimer)
      const wav = await stopRecording()
      return transcribe(wav)
    },
    cancel: () => {
      if (levelTimer) clearInterval(levelTimer)
      cancelRecording()
    },
  }
}

/** 上传 WAV 到后端做识别 */
export const transcribe = async (wavBlob) => {
  const data = await http.post('/ai/asr', wavBlob, {
    raw: true,
    headers: { 'Content-Type': 'audio/wav' },
    timeout: 60000,
  })
  return { text: data?.text || '', source: 'server', engine: data?.engine, elapsedMs: data?.elapsedMs }
}

export const stopListening = () => {
  stopAndroidBridge()
  cancelRecording()
}

// —— 语音播报 ——
let currentAudio = null

/** 后端 edge-tts 合成并播放；返回 {ok, source}。失败时由调用方决定是否回落浏览器 */
export const speakByServer = async (text, { voice = 'zh-CN-XiaoxiaoNeural', rate = '+0%' } = {}) => {
  stopSpeaking()
  const token = getToken()
  const response = await fetch('/api/ai/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ text, voice, rate }),
  })
  if (!response.ok) {
    let message = `语音合成失败（${response.status}）`
    try {
      const payload = JSON.parse(await response.text())
      if (payload?.error) message = payload.error
    } catch (_) {
      /* 保持默认 */
    }
    throw new Error(message)
  }
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const audio = new Audio(url)
  currentAudio = audio
  await new Promise((resolve, reject) => {
    audio.onended = () => {
      URL.revokeObjectURL(url)
      if (currentAudio === audio) currentAudio = null
      resolve()
    }
    audio.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('音频播放失败'))
    }
    audio.play().catch(reject)
  })
  return { ok: true, source: 'server' }
}

/** 浏览器/安卓原生 TTS 播报（后端不可用时的降级路径） */
export const speakBySystem = (text, { lang = 'zh-CN' } = {}) => {
  if (hasAndroidBridge() && typeof getBridge().speak === 'function') {
    try {
      getBridge().speak(text)
      return Promise.resolve({ ok: true, source: 'android' })
    } catch (_) {
      /* 继续尝试浏览器 */
    }
  }
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return Promise.reject(new Error('当前环境不支持语音播报'))
  }
  return new Promise((resolve) => {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = lang
    utterance.rate = 1
    utterance.pitch = 1
    utterance.onend = () => resolve({ ok: true, source: 'browser' })
    utterance.onerror = () => resolve({ ok: false, source: 'browser' })
    window.speechSynthesis.speak(utterance)
  })
}

export const speak = async (text, options = {}) => {
  const content = String(text || '')
    .replace(/```[\s\S]*?```/g, ' 代码块 ')
    .replace(/[*#`>_~-]/g, '')
    .trim()
  if (!content) return { ok: false, source: 'none' }
  try {
    return await speakByServer(content, options)
  } catch (_) {
    try {
      return await speakBySystem(content, options)
    } catch (_) {
      return { ok: false, source: 'none' }
    }
  }
}

export const stopSpeaking = () => {
  if (currentAudio) {
    try {
      currentAudio.pause()
    } catch (_) {
      /* 忽略 */
    }
    currentAudio = null
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
  try {
    getBridge()?.stopSpeak?.()
  } catch (_) {
    /* 忽略 */
  }
}

export const listVoices = () => http.get('/ai/tts/voices')

export const voiceHealth = () => http.get('/voice/health')

export default {
  capabilities,
  listen,
  stopListening,
  startRecording,
  stopRecording,
  cancelRecording,
  recordLevel,
  transcribe,
  speak,
  speakByServer,
  speakBySystem,
  stopSpeaking,
  listVoices,
  voiceHealth,
}
