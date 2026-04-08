import { ipcMain, dialog, safeStorage, clipboard, shell } from 'electron'
import { IPC, UserContext, TranscriptEntry, LLMRequest, SessionRecord, AnswerSnapshot, SessionContext, InterviewType, ModelSelectionInfo } from '@shared/types'
import { STTService } from './services/stt-service'
import { LLMService } from './services/llm-service'
import { ScreenCaptureService } from './services/screen-capture'
import { ContextManager } from './services/context-manager'
import { AudioCaptureService } from './audio/capture'
import { selectModel, AnswerSource } from '@shared/model-selection'
import { SUPPORTED_LANGUAGES } from '@shared/constants'
import {
  getOverlayWindow,
  getAnswerWindow,
  getSettingsWindow,
  toggleOverlay,
  showOverlay,
  hideOverlay,
  toggleAnswerWindow,
  hideAnswerWindow,
  showAnswerWindow,
  resizeOverlayWindow,
  getAnswerWindowBounds,
  setAnswerWindowBounds,
  setContentProtection,
  openSettings,
  togglePreviewWindow,
  hidePreviewWindow,
  getPreviewWindowBounds,
  setPreviewWindowBounds,
} from './windows'
import ElectronStore from 'electron-store'
const Store = (ElectronStore as any).default || ElectronStore

const configStore = new Store({ name: 'app-config' })
const sessionStore = new Store({
  name: 'session-history',
  defaults: {
    sessions: [] as SessionRecord[],
  },
})
// ── Secure key storage helpers ───────────────────────────────────
// Uses Electron safeStorage (DPAPI on Windows) to encrypt API keys at rest.
// Falls back to plain text if safeStorage is unavailable.

function setSecureKey(key: string, value: string): void {
  if (!value) {
    configStore.delete(key)
    configStore.delete(`${key}_encrypted`)
    return
  }
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(value)
    configStore.set(`${key}_encrypted`, encrypted.toString('base64'))
    configStore.delete(key) // remove any old plain-text key
  } else {
    configStore.set(key, value)
  }
}

function getSecureKey(key: string): string {
  // Try encrypted first
  const encrypted = configStore.get(`${key}_encrypted`, '') as string
  if (encrypted) {
    try {
      const buffer = Buffer.from(encrypted, 'base64')
      return safeStorage.decryptString(buffer)
    } catch {
      // Decryption failed — fall through to plain text
    }
  }
  // Fall back to plain text (legacy or no safeStorage)
  return (configStore.get(key, '') as string)
}

const contextManager = new ContextManager()
const screenCapture = new ScreenCaptureService()
const audioCapture = new AudioCaptureService()

let sttService: STTService | null = null
let micSttService: STTService | null = null
let llmService: LLMService | null = null
let sessionTranscript: TranscriptEntry[] = []
let isSessionActive = false
let pendingGenerationTimer: NodeJS.Timeout | null = null
let lastGeneratedQuestion = ''
let lastGeneratedInterviewerTranscriptCount = 0
let lastAnswerCompletedAt = 0
let utteranceEndCount = 0

// Tuning constants
const UTTERANCE_DEBOUNCE_MS = 2500       // Wait after last utterance-end before triggering
const ANSWER_COOLDOWN_MS = 4000          // Min gap between auto-answers
const MAX_TRANSCRIPT_ENTRIES = 5000     // Cap to prevent unbounded memory growth
const MIN_WORDS_QUESTION_PATTERN = 4     // Min words when text matches question patterns
const MIN_WORDS_ANY_TEXT = 10            // Min words for non-question-patterned text
let currentSessionStartTime: number | null = null
let currentSessionAnswers: AnswerSnapshot[] = []
let lastRequestedQuestion = ''
let currentSessionInterviewType: InterviewType = 'general'
let currentFileContext = ''
let currentSessionScreenshots: string[] = []
let currentSessionFolderName = ''
let currentModelSelection: ModelSelectionInfo = {
  modelId: '',
  reason: '',
}

function sendToOverlay(channel: string, ...args: any[]): void {
  const overlay = getOverlayWindow()
  if (overlay && !overlay.isDestroyed()) {
    overlay.webContents.send(channel, ...args)
  }
}

function sendToSettings(channel: string, ...args: any[]): void {
  const settings = getSettingsWindow()
  if (settings && !settings.isDestroyed()) {
    settings.webContents.send(channel, ...args)
  }
}

function sendToAnswer(channel: string, ...args: any[]): void {
  const answer = getAnswerWindow()
  if (answer && !answer.isDestroyed()) {
    answer.webContents.send(channel, ...args)
  }
}

