# B-roll

**把一段口播，做成有版面的动效视频。** 原片 + 完整 SRT + 一句要求 → 竖屏 MP4 + 可编辑 Three.js 工程。

**简体中文** · [English](README.md)

<p align="center">
  <img src="docs/media/mw-demo-right.gif" width="278" alt="成片片段：第 02 章拍数学题，版面自上而下构建，圆形人物小窗在右下，标签条在左下">
  <img src="docs/media/mw-demo-left.gif" width="278" alt="成片片段：第 08 章买东西前对比，三款参数逐行展开，圆形人物小窗在左下，标签条在右下">
</p>

<p align="center"><sub>第 02 章 拍数学题（人物小窗在右）　·　第 08 章 买东西前对比（人物小窗在左）</sub></p>

## 效果

一部 100 秒的「豆包十大功能」口播片，成品是这样：

- **1080×1920 竖屏、30fps**：每句话被拆成章节，编号、标题、参数、过程、结论各有位置，不再是一张脸讲到黑。
- **人物抠出来做成圆形小窗**：不再满屏占脸；小窗每两个章节左右换边，底部 20% 永远空着，避开抖音的 UI 遮挡。
- **版面逐层构建**：条件先立、过程展开、结果落下，切镜踩在音乐重拍上，而不是整块弹出。
- **交接有连续性**：横向擦拭、竖向推进、硬切按节奏分配，人物和标签条在切点完成位移，观众视线不掉。
- **工程可编辑**：Three.js 源码、时间轴 JSON、渲染脚本齐全，改完重渲即可。

▶ 带声音的原片：[第 02 章](docs/media/mw-demo-right.mp4) · [第 08 章](docs/media/mw-demo-left.mp4)

## 用法

### 1. 启动

只需要 **Node.js 22+ 与 WorkBuddy**。Windows 双击 `mw-start.bat`，macOS 双击 `mw-start.command`；也可以直接运行：

```sh
node scripts/mw-bootstrap.mjs
```

它会准备依赖、Python 环境、Chromium、FFmpeg 与人物抠像模型，然后自检并试跑一小段抠像。运行环境统一放在公共目录（见 `.env-root`），不写进项目，也不污染系统；本机已装好时这一步只做检查。装不上看[逐步安装指南](docs/mw-getting-started.md)。

### 2. 交素材

把原片和完整 SRT 放进 `inputs/`，用 WorkBuddy 打开整个文件夹，发送：

> 读 AGENTS.md，按需完成安装指南，再读项目内的两个 Skill。根据 `inputs/source.mp4` 与 `inputs/source.srt` 做口播视频动效包装：先做与原片同步的人物抠像层，再进入合成，保留口播顺序与时间。在 `work/my-first-film/` 制作，逐阶段检查实际画面与声音，交付 MP4 与可编辑工程。

### 3. 收片

成片和预览都是普通本地文件，直接打开即可，不需要启动任何服务。产物在 `work/<片名>/`：`render/film.mp4` 是成片，`film/` 是工程源码。需要浏览器访问 `work/` 下的页面时，才用 `node mw-serve.mjs`。

<details>
<summary>想自己验一遍</summary>

```sh
npm run doctor -- --matting   # 抠像环境
npm test                      # 规则清单与工具链
npm run smoke                 # 一次真实 Three.js → H.264 渲染
```

</details>

## 目录

| 路径 | 内容 |
|---|---|
| `.agents/skills/srt-brief/` | 分析 Skill：读 SRT、拆章节，产出 `PLAN.md` + `timeline.json` |
| `.agents/skills/motion-forge/` | 制作 Skill：动效、排版、声音、渲染的规则与工具 |
| `scripts/` | 安装、环境诊断、抠像、截帧、打包校验 |
| `reference-library/` | 43 个案例拆解 + 8 个开源字体 |

MIT 许可。第三方组件（Three.js、playwright-core、FFmpeg、RVM 抠像模型、字体）保留各自的上游许可。
