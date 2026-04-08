import ElectronStore from 'electron-store'
const Store = (ElectronStore as any).default || ElectronStore
import { ProfileContext, SessionContext, UserContext, SessionRecord, SessionSummary, TranscriptEntry, AnswerSnapshot, InterviewType } from '@shared/types'
import { app, shell } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

const store = new Store({
  name: 'interview-context',
  defaults: {
    contexts: {} as Record<string, any>,
    activeContextId: 'default',
    profile: {
      name: '',
      resume: '',
      jobDescription: '',
      skillsSummary: '',
      preferredAnswerStyle: '',
      extraInstructions: '',
    } as ProfileContext,
    lastSessionContext: null as SessionContext | null,
  },
})

const defaultProfile: ProfileContext = {
  name: '',
  resume: '',
  jobDescription: '',
  skillsSummary: '',
  preferredAnswerStyle: '',
  extraInstructions: '',
}

const defaultSessionContext: SessionContext = {
  companyName: '',
  roleName: '',
  interviewType: 'general',
  subject: '',
  sessionNotes: '',
}

export class ContextManager {
  private sessionContext: SessionContext | null = null

  /** Strip path separators and parent-directory references to prevent path traversal */
  private sanitizeFolderName(folderName: string): string {
    return path.basename(folderName).replace(/\.\./g, '')
  }

  getProfile(): ProfileContext {
    const profile = store.get('profile') as ProfileContext | undefined
    if (!profile) {
      // Migrate from old context format
      const contexts = store.get('contexts') as Record<string, any> | undefined
      const activeId = store.get('activeContextId', 'default') as string
      const oldCtx = contexts?.[activeId]
      if (oldCtx) {
        const migrated: ProfileContext = {
          name: '',
          resume: oldCtx.resume || '',
          jobDescription: oldCtx.jobDescription || '',
          skillsSummary: '',
          preferredAnswerStyle: '',
          extraInstructions: oldCtx.extraInstructions || '',
        }
        store.set('profile', migrated)
        // Migrate company/role to lastSessionContext
        if (oldCtx.companyName || oldCtx.roleName) {
          store.set('lastSessionContext', {
            ...defaultSessionContext,
            companyName: oldCtx.companyName || '',
            roleName: oldCtx.roleName || '',
          })
        }
        return migrated
      }
      return { ...defaultProfile }
    }
    return profile
  }

  setProfile(profile: ProfileContext): void {
    store.set('profile', profile)
  }

  getSessionContext(): SessionContext {
    return this.sessionContext || { ...defaultSessionContext }
  }

  setSessionContext(ctx: SessionContext): void {
    this.sessionContext = ctx
    // Persist as last session context for pre-filling next time
    store.set('lastSessionContext', ctx)
  }

  clearSessionContext(): void {
    this.sessionContext = null
  }

  getLastSessionContext(): SessionContext {
    const last = store.get('lastSessionContext') as SessionContext | null
    return last || { ...defaultSessionContext }
  }

  // Merged view — all existing call sites keep working
  getContext(): UserContext {
    const profile = this.getProfile()
    const session = this.getSessionContext()
    return {
      resume: profile.resume,
      jobDescription: profile.jobDescription,
      extraInstructions: profile.extraInstructions,
      companyName: session.companyName,
      roleName: session.roleName,
      name: profile.name,
      skillsSummary: profile.skillsSummary,
      preferredAnswerStyle: profile.preferredAnswerStyle,
      interviewType: session.interviewType,
      subject: session.subject,
      sessionNotes: session.sessionNotes,
    }
  }

  // Legacy setContext for backward compat
  setContext(context: Partial<UserContext>): void {
    const profile = this.getProfile()
    if (context.resume !== undefined) profile.resume = context.resume
    if (context.jobDescription !== undefined) profile.jobDescription = context.jobDescription
    if (context.extraInstructions !== undefined) profile.extraInstructions = context.extraInstructions
    if (context.name !== undefined) profile.name = context.name
    if (context.skillsSummary !== undefined) profile.skillsSummary = context.skillsSummary
    if (context.preferredAnswerStyle !== undefined) profile.preferredAnswerStyle = context.preferredAnswerStyle
    this.setProfile(profile)
  }