export function setupIpcHandlers(): void {
  // Initialize folder structure and migrate data on startup
  contextManager.initFolders()
  contextManager.migrateSessionsFromStore(sessionStore)

  // ── Session Control ──────────────────────────────────────────
  ipcMain.handle(IPC.START_SESSION, async (_event, sessionCtx?: SessionContext) => {
    const deepgramKey = (getSecureKey('deepgramApiKey') || process.env.DEEPGRAM_API_KEY || '') as string
    const openrouterKey = (getSecureKey('openrouterApiKey') || process.env.OPENROUTER_API_KEY || '') as string
    const model = (configStore.get('defaultModel') || process.env.DEFAULT_MODEL || 'google/gemini-3-flash-preview') as string

    if (!deepgramKey) throw new Error('Deepgram API key not configured')
    if (!openrouterKey) throw new Error('OpenRouter API key not configured')

    // Set session context if provided
    if (sessionCtx) {
      contextManager.setSessionContext(sessionCtx)
      currentSessionInterviewType = sessionCtx.interviewType || 'general'
    } else {
      contextManager.clearSessionContext()
      currentSessionInterviewType = 'general'
    }

    // Load file context from disk
    const fileCtx = contextManager.loadFileContext(sessionCtx?.companyName)
    currentFileContext = fileCtx.content
    if (fileCtx.files.length > 0) {
      console.log(`[FileContext] Loaded ${fileCtx.files.length} files: ${fileCtx.files.join(', ')}`)
    }

    // Initialize services
    const sttLanguage = configStore.get('sttLanguage', 'en') as string
    sttService = new STTService(deepgramKey, 'interviewer', sttLanguage)
    micSttService = getMicEnabled() ? new STTService(deepgramKey, 'user', sttLanguage) : null
    llmService = new LLMService(openrouterKey, model)
    sessionTranscript = []
    lastGeneratedQuestion = ''
    lastGeneratedInterviewerTranscriptCount = 0
    lastAnswerCompletedAt = 0
    utteranceEndCount = 0
    currentSessionAnswers = []
    currentSessionScreenshots = []
    currentSessionStartTime = Date.now()
    lastRequestedQuestion = ''
    currentModelSelection = { modelId: model, reason: 'Default model' }
    clearPendingGeneration()

    // Pre-compute session folder name for screenshot saving
    currentSessionFolderName = `${new Date().toISOString().slice(0, 10)}_${(sessionCtx?.companyName || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}_${(sessionCtx?.roleName || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`.replace(/_+$/, '')

    sttService.removeAllListeners()
    micSttService?.removeAllListeners()
    audioCapture.removeAllListeners('audio-data')
    llmService.removeAllListeners()

    // Wire up STT -> transcript events
    attachTranscriptListener(sttService)
    attachTranscriptListener(micSttService)

    // Wire up STT utterance end -> trigger LLM with smart debouncing
    // Each utterance-end resets the timer, so rapid-fire pauses (mid-question)
    // don't trigger prematurely. Only fires after sustained silence.
    sttService.on('utterance-end', () => {
      utteranceEndCount++
      clearPendingGeneration()
      pendingGenerationTimer = setTimeout(() => {
        utteranceEndCount = 0
        maybeGenerateAnswer()
      }, UTTERANCE_DEBOUNCE_MS)
    })

    // Wire up audio capture -> STT
    audioCapture.on('audio-data', ({ source, chunk }: { source: 'interviewer' | 'user'; chunk: Buffer }) => {
      if (source === 'interviewer') {
        sttService?.sendAudio(chunk)
        return
      }

      micSttService?.sendAudio(chunk)
    })

    // Wire up LLM events
    llmService.on('chunk', (_chunk: string, fullAnswer: string) => {
      showAnswerWindow()
      sendToOverlay(IPC.LLM_RESPONSE_CHUNK, fullAnswer)
      sendToAnswer(IPC.LLM_RESPONSE_CHUNK, fullAnswer)
    })

    llmService.on('done', (answer: string) => {
      lastAnswerCompletedAt = Date.now()
      if (answer.trim() && lastRequestedQuestion.trim()) {
        currentSessionAnswers.push({
          question: lastRequestedQuestion,
          answer,
          timestamp: Date.now(),
          modelId: currentModelSelection.modelId,
          routingReason: currentModelSelection.reason,
        })
      }
      showAnswerWindow()
      sendToOverlay(IPC.LLM_RESPONSE_DONE, answer)
      sendToAnswer(IPC.LLM_RESPONSE_DONE, answer)
      broadcastSessionState()
    })

    llmService.on('error', (error: Error) => {
      sendToOverlay(IPC.LLM_RESPONSE_DONE, `Error: ${error.message}`)
      sendToAnswer(IPC.LLM_RESPONSE_DONE, `Error: ${error.message}`)
    })

    // Connect STT and start audio capture
    await sttService.connect()
    await micSttService?.connect()
    audioCapture.startCapture()

    isSessionActive = true
    const sessionState = {
      isActive: true,
      startTime: currentSessionStartTime,
      autoAnswerEnabled: getAutoAnswerEnabled(),
      micEnabled: getMicEnabled(),
    }
    sendToOverlay(IPC.SESSION_STATE, sessionState)
    sendToSettings(IPC.SESSION_STATE, sessionState)

    return { success: true }
  })

  ipcMain.handle(IPC.STOP_SESSION, async () => {
    clearPendingGeneration()
    audioCapture.stopCapture()
    await sttService?.disconnect()
    await micSttService?.disconnect()
    llmService?.abort()
    audioCapture.removeAllListeners('audio-data')

    saveCurrentSession()
    isSessionActive = false
    sendToOverlay(IPC.SESSION_STATE, { isActive: false, startTime: null, autoAnswerEnabled: getAutoAnswerEnabled(), micEnabled: getMicEnabled() })
    sendToSettings(IPC.SESSION_STATE, { isActive: false, startTime: null, autoAnswerEnabled: getAutoAnswerEnabled(), micEnabled: getMicEnabled() })

    return { success: true, transcript: sessionTranscript }
  })

  ipcMain.handle(IPC.GET_SESSIONS, async () => {
    return contextManager.listSessions()
  })

  ipcMain.handle(IPC.GET_SESSION_DETAIL, async (_event, folderName: string) => {
    return contextManager.getSessionDetail(folderName)
  })

  ipcMain.handle(IPC.DELETE_SESSION, async (_event, folderName: string) => {
    return contextManager.deleteSession(folderName)
  })

  ipcMain.handle(IPC.EXPORT_SESSION, async (_event, folderName: string, format: 'md' | 'json') => {
    return contextManager.exportSession(folderName, format)
  })

  ipcMain.handle(IPC.OPEN_SESSION_FOLDER, async (_event, folderName: string) => {
    contextManager.openSessionFolder(folderName)
    return { success: true }
  })

  // ── Audio from renderer ──────────────────────────────────────
  ipcMain.on('audio:chunk', (_event, source: 'interviewer' | 'user', chunk: ArrayBuffer) => {
    audioCapture.processAudioChunk(source, Buffer.from(chunk))
  })

  // ── LLM ──────────────────────────────────────────────────────
  ipcMain.handle(IPC.LLM_REQUEST, async (_event, requestedQuestion?: string) => {
    const question = requestedQuestion?.trim() || getLatestQuestionCandidate(true)
    if (!question) return { success: false, reason: 'No question available yet' }

    await runManualAnswer(question)
    return { success: true }
  })

  ipcMain.handle(IPC.LLM_REGENERATE, async () => {
    const question = getLatestQuestionCandidate(true)
    if (!question) return

    await runManualAnswer(question)
  })

  // ── Screen Capture ───────────────────────────────────────────
  ipcMain.handle(IPC.CAPTURE_SCREEN, async () => {
    const imageBase64 = await screenCapture.captureScreen()

    // Save screenshot to session folder if session is active
    if (isSessionActive && currentSessionFolderName) {
      try {
        const filename = contextManager.saveScreenshot(currentSessionFolderName, imageBase64)
        currentSessionScreenshots.push(filename)
      } catch (err) {
        console.warn('[Screenshot] Failed to save to disk:', err)
      }
    }

    const profile = contextManager.getProfile()
    const sessionCtx = contextManager.getSessionContext()
    const openrouterKey = (getSecureKey('openrouterApiKey') || process.env.OPENROUTER_API_KEY || '') as string
    const screenModel = resolveModel('screen-analysis', '')
    const screenAnalysisQuestion = 'Screen Analysis'

    if (!openrouterKey) {
      throw new Error('OpenRouter API key not configured')
    }

    if (!llmService) {
      llmService = new LLMService(openrouterKey, screenModel.modelId)
    } else {
      llmService.setModel(screenModel.modelId)
    }
    currentModelSelection = screenModel

    llmService.removeAllListeners('chunk')
    llmService.removeAllListeners('done')
    llmService.removeAllListeners('error')

    llmService.on('chunk', (_chunk: string, fullAnswer: string) => {
      showAnswerWindow()
      sendToOverlay(IPC.LLM_RESPONSE_CHUNK, fullAnswer)
      sendToAnswer(IPC.LLM_RESPONSE_CHUNK, fullAnswer)
    })
    llmService.on('done', (answer: string) => {
      if (answer.trim()) {
        currentSessionAnswers.push({
          question: screenAnalysisQuestion,
          answer,
          timestamp: Date.now(),
          modelId: currentModelSelection.modelId,
          routingReason: currentModelSelection.reason,
        })
      }
      showAnswerWindow()
      sendToOverlay(IPC.LLM_RESPONSE_DONE, answer)
      sendToAnswer(IPC.LLM_RESPONSE_DONE, answer)
      broadcastSessionState()
    })
    llmService.on('error', (error: Error) => {
      sendToOverlay(IPC.LLM_RESPONSE_DONE, `Error: ${error.message}`)
      sendToAnswer(IPC.LLM_RESPONSE_DONE, `Error: ${error.message}`)
    })

    showAnswerWindow()
    lastRequestedQuestion = screenAnalysisQuestion
    sendToOverlay(IPC.LLM_QUESTION, screenAnalysisQuestion)
    sendToAnswer(IPC.LLM_QUESTION, screenAnalysisQuestion)
    sendToOverlay(IPC.LLM_MODEL_SELECTION, currentModelSelection)
    sendToAnswer(IPC.LLM_MODEL_SELECTION, currentModelSelection)
    sendToOverlay(IPC.LLM_RESPONSE_CHUNK, '')
    sendToAnswer(IPC.LLM_RESPONSE_CHUNK, '')
    await llmService.analyzeScreenshot(imageBase64, profile, sessionCtx, getAnswerLanguage())

    return { success: true }
  })

  // ── Context ──────────────────────────────────────────────────
  ipcMain.handle(IPC.SET_CONTEXT, async (_event, context: UserContext) => {
    contextManager.setContext(context)
    return { success: true }
  })

  ipcMain.handle(IPC.GET_CONTEXT, async () => {
    return contextManager.getContext()
  })

  ipcMain.handle(IPC.GET_PROFILE, async () => {
    return contextManager.getProfile()
  })

  ipcMain.handle(IPC.SET_PROFILE, async (_event, profile: any) => {
    contextManager.setProfile(profile)
    return { success: true }
  })

  ipcMain.handle(IPC.GET_LAST_SESSION_CONTEXT, async () => {
    return contextManager.getLastSessionContext()
  })

  // File context
  ipcMain.handle(IPC.LIST_CONTEXT_FOLDERS, async () => {
    return contextManager.listContextFolders()
  })

  ipcMain.handle(IPC.LOAD_FILE_CONTEXT, async (_event, company?: string) => {
    return contextManager.loadFileContext(company)
  })

  ipcMain.handle(IPC.OPEN_CONTEXT_FOLDER, async () => {
    contextManager.openContextFolder()
    return { success: true }
  })

  ipcMain.handle(IPC.OPEN_APP_DATA_FOLDER, async () => {
    contextManager.openAppDataFolder()
    return { success: true }
  })

  ipcMain.handle(IPC.OPEN_EXTERNAL, async (_event, url: string) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url)
    }
    return { success: true }
  })

  // Resume file upload — AI-powered analysis
  ipcMain.handle('context:upload-resume', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Documents', extensions: ['pdf', 'txt', 'md'] },
      ],
    })

    if (result.canceled || result.filePaths.length === 0) return null

    const filePath = result.filePaths[0]
    const rawContent = contextManager.readResumeFile(filePath)

    // Check if we have an API key for AI analysis
    const openrouterKey = (getSecureKey('openrouterApiKey') || process.env.OPENROUTER_API_KEY || '') as string
    const model = (configStore.get('defaultModel') || process.env.DEFAULT_MODEL || 'google/gemini-3-flash-preview') as string

    if (!openrouterKey) {
      // No API key — return raw text for TXT/MD, error for PDF
      if (rawContent.text) {
        return { text: rawContent.text, filePath }
      }
      throw new Error('OpenRouter API key required to analyze PDF resumes')
    }

    // Use AI to structure the resume
    const resumeLlm = new LLMService(openrouterKey, model)
    try {
      const structured = await resumeLlm.analyzeResume(rawContent)

      // Save structured markdown to profile folder
      const savedPath = contextManager.saveResumeMd(structured)
      console.log(`[Resume] AI-structured resume saved to ${savedPath}`)

      return { text: structured, filePath }
    } catch (error: any) {
      console.error('[Resume] AI analysis failed:', error.message)
      // Fallback: return raw text if available
      if (rawContent.text) {
        return { text: rawContent.text, filePath }
      }
      throw new Error(`Failed to analyze resume: ${error.message}`)
    }
  })

  // ── Config ───────────────────────────────────────────────────
  ipcMain.handle(IPC.GET_CONFIG, async () => {
    return {
      openrouterApiKey: getSecureKey('openrouterApiKey'),
      deepgramApiKey: getSecureKey('deepgramApiKey'),
      defaultModel: configStore.get('defaultModel', 'google/gemini-3-flash-preview') as string,
      codingModel: configStore.get('codingModel', '') as string,
      autoModelSelection: configStore.get('autoModelSelection', false) as boolean,
      overlayOpacity: configStore.get('overlayOpacity', 0.92) as number,
      fontSize: configStore.get('fontSize', 14) as number,
      autoAnswerEnabled: configStore.get('autoAnswerEnabled', true) as boolean,
      micEnabled: configStore.get('micEnabled', true) as boolean,
      sttLanguage: configStore.get('sttLanguage', 'en') as string,
      contentProtection: configStore.get('contentProtection', true) as boolean,
    }
  })

  ipcMain.handle(IPC.SET_CONFIG, async (_event, config: Record<string, any>) => {
    const secureKeys = new Set(['openrouterApiKey', 'deepgramApiKey'])
    const ALLOWED_CONFIG_KEYS = new Set([
      'openrouterApiKey', 'deepgramApiKey', 'defaultModel', 'codingModel',
      'autoModelSelection', 'overlayOpacity', 'fontSize', 'autoAnswerEnabled',
      'micEnabled', 'sttLanguage', 'contentProtection',
    ])
    for (const [key, value] of Object.entries(config)) {
      if (!ALLOWED_CONFIG_KEYS.has(key)) continue
      if (secureKeys.has(key)) {
        setSecureKey(key, value as string)
      } else {
        configStore.set(key, value)
      }
    }

    // Apply opacity change immediately
    if (config.overlayOpacity !== undefined) {
      const overlay = getOverlayWindow()
      overlay?.setOpacity(config.overlayOpacity)
    }

    if (config.autoAnswerEnabled !== undefined) {
      broadcastSessionState()
    }

    if (config.sttLanguage !== undefined && isSessionActive) {
      // Reconnect STT with new language
      const newLang = config.sttLanguage as string
      const deepgramKey = deepgramKeyFromConfig()

      sendToOverlay('stt:reconnecting', true)

      try {
        if (sttService) {
          await sttService.disconnect()
          sttService = new STTService(deepgramKey, 'interviewer', newLang)
          attachTranscriptListener(sttService)
          await sttService.connect()
        }
        if (micSttService && getMicEnabled()) {
          await micSttService.disconnect()
          micSttService = new STTService(deepgramKey, 'user', newLang)
          attachTranscriptListener(micSttService)
          await micSttService.connect()
        }
        sendToOverlay('stt:reconnecting', false)
      } catch (error: any) {
        console.error('[STT] Language reconnection failed:', error.message)
        sendToOverlay('stt:reconnecting', false)
        sendToOverlay('stt:reconnect-error', error.message)
        // Attempt to restore with previous language
        const prevLang = configStore.get('sttLanguage', 'en') as string
        try {
          if (sttService) {
            sttService = new STTService(deepgramKey, 'interviewer', prevLang)
            attachTranscriptListener(sttService)
            await sttService.connect()
          }
          if (micSttService && getMicEnabled()) {
            micSttService = new STTService(deepgramKey, 'user', prevLang)
            attachTranscriptListener(micSttService)
            await micSttService.connect()
          }
        } catch (restoreError: any) {
          console.error('[STT] Failed to restore previous language:', restoreError.message)
        }
      }
    }

    if (config.contentProtection !== undefined) {
      setContentProtection(config.contentProtection as boolean)
    }

    if (config.micEnabled !== undefined) {
      if (isSessionActive && sttService) {
        if (getMicEnabled()) {
          if (!micSttService) {
            const lang = configStore.get('sttLanguage', 'en') as string
            micSttService = new STTService(deepgramKeyFromConfig(), 'user', lang)
            attachTranscriptListener(micSttService)
            await micSttService.connect()
          }
        } else {
          await micSttService?.disconnect()
          micSttService = null
        }
      }

      broadcastSessionState()
    }

    return { success: true }
  })

  // ── Clipboard ──────────────────────────────────────────────
  ipcMain.handle('clipboard:write', (_event, text: string) => {
    clipboard.writeText(text)
    return true
  })

  // ── Window Control ───────────────────────────────────────────
  ipcMain.on(IPC.TOGGLE_OVERLAY, () => toggleOverlay())
  ipcMain.on(IPC.SHOW_OVERLAY, () => showOverlay())
  ipcMain.on(IPC.HIDE_OVERLAY, () => hideOverlay())
  ipcMain.on(IPC.TOGGLE_ANSWER_WINDOW, () => {
    toggleAnswerWindow()
    broadcastSessionState()
  })
  ipcMain.on(IPC.HIDE_ANSWER_WINDOW, () => {
    hideAnswerWindow()
    broadcastSessionState()
  })
  ipcMain.on(IPC.SET_CONTENT_PROTECTION, (_event, enabled: boolean) => {
    setContentProtection(enabled)
    configStore.set('contentProtection', enabled)
  })

  ipcMain.on(IPC.OPEN_SETTINGS, () => {
    openSettings()
  })


  ipcMain.handle(IPC.GET_ANSWER_WINDOW_BOUNDS, () => getAnswerWindowBounds())
  ipcMain.handle(IPC.SET_ANSWER_WINDOW_BOUNDS, (_event, bounds: { x?: number; y?: number; width?: number; height?: number }) => {
    setAnswerWindowBounds(bounds)
    return getAnswerWindowBounds()
  })
  ipcMain.handle(IPC.RESIZE_OVERLAY, (_event, width: number, height: number) => {
    resizeOverlayWindow(width, height)
    return { success: true }
  })

  // ── Preview Window ──────────────────────────────────────────
  ipcMain.on(IPC.TOGGLE_PREVIEW_WINDOW, () => togglePreviewWindow())
  ipcMain.on(IPC.HIDE_PREVIEW_WINDOW, () => hidePreviewWindow())
  ipcMain.handle(IPC.GET_PREVIEW_WINDOW_BOUNDS, () => getPreviewWindowBounds())
  ipcMain.handle(IPC.SET_PREVIEW_WINDOW_BOUNDS, (_event, bounds: { x?: number; y?: number; width?: number; height?: number }) => {
    setPreviewWindowBounds(bounds)
    return getPreviewWindowBounds()
  })

  // PDF to Markdown conversion
  ipcMain.handle(IPC.CONVERT_PDF_TO_MARKDOWN, async (_event, pdfBase64: string, filename: string) => {
    const key = getSecureKey('openrouterApiKey') || process.env.OPENROUTER_API_KEY || ''
    const model = (configStore.get('defaultModel') || process.env.DEFAULT_MODEL || 'google/gemini-3-flash-preview') as string
    if (!key) throw new Error('OpenRouter API key required for PDF conversion')
    const llm = new LLMService(key, model)
    return llm.convertPdfToMarkdown(pdfBase64, filename)
  })
}

