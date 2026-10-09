import type { Call } from '../types'

// the calibration knobs: a reply past either limit folds down to its head
export const MAX_LINES = 14
export const MAX_CHARS = 1400
const HEAD_LINES = 8
const HEAD_CHARS = 900

/** The head a long reply folds to and how many lines it hides; null for a reply short enough to show whole. */
export const fold = (text: string): { head: string; hidden: number } | null => {
  const lines = text.trimEnd().split('\n')
  if (lines.length <= MAX_LINES && text.length <= MAX_CHARS) return null

  const kept: string[] = []
  let chars = 0
  for (const line of lines) {
    if (kept.length >= HEAD_LINES || chars + line.length > HEAD_CHARS) break
    kept.push(line)
    chars += line.length
  }
  // one giant first paragraph: cut it rather than show nothing
  if (kept.length === 0) kept.push(`${(lines[0] ?? '').slice(0, HEAD_CHARS)}…`)
  while (kept.length > 1 && kept.at(-1)?.trim() === '') kept.pop()
  // a head that ends inside a code fence closes it, or the row below would draw as code
  if (kept.filter(l => l.trimStart().startsWith('```')).length % 2 === 1) kept.push('```')

  return { head: kept.join('\n'), hidden: Math.max(1, lines.length - kept.length) }
}

/** A tool's arguments as the fields `about` reads: anything that is no object has none. */
export const fields = (input: unknown): Record<string, unknown> => (typeof input === 'object' && input !== null ? { ...input } : {})

const base = (path: string) => path.replace(/\\/g, '/').split('/').pop() ?? path

/** What a call was about, from its own arguments: costs no token. */
export const about = (tool: string, input: Record<string, unknown>): string => {
  const pick = (key: string) => {
    const value = input[key]

    return typeof value === 'string' ? value : undefined
  }
  const file = pick('file_path') ?? pick('notebook_path')
  const text = file ? base(file) : (pick('description') ?? pick('pattern') ?? pick('command') ?? pick('url') ?? pick('query') ?? pick('skill') ?? '')

  return text.replace(/\s+/g, ' ').slice(0, 60)
}

export const took = (ms: number) => (ms < 1000 ? `${ms}ms` : ms < 60_000 ? `${Math.round(ms / 1000)}s` : `${Math.floor(ms / 60_000)}min${String(Math.round((ms % 60_000) / 1000)).padStart(2, '0')}`)

const WRITES = new Set(['Edit', 'Write', 'NotebookEdit'])

/** The turn in one line: how long, which tools how often, what failed, which files changed. */
export const digest = (calls: readonly Call[], ms: number): string => {
  const count = new Map<string, number>()
  for (const c of calls) {
    const name = c.tool.startsWith('mcp__') ? (c.tool.split('__').pop() ?? c.tool) : c.tool
    count.set(name, (count.get(name) ?? 0) + 1)
  }
  const tools = [...count].sort((a, b) => b[1] - a[1]).map(([name, n]) => (n > 1 ? `${name}×${n}` : name))
  const failed = calls.filter(c => c.isError).length
  const files = [...new Set(calls.filter(c => WRITES.has(c.tool) && !c.isError).map(c => c.what))]
  const parts = [
    `${failed ? '⚠' : '✓'} ${took(ms)}`,
    `${calls.length} tools: ${tools.slice(0, 6).join(' ')}${tools.length > 6 ? ' …' : ''}`,
    ...(failed ? [`${failed} ${failed > 1 ? 'falharam' : 'falhou'}`] : []),
    ...(files.length ? [`mexeu em ${files.slice(0, 4).join(', ')}${files.length > 4 ? ` +${files.length - 4}` : ''}`] : []),
  ]

  return parts.join(' · ')
}
