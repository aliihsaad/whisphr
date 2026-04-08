import { InterviewType, ModelSelectionInfo } from './types'

const CODING_KEYWORDS = [
  'function', 'array', 'object', 'class', 'loop', 'bug', 'debug',
  'algorithm', 'runtime', 'complexity', 'recursion', 'sql', 'database',
  'api', 'binary tree', 'linked list', 'hash map', 'stack', 'queue',
  'graph', 'sorting', 'dynamic programming', 'pointer', 'string',
  'implement', 'optimize', 'refactor', 'syntax', 'compile', 'variable',
  'data structure', 'tree traversal', 'big o', 'time complexity',
  'space complexity', 'recursive', 'iterative', 'pseudocode',
]

const SYSTEM_DESIGN_KEYWORDS = [
  'system design', 'scalability', 'scale', 'distributed system', 'distributed systems',
  'load balancer', 'caching', 'cache', 'throughput', 'latency', 'availability',
  'consistency', 'partition tolerance', 'microservice', 'microservices', 'queue',
  'message queue', 'pub sub', 'rate limit', 'rate limiting', 'database sharding',
  'replication', 'failover', 'service discovery', 'high level design', 'low level design',
]

// Pre-build regex for efficient matching
const CODING_PATTERN = new RegExp(
  `\\b(${CODING_KEYWORDS.map((k) => k.replace(/\s+/g, '\\s+')).join('|')})\\b`,
  'i'
)

const SYSTEM_DESIGN_PATTERN = new RegExp(
  `\\b(${SYSTEM_DESIGN_KEYWORDS.map((k) => k.replace(/\s+/g, '\\s+')).join('|')})\\b`,
  'i'
)

export function looksLikeCodingQuestion(question: string | undefined): boolean {
  if (!question?.trim()) return false
  return CODING_PATTERN.test(question)
}

export function looksLikeSystemDesignQuestion(question: string | undefined): boolean {
  if (!question?.trim()) return false
  return SYSTEM_DESIGN_PATTERN.test(question)
}

export type AnswerSource = 'transcript' | 'manual' | 'screen-analysis'

export interface SelectModelParams {
  autoModelSelection: boolean
  source: AnswerSource
  interviewType: InterviewType
  question: string
  defaultModel: string
  codingModel: string
}

export function selectModel(params: SelectModelParams): ModelSelectionInfo {
  const { autoModelSelection, source, interviewType, question, defaultModel, codingModel } = params

  if (!autoModelSelection) {
    return {
      modelId: defaultModel,
      reason: 'Auto routing off',
    }
  }

  if (!codingModel) {
    return {
      modelId: defaultModel,
      reason: 'Coding model not configured',
    }
  }

  if (source === 'screen-analysis') {
    return {
      modelId: codingModel,
      reason: 'Screen analysis',
    }
  }

  if (interviewType === 'coding') {
    return {
      modelId: codingModel,
      reason: 'Coding interview',
    }
  }

  if (interviewType === 'system-design') {
    return {
      modelId: codingModel,
      reason: 'System design interview',
    }
  }

  if (looksLikeSystemDesignQuestion(question)) {
    return {
      modelId: codingModel,
      reason: 'System design question',
    }
  }

  if (looksLikeCodingQuestion(question)) {
    return {
      modelId: codingModel,
      reason: 'Coding question',
    }
  }

  return {
    modelId: defaultModel,
    reason: 'Default model',
  }
}
