import React, { useState, useEffect, useCallback } from 'react'
import { Upload, FileText, User, Lightbulb, MessageSquare, FolderOpen, RefreshCw, Check, AlertTriangle, Folder } from 'lucide-react'

const inputClass =
  'input-premium w-full rounded-xl bg-white/[0.025] border border-white/[0.06] px-4 py-2.5 text-[13px] text-white/80 placeholder:text-white/15 focus:border-cyan-500/25 focus:outline-none transition-all'

export default function ContextUpload() {
  const [name, setName] = useState('')
  const [resume, setResume] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [skillsSummary, setSkillsSummary] = useState('')
  const [preferredAnswerStyle, setPreferredAnswerStyle] = useState('')
  const [extraInstructions, setExtraInstructions] = useState('')
  const [saved, setSaved] = useState(false)
  const [resumeFile, setResumeFile] = useState('')
  const [contextFiles, setContextFiles] = useState<string[]>([])
  const [contextFolders, setContextFolders] = useState<string[]>([])
  const [contextWarnings, setContextWarnings] = useState<string[]>([])

  const loadContextFiles = useCallback(async () => {
    const folders = await window.api.listContextFolders()
    setContextFolders(folders)

    const globalResult = await window.api.loadFileContext()
    const allFiles = [...globalResult.files]
    const allWarnings = [...globalResult.warnings]

    for (const folder of folders) {
      const result = await window.api.loadFileContext(folder)
      const companyFiles = result.files.filter((f) => !f.startsWith('_global/'))
      allFiles.push(...companyFiles)
      allWarnings.push(...result.warnings.filter((w) => !globalResult.warnings.includes(w)))
    }

    setContextFiles(allFiles)
    setContextWarnings(allWarnings)
  }, [])

  useEffect(() => {
    loadProfile()
    loadContextFiles()
  }, [])

  const loadProfile = async () => {
    const profile = await window.api.getProfile()
    if (profile) {
      setName(profile.name || '')
      setResume(profile.resume || '')
      setJobDescription(profile.jobDescription || '')
      setSkillsSummary(profile.skillsSummary || '')
      setPreferredAnswerStyle(profile.preferredAnswerStyle || '')
      setExtraInstructions(profile.extraInstructions || '')
    }
  }

  const handleSave = async () => {
    await window.api.setProfile({
      name,
      resume,
      jobDescription,
      skillsSummary,
      preferredAnswerStyle,
      extraInstructions,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const [analyzing, setAnalyzing] = useState(false)

  const handleUploadResume = async () => {
    setAnalyzing(true)
    try {
      const result = await window.api.uploadResume()
      if (result) {
        setResume(result.text)
        setResumeFile(result.filePath)
      }
    } catch (err: any) {
      console.error('Resume upload failed:', err)
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h2 className="text-[18px] font-semibold text-white/90 tracking-tight">Profile</h2>
        <p className="text-[13px] text-white/35 mt-1">
          Your persistent profile — used across all interview sessions.
        </p>
      </div>

      {/* Profile Fields */}
      <div className="space-y-5">
        {/* Name */}
        <div>
          <label className="flex items-center gap-1.5 text-[11.5px] font-medium text-white/40 mb-2 uppercase tracking-wider">
            <User size={11} />
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className={inputClass}
          />
        </div>

        {/* Resume */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="flex items-center gap-1.5 text-[11.5px] font-medium text-white/40 uppercase tracking-wider">
              <FileText size={11} />
              Resume
            </label>
            <button
              onClick={handleUploadResume}
              disabled={analyzing}
              className={`flex items-center gap-1.5 text-[11px] font-medium rounded-lg px-2.5 py-1 transition-all btn-press ${
                analyzing
                  ? 'text-amber-400/70 bg-amber-400/[0.06]'
                  : 'text-cyan-400/70 hover:text-cyan-400 bg-cyan-400/[0.05] hover:bg-cyan-400/[0.08] border border-cyan-400/10'
              }`}
            >
              <Upload size={11} />
              {analyzing ? 'Analyzing...' : 'Upload PDF/TXT'}
            </button>
          </div>
          {resumeFile && (
            <p className="text-[10.5px] text-white/25 mb-2 font-mono truncate">
              {resumeFile}
            </p>
          )}
          <textarea
            value={resume}
            onChange={(e) => setResume(e.target.value)}
            placeholder="Paste your resume here or upload a file..."
            rows={6}
            className={`${inputClass} resize-y`}
          />
        </div>

        {/* Job Description */}
        <div>
          <label className="flex items-center gap-1.5 text-[11.5px] font-medium text-white/40 mb-2 uppercase tracking-wider">
            <FileText size={11} />
            Job Description
          </label>
          <textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the job description here..."
            rows={5}
            className={`${inputClass} resize-y`}
          />
        </div>

        {/* Skills Summary */}
        <div>
          <label className="flex items-center gap-1.5 text-[11.5px] font-medium text-white/40 mb-2 uppercase tracking-wider">
            <Lightbulb size={11} />
            Skills Summary
          </label>
          <textarea
            value={skillsSummary}
            onChange={(e) => setSkillsSummary(e.target.value)}
            placeholder="Key skills, technologies, and areas of expertise..."
            rows={3}
            className={`${inputClass} resize-y`}
          />
        </div>

        {/* Preferred Answer Style */}
        <div>
          <label className="flex items-center gap-1.5 text-[11.5px] font-medium text-white/40 mb-2 uppercase tracking-wider">
            <MessageSquare size={11} />
            Answer Style
          </label>
          <textarea
            value={preferredAnswerStyle}
            onChange={(e) => setPreferredAnswerStyle(e.target.value)}
            placeholder="e.g. concise and technical, storytelling with STAR format, casual tone..."
            rows={2}
            className={`${inputClass} resize-y`}
          />
        </div>

        {/* Extra Instructions */}
        <div>
          <label className="block text-[11.5px] font-medium text-white/40 mb-2 uppercase tracking-wider">
            Extra Instructions
          </label>
          <textarea
            value={extraInstructions}
            onChange={(e) => setExtraInstructions(e.target.value)}
            placeholder="Any extra context: your STAR stories, key projects, things to emphasize..."
            rows={4}
            className={`${inputClass} resize-y`}
          />
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        className={`w-full rounded-xl py-3.5 text-[13px] font-semibold transition-all duration-250 flex items-center justify-center gap-2 btn-press ${
          saved
            ? 'bg-emerald-500/12 text-emerald-400 border border-emerald-500/20 shadow-[0_0_20px_rgba(52,211,153,0.08)]'
            : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/15 hover:bg-cyan-500/15 hover:border-cyan-500/25 hover:shadow-[0_0_20px_rgba(34,211,238,0.08)]'
        }`}
      >
        {saved ? (
          <>
            <Check size={14} />
            Saved
          </>
        ) : (
          'Save Profile'
        )}
      </button>

      {/* File-based Context Section */}
      <div className="border-t border-white/[0.05] pt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Folder size={14} className="text-white/25" />
            <h3 className="text-[12px] font-semibold text-white/50 uppercase tracking-wider">
              Context Files
            </h3>
          </div>
          <button
            onClick={loadContextFiles}
            className="flex items-center gap-1.5 text-[10.5px] text-white/30 hover:text-white/60 transition-colors rounded-lg px-2 py-1 hover:bg-white/[0.03]"
            title="Refresh"
          >
            <RefreshCw size={10} />
            Refresh
          </button>
        </div>

        <p className="text-[11.5px] text-white/30 mb-4 leading-relaxed">
          Drop <code className="text-[10.5px] bg-white/[0.04] rounded px-1.5 py-0.5 text-white/45">.md</code> or <code className="text-[10.5px] bg-white/[0.04] rounded px-1.5 py-0.5 text-white/45">.txt</code> files
          into the context folder. Files in <code className="text-[10.5px] bg-white/[0.04] rounded px-1.5 py-0.5 text-white/45">_global/</code> always
          load. Company folders load when matched.
        </p>

        {/* Loaded Files */}
        {contextFiles.length > 0 && (
          <div className="rounded-2xl bg-white/[0.015] border border-white/[0.045] p-4 mb-3">
            <p className="text-[10.5px] font-semibold text-white/35 uppercase tracking-wider mb-3">
              {contextFiles.length} file{contextFiles.length !== 1 ? 's' : ''} found
            </p>
            <div className="space-y-1.5">
              {contextFiles.map((file) => (
                <div key={file} className="flex items-center gap-2 text-[11.5px] text-white/45">
                  <FileText size={10} className="shrink-0 text-white/20" />
                  <span className="truncate font-mono text-[10.5px]">{file}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Context Folders */}
        {contextFolders.length > 0 && (
          <div className="rounded-2xl bg-white/[0.015] border border-white/[0.045] p-4 mb-3">
            <p className="text-[10.5px] font-semibold text-white/35 uppercase tracking-wider mb-3">
              Company Folders
            </p>
            <div className="flex flex-wrap gap-2">
              {contextFolders.map((folder) => (
                <span
                  key={folder}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.04] border border-white/[0.04] px-2.5 py-1 text-[11px] text-white/45 font-medium"
                >
                  <FolderOpen size={10} className="text-white/25" />
                  {folder}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Warnings */}
        {contextWarnings.length > 0 && (
          <div className="rounded-2xl bg-amber-500/[0.04] border border-amber-500/10 p-4 mb-3">
            <div className="flex items-center gap-1.5 mb-2">
              <AlertTriangle size={11} className="text-amber-400/60" />
              <span className="text-[10.5px] font-semibold text-amber-400/50 uppercase tracking-wider">Warnings</span>
            </div>
            {contextWarnings.map((warning, i) => (
              <p key={i} className="text-[11px] text-amber-400/50 leading-relaxed">{warning}</p>
            ))}
          </div>
        )}

        {/* Folder Buttons */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => window.api.openContextFolder()}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-[12px] font-medium text-white/50 bg-white/[0.025] border border-white/[0.05] hover:bg-white/[0.045] hover:text-white/70 hover:border-white/[0.07] transition-all btn-press"
          >
            <FolderOpen size={13} />
            Context Folder
          </button>
          <button
            onClick={() => window.api.openAppDataFolder()}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-[12px] font-medium text-white/50 bg-white/[0.025] border border-white/[0.05] hover:bg-white/[0.045] hover:text-white/70 hover:border-white/[0.07] transition-all btn-press"
          >
            <FolderOpen size={13} />
            App Data
          </button>
        </div>
      </div>
    </div>
  )
}