  // ── File Context System ────────────────────────────────────

  private static readonly MAX_FILE_SIZE = 50 * 1024 // 50KB per file
  private static readonly MAX_TOTAL_CONTEXT = 200 * 1024 // 200KB total
  private static readonly SUPPORTED_EXTENSIONS = new Set(['.md', '.txt', '.text'])

  getAppDataPath(): string {
    return app.getPath('userData')
  }

  /** Ensure required folder structure exists */
  initFolders(): void {
    const base = this.getAppDataPath()
    const dirs = [
      path.join(base, 'profile'),
      path.join(base, 'context', '_global'),
      path.join(base, 'sessions'),
    ]
    for (const dir of dirs) {
      fs.mkdirSync(dir, { recursive: true })
    }
  }

  /** List subfolders in context/ (excluding _global) */
  listContextFolders(): string[] {
    const contextDir = path.join(this.getAppDataPath(), 'context')
    if (!fs.existsSync(contextDir)) return []

    return fs
      .readdirSync(contextDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name !== '_global')
      .map((entry) => entry.name)
      .sort()
  }

  /** Load all context files from _global/ and optionally a company folder */
  loadFileContext(company?: string): { content: string; files: string[]; warnings: string[] } {
    const contextDir = path.join(this.getAppDataPath(), 'context')
    const warnings: string[] = []
    const loadedFiles: string[] = []
    let totalSize = 0
    const parts: string[] = []

    const loadFolder = (folderPath: string, label: string): void => {
      if (!fs.existsSync(folderPath)) return

      const files = fs
        .readdirSync(folderPath, { withFileTypes: true })
        .filter((f) => f.isFile() && ContextManager.SUPPORTED_EXTENSIONS.has(path.extname(f.name).toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name))

      for (const file of files) {
        const filePath = path.join(folderPath, file.name)
        const stat = fs.statSync(filePath)

        if (stat.size > ContextManager.MAX_FILE_SIZE) {
          warnings.push(`Skipped ${label}/${file.name} (${Math.round(stat.size / 1024)}KB > 50KB limit)`)
          continue
        }

        if (totalSize + stat.size > ContextManager.MAX_TOTAL_CONTEXT) {
          warnings.push(`Skipped ${label}/${file.name} — total context limit (200KB) reached`)
          continue
        }

        const content = fs.readFileSync(filePath, 'utf-8').trim()
        if (content) {
          parts.push(`--- ${label}/${file.name} ---\n${content}`)
          loadedFiles.push(`${label}/${file.name}`)
          totalSize += stat.size
        }
      }
    }

    // Always load _global
    loadFolder(path.join(contextDir, '_global'), '_global')

    // Load company-specific folder if provided
    if (company) {
      const slug = company.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      if (slug) {
        const companyDir = path.join(contextDir, slug)
        // Auto-create company folder so user can drop files in
        if (!fs.existsSync(companyDir)) {
          fs.mkdirSync(companyDir, { recursive: true })
        }
        loadFolder(companyDir, slug)
      }
    }

    if (warnings.length > 0) {
      console.warn('[FileContext] Warnings:', warnings.join('; '))
    }

    return {
      content: parts.join('\n\n'),
      files: loadedFiles,
      warnings,
    }
  }

  openContextFolder(): void {
    const contextDir = path.join(this.getAppDataPath(), 'context')
    fs.mkdirSync(contextDir, { recursive: true })
    shell.openPath(contextDir)
  }

  openAppDataFolder(): void {
    shell.openPath(this.getAppDataPath())
  }

  // ── Session File System ────────────────────────────────────

  /** Generate a slugified folder name for a session */
  private sessionFolderName(startedAt: number, companyName?: string, roleName?: string): string {
    const date = new Date(startedAt).toISOString().slice(0, 10) // YYYY-MM-DD
    const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const parts = [date]
    if (companyName) parts.push(slugify(companyName))
    if (roleName) parts.push(slugify(roleName))
    return parts.join('_')
  }

