// Optional StoryWeaver integration. No API call is ever made to SW from
// this platform — this just formats the SLS CSV exactly the way SW's
// Content Manager expects it, for the user to download and upload
// themselves. If SW ever opens a proper publish API, this is the one
// file that would grow a network call.

import type { SlsCue } from '@/lib/types';

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildSlsCsv(cues: SlsCue[]): string {
  const header = ['page', 'word', 'cue', 'content', 'start_time_ms'];
  const rows = cues.map((c) => [c.page, c.word, c.cue, c.content, c.start_time_ms]);
  return [header, ...rows]
    .map((row) => row.map(csvEscape).join(','))
    .join('\n');
}
