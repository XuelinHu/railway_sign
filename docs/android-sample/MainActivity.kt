package com.example.railwaysign

import android.Manifest
import android.annotation.SuppressLint
import android.content.pm.PackageManager
import android.os.Bundle
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.example.railwaysign.voice.VoiceBridge

/**
 * WebView 承载 railway_sign 前端，并注入语音桥。
 *
 * 关键点：
 *  1. WebView 必须开启 javaScriptEnabled 与 domStorageEnabled（前端用 localStorage 存令牌）；
 *  2. mediaPlaybackRequiresUserGesture = false，否则语音播报会被浏览器策略拦截；
 *  3. onPermissionRequest 必须放行 RESOURCE_AUDIO_CAPTURE，否则页面里的 getUserMedia 录音不可用；
 *  4. 首帧前注入 RailwayVoice，避免前端能力探测时桥还没挂上。
 */
class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var voiceBridge: VoiceBridge

    private val requestMic = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        // 无论是否授权都继续注入桥：未授权时 startVoiceInput 会回传明确错误，前端可降级
        if (!granted) {
            webView.post {
                webView.evaluateJavascript(
                    "window.__railwayVoiceResult && window.__railwayVoiceResult(null, '用户拒绝了麦克风权限')",
                    null,
                )
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this)
        setContentView(webView)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            cacheMode = WebSettings.LOAD_DEFAULT
        }

        webView.webViewClient = WebViewClient()

        webView.webChromeClient = object : WebChromeClient() {
            // 页面里的 getUserMedia（录音回传降级路径）会走到这里
            override fun onPermissionRequest(request: PermissionRequest) {
                if (request.resources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE)) {
                    if (hasMicPermission()) {
                        request.grant(request.resources)
                    } else {
                        requestMic.launch(Manifest.permission.RECORD_AUDIO)
                        request.deny()
                    }
                } else {
                    super.onPermissionRequest(request)
                }
            }
        }

        voiceBridge = VoiceBridge(applicationContext) { webView }
        // 原生桥对象必须在页面脚本执行前注入
        webView.addJavascriptInterface(voiceBridge, VoiceBridge.NAME)

        if (!hasMicPermission()) requestMic.launch(Manifest.permission.RECORD_AUDIO)

        // 生产环境换成你的实际地址：FRP 公网入口或内网地址
        webView.loadUrl("http://<你的服务器地址>:14028/")
    }

    private fun hasMicPermission() =
        ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED

    override fun onDestroy() {
        voiceBridge.release()
        webView.destroy()
        super.onDestroy()
    }
}
