// Optional HuggingFace push. Only called from the corpus export screen,
// and only when a project has hf_enabled + an hf_dataset_id configured
// in settings. Uploads the same files the "download" buttons produce —
// nothing is generated specially for HF.

export async function pushFileToHfDataset(params: {
  token: string;
  datasetId: string; // e.g. "org-name/tffp-meghalaya-corpus"
  pathInRepo: string; // e.g. "speech_corpus.csv"
  content: string;
  commitMessage: string;
}): Promise<void> {
  const { token, datasetId, pathInRepo, content, commitMessage } = params;

  const res = await fetch(
    `https://huggingface.co/api/datasets/${datasetId}/upload/main/${encodeURIComponent(pathInRepo)}`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        content: Buffer.from(content, 'utf-8').toString('base64'),
        encoding: 'base64',
        commit_message: commitMessage,
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`HuggingFace upload failed (${res.status}): ${await res.text()}`);
  }
}
