<script lang="ts">
  import { onMount } from 'svelte';
  import {
    AudioLines,
    BookOpen,
    CheckCircle2,
    Download,
    FileAudio,
    FileText,
    Loader2,
    Play,
    Sparkles,
    Upload
  } from '@lucide/svelte';

  import type { StaticChapter } from '$lib/static/text-cleaner';
  import { autoDetectChapters } from '$lib/static/text-cleaner';
  import { parsePdfFile } from '$lib/static/pdf-parser';
  import { parseEpubFile } from '$lib/static/epub-parser';
  import {
    KOKORO_VOICES,
    KokoroStaticEngine,
    type SynthesisProgress,
    type GeneratedSpeechSegment
  } from '$lib/static/kokoro-engine';
  import {
    audioBufferToWavBlob,
    packageAudiobookZip,
    type ExportChapterTrack
  } from '$lib/static/audiobook-exporter';

  let bookTitle = $state('My Audiobook');
  let authorName = $state('Unknown Author');
  let selectedVoice = $state('af_heart');
  let speechSpeed = $state(1.0);

  let isParsing = $state(false);
  let parseError = $state('');
  let chapters = $state<StaticChapter[]>([]);
  let activeChapterIndex = $state(0);

  let isSynthesizing = $state(false);
  let synthesisProgress = $state<SynthesisProgress>({
    currentSegment: 0,
    totalSegments: 0,
    segmentText: '',
    status: 'initializing'
  });

  let chapterTracks = $state<ExportChapterTrack[]>([]);
  let isExporting = $state(false);
  let downloadUrl = $state('');

  let engine: KokoroStaticEngine;

  onMount(() => {
    engine = new KokoroStaticEngine(selectedVoice, speechSpeed);
  });

  $effect(() => {
    if (engine) {
      engine.setVoice(selectedVoice);
      engine.setSpeed(speechSpeed);
    }
  });

  async function handleFileUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    await processFile(input.files[0]);
  }

  async function processFile(file: File) {
    isParsing = true;
    parseError = '';
    chapters = [];
    chapterTracks = [];
    downloadUrl = '';

    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      bookTitle = file.name.replace(/\.[^/.]+$/, '');

      if (ext === 'pdf') {
        const res = await parsePdfFile(file);
        bookTitle = res.title || bookTitle;
        chapters = res.chapters;
      } else if (ext === 'epub') {
        const res = await parseEpubFile(file);
        bookTitle = res.title || bookTitle;
        authorName = res.author || authorName;
        chapters = res.chapters;
      } else {
        // Plain text, markdown, or HTML file
        const text = await file.text();
        chapters = autoDetectChapters(text);
      }
    } catch (err: any) {
      parseError = err.message || 'Failed to parse document';
    } finally {
      isParsing = false;
    }
  }

  function loadSampleEbook() {
    isParsing = true;
    parseError = '';
    bookTitle = 'The Great Golden Path';
    authorName = 'Pandrator Studio';

    const sampleText = `
# Chapter 1: The Beginning
Welcome to Pandrator Static Studio. This entire application runs locally inside your browser using WebGPU and WebAssembly.

# Chapter 2: Local Synthesis
Kokoro TTS converts your eBooks and PDFs into natural sounding speech audiobooks. No server or cloud required.

# Chapter 3: Universal Export
Export standard chaptered audiobooks complete with WAV audio tracks, CUE metadata sheets, and M3U playlist files instantly.
    `.trim();

    chapters = autoDetectChapters(sampleText);
    isParsing = false;
  }

  async function startSynthesis() {
    if (chapters.length === 0) return;

    isSynthesizing = true;
    chapterTracks = [];
    downloadUrl = '';

    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000
      });

      for (let c = 0; c < chapters.length; c++) {
        activeChapterIndex = c;
        const chapter = chapters[c];

        const segments = await engine.synthesizeSegments(
          chapter.segments,
          (prog) => {
            synthesisProgress = prog;
          },
          audioCtx
        );

        // Merge segment audio buffers for chapter
        const totalSamples = segments.reduce((acc, s) => acc + s.audioBuffer.length, 0);
        const chapterBuffer = audioCtx.createBuffer(1, totalSamples, 24000);
        const channel = chapterBuffer.getChannelData(0);

        let offset = 0;
        for (const seg of segments) {
          channel.set(seg.audioBuffer.getChannelData(0), offset);
          offset += seg.audioBuffer.length;
        }

        chapterTracks.push({
          title: chapter.title,
          buffer: chapterBuffer,
          duration: chapterBuffer.duration
        });
      }

      // Generate package zip
      isExporting = true;
      const zipBlob = await packageAudiobookZip({
        bookTitle,
        author: authorName,
        tracks: chapterTracks
      });
      downloadUrl = URL.createObjectURL(zipBlob);
    } catch (err: any) {
      parseError = err.message || 'Speech synthesis failed';
    } finally {
      isSynthesizing = false;
      isExporting = false;
    }
  }

  function downloadSingleTrack(track: ExportChapterTrack) {
    const wavBlob = audioBufferToWavBlob(track.buffer);
    const url = URL.createObjectURL(wavBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${track.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.wav`;
    a.click();
  }
</script>

<svelte:head>
  <title>Static Studio — Pandrator Client-Side Audiobook Generator</title>
</svelte:head>

<div class="mx-auto max-w-5xl space-y-8">
  <div class="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] pb-6">
    <div>
      <div class="eyebrow flex items-center gap-2">
        <Sparkles size={14} class="text-[var(--accent)]" /> Pure Client-Side Studio
      </div>
      <h1 class="mt-1 text-3xl font-bold tracking-tight">Static eBook to Audiobook</h1>
      <p class="muted mt-1 text-sm">
        Convert EPUB, PDF, and text documents directly in your browser using WebGPU/WASM Kokoro TTS. Zero backend required.
      </p>
    </div>
    <button onclick={loadSampleEbook} class="btn btn-secondary flex items-center gap-2">
      <BookOpen size={16} /> Try Sample eBook
    </button>
  </div>

  <!-- Step 1: Upload Document -->
  <section class="surface rounded-2xl border border-[var(--line)] p-6">
    <h2 class="text-lg font-semibold flex items-center gap-2 mb-4">
      <Upload size={18} class="text-[var(--accent)]" /> 1. Upload eBook or PDF
    </h2>

    <div class="grid gap-4 md:grid-cols-2">
      <label class="block text-xs font-semibold muted uppercase tracking-wider">
        Book Title
        <input bind:value={bookTitle} type="text" class="w-full mt-1 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm font-normal text-[var(--ink)]" />
      </label>
      <label class="block text-xs font-semibold muted uppercase tracking-wider">
        Author
        <input bind:value={authorName} type="text" class="w-full mt-1 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm font-normal text-[var(--ink)]" />
      </label>
    </div>

    <div class="mt-4">
      <label class="flex flex-col items-center justify-center min-h-[120px] cursor-pointer rounded-xl border-2 border-dashed border-[var(--line)] bg-[var(--paper-soft)] p-6 text-center hover:border-[var(--accent)] transition-colors">
        {#if isParsing}
          <Loader2 class="animate-spin text-[var(--accent)] mb-2" size={28} />
          <span class="text-sm font-semibold">Parsing eBook content...</span>
        {:else}
          <FileText class="text-[var(--muted)] mb-2" size={28} />
          <span class="text-sm font-semibold">Drop your PDF, EPUB, TXT, or MD file here</span>
          <span class="muted text-xs mt-1">Supports client-side page/chapter parsing</span>
          <input type="file" accept=".pdf,.epub,.txt,.md,.html" onchange={handleFileUpload} class="hidden" />
        {/if}
      </label>
    </div>

    {#if parseError}
      <div class="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-500">
        {parseError}
      </div>
    {/if}
  </section>

  <!-- Step 2: Configure & Review Chapters -->
  {#if chapters.length > 0}
    <section class="surface rounded-2xl border border-[var(--line)] p-6 space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <h2 class="text-lg font-semibold flex items-center gap-2">
          <AudioLines size={18} class="text-[var(--accent)]" /> 2. Speech Settings & Chapter Review
        </h2>
        <span class="badge badge-neutral">{chapters.length} Chapters · {chapters.reduce((a, c) => a + c.wordCount, 0)} Words</span>
      </div>

      <div class="grid gap-4 md:grid-cols-2">
        <label class="block text-xs font-semibold muted uppercase tracking-wider">
          Kokoro TTS Voice
          <select bind:value={selectedVoice} class="w-full mt-1 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm font-normal text-[var(--ink)]">
            {#each KOKORO_VOICES as v}
              <option value={v.id}>{v.name} ({v.language})</option>
            {/each}
          </select>
        </label>
        <label class="block text-xs font-semibold muted uppercase tracking-wider">
          Speech Speed ({speechSpeed}x)
          <input type="range" min="0.5" max="2.0" step="0.1" bind:value={speechSpeed} class="w-full mt-2" />
        </label>
      </div>

      <div class="border border-[var(--line)] rounded-xl overflow-hidden divide-y divide-[var(--line)]">
        {#each chapters as ch, idx}
          <div class="p-4 flex items-center justify-between bg-[var(--paper)] hover:bg-[var(--paper-soft)] transition-colors">
            <div class="min-w-0 flex-1 pr-4">
              <div class="font-semibold text-sm truncate">{ch.title}</div>
              <div class="muted text-xs mt-0.5">{ch.wordCount} words · {ch.segments.length} speech segments</div>
            </div>
            {#if chapterTracks[idx]}
              <span class="inline-flex items-center gap-1 text-xs font-semibold text-emerald-500">
                <CheckCircle2 size={14} /> Ready ({Math.round(chapterTracks[idx].duration)}s)
              </span>
            {/if}
          </div>
        {/each}
      </div>

      <div class="pt-2">
        <button
          onclick={startSynthesis}
          disabled={isSynthesizing}
          class="btn btn-primary w-full py-3 font-semibold flex items-center justify-center gap-2 text-base"
        >
          {#if isSynthesizing}
            <Loader2 class="animate-spin" size={20} /> Synthesizing with Kokoro ({synthesisProgress.currentSegment}/{synthesisProgress.totalSegments})...
          {:else}
            <Play size={20} /> Generate Complete Audiobook
          {/if}
        </button>
      </div>
    </section>
  {/if}

  <!-- Step 3: Export & Download -->
  {#if chapterTracks.length > 0}
    <section class="surface rounded-2xl border border-[var(--line)] p-6 space-y-4">
      <h2 class="text-lg font-semibold flex items-center gap-2">
        <FileAudio size={18} class="text-[var(--accent)]" /> 3. Export & Download Audiobook
      </h2>

      {#if downloadUrl}
        <div class="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div class="font-bold text-emerald-600 dark:text-emerald-400">Audiobook Package Ready</div>
            <p class="text-xs muted mt-1">Includes Chapter WAVs, Master WAV, CUE Sheet, M3U Playlist, and JSON Metadata.</p>
          </div>
          <a href={downloadUrl} download={`${bookTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}_Audiobook.zip`} class="btn btn-primary flex items-center gap-2">
            <Download size={18} /> Download Package (.zip)
          </a>
        </div>
      {/if}

      <div class="space-y-2">
        <div class="text-xs font-semibold muted uppercase tracking-wider">Individual Chapter Tracks</div>
        {#each chapterTracks as track, idx}
          <div class="flex items-center justify-between p-3 rounded-xl border border-[var(--line)] bg-[var(--paper)] text-sm">
            <span>{track.title} ({Math.round(track.duration)}s)</span>
            <button onclick={() => downloadSingleTrack(track)} class="btn btn-secondary btn-sm flex items-center gap-1.5 text-xs">
              <Download size={14} /> WAV
            </button>
          </div>
        {/each}
      </div>
    </section>
  {/if}
</div>
