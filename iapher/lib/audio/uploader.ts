export async function uploadVoice(
  blob: Blob,
  sessionId: string,
  questionId: string,
  sessionToken: string
): Promise<{ key: string; duration: number }> {
  const ext = blob.type.includes('mp4') ? 'mp4' : 'webm'
  const key = `voices/${sessionId}/${questionId}.${ext}`

  const formData = new FormData()
  formData.append('file', blob, `${questionId}.${ext}`)
  formData.append('key', key)

  const res = await fetch('/api/voice/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${sessionToken}` },
    body: formData,
  })

  if (!res.ok) throw new Error('Upload failed')
  return res.json()
}
