import JSZip from 'jszip';

export interface ExportChapterTrack {
  title: string;
  buffer: AudioBuffer;
  duration: number;
  segments?: { text: string; startTime: number; endTime: number }[];
}

export interface AudiobookPackageOptions {
  bookTitle: string;
  author: string;
  tracks: ExportChapterTrack[];
}

export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const length = buffer.length * numChannels * 2;
  const result = new Uint8Array(44 + length);
  const view = new DataView(result.buffer);

  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* RIFF chunk length */
  view.setUint32(4, 36 + length, true);
  /* RIFF type */
  writeString(view, 8, 'WAVE');
  /* format chunk identifier */
  writeString(view, 12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, format, true);
  /* channel count */
  view.setUint16(22, numChannels, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, (sampleRate * numChannels * bitDepth) / 8, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, (numChannels * bitDepth) / 8, true);
  /* bits per sample */
  view.setUint16(34, bitDepth, true);
  /* data chunk identifier */
  writeString(view, 36, 'data');
  /* data chunk length */
  view.setUint32(40, length, true);

  // Write PCM audio samples
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([result], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

export function mergeAudioBuffers(buffers: AudioBuffer[], ctx: AudioContext): AudioBuffer {
  if (buffers.length === 0) {
    return ctx.createBuffer(1, 1, ctx.sampleRate);
  }

  const sampleRate = buffers[0].sampleRate;
  const numChannels = buffers[0].numberOfChannels;
  const totalLength = buffers.reduce((sum, b) => sum + b.length, 0);

  const merged = ctx.createBuffer(numChannels, totalLength, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = merged.getChannelData(channel);
    let offset = 0;
    for (const b of buffers) {
      channelData.set(b.getChannelData(Math.min(channel, b.numberOfChannels - 1)), offset);
      offset += b.length;
    }
  }

  return merged;
}

export function generateCueSheet(
  bookTitle: string,
  author: string,
  chapters: { title: string; duration: number }[]
): string {
  let cue = `TITLE "${bookTitle.replace(/"/g, '\\"')}"\n`;
  cue += `PERFORMER "${author.replace(/"/g, '\\"')}"\n`;
  cue += `FILE "${bookTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}_master.wav" WAVE\n`;

  let currentTimeSec = 0;

  chapters.forEach((ch, idx) => {
    const trackNum = (idx + 1).toString().padStart(2, '0');
    const minutes = Math.floor(currentTimeSec / 60)
      .toString()
      .padStart(2, '0');
    const seconds = Math.floor(currentTimeSec % 60)
      .toString()
      .padStart(2, '0');
    const frames = Math.floor((currentTimeSec % 1) * 75)
      .toString()
      .padStart(2, '0');

    cue += `  TRACK ${trackNum} AUDIO\n`;
    cue += `    TITLE "${ch.title.replace(/"/g, '\\"')}"\n`;
    cue += `    INDEX 01 ${minutes}:${seconds}:${frames}\n`;

    currentTimeSec += ch.duration;
  });

  return cue;
}

export function generateM3uPlaylist(tracks: { filename: string; title: string; duration: number }[]): string {
  let m3u = '#EXTM3U\n';
  for (const track of tracks) {
    m3u += `#EXTINF:${Math.round(track.duration)},${track.title}\n`;
    m3u += `${track.filename}\n`;
  }
  return m3u;
}

export function generateChapterMetadataJson(
  bookTitle: string,
  author: string,
  chapters: { title: string; startTime: number; duration: number }[]
): string {
  return JSON.stringify(
    {
      title: bookTitle,
      author,
      format: 'Pandrator Static Audiobook v1',
      totalDurationSeconds: chapters.reduce((sum, c) => sum + c.duration, 0),
      chapters: chapters.map((c, i) => ({
        id: i + 1,
        title: c.title,
        startTime: c.startTime,
        duration: c.duration,
        endTime: c.startTime + c.duration
      }))
    },
    null,
    2
  );
}

export function generateWebVttSubtitles(
  segments: { text: string; startTime: number; endTime: number }[]
): string {
  let vtt = 'WEBVTT\n\n';

  segments.forEach((seg, i) => {
    const start = formatVttTime(seg.startTime);
    const end = formatVttTime(seg.endTime);
    vtt += `${i + 1}\n${start} --> ${end}\n${seg.text}\n\n`;
  });

  return vtt;
}

function formatVttTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const mins = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const secs = (seconds % 60).toFixed(3).padStart(6, '0');
  return `${hrs}:${mins}:${secs}`;
}

export async function packageAudiobookZip(options: AudiobookPackageOptions): Promise<Blob> {
  const zip = new JSZip();
  const folderName = options.bookTitle.replace(/[^a-zA-Z0-9_-]/g, '_') || 'Audiobook';
  const folder = zip.folder(folderName)!;

  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
    sampleRate: 24000
  });

  const m3uTracks: { filename: string; title: string; duration: number }[] = [];
  const jsonChapters: { title: string; startTime: number; duration: number }[] = [];
  const masterBuffers: AudioBuffer[] = [];

  let totalDuration = 0;

  for (let i = 0; i < options.tracks.length; i++) {
    const track = options.tracks[i];
    const trackFilename = `${(i + 1).toString().padStart(2, '0')}_${track.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.wav`;

    const wavBlob = audioBufferToWavBlob(track.buffer);
    folder.file(trackFilename, wavBlob);

    m3uTracks.push({
      filename: trackFilename,
      title: track.title,
      duration: track.duration
    });

    jsonChapters.push({
      title: track.title,
      startTime: totalDuration,
      duration: track.duration
    });

    masterBuffers.push(track.buffer);
    totalDuration += track.duration;
  }

  // Create Continuous Master WAV audio file
  const mergedMasterBuffer = mergeAudioBuffers(masterBuffers, audioContext);
  folder.file(`${folderName}_master.wav`, audioBufferToWavBlob(mergedMasterBuffer));

  // Add Cue Sheet
  const cueContent = generateCueSheet(options.bookTitle, options.author, options.tracks);
  folder.file(`${folderName}.cue`, cueContent);

  // Add M3U Playlist
  const m3uContent = generateM3uPlaylist(m3uTracks);
  folder.file(`${folderName}.m3u`, m3uContent);

  // Add JSON Metadata
  const jsonContent = generateChapterMetadataJson(options.bookTitle, options.author, jsonChapters);
  folder.file('chapters.json', jsonContent);

  return await zip.generateAsync({ type: 'blob' });
}
