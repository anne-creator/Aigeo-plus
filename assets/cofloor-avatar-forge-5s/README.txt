CoFloor · Avatar Forge · 5 秒加速版

直接观看
CoFloor-Avatar-Forge-5s.mp4：5.000 秒，1920×1080，30fps，含同步加速音效。
CoFloor-Avatar-Forge-5s-Silent.mp4：同一画面的无声版本，方便剪辑。
原 18 秒动画整体加速 3.6 倍，保留全部四个阶段：
0.00–1.25 秒：扫描人脸。
1.25–2.33 秒：全息 3D 头模浮出、旋转。
1.40–2.15 秒：粒子聚合、立体角色成型。
3.56–5.00 秒：数字员工转身、挥手亮相。

交互版本
在本目录运行 python3 -m http.server 8987 --bind 127.0.0.1
浏览器打开 http://127.0.0.1:8987/
或启动 start.command（macOS）/ start-windows.bat（Windows）。需要 Python 3。
首次静音自动播放，支持重播、暂停、拖动进度、音效开关、全屏。
开启系统“减少动态效果”时默认停在完成画面。
请通过 HTTP 服务打开；不要直接双击 index.html。
全部代码、照片、Three.js 和音效都在包内，无需联网或 API key。

接入项目
将整个目录放到静态服务 /avatar-forge/ 下，嵌入：
<iframe src="/avatar-forge/index.html" style="width:100%;aspect-ratio:16/10;border:0" allow="autoplay; fullscreen"></iframe>
同源父页面可访问 iframe.contentWindow.CoFloorAvatarForge。
play() / pause() / replay() / seek(秒)，duration 为 5。
currentTime、playing 可读取。播放完成后在 iframe 的 window 上触发 cofloor:avatar-ready。
所有公开时间参数均为 0–5 秒；scene.js 内部保留 18 秒编舞，通过 SPEED=3.6 映射。
window.renderFrame(秒, JPEG质量) 返回当前帧 JPEG base64，可离线导出。

文件
scene.js：真实 3D 几何、粒子、镜头、字幕、内部编舞。
player.js / index.html / style.css：5 秒播放器和交互控件。
soundtrack.m4a：已压缩到 5 秒的立体声音效，音高保持。
assets/：内置 image_gen 生成的虚构员工照片及完整提示词。
vendor/：本地 Three.js 与许可证。
render.cjs：重新导出 5 秒无声视频，需要 Node、Playwright、Chrome 和 FFmpeg。
check.cjs / validation.json：播放器验证脚本与结果。

重新导出
启动上述 HTTP 服务后，执行 node render.cjs。
再执行：
ffmpeg -y -i CoFloor-Avatar-Forge-5s-Silent.mp4 -i soundtrack.m4a -c copy -t 5 -movflags +faststart CoFloor-Avatar-Forge-5s.mp4
渲染脚本优先使用本地安装的 playwright；附有原制作机器的依赖回退路径，可按需修改。

这是视觉动效原型。照片人物为虚构员工，扫描及重建进度为示意；头模和角色采用程序化 3D 几何，尚未连接真实人脸识别或照片重建后端。
