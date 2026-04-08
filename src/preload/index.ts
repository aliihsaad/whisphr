import { contextBridge, ipcRenderer } from 'electron'
import { IPC, ModelSelectionInfo } from '@shared/types'

// Expose a safe API to the renderer process
contextBridge.exposeInMainWorld('api', {
  // Session
  startSession: (sessionContext?: any) => ipcRenderer.invoke(IPC.START_SESSION, sessionContext),
  stopSession: () => ipcRenderer.invoke(IPC.STOP_SESSION),
  getSessions: () => ipcRenderer.invoke(IPC.GET_SESSIONS),
  getSessionDetail: (folderName: string) => ipcRenderer.invoke(IPC.GET_SESSION_DETAIL, folderName),
  deleteSession: (folderName: string) => ipcRenderer.invoke(IPC.DELETE_SESSION, folderName),
  exportSession: (folderName: string, format: 'md' | 'json') => ipcRenderer.invoke(IPC.EXPORT_SESSION, folderName, format),
  openSessionFolder: (folderName: string) => ipcRenderer.invoke(IPC.OPEN_SESSION_FOLDER, folderName),

  // LLM
  requestAnswer: (question?: string) => ipcRenderer.invoke(IPC.LLM_REQUEST, question),
  regenerateAnswer: () => ipcRenderer.invoke(IPC.LLM_REGENERATE),

  // Screen capture
  captureScreen: () => ipcRenderer.invoke(IPC.CAPTURE_SCREEN),

  // Context
  setContext: (context: any) => ipcRenderer.invoke(IPC.SET_CONTEXT, context),
  getContext: () => ipcRenderer.invoke(IPC.GET_CONTEXT),
  getProfile: () => ipcRenderer.invoke(IPC.GET_PROFILE),
  setProfile: (profile: any) => ipcRenderer.invoke(IPC.SET_PROFILE, profile),
  getLastSessionContext: () => ipcRenderer.invoke(IPC.GET_LAST_SESSION_CONTEXT),
  uploadResume: () => ipcRenderer.invoke('context:upload-resume'),
  listContextFolders: () => ipcRenderer.invoke(IPC.LIST_CONTEXT_FOLDERS),
  loadFileContext: (company?: string) => ipcRenderer.invoke(IPC.LOAD_FILE_CONTEXT, company),
  openContextFolder: () => ipcRenderer.invoke(IPC.OPEN_CONTEXT_FOLDER),
  openAppDataFolder: () => ipcRenderer.invoke(IPC.OPEN_APP_DATA_FOLDER),

  // Config
  getConfig: () => ipcRenderer.invoke(IPC.GET_CONFIG),
  setConfig: (config: any) => ipcRenderer.invoke(IPC.SET_CONFIG, config),

  // Window
  toggleOverlay: () => ipcRenderer.send(IPC.TOGGLE_OVERLAY),
  showOverlay: () => ipcRenderer.send(IPC.SHOW_OVERLAY),
  hideOverlay: () => ipcRenderer.send(IPC.HIDE_OVERLAY),
  toggleAnswerWindow: () => ipcRenderer.send(IPC.TOGGLE_ANSWER_WINDOW),
  hideAnswerWindow: () => ipcRenderer.send(IPC.HIDE_ANSWER_WINDOW),
  resizeOverlay: (width: number, height: number) => ipcRenderer.invoke(IPC.RESIZE_OVERLAY, width, height),
  getAnswerWindowBounds: () => ipcRenderer.invoke(IPC.GET_ANSWER_WINDOW_BOUNDS),
  setAnswerWindowBounds: (bounds: { x?: number; y?: number; width?: number; height?: number }) =>
    ipcRenderer.invoke(IPC.SET_ANSWER_WINDOW_BOUNDS, bounds),

  // Preview window
  togglePreviewWindow: () => ipcRenderer.send(IPC.TOGGLE_PREVIEW_WINDOW),
  hidePreviewWindow: () => ipcRenderer.send(IPC.HIDE_PREVIEW_WINDOW),
  getPreviewWindowBounds: () => ipcRenderer.invoke(IPC.GET_PREVIEW_WINDOW_BOUNDS),
  setPreviewWindowBounds: (bounds: { x?: number; y?: number; width?: number; height?: number }) =>
    ipcRenderer.invoke(IPC.SET_PREVIEW_WINDOW_BOUNDS, bounds),
  convertPdfToMarkdown: (pdfBase64: string, filename: string) =>
    ipcRenderer.invoke(IPC.CONVERT_PDF_TO_MARKDOWN, pdfBase64, filename),

  // Content protection & settings
  setContentProtection: (enabled: boolean) => ipcRenderer.send(IPC.SET_CONTENT_PROTECTION, enabled),
  openSettings: () => ipcRenderer.send(IPC.OPEN_SETTINGS),

  // Shell
  openExternal: (url: string) => ipcRenderer.invoke(IPC.OPEN_EXTERNAL, url),

  // Updates
  checkForUpdates: () => ipcRenderer.invoke(IPC.CHECK_FOR_UPDATES),
  onUpdateAvailable: (callback: (info: any) => void) => {
    const handler = (_event: any, info: any) => callback(info)
    ipcRenderer.on(IPC.UPDATE_AVAILABLE, handler)
    return () => ipcRenderer.removeListener(IPC.UPDATE_AVAILABLE, handler)
  },

  // Clipboard
  copyToClipboard: (text: string) => ipcRenderer.invoke('clipboard:write', text),

  // Audio - send chunks from renderer to main
  sendAudioChunk: (source: 'interviewer' | 'user', chunk: ArrayBuffer) => ipcRenderer.send('audio:chunk', source, chunk),

  // Event listeners
  onTranscriptUpdate: (callback: (entry: any) => void) => {
    const handler = (_event: any, entry: any) => callback(entry)
    ipcRenderer.on(IPC.TRANSCRIPT_UPDATE, handler)
    return () => ipcRenderer.removeListener(IPC.TRANSCRIPT_UPDATE, handler)
  },

  onAnswerQuestion: (callback: (question: string) => void) => {
    const handler = (_event: any, question: string) => callback(question)
    ipcRenderer.on(IPC.LLM_QUESTION, handler)
    return () => ipcRenderer.removeListener(IPC.LLM_QUESTION, handler)
  },

  onAnswerModelSelection: (callback: (selection: ModelSelectionInfo) => void) => {
    const handler = (_event: any, selection: ModelSelectionInfo) => callback(selection)
    ipcRenderer.on(IPC.LLM_MODEL_SELECTION, handler)
    return () => ipcRenderer.removeListener(IPC.LLM_MODEL_SELECTION, handler)
  },

  onAnswerChunk: (callback: (answer: string) => void) => {
    const handler = (_event: any, answer: string) => callback(answer)
    ipcRenderer.on(IPC.LLM_RESPONSE_CHUNK, handler)
    return () => ipcRenderer.removeListener(IPC.LLM_RESPONSE_CHUNK, handler)
  },

  onAnswerDone: (callback: (answer: string) => void) => {
    const handler = (_event: any, answer: string) => callback(answer)
    ipcRenderer.on(IPC.LLM_RESPONSE_DONE, handler)
    return () => ipcRenderer.removeListener(IPC.LLM_RESPONSE_DONE, handler)
  },

  onSessionState: (callback: (state: any) => void) => {
    const handler = (_event: any, state: any) => callback(state)
    ipcRenderer.on(IPC.SESSION_STATE, handler)
    return () => ipcRenderer.removeListener(IPC.SESSION_STATE, handler)
  },

  onShortcutToggleSession: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('shortcut:toggle-session', handler)
    return () => ipcRenderer.removeListener('shortcut:toggle-session', handler)
  },

  onShortcutCaptureScreen: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('shortcut:capture-screen', handler)
    return () => ipcRenderer.removeListener('shortcut:capture-screen', handler)
  },

  onShortcutRegenerate: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('shortcut:regenerate', handler)
    return () => ipcRenderer.removeListener('shortcut:regenerate', handler)
  },

  onSttReconnecting: (callback: (reconnecting: boolean) => void) => {
    const handler = (_event: any, reconnecting: boolean) => callback(reconnecting)
    ipcRenderer.on('stt:reconnecting', handler)
    return () => ipcRenderer.removeListener('stt:reconnecting', handler)
  },

  onSttReconnectError: (callback: (error: string) => void) => {
    const handler = (_event: any, error: string) => callback(error)
    ipcRenderer.on('stt:reconnect-error', handler)
    return () => ipcRenderer.removeListener('stt:reconnect-error', handler)
  },
})

