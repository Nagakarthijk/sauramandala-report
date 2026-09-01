import type { TranscriptSegment, Translation } from '@/lib/types';

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map(csvEscape).join(',')).join('\n');
}

export interface RecordingRef {
  id: string;
  file_reference: string | null;
  language_code: string | null;
  dialect_tag: string | null;
}

// Speech corpus: every reviewed segment joined with its recording.
// Column order matches what AI4Bharat / Common Voice / OpenSLR-style
// pipelines expect for a raw speech+transcript manifest.
export function buildSpeechCorpusCsv(
  segments: TranscriptSegment[],
  recordingsById: Map<string, RecordingRef>
): string {
  const header = [
    'segment_id',
    'recording_reference',
    'start_ms',
    'end_ms',
    'language_code',
    'dialect',
    'text_source',
    'text_english',
  ];

  const rows = segments
    .filter((s) => s.reviewed)
    .map((s) => {
      const recording = recordingsById.get(s.recording_id);
      return [
        s.id,
        recording?.file_reference ?? '',
        String(s.start_time_ms ?? ''),
        String(s.end_time_ms ?? ''),
        recording?.language_code ?? '',
        recording?.dialect_tag ?? '',
        s.text_source ?? '',
        s.text_english ?? '',
      ];
    });

  return toCsv([header, ...rows]);
}

export interface ParallelTextLine {
  source_lang: string;
  target_lang: string;
  source: string;
  target: string;
  domain: string;
  project: string;
}

// Parallel text corpus, as JSONL: one line per aligned pair.
// Local→English pairs come from reviewed transcript segments;
// English→local pairs come from approved translations (page by page).
export function buildParallelTextJsonl(params: {
  projectName: string;
  segments: TranscriptSegment[];
  recordingsById: Map<string, RecordingRef>;
  translations: Translation[];
}): string {
  const { projectName, segments, recordingsById, translations } = params;
  const lines: ParallelTextLine[] = [];

  for (const s of segments) {
    if (!s.reviewed || !s.text_source || !s.text_english) continue;
    const recording = recordingsById.get(s.recording_id);
    lines.push({
      source_lang: recording?.language_code ?? 'unk',
      target_lang: 'en',
      source: s.text_source,
      target: s.text_english,
      domain: 'folklore',
      project: projectName,
    });
  }

  for (const t of translations) {
    if (t.status !== 'approved') continue;
    for (const page of t.page_data) {
      if (!page.text) continue;
      lines.push({
        source_lang: 'en',
        target_lang: t.target_language_code ?? t.target_language,
        source: page.text,
        target: page.text,
        domain: 'folklore',
        project: projectName,
      });
    }
  }

  return lines.map((l) => JSON.stringify(l)).join('\n');
}

// Full project export — everything as one JSON document, for backup,
// handoff, or spinning up a new instance from historical data.
export function buildFullProjectExport(data: Record<string, unknown>): string {
  return JSON.stringify(
    { exported_at: new Date().toISOString(), ...data },
    null,
    2
  );
}

export function downloadTextFile(filename: string, contents: string, mime = 'text/plain') {
  const blob = new Blob([contents], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
