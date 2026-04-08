import { DeepgramClient } from '@deepgram/sdk'
import { EventEmitter } from 'events'
import { DEEPGRAM_CONFIG } from '@shared/constants'
import { TranscriptEntry } from '@shared/types'

export class STTService extends EventEmitter {
  private connection: any = null
  private isConnected = false
  private apiKey: string
  private speaker: 'interviewer' | 'user'
  private language: string

  constructor(apiKey: string, speaker: 'interviewer' | 'user', language: string = 'en') {
    super()
    this.apiKey = apiKey
    this.speaker = speaker
    this.language = language
  }

  async connect(): Promise<void> {
    if (this.isConnected) return

    const client = new DeepgramClient({ apiKey: this.apiKey })

    // v5 SDK: listen.v1.connect() returns a Promise<Socket>
    this.connection = await client.listen.v1.connect({
      model: DEEPGRAM_CONFIG.model,
      language: this.language,
      smart_format: DEEPGRAM_CONFIG.smart_format,
      punctuate: DEEPGRAM_CONFIG.punctuate,
      interim_results: DEEPGRAM_CONFIG.interim_results,
      utterance_end_ms: DEEPGRAM_CONFIG.utterance_end_ms,
      vad_events: DEEPGRAM_CONFIG.vad_events,
      encoding: DEEPGRAM_CONFIG.encoding,
      sample_rate: DEEPGRAM_CONFIG.sample_rate,
      channels: DEEPGRAM_CONFIG.channels,
    })

    this.connection.on('open', () => {
      this.isConnected = true
      console.log('[STT] Deepgram connection opened')
      this.emit('connected')
    })

    // v5 SDK: 'message' event fires with parsed JSON data
    this.connection.on('message', (data: any) => {
      // Handle transcript results
      if (data.type === 'Results') {
        const transcript = data.channel?.alternatives?.[0]?.transcript
        if (!transcript || transcript.trim() === '') return

        const entry: TranscriptEntry = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          text: transcript,
          speaker: this.speaker,
          timestamp: Date.now(),
          isFinal: data.is_final ?? false,
        }

        this.emit('transcript', entry)
      }

      // Handle utterance end
      if (data.type === 'UtteranceEnd') {
        this.emit('utterance-end')
      }
    })

    this.connection.on('error', (error: any) => {
      console.error('[STT] Deepgram error:', error)
      this.emit('error', error)
    })

    this.connection.on('close', () => {
      this.isConnected = false
      console.log('[STT] Deepgram connection closed')
      this.emit('disconnected')
    })

    // The v5 socket object is returned disconnected and must be opened explicitly.
    this.connection.connect()
  }

  sendAudio(audioChunk: Buffer): void {
    if (this.isConnected && this.connection) {
      this.connection.sendMedia(audioChunk)
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      this.connection.close()
      this.connection = null
    }
    this.isConnected = false
  }

  getIsConnected(): boolean {
    return this.isConnected
  }
}
