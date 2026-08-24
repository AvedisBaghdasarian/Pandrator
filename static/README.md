# Pandrator Static

`static/` is a deliberately small, serverless audiobook conversion target.

Golden path:

1. Open `index.html` from any static host.
2. Select an EPUB, PDF, TXT, HTML, or Markdown file.
3. Extract text in the browser and split it into readable chunks.
4. Load the Kokoro ONNX/WebGPU runtime and voice model from the configured static asset base.
5. Synthesize chunks locally and export WAV. Where the browser supports WebCodecs, the encoder can add compressed audio without FFmpeg.

The page does not require the Pandrator Python server, a database, FFmpeg, or a worker queue. Source documents and generated audio remain in browser memory unless the user explicitly saves the result.

## Runtime assets

The application code is self-contained. Kokoro/ONNX model and voice assets are intentionally not committed; place them under `static/public/models/` during a release build or configure `window.PANDRATOR_STATIC_MODEL_BASE` before loading the app. This keeps multi-hundred-megabyte model artifacts out of Git.

The adapter is intentionally isolated in `app.js`: it accepts either a `window.KokoroWeb` implementation supplied by the chosen WebGPU runtime or a compatible runtime module loaded by the host. This gives the static target one integration seam while the repository can pin the exact Kokoro-WebGPU package later.

## Tests

`node --test static/tests/*.test.mjs` exercises format detection, chunking, and WAV generation. Browser UI smoke tests are in `static/tests/static-ui.spec.mjs` and run with Playwright when the dependency is installed.