  /** Save a session record to the filesystem */
  saveSession(record: SessionRecord): string {
    const sessionsDir = path.join(this.getAppDataPath(), 'sessions')
    const folderName = this.sessionFolderName(record.startedAt, record.companyName, record.roleName)
    const sessionDir = path.join(sessionsDir, folderName)
    fs.mkdirSync(sessionDir, { recursive: true })

    // Save session.json
    const sessionFile: SessionRecord & { folderName: string } = { ...record, folderName }
    fs.writeFileSync(path.join(sessionDir, 'session.json'), JSON.stringify(sessionFile, null, 2), 'utf-8')

    // Generate transcript.md
    const transcriptMd = this.buildTranscriptMd(record)
    fs.writeFileSync(path.join(sessionDir, 'transcript.md'), transcriptMd, 'utf-8')

    // Generate answers.md
    const answersMd = this.buildAnswersMd(record)
    fs.writeFileSync(path.join(sessionDir, 'answers.md'), answersMd, 'utf-8')

    return folderName
  }

  /** Save a screenshot to a session folder, returns the filename */
  saveScreenshot(folderName: string, imageBase64: string): string {
    folderName = this.sanitizeFolderName(folderName)
    const screenshotsDir = path.join(this.getAppDataPath(), 'sessions', folderName, 'screenshots')
    fs.mkdirSync(screenshotsDir, { recursive: true })

    const existing = fs.readdirSync(screenshotsDir).filter((f) => f.endsWith('.jpg'))
    const index = String(existing.length + 1).padStart(3, '0')
    const filename = `${index}.jpg`

    const buffer = Buffer.from(imageBase64, 'base64')
    fs.writeFileSync(path.join(screenshotsDir, filename), buffer)
    return filename
  }

  /** List all sessions from filesystem, sorted by date descending */
  listSessions(): SessionSummary[] {
    const sessionsDir = path.join(this.getAppDataPath(), 'sessions')
    if (!fs.existsSync(sessionsDir)) return []

    const folders = fs
      .readdirSync(sessionsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())

    const summaries: SessionSummary[] = []

    for (const folder of folders) {
      const sessionJsonPath = path.join(sessionsDir, folder.name, 'session.json')
      if (!fs.existsSync(sessionJsonPath)) continue

      try {
        const data = JSON.parse(fs.readFileSync(sessionJsonPath, 'utf-8')) as SessionRecord
        summaries.push({
          id: data.id,
          title: data.title,
          startedAt: data.startedAt,
          endedAt: data.endedAt,
          durationSeconds: data.durationSeconds,
          companyName: data.companyName,
          roleName: data.roleName,
          interviewType: data.interviewType,
          subject: data.subject,
          transcriptCount: data.transcript?.length ?? 0,
          answerCount: data.answers?.length ?? 0,
          folderName: folder.name,
        })
      } catch (err) {
        console.warn(`[Sessions] Failed to read ${folder.name}/session.json:`, err)
      }
    }

    return summaries.sort((a, b) => b.startedAt - a.startedAt)
  }

  /** Load full session detail from filesystem */
  getSessionDetail(folderName: string): SessionRecord | null {
    folderName = this.sanitizeFolderName(folderName)
    const sessionJsonPath = path.join(this.getAppDataPath(), 'sessions', folderName, 'session.json')
    if (!fs.existsSync(sessionJsonPath)) return null

    try {
      return JSON.parse(fs.readFileSync(sessionJsonPath, 'utf-8')) as SessionRecord
    } catch {
      return null
    }
  }

  /** Delete a session folder */
  deleteSession(folderName: string): boolean {
    folderName = this.sanitizeFolderName(folderName)
    const sessionDir = path.join(this.getAppDataPath(), 'sessions', folderName)
    if (!fs.existsSync(sessionDir)) return false

    fs.rmSync(sessionDir, { recursive: true, force: true })
    return true
  }

  /** Export session as markdown, returns the file path */
  exportSession(folderName: string, format: 'md' | 'json'): string | null {
    folderName = this.sanitizeFolderName(folderName)
    const sessionDir = path.join(this.getAppDataPath(), 'sessions', folderName)
    if (!fs.existsSync(sessionDir)) return null

    if (format === 'json') {
      const jsonPath = path.join(sessionDir, 'session.json')
      return fs.existsSync(jsonPath) ? jsonPath : null
    }

    // For md, return transcript.md path (generate if missing)
    const mdPath = path.join(sessionDir, 'transcript.md')
    if (!fs.existsSync(mdPath)) {
      const record = this.getSessionDetail(folderName)
      if (!record) return null
      fs.writeFileSync(mdPath, this.buildTranscriptMd(record), 'utf-8')
    }
    return mdPath
  }

