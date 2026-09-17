#!/usr/bin/env python3
"""铁路信号机平台：本地语音服务（离线 ASR + 神经网络 TTS）。

只监听 127.0.0.1，由统一后台（server/api-server.js，8037）的 /api/ai/asr、/api/ai/tts 转发调用，
浏览器不直接访问本服务。

接口：
  GET  /health   → 服务与模型状态
  GET  /voices   → 可用中文音色列表
  POST /asr      → body 为 16k 单声道 WAV 原始字节，返回 {"text": "..."}
  POST /tts      → JSON {"text","voice","rate"}，返回 mp3 音频字节

依赖：sherpa-onnx（SenseVoice 离线识别）、edge-tts（在线神经网络合成）、numpy。
只用标准库起 HTTP 服务（http.server），不引入 Web 框架。
"""

import json
import os
import re
import sys
import time
import wave
import asyncio
import threading
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
from urllib.parse import urlparse

import numpy as np

HOST = os.environ.get("VOICE_HOST_BIND", "127.0.0.1")
PORT = int(os.environ.get("VOICE_PORT", "8039"))
HERE = os.path.dirname(os.path.abspath(__file__))

DEFAULT_MODEL_DIR = os.path.join(HERE, "models", "sense-voice")
MODEL_DIR = os.environ.get("VOICE_ASR_MODEL_DIR", DEFAULT_MODEL_DIR)
NUM_THREADS = int(os.environ.get("VOICE_ASR_THREADS", "4"))
DEFAULT_VOICE = os.environ.get("VOICE_TTS_VOICE", "zh-CN-XiaoxiaoNeural")
MAX_BODY_BYTES = int(os.environ.get("VOICE_MAX_BODY_BYTES", str(16 * 1024 * 1024)))
SAMPLE_RATE = 16000

# 常用中文音色（离线清单，避免每次请求都访问网络）
VOICES = [
    {"name": "zh-CN-XiaoxiaoNeural", "label": "晓晓（女声·温柔）"},
    {"name": "zh-CN-YunxiNeural", "label": "云希（男声·沉稳）"},
    {"name": "zh-CN-YunjianNeural", "label": "云健（男声·浑厚）"},
    {"name": "zh-CN-XiaoyiNeural", "label": "晓伊（女声·活泼）"},
    {"name": "zh-CN-YunyangNeural", "label": "云扬（男声·新闻）"},
    {"name": "zh-CN-liaoning-XiaobeiNeural", "label": "晓北（东北女声）"},
    {"name": "zh-CN-shaanxi-XiaoniNeural", "label": "晓妮（陕西女声）"},
    {"name": "zh-TW-HsiaoChenNeural", "label": "曉臻（台湾女声）"},
]

log_lock = threading.Lock()


def log(message):
    with log_lock:
        print(f"{time.strftime('%Y-%m-%dT%H:%M:%S')} [voice] {message}", flush=True)


# —— ASR：sherpa-onnx SenseVoice ——
asr_lock = threading.Lock()
recognizer = None
asr_error = None