async function generateAnswer(request: LLMRequest, source: AnswerSource = 'transcript'): Promise<void> {
  if (!llmService) return
  lastRequestedQuestion = request.question
  currentModelSelection = resolveModel(source, request.question)
  llmService.setModel(currentModelSelection.modelId)
  showAnswerWindow()
  sendToOverlay(IPC.LLM_QUESTION, request.question)
  sendToAnswer(IPC.LLM_QUESTION, request.question)
  sendToOverlay(IPC.LLM_MODEL_SELECTION, currentModelSelection)
  sendToAnswer(IPC.LLM_MODEL_SELECTION, currentModelSelection)
  sendToOverlay(IPC.LLM_RESPONSE_CHUNK, '') // Clear previous answer
  sendToAnswer(IPC.LLM_RESPONSE_CHUNK, '')
  broadcastSessionState()
  await llmService.generateAnswer(request)
}

async function maybeGenerateAnswer(): Promise<void> {
  if (!getAutoAnswerEnabled()) return

  // Cooldown: don't fire another auto-answer too soon after the last one finished
  const timeSinceLastAnswer = Date.now() - lastAnswerCompletedAt
  if (lastAnswerCompletedAt > 0 && timeSinceLastAnswer < ANSWER_COOLDOWN_MS) {
    return
  }

  const rawQuestion = getLatestQuestionCandidate(false)
  if (!rawQuestion || !shouldGenerateForQuestion(rawQuestion)) return

  const preparedQuestion = await prepareQuestionForAnswer(rawQuestion)
  if (!preparedQuestion || !shouldGenerateForQuestion(preparedQuestion)) return

  const normalizedQuestion = normalizeQuestion(preparedQuestion)
  if (normalizedQuestion === lastGeneratedQuestion) return

  const context = contextManager.getContext()
  const request: LLMRequest = {
    question: preparedQuestion,
    conversationHistory: sessionTranscript,
    answerHistory: currentSessionAnswers,
    userContext: context,
    interviewType: currentSessionInterviewType,
    fileContext: currentFileContext,
    answerLanguage: getAnswerLanguage(),
  }

  const finalEntries = sessionTranscript.filter((entry) => entry.isFinal)
  lastGeneratedQuestion = normalizedQuestion
  lastGeneratedInterviewerTranscriptCount = finalEntries.filter((entry) => entry.speaker === 'interviewer').length
  await generateAnswer(request)
}

