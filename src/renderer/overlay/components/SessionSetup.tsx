import React, { useState, useEffect } from 'react'
import { Building2, Briefcase, BookOpen, StickyNote, ChevronDown, FolderOpen } from 'lucide-react'

interface SessionContext {
  companyName: string
  roleName: string
  interviewType: string
  subject: string
  sessionNotes: string
}

interface SessionSetupProps {
  onStart: (ctx: SessionContext) => void
  onSkip: () => void
  onCancel: () => void
}

const INTERVIEW_TYPES = [
  { value: 'general', label: 'General' },
  { value: 'behavioral', label: 'Behavioral' },
  { value: 'technical', label: 'Technical' },
  { value: 'coding', label: 'Coding' },
  { value: 'system-design', label: 'System Design' },
]

const inputClass =
  'w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-2 text-[12px] text-white/80 placeholder:text-white/20 focus:border-cyan-500/30 focus:outline-none focus:ring-1 focus:ring-cyan-500/10 transition-all'

export default function SessionSetup({ onStart, onSkip, onCancel }: SessionSetupProps) {
  const [companyName, setCompanyName] = useState('')
  const [roleName, setRoleName] = useState('')
  const [interviewType, setInterviewType] = useState('general')
  const [subject, setSubject] = useState('')
  const [sessionNotes, setSessionNotes] = useState('')
  const [contextFolders, setContextFolders] = useState<string[]>([])
  const [selectedContextFolder, setSelectedContextFolder] = useState('')
  const [contextFileCount, setContextFileCount] = useState<number | null>(null)

  useEffect(() => {
    window.api.getLastSessionContext().then((ctx: SessionContext | null) => {
      if (ctx) {
        setCompanyName(ctx.companyName || '')
        setRoleName(ctx.roleName || '')
        setInterviewType(ctx.interviewType || 'general')
        setSubject(ctx.subject || '')
        // Don't pre-fill session notes — those are per-session
      }
    })
    window.api.listContextFolders().then(setContextFolders)
  }, [])

  // Auto-select context folder when company name matches
  useEffect(() => {
    if (!companyName) {
      setSelectedContextFolder('')
      setContextFileCount(null)
      return
    }
    const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const match = contextFolders.find((f) => f === slug)
    setSelectedContextFolder(match || '')
  }, [companyName, contextFolders])

  // Load file count when folder is selected
  useEffect(() => {
    if (!selectedContextFolder) {
      setContextFileCount(null)
      return
    }
    window.api.loadFileContext(selectedContextFolder).then((result) => {
      setContextFileCount(result.files.length)
    })
  }, [selectedContextFolder])

  const handleStart = () => {
    onStart({ companyName, roleName, interviewType, subject, sessionNotes })
  }

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[rgba(12,14,18,0.88)] shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-2xl p-4 space-y-3">
      <p className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">Session Setup</p>

      {/* Company & Role */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="flex items-center gap-1 text-[10px] font-medium text-white/35 mb-1">
            <Building2 size={10} />
            Company
          </label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="e.g. Google"
            className={inputClass}
          />
        </div>
        <div>
          <label className="flex items-center gap-1 text-[10px] font-medium text-white/35 mb-1">
            <Briefcase size={10} />
            Role
          </label>
          <input
            type="text"
            value={roleName}
            onChange={(e) => setRoleName(e.target.value)}
            placeholder="e.g. Senior SWE"
            className={inputClass}
          />
        </div>
      </div>

      {/* Interview Type & Subject */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="flex items-center gap-1 text-[10px] font-medium text-white/35 mb-1">
            <BookOpen size={10} />
            Type
          </label>
          <div className="relative">
            <select
              value={interviewType}
              onChange={(e) => setInterviewType(e.target.value)}
              className={`${inputClass} appearance-none pr-7`}
            >
              {INTERVIEW_TYPES.map((t) => (
                <option key={t.value} value={t.value} className="bg-[#1a1c20] text-white/80">
                  {t.label}
                </option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none" />
          </div>
        </div>
        <div>
          <label className="flex items-center gap-1 text-[10px] font-medium text-white/35 mb-1">
            <BookOpen size={10} />
            Subject
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. React, APIs"
            className={inputClass}
          />
        </div>
      </div>

      {/* Session Notes */}
      <div>
        <label className="flex items-center gap-1 text-[10px] font-medium text-white/35 mb-1">
          <StickyNote size={10} />
          Session Notes
        </label>
        <textarea
          value={sessionNotes}
          onChange={(e) => setSessionNotes(e.target.value)}
          placeholder="Anything specific to this interview..."
          rows={2}
          className={`${inputClass} resize-none`}
        />
      </div>

      {/* Context Folder */}
      {contextFolders.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="flex items-center gap-1 text-[10px] font-medium text-white/35">
              <FolderOpen size={10} />
              Context Folder
            </label>
            <button
              onClick={() => window.api.openContextFolder()}
              className="text-[9px] text-cyan-400/50 hover:text-cyan-400/80 transition-colors"
            >
              Open folder
            </button>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <select
                value={selectedContextFolder}
                onChange={(e) => setSelectedContextFolder(e.target.value)}
                className={`${inputClass} appearance-none pr-7`}
              >
                <option value="" className="bg-[#1a1c20] text-white/80">
                  None (global only)
                </option>
                {contextFolders.map((folder) => (
                  <option key={folder} value={folder} className="bg-[#1a1c20] text-white/80">
                    {folder}
                  </option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none" />
            </div>
            {contextFileCount !== null && contextFileCount > 0 && (
              <span className="text-[10px] text-white/25 whitespace-nowrap">
                {contextFileCount} file{contextFileCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleStart}
          className="flex-1 rounded-lg bg-emerald-500/15 border border-emerald-500/20 py-2 text-[12px] font-semibold text-emerald-400 hover:bg-emerald-500/25 transition-all"
        >
          Start Session
        </button>
        <button
          onClick={onSkip}
          className="rounded-lg bg-white/[0.04] border border-white/[0.06] px-4 py-2 text-[12px] font-medium text-white/40 hover:text-white/60 hover:bg-white/[0.06] transition-all"
        >
          Skip
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-[12px] font-medium text-white/30 hover:text-white/50 transition-all"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