def load_recognizer():
    """进程启动时加载一次；失败不退出，/health 会如实上报，便于前端降级。"""
    global recognizer, asr_error
    try:
        import sherpa_onnx
    except ImportError as exc:
        asr_error = f"未安装 sherpa-onnx：{exc}（执行 pip install -r voice_service/requirements.txt）"
        log(asr_error)
        return

    if not os.path.isdir(MODEL_DIR):
        asr_error = f"未找到模型目录 {MODEL_DIR}，请先执行 bash voice_service/download_model.sh"
        log(asr_error)
        return

    int8_model = os.path.join(MODEL_DIR, "model.int8.onnx")
    fp32_model = os.path.join(MODEL_DIR, "model.onnx")
    model_file = int8_model if os.path.exists(int8_model) else fp32_model
    tokens = os.path.join(MODEL_DIR, "tokens.txt")
    if not os.path.exists(model_file) or not os.path.exists(tokens):
        asr_error = f"模型文件不完整（{MODEL_DIR} 需要 model.int8.onnx/model.onnx 与 tokens.txt）"
        log(asr_error)
        return

    started = time.time()
    try:
        recognizer = sherpa_onnx.OfflineRecognizer.from_sense_voice(
            model=model_file,
            tokens=tokens,
            num_threads=NUM_THREADS,
            sample_rate=SAMPLE_RATE,
            feature_dim=80,
            decoding_method="greedy_search",
            provider="cpu",
            language="auto",   # 中英日韩粤自动识别
            use_itn=True,      # 开启逆文本规整：数字、标点更自然
            debug=False,
        )
        log(f"SenseVoice 模型加载完成：{os.path.basename(model_file)}，耗时 {time.time() - started:.2f}s")
    except Exception as exc:  # noqa: BLE001 - 启动期任何异常都要降级而不是崩溃
        asr_error = f"模型加载失败：{exc}"
        log(asr_error)
        log(traceback.format_exc())


def wav_bytes_to_samples(raw):
    """解析 WAV 字节 → (float32 单声道 16k 采样, 时长秒)。"""
    with wave.open(BytesIO(raw), "rb") as wav:
        channels = wav.getnchannels()
        width = wav.getsampwidth()
        rate = wav.getframerate()
        frames = wav.readframes(wav.getnframes())

    if width == 2:
        data = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768.0
    elif width == 1:
        data = (np.frombuffer(frames, dtype=np.uint8).astype(np.float32) - 128.0) / 128.0
    elif width == 4:
        data = np.frombuffer(frames, dtype=np.int32).astype(np.float32) / 2147483648.0
    else:
        raise ValueError(f"不支持的位深：{width * 8} 位（请上传 16 位 PCM WAV）")

    if channels > 1:
        data = data.reshape(-1, channels).mean(axis=1)

    duration = len(data) / float(rate) if rate else 0.0
    if rate != SAMPLE_RATE:
        data = resample(data, rate, SAMPLE_RATE)
    return data, duration


def resample(samples, src_rate, dst_rate):
    """线性插值重采样（前端已重采样过一次，这里只做兜底）。"""
    if src_rate == dst_rate or len(samples) == 0:
        return samples
    length = int(len(samples) * dst_rate / src_rate)
    if length <= 0:
        return samples
    src_index = np.linspace(0, len(samples) - 1, num=length)
    return np.interp(src_index, np.arange(len(samples)), samples).astype(np.float32)


def transcribe(raw):
    if recognizer is None:
        raise RuntimeError(asr_error or "语音识别模型未就绪")
    samples, duration = wav_bytes_to_samples(raw)
    if len(samples) < SAMPLE_RATE // 10:
        raise ValueError("音频过短（不足 0.1 秒）")

    started = time.time()
    # sherpa-onnx 的 recognizer 不是线程安全的，解码串行化
    with asr_lock:
        stream = recognizer.create_stream()
        stream.accept_waveform(SAMPLE_RATE, samples)
        recognizer.decode_stream(stream)
        text = stream.result.text or ""
    return {
        "text": text.strip(),
        "duration_ms": round(duration * 1000),
        "elapsed_ms": round((time.time() - started) * 1000),
        "engine": "sherpa-onnx-sense-voice",
    }


# —— TTS：edge-tts ——
def synthesize(text, voice=DEFAULT_VOICE, rate="+0%"):
    import edge_tts

    if not re.match(r"^[A-Za-z]{2}-[A-Za-z]+-[\w]+Neural$", voice or ""):
        voice = DEFAULT_VOICE
    if not re.match(r"^[+-]\d{1,3}%$", rate or ""):
        rate = "+0%"

    # 本机需要经代理访问外网时，把代理显式交给 edge-tts
    proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy") or None

    async def collect():
        communicate = edge_tts.Communicate(text, voice, rate=rate, proxy=proxy)
        chunks = []
        async for chunk in communicate.stream():
            if chunk.get("type") == "audio" and chunk.get("data"):
                chunks.append(chunk["data"])
        return b"".join(chunks)

    audio = asyncio.run(collect())
    if not audio:
        raise RuntimeError("语音合成返回空音频")
    return audio