async function runManualAnswer(question: string): Promise<void> {
  const preparedQuestion = await prepareQuestionForAnswer(question)
  if (!preparedQuestion) return

  const context = contextManager.getContext()
  const request: LLMRequest = {
    question: preparedQuestion,
    conversationHistory: sessionTranscript,
    answerHistory: currentSessionAnswers,
    userContext: context,
    interviewType: currentSessionInterviewType,
    fileContext: currentFileContext,
    answerLanguage: getAnswerLanguage(),
  }

  lastGeneratedQuestion = normalizeQuestion(preparedQuestion)
  lastGeneratedInterviewerTranscriptCount = sessionTranscript.filter(
    (entry) => entry.isFinal && entry.speaker === 'interviewer'
  ).length
  await generateAnswer(request, 'manual')
}

function getLatestQuestionCandidate(forceRecentFallback: boolean): string {
  const finalEntries = sessionTranscript.filter((entry) => entry.isFinal && entry.speaker === 'interviewer')
  if (finalEntries.length === 0) return ''

  const newEntries = finalEntries.slice(lastGeneratedInterviewerTranscriptCount)
  const candidateEntries = newEntries.length > 0
    ? newEntries
    : forceRecentFallback
      ? finalEntries.slice(-3)
      : []

  if (candidateEntries.length === 0) return ''

  // Trim leading filler/transition entries that aren't part of the actual question.
  // Walk from the end to find the last substantive question boundary.
  const texts = candidateEntries.map((entry) => entry.text.trim()).filter(Boolean)

  // Drop leading entries that are pure filler/acknowledgment
  const trimmed: string[] = []
  let foundSubstance = false
  for (const text of texts) {
    const lower = text.toLowerCase().replace(/[^\w\s?]/g, '').trim()
    const words = lower.split(/\s+/).filter(Boolean)

    if (!foundSubstance) {
      // Skip short acknowledgments at the start
      const isAcknowledgment = words.length <= 3 && isFillerPhrase(lower)
      if (isAcknowledgment) continue
      foundSubstance = true
    }
    trimmed.push(text)
  }

  return trimmed.join(' ').trim()
}

