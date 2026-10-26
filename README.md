# B-roll

**Turn a talking-head recording into a designed film.** Footage + complete SRT + one brief → vertical MP4 + editable Three.js project.

[简体中文](README.zh-CN.md) · **English**

<p align="center">
  <img src="docs/media/mw-demo-right.gif" width="278" alt="Film excerpt: chapter 02 Math homework, the layout builds top to bottom, circular avatar at bottom right, label bar at bottom left">
  <img src="docs/media/mw-demo-left.gif" width="278" alt="Film excerpt: chapter 08 Comparing three products, three parameter columns unfold row by row, circular avatar at bottom left, label bar at bottom right">
</p>

<p align="center"><sub>Chapter 02 Math homework (avatar right)　·　Chapter 08 Comparing three products (avatar left)</sub></p>

## What it looks like

A 100-second "ten things Doubao can do" talking-head film, produced end to end:

- **1080×1920 vertical, 30 fps** — every sentence becomes a chapter, with its own number, title, parameters, process and payoff instead of one face talking for the whole runtime.
- **The speaker is matted into a small circular window** — no full-frame face; the window swaps left/right every two chapters, and the bottom 20% of the frame stays empty so platform UI never covers the face or the type.
- **Layouts build in layers** — conditions first, process unfolds, result lands, and cuts sit on musical downbeats rather than popping in as blocks.
- **Hand-offs stay continuous** — horizontal wipes, vertical pushes and hard cuts are assigned by rhythm, so the avatar and label bar move exactly at the cut and the eye never loses its place.
- **The project stays editable** — Three.js source, timeline JSON and render scripts ship with the film; change anything and re-render.

▶ With sound: [chapter 02](docs/media/mw-demo-right.mp4) · [chapter 08](docs/media/mw-demo-left.mp4)

## How to use it

### 1. Start

All you need is **Node.js 22+ and WorkBuddy**. Double-click `mw-start.bat` on Windows or `mw-start.command` on macOS, or run:

```sh
node scripts/mw-bootstrap.mjs
```

It prepares dependencies, the Python environment, Chromium, FFmpeg and the matting model, then self-checks and runs a short matting pass. Everything lives in a shared environment root named by `.env-root` — nothing is written into the project and nothing is installed system-wide; on a machine that is already set up this step only verifies. If it fails, see the [step-by-step guide](docs/mw-getting-started.md).

### 2. Hand over the material

Put the footage and its complete SRT into `inputs/`, open the whole folder in WorkBuddy, and send:

> Read AGENTS.md, follow the install guide as needed, then read the two project Skills. Take `inputs/source.mp4` and `inputs/source.srt` and produce a motion-designed talking-head film: build the person layer first, synced to the original, then move on to composition, keeping the original speaking order and timing. Work in `work/my-first-film/`, check the real picture and sound at every stage, and deliver the MP4 plus the editable project.

### 3. Collect the result

The finished MP4 and its preview are ordinary local files — open them directly, no server needed. Output lives in `work/<film>/`: `render/film.mp4` is the film, `film/` is the project source. `node mw-serve.mjs` is only for browsing pages under `work/` in a browser.

<details>
<summary>Verify it yourself</summary>

```sh
npm run doctor -- --matting   # matting environment
npm test                      # rule manifests and toolchain
npm run smoke                 # one real Three.js → H.264 render
```

</details>

## Layout

| Path | Contents |
|---|---|
| `.agents/skills/srt-brief/` | Analysis Skill: reads the SRT, splits it into chapters, writes `PLAN.md` + `timeline.json` |
| `.agents/skills/motion-forge/` | Production Skill: rules and tools for motion, typography, sound and rendering |
| `scripts/` | Install, diagnostics, matting, frame capture, package checks |
| `reference-library/` | 43 case breakdowns + 8 open-source typefaces |

MIT licensed. Third-party components (Three.js, playwright-core, FFmpeg, the RVM matting model, the bundled fonts) keep their own upstream licences.
