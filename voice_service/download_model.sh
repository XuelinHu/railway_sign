#!/usr/bin/env bash
# 下载 SenseVoice 语音识别模型（sherpa-onnx 离线版，zh/en/ja/ko/yue，int8 量化约 250MB）。
# 模型解压到 voice_service/models/sense-voice/，该目录已在 .gitignore 中忽略。
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODELS_DIR="$HERE/models"
TARGET_DIR="$MODELS_DIR/sense-voice"
ARCHIVE="$MODELS_DIR/sense-voice.tar.bz2"
URL="https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17.tar.bz2"

mkdir -p "$MODELS_DIR"

if [ -f "$TARGET_DIR/model.int8.onnx" ] || [ -f "$TARGET_DIR/model.onnx" ]; then
  echo "模型已存在：$TARGET_DIR"
  exit 0
fi

echo "开始下载 SenseVoice 模型（约 250MB）…"
# 支持通过 HTTPS_PROXY 走代理（脚本会自动继承环境变量）
curl -L --fail --retry 3 --progress-bar -o "$ARCHIVE" "$URL"

echo "解压中…"
tar xjf "$ARCHIVE" -C "$MODELS_DIR"
mv "$MODELS_DIR/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17" "$TARGET_DIR"
rm -f "$ARCHIVE"

echo "完成：$TARGET_DIR"
ls -1 "$TARGET_DIR"
