import React, { useState, useEffect } from 'react'
import { Key, Eye, EyeOff, Check, SlidersHorizontal, Cpu, Shield, ToggleLeft, ToggleRight, Code, ExternalLink } from 'lucide-react'

const inputClass =
  'input-premium w-full rounded-xl bg-white/[0.025] border border-white/[0.06] px-4 py-2.5 text-[13px] text-white/80 placeholder:text-white/15 focus:border-cyan-500/25 focus:outline-none transition-all font-mono tracking-wide'

export default function ApiConfig() {
  const [openrouterKey, setOpenrouterKey] = useState('')
  const [deepgramKey, setDeepgramKey] = useState('')
  const [model, setModel] = useState('google/gemini-3-flash-preview')
  const [codingModel, setCodingModel] = useState('')
  const [autoModelSelection, setAutoModelSelection] = useState(false)
  const [overlayOpacity, setOverlayOpacity] = useState(0.92)
  const [fontSize, setFontSize] = useState(14)
  const [saved, setSaved] = useState(false)
  const [showKeys, setShowKeys] = useState(false)

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    const config = await window.api.getConfig()
    if (config) {
      setOpenrouterKey(config.openrouterApiKey || '')
      setDeepgramKey(config.deepgramApiKey || '')
      setModel(config.defaultModel || 'google/gemini-2.5-flash-preview')
      setCodingModel(config.codingModel || '')
      setAutoModelSelection(config.autoModelSelection ?? false)
      setOverlayOpacity(config.overlayOpacity ?? 0.92)
      setFontSize(config.fontSize ?? 14)
    }
  }

  const handleSave = async () => {
    await window.api.setConfig({
      openrouterApiKey: openrouterKey,
      deepgramApiKey: deepgramKey,
      defaultModel: model,
      codingModel,
      autoModelSelection,
      overlayOpacity,
      fontSize,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const models = [
    { id: 'google/gemma-4-26b-a4b-it:free', name: 'Gemma 4 26B', cost: 'Free', tier: 'free', codingRec: false, vision: true },
    { id: 'google/gemma-4-31b-it:free', name: 'Gemma 4 31B', cost: 'Free', tier: 'free', codingRec: false, vision: true },
    { id: 'google/gemini-3-flash-preview', name: 'Gemini 3 Flash', cost: 'Cheap & fast', tier: 'budget', codingRec: false, vision: true },
    { id: 'google/gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash Lite', cost: 'Cheapest', tier: 'budget', codingRec: false, vision: true },
    { id: 'deepseek/deepseek-chat-v3-0324', name: 'DeepSeek V3', cost: '$0.30/1M in', tier: 'budget', codingRec: 'Best value', vision: false },
    { id: 'meta-llama/llama-4-scout', name: 'Llama 4 Scout', cost: '$0.15/1M in', tier: 'budget', codingRec: false, vision: true },
    { id: 'openai/gpt-4.1-mini', name: 'GPT-4.1 Mini', cost: '$0.40/1M in', tier: 'mid', codingRec: 'Strong', vision: true },
    { id: 'anthropic/claude-3.5-haiku', name: 'Claude 3.5 Haiku', cost: '$0.80/1M in', tier: 'mid', codingRec: false, vision: true },
    { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', cost: '$3/1M in', tier: 'premium', codingRec: 'Top tier', vision: true },
  ]

  const tierColors: Record<string, string> = {
    free: 'text-violet-400/70',
    budget: 'text-emerald-400/50',
    mid: 'text-amber-400/50',
    premium: 'text-cyan-400/50',
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h2 className="text-[18px] font-semibold text-white/90 tracking-tight">Settings</h2>
        <p className="text-[13px] text-white/35 mt-1">
          API keys, model selection, and overlay preferences.
        </p>
      </div>

      {/* API Keys */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Shield size={14} className="text-white/25" />
            <h3 className="text-[12px] font-semibold text-white/50 uppercase tracking-wider">
              API Keys
            </h3>
          </div>
          <button
            onClick={() => setShowKeys(!showKeys)}
            className="flex items-center gap-1.5 text-[11px] text-white/30 hover:text-white/55 transition-colors rounded-lg px-2 py-1 hover:bg-white/[0.03]"
          >
            {showKeys ? <EyeOff size={12} /> : <Eye size={12} />}
            {showKeys ? 'Hide' : 'Reveal'}
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-[11.5px] font-medium text-white/40 mb-2 uppercase tracking-wider">
              OpenRouter
            </label>
            <input
              type={showKeys ? 'text' : 'password'}
              value={openrouterKey}
              onChange={(e) => setOpenrouterKey(e.target.value)}
              placeholder="sk-or-..."
              className={inputClass}
            />
            <button
              onClick={() => window.api.openExternal('https://openrouter.ai/keys')}
              className="flex items-center gap-1 mt-1.5 text-[10.5px] text-white/25 hover:text-cyan-400/60 transition-colors"
            >
              <ExternalLink size={10} />
              Get your free API key at openrouter.ai/keys
            </button>
          </div>

          <div>
            <label className="block text-[11.5px] font-medium text-white/40 mb-2 uppercase tracking-wider">
              Deepgram
            </label>
            <input
              type={showKeys ? 'text' : 'password'}
              value={deepgramKey}
              onChange={(e) => setDeepgramKey(e.target.value)}
              placeholder="your-deepgram-key..."
              className={inputClass}
            />
            <button
              onClick={() => window.api.openExternal('https://console.deepgram.com')}
              className="flex items-center gap-1 mt-1.5 text-[10.5px] text-white/25 hover:text-cyan-400/60 transition-colors"
            >
              <ExternalLink size={10} />
              Get your free API key at console.deepgram.com
            </button>
          </div>
        </div>
      </div>

      {/* Model Selection */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Cpu size={14} className="text-white/25" />
          <h3 className="text-[12px] font-semibold text-white/50 uppercase tracking-wider">
            LLM Model
          </h3>
        </div>
        <div className="rounded-2xl border border-white/[0.045] overflow-hidden">
          {models.map((m, i) => {
            const isSelected = model === m.id
            return (
              <button
                key={m.id}
                onClick={() => setModel(m.id)}
                className={`w-full flex items-center justify-between px-4 py-3 cursor-pointer transition-all duration-150 text-left ${
                  i < models.length - 1 ? 'border-b border-white/[0.035]' : ''
                } ${
                  isSelected
                    ? 'bg-cyan-500/[0.06]'
                    : 'bg-transparent hover:bg-white/[0.025]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                      isSelected
                        ? 'border-cyan-400 bg-cyan-400/10'
                        : 'border-white/15'
                    }`}
                  >
                    {isSelected && (
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    )}
                  </div>
                  <span className={`text-[13px] font-medium ${isSelected ? 'text-white/90' : 'text-white/60'}`}>
                    {m.name}
                  </span>
                  {m.tier === 'free' && (
                    <span className="rounded-md bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-violet-400/80 uppercase tracking-wider">
                      Free
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {m.vision && (
                    <span title="Supports screen analysis"><Eye size={11} className="text-white/20" /></span>
                  )}
                  <span className={`text-[10.5px] font-medium ${tierColors[m.tier]}`}>
                    {m.cost}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-3 text-[10.5px] text-white/25 mt-2">
          <span className="flex items-center gap-1">
            <Eye size={10} /> = supports screen analysis
          </span>
          <span className="flex items-center gap-1">
            <span className="rounded-md bg-violet-500/10 px-1 py-0.5 text-[8px] font-semibold text-violet-400/80">FREE</span>
            = rate-limited, best for testing
          </span>
        </div>
      </div>

      {/* Auto Model Selection */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Code size={14} className="text-white/25" />
          <h3 className="text-[12px] font-semibold text-white/50 uppercase tracking-wider">
            Smart Model Routing
          </h3>
        </div>

        <div className="rounded-2xl bg-white/[0.02] border border-white/[0.045] p-5 space-y-5">
          {/* Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[12.5px] text-white/60">Auto Model Selection</div>
              <div className="text-[11px] text-white/30 mt-0.5">
                Route coding questions to a specialized model
              </div>
            </div>
            <button
              onClick={() => setAutoModelSelection(!autoModelSelection)}
              className="text-white/60 hover:text-white/80 transition-colors"
            >
              {autoModelSelection ? (
                <ToggleRight size={28} className="text-cyan-400" />
              ) : (
                <ToggleLeft size={28} />
              )}
            </button>
          </div>

          {/* Coding Model Picker */}
          {autoModelSelection && (
            <div className="border-t border-white/[0.04] pt-5">
              <label className="block text-[11.5px] font-medium text-white/40 mb-3 uppercase tracking-wider">
                Coding Model
              </label>
              <div className="rounded-xl border border-white/[0.045] overflow-hidden">
                {models.map((m, i) => {
                  const isSelected = codingModel === m.id
                  return (
                    <button
                      key={m.id}
                      onClick={() => setCodingModel(m.id)}
                      className={`w-full flex items-center justify-between px-4 py-2.5 cursor-pointer transition-all duration-150 text-left ${
                        i < models.length - 1 ? 'border-b border-white/[0.035]' : ''
                      } ${
                        isSelected
                          ? 'bg-emerald-500/[0.06]'
                          : 'bg-transparent hover:bg-white/[0.025]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                            isSelected
                              ? 'border-emerald-400 bg-emerald-400/10'
                              : 'border-white/15'
                          }`}
                        >
                          {isSelected && (
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          )}
                        </div>
                        <span className={`text-[12.5px] font-medium ${isSelected ? 'text-white/90' : 'text-white/55'}`}>
                          {m.name}
                        </span>
                        {m.codingRec && (
                          <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-400/70 uppercase tracking-wider">
                            {m.codingRec}
                          </span>
                        )}
                      </div>
                      <span className={`text-[10px] font-medium ${tierColors[m.tier]}`}>
                        {m.cost}
                      </span>
                    </button>
                  )
                })}
              </div>
              <p className="text-[10.5px] text-white/25 mt-2.5">
                Used for: screen analysis, coding interviews, and coding-related questions
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Overlay Settings */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <SlidersHorizontal size={14} className="text-white/25" />
          <h3 className="text-[12px] font-semibold text-white/50 uppercase tracking-wider">
            Overlay
          </h3>
        </div>

        <div className="rounded-2xl bg-white/[0.02] border border-white/[0.045] p-5 space-y-5">
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-[12.5px] text-white/50">Opacity</label>
              <span className="text-[12px] font-mono text-cyan-400/70 bg-cyan-400/[0.06] rounded-md px-2 py-0.5">
                {Math.round(overlayOpacity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.3"
              max="1"
              step="0.01"
              value={overlayOpacity}
              onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          <div className="border-t border-white/[0.04] pt-5">
            <div className="flex items-center justify-between mb-3">
              <label className="text-[12.5px] text-white/50">Font Size</label>
              <span className="text-[12px] font-mono text-cyan-400/70 bg-cyan-400/[0.06] rounded-md px-2 py-0.5">
                {fontSize}px
              </span>
            </div>
            <input
              type="range"
              min="10"
              max="20"
              step="1"
              value={fontSize}
              onChange={(e) => setFontSize(parseInt(e.target.value))}
              className="w-full"
            />
          </div>
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
          'Save Settings'
        )}
      </button>
    </div>
  )
}
