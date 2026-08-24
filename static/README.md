# Pandrator Static

This is the serverless golden path for turning common documents into audiobooks in the browser. It is **not** a second server implementation: the static target ports the deterministic source-cleaning and text-segmentation behavior used by Pandrator and replaces the server/native boundaries with browser runtimes.

## Architecture

```text
EPUB/PDF/TXT/HTML
       |
       +-- EPUB: fflate + DOMParser, following Pandrator's spine/block model
       +-- PDF: pdfjs-dist
       |
Pandrator deterministic cleanup port
  - block roles
  - TOC / footnote / boilerplate filtering
  - chapter marking
  - sentence/chunk segmentation
       |
KokoroTTS (kokoro-js)
  - WebGPU when available
  - WASM fallback
       |
MP3 (lamejs) / WAV
```

The original Pandrator five-phase source-cleaning pipeline is intentionally **not** included in this target because those phases are LLM-agent operations. A serverless build cannot reproduce them without shipping an LLM and its model. The static golden path therefore uses Pandrator's deterministic preprocessing path, which is safe, repeatable, and local.

Kokoro is run locally in the browser. `kokoro-js` supports WebGPU and WASM execution; WebGPU is preferred when available. urlKokoro.js documentationhttps://www.npmjs.com/package/kokoro-js

## Build

```bash
cd static
npm install
npm run build
```

The generated `static/dist/` directory is intentionally ignored by Git. Host that directory on any static web server.

## Local development

```bash
cd static
npm install
npm run dev
```

## Model assets

For a truly self-contained/offline deployment, mirror the Kokoro ONNX model and voice assets into `static/public/models/` and set `window.PANDRATOR_STATIC_MODEL` to that model directory before the app loads. Model binaries are deliberately ignored because they are large release artifacts.

For a normal static deployment, `kokoro-js` can resolve the public ONNX model directly. The browser still performs inference locally; no Pandrator server is involved.

## Tests

```bash
cd static
npm test
```

The unit suite exercises the port of Pandrator's deterministic cleanup, sentence chunking, format detection, and WAV output. The UI smoke test remains useful where a supported Playwright browser is available.
