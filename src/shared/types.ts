// ============================================================
// Shared types used across main and renderer processes
// ============================================================

export interface AppConfig {
  openrouterApiKey: string
  deepgramApiKey: string
  defaultModel: string
  codingModel: string
  autoModelSelection: boolean
  sttProvider: 'deepgram' | 'whisper'
  overlayOpacity: number
  overlayPosition: { x: number; y: number }
  overlaySize: { width: number; height: number }
  fontSize: number
  theme: 'dark' | 'light'
  shortcuts: KeyboardShortcuts
  sttLanguage: string
  contentProtection: boolean
  autoAnswerEnabled: boolean
  micEnabled: boolean
}

export interface KeyboardShortcuts {
  toggleOverlay: string
  startStopSession: string
  captureScreen: string
  regenerateAnswer: string
  hideOverlay: string
}

export interface SessionState {
  isActive: boolean
  startTime: number | null
  transcript: TranscriptEntry[]
  currentAnswer: string
  isGenerating: boolean
  interviewType: InterviewType
  autoAnswerEnabled?: boolean
  micEnabled?: boolean
  answerWindowVisible?: boolean
}

export interface TranscriptEntry {
  id: string
  text: string
  speaker: 'interviewer' | 'user' | 'unknown'
  timestamp: number
  isFinal: boolean
}

export type InterviewType = 'behavioral' | 'technical' | 'coding' | 'system-design' | 'general'

export interface ProfileContext {
  name: string
  resume: string
  jobDescription: string
  skillsSummary: string
  preferredAnswerStyle: string
  extraInstructions: string
}

export interface SessionContext {
  companyName: string
  roleName: string
  interviewType: InterviewType
  subject: string
  sessionNotes: string
}

// Merged view for backward compat
export interface UserContext {
  resume: string
  jobDescription: string
  extraInstructions: string
  companyName: string
  roleName: string
  name: string
  skillsSummary: string
  preferredAnswerStyle: string
  interviewType: InterviewType
  subject: string
  sessionNotes: string
}

export interface LLMRequest {
  question: string
  conversationHistory: TranscriptEntry[]
  answerHistory?: AnswerSnapshot[]
  userContext: UserContext
  interviewType: InterviewType
  fileContext?: string
  answerLanguage?: string
}

export interface LLMResponse {
  answer: string
  isStreaming: boolean
  done: boolean
}

export interface ModelSelectionInfo {
  modelId: string
  reason: string
}

export interface ScreenCaptureResult {
  imageBase64: string
  timestamp: number
}

export interface AnswerSnapshot {
  question: string
  answer: string
  timestamp: number
  modelId?: string
  routingReason?: string
}

export interface SessionRecord {
  id: string
  title: string
  startedAt: number
  endedAt: number
  durationSeconds: number
  transcript: TranscriptEntry[]
  answers: AnswerSnapshot[]
  companyName?: string
  roleName?: string
  interviewType?: InterviewType
  subject?: string
  sessionNotes?: string
  screenshots?: string[] // filenames relative to screenshots/
  profileSnapshot?: {
    name: string
    skillsSummary: string
  }
  folderName?: string // filesystem folder name for this session
}

/** Lightweight session metadata for listing (no transcript/answers loaded) */
export interface SessionSummary {
  id: string
  title: string
  startedAt: number
  endedAt: number
  durationSeconds: number
  companyName?: string
  roleName?: string
  interviewType?: InterviewType
  subject?: string
  transcriptCount: number
  answerCount: number
  folderName: string
}

export interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
}

// IPC Channel names
export const IPC = {
  // Session
  START_SESSION: 'session:start',
  STOP_SESSION: 'session:stop',
  SESSION_STATE: 'session:state',
  GET_SESSIONS: 'session:get-sessions',
  GET_SESSION_DETAIL: 'session:get-detail',
  DELETE_SESSION: 'session:delete',
  EXPORT_SESSION: 'session:export',
  OPEN_SESSION_FOLDER: 'session:open-folder',

  // Transcript
  TRANSCRIPT_UPDATE: 'transcript:update',
  TRANSCRIPT_CLEAR: 'transcript:clear',

  // LLM
  LLM_REQUEST: 'llm:request',
  LLM_QUESTION: 'llm:question',
  LLM_MODEL_SELECTION: 'llm:model-selection',
  LLM_RESPONSE_CHUNK: 'llm:response-chunk',
  LLM_RESPONSE_DONE: 'llm:response-done',
  LLM_REGENERATE: 'llm:regenerate',

  // Screen capture
  CAPTURE_SCREEN: 'screen:capture',
  SCREEN_RESULT: 'screen:result',

  // Context
  SET_CONTEXT: 'context:set',
  GET_CONTEXT: 'context:get',
  CONTEXT_DATA: 'context:data',
  GET_PROFILE: 'context:get-profile',
  SET_PROFILE: 'context:set-profile',
  GET_LAST_SESSION_CONTEXT: 'context:get-last-session-context',
  LIST_CONTEXT_FOLDERS: 'context:list-folders',
  LOAD_FILE_CONTEXT: 'context:load-files',
  OPEN_CONTEXT_FOLDER: 'context:open-folder',
  OPEN_APP_DATA_FOLDER: 'app:open-data-folder',

  // Config
  GET_CONFIG: 'config:get',
  SET_CONFIG: 'config:set',
  CONFIG_DATA: 'config:data',

  // Window
  TOGGLE_OVERLAY: 'window:toggle-overlay',
  SHOW_OVERLAY: 'window:show-overlay',
  HIDE_OVERLAY: 'window:hide-overlay',
  TOGGLE_ANSWER_WINDOW: 'window:toggle-answer-window',
  HIDE_ANSWER_WINDOW: 'window:hide-answer-window',
  GET_ANSWER_WINDOW_BOUNDS: 'window:get-answer-window-bounds',
  SET_ANSWER_WINDOW_BOUNDS: 'window:set-answer-window-bounds',
  RESIZE_OVERLAY: 'window:resize-overlay',
  SET_CONTENT_PROTECTION: 'window:set-content-protection',
  OPEN_SETTINGS: 'window:open-settings',

  // Preview
  TOGGLE_PREVIEW_WINDOW: 'window:toggle-preview-window',
  HIDE_PREVIEW_WINDOW: 'window:hide-preview-window',
  GET_PREVIEW_WINDOW_BOUNDS: 'window:get-preview-window-bounds',
  SET_PREVIEW_WINDOW_BOUNDS: 'window:set-preview-window-bounds',
  CONVERT_PDF_TO_MARKDOWN: 'preview:convert-pdf',

  // Audio
  AUDIO_LEVEL: 'audio:level',

  // Shell
  OPEN_EXTERNAL: 'shell:open-external',
} as const