  /** Open a session folder in Explorer */
  openSessionFolder(folderName: string): void {
    folderName = this.sanitizeFolderName(folderName)
    const sessionDir = path.join(this.getAppDataPath(), 'sessions', folderName)
    if (fs.existsSync(sessionDir)) {
      shell.openPath(sessionDir)
    }
  }

  /** Migrate sessions from electron-store to filesystem */
  migrateSessionsFromStore(sessionStore: any): void {
    const sessionsDir = path.join(this.getAppDataPath(), 'sessions')
    const existingFolders = fs.existsSync(sessionsDir)
      ? fs.readdirSync(sessionsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).length
      : 0

    // Only migrate if sessions/ is empty
    if (existingFolders > 0) return

    const sessions = sessionStore.get('sessions', []) as SessionRecord[]
    if (sessions.length === 0) return

    console.log(`[Migration] Migrating ${sessions.length} sessions from electron-store to filesystem...`)

    for (const record of sessions) {
      try {
        this.saveSession(record)
      } catch (err) {
        console.warn(`[Migration] Failed to migrate session ${record.id}:`, err)
      }
    }

    // Clear from electron-store after successful migration
    sessionStore.set('sessions', [])
    console.log('[Migration] Session migration complete')
  }

  private buildTranscriptMd(record: SessionRecord): string {
    const startDate = new Date(record.startedAt)
    const endDate = new Date(record.endedAt)
    const dateStr = startDate.toISOString().slice(0, 10)
    const startTime = startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    const endTime = endDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    const durationMin = Math.round(record.durationSeconds / 60)

    const lines: string[] = [
      '# Interview Transcript',
      `**Company:** ${record.companyName || 'N/A'} | **Role:** ${record.roleName || 'N/A'} | **Type:** ${record.interviewType || 'general'}`,
      `**Date:** ${dateStr} ${startTime} – ${endTime} (${durationMin} min)`,
      '',
      '---',
      '',
    ]

    for (const entry of record.transcript) {
      const time = new Date(entry.timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      })
      const speaker = entry.speaker === 'user' ? 'You' : 'Interviewer'
      lines.push(`**[${time}] ${speaker}:**`)
      lines.push(entry.text)
      lines.push('')
    }

    return lines.join('\n')
  }

  private buildAnswersMd(record: SessionRecord): string {
    const lines: string[] = ['# Interview Answers', '']

    record.answers.forEach((answer, i) => {
      const time = new Date(answer.timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      })
      lines.push(`## Q${i + 1} — ${answer.question}`)
      lines.push(`**Time:** ${time}`)
      if (answer.modelId) {
        lines.push(`**Model:** ${answer.modelId}`)
      }
      if (answer.routingReason) {
        lines.push(`**Route:** ${answer.routingReason}`)
      }
      lines.push('')
      lines.push(answer.answer)
      lines.push('')
      lines.push('---')
      lines.push('')
    })

    return lines.join('\n')
  }

  /** Read raw resume file content. Returns text for TXT/MD, pdfBase64 for PDF. */
  readResumeFile(filePath: string): { text?: string; pdfBase64?: string; ext: string } {
    const ext = filePath.toLowerCase().split('.').pop() || ''

    if (ext === 'pdf') {
      const buffer = fs.readFileSync(filePath)
      return { pdfBase64: buffer.toString('base64'), ext }
    }

    if (ext === 'txt' || ext === 'md') {
      return { text: fs.readFileSync(filePath, 'utf-8'), ext }
    }

    throw new Error(`Unsupported file format: ${ext}`)
  }

  /** Save AI-structured resume markdown to profile folder */
  saveResumeMd(content: string): string {
    const resumePath = path.join(this.getAppDataPath(), 'profile', 'resume.md')
    fs.mkdirSync(path.dirname(resumePath), { recursive: true })
    fs.writeFileSync(resumePath, content, 'utf-8')
    return resumePath
  }
}
