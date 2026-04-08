import { EventEmitter } from 'events'
import { OPENROUTER_BASE_URL } from '@shared/constants'
import { LLMRequest, TranscriptEntry, UserContext, ProfileContext, SessionContext } from '@shared/types'
import {
  buildSystemPrompt,
  buildQuestionPrompt,
  buildScreenCapturePrompt,
  buildQuestionNormalizationPrompt,
  buildResumeAnalysisPrompt,
} from '@shared/prompts'

export class LLMService extends EventEmitter {
  private apiKey: string
  private model: string
  private abortController: AbortController | null = null
  private readonly incompleteQuestionToken = 'WAITING_FOR_MORE_CONTEXT'

  constructor(apiKey: string, model: string) {
    super()
    this.apiKey = apiKey
    this.model = model
  }

  setModel(model: string): void {
    this.model = model
  }

  async generateAnswer(request: LLMRequest): Promise<void> {
    this.abort()
    this.abortController = new AbortController()

    const systemPrompt = buildSystemPrompt(request.userContext, request.interviewType, request.fileContext, request.answerLanguage)
    const userPrompt = buildQuestionPrompt(request.question)

    const messages: Array<{ role: string; content: any }> = [
      { role: 'system', content: systemPrompt },
    ]

    // Add previous Q&A pairs so the LLM has conversation memory
    if (request.answerHistory && request.answerHistory.length > 0) {
      // Include last 10 Q&A pairs to stay within context limits
      const recentAnswers = request.answerHistory.slice(-10)
      for (const snapshot of recentAnswers) {
        messages.push({ role: 'user', content: snapshot.question })
        messages.push({ role: 'assistant', content: snapshot.answer })
      }
    }

    // Add recent transcript fragments for speech context
    const recentHistory = request.conversationHistory
      .filter((e) => e.isFinal)
      .slice(-10)

    for (const entry of recentHistory) {
      messages.push({
        role: entry.speaker === 'user' ? 'assistant' : 'user',
        content: entry.text,
      })
    }

    messages.push({ role: 'user', content: userPrompt })

    await this.callOpenRouter(messages, 0.7, 1024)
  }

  async analyzeScreenshot(imageBase64: string, context: UserContext | ProfileContext, session?: SessionContext, answerLanguage?: string): Promise<void> {
    this.abort()
    this.abortController = new AbortController()

    const systemPrompt = session
      ? buildSystemPrompt(context as ProfileContext, { ...session, interviewType: 'coding' }, undefined, answerLanguage)
      : buildSystemPrompt(context as UserContext, 'coding', undefined, answerLanguage)

    const messages = [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: buildScreenCapturePrompt() },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/png;base64,${imageBase64}`,
            },
          },
        ],
      },
    ]

    await this.callOpenRouter(messages, 0.3, 2048)
  }

  async normalizeQuestion(question: string, conversationHistory: TranscriptEntry[]): Promise<string> {
    const recentTranscript = conversationHistory
      .filter((entry) => entry.isFinal && entry.speaker === 'interviewer')
      .slice(-4)
      .map((entry) => entry.text.trim())
      .join('\n')

    const response = await this.callOpenRouterOnce(
      [
        {
          role: 'system',
          content: 'You rewrite noisy interviewer transcripts into one clean question. Output only the question text.',
        },
        {
          role: 'user',
          content: buildQuestionNormalizationPrompt(question, recentTranscript),
        },
      ],
      0.1,
      96
    )

    return response.trim()
  }

  async analyzeResume(content: { text?: string; pdfBase64?: string }): Promise<string> {
    const prompt = buildResumeAnalysisPrompt()
    const userContent: any[] = []

    if (content.pdfBase64) {
      // Send PDF as document via data URL with application/pdf mime type
      userContent.push({ type: 'text', text: prompt })
      userContent.push({
        type: 'image_url',
        image_url: { url: `data:application/pdf;base64,${content.pdfBase64}` },
      })
    } else if (content.text) {
      userContent.push({ type: 'text', text: `${prompt}\n\n---\n\nRaw resume text:\n\n${content.text}` })
    } else {
      throw new Error('No resume content provided')
    }

    return this.callOpenRouterOnce(
      [
        { role: 'system', content: 'You structure resumes into clean markdown for an AI interview assistant.' },
        { role: 'user', content: userContent },
      ],
      0.2,
      4096
    )
  }

  private async callOpenRouter(
    messages: Array<{ role: string; content: any }>,
    temperature: number,
    maxTokens: number
  ): Promise<void> {
    try {
      const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost',
          'X-Title': 'My Notes',
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: true,
          temperature,
          max_tokens: maxTokens,
        }),
        signal: this.abortController!.signal,
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`[LLM] API error ${response.status}:`, errorText)
        throw new Error(`OpenRouter error ${response.status}: ${errorText}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body reader')

      const decoder = new TextDecoder()
      let fullAnswer = ''
      let lineBuffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        lineBuffer += decoder.decode(value, { stream: true })
        const lines = lineBuffer.split('\n')
        lineBuffer = lines.pop() || '' // Keep incomplete last line for next iteration

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') {
            this.emitFinalAnswer(fullAnswer)
            return
          }

          try {
            const parsed = JSON.parse(data)
            const content = parsed.choices?.[0]?.delta?.content
            if (content) {
              fullAnswer += content
              this.emit('chunk', content, fullAnswer)
            }
          } catch {
            // Skip malformed JSON chunks
          }
        }
      }

      this.emitFinalAnswer(fullAnswer)
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('[LLM] Generation aborted')
        return
      }
      console.error('[LLM] Error:', error.message)
      this.emit('error', error)
    }
  }

  private async callOpenRouterOnce(
    messages: Array<{ role: string; content: any }>,
    temperature: number,
    maxTokens: number
  ): Promise<string> {
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost',
        'X-Title': 'My Notes',
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: false,
        temperature,
        max_tokens: maxTokens,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenRouter error ${response.status}: ${errorText}`)
    }

    const parsed = await response.json()
    return parsed.choices?.[0]?.message?.content?.trim?.() || ''
  }

  async convertPdfToMarkdown(pdfBase64: string, filename: string): Promise<string> {
    return this.callOpenRouterOnce(
      [
        {
          role: 'system',
          content: 'Convert documents to clean, well-structured markdown. Preserve all content, headings, lists, code blocks. Output only markdown.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: `Convert this PDF ("${filename}") to markdown. Preserve all content.` },
            { type: 'image_url', image_url: { url: `data:application/pdf;base64,${pdfBase64}` } },
          ],
        },
      ],
      0.1,
      8192
    )
  }

  abort(): void {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
  }

  private emitFinalAnswer(fullAnswer: string): void {
    const trimmed = fullAnswer.trim()
    if (trimmed === this.incompleteQuestionToken) {
      this.emit('done', '')
      return
    }

    this.emit('done', fullAnswer)
  }
}
