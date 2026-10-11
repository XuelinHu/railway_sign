# railway_sign Android 客户端

该 APK 通过原生 WebView 连接本项目局域网网页服务，默认地址为 http://192.168.1.9:PORT，可在应用顶部“服务地址”中更改。HTTP 只接受私有局域网地址；公网域名必须使用 HTTPS。页面仅允许留在配置的同源地址，并注入 RailwayVoice bridge。桥接录音在设备本地采集 16 kHz 单声道 WAV，再由登录态前端发送给配置的 API 做 SenseVoice 识别。

构建 release APK：

`powershell
cd android
.\gradlew.bat assembleRelease
Copy-Item app\build\outputs\apk\release\app-release.apk ..\dist\railway_sign-release.apk -Force
`

录音使用 Android AudioRecord，不依赖 HTTP 页面中的 getUserMedia 或厂商语音识别服务；首次使用时会请求录音权限。语音播报优先使用 API edge-tts，服务不可用时回落 Android 系统 TTS。release 当前使用 debug 签名，供开发和内网验收。