function shouldGenerateForQuestion(question: string): boolean {
  const normalized = normalizeQuestion(question)
  if (!normalized) return false

  // Single-word or very short filler
  const fillerOnly = new Set([
    'yes', 'yeah', 'yep', 'ok', 'okay', 'sure', 'right', 'hello', 'hi',
    'thanks', 'thank you', 'got it', 'got ya', 'gotcha', 'alright',
    'sounds good', 'perfect', 'great', 'nice', 'awesome', 'cool',
    'good', 'absolutely', 'exactly', 'correct', 'indeed', 'mhm',
  ])
  if (fillerOnly.has(normalized)) return false

  const words = normalized.split(/\s+/).filter(Boolean)
  if (words.length < 3) return false

  // Transition/filler phrases — interviewer is setting up, not asking yet
  const transitionPhrases = [
    'let me', 'so let me', 'alright so', 'okay so', 'moving on',
    'so next', 'the next', 'now i want', 'now let me', 'before we',
    'so before', 'going back', 'one more thing', 'just to clarify',
    'i see', 'that makes sense', 'interesting', 'good answer',
    'great answer', 'nice work', 'well done', 'thank you for',
    'thanks for', 'i appreciate', 'so basically', 'so essentially',
  ]
  if (transitionPhrases.some((phrase) => normalized.startsWith(phrase)) && !normalized.includes('?')) {
    // Transition phrases only pass if they end with a question mark
    return false
  }

  // Explicit question mark — strong signal
  if (/[?]$/.test(question.trim()) && words.length >= MIN_WORDS_QUESTION_PATTERN) return true

  // Known question starters — need at least MIN_WORDS_QUESTION_PATTERN words
  const questionStarters = [
    'tell me', 'walk me', 'can you', 'could you', 'would you',
    'what', 'why', 'how', 'when', 'where', 'which',
    'describe', 'explain', 'give me', 'talk about', 'share',
    'have you', 'do you', 'did you', 'are you', 'were you',
    'is there', 'was there',
  ]

  if (questionStarters.some((starter) => normalized.startsWith(starter))) {
    return words.length >= MIN_WORDS_QUESTION_PATTERN
  }

  // Anything else needs substantially more words to be worth answering
  return words.length >= MIN_WORDS_ANY_TEXT
}

