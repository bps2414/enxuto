import { atom, memberOf, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Call } from '../types'
import { about, digest, fields, fold, took } from './fold'
import { isTheme, kindOf, NAMES, nextTheme, THEMES } from './theme'

const PANE = 'enxuto-turno'
const MIN_TOOLS = 3 // a turn with fewer calls gets no digest line: the rows above already say it
const MODES = ['curto', 'inteiro', 'dobra'] as const
type Mode = (typeof MODES)[number]
const isMode = (value: unknown): value is Mode => MODES.some(m => m === value)
// tools whose row is the content itself: a question, a plan, a file handed over
const FULL = new Set(['AskUserQuestion', 'TodoWrite', 'ExitPlanMode', 'Agent', 'Artifact', 'SendUserFile', 'TaskCreate', 'TaskUpdate'])

const mode = atom({ plugin: 'enxuto', key: 'mode' } as const, 'curto')
const isLean = atom({ plugin: 'enxuto', key: 'isLean' } as const, true)
const calls = atom({ plugin: 'enxuto', key: 'calls' } as const, [])
const view = atom({ plugin: 'enxuto', key: 'view' } as const, '')
const theme = atom({ plugin: 'enxuto', key: 'theme' } as const, 'neon')
const lastMs = atom({ plugin: 'enxuto', key: 'lastMs' } as const, 0)
const lastAnswer = atom({ plugin: 'enxuto', key: 'lastAnswer' } as const, '')

// What the model is told per mode: `curto` gets a short whole reply, `dobra` one that opens with its point (the fold shows the first lines only).
const ASK: Record<Mode, string | undefined> = {
  curto: 'Resposta final de um turno: curta, mas inteira. Abra com a conclusão; depois só o que a pessoa precisa para decidir ou agir. Não recapitule passos, não repita o que as tools já mostraram, não liste o que não mudou, não ofereça próximos passos óbvios. Corte palavras, nunca informação. Se a pessoa pedir detalhe ou explicação longa, dê inteira.',
  inteiro: undefined,
  dobra: 'Na resposta final de um turno, abra com a conclusão em até 2 linhas (o que foi feito ou a resposta direta); os detalhes vêm depois. A interface dobra respostas longas e mostra só o começo.',
}

const modeNow = async ($: EngineInterface): Promise<Mode> => {
  const name = await read($, mode)

  return isMode(name) ? name : 'curto'
}

const palette = async ($: EngineInterface) => {
  const name = await read($, theme)

  return THEMES[isTheme(name) ? name : 'neon']
}

const setTheme = async ($: EngineInterface, pick: (was: string) => string) => {
  const name = await update($, theme, pick)
  await $.store.set('theme', name).catch(() => undefined)

  return name
}

