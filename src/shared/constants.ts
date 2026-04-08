export const DEFAULT_MODEL = 'google/gemini-3-flash-preview'
export const DEFAULT_CODING_MODEL = 'deepseek/deepseek-chat-v3-0324'

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

export const DEFAULT_SHORTCUTS = {
  toggleOverlay: 'CommandOrControl+Shift+O',
  startStopSession: 'CommandOrControl+Shift+S',
  captureScreen: 'CommandOrControl+Shift+C',
  regenerateAnswer: 'CommandOrControl+Shift+R',
  hideOverlay: 'CommandOrControl+Shift+H',
}

export const DEEPGRAM_CONFIG = {
  model: 'nova-3',
  language: 'en',
  smart_format: true,
  punctuate: true,
  interim_results: true,
  utterance_end_ms: 1800,
  vad_events: true,
  encoding: 'linear16',
  sample_rate: 16000,
  channels: 1,
}

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'de', name: 'German' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh', name: 'Chinese' },
  { code: 'hi', name: 'Hindi' },
  { code: 'ar', name: 'Arabic' },
  { code: 'ru', name: 'Russian' },
  { code: 'it', name: 'Italian' },
  { code: 'nl', name: 'Dutch' },
  { code: 'tr', name: 'Turkish' },
  { code: 'pl', name: 'Polish' },
]

export const DEFAULT_OVERLAY = {
  width: 1320,
  height: 980,
  opacity: 0.92,
  fontSize: 22,
}