function normalizeQuestion(question: string): string {
  return question
    .toLowerCase()
    .replace(/[^\w\s?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function prepareQuestionForAnswer(question: string): Promise<string> {
  const cleanedQuestion = cleanTranscriptQuestion(question)
  if (!cleanedQuestion) return ''

  if (!llmService) return cleanedQuestion

  try {
    const rewritten = await llmService.normalizeQuestion(cleanedQuestion, sessionTranscript)
    return finalizeNormalizedQuestion(rewritten, cleanedQuestion)
  } catch (error: any) {
    console.error('[LLM] Question normalization failed:', error.message)
    return cleanedQuestion
  }
}

function isFillerPhrase(text: string): boolean {
  const fillerPhrases = [
    'yes', 'yeah', 'yep', 'ok', 'okay', 'sure', 'right', 'alright',
    'got it', 'gotcha', 'sounds good', 'perfect', 'great', 'awesome',
    'cool', 'good', 'nice', 'absolutely', 'exactly', 'correct',
    'indeed', 'mhm', 'uh huh', 'i see', 'that makes sense',
    'interesting', 'good answer', 'great answer', 'nice work',
    'well done', 'thanks', 'thank you', 'thanks for that',
    'thank you for that', 'moving on', 'so next', 'one moment',
    'let me think', 'hold on', 'just a second', 'give me a moment',
  ]
  const lower = text.toLowerCase().replace(/[^\w\s]/g, '').trim()
  return fillerPhrases.some((phrase) => lower === phrase || lower.startsWith(phrase + ' '))
}

function cleanTranscriptQuestion(question: string): string {
  const fillerWords = new Set([
    'uh', 'um', 'erm', 'hmm', 'mm', 'like', 'you know',
    'i mean', 'sort of', 'kind of', 'basically', 'actually',
    'right', 'so', 'well', 'anyway', 'anyways',
  ])
  // Also remove repeated words and clean up ASR artifacts
  const words = question
    .replace(/\r?\n/g, ' ')
    .replace(/[.,]{2,}/g, ' ')       // Multiple dots/commas
    .replace(/(\b\w+\b)( \1\b)+/gi, '$1')  // Repeated words ("the the" → "the")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean)

  const cleaned: string[] = []

  for (const word of words) {
    const normalizedWord = word.toLowerCase().replace(/[^\w'-]/g, '')

    // Skip single filler words
    if (fillerWords.has(normalizedWord)) continue

    // Skip if it's an exact repeat of the previous word
    const previousWord = cleaned[cleaned.length - 1]?.toLowerCase().replace(/[^\w'-]/g, '')
    if (previousWord && previousWord === normalizedWord) continue

    cleaned.push(word)
  }

  return cleaned.join(' ').replace(/\s+/g, ' ').trim()
}

function finalizeNormalizedQuestion(rewritten: string, fallback: string): string {
  const candidate = rewritten
    .replace(/^["'\s]+|["'\s]+$/g, '')
    .replace(/^(question|interviewer question)\s*:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!candidate) return fallback
  if (candidate.length > 240) return fallback
  if (candidate.split(/\s+/).length < 4) return fallback

  const finalized = /[?.!]$/.test(candidate) ? candidate : `${candidate}?`
  return finalized
}

function clearPendingGeneration(): void {
  if (pendingGenerationTimer) {
    clearTimeout(pendingGenerationTimer)
    pendingGenerationTimer = null
  }
}

function attachTranscriptListener(service: STTService | null): void {
  service?.on('transcript', (entry: TranscriptEntry) => {
    if (entry.isFinal) {
      sessionTranscript.push(entry)
      if (sessionTranscript.length > MAX_TRANSCRIPT_ENTRIES) {
        sessionTranscript = sessionTranscript.slice(-MAX_TRANSCRIPT_ENTRIES)
      }
    }
    sendToOverlay(IPC.TRANSCRIPT_UPDATE, entry)
    sendToAnswer(IPC.TRANSCRIPT_UPDATE, entry)
  })
}

function broadcastSessionState(): void {
  const sessionState = {
    isActive: isSessionActive,
    startTime: currentSessionStartTime,
    autoAnswerEnabled: getAutoAnswerEnabled(),
    micEnabled: getMicEnabled(),
    answerWindowVisible: Boolean(getAnswerWindow()?.isVisible()),
  }

  sendToOverlay(IPC.SESSION_STATE, sessionState)
  sendToSettings(IPC.SESSION_STATE, sessionState)
}

function deepgramKeyFromConfig(): string {
  return (getSecureKey('deepgramApiKey') || process.env.DEEPGRAM_API_KEY || '') as string
}

function resolveModel(source: AnswerSource, question: string): ModelSelectionInfo {
  const defaultModel = (configStore.get('defaultModel') || process.env.DEFAULT_MODEL || 'google/gemini-3-flash-preview') as string
  const codingModel = configStore.get('codingModel', '') as string
  const autoModelSelection = configStore.get('autoModelSelection', false) as boolean

  return selectModel({
    autoModelSelection,
    source,
    interviewType: currentSessionInterviewType,
    question,
    defaultModel,
    codingModel,
  })
}

function getAutoAnswerEnabled(): boolean {
  return configStore.get('autoAnswerEnabled', true) as boolean
}

function getMicEnabled(): boolean {
  return configStore.get('micEnabled', true) as boolean
}

function getAnswerLanguage(): string {
  const code = configStore.get('sttLanguage', 'en') as string
  return SUPPORTED_LANGUAGES.find((l) => l.code === code)?.name || 'English'
}

function saveCurrentSession(): void {
  if (!currentSessionStartTime) return
  if (sessionTranscript.length === 0 && currentSessionAnswers.length === 0) {
    currentSessionStartTime = null
    return
  }

  const profile = contextManager.getProfile()
  const context = contextManager.getContext()
  const sessionCtx = contextManager.getSessionContext()
  const endedAt = Date.now()
  const record: SessionRecord = {
    id: `${currentSessionStartTime}`,
    title: context.companyName || context.roleName
      ? `${context.companyName || 'Interview'}${context.roleName ? ` - ${context.roleName}` : ''}`
      : `Interview ${new Date(currentSessionStartTime).toLocaleString()}`,
    startedAt: currentSessionStartTime,
    endedAt,
    durationSeconds: Math.max(1, Math.round((endedAt - currentSessionStartTime) / 1000)),
    transcript: [...sessionTranscript],
    answers: [...currentSessionAnswers],
    companyName: context.companyName,
    roleName: context.roleName,
    interviewType: sessionCtx.interviewType,
    subject: sessionCtx.subject,
    sessionNotes: sessionCtx.sessionNotes,
    screenshots: currentSessionScreenshots,
    profileSnapshot: {
      name: profile.name,
      skillsSummary: profile.skillsSummary,
    },
  }

  try {
    contextManager.saveSession(record)
    console.log(`[Session] Saved to filesystem: ${record.title}`)
  } catch (err) {
    console.error('[Session] Failed to save to filesystem:', err)
  }

  currentSessionStartTime = null
  currentSessionAnswers = []
  currentSessionScreenshots = []
}
