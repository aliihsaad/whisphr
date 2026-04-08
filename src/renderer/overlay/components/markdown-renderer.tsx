import React, { useState, useCallback } from 'react'
import { Copy, Check } from 'lucide-react'

// --- Types ---

export interface AnswerBlock {
  type: 'text' | 'code' | 'heading' | 'bullet' | 'numbered'
  content: string
  language?: string
  level?: number
  number?: number
}

// --- Parsing logic ---

export function parseAnswerBlocks(text: string): AnswerBlock[] {
  const normalized = text.replace(/\r\n/g, '\n')
  const blocks: AnswerBlock[] = []
  const codeFenceRegex = /```([\w+-]*)\n([\s\S]*?)```/g

  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = codeFenceRegex.exec(normalized)) !== null) {
    const textBefore = normalized.slice(lastIndex, match.index)
    pushTextBlocks(blocks, textBefore)

    blocks.push({
      type: 'code',
      language: match[1] || undefined,
      content: match[2].trimEnd(),
    })

    lastIndex = match.index + match[0].length
  }

  pushTextBlocks(blocks, normalized.slice(lastIndex))
  return blocks
}

export function pushTextBlocks(blocks: AnswerBlock[], text: string): void {
  text.split('\n').forEach((rawLine) => {
    const line = rawLine.trim()
    if (!line) return

    // Headings: ### or ## or #
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/)
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        content: headingMatch[2],
      })
      return
    }

    // Numbered list: 1. or 2) etc
    const numberedMatch = line.match(/^(\d+)[.)]\s+(.+)$/)
    if (numberedMatch) {
      blocks.push({
        type: 'numbered',
        number: parseInt(numberedMatch[1], 10),
        content: numberedMatch[2],
      })
      return
    }

    // Bullet list: - or *  (only single * at start followed by space)
    if ((line.startsWith('- ') || line.startsWith('* ')) && !line.startsWith('**')) {
      blocks.push({
        type: 'bullet',
        content: line.slice(2),
      })
      return
    }

    // Regular text
    blocks.push({ type: 'text', content: line })
  })
}

// --- Inline formatting: bold, inline code, italic ---

export function renderInlineFormatting(text: string): React.ReactNode[] {
  // Pattern order matters: bold first (**), then inline code (`), then italic (single *)
  const inlineRegex = /(\*\*(.+?)\*\*)|(`([^`]+?)`)|(\*(.+?)\*)/g
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = inlineRegex.exec(text)) !== null) {
    // Text before this match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }

    if (match[1]) {
      // Bold: **text**
      parts.push(
        <span key={match.index} className="text-white font-bold">
          {match[2]}
        </span>
      )
    } else if (match[3]) {
      // Inline code: `code`
      parts.push(
        <code
          key={match.index}
          className="rounded-md bg-white/[0.07] border border-white/[0.06] px-1.5 py-0.5 text-[0.85em] font-mono text-emerald-300/80"
        >
          {match[4]}
        </code>
      )
    } else if (match[5]) {
      // Italic: *text*
      parts.push(
        <em key={match.index} className="text-white/70 italic">
          {match[6]}
        </em>
      )
    }

    lastIndex = match.index + match[0].length
  }

  // Remaining text after last match
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts.length > 0 ? parts : [text]
}

// --- Code block component ---

export function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await window.api.copyToClipboard(code)
    } catch {
      // Fallback to browser Clipboard API
      await navigator.clipboard.writeText(code)
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }, [code])

  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/40 my-1">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-cyan-400/50">
          {language || 'code'}
        </span>
        <button
          onClick={handleCopy}
          className="no-drag flex items-center gap-1 rounded-lg bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/50 transition-colors hover:bg-white/[0.08] hover:text-white/80"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="overflow-x-auto px-4 py-3">
        <pre className="m-0 text-[13px] font-mono leading-relaxed text-emerald-200/80">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  )
}

// --- Full render pipeline ---

export function formatAnswer(text: string, baseFontSize: number, emptyMessage?: string) {
  if (!text.trim()) {
    return <p className="text-white/25 leading-relaxed">{emptyMessage || 'Waiting for an answer...'}</p>
  }

  const blocks = parseAnswerBlocks(text)

  return (
    <div className="space-y-2">
      {blocks.map((block, index) => {
        if (block.type === 'code') {
          return <CodeBlock key={index} code={block.content} language={block.language} />
        }

        if (block.type === 'heading') {
          const headingScale = block.level === 1 ? 1.2 : block.level === 2 ? 1.1 : 1.0
          return (
            <div
              key={index}
              className="text-cyan-300/90 font-bold tracking-tight pt-2 pb-1"
              style={{ fontSize: `${Math.round(baseFontSize * headingScale)}px` }}
            >
              {renderInlineFormatting(block.content)}
            </div>
          )
        }

        if (block.type === 'bullet') {
          return (
            <div key={index} className="flex items-start gap-3 py-0.5">
              <span
                className="mt-[0.55em] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-cyan-400/50"
              />
              <span className="text-white/85 leading-[1.7] font-medium">
                {renderInlineFormatting(block.content)}
              </span>
            </div>
          )
        }

        if (block.type === 'numbered') {
          return (
            <div key={index} className="flex items-start gap-3 py-0.5">
              <span
                className="mt-[0.1em] flex-shrink-0 text-cyan-400/60 font-bold tabular-nums"
                style={{ fontSize: `${Math.round(baseFontSize * 0.85)}px`, minWidth: '1.5em', textAlign: 'right' }}
              >
                {block.number}.
              </span>
              <span className="text-white/85 leading-[1.7] font-medium">
                {renderInlineFormatting(block.content)}
              </span>
            </div>
          )
        }

        // Regular paragraph
        return (
          <p key={index} className="text-white/85 leading-[1.8] font-medium">
            {renderInlineFormatting(block.content)}
          </p>
        )
      })}
    </div>
  )
}