// Type declaration for the exposed API
declare global {
  interface Window {
    api: {
      startSession: (sessionContext?: any) => Promise<any>
      stopSession: () => Promise<any>
      getSessions: () => Promise<any>
      getSessionDetail: (folderName: string) => Promise<any>
      deleteSession: (folderName: string) => Promise<boolean>
      exportSession: (folderName: string, format: 'md' | 'json') => Promise<string | null>
      openSessionFolder: (folderName: string) => Promise<any>
      requestAnswer: (question?: string) => Promise<any>
      regenerateAnswer: () => Promise<void>
      captureScreen: () => Promise<any>
      setContext: (context: any) => Promise<any>
      getContext: () => Promise<any>
      getProfile: () => Promise<any>
      setProfile: (profile: any) => Promise<any>
      getLastSessionContext: () => Promise<any>
      uploadResume: () => Promise<any>
      listContextFolders: () => Promise<string[]>
      loadFileContext: (company?: string) => Promise<{ content: string; files: string[]; warnings: string[] }>
      openContextFolder: () => Promise<any>
      openAppDataFolder: () => Promise<any>
      getConfig: () => Promise<any>
      setConfig: (config: any) => Promise<any>
      toggleOverlay: () => void
      showOverlay: () => void
      hideOverlay: () => void
      toggleAnswerWindow: () => void
      hideAnswerWindow: () => void
      resizeOverlay: (width: number, height: number) => Promise<any>
      getAnswerWindowBounds: () => Promise<{ x: number; y: number; width: number; height: number } | null>
      setAnswerWindowBounds: (bounds: { x?: number; y?: number; width?: number; height?: number }) => Promise<any>
      togglePreviewWindow: () => void
      hidePreviewWindow: () => void
      getPreviewWindowBounds: () => Promise<{ x: number; y: number; width: number; height: number } | null>
      setPreviewWindowBounds: (bounds: { x?: number; y?: number; width?: number; height?: number }) => Promise<any>
      convertPdfToMarkdown: (pdfBase64: string, filename: string) => Promise<string>
      copyToClipboard: (text: string) => void
      setContentProtection: (enabled: boolean) => void
      openSettings: () => void
      sendAudioChunk: (source: 'interviewer' | 'user', chunk: ArrayBuffer) => void
      onTranscriptUpdate: (callback: (entry: any) => void) => () => void
      onAnswerQuestion: (callback: (question: string) => void) => () => void
      onAnswerModelSelection: (callback: (selection: ModelSelectionInfo) => void) => () => void
      onAnswerChunk: (callback: (answer: string) => void) => () => void
      onAnswerDone: (callback: (answer: string) => void) => () => void
      onSessionState: (callback: (state: any) => void) => () => void
      onShortcutToggleSession: (callback: () => void) => () => void
      onShortcutCaptureScreen: (callback: () => void) => () => void
      onShortcutRegenerate: (callback: () => void) => () => void
      onSttReconnecting: (callback: (reconnecting: boolean) => void) => () => void
      onSttReconnectError: (callback: (error: string) => void) => () => void
    }
  }
}
