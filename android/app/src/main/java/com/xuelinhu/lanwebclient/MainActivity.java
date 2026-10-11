package com.xuelinhu.lanwebclient;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.view.ViewGroup;
import android.widget.Button;
import android.webkit.PermissionRequest;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.Toast;
import android.util.Base64;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

public final class MainActivity extends Activity {
    private static final int AUDIO_PERMISSION_REQUEST = 41;
    private static final int AUDIO_SAMPLE_RATE = 16000;
    private static final int MAX_AUDIO_BYTES = AUDIO_SAMPLE_RATE * 2 * 90;
    private android.content.SharedPreferences preferences;
    private WebView webView;
    private ProgressBar progressBar;
    private PermissionRequest pendingPermissionRequest;
    private String serverUrl;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private TextToSpeech textToSpeech;
    private volatile boolean textToSpeechReady;
    private boolean voicePermissionPending;
    private AudioRecord audioRecord;
    private Thread audioCaptureThread;
    private ByteArrayOutputStream audioBuffer;
    private volatile boolean audioRecording;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        preferences = getSharedPreferences("lan-web-client", MODE_PRIVATE);
        serverUrl = preferences.getString("serverUrl", BuildConfig.DEFAULT_URL);
        textToSpeech = new TextToSpeech(this, this::onTextToSpeechInitialized);
        showWebView();
    }

    private void onTextToSpeechInitialized(int status) {
        if (status != TextToSpeech.SUCCESS || textToSpeech == null) return;
        int language = textToSpeech.setLanguage(Locale.SIMPLIFIED_CHINESE);
        if (language == TextToSpeech.LANG_MISSING_DATA || language == TextToSpeech.LANG_NOT_SUPPORTED) {
            language = textToSpeech.setLanguage(Locale.getDefault());
        }
        textToSpeechReady = language != TextToSpeech.LANG_MISSING_DATA
                && language != TextToSpeech.LANG_NOT_SUPPORTED;
    }

    private void showWebView() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        LinearLayout toolbar = new LinearLayout(this);
        toolbar.setOrientation(LinearLayout.HORIZONTAL);
        Button serverButton = new Button(this);
        serverButton.setText("服务地址");
        serverButton.setOnClickListener(view -> showServerDialog());
        Button refreshButton = new Button(this);
        refreshButton.setText("刷新");
        refreshButton.setOnClickListener(view -> webView.reload());
        toolbar.addView(serverButton, new LinearLayout.LayoutParams(0, dp(48), 1));
        toolbar.addView(refreshButton, new LinearLayout.LayoutParams(0, dp(48), 1));
        root.addView(toolbar, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(48)));
        webView = new WebView(this);
        progressBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progressBar.setMax(100);
        progressBar.setProgressTintList(android.content.res.ColorStateList.valueOf(Color.rgb(0, 121, 107)));
        root.addView(progressBar, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(3)));
        root.addView(webView, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));
        setContentView(root);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (isSameOrigin(request.getUrl(), Uri.parse(serverUrl))) return false;
                Toast.makeText(MainActivity.this, "已拦截跨站页面跳转", Toast.LENGTH_SHORT).show();
                return true;
            }

            @Override
            public android.webkit.WebResourceResponse shouldInterceptRequest(
                    WebView view, WebResourceRequest request) {
                Uri target = request.getUrl();
                if (("http".equals(target.getScheme()) || "https".equals(target.getScheme()))
                        && !isSameOrigin(target, Uri.parse(serverUrl))) {
                    return new android.webkit.WebResourceResponse(
                            "text/plain", "UTF-8", 403, "Blocked", null,
                            new java.io.ByteArrayInputStream(new byte[0]));
                }
                return null;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request,
                                        android.webkit.WebResourceError error) {
                if (request.isForMainFrame()) {
                    Toast.makeText(MainActivity.this, "无法连接服务，请检查服务地址和局域网连接", Toast.LENGTH_LONG).show();
                }
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int progress) {
                progressBar.setProgress(progress);
                progressBar.setVisibility(progress >= 100 ? ProgressBar.GONE : ProgressBar.VISIBLE);
            }

            @Override
            public void onPermissionRequest(PermissionRequest request) {
                if (!isSameOrigin(request.getOrigin(), Uri.parse(serverUrl))) {
                    request.deny();
                    return;
                }
                boolean requestsAudio = false;
                for (String resource : request.getResources()) {
                    requestsAudio |= PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource);
                    if (!PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) {
                        request.deny();
                        return;
                    }
                }
                if (requestsAudio && checkSelfPermission(Manifest.permission.RECORD_AUDIO)
                        != PackageManager.PERMISSION_GRANTED) {
                    pendingPermissionRequest = request;
                    requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, AUDIO_PERMISSION_REQUEST);
                    return;
                }
                request.grant(request.getResources());
            }
        });
        webView.addJavascriptInterface(new RailwayVoiceBridge(), "RailwayVoice");
        webView.loadUrl(serverUrl);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != AUDIO_PERMISSION_REQUEST) return;
        boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
        if (pendingPermissionRequest != null) {
            if (granted) pendingPermissionRequest.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
            else pendingPermissionRequest.deny();
            pendingPermissionRequest = null;
        }
        if (voicePermissionPending) {
            voicePermissionPending = false;
            if (granted) beginVoiceInput();
            else sendVoiceStarted("麦克风权限被拒绝");
        }
    }

    private void beginVoiceInput() {
        int minBufferSize = AudioRecord.getMinBufferSize(
                AUDIO_SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
        if (minBufferSize <= 0) {
            sendVoiceStarted("设备无法初始化 16 kHz 麦克风录音");
            return;
        }
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            voicePermissionPending = true;
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, AUDIO_PERMISSION_REQUEST);
            return;
        }
        if (audioRecording) cancelVoiceInput(false);
        try {
            int bufferSize = Math.max(minBufferSize, AUDIO_SAMPLE_RATE / 2);
            AudioRecord recorder = new AudioRecord(
                    MediaRecorder.AudioSource.VOICE_RECOGNITION,
                    AUDIO_SAMPLE_RATE,
                    AudioFormat.CHANNEL_IN_MONO,
                    AudioFormat.ENCODING_PCM_16BIT,
                    bufferSize);
            if (recorder.getState() != AudioRecord.STATE_INITIALIZED) {
                recorder.release();
                recorder = new AudioRecord(
                        MediaRecorder.AudioSource.MIC,
                        AUDIO_SAMPLE_RATE,
                        AudioFormat.CHANNEL_IN_MONO,
                        AudioFormat.ENCODING_PCM_16BIT,
                        bufferSize);
            }
            if (recorder.getState() != AudioRecord.STATE_INITIALIZED) {
                recorder.release();
                sendVoiceStarted("麦克风初始化失败");
                return;
            }
            audioBuffer = new ByteArrayOutputStream();
            audioRecord = recorder;
            audioRecording = true;
            recorder.startRecording();
            AudioRecord activeRecorder = recorder;
            audioCaptureThread = new Thread(() -> captureAudio(activeRecorder), "railway-sign-audio-capture");
            audioCaptureThread.start();
            sendVoiceStarted(null);
        } catch (RuntimeException error) {
            cancelVoiceInput(false);
            sendVoiceStarted("无法启动麦克风录音");
        }
    }

    private void captureAudio(AudioRecord recorder) {
        byte[] chunk = new byte[Math.max(AUDIO_SAMPLE_RATE / 2, recorder.getBufferSizeInFrames() * 2)];
        while (audioRecording) {
            int count = recorder.read(chunk, 0, chunk.length, AudioRecord.READ_BLOCKING);
            if (count <= 0) {
                if (count < 0 && audioRecording) mainHandler.post(() -> failAudioCapture("麦克风读取失败"));
                return;
            }
            boolean reachedLimit = false;
            synchronized (this) {
                if (!audioRecording || audioBuffer == null) return;
                int remaining = MAX_AUDIO_BYTES - audioBuffer.size();
                int accepted = Math.min(remaining, count);
                if (accepted > 0) audioBuffer.write(chunk, 0, accepted);
                reachedLimit = accepted < count || audioBuffer.size() >= MAX_AUDIO_BYTES;
            }
            if (reachedLimit) {
                mainHandler.post(this::finishVoiceInput);
                return;
            }
        }
    }

    private void failAudioCapture(String message) {
        cancelVoiceInput(false);
        sendVoiceAudio(null, message);
    }

    private void finishVoiceInput() {
        AudioRecord recorder = audioRecord;
        if (recorder == null) {
            sendVoiceAudio(null, "当前没有正在录制的语音");
            return;
        }
        audioRecording = false;
        audioRecord = null;
        Thread captureThread = audioCaptureThread;
        audioCaptureThread = null;
        try {
            if (recorder.getRecordingState() == AudioRecord.RECORDSTATE_RECORDING) recorder.stop();
        } catch (RuntimeException ignored) {
            // The capture thread may already have stopped after reaching the size limit.
        }
        new Thread(() -> {
            if (captureThread != null && captureThread != Thread.currentThread()) {
                try {
                    captureThread.join(1500);
                } catch (InterruptedException error) {
                    Thread.currentThread().interrupt();
                }
            }
            recorder.release();
            byte[] pcm;
            synchronized (MainActivity.this) {
                pcm = audioBuffer == null ? new byte[0] : audioBuffer.toByteArray();
                audioBuffer = null;
            }
            if (pcm.length < AUDIO_SAMPLE_RATE / 5) {
                sendVoiceAudio(null, "录音太短，请至少说话半秒");
            } else {
                sendVoiceAudio(createWav(pcm), null);
            }
        }, "railway-sign-audio-finalize").start();
    }

    private byte[] createWav(byte[] pcm) {
        ByteBuffer header = ByteBuffer.allocate(44).order(ByteOrder.LITTLE_ENDIAN);
        header.put("RIFF".getBytes(StandardCharsets.US_ASCII));
        header.putInt(36 + pcm.length);
        header.put("WAVE".getBytes(StandardCharsets.US_ASCII));
        header.put("fmt ".getBytes(StandardCharsets.US_ASCII));
        header.putInt(16);
        header.putShort((short) 1);
        header.putShort((short) 1);
        header.putInt(AUDIO_SAMPLE_RATE);
        header.putInt(AUDIO_SAMPLE_RATE * 2);
        header.putShort((short) 2);
        header.putShort((short) 16);
        header.put("data".getBytes(StandardCharsets.US_ASCII));
        header.putInt(pcm.length);
        byte[] wav = new byte[header.capacity() + pcm.length];
        System.arraycopy(header.array(), 0, wav, 0, header.capacity());
        System.arraycopy(pcm, 0, wav, header.capacity(), pcm.length);
        return wav;
    }

    private void cancelVoiceInput(boolean notifyPage) {
        voicePermissionPending = false;
        audioRecording = false;
        AudioRecord recorder = audioRecord;
        audioRecord = null;
        Thread captureThread = audioCaptureThread;
        audioCaptureThread = null;
        synchronized (this) {
            audioBuffer = null;
        }
        if (recorder != null) {
            new Thread(() -> {
                try {
                    if (recorder.getRecordingState() == AudioRecord.RECORDSTATE_RECORDING) recorder.stop();
                } catch (RuntimeException ignored) {
                    // The audio source may have already stopped.
                }
                if (captureThread != null && captureThread != Thread.currentThread()) {
                    try {
                        captureThread.join(1000);
                    } catch (InterruptedException error) {
                        Thread.currentThread().interrupt();
                    }
                }
                recorder.release();
            }, "railway-sign-audio-cancel").start();
        }
        if (notifyPage) sendVoiceAudio(null, "语音录制已取消");
    }

    private boolean isAudioRecordAvailable() {
        return AudioRecord.getMinBufferSize(
                AUDIO_SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT) > 0;
    }

    private void sendVoiceStarted(String error) {
        if (webView == null) return;
        String errorArg = error == null ? "null" : JSONObject.quote(error);
        String script = "window.__railwayVoiceStarted(" + errorArg + ");";
        webView.post(() -> webView.evaluateJavascript(script, null));
    }

    private void sendVoiceAudio(byte[] audio, String error) {
        if (webView == null) return;
        String audioArg = audio == null ? "null" : JSONObject.quote(Base64.encodeToString(audio, Base64.NO_WRAP));
        String errorArg = error == null ? "null" : JSONObject.quote(error);
        String script = "window.__railwayVoiceAudio(" + audioArg + "," + errorArg + ");";
        webView.post(() -> webView.evaluateJavascript(script, null));
    }

    private final class RailwayVoiceBridge {
        @JavascriptInterface
        public boolean isAvailable() {
            return isAudioRecordAvailable();
        }

        @JavascriptInterface
        public boolean isTtsAvailable() {
            return textToSpeechReady;
        }

        @JavascriptInterface
        public void startVoiceInput() {
            mainHandler.post(MainActivity.this::beginVoiceInput);
        }

        @JavascriptInterface
        public void finishVoiceInput() {
            mainHandler.post(MainActivity.this::finishVoiceInput);
        }

        @JavascriptInterface
        public void stopVoiceInput() {
            mainHandler.post(() -> cancelVoiceInput(true));
        }

        @JavascriptInterface
        public void speak(String text) {
            mainHandler.post(() -> {
                if (!textToSpeechReady || textToSpeech == null || text == null || text.trim().isEmpty()) return;
                textToSpeech.speak(text, TextToSpeech.QUEUE_FLUSH, null, "railway-sign-" + System.nanoTime());
            });
        }

        @JavascriptInterface
        public void stopSpeak() {
            mainHandler.post(() -> {
                if (textToSpeech != null) textToSpeech.stop();
            });
        }
    }

    private void showServerDialog() {
        EditText input = new EditText(this);
        input.setSingleLine(true);
        input.setHint("http://192.168.1.9:4026");
        input.setText(serverUrl);
        input.setSelectAllOnFocus(true);
        new AlertDialog.Builder(this)
                .setTitle("服务地址")
                .setView(input)
                .setNegativeButton("取消", null)
                .setPositiveButton("连接", (dialog, which) -> {
                    String candidate = input.getText().toString().trim().replaceAll("/+$", "");
                    if (!isAllowedServer(candidate)) {
                        Toast.makeText(this, "HTTP 仅允许局域网地址，公网服务请使用 HTTPS", Toast.LENGTH_LONG).show();
                        return;
                    }
                    serverUrl = candidate;
                    preferences.edit().putString("serverUrl", serverUrl).apply();
                    webView.loadUrl(serverUrl);
                })
                .show();
    }

    private boolean isAllowedServer(String value) {
        Uri uri = Uri.parse(value);
        String scheme = uri.getScheme();
        String host = uri.getHost();
        if (host == null || uri.getUserInfo() != null
                || uri.getPort() != -1 && (uri.getPort() < 1 || uri.getPort() > 65535)) return false;
        if ("https".equalsIgnoreCase(scheme)) return true;
        if (!"http".equalsIgnoreCase(scheme)) return false;
        String[] octets = host.split("\\.");
        if ("localhost".equalsIgnoreCase(host)) return true;
        if (octets.length != 4) return false;
        try {
            int first = Integer.parseInt(octets[0]);
            int second = Integer.parseInt(octets[1]);
            int third = Integer.parseInt(octets[2]);
            int fourth = Integer.parseInt(octets[3]);
            if (first > 255 || second > 255 || third > 255 || fourth > 255) return false;
            return first == 10 || first == 127 || first == 192 && second == 168
                    || first == 172 && second >= 16 && second <= 31;
        } catch (NumberFormatException error) {
            return false;
        }
    }

    private boolean isSameOrigin(Uri target, Uri origin) {
        return target.getScheme() != null && target.getScheme().equals(origin.getScheme())
                && target.getHost() != null && origin.getHost() != null
                && target.getHost().equalsIgnoreCase(origin.getHost())
                && target.getPort() == origin.getPort();
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        cancelVoiceInput(false);
        if (textToSpeech != null) {
            textToSpeech.stop();
            textToSpeech.shutdown();
            textToSpeech = null;
        }
        if (webView != null) webView.destroy();
        super.onDestroy();
    }
}