# —— HTTP 服务 ——
class VoiceHandler(BaseHTTPRequestHandler):
    server_version = "railway-sign-voice/1.0"
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):  # 收敛默认访问日志
        log(f"{self.address_string()} {fmt % args}")

    def _send(self, status, payload, content_type="application/json; charset=utf-8"):
        body = payload if isinstance(payload, bytes) else json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0:
            return b""
        if length > MAX_BODY_BYTES:
            raise ValueError(f"请求体过大（{length} 字节，上限 {MAX_BODY_BYTES}）")
        return self.rfile.read(length)

    def do_OPTIONS(self):  # noqa: N802 - 标准库要求的命名
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):  # noqa: N802
        path = urlparse(self.path).path
        if path == "/health":
            return self._send(200, {
                "ok": True,
                "service": "railway-sign-voice",
                "port": PORT,
                "asr": recognizer is not None,
                "asr_error": asr_error,
                "asr_model": os.path.basename(MODEL_DIR),
                "tts": True,
                "tts_voice": DEFAULT_VOICE,
                "voices": len(VOICES),
                "sample_rate": SAMPLE_RATE,
            })
        if path == "/voices":
            return self._send(200, {"voices": VOICES, "default": DEFAULT_VOICE})
        return self._send(404, {"ok": False, "error": "Not Found"})

    def do_POST(self):  # noqa: N802
        path = urlparse(self.path).path
        try:
            raw = self._read_body()
        except ValueError as exc:
            return self._send(413, {"ok": False, "error": str(exc)})

        if path == "/asr":
            if not raw:
                return self._send(400, {"ok": False, "error": "没有收到音频数据"})
            try:
                result = transcribe(raw)
                log(f"asr ok: {result['duration_ms']}ms 音频 / {result['elapsed_ms']}ms 解码 → {result['text'][:40]}")
                return self._send(200, result)
            except Exception as exc:  # noqa: BLE001
                log(f"asr failed: {exc}")
                return self._send(503 if recognizer is None else 400, {"ok": False, "error": str(exc)})

        if path == "/tts":
            try:
                payload = json.loads(raw.decode("utf-8") or "{}")
            except json.JSONDecodeError as exc:
                return self._send(400, {"ok": False, "error": f"请求体不是合法 JSON：{exc}"})
            text = (payload.get("text") or "").strip()
            if not text:
                return self._send(400, {"ok": False, "error": "播报文本不能为空"})
            if len(text) > 1000:
                return self._send(400, {"ok": False, "error": "播报文本过长（最多 1000 字）"})
            started = time.time()
            try:
                audio = synthesize(text, payload.get("voice") or DEFAULT_VOICE, payload.get("rate") or "+0%")
            except Exception as exc:  # noqa: BLE001
                log(f"tts failed: {exc}")
                return self._send(503, {"ok": False, "error": f"语音合成失败：{exc}"})
            log(f"tts ok: {len(text)} 字 → {len(audio)} 字节 / {round((time.time() - started) * 1000)}ms")
            return self._send(200, audio, content_type="audio/mpeg")

        return self._send(404, {"ok": False, "error": "Not Found"})


def main():
    log(f"启动中：bind={HOST}:{PORT}，模型目录={MODEL_DIR}")
    load_recognizer()
    if recognizer is None:
        log("警告：语音识别不可用，/asr 将返回 503；TTS 仍可用。")
    server = ThreadingHTTPServer((HOST, PORT), VoiceHandler)
    log(f"已监听 http://{HOST}:{PORT}（/health /voices /asr /tts）")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        log("收到中断信号，退出")
    finally:
        server.server_close()


if __name__ == "__main__":
    sys.exit(main())
