import { expect, mock, test } from 'claude-code/testing'

import { about, digest, fold } from './fold'

const LONG = Array.from({ length: 40 }, (_, i) => `linha ${i + 1}`).join('\n')
const BAND = { plugin: 'enxuto', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 80 } as never } as const
const REPLY = { plugin: 'enxuto', component: 'AssistantMessage', props: { text: LONG, isFirstOfReply: true } } as const

test('a short reply is left alone, a long one folds to its head', () => {
  expect(fold('oi\ntudo certo')).toBeNull()
  const folded = fold(LONG)
  expect(folded?.head.split('\n')).toHaveLength(8)
  expect(folded?.hidden).toBe(32)
})

test('a head cut inside a code fence closes it; one giant paragraph is cut, not dropped', () => {
  const code = ['resumo', '```ts', ...Array.from({ length: 30 }, () => 'x()'), '```'].join('\n')
  expect(fold(code)?.head.endsWith('```')).toBe(true)
  expect(fold('a'.repeat(5000))?.head.length).toBeLessThan(1000)
})

test('the digest counts tools, failures and files changed', () => {
  const call = (tool: string, what: string, isError = false) => ({ id: what, tool, what, ms: 10, isDone: true, isError })
  const line = digest([call('Read', 'a.ts'), call('Read', 'b.ts'), call('Edit', 'a.ts'), call('Bash', 'npm test', true)], 48_000)
  expect(line).toBe('⚠ 48s · 4 tools: Read×2 Edit Bash · 1 falhou · mexeu em a.ts')
  expect(about('Edit', { file_path: 'C:\\x\\y\\scene.ts' })).toBe('scene.ts')
})

test('the band draws a block per tool call and its theme button cycles the theme', async ($, on) => {
  mock.clock(on, { now: 0 })
  mock.store(on)
  on('tool.call', () => ({ result: 'ok', text: 'ok' }) as never)
  await $.tool.call({ tool: 'Bash', command: 'ls', description: 'Listando' } as never)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    await ui.drawn()
    expect(await ui.find({ type: 'Text', text: '▰' })).toBeDefined()
    await ui.unmount()
  }
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await ui.find({ key: 'tema' }))?.text).toMatch(/neon/)
  await ui.press({ key: 'tema' })
  expect((await ui.find({ key: 'tema' }))?.text).toMatch(/brasa/)
  await ui.unmount()
})

test('a long reply shows whole with its controls, shuts, opens again, and saves', async ($, on) => {
  mock.clock(on, { now: Date.UTC(2026, 9, 9, 12) })
  mock.store(on)
  const written: string[] = []
  on('fs.write', (_, e) => (written.push(e.path), { value: undefined }) as never)
  on('ui.toast', () => ({ value: undefined }) as never)
  on('ui.render', { component: 'AssistantMessage' }, () => ({ type: 'Text', props: {}, children: ['a resposta inteira'] }) as never)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...REPLY, surface })
    expect(await ui.find({ type: 'Text', text: /a resposta inteira/ })).toBeDefined()
    expect((await ui.find({ key: 'toggle' }))?.text).toMatch(/encolher/)
    await ui.press({ key: 'toggle' })
    expect((await ui.find({ key: 'toggle' }))?.text).toMatch(/abrir \+32 linhas/)
    expect(await ui.find({ type: 'Text', text: /a resposta inteira/ })).toBeUndefined()
    await ui.press({ key: 'toggle' })
    expect((await ui.find({ key: 'toggle' }))?.text).toMatch(/encolher/)
    await ui.press({ key: 'save' })
    await ui.unmount()
  }
  expect(written[0]).toMatch(/respostas.2026-10-09-12-00-00\.md$/)
})

test('a tool row is one line and its result is hidden; a failed call keeps the engine row', async ($, on) => {
  mock.store(on)
  on('ui.render', { component: 'ToolUse' }, () => ({ type: 'Text', props: {}, children: ['linha do motor'] }) as never)
  const row = { tool_use_id: 't1', tool: 'Bash', input: { command: 'npm test', description: 'Rodando os testes' }, isRunning: false, isErrored: false, isInterrupted: false }
  for (const surface of ['terminal', 'desktop'] as const) {
    const ok = await $.ui.mount({ plugin: 'enxuto', surface, component: 'ToolUse', props: row })
    expect(await ok.find({ type: 'Text', text: /Rodando os testes/ })).toBeDefined()
    await ok.unmount()
    const bad = await $.ui.mount({ plugin: 'enxuto', surface, component: 'ToolUse', props: { ...row, isErrored: true } })
    expect(await bad.find({ type: 'Text', text: /linha do motor/ })).toBeDefined()
    await bad.unmount()
    const result = await $.ui.mount({ plugin: 'enxuto', surface, component: 'ToolResult', props: { tool_use_id: 't1', tool: 'Bash', output: { stdout: 'x' }, isErrored: false } })
    expect(await result.drawn()).toMatchObject({ type: 'Box', props: { display: 'none' } })
    await result.unmount()
  }
})
