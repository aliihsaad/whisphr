import { useCallback, useEffect, useRef } from 'react'

/**
 * Hidden component that captures system audio in the renderer process
 * and sends PCM chunks to the main process via IPC for Deepgram transcription.
 *
 * Uses getDisplayMedia() which is intercepted by the main process's
 * setDisplayMediaRequestHandler to provide system audio loopback.
 */
interface AudioCaptureProps {
  micEnabled: boolean
}

interface CaptureNodes {
  stream: MediaStream | null
  processor: ScriptProcessorNode | null
  context: AudioContext | null
}

export default function AudioCapture({ micEnabled }: AudioCaptureProps) {
  const systemRefs = useRef<CaptureNodes>({ stream: null, processor: null, context: null })
  const micRefs = useRef<CaptureNodes>({ stream: null, processor: null, context: null })

  const cleanupNodes = useCallback((target: { current: CaptureNodes }) => {
    target.current.processor?.disconnect()
    target.current.context?.close().catch(() => undefined)
    target.current.stream?.getTracks().forEach((track) => track.stop())
    target.current = { stream: null, processor: null, context: null }
  }, [])

  const setupAudioProcessing = useCallback(
    (stream: MediaStream, sourceType: 'interviewer' | 'user', target: { current: CaptureNodes }) => {
      cleanupNodes(target)
      target.current.stream = stream

      const audioContext = new AudioContext({ sampleRate: 16000 })
      target.current.context = audioContext

      const source = audioContext.createMediaStreamSource(stream)
      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      target.current.processor = processor

      processor.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0)
        const pcm16 = new Int16Array(inputData.length)

        for (let i = 0; i < inputData.length; i++) {
          const sample = Math.max(-1, Math.min(1, inputData[i]))
          pcm16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff
        }

        window.api.sendAudioChunk(sourceType, pcm16.buffer)
      }

      source.connect(processor)
      processor.connect(audioContext.destination)
    },
    [cleanupNodes]
  )

  useEffect(() => {
    let cancelled = false

    async function startCapture() {
      try {
        // Use getDisplayMedia — the main process handler auto-grants
        // system audio loopback via desktopCapturer
        const stream = await navigator.mediaDevices.getDisplayMedia({
          audio: true,
          video: {
            width: 1,
            height: 1,
            frameRate: 1,
          },
        } as any)

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }

        // Stop the video track — we only need audio
        stream.getVideoTracks().forEach((t) => t.stop())

        const audioTracks = stream.getAudioTracks()
        if (audioTracks.length === 0) {
          console.warn('[AudioCapture] No system audio track from getDisplayMedia')
          return
        }

        console.log('[AudioCapture] System audio capture started via getDisplayMedia')
        setupAudioProcessing(stream, 'interviewer', systemRefs)
      } catch (err) {
        console.error('[AudioCapture] getDisplayMedia failed:', err)
      }
    }

    startCapture()

    return () => {
      cancelled = true
      cleanupNodes(systemRefs)
      cleanupNodes(micRefs)
      console.log('[AudioCapture] Cleanup done')
    }
  }, [cleanupNodes, setupAudioProcessing])

  useEffect(() => {
    let cancelled = false

    async function startMicCapture() {
      try {
        const micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: 16000,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
          },
        })

        if (cancelled) {
          micStream.getTracks().forEach((track) => track.stop())
          return
        }

        console.log('[AudioCapture] Microphone capture started')
        setupAudioProcessing(micStream, 'user', micRefs)
      } catch (micErr) {
        console.error('[AudioCapture] Microphone capture failed:', micErr)
      }
    }

    if (micEnabled) {
      void startMicCapture()
    } else {
      cleanupNodes(micRefs)
    }

    return () => {
      cancelled = true
      cleanupNodes(micRefs)
    }
  }, [cleanupNodes, micEnabled, setupAudioProcessing])

  return null
}