const save = async ($: EngineInterface, text: string) => {
  if (!text.trim()) return 'Nada para salvar ainda.'
  const stamp = new Date(await $.clock.now()).toISOString().slice(0, 19).replace(/[:T]/g, '-')
  const path = `respostas/${stamp}.md`

  return $.fs.write(path, `${text.trimEnd()}\n`).then(
    () => `salvo em ${path}`,
    () => `não consegui salvar em ${path}`,
  )
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'enxuto', description: 'Como as respostas chegam: curtas, inteiras ou dobradas; e as tools numa linha só', argumentHint: `[${MODES.join(' | ')} | tools]` })
    await $.command.register({ name: 'salvar', description: 'Salva a última resposta em respostas/<data>.md' })
    await $.command.register({ name: 'turno', description: 'Painel com as tool calls do último turno, uma por linha' })
    await $.command.register({ name: 'tema', description: 'Troca as cores do enxuto', argumentHint: `[${NAMES.join(' | ')}]` })
    const savedTheme = await $.store.get('theme').catch(() => undefined)
    if (isTheme(savedTheme)) await update($, theme, () => savedTheme)
    const savedMode = await $.store.get('mode').catch(() => undefined)
    if (isMode(savedMode)) await update($, mode, () => savedMode)
    const savedLean = await $.store.get('isLean').catch(() => undefined)
    if (typeof savedLean === 'boolean') await update($, isLean, () => savedLean)

    return next(e)
  })

  on('command.run', { command: 'enxuto' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'tools') {
      const lean = await update($, isLean, was => !was)
      await $.store.set('isLean', lean).catch(() => undefined)

      return { text: lean ? 'enxuto: tools numa linha só.' : 'enxuto: tools inteiras.' }
    }
    if (isMode(arg)) {
      await update($, mode, () => arg)
      await $.store.set('mode', arg).catch(() => undefined)
    }
    const lines = [
      `enxuto: ${await modeNow($)}${(await read($, isLean)) ? ' · tools numa linha' : ''}`,
      '  curto: resposta curta mas inteira (vale do próximo prompt)',
      '  inteiro: resposta como vier',
      '  dobra: resposta longa dobrada, com botão de abrir',
      '  tools: liga/desliga tools numa linha',
    ]

    return { text: lines.join('\n') }
  })

  on('command.run', { command: 'salvar' }, async $ => ({ text: await save($, await read($, lastAnswer)) }))

  on('command.run', { command: 'tema' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg && !isTheme(arg)) return { text: `Temas: ${NAMES.join(', ')}` }
    const name = await setTheme($, was => (isTheme(arg) ? arg : nextTheme(isTheme(was) ? was : 'neon')))

    return { text: `tema: ${name}` }
  })

  on('command.run', { command: 'turno' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Turno' })
    const list = await read($, calls)

    return { text: list.length ? digest(list, await read($, lastMs)) : 'Nenhuma tool call ainda.' }
  })

  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    const text = ASK[await modeNow($)]
    if (text === undefined) return composed

    return { ...composed, sections: [...composed.sections, { id: 'enxuto:lead', text, scope: 'session' as const }] }
  })

  on('turn.start', async ($, e, next) => {
    await update($, calls, () => [])
    await update($, lastMs, () => 0)

    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e) // a subagent's calls are its own turn's
    const startedAt = await $.clock.now()
    const id = e.tool_use_id ?? `${e.tool}:${startedAt}`
    const call: Call = { id, tool: e.tool, what: about(e.tool, fields(e)), ms: 0, isDone: false, isError: false }
    await update($, calls, list => [...list, call].slice(-300))
    const settle = async (isError: boolean) => {
      const ms = (await $.clock.now()) - startedAt
      await update($, calls, list => list.map(c => (c.id === id ? { ...c, ms, isDone: true, isError } : c)))
    }
    try {
      const ran = await next(e)
      await settle(ran.deny !== undefined || ran.isError === true)

      return ran
    } catch (error) {
      await settle(true)
      throw error
    }
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId !== undefined) return done
    await update($, lastMs, () => Math.max(1, e.durationMs))
    if (e.answer) await update($, lastAnswer, () => e.answer)
    const list = await read($, calls)
    if (list.length >= MIN_TOOLS) {
      // a notice: the person sees it, the model never reads it
      await $.session.append({ message: { type: 'system', content: [{ type: 'text', text: digest(list, e.durationMs) }] } }).catch(() => undefined)
    }

    return done
  })

  // The turn as a strip of colored blocks, one per tool call, colored by what the call did.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || e.props.maxRows < 2) return next(e)
    const { Box, Button, Text } = $.ui.resolve(e)
    const colors = await palette($)
    const name = await read($, theme)
    const list = await read($, calls)
    const ms = await read($, lastMs)
    const room = Math.max(8, e.props.bodyColumns - 2)
    const shown = list.slice(-room)
    const live = list.findLast(c => !c.isDone)
    const failed = list.filter(c => c.isError).length
    const head = live
      ? `▶ ${live.tool.split('__').pop()} ${live.what}`
      : e.props.isWorking
        ? '▶ pensando…'
        : ms > 0
          ? `✓ ${took(ms)} · ${list.length} tools${failed ? ` · ${failed} ${failed > 1 ? 'falharam' : 'falhou'}` : ''}`
          : 'pronto'

    return (
      <Box flexDirection="column">
        <Box flexDirection="row">
          {shown.length === 0 && <Text color={colors.idle}>{'▱'.repeat(Math.min(room, 24))}</Text>}
          {shown.map(c => (
            <Text color={c.isError ? colors.fail : c.isDone ? colors[kindOf(c.tool)] : colors.accent}>{c.isDone ? '▰' : '▱'}</Text>
          ))}
        </Box>
        <Box flexDirection="row">
          <Text bold color={colors.accent} wrap="truncate-end">{head.slice(0, Math.max(10, room - 28))} </Text>
          <Button key="turno" plain dimColor label="turno" onPress={() => void $.ui.open({ id: PANE, title: 'Turno' })} />
          <Text dimColor> · </Text>
          <Button key="tema" plain dimColor label={`◐ ${name}`} onPress={() => void setTheme($, was => nextTheme(isTheme(was) ? was : 'neon'))} />
        </Box>
      </Box>
    )
  })

  // A long reply gets a row of its own controls: shut or open it, save it, copy it.
  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const folded = fold(e.props.text)
    if (folded === null) return next(e)
    const mine = memberOf(view, e)
    const chosen = await read($, mine)
    const isOpen = chosen === '' ? (await modeNow($)) !== 'dobra' : chosen === 'open'

    const { Box, Button, Markdown, Text } = $.ui.resolve(e)
    const colors = await palette($)
    const full = e.props.text
    const controls = (
      <Box flexDirection="row">
        <Text color={colors.accent}>{isOpen ? '▾ ' : '▸ '}</Text>
        <Button key="toggle" variant={isOpen ? 'secondary' : 'primary'} dimColor={isOpen} label={isOpen ? 'encolher' : `abrir +${folded.hidden} linhas`} onPress={() => update($, mine, () => (isOpen ? 'shut' : 'open'))} />
        <Text> </Text>
        <Button key="save" dimColor label="salvar" onPress={() => void save($, full).then(said => $.ui.toast(said))} />
        <Text> </Text>
        <Button key="copy" dimColor label="copiar" onPress={press => void $.ui.copy({ text: full, surface: press.surface })} />
      </Box>
    )
    if (isOpen) return <Box flexDirection="column">{await next(e)}{controls}</Box>

    return (
      <Box flexDirection="row">
        <Text color={colors.accent}>{e.props.isFirstOfReply ? '● ' : '  '}</Text>
        <Box flexDirection="column">
          <Markdown text={folded.head} />
          {controls}
        </Box>
      </Box>
    )
  })

  // A tool call is one colored line; what it printed stays a ctrl+o (or /turno) away. A failed call keeps the engine's full row.
  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    const { tool, isErrored, isInterrupted, isRunning } = e.props
    if (isErrored || isInterrupted || FULL.has(tool) || !(await read($, isLean))) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const colors = await palette($)

    return (
      <Box flexDirection="row">
        <Text color={isRunning ? colors.accent : colors[kindOf(tool)]}>{isRunning ? '▱ ' : '▰ '}</Text>
        <Text bold={isRunning}>{tool.split('__').pop()} </Text>
        <Text dimColor wrap="truncate-end">{about(tool, fields(e.props.input))}</Text>
      </Box>
    )
  })

  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    if (e.props.isErrored || FULL.has(e.props.tool) || !(await read($, isLean))) return next(e)
    const { Box } = $.ui.resolve(e)

    return <Box display="none" />
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const colors = await palette($)
    const list = await read($, calls)
    const ms = (await read($, lastMs)) || list.reduce((sum, c) => sum + c.ms, 0)
    const width = Math.max(20, e.props.bodyColumns)

    return (
      <Box flexDirection="column">
        {list.length === 0 && <Text dimColor>Nenhuma tool call neste turno.</Text>}
        {list.length > 0 && <Text bold color={colors.accent}>{digest(list, ms)}</Text>}
        {list.map(c => (
          <Box flexDirection="row">
            <Text color={c.isError ? colors.fail : colors[kindOf(c.tool)]}>{c.isError ? '✗ ' : c.isDone ? '▰ ' : '▱ '}</Text>
            <Text wrap="truncate-end" dimColor={c.isDone && !c.isError}>
              {`${c.tool.split('__').pop()} ${c.what}`.slice(0, width - 12) + (c.isDone ? ` ${took(c.ms)}` : '')}
            </Text>
          </Box>
        ))}
      </Box>
    )
  })
}
