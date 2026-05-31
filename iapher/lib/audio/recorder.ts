export class VoiceRecorder {
  private mediaRecorder: MediaRecorder | null = null
  private chunks: Blob[] = []
  private stream: MediaStream | null = null
  private startTime: number = 0

  get mimeType(): string {
    if (typeof MediaRecorder === 'undefined') return 'audio/webm'
    return MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/mp4'
  }

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
      },
    })
    this.mediaRecorder = new MediaRecorder(this.stream, {
      mimeType: this.mimeType,
      audioBitsPerSecond: 64000,
    })
    this.chunks = []
    this.startTime = Date.now()
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data)
    }
    this.mediaRecorder.start(1000)
  }

  stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('Not recording'))
        return
      }
      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: this.mediaRecorder!.mimeType })
        this.stream?.getTracks().forEach((t) => t.stop())
        resolve(blob)
      }
      this.mediaRecorder.stop()
    })
  }

  getDurationSeconds(): number {
    return this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0
  }

  get isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording'
  }
}
