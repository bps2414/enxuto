export type Kind = 'read' | 'edit' | 'run' | 'web' | 'agent' | 'other'
export type Theme = { accent: string; fail: string; idle: string } & Record<Kind, string>

// Every color of the mod comes from here: the band's blocks, the fold's card, the pane.
export const THEMES = {
  neon: { accent: '#ff2bd6', read: '#22d3ee', edit: '#ff2bd6', run: '#a3ff12', web: '#7c5cff', agent: '#ffe600', other: '#8b8fa3', fail: '#ff3355', idle: '#3a2a55' },
  brasa: { accent: '#ff6b1a', read: '#ffb347', edit: '#ff6b1a', run: '#ff3d2e', web: '#ffd166', agent: '#f7a072', other: '#9a8478', fail: '#ffffff', idle: '#4a2a1c' },
  mata: { accent: '#3ddc84', read: '#9be564', edit: '#3ddc84', run: '#f2c14e', web: '#4fc3a1', agent: '#c5e478', other: '#7d8f7a', fail: '#ff5a5f', idle: '#1f3d2b' },
  gelo: { accent: '#5cc8ff', read: '#b8e6ff', edit: '#5cc8ff', run: '#7b8cff', web: '#9df3e6', agent: '#d6c8ff', other: '#8395a7', fail: '#ff6b81', idle: '#1d3348' },
  sunset: { accent: '#ff7eb6', read: '#ffd27d', edit: '#ff7eb6', run: '#ff9a5c', web: '#b28dff', agent: '#7ad7f0', other: '#9c8aa5', fail: '#ff4d4d', idle: '#40284a' },
  mono: { accent: '#ffffff', read: '#8a8a8a', edit: '#ffffff', run: '#c4c4c4', web: '#6a6a6a', agent: '#e0e0e0', other: '#4a4a4a', fail: '#ff4444', idle: '#242424' },
} as const satisfies Record<string, Theme>

export type ThemeName = keyof typeof THEMES
export const NAMES = Object.keys(THEMES) as ThemeName[]
export const isTheme = (name: unknown): name is ThemeName => typeof name === 'string' && name in THEMES
export const nextTheme = (name: ThemeName): ThemeName => NAMES[(NAMES.indexOf(name) + 1) % NAMES.length] ?? 'neon'

const KINDS: Record<string, Kind> = {
  Read: 'read', Grep: 'read', Glob: 'read', LSP: 'read', ToolSearch: 'read',
  Edit: 'edit', Write: 'edit', NotebookEdit: 'edit',
  Bash: 'run', PowerShell: 'run', Monitor: 'run',
  WebFetch: 'web', WebSearch: 'web',
  Agent: 'agent', Skill: 'agent', SendMessage: 'agent',
}

export const kindOf = (tool: string): Kind => KINDS[tool] ?? (tool.includes('browser') || tool.includes('chrome') ? 'web' : 'other')
