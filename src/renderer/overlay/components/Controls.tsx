import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Sparkles,
  Monitor,
  Mic,
  MicOff,
  MessageSquare,
  Play,
  Square,
  GripVertical,
  Menu,
  X,
  Settings,
  ChevronRight,
  Zap,
  ZapOff,
  Eye,
  EyeOff,
  Globe,
  LogOut,
  Minus,
  ChevronDown,
  ChevronUp,
  Check,
  Send,
  Code,
  FileText,
} from 'lucide-react'
import { SUPPORTED_LANGUAGES } from '@shared/constants'

interface ControlsProps {
  isSessionActive: boolean
  sessionLabel: string
  autoAnswerEnabled: boolean
  micEnabled: boolean
  showAnswerPane: boolean
  showTranscript: boolean
  onStartStop: () => void
  onAnswerNow: () => void
  onCaptureScreen: () => void
  onToggleMic: () => void
  onToggleAutoAnswers: () => void
  onToggleTranscript: () => void
  onToggleAnswerPane: () => void
  onSendQuestion: (question: string) => void
  onMinimize: () => void
  onHeightChange?: (height: number) => void
}

export default function Controls({
  isSessionActive,
  sessionLabel,
  autoAnswerEnabled,
  micEnabled,
  showAnswerPane,
  showTranscript,
  onStartStop,
  onAnswerNow,
  onCaptureScreen,
  onToggleMic,
  onToggleAutoAnswers,
  onToggleTranscript,
  onToggleAnswerPane,
  onSendQuestion,
  onMinimize,
  onHeightChange,
}: ControlsProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const [chatInputOpen, setChatInputOpen] = useState(false)
  const [chatMessage, setChatMessage] = useState('')
  const [contentProtection, setContentProtection] = useState(true)
  const [autoModelSelection, setAutoModelSelection] = useState(false)
  const [sttLanguage, setSttLanguage] = useState('en')
  const [sttReconnecting, setSttReconnecting] = useState(false)
  const [confirmExit, setConfirmExit] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<HTMLInputElement>(null)

  // Load initial config
  useEffect(() => {
    void window.api.getConfig().then((config: any) => {
      if (config?.contentProtection !== undefined) setContentProtection(config.contentProtection)
      if (config?.autoModelSelection !== undefined) setAutoModelSelection(config.autoModelSelection)
      if (config?.sttLanguage) setSttLanguage(config.sttLanguage)
    })
  }, [])

  // Listen for STT reconnection status
  useEffect(() => {
    const cleanupReconnecting = window.api.onSttReconnecting(setSttReconnecting)
    const cleanupError = window.api.onSttReconnectError((error) => {
      console.error('[STT] Reconnection failed:', error)
    })
    return () => { cleanupReconnecting(); cleanupError() }
  }, [])

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
        setLangOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  // Notify parent of required height so it can resize the overlay window
  useEffect(() => {
    const base = confirmExit ? 420 : chatInputOpen ? 370 : 320
    const targetHeight = langOpen ? 560 : menuOpen ? 470 : base
    onHeightChange?.(targetHeight)
  }, [langOpen, menuOpen, chatInputOpen, confirmExit])

  // Focus input when chat opens
  useEffect(() => {
    if (chatInputOpen) {
      setTimeout(() => chatInputRef.current?.focus(), 50)
    }
  }, [chatInputOpen])

  const handleToggleProtection = useCallback(() => {
    const next = !contentProtection
    setContentProtection(next)
    window.api.setContentProtection(next)
  }, [contentProtection])

  const handleToggleAutoModel = useCallback(async () => {
    const next = !autoModelSelection
    setAutoModelSelection(next)
    await window.api.setConfig({ autoModelSelection: next })
  }, [autoModelSelection])

  const handleLanguageChange = useCallback(async (code: string) => {
    setSttLanguage(code)
    setLangOpen(false)
    await window.api.setConfig({ sttLanguage: code })
  }, [])

  const handleOpenSettings = useCallback(() => {
    setMenuOpen(false)
    window.api.openSettings()
  }, [])

  const handleExit = useCallback(() => {
    if (isSessionActive) {
      setConfirmExit(true)
      return
    }
    setMenuOpen(false)
    window.api.hideOverlay()
  }, [isSessionActive])

  const handleConfirmExit = useCallback(async (endSession: boolean) => {
    setConfirmExit(false)
    setMenuOpen(false)
    if (endSession) {
      await window.api.stopSession()
    }
    window.api.hideOverlay()
  }, [])

  const handleSendChat = useCallback(() => {
    const trimmed = chatMessage.trim()
    if (!trimmed) return
    onSendQuestion(trimmed)
    setChatMessage('')
    setChatInputOpen(false)
  }, [chatMessage, onSendQuestion])

  const currentLangName = SUPPORTED_LANGUAGES.find((l) => l.code === sttLanguage)?.name || 'English'

  return (
    <div className="relative flex flex-col gap-0 overflow-visible">
    <div className="flex items-center gap-1 rounded-2xl border border-white/[0.06] bg-[rgba(12,14,18,0.82)] px-2 py-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-2xl">
      {/* Drag handle */}
      <div
        className="drag-handle flex cursor-grab items-center justify-center rounded-xl px-2 py-3 text-white/20 hover:bg-white/[0.04] hover:text-white/40 active:cursor-grabbing"
        title="Drag to move"
      >
        <GripVertical size={18} strokeWidth={2.5} />
      </div>

      {/* Mic toggle */}
      <button
        onClick={onToggleMic}
        title={micEnabled ? 'Mute microphone' : 'Unmute microphone'}
        className={`no-drag relative flex items-center justify-center rounded-xl p-2.5 transition-all duration-150 ${
          micEnabled
            ? 'text-white/90 hover:bg-white/[0.06]'
            : 'text-white/40 hover:bg-white/[0.06]'
        }`}
      >
        {micEnabled ? <Mic size={16} strokeWidth={2} /> : <MicOff size={16} strokeWidth={2} />}
        {micEnabled && isSessionActive && (
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.7)]" />
        )}
      </button>

      {/* System audio indicator */}
      <div
        className="relative flex items-center justify-center rounded-xl p-2.5 text-white/50"
        title="System audio (always on)"
      >
        <Monitor size={16} strokeWidth={2} />
        <span
          className={`absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full transition-colors ${
            isSessionActive ? 'bg-emerald-400' : 'bg-white/20'
          }`}
        />
      </div>

      <div className="h-5 w-px shrink-0 bg-white/[0.06]" />

      {/* AI Answer */}
      <button
        onClick={onAnswerNow}
        disabled={!isSessionActive}
        title="Generate AI answer"
        className="no-drag flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-semibold text-white/70 transition-all duration-150 hover:bg-white/[0.05] hover:text-white/90 disabled:pointer-events-none disabled:opacity-30"
      >
        <Sparkles size={15} strokeWidth={2} />
        AI Answer
      </button>

      {/* Analyze Screen */}
      <button
        onClick={onCaptureScreen}
        disabled={!isSessionActive}
        title="Capture screen for analysis"
        className="no-drag flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-semibold text-white/70 transition-all duration-150 hover:bg-white/[0.05] hover:text-white/90 disabled:pointer-events-none disabled:opacity-30"
      >
        <Monitor size={15} strokeWidth={2} />
        Analyze Screen
      </button>

      {/* Chat input toggle */}
      <button
        onClick={() => { setChatInputOpen((v) => !v); setChatMessage('') }}
        disabled={!isSessionActive}
        title={chatInputOpen ? 'Cancel message' : 'Type a question'}
        className={`no-drag flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-semibold transition-all duration-150 disabled:pointer-events-none disabled:opacity-30 ${
          chatInputOpen
            ? 'bg-white/[0.08] text-white/90'
            : 'text-white/70 hover:bg-white/[0.05] hover:text-white/90'
        }`}
      >
        {chatInputOpen ? (
          <>Cancel</>
        ) : (
          <>
            <MessageSquare size={15} strokeWidth={2} />
            Chat
          </>
        )}
      </button>

      <div className="h-5 w-px shrink-0 bg-white/[0.06]" />

      {/* Start/Stop + Timer */}
      <button
        onClick={onStartStop}
        title={isSessionActive ? 'Stop session' : 'Start session'}
        className={`no-drag flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-semibold transition-all duration-150 ${
          isSessionActive
            ? 'text-white/80 hover:bg-white/[0.05]'
            : 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
        }`}
      >
        {isSessionActive ? (
          <Square size={14} strokeWidth={2} className="text-red-400" />
        ) : (
          <Play size={14} strokeWidth={2} />
        )}
        <span className="tabular-nums">{sessionLabel}</span>
      </button>

      <div className="h-5 w-px shrink-0 bg-white/[0.06]" />

      {/* Transcript toggle */}
      <button
        onClick={onToggleTranscript}
        title={showTranscript ? 'Hide transcript' : 'Show transcript'}
        className={`no-drag flex items-center justify-center rounded-xl p-2 transition-all duration-150 ${
          showTranscript
            ? 'bg-white/[0.08] text-white/80'
            : 'text-white/40 hover:bg-white/[0.05] hover:text-white/70'
        }`}
      >
        {showTranscript ? <ChevronUp size={16} strokeWidth={2} /> : <ChevronDown size={16} strokeWidth={2} />}
      </button>

      {/* Menu button + dropdown */}
      <div ref={menuRef} className="relative z-50">
        <button
          onClick={() => { setMenuOpen((v) => !v); setLangOpen(false) }}
          title="Menu"
          className={`no-drag flex items-center justify-center rounded-xl p-2 transition-all duration-150 ${
            menuOpen
              ? 'bg-white/[0.08] text-white/80'
              : 'text-white/40 hover:bg-white/[0.05] hover:text-white/70'
          }`}
        >
          {menuOpen ? <X size={16} strokeWidth={2} /> : <Menu size={16} strokeWidth={2} />}
        </button>

        {menuOpen && (
          <div className="no-drag absolute right-0 top-full z-50 mt-2 w-[220px] rounded-2xl border border-white/[0.06] bg-[rgba(12,14,18,0.95)] p-2 shadow-[0_16px_48px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
            {/* Dashboard / Settings */}
            <MenuButton
              icon={<Settings size={15} />}
              label="Dashboard"
              onClick={handleOpenSettings}
            />

            {/* Answers window toggle */}
            <MenuButton
              icon={<MessageSquare size={15} />}
              label={showAnswerPane ? 'Hide Answers' : 'Show Answers'}
              onClick={() => { onToggleAnswerPane(); setMenuOpen(false) }}
            />

            {/* Preview files */}
            <MenuButton
              icon={<FileText size={15} />}
              label="Preview Files"
              onClick={() => { window.api.togglePreviewWindow(); setMenuOpen(false) }}
            />

            <div className="my-1.5 h-px bg-white/[0.04]" />

            {/* Private toggle */}
            <MenuToggle
              icon={contentProtection ? <Eye size={15} /> : <EyeOff size={15} />}
              label="Private"
              checked={contentProtection}
              onChange={handleToggleProtection}
            />

            <div className="my-1.5 h-px bg-white/[0.04]" />

            {/* Language */}
            <div className="relative">
              <button
                onClick={() => setLangOpen((v) => !v)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] text-white/70 transition-all duration-150 hover:bg-white/[0.05] hover:text-white/90"
              >
                <Globe size={15} className={`shrink-0 ${sttReconnecting ? 'animate-spin text-cyan-400' : 'text-white/40'}`} />
                <span className="flex-1 text-left">{sttReconnecting ? 'Switching...' : currentLangName}</span>
                <ChevronRight size={13} className={`text-white/20 transition-transform ${langOpen ? 'rotate-90' : ''}`} />
              </button>

              {langOpen && (
                <div className="absolute right-full top-0 z-[60] mr-2 max-h-[260px] w-[220px] overflow-y-auto rounded-2xl border border-white/[0.06] bg-[rgba(8,10,14,0.96)] p-1.5 shadow-[0_16px_48px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => void handleLanguageChange(lang.code)}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-[12px] transition-all duration-100 ${
                        sttLanguage === lang.code
                          ? 'bg-cyan-500/[0.08] text-cyan-400'
                          : 'text-white/60 hover:bg-white/[0.04] hover:text-white/80'
                      }`}
                    >
                      <span>{lang.name}</span>
                      {sttLanguage === lang.code && <Check size={12} />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Auto Generate */}
            <MenuToggle
              icon={autoAnswerEnabled ? <Zap size={15} /> : <ZapOff size={15} />}
              label="Auto Generate"
              checked={autoAnswerEnabled}
              onChange={() => { onToggleAutoAnswers(); }}
            />

            {/* Auto Model Selection */}
            <MenuToggle
              icon={<Code size={15} />}
              label="Code Model"
              checked={autoModelSelection}
              onChange={handleToggleAutoModel}
            />

            <div className="my-1.5 h-px bg-white/[0.04]" />

            {/* Exit */}
            <MenuButton
              icon={<X size={15} />}
              label="Exit"
              onClick={handleExit}
            />

            {/* End Session */}
            {isSessionActive && (
              <button
                onClick={() => { onStartStop(); setMenuOpen(false) }}
                className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] text-red-400/80 transition-all duration-150 hover:bg-red-500/[0.06] hover:text-red-400"
              >
                <Square size={15} className="shrink-0" />
                <span>End Session</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>

    {/* Chat input row */}
    {chatInputOpen && (
      <div className="mt-1.5 flex items-center gap-2 rounded-2xl border border-white/[0.06] bg-[rgba(12,14,18,0.82)] px-3 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-2xl">
        <input
          ref={chatInputRef}
          type="text"
          value={chatMessage}
          onChange={(e) => setChatMessage(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSendChat(); if (e.key === 'Escape') { setChatInputOpen(false); setChatMessage('') } }}
          placeholder="Enter a message"
          className="no-drag min-w-0 flex-1 bg-transparent text-[13px] text-white/90 placeholder-white/30 outline-none"
        />
        <button
          onClick={handleSendChat}
          disabled={!chatMessage.trim()}
          title="Send question"
          className="no-drag flex shrink-0 items-center justify-center rounded-lg p-1.5 text-white/40 transition-all duration-150 hover:text-white/80 disabled:opacity-30"
        >
          <Send size={15} strokeWidth={2} />
        </button>
      </div>
    )}

    {/* Exit confirmation modal */}
    {confirmExit && (
      <div className="mt-1.5 rounded-2xl border border-white/[0.06] bg-[rgba(12,14,18,0.95)] px-4 py-3 shadow-[0_16px_48px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
        <p className="mb-3 text-[13px] text-white/80">
          A session is currently live. What would you like to do?
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void handleConfirmExit(true)}
            className="flex-1 rounded-xl bg-red-500/15 px-3 py-2 text-[12px] font-semibold text-red-400 transition-all duration-150 hover:bg-red-500/25"
          >
            End Session & Exit
          </button>
          <button
            onClick={() => void handleConfirmExit(false)}
            className="flex-1 rounded-xl bg-white/[0.06] px-3 py-2 text-[12px] font-semibold text-white/70 transition-all duration-150 hover:bg-white/[0.1]"
          >
            Hide Only
          </button>
          <button
            onClick={() => setConfirmExit(false)}
            className="rounded-xl px-3 py-2 text-[12px] font-semibold text-white/40 transition-all duration-150 hover:text-white/70"
          >
            Cancel
          </button>
        </div>
      </div>
    )}
    </div>
  )
}

// --- Menu sub-components ---

function MenuButton({
  icon,
  label,
  right,
  onClick,
  disabled,
}: {
  icon: React.ReactNode
  label: string
  right?: React.ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] text-white/70 transition-all duration-150 hover:bg-white/[0.05] hover:text-white/90 disabled:pointer-events-none disabled:opacity-30"
    >
      <span className="shrink-0 text-white/40">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {right}
    </button>
  )
}

function MenuToggle({
  icon,
  label,
  checked,
  onChange,
}: {
  icon: React.ReactNode
  label: string
  checked: boolean
  onChange: () => void
}) {
  return (
    <button
      onClick={onChange}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] text-white/70 transition-all duration-150 hover:bg-white/[0.05]"
    >
      <span className="shrink-0 text-white/40">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      <div
        className={`h-[22px] w-[40px] rounded-full p-[2px] transition-colors duration-200 ${
          checked ? 'bg-cyan-500' : 'bg-white/10'
        }`}
      >
        <div
          className={`h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform duration-200 ${
            checked ? 'translate-x-[18px]' : 'translate-x-0'
          }`}
        />
      </div>
    </button>
  )
}
