import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Sparkles, AlertTriangle } from 'lucide-react'
import Transcript from './components/Transcript'
import AISuggestion from './components/AISuggestion'
import FilePreview from './components/FilePreview'
import Controls from './components/Controls'
import AudioCapture from './components/AudioCapture'
import SessionSetup from './components/SessionSetup'

interface TranscriptEntry {
  id: string
  text: string
  speaker: 'interviewer' | 'user' | 'unknown'
  timestamp: number
  isFinal: boolean
}

interface AnswerHistoryEntry {
  question: string
  answer: string
  timestamp: number
  modelId?: string
  routingReason?: string
}

export default function App() {
  const viewParam = new URLSearchParams(window.location.search).get('view')
  const isAnswerView = viewParam === 'answer'
  const isPreviewView = viewParam === 'preview'
  const [isSessionActive, setIsSessionActive] = useState(false)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [interimTranscript, setInterimTranscript] = useState<{ interviewer: string; user: string }>({
    interviewer: '',
    user: '',
  })
  const [currentAnswer, setCurrentAnswer] = useState('')
  const [answerHistory, setAnswerHistory] = useState<AnswerHistoryEntry[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [isAnswering, setIsAnswering] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [showAnswerPane, setShowAnswerPane] = useState(true)
  const [showTranscript, setShowTranscript] = useState(true)
  const [autoAnswerEnabled, setAutoAnswerEnabled] = useState(true)
  const [micEnabled, setMicEnabled] = useState(true)
  const [sessionTime, setSessionTime] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const controlBarRef = useRef<HTMLDivElement | null>(null)
  const pendingAnswerQuestionRef = useRef('')
  const latestQuestionRef = useRef('')
  const currentModelSelectionRef = useRef<{ modelId: string; reason: string }>({ modelId: '', reason: '' })
  const [controlBarWidth, setControlBarWidth] = useState<number | null>(null)
  const [controlsHeight, setControlsHeight] = useState(320)
  const [showSessionSetup, setShowSessionSetup] = useState(false)
  const [confirmEndSession, setConfirmEndSession] = useState(false)
  const [currentModelSelection, setCurrentModelSelection] = useState<{ modelId: string; reason: string }>({
    modelId: '',
    reason: '',
  })

  // Listen for transcript updates from main process
  useEffect(() => {
    const cleanup = window.api.onTranscriptUpdate((entry: TranscriptEntry) => {
      const speaker = entry.speaker === 'user' ? 'user' : 'interviewer'

      if (entry.isFinal) {
        setTranscript((prev) => [...prev, entry])
        setInterimTranscript((prev) => ({
          ...prev,
          [speaker]: '',
        }))
      } else {
        setInterimTranscript((prev) => ({
          ...prev,
          [speaker]: entry.text,
        }))
      }
    })
    return cleanup
  }, [])

  // Listen for LLM answer chunks
  useEffect(() => {
    const cleanupChunk = window.api.onAnswerChunk((answer: string) => {
      if (answer === '') {
        pendingAnswerQuestionRef.current = pendingAnswerQuestionRef.current || latestQuestionRef.current || 'Interview Question'
      }
      setShowAnswerPane(true)
      setCurrentAnswer(answer)
      setIsAnswering(true)
    })
    const cleanupDone = window.api.onAnswerDone((answer: string) => {
      if (answer.trim()) {
        setShowAnswerPane(true)
      }
      setCurrentAnswer(answer)
      setIsAnswering(false)

      const question = pendingAnswerQuestionRef.current || latestQuestionRef.current || 'Interview Question'
      if (answer.trim()) {
        setAnswerHistory((prev) => {
          const nextEntry = {
            question,
            answer,
            timestamp: Date.now(),
            modelId: currentModelSelectionRef.current.modelId,
            routingReason: currentModelSelectionRef.current.reason,
          }

          const isDuplicate =
            prev.length > 0 &&
            prev[prev.length - 1].question === nextEntry.question &&
            prev[prev.length - 1].answer === nextEntry.answer &&
            prev[prev.length - 1].modelId === nextEntry.modelId &&
            prev[prev.length - 1].routingReason === nextEntry.routingReason

          if (isDuplicate) {
            setHistoryIndex(prev.length - 1)
            return prev
          }

          const nextHistory = [...prev, nextEntry]
          setHistoryIndex(nextHistory.length - 1)
          return nextHistory
        })
      }
      pendingAnswerQuestionRef.current = ''
    })
    return () => {
      cleanupChunk()
      cleanupDone()
    }
  }, [])

  useEffect(() => {
    const cleanup = window.api.onAnswerQuestion((question: string) => {
      pendingAnswerQuestionRef.current = question.trim() || 'Interview Question'
    })
    return cleanup
  }, [])

  useEffect(() => {
    const cleanup = window.api.onAnswerModelSelection((selection) => {
      setCurrentModelSelection(selection)
      currentModelSelectionRef.current = selection
    })
    return cleanup
  }, [])

  // Listen for session state
  useEffect(() => {
    void window.api.getConfig().then((config) => {
      setAutoAnswerEnabled(config?.autoAnswerEnabled ?? true)
      setMicEnabled(config?.micEnabled ?? true)
      setCurrentModelSelection({
        modelId: config?.defaultModel || '',
        reason: 'Default model',
      })
      currentModelSelectionRef.current = {
        modelId: config?.defaultModel || '',
        reason: 'Default model',
      }
    })
  }, [])

  useEffect(() => {
    const cleanup = window.api.onSessionState((state: any) => {
      setIsSessionActive(state.isActive)
      if (typeof state.autoAnswerEnabled === 'boolean') {
        setAutoAnswerEnabled(state.autoAnswerEnabled)
      }
      if (typeof state.micEnabled === 'boolean') {
        setMicEnabled(state.micEnabled)
      }
      if (typeof state.answerWindowVisible === 'boolean') {
        setShowAnswerPane(state.answerWindowVisible)
      }
      if (!state.isActive) {
        setSessionTime(0)
        setCurrentAnswer('')
        setAnswerHistory([])
        setHistoryIndex(-1)
        setTranscript([])
        setInterimTranscript({ interviewer: '', user: '' })
        pendingAnswerQuestionRef.current = ''
        latestQuestionRef.current = ''
        setCurrentModelSelection({ modelId: '', reason: '' })
        currentModelSelectionRef.current = { modelId: '', reason: '' }
      }
    })
    return cleanup
  }, [])

  // Session timer
  useEffect(() => {
    if (isSessionActive) {
      timerRef.current = setInterval(() => {
        setSessionTime((prev) => prev + 1)
      }, 1000)
    } else if (timerRef.current) {
      clearInterval(timerRef.current)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isSessionActive])

  const handleStartStop = useCallback(async () => {
    if (isSessionActive) {
      setConfirmEndSession(true)
    } else {
      setShowSessionSetup(true)
    }
  }, [isSessionActive])

  const handleConfirmEnd = useCallback(async () => {
    setConfirmEndSession(false)
    try {
      await window.api.stopSession()
    } catch (err: any) {
      setCurrentAnswer(`Error: ${err.message}`)
    }
  }, [])

  const handleCancelEnd = useCallback(() => {
    setConfirmEndSession(false)
  }, [])

  const handleSessionStart = useCallback(async (ctx?: any) => {
    setShowSessionSetup(false)
    try {
      await window.api.startSession(ctx)
    } catch (err: any) {
      setCurrentAnswer(`Error: ${err.message}`)
    }
  }, [])

  const handleSessionSkip = useCallback(async () => {
    setShowSessionSetup(false)
    try {
      await window.api.startSession()
    } catch (err: any) {
      setCurrentAnswer(`Error: ${err.message}`)
    }
  }, [])

  const handleCaptureScreen = useCallback(async () => {
    try {
      pendingAnswerQuestionRef.current = latestQuestionRef.current || 'Screen Analysis'
      setShowAnswerPane(true)
      setCurrentAnswer('Analyzing screen...')
      setIsAnswering(true)
      await window.api.captureScreen()
    } catch (err: any) {
      setCurrentAnswer(`Screen capture error: ${err.message}`)
      setIsAnswering(false)
    }
  }, [])

  const handleRegenerate = useCallback(async () => {
    pendingAnswerQuestionRef.current =
      answerHistory[historyIndex]?.question || latestQuestionRef.current || 'Interview Question'
    setShowAnswerPane(true)
    setCurrentAnswer('Regenerating...')
    setIsAnswering(true)
    await window.api.regenerateAnswer()
  }, [answerHistory, historyIndex])

  const handleAnswerNow = useCallback(async () => {
    pendingAnswerQuestionRef.current = latestQuestionRef.current || 'Interview Question'
    setShowAnswerPane(true)
    setCurrentAnswer((prev) => prev || 'Preparing answer...')
    setIsAnswering(true)
    const result = await window.api.requestAnswer()
    if (result?.success === false) {
      setCurrentAnswer('Waiting for a clearer question before generating an answer.')
      setIsAnswering(false)
    }
  }, [])

  const handleAnswerForQuestion = useCallback(async (question: string) => {
    pendingAnswerQuestionRef.current = question
    setShowAnswerPane(true)
    setCurrentAnswer('Preparing answer...')
    setIsAnswering(true)
    const result = await window.api.requestAnswer(question)
    if (result?.success === false) {
      setCurrentAnswer('Waiting for a clearer detected question before generating an answer.')
      setIsAnswering(false)
    }
  }, [])

  const handleToggleAutoAnswers = useCallback(async () => {
    const nextValue = !autoAnswerEnabled
    setAutoAnswerEnabled(nextValue)
    await window.api.setConfig({ autoAnswerEnabled: nextValue })
  }, [autoAnswerEnabled])

  const handleToggleMic = useCallback(async () => {
    const nextValue = !micEnabled
    setMicEnabled(nextValue)
    await window.api.setConfig({ micEnabled: nextValue })
  }, [micEnabled])

  const handleToggleAnswerWindow = useCallback(() => {
    window.api.toggleAnswerWindow()
  }, [])

  const handleHideAnswerWindow = useCallback(() => {
    window.api.hideAnswerWindow()
  }, [])

  useEffect(() => {
    const cleanupToggle = window.api.onShortcutToggleSession(() => {
      void handleStartStop()
    })
    const cleanupCapture = window.api.onShortcutCaptureScreen(() => {
      void handleCaptureScreen()
    })
    const cleanupRegenerate = window.api.onShortcutRegenerate(() => {
      void handleRegenerate()
    })

    return () => {
      cleanupToggle()
      cleanupCapture()
      cleanupRegenerate()
    }
  }, [handleCaptureScreen, handleRegenerate, handleStartStop])

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0')
    const s = (seconds % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  const detectedQuestionEntry = [...transcript]
    .reverse()
    .find((entry) => entry.speaker === 'interviewer' && isLikelyQuestionText(entry.text))
  const latestQuestion =
    interimTranscript.interviewer ||
    detectedQuestionEntry?.text ||
    [...transcript].reverse().find((entry) => entry.speaker === 'interviewer')?.text ||
    ''
  const visibleTranscript = transcript.slice(-12)
  const selectedHistoryEntry = historyIndex >= 0 ? answerHistory[historyIndex] : null
  const displayedQuestion = isAnswering
    ? pendingAnswerQuestionRef.current || latestQuestion || selectedHistoryEntry?.question || 'Interview Question'
    : selectedHistoryEntry?.question || latestQuestion
  const displayedAnswer = isAnswering ? currentAnswer : selectedHistoryEntry?.answer || currentAnswer
  const displayedModelId = isAnswering
    ? currentModelSelection.modelId
    : selectedHistoryEntry?.modelId || currentModelSelection.modelId
  const displayedRoutingReason = isAnswering
    ? currentModelSelection.reason
    : selectedHistoryEntry?.routingReason || currentModelSelection.reason

  useEffect(() => {
    latestQuestionRef.current = latestQuestion
  }, [latestQuestion])

  // Centralized overlay resize — keeps window tightly fitted to visible content
  useEffect(() => {
    const padding = 40 // account for p-5 on both sides
    const w = (controlBarWidth || 600) + padding
    let h = controlsHeight
    if (showSessionSetup && !isSessionActive) h = Math.max(h, 680)
    else if (confirmEndSession) h = Math.max(h, 480)
    void window.api.resizeOverlay(w, h)
  }, [controlBarWidth, controlsHeight, showSessionSetup, isSessionActive, confirmEndSession])

  useEffect(() => {
    const node = controlBarRef.current
    if (!node) return

    const updateWidth = () => {
      setControlBarWidth(Math.ceil(node.getBoundingClientRect().width))
    }

    updateWidth()
    const observer = new ResizeObserver(updateWidth)
    observer.observe(node)
    window.addEventListener('resize', updateWidth)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateWidth)
    }
  }, [])

  const handleClearAnswers = useCallback(() => {
    pendingAnswerQuestionRef.current = ''
    setCurrentAnswer('')
    setAnswerHistory([])
    setHistoryIndex(-1)
    setCurrentModelSelection({ modelId: '', reason: '' })
    currentModelSelectionRef.current = { modelId: '', reason: '' }
  }, [])

  if (isPreviewView) {
    return (
      <div className="overlay-shell h-full w-full bg-transparent p-0 text-white">
        <FilePreview />
      </div>
    )
  }

  if (isAnswerView) {
    return (
      <div className="overlay-shell h-full w-full bg-transparent p-0 text-white">
        <AISuggestion
          answer={displayedAnswer}
          isStreaming={isAnswering}
          question={displayedQuestion}
          canGoBack={historyIndex > 0}
          canGoForward={historyIndex >= 0 && historyIndex < answerHistory.length - 1}
          historyLabel={answerHistory.length > 0 ? `${historyIndex + 1} / ${answerHistory.length}` : undefined}
          onGoBack={() => setHistoryIndex((prev) => Math.max(0, prev - 1))}
          onGoForward={() => setHistoryIndex((prev) => Math.min(answerHistory.length - 1, prev + 1))}
          modelId={displayedModelId}
          routingReason={displayedRoutingReason}
          onClear={handleClearAnswers}
          onClose={handleHideAnswerWindow}
        />
      </div>
    )
  }

  if (isMinimized) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <button
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-2 rounded-2xl border border-white/[0.06] bg-[rgba(12,14,18,0.82)] px-5 py-3 text-[13px] font-semibold text-white/70 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-2xl transition-all duration-200 hover:bg-[rgba(12,14,18,0.92)] hover:text-white/90"
          title="Expand overlay"
        >
          <Sparkles size={15} />
          Open Assistant
        </button>
      </div>
    )
  }

  return (
    <div className="overlay-shell relative h-full w-full bg-transparent p-5 text-white">
      <div className="pointer-events-none absolute inset-0 flex flex-col items-start overflow-visible">
        <div
          ref={controlBarRef}
          className="pointer-events-auto relative z-20 shrink-0 p-5 pb-0"
        >
          <Controls
            isSessionActive={isSessionActive}
            sessionLabel={isSessionActive ? `Live ${formatTime(sessionTime)}` : 'Ready'}
            onStartStop={handleStartStop}
            onAnswerNow={handleAnswerNow}
            onCaptureScreen={handleCaptureScreen}
            onToggleMic={handleToggleMic}
            onToggleTranscript={() => setShowTranscript((prev) => !prev)}
            onToggleAutoAnswers={handleToggleAutoAnswers}
            onToggleAnswerPane={handleToggleAnswerWindow}
            onSendQuestion={handleAnswerForQuestion}
            onMinimize={() => setIsMinimized(true)}
            showTranscript={showTranscript}
            autoAnswerEnabled={autoAnswerEnabled}
            micEnabled={micEnabled}
            showAnswerPane={showAnswerPane}
            onHeightChange={setControlsHeight}
          />
        </div>

        {showSessionSetup && !isSessionActive && (
          <div
            className="pointer-events-auto relative z-15 mt-2 px-5"
            style={controlBarWidth ? { width: `${controlBarWidth}px` } : undefined}
          >
            <SessionSetup
              onStart={handleSessionStart}
              onSkip={handleSessionSkip}
              onCancel={() => setShowSessionSetup(false)}
            />
          </div>
        )}

        {confirmEndSession && (
          <div
            className="pointer-events-auto relative z-15 mt-2 px-5"
            style={controlBarWidth ? { width: `${controlBarWidth}px` } : undefined}
          >
            <div className="rounded-2xl border border-white/[0.06] bg-[rgba(12,14,18,0.92)] shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={15} className="text-amber-400/80" />
                <p className="text-[13px] font-medium text-white/80">End this session?</p>
              </div>
              <p className="text-[11px] text-white/40 mb-4">
                The transcript and answers will be saved to session history.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleConfirmEnd}
                  className="flex-1 rounded-lg bg-red-500/15 border border-red-500/20 py-2 text-[12px] font-semibold text-red-400 hover:bg-red-500/25 transition-all"
                >
                  End Session
                </button>
                <button
                  onClick={handleCancelEnd}
                  className="flex-1 rounded-lg bg-white/[0.04] border border-white/[0.06] py-2 text-[12px] font-medium text-white/40 hover:text-white/60 hover:bg-white/[0.06] transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {showTranscript && (
          <div
            className="pointer-events-auto relative z-10 mt-2 min-h-0 shrink overflow-hidden px-5"
            style={controlBarWidth ? { width: `${controlBarWidth}px` } : undefined}
          >
            <Transcript
              entries={visibleTranscript}
              detectedQuestion={detectedQuestionEntry?.text}
              interviewerInterimText={interimTranscript.interviewer}
              userInterimText={interimTranscript.user}
              onAnswerThis={() => {
                if (detectedQuestionEntry?.text) {
                  void handleAnswerForQuestion(detectedQuestionEntry.text)
                }
              }}
              onClear={() => {
                setTranscript([])
                setInterimTranscript({ interviewer: '', user: '' })
              }}
              onHide={() => setShowTranscript(false)}
            />
          </div>
        )}

      </div>

      {/* Audio capture component (hidden, handles audio stream) */}
      {isSessionActive && <AudioCapture micEnabled={micEnabled} />}
    </div>
  )
}

function isLikelyQuestionText(text: string): boolean {
  const normalized = text.trim().toLowerCase()
  if (!normalized) return false

  const words = normalized.split(/\s+/).filter(Boolean)
  if (words.length < 4) return false

  // Explicit question mark with enough substance
  if (normalized.endsWith('?')) return true

  // Filler/acknowledgment — never a question
  const fillerPhrases = [
    'got it', 'sounds good', 'perfect', 'alright', 'okay',
    'good answer', 'great answer', 'nice work', 'thanks',
    'thank you', 'i see', 'that makes sense', 'interesting',
    'let me', 'moving on', 'so next', 'one moment',
  ]
  if (fillerPhrases.some((p) => normalized.startsWith(p))) return false

  // Strong question starters
  const starters = [
    'what', 'why', 'how', 'when', 'where', 'which',
    'tell me', 'walk me', 'can you', 'could you', 'would you',
    'describe', 'explain', 'give me', 'talk about', 'share',
    'have you', 'do you', 'did you', 'are you', 'were you',
    'is there', 'was there',
  ]

  return starters.some((starter) => normalized.startsWith(starter))
}
