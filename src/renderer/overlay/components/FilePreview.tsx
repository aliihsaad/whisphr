import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  X,
  Minus,
  Plus as PlusIcon,
  GripVertical,
  FileText,
  Loader2,
} from 'lucide-react'
import { formatAnswer } from './markdown-renderer'

const FONT_MIN = 14
const FONT_MAX = 28
const FONT_STEP = 2
const FONT_DEFAULT = 18

interface PreviewFile {
  id: string
  name: string
  content: string
  isConverting?: boolean
  isEmpty?: boolean
}

export default function FilePreview() {
  const [files, setFiles] = useState<PreviewFile[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [fontSize, setFontSize] = useState(FONT_DEFAULT)
  const [isDragOver, setIsDragOver] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const dragCounterRef = useRef(0)

  const resizeStateRef = useRef<{
    startX: number
    startY: number
    width: number
    height: number
  } | null>(null)

  // Keep refs in sync so drop handler avoids stale closures
  const filesRef = useRef(files)
  const activeTabIdRef = useRef(activeTabId)
  useEffect(() => { filesRef.current = files }, [files])
  useEffect(() => { activeTabIdRef.current = activeTabId }, [activeTabId])

  // Load persisted font size
  useEffect(() => {
    void window.api.getConfig().then((config: any) => {
      if (config?.answerFontSize) setFontSize(config.answerFontSize)
    })
  }, [])

  const adjustFont = useCallback((delta: number) => {
    setFontSize((prev) => {
      const next = Math.min(FONT_MAX, Math.max(FONT_MIN, prev + delta))
      void window.api.setConfig({ answerFontSize: next })
      return next
    })
  }, [])

  const activeFile = files.find((f) => f.id === activeTabId) || null

  const addFile = useCallback((name: string, content: string, isConverting?: boolean) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const newFile: PreviewFile = { id, name, content, isConverting }
    setFiles((prev) => [...prev, newFile])
    setActiveTabId(id)
    return id
  }, [])

  const updateFileContent = useCallback((id: string, content: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, content, isConverting: false } : f))
    )
  }, [])

  const closeTab = useCallback((id: string) => {
    setFiles((prev) => {
      const next = prev.filter((f) => f.id !== id)
      setActiveTabId((currentId) => {
        if (currentId !== id) return currentId
        return next.length > 0 ? next[next.length - 1].id : null
      })
      return next
    })
  }, [])

  const handleClose = useCallback(() => {
    window.api.hidePreviewWindow()
  }, [])

  const addEmptyTab = useCallback(() => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const emptyFile: PreviewFile = { id, name: 'New tab', content: '', isEmpty: true }
    setFiles((prev) => [...prev, emptyFile])
    setActiveTabId(id)
  }, [])

  // --- Shared file processing ---
  const processFile = useCallback(
    async (file: File, replaceTabId?: string | null): Promise<string | null> => {
      const ext = file.name.split('.').pop()?.toLowerCase() || ''

      if (ext === 'pdf') {
        const tabId = replaceTabId || addFile(file.name, '', true)
        if (replaceTabId) {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === replaceTabId ? { ...f, name: file.name, isEmpty: false, isConverting: true } : f
            )
          )
        }
        try {
          const arrayBuffer = await file.arrayBuffer()
          const base64 = btoa(
            new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
          )
          const markdown = await window.api.convertPdfToMarkdown(base64, file.name)
          updateFileContent(tabId, markdown)
        } catch (err: any) {
          updateFileContent(tabId, `Error converting PDF: ${err.message}`)
        }
        return tabId
      }

      // TXT / MD
      const text = await file.text()
      if (replaceTabId) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === replaceTabId ? { ...f, name: file.name, content: text, isEmpty: false } : f
          )
        )
        return replaceTabId
      }
      return addFile(file.name, text)
    },
    [addFile, updateFileContent]
  )

  // --- Drag and drop ---
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current++
    if (dragCounterRef.current === 1) {
      setIsDragOver(true)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) {
      setIsDragOver(false)
    }
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      dragCounterRef.current = 0
      setIsDragOver(false)

      const droppedFiles = Array.from(e.dataTransfer.files)
      const supported = droppedFiles.filter((f) => {
        const ext = f.name.split('.').pop()?.toLowerCase() || ''
        return ['txt', 'md', 'pdf'].includes(ext)
      })
      if (supported.length === 0) return

      // Check if we should replace the current empty tab
      const currentActiveId = activeTabIdRef.current
      const currentActiveFile = filesRef.current.find((f) => f.id === currentActiveId)
      let replaceId: string | null = currentActiveFile?.isEmpty ? currentActiveId : null

      for (const file of supported) {
        await processFile(file, replaceId)
        // Only replace the empty tab with the first file; rest become new tabs
        replaceId = null
      }
    },
    [processFile]
  )

  // Resize handling
  const handleResizeStart = useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault()
      event.stopPropagation()

      const bounds = await window.api.getPreviewWindowBounds()
      if (!bounds) return

      resizeStateRef.current = {
        startX: event.screenX,
        startY: event.screenY,
        width: bounds.width,
        height: bounds.height,
      }

      const handlePointerMove = (moveEvent: MouseEvent) => {
        const current = resizeStateRef.current
        if (!current) return
        void window.api.setPreviewWindowBounds({
          width: Math.max(500, current.width + (moveEvent.screenX - current.startX)),
          height: Math.max(400, current.height + (moveEvent.screenY - current.startY)),
        })
      }

      const handlePointerUp = () => {
        resizeStateRef.current = null
        window.removeEventListener('mousemove', handlePointerMove)
        window.removeEventListener('mouseup', handlePointerUp)
      }

      window.addEventListener('mousemove', handlePointerMove)
      window.addEventListener('mouseup', handlePointerUp)
    },
    []
  )

  // Scroll to top on tab switch
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [activeTabId])

  // Show the full-screen drag overlay only when dragging over a tab that has content
  const showDragOverlay = isDragOver && activeFile != null && !activeFile.isEmpty

  return (
    <div
      className="h-full w-full bg-transparent p-4 pt-3"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-[rgba(10,12,16,0.92)] shadow-[0_16px_64px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
        {/* Header - draggable */}
        <div className="drag-handle flex items-center justify-between border-b border-white/[0.04] bg-white/[0.02] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <FileText size={14} className="text-cyan-400/50" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-white/30">
              Preview
            </span>
          </div>

          <div className="no-drag flex items-center gap-2">
            <div className="flex items-center gap-0.5 rounded-lg bg-white/[0.04] px-1">
              <button
                onClick={() => adjustFont(-FONT_STEP)}
                disabled={fontSize <= FONT_MIN}
                className="rounded-md p-1.5 text-white/50 transition-colors hover:text-white/80 disabled:opacity-25"
                title="Decrease font size"
              >
                <Minus size={13} />
              </button>
              <span className="min-w-[28px] text-center text-[10px] font-medium text-white/40">
                {fontSize}
              </span>
              <button
                onClick={() => adjustFont(FONT_STEP)}
                disabled={fontSize >= FONT_MAX}
                className="rounded-md p-1.5 text-white/50 transition-colors hover:text-white/80 disabled:opacity-25"
                title="Increase font size"
              >
                <PlusIcon size={13} />
              </button>
            </div>
            <button
              onClick={handleClose}
              className="rounded-lg p-2 bg-white/[0.04] text-white/50 transition-colors hover:bg-white/[0.08] hover:text-white/80"
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tab bar */}
        {files.length > 0 && (
          <div className="flex items-center gap-0.5 overflow-x-auto border-b border-white/[0.04] bg-white/[0.01] px-3 py-1.5">
            {files.map((file) => (
              <button
                key={file.id}
                onClick={() => setActiveTabId(file.id)}
                className={`no-drag group flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all duration-150 ${
                  activeTabId === file.id
                    ? 'bg-cyan-500/[0.08] text-cyan-400 border border-cyan-500/[0.12]'
                    : 'text-white/50 hover:bg-white/[0.04] hover:text-white/70 border border-transparent'
                }`}
              >
                {file.isConverting && (
                  <Loader2 size={11} className="animate-spin text-cyan-400/60" />
                )}
                <span className="max-w-[120px] truncate">{file.name}</span>
                <span
                  onClick={(e) => {
                    e.stopPropagation()
                    closeTab(file.id)
                  }}
                  className="ml-0.5 rounded p-0.5 text-white/20 opacity-0 transition-all hover:bg-white/[0.06] hover:text-white/60 group-hover:opacity-100"
                >
                  <X size={10} />
                </span>
              </button>
            ))}
            <button
              onClick={addEmptyTab}
              className="no-drag flex shrink-0 items-center justify-center rounded-lg p-1.5 text-white/25 transition-all duration-150 hover:bg-white/[0.04] hover:text-white/50"
              title="New tab"
            >
              <PlusIcon size={14} />
            </button>
          </div>
        )}

        {/* Content area */}
        <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-y-auto">
          {!activeFile || activeFile.isEmpty ? (
            // Empty / new tab — drop zone
            <div className="flex h-full items-center justify-center p-8">
              <div
                className={`flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed p-12 transition-all duration-200 ${
                  isDragOver
                    ? 'border-cyan-400/40 bg-cyan-400/[0.04]'
                    : 'border-white/[0.08] bg-white/[0.01]'
                }`}
              >
                <FileText
                  size={40}
                  className={`transition-colors ${isDragOver ? 'text-cyan-400/50' : 'text-white/15'}`}
                />
                <div className="text-center">
                  <p className={`text-[14px] font-medium transition-colors ${isDragOver ? 'text-cyan-400/70' : 'text-white/40'}`}>
                    Drop files here
                  </p>
                  <p className="mt-1.5 text-[12px] text-white/25">
                    .txt, .md, or .pdf files
                  </p>
                </div>
              </div>
            </div>
          ) : activeFile.isConverting ? (
            <div className="flex h-full items-center justify-center p-8">
              <div className="flex flex-col items-center gap-3">
                <Loader2 size={28} className="animate-spin text-cyan-400/60" />
                <p className="text-[13px] font-medium text-white/40">Converting PDF...</p>
              </div>
            </div>
          ) : (
            <div className="px-6 py-5" style={{ fontSize: `${fontSize}px` }}>
              {formatAnswer(activeFile.content, fontSize, 'Empty file')}
            </div>
          )}

          {/* Full-window drag overlay — only when active tab has content */}
          {showDragOverlay && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-[rgba(10,12,16,0.85)] backdrop-blur-sm pointer-events-none">
              <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-cyan-400/40 bg-cyan-400/[0.04] p-10">
                <FileText size={36} className="text-cyan-400/50" />
                <p className="text-[14px] font-medium text-cyan-400/70">Drop to add files</p>
              </div>
            </div>
          )}
        </div>

        {/* Resize handle */}
        <button
          onMouseDown={handleResizeStart}
          className="no-drag absolute bottom-3 right-3 rounded-lg p-2 bg-white/[0.04] text-white/40 transition-colors hover:bg-white/[0.08] hover:text-white/60"
          title="Resize"
        >
          <GripVertical size={14} />
        </button>
      </div>
    </div>
  )
}
