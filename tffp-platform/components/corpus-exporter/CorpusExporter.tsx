'use client';

import { useState } from 'react';
import type { RecordingRef } from '@/lib/corpus';
import { buildSpeechCorpusCsv, buildParallelTextJsonl, buildFullProjectExport, downloadTextFile } from '@/lib/corpus';
import type { TranscriptSegment, Translation } from '@/lib/types';
import { pushToHuggingFace } from '@/app/workspace/corpus/actions';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export function CorpusExporter({
  projectName,
  projectSlug,
  segments,
  recordingsById,
  translations,
  fullExport,
  hfEnabled,
}: {
  projectName: string;
  projectSlug: string;
  segments: TranscriptSegment[];
  recordingsById: Map<string, RecordingRef>;
  translations: Translation[];
  fullExport: Record<string, unknown>;
  hfEnabled: boolean;
}) {
  const [pushing, setPushing] = useState<string | null>(null);
  const [pushResult, setPushResult] = useState<string | null>(null);

  const speechCsv = buildSpeechCorpusCsv(segments, recordingsById);
  const parallelJsonl = buildParallelTextJsonl({ projectName, segments, recordingsById, translations });
  const fullJson = buildFullProjectExport(fullExport);

  async function push(name: string, content: string) {
    setPushing(name);
    setPushResult(null);
    try {
      await pushToHuggingFace(name, content);
      setPushResult(`Pushed ${name} to HuggingFace.`);
    } catch (e) {
      setPushResult(e instanceof Error ? e.message : 'Push failed');
    } finally {
      setPushing(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Speech corpus"
          subtitle={`${segments.length} reviewed segments — segment_id, recording_reference, start_ms, end_ms, language_code, dialect, text_source, text_english`}
        />
        <CardBody className="flex flex-wrap gap-2">
          <Button onClick={() => downloadTextFile(`${projectSlug}-speech-corpus.csv`, speechCsv, 'text/csv')}>
            Download CSV
          </Button>
          {hfEnabled && (
            <Button variant="secondary" disabled={pushing === 'speech'} onClick={() => push('speech_corpus.csv', speechCsv)}>
              {pushing === 'speech' ? 'Pushing…' : 'Push to HuggingFace'}
            </Button>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Parallel text corpus"
          subtitle="Reviewed local↔English pairs, plus approved English↔local translations, as JSONL"
        />
        <CardBody className="flex flex-wrap gap-2">
          <Button onClick={() => downloadTextFile(`${projectSlug}-parallel-corpus.jsonl`, parallelJsonl, 'application/jsonl')}>
            Download JSONL
          </Button>
          {hfEnabled && (
            <Button variant="secondary" disabled={pushing === 'parallel'} onClick={() => push('parallel_text_corpus.jsonl', parallelJsonl)}>
              {pushing === 'parallel' ? 'Pushing…' : 'Push to HuggingFace'}
            </Button>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Full project export" subtitle="Everything, as JSON — for backup, handoff, or a new instance" />
        <CardBody>
          <Button onClick={() => downloadTextFile(`${projectSlug}-full-export.json`, fullJson, 'application/json')}>
            Download JSON
          </Button>
        </CardBody>
      </Card>

      {pushResult && <p className="text-sm text-ink/60">{pushResult}</p>}
    </div>
  );
}
