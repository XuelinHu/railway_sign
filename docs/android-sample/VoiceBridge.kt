package com.example.railwaysign.voice

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import org.json.JSONObject
import java.util.Locale

/**
 * WebView 注入的语音桥，对应前端 src/services/voice.js 的桥接约定：
 *
 *   window.RailwayVoice.isAvailable()      -> Boolean  可选；返回 false 时前端认为原生不可用
 *   window.RailwayVoice.startVoiceInput()  -> void     开始识别
 *   window.RailwayVoice.stopVoiceInput()   -> void     取消识别
 *   window.RailwayVoice.speak(text)        -> void     系统 TTS 播报
 *
 * 识别结束时必须回调前端：
 *   window.__railwayVoiceResult(text)              识别成功
 *   window.__railwayVoiceResult(null, "错误说明")   识别失败
 *
 * 注意：@JavascriptInterface 方法运行在 WebView 的 JavaBridge 线程，而 SpeechRecognizer
 * 与 TextToSpeech 都要求主线程调用，因此统一 post 到主线程执行。
 */
class VoiceBridge(
    private val context: Context,
    private val webViewProvider: () -> WebView?,
) {
    companion object {
        const val NAME = "RailwayVoice"
        private const val TAG = "VoiceBridge"
    }

    private val main = Handler(Looper.getMainLooper())
    private var recognizer: SpeechRecognizer? = null
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private var listening = false

    init {
        main.post {
            if (SpeechRecognizer.isRecognitionAvailable(context)) {
                recognizer = SpeechRecognizer.createSpeechRecognizer(context).apply {
                    setRecognitionListener(listener)
                }
            } else {
                Log.w(TAG, "设备不支持 SpeechRecognizer，前端将自动降级到浏览器识别或录音上传")
            }
            tts = TextToSpeech(context) { status ->
                ttsReady = status == TextToSpeech.SUCCESS
                if (ttsReady) {
                    tts?.language = Locale.SIMPLIFIED_CHINESE
                } else {
                    Log.w(TAG, "系统 TTS 初始化失败，前端将回落到浏览器 speechSynthesis")
                }
            }
        }
    }

    private val listener = object : RecognitionListener {
        override fun onReadyForSpeech(params: Bundle?) = Unit
        override fun onBeginningOfSpeech() = Unit
        override fun onRmsChanged(rmsdB: Float) = Unit
        override fun onBufferReceived(buffer: ByteArray?) = Unit
        override fun onEndOfSpeech() = Unit

        override fun onError(error: Int) {
            listening = false
            // 用户主动取消（前端调用 stopVoiceInput 时触发）不算失败
            if (error == SpeechRecognizer.ERROR_CLIENT) return
            postResult(null, describeError(error))
        }

        override fun onResults(results: Bundle?) {
            listening = false
            val text = results
                ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                ?.firstOrNull()
                .orEmpty()
            postResult(text, null)
        }

        override fun onPartialResults(partialResults: Bundle?) = Unit
        override fun onEvent(eventType: Int, params: Bundle?) = Unit
    }

    private fun describeError(error: Int): String = when (error) {
        SpeechRecognizer.ERROR_AUDIO -> "录音设备异常"
        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "缺少录音权限，请在系统设置中授权"
        SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "语音识别网络异常"
        SpeechRecognizer.ERROR_NO_MATCH -> "没有识别到内容，请重试"
        SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "识别服务忙，请稍后重试"
        SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "没有检测到语音输入"
        else -> "语音识别失败（错误码 $error）"
    }

    /** 把结果回传给前端页面；必须做 JSON 转义，避免文本里的引号破坏 JS 语法。 */
    private fun postResult(text: String?, error: String?) {
        val script = if (error != null) {
            "window.__railwayVoiceResult && window.__railwayVoiceResult(null, ${JSONObject.quote(error)})"
        } else {
            "window.__railwayVoiceResult && window.__railwayVoiceResult(${JSONObject.quote(text.orEmpty())})"
        }
        webViewProvider()?.post { webViewProvider()?.evaluateJavascript(script, null) }
    }

    private fun intent() = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
        putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
        putExtra(RecognizerIntent.EXTRA_LANGUAGE, "zh-CN")
        putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false)
        putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
    }

    @JavascriptInterface
    fun isAvailable(): Boolean = recognizer != null || ttsReady

    @JavascriptInterface
    fun startVoiceInput() {
        main.post {
            val engine = recognizer
            if (engine == null) {
                postResult(null, "本机不支持系统语音识别")
                return@post
            }
            if (listening) engine.cancel()
            listening = true
            engine.startListening(intent())
        }
    }

    @JavascriptInterface
    fun stopVoiceInput() {
        main.post {
            listening = false
            recognizer?.cancel()
        }
    }

    @JavascriptInterface
    fun speak(text: String?) {
        val content = text?.trim().orEmpty()
        if (content.isEmpty()) return
        main.post {
            if (ttsReady) {
                tts?.speak(content, TextToSpeech.QUEUE_FLUSH, null, "railway-sign")
            } else {
                // 原生 TTS 不可用时如实回报错误，前端会回落到 speechSynthesis
                Log.w(TAG, "系统 TTS 未就绪，忽略本次播报")
            }
        }
    }

    /** Activity onDestroy 时调用，释放原生资源。 */
    fun release() {
        main.post {
            listening = false
            recognizer?.destroy()
            recognizer = null
            tts?.stop()
            tts?.shutdown()
            tts = null
            ttsReady = false
        }
    }
}
